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

/** Одна позиція замовлення (форма вводу — без id/order_id). */
export interface OrderItemInput {
  item_type: OrderItemType;
  item_name: string;
  item_url: string | null;
  unit_price: number;
  quantity: number;
}

/** Збережена позиція замовлення (`client_order_items`). */
export interface ClientOrderItem extends OrderItemInput {
  id: string;
  order_id: string;
}

export interface ClientOrder {
  id: string;
  order_no: string;
  public_token: string;
  customer_id: string;
  /** Узгоджений ПІДСУМОК за все замовлення. */
  agreed_price: number;
  deposit: number;
  deadline: string | null;
  status: OrderStatus;
  /**
   * Чек, яким замовлення видали. `null` — товар ще не проданий, а аванс висить
   * зобов'язанням перед клієнтом. Заповнює його `process_pos_sale`; він же не
   * дає пробити за одним замовленням другий чек.
   */
  sale_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Рядок замовлення з клієнтом і позиціями (для списку/трекера). */
export interface ClientOrderWithCustomer extends ClientOrder {
  customers: { name: string; phone: string } | null;
  client_order_items: ClientOrderItem[];
}

/** Результат RPC `create_client_order`. */
export interface CreatedClientOrder {
  id: string;
  order_no: string;
  public_token: string;
}
