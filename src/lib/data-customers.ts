import { createClient } from "./supabase/server";
import type { Database } from "@/types/database";

type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];

export async function getCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSalesForHistory() {
  const supabase = await createClient();

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("*, sale_items(*)")
    .order("created_at", { ascending: false });

  if (salesError) throw salesError;

  const [devicesRes, accessoriesRes, servicesRes] = await Promise.all([
    supabase.from("devices").select("id, brand, model"),
    supabase.from("accessories").select("id, name"),
    supabase.from("services").select("id, name"),
  ]);

  const deviceMap = new Map((devicesRes.data ?? []).map(d => [d.id, `${d.brand} ${d.model}`]));
  const accMap = new Map((accessoriesRes.data ?? []).map(a => [a.id, a.name]));
  const svcMap = new Map((servicesRes.data ?? []).map(s => [s.id, s.name]));

  const resolvedSales = (sales ?? []).map(s => {
    const items = (s.sale_items ?? []).map((it: SaleItem) => {
      let name = "Послуга / Інше";
      if (it.item_type === "device") {
        name = deviceMap.get(it.item_id) || "Пристрій";
      } else if (it.item_type === "accessory") {
        name = accMap.get(it.item_id) || "Аксесуар";
      } else if (it.item_type === "service") {
        name = svcMap.get(it.item_id) || "Послуга";
      }
      return { ...it, name };
    });
    return { ...s, items };
  });

  return resolvedSales;
}
