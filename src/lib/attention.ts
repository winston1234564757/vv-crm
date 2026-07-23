/**
 * Що на сторінці потребує дії. Перевірки іменовані й додаються по одній —
 * саме тому блок переживе відкриття магазину: сьогодні жива одна з чотирьох,
 * решта оживе, коли з'явиться потік.
 *
 * Чому не `updated_at`: він зіпсований груповими операціями. Усі три застряглі
 * ремонти показують `updated_at` три дні тому при віці 23-26 днів.
 * Чому не сам лог: `repair_status_log` пише лише переходи, тож ремонт, якого
 * ніхто не чіпав, у ньому відсутній — а це рівно той випадок, що цікавить.
 * Тому `coalesce(останній перехід, created_at)`.
 */

import { pluralUk } from "./utils/plural";

export type AttentionCode =
  | "repair_stalled"
  | "repair_awaiting_parts"
  | "repair_unpaid"
  | "stock_low";

/** Скільки днів без руху вважати застоєм. */
export const STALL_DAYS = 14;
/** Скільки рядків показувати в групі; решта — за кліком. */
export const TOP_ROWS = 3;

const OPEN_REPAIR_STATUSES = new Set([
  "received",
  "diagnostics",
  "in_progress",
  "awaiting_parts",
  "ready",
]);

const DELIVERED_STATUSES = new Set(["completed", "handed_over"]);

export interface AttentionRepair {
  id: string;
  device_name: string;
  status: string;
  created_at: string;
  inventory_device_id: string | null;
  payment_status: string | null;
  /** Дата останнього переходу з `repair_status_log`, або null. */
  last_log_at: string | null;
}

export interface AttentionStockItem {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  kind: "accessory" | "part";
}

export interface AttentionRow {
  id: string;
  title: string;
  note: string;
  /** Більше — терміновіше. Лише для сортування. */
  urgency: number;
  /** Тільки для рядків складу — куди веде посилання. Ремонти лишають undefined. */
  kind?: "accessory" | "part";
}

export interface AttentionGroup {
  code: AttentionCode;
  label: string;
  rows: AttentionRow[];
  /** Скільки всього, а не скільки показано. */
  total: number;
}

const GROUP_LABELS: Record<AttentionCode, string> = {
  repair_stalled: `Ремонти без руху понад ${STALL_DAYS} днів`,
  repair_awaiting_parts: "Ремонти чекають деталей задовго",
  repair_unpaid: "Видані ремонти без оплати",
  stock_low: "Час замовляти",
};

/** Момент входу в поточний статус. */
export function statusSince(r: AttentionRepair): string {
  return r.last_log_at ?? r.created_at;
}

export function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  const diff = now.getTime() - then;
  if (diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

function group(
  code: AttentionCode,
  rows: AttentionRow[],
): AttentionGroup | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.urgency - a.urgency);
  return {
    code,
    label: GROUP_LABELS[code],
    rows: sorted.slice(0, TOP_ROWS),
    total: sorted.length,
  };
}

export function findAttention(
  input: { repairs: AttentionRepair[]; stock: AttentionStockItem[] },
  now: Date,
): AttentionGroup[] {
  const stalled: AttentionRow[] = [];
  const awaiting: AttentionRow[] = [];
  const unpaid: AttentionRow[] = [];

  for (const r of input.repairs) {
    if (OPEN_REPAIR_STATUSES.has(r.status)) {
      const days = daysBetween(statusSince(r), now);
      if (days >= STALL_DAYS) {
        const row = {
          id: r.id,
          title: r.device_name,
          note: `${days} ${pluralUk(days, "день", "дні", "днів")} без руху`,
          urgency: days,
        };
        if (r.status === "awaiting_parts") awaiting.push(row);
        else stalled.push(row);
      }
    }

    // NULL означає «платника немає» — складський ремонт. Не борг.
    if (
      DELIVERED_STATUSES.has(r.status) &&
      !r.inventory_device_id &&
      r.payment_status === "unpaid"
    ) {
      unpaid.push({
        id: r.id,
        title: r.device_name,
        note: "не оплачено",
        urgency: daysBetween(statusSince(r), now),
      });
    }
  }

  const low: AttentionRow[] = input.stock
    .filter((s) => s.stock <= s.min_stock)
    .map((s) => ({
      id: s.id,
      title: s.name,
      note: s.kind === "part" ? `${s.stock} шт · запчастина` : `${s.stock} шт`,
      // Нульові — вгору; далі за глибиною браку.
      urgency: s.stock === 0 ? 1000 : 100 - s.stock,
      kind: s.kind,
    }));

  return [
    group("repair_stalled", stalled),
    group("repair_awaiting_parts", awaiting),
    group("repair_unpaid", unpaid),
    group("stock_low", low),
  ].filter((g): g is AttentionGroup => g !== null);
}
