import { createClient } from "./supabase/server";
import { getSales } from "./data-sales";

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

function getHoursExcludingSundays(start: Date, end: Date): number {
  let hours = 0;
  const current = new Date(start.getTime());
  while (current < end) {
    if (current.getDay() !== 0) {
      hours++;
    }
    current.setHours(current.getHours() + 1);
  }
  return hours;
}

export interface DashboardData {
  ownerStats?: {
    todaySalesTotal: number;
    activeRepairs: number;
    newCustomers: number;
    awaitingParts: number;
    weeklySales: number[];
    weeklyDays: string[];
    recentSales: any[];
    alerts: { item: string; stock: number; urgent: boolean }[];
    totalSales: number;
    cashRegisters: any[];
    safes: any[];
    repairsQueue: any[];
    salesTarget: number;
    salesProgress: number;

    // Advanced Business Intelligence Metrics
    refurbishmentCapital: number;
    refurbishmentMargin: number;
    supplyChainDelayRate: number;
    expressPartsOrderList: Array<{ name: string; quantity: number }>;
    partnerVolumeShare: number;
    partnerRevenueTotal: number;
    opexRunwayDays: number;
    dailyOpexRunRate: number;
    salesVelocity: {
      device: number;
      accessory: number;
      part: number;
      service: number;
    };
    customerReturnRate: number;
    peakHours: number[];

    // Cross-sell analytics
    crossSellConversionRate: number;
    crossSellRevenue30Days: number;
    crossSellDealsCount: number;

    // Smart Revenue Intelligence
    modelAnalytics: Array<{
      brand: string;
      model: string;
      repair_count: number;
      sold_count: number;
      avg_margin: number;
      avg_days_to_sell: number;
      demand_score: number;
    }>;
    stockoutForecast: Array<{
      item_id: string;
      item_name: string;
      item_type: string;
      current_stock: number;
      avg_daily_demand: number;
      days_until_stockout: number;
      restock_urgency: string;
      margin_percent: number;
    }>;
    revenueHeatmap: Array<{
      dow: number;
      hour_of_day: number;
      total_revenue: number;
      tx_count: number;
      avg_check: number;
    }>;
  };
  techStats?: {
    activeRepairs: number;
    awaitingParts: number;
    urgentRepairs: number;
    repairs: any[];
    alerts: { item: string; stock: number; urgent: boolean }[];
    // Tech-specific logistics bottleneck view
    frozenRepairs: Array<{ device_name: string; missing_part: string }>;
  };
  salesStats?: {
    todaySalesTotal: number;
    newCustomers: number;
    totalSales: number;
    recentSales: any[];
    alerts: { item: string; stock: number; urgent: boolean }[];
    // Sales performance insights
    partnerDealsCount: number;
    accessoriesSharePercent: number;
  };
}

export async function getRealtimeDashboardData(role: string, userId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const { start, end } = todayRange();
  const weekAgo = nDaysAgo(7);
  const thirtyDaysAgo = nDaysAgo(30);
  const ninetyDaysAgo = nDaysAgo(90);
  const todayStr = new Date().toISOString().split("T")[0];

  const result: DashboardData = {};

  if (role === "owner" || role === "manager") {
    const [
      todaySalesRes,
      newCustomersRes,
      weeklySalesRes,
      recentSales,
      repairStatusesRes,
      totalSalesRes,
      registersRes,
      safesRes,
      repairsQueueRes,
      accessoriesRes,
      partsRes,

      // Advanced Entity Relations Queries
      activeRefurbRes,
      completedRefurbRes,
      repairsAwaitingPartsRes,
      partnerSalesRes,
      partnerRepairsRes,
      opexExpensesRes,
      saleItems30DaysRes,
      sales90DaysRes,
      repairs90DaysRes,
      salesTimestampsRes,
      repairsTimestampsRes,

      // Smart Intelligence RPCs
      modelDemandRes,
      stockoutRes,
      heatmapRes
    ] = await Promise.all([
      supabase.from("sales").select("total_amount").gte("created_at", start).lt("created_at", end),
      supabase.from("customers").select("id").gte("created_at", start).lt("created_at", end),
      supabase.from("sales").select("total_amount, created_at").gte("created_at", weekAgo),
      getSales(5),
      supabase.from("repairs").select("status"),
      supabase.from("sales").select("total_amount"),
      supabase.from("cash_registers").select("*"),
      supabase.from("safes").select("*"),
      supabase
        .from("repairs")
        .select(`
          *,
          customers(name, phone, telegram_id)
        `)
        .not("status", "in", '("completed","handed_over","cancelled")')
        .order("created_at", { ascending: false }),
      supabase.from("accessories").select("name, stock, min_stock").eq("status", "active"),
      supabase.from("parts").select("name, stock, min_stock"),

      // Refurbishment Capital (Devices currently under restoration)
      supabase.from("devices").select("cost_price, repair_cost").eq("status", "service"),
      // Completed Refurbishments Margin (Added value of completed device restorations)
      supabase.from("devices").select("repair_cost").in("status", ["in_stock", "sold"]).gt("repair_cost", 0).gte("updated_at", thirtyDaysAgo),
      // Supply chain delays (Awaiting parts log)
      supabase
        .from("repairs")
        .select(`
          id, 
          status, 
          created_at, 
          repair_parts(quantity, parts(name, stock)),
          repair_status_log(created_at, to_status)
        `)
        .eq("status", "awaiting_parts"),
      // Partner Sales (B2B channel)
      supabase.from("sales").select("total_amount, partner_id").gte("created_at", thirtyDaysAgo),
      // Partner Repairs (B2B channel)
      supabase.from("repairs").select("price, partner_id").in("status", ["completed", "handed_over"]).gte("created_at", thirtyDaysAgo),
      // OPEX run-rate
      supabase.from("expenses").select("amount").gte("created_at", thirtyDaysAgo),
      // Sales Velocity Matrix
      supabase.from("sale_items").select("item_type, total_price, sales!inner(created_at, id)").gte("sales.created_at", thirtyDaysAgo),
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
      supabase.rpc("get_revenue_heatmap", { days_back: 60 })
    ]);

    const todaySalesTotal = (todaySalesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);
    const activeRepairs = (repairStatusesRes.data ?? []).filter(
      (r) => !["completed", "handed_over", "cancelled"].includes(r.status)
    ).length;
    const newCustomers = newCustomersRes.data?.length ?? 0;
    const awaitingParts = (repairStatusesRes.data ?? []).filter((r) => r.status === "awaiting_parts").length;
    const totalSales = (totalSalesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);

    // Calculate weekly sales chart data
    const dayTotals: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      dayTotals[d.toISOString().split("T")[0]] = 0;
    }
    for (const s of weeklySalesRes.data ?? []) {
      const day = (s.created_at as string).split("T")[0];
      if (day in dayTotals) dayTotals[day] += (s.total_amount as number);
    }

    // Combine stock alerts
    const alerts: { item: string; stock: number; urgent: boolean }[] = [];
    (accessoriesRes.data ?? []).forEach((a) => {
      if (a.stock <= a.min_stock) {
        alerts.push({ item: `Акс: ${a.name}`, stock: a.stock, urgent: a.stock === 0 });
      }
    });
    (partsRes.data ?? []).forEach((p) => {
      if (p.stock <= p.min_stock) {
        alerts.push({ item: `Запч: ${p.name}`, stock: p.stock, urgent: p.stock === 0 });
      }
    });

    const repairsQueue = (repairsQueueRes.data ?? []).map((r) => {
      const isInternal = !!r.inventory_device_id;
      const cust = r.customers as { name: string; phone: string; telegram_id: string | null } | null;
      return {
        ...r,
        customer_name: isInternal ? "Внутрішній (Склад)" : cust?.name ?? "—",
        customer_phone: isInternal ? "—" : cust?.phone ?? "",
        customer_telegram: isInternal ? null : cust?.telegram_id ?? null,
      };
    });

    const salesTarget = 15000;
    const salesProgress = Math.min(Math.round((todaySalesTotal / salesTarget) * 100), 100);

    // Calculate advanced BI analytics
    const refurbishmentCapital = (activeRefurbRes.data ?? []).reduce((sum, d) => sum + d.cost_price + d.repair_cost, 0);
    const refurbishmentMargin = (completedRefurbRes.data ?? []).reduce((sum, d) => sum + d.repair_cost, 0);

    const now = new Date();
    const delayedRepairs = (repairsAwaitingPartsRes.data ?? []).filter((r: any) => {
      const logs = (r.repair_status_log as any[]) ?? [];
      const awaitingLogs = logs.filter((log) => log.to_status === "awaiting_parts");
      
      let startStr = r.created_at;
      if (awaitingLogs.length > 0) {
        const latestLog = awaitingLogs.reduce((latest, current) => {
          return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
        });
        startStr = latestLog.created_at;
      }
      
      const hours = getHoursExcludingSundays(new Date(startStr), now);
      return hours > 36;
    });

    const supplyChainDelayCount = delayedRepairs.length;
    const supplyChainDelayRate = activeRepairs > 0 ? Math.round((supplyChainDelayCount / activeRepairs) * 100) : 0;

    const missingPartsMap = new Map<string, number>();
    (repairsAwaitingPartsRes.data ?? []).forEach((r: any) => {
      const rpList = (r.repair_parts as any[]) ?? [];
      rpList.forEach((rp) => {
        const part = rp.parts as { name: string; stock: number } | null;
        if (part && part.stock === 0) {
          missingPartsMap.set(part.name, (missingPartsMap.get(part.name) || 0) + (rp.quantity || 1));
        }
      });
    });

    const expressPartsOrderList = Array.from(missingPartsMap.entries()).map(([name, quantity]) => ({
      name,
      quantity,
    })).slice(0, 5);

    const partnerSalesTotal = (partnerSalesRes.data ?? [])
      .filter((s) => s.partner_id !== null)
      .reduce((sum, s) => sum + s.total_amount, 0);
    const partnerRepairsTotal = (partnerRepairsRes.data ?? [])
      .filter((r) => r.partner_id !== null)
      .reduce((sum, r) => sum + r.price, 0);
    const partnerRevenueTotal = partnerSalesTotal + partnerRepairsTotal;

    const totalSales30Days = (partnerSalesRes.data ?? []).reduce((sum, s) => sum + s.total_amount, 0);
    const totalRepairs30Days = (partnerRepairsRes.data ?? []).reduce((sum, r) => sum + r.price, 0);
    const totalRevenue30Days = totalSales30Days + totalRepairs30Days;
    const partnerVolumeShare = totalRevenue30Days > 0 ? Math.round((partnerRevenueTotal / totalRevenue30Days) * 100) : 0;

    const regularOpexExpenses = (opexExpensesRes.data ?? []).filter((e) => e.amount < 50000);
    const regularOpexTotal = regularOpexExpenses.reduce((sum, e) => sum + e.amount, 0);
    const dailyOpexRunRate = Math.max(Math.round(regularOpexTotal / 30), 500);

    const opexSafe = (safesRes.data ?? []).find((s) => s.type === "opex");
    const opexSafeBalance = opexSafe?.balance ?? 0;
    const opexRunwayDays = Math.round(opexSafeBalance / dailyOpexRunRate);

    const salesVelocity = { device: 0, accessory: 0, part: 0, service: 0 };
    (saleItems30DaysRes.data ?? []).forEach((item: any) => {
      if (item.item_type in salesVelocity) {
        salesVelocity[item.item_type as keyof typeof salesVelocity] += item.total_price;
      }
    });

    // Calculate cross-sell metrics
    const saleGroups = new Map<string, Array<{ item_type: string; total_price: number }>>();
    (saleItems30DaysRes.data ?? []).forEach((item: any) => {
      const saleId = item.sales?.id;
      if (saleId) {
        if (!saleGroups.has(saleId)) saleGroups.set(saleId, []);
        saleGroups.get(saleId)!.push({
          item_type: item.item_type,
          total_price: item.total_price
        });
      }
    });

    let totalCoreSales = 0; // sales containing device or service
    let crossSalesCount = 0; // sales containing (device/service) AND accessory
    let crossSellRevenue30Days = 0; // total revenue of accessories in cross-sales

    saleGroups.forEach((items) => {
      const hasDeviceOrService = items.some(i => i.item_type === "device" || i.item_type === "service");
      const hasAccessory = items.some(i => i.item_type === "accessory");

      if (hasDeviceOrService) {
        totalCoreSales++;
        if (hasAccessory) {
          crossSalesCount++;
          items.forEach(i => {
            if (i.item_type === "accessory") {
              crossSellRevenue30Days += i.total_price;
            }
          });
        }
      }
    });

    const crossSellConversionRate = totalCoreSales > 0 ? Math.round((crossSalesCount / totalCoreSales) * 100) : 0;
    const crossSellDealsCount = crossSalesCount;

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

    result.ownerStats = {
      todaySalesTotal,
      activeRepairs,
      newCustomers,
      awaitingParts,
      weeklySales: Object.values(dayTotals),
      weeklyDays: Object.keys(dayTotals).map((d) => {
        const date = new Date(d + "T12:00:00");
        return date.toLocaleDateString("uk-UA", { weekday: "short" });
      }),
      recentSales: recentSales ?? [],
      alerts: alerts.slice(0, 5),
      totalSales,
      cashRegisters: registersRes.data ?? [],
      safes: safesRes.data ?? [],
      repairsQueue,
      salesTarget,
      salesProgress,

      refurbishmentCapital,
      refurbishmentMargin,
      supplyChainDelayRate,
      expressPartsOrderList,
      partnerVolumeShare,
      partnerRevenueTotal,
      opexRunwayDays,
      dailyOpexRunRate,
      salesVelocity,
      customerReturnRate,
      peakHours,

      crossSellConversionRate,
      crossSellRevenue30Days,
      crossSellDealsCount,

      modelAnalytics,
      stockoutForecast,
      revenueHeatmap,
    };
  } else if (role === "technician") {
    const [myRepairsRes, allPartsRes, frozenRepairsRes] = await Promise.all([
      supabase
        .from("repairs")
        .select(`
          *,
          customers(name, phone, telegram_id),
          devices(brand, model, imei, status)
        `)
        .eq("assigned_to", userId)
        .not("status", "in", '("completed","handed_over","cancelled")')
        .order("created_at", { ascending: false }),
      supabase.from("parts").select("name, stock, min_stock"),
      supabase
        .from("repairs")
        .select(`
          device_name,
          repair_parts(parts(name, stock))
        `)
        .eq("assigned_to", userId)
        .eq("status", "awaiting_parts")
    ]);

    const resolvedRepairs = (myRepairsRes.data ?? []).map((r) => {
      const isInternal = !!r.inventory_device_id;
      const cust = r.customers as { name: string; phone: string; telegram_id: string | null } | null;
      const dev = r.devices as { brand: string | null; model: string | null; imei: string | null; status: string } | null;

      return {
        ...r,
        customer_name: isInternal ? "Внутрішній (Склад)" : cust?.name ?? "—",
        customer_phone: isInternal ? "—" : cust?.phone ?? "",
        customer_telegram: isInternal ? null : cust?.telegram_id ?? null,
        device_name: isInternal && dev
          ? `${dev.brand || ""} ${dev.model || ""}`.trim() || r.device_name
          : r.device_name,
      };
    });

    const activeRepairs = resolvedRepairs.length;
    const awaitingParts = resolvedRepairs.filter((r) => r.status === "awaiting_parts").length;
    const urgentRepairs = resolvedRepairs.filter((r) => {
      if (!r.estimated_completion) return false;
      return r.estimated_completion <= todayStr;
    }).length;

    const alerts = (allPartsRes.data ?? [])
      .filter((p) => p.stock <= p.min_stock)
      .map((p) => ({
        item: p.name,
        stock: p.stock,
        urgent: p.stock === 0,
      }));

    const frozenRepairs: Array<{ device_name: string; missing_part: string }> = [];
    (frozenRepairsRes.data ?? []).forEach((r: any) => {
      const rpList = (r.repair_parts as any[]) ?? [];
      rpList.forEach((rp) => {
        const part = rp.parts as { name: string; stock: number } | null;
        if (part && part.stock === 0) {
          frozenRepairs.push({
            device_name: r.device_name,
            missing_part: part.name,
          });
        }
      });
    });

    result.techStats = {
      activeRepairs,
      awaitingParts,
      urgentRepairs,
      repairs: resolvedRepairs,
      alerts: alerts.slice(0, 5),
      frozenRepairs: frozenRepairs.slice(0, 5),
    };
  } else {
    // sales role
    const [
      todaySalesRes,
      newCustomersRes,
      recentSalesRes,
      totalSalesRes,
      allAccRes,
      partnerDealsRes,
      allItemsShareRes
    ] = await Promise.all([
      supabase.from("sales").select("total_amount").eq("created_by", userId).gte("created_at", start).lt("created_at", end),
      supabase.from("customers").select("id").gte("created_at", start).lt("created_at", end),
      supabase
        .from("sales")
        .select(`
          id, total_amount, discount, notes, created_at, customer_id,
          customers(name, phone, telegram_id),
          sale_items(id, item_type, item_id, quantity, unit_price, total_price)
        `)
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("sales").select("total_amount").eq("created_by", userId),
      supabase.from("accessories").select("name, stock, min_stock").eq("status", "active"),
      // Sales deals generated via partner referral
      supabase.from("sales").select("id").eq("created_by", userId).not("partner_id", "is", null).gte("created_at", thirtyDaysAgo),
      // All items sold by this representative for accessories share calculations
      supabase.from("sale_items").select("item_type, total_price, sales!inner(created_by)").eq("sales.created_by", userId).gte("sales.created_at", thirtyDaysAgo)
    ]);

    const todaySalesTotal = (todaySalesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);
    const newCustomers = newCustomersRes.data?.length ?? 0;
    const totalSales = (totalSalesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);

    const alerts = (allAccRes.data ?? [])
      .filter((a) => a.stock <= a.min_stock)
      .map((a) => ({
        item: a.name,
        stock: a.stock,
        urgent: a.stock === 0,
      }));

    const resolvedSales = (recentSalesRes.data ?? []).map((s) => {
      const cust = s.customers as { name: string; phone: string; telegram_id: string | null } | null;
      const items = (s.sale_items as any[] ?? []).map((item) => ({
        ...item,
        name: item.item_type === "device" ? "Пристрій" : "Аксесуар",
      }));
      return {
        ...s,
        customer_name: cust?.name ?? "Роздрібний покупець",
        customer_phone: cust?.phone ?? "",
        customer_telegram: cust?.telegram_id ?? null,
        items,
      };
    });

    const partnerDealsCount = partnerDealsRes.data?.length ?? 0;
    const totalSalesItemsCost = (allItemsShareRes.data ?? []).reduce((sum, item) => sum + item.total_price, 0);
    const accessoriesSalesCost = (allItemsShareRes.data ?? [])
      .filter((item) => item.item_type === "accessory")
      .reduce((sum, item) => sum + item.total_price, 0);
    const accessoriesSharePercent = totalSalesItemsCost > 0 ? Math.round((accessoriesSalesCost / totalSalesItemsCost) * 100) : 0;

    result.salesStats = {
      todaySalesTotal,
      newCustomers,
      totalSales,
      recentSales: resolvedSales,
      alerts: alerts.slice(0, 5),
      partnerDealsCount,
      accessoriesSharePercent,
    };
  }

  return result;
}

