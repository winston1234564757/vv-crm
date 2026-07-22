import type { Database } from "@/types/database";
import type { StageRepairInput } from "@/lib/device-stage";

type DbDeviceRow = Database["public"]["Tables"]["devices"]["Row"];

/**
 * `repair_parts_replaced` is `jsonb` in the database, so the generated type is
 * `Json`. The shape the app actually writes is narrowed here.
 */
export type DeviceRow = Omit<DbDeviceRow, "repair_parts_replaced"> & {
  repair_parts_replaced: { name: string; cost: number; origin: string }[] | null;
};

/** A device with its `repairs` rows resolved, ready for `deviceStage`. */
export interface DeviceWithRepairs extends DeviceRow {
  repairs: StageRepairInput[];
}

export function totalCostOf(d: Pick<DeviceRow, "cost_price" | "repair_cost">) {
  return d.cost_price + (d.repair_cost || 0);
}

export function profitOf(d: Pick<DeviceRow, "price" | "cost_price" | "repair_cost">) {
  return d.price - totalCostOf(d);
}
