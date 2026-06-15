// Warehouse part type for type safety
export interface WarehousePart {
  id: string;
  name: string;
  cost_price: number;
  origin_type: string | null;
  stock: number;
}

// Replaced part type for type safety
export interface ReplacedPart {
  name: string;
  cost: number;
  origin: string;
}

// Repair parts data structure type for type safety
export interface RepairPartsData {
  name: string;
  cost: number;
  origin: string;
}

// Device type for form
export interface DeviceFormData {
  id?: string;
  type?: string;
  brand: string | null;
  model: string | null;
  storage: string | null;
  color: string | null;
  imei: string | null;
  battery_health: number | null;
  sku: string | null;
  price: number;
  cost_price: number;
  ram: string | null;
  screen_size: string | null;
  cpu: string | null;
  gpu: string | null;
  needs_repair: boolean;
  repair_node: string | null;
  repair_cost: number;
  repair_np_ttn: string | null;
  repair_status?: string | null;
  repair_parts_replaced?: RepairPartsData[] | null;
  description: string | null;
  is_visible: boolean;
  source?: string | null;
  source_reference?: string | null;
  purchased_from?: string | null;
  condition_grade?: string | null;
  condition_description?: string | null;
  original_box?: boolean | null;
  accessories_included?: string | null;
  serial_number?: string | null;
  warehouse_location?: string | null;
  photo_urls?: string[] | null;
}

// Predefined storage values
export const PREDEFINED_STORAGES = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"] as const;
export type StorageType = typeof PREDEFINED_STORAGES[number] | "custom";