import { createClient } from "./supabase/server";
import type { AttentionRepair, AttentionStockItem } from "./attention";

/**
 * Read-side for the attention block. `findAttention` (lib/attention.ts) does
 * the deciding; this module only fetches and shapes rows for it.
 *
 * `repair_status_log` is joined per repair and reduced to `last_log_at` here,
 * in JS — the log only records transitions, so a repair nobody has touched
 * has zero rows in it, and that absence is exactly what the "no movement"
 * check needs to see as `null`, not as a missing join.
 */
export async function getAttentionData(): Promise<{
  repairs: AttentionRepair[];
  stock: AttentionStockItem[];
}> {
  const supabase = await createClient();

  const [repairsRes, accessoriesRes, partsRes] = await Promise.all([
    supabase
      .from("repairs")
      .select(
        "id, device_name, status, created_at, inventory_device_id, payment_status, repair_status_log(created_at)",
      ),
    supabase.from("accessories").select("id, name, stock, min_stock").eq("status", "active"),
    supabase.from("parts").select("id, name, stock, min_stock"),
  ]);

  const repairs: AttentionRepair[] = (repairsRes.data ?? []).map((r) => {
    const logs = (r.repair_status_log ?? []) as { created_at: string }[];
    const last_log_at = logs.reduce<string | null>((max, log) => {
      if (!max || log.created_at > max) return log.created_at;
      return max;
    }, null);

    return {
      id: r.id,
      device_name: r.device_name,
      status: r.status,
      created_at: r.created_at,
      inventory_device_id: r.inventory_device_id,
      payment_status: r.payment_status,
      last_log_at,
    };
  });

  const stock: AttentionStockItem[] = [
    ...(accessoriesRes.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      stock: a.stock,
      min_stock: a.min_stock,
      kind: "accessory" as const,
    })),
    ...(partsRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      min_stock: p.min_stock,
      kind: "part" as const,
    })),
  ];

  return { repairs, stock };
}
