export interface Customer {
  id: string;
  name: string;
  phone: string;
  discount_percent: number;
}
export interface CashRegister {
  id: string;
  name: string;
}
// `repair_cost` тут не косметика: собівартість девайса — це закупівля плюс
// вкладений ремонт, і без цього поля кошик пише в `sale_items.unit_cost`
// занижену цифру. Див. `usePOSCart.ts` і `profit.ts:itemCost`.
export interface Device { id: string; brand: string | null; model: string | null; imei: string | null; price: number; cost_price: number; repair_cost: number; status: string; warranty_months?: number; photo_urls?: string[] | null; }
export interface Accessory { id: string; name: string; type?: string; sku: string | null; price: number; cost_price: number; stock: number; status: string; warranty_months?: number; photo_urls?: string[] | null; }
export interface Part { id: string; name: string; sku?: string | null; price: number | null; cost_price: number; stock: number; status?: string; photo_urls?: string[] | null; }
export interface Service { id: string; name: string; price: number; status: string; warranty_days?: number | null; photo_urls?: string[] | null; }

export type CatalogItem = Device | Accessory | Part | Service;

export interface CartItem {
  id: string;
  name: string;
  item_type: "device" | "accessory" | "part" | "service";
  unit_price: number;
  unit_cost: number;
  quantity: number;
  maxStock?: number;
  imei?: string | null;
  sku?: string | null;
}

export interface LastSaleData {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  seller_name: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    /** Категорія позиції — від неї залежать гарантійні умови в чеку. */
    item_type: CartItem["item_type"];
  }>;
  total_amount: number;
  discount: number;
  /** Аванс замовлення, зарахований у чек. Чек друкує доплату, а не всю суму. */
  deposit?: number;
  /** Номер замовлення, яке видали цим чеком. */
  order_no?: string;
  register_name: string;
  /** Дата кінця гарантії `YYYY-MM-DD`, або null якщо без гарантії. */
  warranty_end: string | null;
}
