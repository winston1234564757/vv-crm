import { createClient } from "./supabase/server";
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
  
  const parts = (data ?? []) as unknown as PartWithSupplier[];
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

