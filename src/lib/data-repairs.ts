import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

const repairWithCustomer = `*, customers(name)`;
function attachCustomerName<T extends { customers: { name: string } | null }>(r: T) {
  return { ...r, customer_name: r.customers?.name ?? "—" };
}

export async function getRepairs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repairs")
    .select(repairWithCustomer)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(attachCustomerName);
}

export async function getRepairsDashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repairs")
    .select(repairWithCustomer)
    .not("status", "in", `("completed","handed_over","cancelled")`)
    .order("created_at", { ascending: false })
    .limit(4);
  if (error) throw error;
  return (data ?? []).map(attachCustomerName);
}

export async function getRepairByToken(token: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("repairs")
    .select(repairWithCustomer)
    .eq("tracking_token", token)
    .single();
  if (error) return null;
  return attachCustomerName(data);
}
