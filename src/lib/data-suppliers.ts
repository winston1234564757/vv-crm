import { createClient } from "./supabase/server";

export async function getSuppliers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getSupplierParts(supplierId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parts")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

