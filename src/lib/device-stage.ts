import type { BadgeTone } from "@/components/ui/Badge";

/**
 * The refurbishment pipeline, derived.
 *
 * "This device is being repaired" is stored two independent ways in this
 * database and the two disagree:
 *
 *   inline    devices.needs_repair / repair_status / repair_cost / repair_node
 *   relational  rows in `repairs` carrying inventory_device_id
 *
 * The UI only ever read the inline one, so 13 repair rows accumulated with no
 * screen at all, and `devices.repair_status` grew a third status vocabulary
 * (pending / waiting_parts / in_progress / completed / handed_over) that does
 * not match `repairs.status`.
 *
 * This module is the single place the two are reconciled. It does not fix the
 * data — merging the models is a migration over money records on production
 * and is deliberately out of scope. It derives one stage to organise the page
 * by, and reports every contradiction it had to paper over so the owner can
 * see them instead of the app quietly picking a winner.
 */

export type DeviceStage =
  | "transit"
  | "needs_repair"
  | "in_repair"
  | "in_stock"
  | "archived";

export const STAGE_ORDER: DeviceStage[] = [
  "transit",
  "needs_repair",
  "in_repair",
  "in_stock",
  "archived",
];

export const stageLabels: Record<DeviceStage, string> = {
  transit: "В дорозі",
  needs_repair: "Потребує ремонту",
  in_repair: "У ремонті",
  in_stock: "В наявності",
  archived: "Архів",
};

export const stageTones: Record<DeviceStage, BadgeTone> = {
  transit: "info",
  needs_repair: "warning",
  in_repair: "accent",
  in_stock: "success",
  archived: "neutral",
};

/** Repair-row statuses that mean the work is finished, one way or another. */
const CLOSED_REPAIR_STATUSES = new Set(["completed", "handed_over", "cancelled"]);

/** `devices.repair_status` values that mean work is under way. */
const ACTIVE_INLINE_REPAIR = new Set(["in_progress", "waiting_parts"]);

/** `devices.repair_status` values that mean the inline model considers it done. */
const DONE_INLINE_REPAIR = new Set(["completed", "handed_over"]);

export type DiscrepancyCode =
  | "sold_with_open_repair"
  | "in_stock_with_open_repair"
  | "repair_not_recorded"
  | "models_disagree";

export interface Discrepancy {
  code: DiscrepancyCode;
  label: string;
  /** What the owner should understand from it, in one line. */
  detail: string;
}

/** The device fields this module needs. Keeps it testable without the full row. */
export interface StageDeviceInput {
  status: string;
  needs_repair?: boolean | null;
  repair_status?: string | null;
}

/** The repair fields this module needs. */
export interface StageRepairInput {
  status: string;
}

export interface StageResult {
  stage: DeviceStage;
  discrepancies: Discrepancy[];
}

/**
 * @param device the device row
 * @param repairs the `repairs` rows whose inventory_device_id is this device
 */
export function deviceStage(
  device: StageDeviceInput,
  repairs: StageRepairInput[] = [],
): StageResult {
  const openRepairs = repairs.filter((r) => !CLOSED_REPAIR_STATUSES.has(r.status));
  const hasOpenRepair = openRepairs.length > 0;
  const hasAnyRepairRow = repairs.length > 0;

  const inlineActive = ACTIVE_INLINE_REPAIR.has(device.repair_status ?? "");
  const inlineDone = DONE_INLINE_REPAIR.has(device.repair_status ?? "");
  const needsRepair = device.needs_repair === true;

  const discrepancies: Discrepancy[] = [];

  // --- stage, in priority order -------------------------------------------
  // `status` wins for transit and archived because it is the ground truth of
  // where the device physically and commercially is. A repair still being open
  // does not un-sell it — it makes it a problem, which is what the
  // discrepancies below are for.
  let stage: DeviceStage;

  if (device.status === "transit") {
    stage = "transit";
  } else if (
    device.status === "sold" ||
    device.status === "returned" ||
    device.status === "archived"
  ) {
    stage = "archived";
  } else if (hasOpenRepair || inlineActive) {
    stage = "in_repair";
  } else if (needsRepair && !inlineDone) {
    // Flagged for repair and nothing says it was finished. This is the bucket
    // that had no screen at all: six devices sit here today.
    stage = "needs_repair";
  } else {
    stage = "in_stock";
  }

  // --- discrepancies -------------------------------------------------------
  if (device.status === "sold" && hasOpenRepair) {
    discrepancies.push({
      code: "sold_with_open_repair",
      label: "Продано з відкритим ремонтом",
      detail: "Апарат продано, але ремонт по ньому ще не закрито.",
    });
  }

  if (device.status === "in_stock" && hasOpenRepair) {
    discrepancies.push({
      code: "in_stock_with_open_repair",
      label: "У продажу з відкритим ремонтом",
      detail: "Апарат доступний до продажу, хоча ремонт по ньому відкритий.",
    });
  }

  if (needsRepair && !hasAnyRepairRow) {
    discrepancies.push({
      code: "repair_not_recorded",
      label: "Ремонт не оформлено",
      detail: "Позначено як такий, що потребує ремонту, але заявки не створено.",
    });
  }

  if (inlineDone && hasOpenRepair) {
    discrepancies.push({
      code: "models_disagree",
      label: "Статуси розходяться",
      detail: "У картці пристрою ремонт завершено, а заявка досі відкрита.",
    });
  }

  return { stage, discrepancies };
}
