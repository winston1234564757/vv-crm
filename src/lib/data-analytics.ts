import { createClient } from "./supabase/server";
import { repairSettledAt } from "./repair-flow";
import { getSettings } from "./data-settings";
import { allocateSaleRevenue, type ProfitSaleItem } from "./profit";
import type { ModelAnalyticsItem, StockoutItem, HeatmapRow } from "@/components/dashboard/widget-types";

// Duplicated (not shared) from data-dashboard.ts on purpose — see Task 7 report.
// getRealtimeDashboardData still computes these same figures for the dashboard
// today; Task 8 rewrites/removes that function, so this file intentionally
// does not depend on it.
function todayRange() {
  const s = new Date();
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return { start: s.toISOString(), end: e.toISOString() };
}

function nDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export interface AnalyticsData {
  // Sales velocity + peak hours (SalesVelocityMatrix)
  salesVelocity: {
    device: number;
    accessory: number;
    part: number;
    service: number;
  };
  peakHours: number[];

  // Cross-sell (CrossSellWidget)
  crossSellConversionRate: number;
  crossSellRevenue30Days: number;
  crossSellDealsCount: number;

  // B2B partner share (B2BPartnerShareWidget)
  partnerVolumeShare: number;
  partnerRevenueTotal: number;

  // Refurbishment (RefurbishmentWidget)
  refurbishmentCapital: number;
  refurbishmentMargin: number;

  // Customer retention (the "Утримання клієнтів" StatCard)
  customerReturnRate: number;
  newCustomers: number;

  // Smart Intelligence RPCs
  modelAnalytics: ModelAnalyticsItem[];
  stockoutForecast: StockoutItem[];
  revenueHeatmap: HeatmapRow[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const supabase = await createClient();
  const { start, end } = todayRange();

  /* Вікна притиснуті до фінансової епохи. До відкриття магазину чеки писались
     «з рук»: епоха 21.07, а тридцять днів назад — це 30.06, тож без цієї межі
     дотестова торгівля лежить усередині кожного вікна і роздуває і виторг, і
     частку партнерів, і швидкість продажів. Межа одна на всю систему. */
  const epoch = (await getSettings()).finance_epoch;
  const floorIso = (iso: string) => (epoch && epoch > iso ? epoch : iso);
  const thirtyDaysAgo = floorIso(nDaysAgo(30));
  const ninetyDaysAgo = floorIso(nDaysAgo(90));

  const [
    newCustomersRes,

    activeRefurbRes,
    completedRefurbRes,
    partnerSalesRes,
    partnerRepairsRes,
    saleItems30DaysRes,
    sales90DaysRes,
    repairs90DaysRes,
    salesTimestampsRes,
    repairsTimestampsRes,

    modelDemandRes,
    stockoutRes,
    heatmapRes,
  ] = await Promise.all([
    supabase.from("customers").select("id").gte("created_at", start).lt("created_at", end),

    // Refurbishment Capital (Devices currently under restoration)
    supabase
      .from("devices")
      .select("id, brand, model, imei, price, cost_price, repair_cost, repair_parts_replaced, updated_at")
      .eq("status", "service"),
    // Completed Refurbishments Margin (Added value of completed device restorations)
    supabase
      .from("devices")
      .select("id, brand, model, imei, status, price, cost_price, repair_cost, repair_parts_replaced, updated_at")
      .in("status", ["in_stock", "sold"])
      .gt("repair_cost", 0)
      .gte("updated_at", thirtyDaysAgo),
    // Partner Sales (B2B channel)
    supabase.from("sales").select("total_amount, partner_id").gte("created_at", thirtyDaysAgo),
    /* Ремонт заробляється на видачі (`repairSettledAt`), тож і вікно по ній.
       За `created_at` ремонт, прийнятий сорок днів тому й виданий учора, у
       тридцятиденне вікно не потрапляв би — хоча гроші зайшли всередині нього. */
    supabase
      .from("repairs")
      .select("price, partner_id, status, completed_at")
      .is("inventory_device_id", null)
      .gte("completed_at", thirtyDaysAgo),
    /* `total_amount` чека потрібен, щоб рознести знижку по позиціях: у
       `sale_items.total_price` лежить ціна ДО знижки, і підсумовувати її як
       виторг означає завищувати його на всю знижку. */
    supabase
      .from("sale_items")
      .select("item_id, item_type, total_price, unit_cost, quantity, sales!inner(created_at, id, total_amount)")
      .gte("sales.created_at", thirtyDaysAgo),
    // Customer Retention Rate (Sales 90d)
    supabase.from("sales").select("customer_id").gte("created_at", ninetyDaysAgo),
    // Customer Retention Rate (Repairs 90d)
    supabase.from("repairs").select("customer_id").gte("created_at", ninetyDaysAgo),
    // Peak Hours (Sales)
    supabase.from("sales").select("created_at").gte("created_at", thirtyDaysAgo),
    // Peak Hours (Repairs)
    supabase.from("repairs").select("created_at").gte("created_at", thirtyDaysAgo),

    // Smart Intelligence RPCs
    supabase.rpc("get_model_demand_analytics", { days_back: 90 }),
    supabase.rpc("get_inventory_stockout_forecast"),
    supabase.rpc("get_revenue_heatmap", { days_back: 60 }),
  ]);

  const newCustomers = newCustomersRes.data?.length ?? 0;

  // Refurbishment
  const soldDeviceIds = new Set(
    (saleItems30DaysRes.data ?? [])
      .filter((item: any) => item.item_type === "device")
      .map((item: any) => item.item_id)
  );
  const soldDevicePrices = new Map<string, number>(
    (saleItems30DaysRes.data ?? [])
      .filter((item: any) => item.item_type === "device")
      .map((item: any) => [item.item_id, item.total_price])
  );

  const refurbishmentCapitalDevices = (activeRefurbRes.data ?? []).map((d: any) => ({
    cost_price: d.cost_price,
    repair_cost: d.repair_cost,
  }));
  const refurbishmentCapital = refurbishmentCapitalDevices.reduce((sum, d) => sum + d.cost_price + d.repair_cost, 0);

  const refurbishmentMarginDevices = (completedRefurbRes.data ?? [])
    .filter((d: any) => d.status === "in_stock" || soldDeviceIds.has(d.id))
    .map((d: any) => {
      const sale_price = d.status === "sold" ? (soldDevicePrices.get(d.id) ?? d.price) : null;
      return {
        status: d.status,
        cost_price: d.cost_price,
        repair_cost: d.repair_cost,
        price: d.price,
        sale_price,
      };
    });
  const refurbishmentMargin = refurbishmentMarginDevices
    .filter((d) => d.status === "sold")
    .reduce((sum, d) => sum + ((d.sale_price || d.price || 0) - d.cost_price - d.repair_cost), 0);

  // Partner share
  const partnerSalesTotal = (partnerSalesRes.data ?? [])
    .filter((s) => s.partner_id !== null)
    .reduce((sum, s) => sum + s.total_amount, 0);
  // Заробленим ремонт стає за тим самим правилом, що й у P&L: на видачі
  // клієнту. Правило одне на всю систему — див. `repairSettledAt`.
  const settledRepairs30Days = (partnerRepairsRes.data ?? []).filter(
    (r) => repairSettledAt(r) !== null,
  );

  const partnerRepairsTotal = settledRepairs30Days
    .filter((r) => r.partner_id !== null)
    .reduce((sum, r) => sum + r.price, 0);
  const partnerRevenueTotal = partnerSalesTotal + partnerRepairsTotal;

  const totalSales30Days = (partnerSalesRes.data ?? []).reduce((sum, s) => sum + s.total_amount, 0);
  const totalRepairs30Days = settledRepairs30Days.reduce((sum, r) => sum + r.price, 0);
  const totalRevenue30Days = totalSales30Days + totalRepairs30Days;
  const partnerVolumeShare = totalRevenue30Days > 0 ? Math.round((partnerRevenueTotal / totalRevenue30Days) * 100) : 0;

  /* Позиції групуються по чеках, і знижка кожного чека розноситься по його
     позиціях тим самим `allocateSaleRevenue`, що рахує P&L. Інакше «швидкість
     продажів» і «виторг з допродажів» називались би виторгом, а показували б
     суму цінників. */
  interface AnalyticsLine {
    item_type: string;
    revenue: number;
  }
  const linesBySale = new Map<string, AnalyticsLine[]>();
  {
    const raw = new Map<string, { total_amount: number; items: ProfitSaleItem[]; types: string[] }>();
    for (const row of (saleItems30DaysRes.data ?? []) as any[]) {
      const sale = row.sales;
      if (!sale?.id) continue;
      const bucket: { total_amount: number; items: ProfitSaleItem[]; types: string[] } = raw.get(
        sale.id,
      ) ?? {
        total_amount: sale.total_amount ?? 0,
        items: [],
        types: [],
      };
      bucket.items.push({
        item_type: row.item_type,
        item_id: row.item_id,
        quantity: row.quantity ?? 1,
        total_price: row.total_price ?? 0,
        unit_cost: row.unit_cost ?? 0,
      });
      bucket.types.push(row.item_type);
      raw.set(sale.id, bucket);
    }
    for (const [saleId, b] of raw) {
      const revenues = allocateSaleRevenue(b.items, b.total_amount);
      linesBySale.set(
        saleId,
        b.types.map((item_type, i) => ({ item_type, revenue: revenues[i] })),
      );
    }
  }

  const salesVelocity = { device: 0, accessory: 0, part: 0, service: 0 };
  for (const lines of linesBySale.values()) {
    for (const l of lines) {
      if (l.item_type in salesVelocity) {
        salesVelocity[l.item_type as keyof typeof salesVelocity] += l.revenue;
      }
    }
  }

  let totalCoreSales = 0; // чеки, де є техніка або послуга
  let crossSalesCount = 0; // з них ті, де є ще й аксесуар
  let crossSellRevenue30Days = 0; // виторг аксесуарів у таких чеках

  for (const lines of linesBySale.values()) {
    const hasDeviceOrService = lines.some(
      (l) => l.item_type === "device" || l.item_type === "service",
    );
    if (!hasDeviceOrService) continue;
    totalCoreSales++;
    const hasAccessory = lines.some((l) => l.item_type === "accessory");
    if (!hasAccessory) continue;
    crossSalesCount++;
    for (const l of lines) {
      if (l.item_type === "accessory") crossSellRevenue30Days += l.revenue;
    }
  }

  const crossSellConversionRate =
    totalCoreSales > 0 ? Math.round((crossSalesCount / totalCoreSales) * 100) : 0;
  const crossSellDealsCount = crossSalesCount;

  // Customer retention
  const customerTransactionCount = new Map<string, number>();
  const countTx = (id: string | null) => {
    if (id) customerTransactionCount.set(id, (customerTransactionCount.get(id) || 0) + 1);
  };
  (sales90DaysRes.data ?? []).forEach((s) => countTx(s.customer_id));
  (repairs90DaysRes.data ?? []).forEach((r) => countTx(r.customer_id));

  const totalIdentifiedCustomers = customerTransactionCount.size;
  let repeatCustomersCount = 0;
  customerTransactionCount.forEach((count) => {
    if (count >= 2) repeatCustomersCount++;
  });
  const customerReturnRate = totalIdentifiedCustomers > 0 ? Math.round((repeatCustomersCount / totalIdentifiedCustomers) * 100) : 0;

  // Peak hours
  const hourlyCounts = new Array(24).fill(0);
  const addTimestamp = (createdAt: string) => {
    const hour = new Date(createdAt).getHours();
    if (hour >= 0 && hour < 24) hourlyCounts[hour]++;
  };
  (salesTimestampsRes.data ?? []).forEach((s) => addTimestamp(s.created_at));
  (repairsTimestampsRes.data ?? []).forEach((r) => addTimestamp(r.created_at));

  const peakHours = hourlyCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => item.hour);

  // Smart Intelligence data
  const modelAnalytics = (modelDemandRes.data ?? []).map((row: Record<string, unknown>) => ({
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    repair_count: Number(row.repair_count ?? 0),
    sold_count: Number(row.sold_count ?? 0),
    avg_margin: Number(row.avg_margin ?? 0),
    avg_days_to_sell: Number(row.avg_days_to_sell ?? 0),
    demand_score: Number(row.demand_score ?? 0),
  }));

  const stockoutForecast = (stockoutRes.data ?? []).map((row: Record<string, unknown>) => ({
    item_id: String(row.item_id ?? ""),
    item_name: String(row.item_name ?? ""),
    item_type: String(row.item_type ?? ""),
    current_stock: Number(row.current_stock ?? 0),
    avg_daily_demand: Number(row.avg_daily_demand ?? 0),
    days_until_stockout: Number(row.days_until_stockout ?? 999),
    restock_urgency: String(row.restock_urgency ?? "OK"),
    margin_percent: Number(row.margin_percent ?? 0),
  }));

  const revenueHeatmap = (heatmapRes.data ?? []).map((row: Record<string, unknown>) => ({
    dow: Number(row.dow ?? 0),
    hour_of_day: Number(row.hour_of_day ?? 0),
    total_revenue: Number(row.total_revenue ?? 0),
    tx_count: Number(row.tx_count ?? 0),
    avg_check: Number(row.avg_check ?? 0),
  }));

  return {
    salesVelocity,
    peakHours,

    crossSellConversionRate,
    crossSellRevenue30Days,
    crossSellDealsCount,

    partnerVolumeShare,
    partnerRevenueTotal,

    refurbishmentCapital,
    refurbishmentMargin,

    customerReturnRate,
    newCustomers,

    modelAnalytics,
    stockoutForecast,
    revenueHeatmap,
  };
}
