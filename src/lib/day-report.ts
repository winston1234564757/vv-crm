import { addDays } from "./utils/day";

/**
 * Чиста логіка сторінки дня: без Supabase і без React, тому тестується
 * без бази. `data-day.ts` тримає лише запити й склейку.
 */

export interface DayOperation {
  /** ISO-мітка часу операції: чек — `created_at`, ремонт — дата видачі. */
  at: string;
  amount: number;
  kind: "sale" | "repair";
}

export interface HourBucket {
  hour: number;
  revenue: number;
  count: number;
}

/**
 * Виторг по годинах доби. Усі 24 години присутні, порожні — нулями: провал о
 * 15:00 має читатись як провал, а не як розрив у даних.
 *
 * Година береться локальна (`getHours`) — рантайм примусово в Europe/Kyiv,
 * тією самою міркою живуть `dayRange` і денна навігація.
 */
export function hourlyBuckets(ops: DayOperation[]): HourBucket[] {
  const out: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    revenue: 0,
    count: 0,
  }));
  for (const o of ops) {
    const h = new Date(o.at).getHours();
    if (h < 0 || h > 23 || Number.isNaN(h)) continue;
    out[h].revenue += o.amount;
    out[h].count += 1;
  }
  return out;
}

/**
 * Сусідні КАЛЕНДАРНІ дні для стрілок ‹ ›. Порожні дні не пропускаються
 * навмисно: перестрибнути день означало б приховати, що магазин був зачинений.
 *
 * Ліва межа — епоха, права — сьогодні: далі даних немає за визначенням.
 */
export function dayNeighbours(
  day: string,
  epochDay: string | null,
  todayDay: string,
): { prev: string | null; next: string | null } {
  const prevKey = addDays(day, -1);
  const nextKey = addDays(day, 1);
  return {
    prev: epochDay && prevKey < epochDay ? null : prevKey,
    next: nextKey > todayDay ? null : nextKey,
  };
}

/**
 * Останній день ДО заданого, у якому був виторг — база для дельти в hero.
 *
 * Це навмисно не `dayNeighbours`: порівняння понеділка з порожньою неділею
 * дало б «+∞» і не означало б нічого. `null` — коли попереднього робочого дня
 * немає (перший день роботи); тоді дельта не малюється взагалі, так само як
 * `comparisonFor` віддає `null` на дашборді.
 */
export function previousWorkingDay(
  day: string,
  series: { day: string; revenue: number }[],
): string | null {
  let best: string | null = null;
  for (const p of series) {
    if (p.day >= day || p.revenue <= 0) continue;
    if (!best || p.day > best) best = p.day;
  }
  return best;
}

/**
 * Скільки операцій було в дні. Ремонт із ціною 0 (гарантійна переробка,
 * безкоштовна діагностика) не чек: у виторг він додає нуль, а лічильник
 * роздував би. У P&L він лишається — там від нього є собівартість.
 */
export function countOperations(
  sales: { id: string }[],
  repairs: { price: number }[],
): number {
  return sales.length + repairs.filter((r) => r.price > 0).length;
}
