import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

const repairWithCustomer = `*, customers(name, phone, telegram_id)`;
function attachCustomerName<T extends { customers: { name: string; phone: string; telegram_id: string | null } | null }>(r: T) {
  return { 
    ...r, 
    customer_name: r.customers?.name ?? "—",
    customer_phone: r.customers?.phone ?? "",
    customer_telegram: r.customers?.telegram_id ?? null
  };
}

export async function getRepairs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repairs")
    .select(repairWithCustomer)
    .is("inventory_device_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(attachCustomerName);
}

export async function getRepairsDashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repairs")
    .select(repairWithCustomer)
    .is("inventory_device_id", null)
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

export async function getRepairStatusLogs(repairId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_status_log")
    .select(`
      *,
      profiles(full_name, role)
    `)
    .eq("repair_id", repairId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAllRepairs() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("repairs")
    .select(`*, customers(name, phone, telegram_id)`)
    .is("inventory_device_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase Error in getAllRepairs:", error);
    return [];
  }

  return (data ?? []).map((r) => {
    const cust = r.customers as { name: string; phone: string; telegram_id: string | null } | null;

    return {
      ...r,
      repair_type: "customer",
      customer_name: cust?.name ?? "—",
      customer_phone: cust?.phone ?? "",
      customer_telegram: cust?.telegram_id ?? null,
      device_name: r.device_name,
    } as typeof r & { repair_type: "customer" };
  });
}
