import { createClient } from "./supabase/server";

export async function getPurchases() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("*, purchase_items(*), suppliers(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

