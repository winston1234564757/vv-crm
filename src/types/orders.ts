/**
 * Клієнтські замовлення "під клієнта".
 *
 * `client_orders` навмисно не входить у згенерований `database.ts` (той файл
 * лишається як є — регенерація зламала б наявні `@ts-expect-error` на RPC).
 * Тому форму рядка тримаємо тут, а доступ до таблиці робимо через локальні
 * касти — той самий прагматичний підхід, що й для RPC у `actions/sales.ts`.
 */

export type OrderItemType = "device" | "accessory" | "part" | "service";

export type OrderStatus =
  | "new"
  | "ordered"
  | "arrived"
  | "ready"
  | "completed"
  | "cancelled";

export interface ClientOrder {
  id: string;
  order_no: string;
  public_token: string;
  customer_id: string;
  item_type: OrderItemType;
  item_name: string;
  item_url: string | null;
  agreed_price: number;
  deposit: number;
  deadline: string | null;
  status: OrderStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Рядок замовлення разом із приєднаним клієнтом (для списку/трекера). */
export interface ClientOrderWithCustomer extends ClientOrder {
  customers: { name: string; phone: string } | null;
}

/** Результат RPC `create_client_order`. */
export interface CreatedClientOrder {
  id: string;
  order_no: string;
  public_token: string;
}
