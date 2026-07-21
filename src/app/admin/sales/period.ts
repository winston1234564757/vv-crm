import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { SalesBucket } from "@/lib/data-sales";

export type Period = "today" | "7d" | "30d" | "month" | "prev_month" | "all";

export const PERIOD_TABS: Array<{ value: Period; label: string }> = [
  { value: "today", label: "Сьогодні" },
  { value: "7d", label: "7 днів" },
  { value: "30d", label: "30 днів" },
  { value: "month", label: "Цей місяць" },
  { value: "prev_month", label: "Минулий місяць" },
  { value: "all", label: "Увесь час" },
];

export const DEFAULT_PERIOD: Period = "30d";

export function parsePeriod(value: string | undefined): Period {
  return PERIOD_TABS.some((t) => t.value === value) ? (value as Period) : DEFAULT_PERIOD;
}

/** Range + trend granularity for a period. `from`/`to` null means "all time". */
export function periodRange(period: Period): { from: Date | null; to: Date | null; bucket: SalesBucket } {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), bucket: "hour" };
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), bucket: "day" };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), bucket: "day" };
    case "month":
      return { from: startOfMonth(now), to: endOfDay(now), bucket: "day" };
    case "prev_month": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev), bucket: "day" };
    }
    case "all":
    default:
      return { from: null, to: null, bucket: "month" };
  }
}
