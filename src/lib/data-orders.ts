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
    .select("*, customers(name, phone), client_order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error in getClientOrders:", error);
    return [];
  }
  return (data ?? []) as ClientOrderWithCustomer[];
}

/**
 * Одне замовлення для видачі через касу (`/admin/sales/pos?order=…`).
 *
 * Повертає `null` і для неіснуючого, і для вже проданого чи скасованого: касі
 * потрібне лише те замовлення, за яким ще можна пробити чек. Право не пробити
 * другий чек лишається за `process_pos_sale` — ця перевірка тут для того, щоб
 * каса не відкривалась із порожньою обіцянкою.
 */
export async function getOrderForCheckout(id: string): Promise<ClientOrderWithCustomer | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("client_orders")
    .select("*, customers(name, phone), client_order_items(*)")
    .eq("id", id)
    .is("sale_id", null)
    .neq("status", "cancelled")
    .maybeSingle();

  if (error) {
    console.error("Error in getOrderForCheckout:", error);
    return null;
  }
  return (data as ClientOrderWithCustomer | null) ?? null;
}
