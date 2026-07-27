import type { BadgeTone } from "@/components/ui/Badge";

/**
 * The repair workflow, as data.
 *
 * The old kanban encoded the one genuinely good idea on that screen — a single
 * button that advances a repair to its next step, instead of a dropdown of all
 * eight statuses. The board itself hid every terminal status, so with the two
 * repairs the shop actually has (both terminal) it rendered five empty columns
 * and nothing else. The board is gone; this keeps the part that was working.
 */

/**
 * `completed` тут немає навмисно. Він означав те саме, що `ready`, і через це
 * кожен модуль читав його по-своєму — від «ще чекає видачі» до «вже видано».
 * Робота або триває, або пристрій готовий і чекає клієнта, або клієнт забрав.
 */
export type RepairStatus =
  | "received"
  | "diagnostics"
  | "in_progress"
  | "awaiting_parts"
  | "ready"
  | "handed_over"
  | "cancelled";

/**
 * Lifecycle groups, used as page segments. Сім статусів — це забагато для
 * сегментів; точний статус лишається фільтром.
 */
export type RepairGroup = "active" | "ready" | "done" | "cancelled";

export const REPAIR_GROUP_ORDER: RepairGroup[] = ["active", "ready", "done", "cancelled"];

export const repairGroupLabels: Record<RepairGroup, string> = {
  active: "В роботі",
  ready: "Готові",
  done: "Завершені",
  cancelled: "Скасовані",
};

export const repairGroupTones: Record<RepairGroup, BadgeTone> = {
  active: "accent",
  ready: "success",
  done: "neutral",
  cancelled: "danger",
};

const GROUP_OF: Record<RepairStatus, RepairGroup> = {
  received: "active",
  diagnostics: "active",
  in_progress: "active",
  awaiting_parts: "active",
  ready: "ready",
  handed_over: "done",
  cancelled: "cancelled",
};

/**
 * Архівний `completed` рахується завершеним, а не активним. Живих рядків із ним
 * не лишилось, але дефолт «active» затягнув би будь-який недомігрований рядок
 * назад у роботу — а він давно закритий.
 */
export function repairGroup(status: string): RepairGroup {
  if (status === "completed") return "done";
  return GROUP_OF[status as RepairStatus] ?? "active";
}

/** A repair nobody is working on any more and has been handed over or cancelled. */
export function isTerminal(status: string): boolean {
  const g = repairGroup(status);
  return g === "done" || g === "cancelled";
}

/**
 * Статуси, у яких ремонт вважається заробленим — гроші за нього рахуються.
 *
 * Живе тут, а не окремими масивами в дашборді й аналітиці: саме через дві
 * незалежні копії цього списку `completed` колись і почав означати різне в
 * різних місцях. `completed` — архівний, лишається для старих рядків.
 */
export const EARNED_REPAIR_STATUSES = ["handed_over", "completed"] as const;

export interface NextStep {
  target: RepairStatus;
  /** Imperative, because it is a button. */
  label: string;
}

/**
 * The single forward move offered on a row. `awaiting_parts` goes back to
 * `in_progress` because that is what finishing a parts wait means.
 *
 * Від «Готовий» одразу до «Видано»: проміжного кроку між ними більше немає, і
 * зайвий клік був єдиним, що він додавав.
 */
const NEXT_STEP: Partial<Record<RepairStatus, NextStep>> = {
  received: { target: "diagnostics", label: "На діагностику" },
  diagnostics: { target: "in_progress", label: "В роботу" },
  in_progress: { target: "ready", label: "Готовий" },
  awaiting_parts: { target: "in_progress", label: "В роботу" },
  ready: { target: "handed_over", label: "Видати клієнту" },
};

export function nextStep(status: string): NextStep | null {
  return NEXT_STEP[status as RepairStatus] ?? null;
}

export interface DebtInput {
  price: number;
  payment_status?: string | null;
  is_warranty?: boolean | null;
}

/**
 * Money the shop is owed for a repair.
 *
 * A warranty repair is free by definition, and a zero-price repair has nothing
 * to collect — neither is a debt, and treating them as one would put permanent
 * noise in the segment that is supposed to mean "chase this".
 *
 * `payment_status` тут не буває null для звичайного складського ремонту —
 * такі рядки відсіює `getAllRepairs()` ще до того, як вони сюди потраплять
 * (у неї немає `inventory_device_id`, щоб самій відрізнити "внутрішній
 * ремонт" від "зовнішній, але статус чомусь не проставили"). Тож null тут —
 * аномалія, а не норма. Для грошей аномалію краще порахувати як борг:
 * завищений борг помітять і виправлять, занижений — ні.
 */
export function isUnpaid(r: DebtInput): boolean {
  if (r.is_warranty) return false;
  if (!r.price || r.price <= 0) return false;
  return r.payment_status !== "paid";
}

/**
 * What is still owed. `payment_status` is a cache of the ledger, so the exact
 * outstanding amount comes from the payments themselves; this is the fallback
 * used where only the repair row is in hand.
 */
export function outstanding(r: DebtInput, paidAmount = 0): number {
  if (!isUnpaid(r)) return 0;
  return Math.max(0, r.price - paidAmount);
}
