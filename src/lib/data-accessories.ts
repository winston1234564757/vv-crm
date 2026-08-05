import { createClient } from "./supabase/server";

export async function getAccessories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accessories")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/**
 * Список аксесуарів для закупівлі:
 * - stock < min_stock (включаючи 0)
 * - АБО вже позначені як замовлені (purchase_ordered_at IS NOT NULL) і stock все ще нижче мінімуму
 *
 * Логіка: якщо товар вже замовлено, він лишається у списку щоб нагадати,
 * але позначений як "в замовленні". Після реального поповнення stock >= min_stock
 * — він сам зникає зі списку.
 */
export async function getPurchaseList() {
  const supabase = await createClient();
  
  // Простіший підхід: отримати всі де stock < min_stock через RPC або raw filter
  const { data: purchaseItems, error: purchaseError } = await supabase
    .from("accessories")
    .select("id, name, type, stock, min_stock, supplier_sku, purchase_ordered_at, cost_price, price")
    .order("purchase_ordered_at", { ascending: true, nullsFirst: true })
    .order("name");

  if (purchaseError) throw purchaseError;

  // Клієнтська фільтрація (дані вже в пам'яті — accessories це не мільйони рядків)
  return (purchaseItems ?? []).filter(a => a.stock < a.min_stock);
}
