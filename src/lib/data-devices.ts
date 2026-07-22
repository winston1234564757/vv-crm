import { createClient } from "./supabase/server";
import type { StageRepairInput } from "./device-stage";

export async function getDevices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error in getDevices:", error);
    return [];
  }
  return data ?? [];
}

export type DeviceRepairMap = Record<string, StageRepairInput[]>;

/**
 * The `repairs` rows attached to inventory devices, grouped by device id.
 *
 * These rows exist but were displayed nowhere: all three read paths in
 * `data-repairs.ts` filter them out with `.is("inventory_device_id", null)`,
 * which is correct — warehouse repairs belong to Техніка, not to the service
 * desk — but nothing on Техніка ever loaded them either.
 *
 * Grouped in JS rather than as a nested select so this does not depend on the
 * foreign key being named a particular way, and so `getDevices` keeps its
 * exact shape for its other callers (repairs page, dashboard, POS).
 */
export async function getDeviceRepairs(): Promise<DeviceRepairMap> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repairs")
    .select("inventory_device_id, status")
    .not("inventory_device_id", "is", null);

  if (error) {
    console.error("Error in getDeviceRepairs:", error);
    return {};
  }

  const map: DeviceRepairMap = {};
  for (const row of data ?? []) {
    const id = row.inventory_device_id;
    if (!id) continue;
    (map[id] ??= []).push({ status: row.status });
  }
  return map;
}

