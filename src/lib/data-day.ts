import { createClient } from "./supabase/server";
import { supabaseCast } from "./utils/supabase";
import { getSettings } from "./data-settings";
import { loadDataset } from "./profit-dataset";
import { revenueSplit, type RevenueSplit } from "./data-dashboard";
import { dayKey } from "./utils/day";
import {
  computeProfit,
  dailySeries,
  dayRange,
  floorAtEpoch,
  resolveRange,
  LEDGER_MAX_DAYS,
  type DayPoint,
  type ProfitResult,
} from "./profit";
import {
  countOperations,
  dayNeighbours,
  hourlyBuckets,
  previousWorkingDay,
  type DayOperation,
} from "./day-report";

/**
 * Дані сторінок «Дні».
 *
 * Прибуток рахує рушій `lib/profit.ts` — той самий виклик, що годує дашборд і
 * Фінанси. Тому денна цифра тут не може розійтися з ними за побудовою, а не за
 * домовленістю. Жодних власних підсумків виторгу в цьому файлі бути не
 * повинно — це стереже `__tests__/no-raw-revenue-sum.test.ts`.
 */

export interface DayRow extends DayPoint {
  /** Чеки плюс видані платні ремонти. Ремонт із ціною 0 не рахується. */
  operations: number;
}

export interface DayOperationRow {
  id: string;
  at: string;
  /**
   * Сума операції так, як вона збережена: підсумок чека або ціна ремонту.
   * Може не скластися у виторг угорі на розмір знижки — рядок відповідає на
   * «що пробили», а верхня цифра на «скільки заробили».
   */
  amount: number;
  kind: "sale" | "repair";
  title: string;
  customer: string;
  payment: string;
}

export interface DayExpenseRow {
  id: string;
  at: string;
  amount: number;
  title: string;
  category: string;
  safe: string;
}

export interface DayMoveRow {
  id: string;
  at: string;
  amount: number;
  from: string;
  to: string;
  kind: string;
  description: string;
}

export interface DayReport {
  day: string;
  profit: ProfitResult;
  split: RevenueSplit;
  operations: DayOperationRow[];
  expenses: DayExpenseRow[];
  /** Реальні рухи; автоматичні розподіли по сейфах лежать окремо. */
  moves: DayMoveRow[];
  distributions: { count: number; total: number };
  hourly: { hour: number; revenue: number; count: number }[];
  neighbours: { prev: string | null; next: string | null };
  previousDay: { day: string; profit: number } | null;
}

/** Скільки днів назад тягнемо датасет заради дельти в hero. */
const DELTA_LOOKBACK_DAYS = 30;

/**
 * Id сейфа чистого прибутку. Потрібен `dailySeries`, щоб не порахувати
 * вилучення частки власником як операційну витрату: воно вже є частиною
 * розподіленого прибутку, і другий раз у P&L — подвійний рахунок.
 *
 * Дашборд передає його в ту саму функцію. Передати сюди `null` означало б, що
 * «чистими» за день на цій сторінці і на дашборді рахуються по-різному — рівно
 * та розбіжність, від якої лікували решту системи.
 */
async function netProfitSafe(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.from("safes").select("id, type");
  return (data ?? []).find((s) => s.type === "net_profit")?.id ?? null;
}

const MOVE_LABELS: Record<string, string> = {
  sale: "Продаж",
  repair_payment: "Оплата ремонту",
  expense: "Витрата",
  inventory: "Закупівля",
  top_up: "Поповнення",
  client_order: "Замовлення",
  accessory: "Аксесуар",
  distribution: "Розподіл",
};

/**
 * Список днів від епохи, найновіші зверху.
 *
 * Це та сама пачка запитів, яку дашборд і так робить при кожному відкритті —
 * нової вартості не з'являється. Стеля `LEDGER_MAX_DAYS` спрацює раніше, ніж
 * таблиця стане завеликою.
 */
export async function getDayList(): Promise<DayRow[]> {
  const supabase = await createClient();
  const settings = await getSettings();
  const now = new Date();

  const todayRange = resolveRange("today", now);
  const start = new Date(todayRange.start);
  start.setDate(start.getDate() - LEDGER_MAX_DAYS);
  const window = floorAtEpoch(start, todayRange.end, settings.finance_epoch);
  if (window.empty) return [];

  const [loaded, netProfitSafeId] = await Promise.all([
    loadDataset(supabase, window.start, window.end),
    netProfitSafe(supabase),
  ]);
  const series = dailySeries(loaded.dataset, window.start, window.end, {
    capitalCategoryId: settings.capital_category_id,
    netProfitSafeId,
  });

  const salesByDay = new Map<string, { id: string }[]>();
  for (const s of loaded.dataset.sales) {
    const k = dayKey(new Date(s.created_at));
    const arr = salesByDay.get(k);
    if (arr) arr.push({ id: s.id });
    else salesByDay.set(k, [{ id: s.id }]);
  }
  const repairsByDay = new Map<string, { price: number }[]>();
  for (const r of loaded.dataset.repairs) {
    const k = dayKey(new Date(r.settled_at));
    const arr = repairsByDay.get(k);
    if (arr) arr.push({ price: r.price });
    else repairsByDay.set(k, [{ price: r.price }]);
  }

  return series
    .map((p) => ({
      ...p,
      operations: countOperations(salesByDay.get(p.day) ?? [], repairsByDay.get(p.day) ?? []),
    }))
    .reverse();
}

/**
 * Повний зріз одного дня.
 *
 * Вікно — `[день − 30, кінець дня)`. Відступ назад потрібен лише для дельти в
 * hero: порахувати прибуток попереднього робочого дня з одноденного вікна
 * неможливо. Тридцять днів — та сама вага, яку дашборд носить у пресеті
 * «30 днів». Від епохи не вантажимо навмисно: сторінка одного дня не має
 * тягнути весь датасет магазину заради одного числа.
 *
 * `null` — день до епохи або в майбутньому. День у межах, але порожній,
 * повертає звіт із нулями: «нуль» і «немає такого дня» — різні відповіді.
 */
export async function getDayReport(day: string): Promise<DayReport | null> {
  const supabase = await createClient();
  const settings = await getSettings();
  const now = new Date();
  const todayKey = dayKey(now);

  if (day > todayKey) return null;

  const epochDay = settings.finance_epoch ? dayKey(new Date(settings.finance_epoch)) : null;
  if (epochDay && day < epochDay) return null;

  const target = dayRange(day);
  const lookbackStart = new Date(target.start);
  lookbackStart.setDate(lookbackStart.getDate() - DELTA_LOOKBACK_DAYS);
  const window = floorAtEpoch(lookbackStart, target.end, settings.finance_epoch);
  if (window.empty) return null;

  const loaded = await loadDataset(supabase, window.start, window.end);

  const inDay = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= target.start.getTime() && t < target.end.getTime();
  };

  const daySales = loaded.dataset.sales.filter((s) => inDay(s.created_at));
  const dayRepairs = loaded.dataset.repairs.filter((r) => inDay(r.settled_at));

  const profit = computeProfit(daySales, loaded.dataset.devices, dayRepairs);
  const repairRevenue = profit.byCategory.find((c) => c.category === "repair")?.revenue ?? 0;
  const split = await revenueSplit(
    supabase,
    loaded,
    daySales,
    dayRepairs,
    profit.revenue,
    repairRevenue,
  );

  const series = dailySeries(loaded.dataset, window.start, window.end, {
    capitalCategoryId: settings.capital_category_id,
    netProfitSafeId: await netProfitSafe(supabase),
  });
  const prevKey = previousWorkingDay(day, series);
  const prevPoint = prevKey ? series.find((p) => p.day === prevKey) : undefined;

  const ops: DayOperation[] = [
    ...daySales.map((s) => ({ at: s.created_at, amount: s.total_amount, kind: "sale" as const })),
    ...dayRepairs
      .filter((r) => r.price > 0)
      .map((r) => ({ at: r.settled_at, amount: r.price, kind: "repair" as const })),
  ];

  const startStr = target.start.toISOString();
  const endStr = target.end.toISOString();

  const [saleDetailRes, repairDetailRes, expensesRes, catRes, txRes, safesRes] = await Promise.all([
    daySales.length > 0
      ? supabase
          .from("sales")
          .select("id, notes, customers(name), payment_splits(method)")
          .in("id", daySales.map((s) => s.id))
      : Promise.resolve({ data: [] }),
    dayRepairs.length > 0
      ? supabase
          .from("repairs")
          .select("id, device_name, issue, payment_status, customers(name)")
          .in("id", dayRepairs.map((r) => r.id))
      : Promise.resolve({ data: [] }),
    supabase
      .from("expenses")
      .select("id, amount, description, category_id, paid_from_safe_id, created_at")
      .gte("created_at", startStr)
      .lt("created_at", endStr),
    supabase.from("expense_categories").select("id, name"),
    supabase
      .from("transactions")
      .select("id, amount, from_type, from_id, to_type, to_id, reference_type, description, created_at")
      .gte("created_at", startStr)
      .lt("created_at", endStr)
      .order("created_at", { ascending: false }),
    supabase.from("safes").select("id, name"),
  ]);

  const saleMeta = new Map(
    supabaseCast<
      { id: string; notes: string | null; customers: { name: string } | null; payment_splits: { method: string }[] | null }[]
    >(saleDetailRes.data ?? []).map((s) => [s.id, s]),
  );
  const repairMeta = new Map(
    supabaseCast<
      { id: string; device_name: string; issue: string | null; payment_status: string | null; customers: { name: string } | null }[]
    >(repairDetailRes.data ?? []).map((r) => [r.id, r]),
  );

  const operations: DayOperationRow[] = [
    ...daySales.map((s) => {
      const m = saleMeta.get(s.id);
      const methods = [...new Set((m?.payment_splits ?? []).map((p) => p.method))];
      return {
        id: s.id,
        at: s.created_at,
        amount: s.total_amount,
        kind: "sale" as const,
        title: m?.notes?.split("\n")[0] || "Продаж",
        customer: m?.customers?.name ?? "Роздрібний клієнт",
        payment: methods.length > 0 ? methods.join(" + ") : "—",
      };
    }),
    ...dayRepairs
      .filter((r) => r.price > 0)
      .map((r) => {
        const m = repairMeta.get(r.id);
        return {
          id: r.id,
          at: r.settled_at,
          amount: r.price,
          kind: "repair" as const,
          title: m?.device_name ?? "Ремонт",
          customer: m?.customers?.name ?? "Роздрібний клієнт",
          payment: m?.payment_status === "paid" ? "оплачено" : "борг",
        };
      }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const catNames = new Map((catRes.data ?? []).map((c) => [c.id, c.name]));
  const safeNames = new Map((safesRes.data ?? []).map((s) => [s.id, s.name]));
  const registerNames = new Map(loaded.cashRegisters.map((c) => [c.id, c.name]));

  const expenses: DayExpenseRow[] = (expensesRes.data ?? []).map((e) => ({
    id: e.id,
    at: e.created_at,
    amount: e.amount,
    title: e.description || "Витрата",
    category: (e.category_id && catNames.get(e.category_id)) || "Без категорії",
    safe: (e.paid_from_safe_id && safeNames.get(e.paid_from_safe_id)) || "—",
  }));

  const sideName = (type: string, id: string | null) => {
    if (type === "cash_register") return (id && registerNames.get(id)) || "Каса";
    if (type === "safe") return (id && safeNames.get(id)) || "Сейф";
    if (type === "customer") return "Клієнт";
    if (type === "supplier") return "Постачальник";
    return "Зовні";
  };

  const allMoves = txRes.data ?? [];
  const distributionRows = allMoves.filter((t) => t.reference_type === "distribution");
  const moves: DayMoveRow[] = allMoves
    .filter((t) => t.reference_type !== "distribution")
    .map((t) => ({
      id: t.id,
      at: t.created_at,
      amount: t.amount,
      from: sideName(t.from_type, t.from_id),
      to: sideName(t.to_type, t.to_id),
      kind: MOVE_LABELS[t.reference_type ?? ""] ?? t.reference_type ?? "Рух",
      description: t.description ?? "",
    }));

  return {
    day,
    profit,
    split,
    operations,
    expenses,
    moves,
    distributions: {
      count: distributionRows.length,
      total: distributionRows.reduce((s, t) => s + t.amount, 0),
    },
    hourly: hourlyBuckets(ops),
    neighbours: dayNeighbours(day, epochDay, todayKey),
    previousDay: prevPoint ? { day: prevPoint.day, profit: prevPoint.profit } : null,
  };
}
