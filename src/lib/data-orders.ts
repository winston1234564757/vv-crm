import { createClient } from "./supabase/server";
import type { ClientOrderWithCustomer } from "@/types/orders";

/**
 * Усі клієнтські замовлення з приєднаним клієнтом, найновіші зверху.
 * `client_orders` не в згенерованих типах — локальний каст (див. types/orders.ts).
 */
export async function getClientOrders(): Promise<ClientOrderWithCustomer[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("client_orders")
    .select("*, customers(name, phone)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error in getClientOrders:", error);
    return [];
  }
  return (data ?? []) as ClientOrderWithCustomer[];
}
