import { createClient } from "./supabase/server";
import { supabaseCast } from "./utils/supabase";

export interface SaleWithDetails {
  id: string;
  customer_id: string | null;
  total_amount: number;
  discount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  sale_type: string | null;
  delivery_needed: boolean | null;
  delivery_address: string | null;
  delivery_tracking: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  return_reason: string | null;
  monobank_payment_id: string | null;
  partner_id: string | null;
  promo_code_used: string | null;
  customer_name: string;
  customer_phone: string;
  seller_name: string;
  items: Array<{
    id: string;
    sale_id: string;
    item_type: "device" | "accessory" | "part" | "service";
    item_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    name: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: "cash" | "card" | "transfer";
    cash_register_id: string;
    register_name: string;
  }>;
}

interface DbSaleItem {
  id: string;
  sale_id: string;
  item_type: "device" | "accessory" | "part" | "service";
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface DbPaymentSplit {
  id: string;
  amount: number;
  method: "cash" | "card" | "transfer";
  cash_register_id: string;
  cash_registers?: { name: string } | null;
}

interface DbSaleRow {
  id: string;
  customer_id: string | null;
  total_amount: number;
  discount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  sale_type: string | null;
  delivery_needed: boolean | null;
  delivery_address: string | null;
  delivery_tracking: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  return_reason: string | null;
  monobank_payment_id: string | null;
  partner_id: string | null;
  promo_code_used: string | null;
  customers: { name: string; phone: string } | null;
  profiles: { full_name: string | null; role: string | null } | null;
  sale_items: DbSaleItem[] | null;
  payment_splits: DbPaymentSplit[] | null;
}

export async function getSales(limit?: number): Promise<SaleWithDetails[]> {
  const supabase = await createClient();

  // 1. Fetch sales, customers, and seller profile
  let query = supabase
    .from("sales")
    .select(`
      *,
      customers(name, phone),
      profiles:created_by(full_name, role),
      sale_items(*),
      payment_splits(*, cash_registers(name))
    `)
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data: salesData, error: salesError } = await query;

  if (salesError) throw salesError;
  if (!salesData) return [];

  const typedSalesData = supabaseCast<DbSaleRow[]>(salesData);

  // 2. Gather all catalog item IDs to fetch names in bulk
  const deviceIds: string[] = [];
  const accessoryIds: string[] = [];
  const partIds: string[] = [];
  const serviceIds: string[] = [];

  typedSalesData.forEach((sale) => {
    (sale.sale_items || []).forEach((item) => {
      if (item.item_type === "device") {
        deviceIds.push(item.item_id);
      } else if (item.item_type === "accessory") {
        accessoryIds.push(item.item_id);
      } else if (item.item_type === "part") {
        partIds.push(item.item_id);
      } else if (item.item_type === "service") {
        serviceIds.push(item.item_id);
      }
    });
  });

  // Fetch names in parallel
  const [devicesRes, accessoriesRes, partsRes, servicesRes] = await Promise.all([
    deviceIds.length > 0
      ? supabase.from("devices").select("id, brand, model").in("id", deviceIds)
      : Promise.resolve({ data: [] }),
    accessoryIds.length > 0
      ? supabase.from("accessories").select("id, name").in("id", accessoryIds)
      : Promise.resolve({ data: [] }),
    partIds.length > 0
      ? supabase.from("parts").select("id, name").in("id", partIds)
      : Promise.resolve({ data: [] }),
    serviceIds.length > 0
      ? supabase.from("services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [] })
  ]);

  const deviceMap = new Map<string, string>(
    ((devicesRes.data as Array<{ id: string; brand: string | null; model: string | null }>) || []).map((d) => [
      d.id,
      `${d.brand || ""} ${d.model || ""}`.trim() || "Пристрій"
    ])
  );

  const accessoryMap = new Map<string, string>(
    ((accessoriesRes.data as Array<{ id: string; name: string | null }>) || []).map((a) => [a.id, a.name || "Аксесуар"])
  );

  const partMap = new Map<string, string>(
    ((partsRes.data as Array<{ id: string; name: string | null }>) || []).map((p) => [p.id, p.name || "Запчастина"])
  );

  const serviceMap = new Map<string, string>(
    ((servicesRes.data as Array<{ id: string; name: string | null }>) || []).map((s) => [s.id, s.name || "Послуга"])
  );

  // 3. Map the polymorphic names to items and construct full data structure
  return typedSalesData.map((sale) => {
    const items = (sale.sale_items || []).map((item) => {
      let name = "Невідомий товар";
      if (item.item_type === "device") {
        name = deviceMap.get(item.item_id) || "Пристрій (видалено)";
      } else if (item.item_type === "accessory") {
        name = accessoryMap.get(item.item_id) || "Аксесуар (видалено)";
      } else if (item.item_type === "part") {
        name = partMap.get(item.item_id) || "Запчастина (видалено)";
      } else if (item.item_type === "service") {
        name = serviceMap.get(item.item_id) || "Послуга (видалено)";
      }
      return { ...item, name };
    });

    const payments = (sale.payment_splits || []).map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      cash_register_id: p.cash_register_id,
      register_name: p.cash_registers?.name || "Каса"
    }));

    return {
      id: sale.id,
      customer_id: sale.customer_id,
      total_amount: sale.total_amount,
      discount: sale.discount,
      notes: sale.notes,
      created_by: sale.created_by,
      created_at: sale.created_at,
      sale_type: sale.sale_type,
      delivery_needed: sale.delivery_needed,
      delivery_address: sale.delivery_address,
      delivery_tracking: sale.delivery_tracking,
      warranty_start: sale.warranty_start,
      warranty_end: sale.warranty_end,
      return_reason: sale.return_reason,
      monobank_payment_id: sale.monobank_payment_id,
      partner_id: sale.partner_id,
      promo_code_used: sale.promo_code_used,
      customer_name: sale.customers?.name ?? "Роздрібний покупець",
      customer_phone: sale.customers?.phone ?? "",
      seller_name: sale.profiles?.full_name ?? "Система",
      items,
      payments
    };
  });
}

export async function getSalesStats() {
  const supabase = await createClient();
  
  // Get all sales total_amount
  const { data, error } = await supabase
    .from("sales")
    .select("total_amount");

  if (error) throw error;

  const totalSales = data?.length ?? 0;
  const totalRevenue = data?.reduce((sum, s) => sum + s.total_amount, 0) ?? 0;
  const averageCheck = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;

  return {
    totalSales,
    totalRevenue,
    averageCheck
  };
}
