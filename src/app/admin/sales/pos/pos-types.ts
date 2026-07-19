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
export interface Device { id: string; brand: string | null; model: string | null; imei: string | null; price: number; cost_price: number; status: string; warranty_months?: number; photo_urls?: string[] | null; }
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
  }>;
  total_amount: number;
  discount: number;
  register_name: string;
}
