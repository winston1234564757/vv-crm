import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import type { Database } from "@/types/database";

type PartRow = Database["public"]["Tables"]["parts"]["Row"];
type PartWithSupplier = PartRow & {
  suppliers: { name: string } | null;
};

export async function getParts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parts")
    .select("*, suppliers(name)")
    .order("name");
  if (error) throw error;
  
  const parts = supabaseCast<PartWithSupplier[]>(data ?? []);
  return parts.map((p) => ({ ...p, supplier_name: p.suppliers?.name ?? "—" }));
}

export async function getPartsAlerts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parts")
    .select("name, stock, min_stock");
  if (error) throw error;
  return (data ?? []).filter(p => p.stock <= p.min_stock).map(p => ({
    item: p.name, stock: p.stock, urgent: p.stock === 0,
  }));
}

export async function getPartsUsage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_parts")
    .select(`
      *,
      repairs(id, device_name, created_at, status, price, assigned_to, issue)
    `);
  if (error) throw error;
  return data ?? [];
}


