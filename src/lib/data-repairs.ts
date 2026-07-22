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
    .eq("public_token", token)
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

  // `repair_type` used to be stamped onto every row here as the constant
  // "customer". It is not a column and never was, so the UI's «Клієнтські» /
  // «Складські» filters could never match anything, the badge always read
  // "Клієнт", and the kanban's internal-repair branch was unreachable. The
  // query above already scopes this to customer repairs; warehouse ones belong
  // to Техніка.
  return (data ?? []).map(attachCustomerName);
}

export interface RepairPayment {
  id: string;
  amount: number;
  created_at: string;
  description: string | null;
  to_id: string | null;
}

/**
 * The payment ledger for one repair. `repairs.payment_status` is only a cached
 * label over these rows — see `pay_repair` in the migrations.
 */
export async function getRepairPayments(repairId: string): Promise<RepairPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, amount, created_at, description, to_id")
    .eq("reference_type", "repair_payment")
    .eq("reference_id", repairId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error in getRepairPayments:", error);
    return [];
  }
  return data ?? [];
}

/** Paid totals for many repairs at once, so the list can show real balances. */
export async function getRepairPaidTotals(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("reference_id, amount")
    .eq("reference_type", "repair_payment");

  if (error) {
    console.error("Error in getRepairPaidTotals:", error);
    return {};
  }

  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.reference_id) continue;
    totals[row.reference_id] = (totals[row.reference_id] ?? 0) + row.amount;
  }
  return totals;
}
