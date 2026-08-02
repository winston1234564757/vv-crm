import { createClient } from "./supabase/server";
import { supabaseCast } from "./utils/supabase";
import { getSettings } from "./data-settings";
import { loadDataset } from "./profit-dataset";
import { revenueSplit, type RevenueSplit } from "./data-dashboard";
import { dayKey } from "./utils/day";
import {
  allocateSaleRevenue,
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
  /** Хто провів. Порожньо, якщо автор невідомий. */
  by: string;
  /**
   * Куди веде рух. Для чека, ремонту й закупівлі це пошук по id на сторінці
   * Продажів: `search_transactions` матчить обидва види по `id::text`, а
   * сторінка Ремонтів `searchParams` не читає взагалі.
   * `null` — прив'язки немає, вести нікуди.
   */
  href: string | null;
}

export interface DayReport {
  day: string;
  profit: ProfitResult;
  split: RevenueSplit;
  operations: DayOperationRow[];
  /**
   * Операційні витрати — без капітальних закупів і без вилучень із сейфа
   * чистого прибутку. Саме ці два числа йдуть у «Витрати» і «Чистими», так
   * само, як у списку днів і на дашборді.
   */
  expenses: DayExpenseRow[];
  /**
   * Витрати, виключені з операційних: капітальні закупи й вилучення частки
   * власником. Гроші з каси пішли, тож ховати їх зі сторінки не можна, але в
   * «Чистими» вони не входять — рахувати вдруге означало б подвійний рахунок.
   */
  otherExpenses: DayExpenseRow[];
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
  const { data, error } = await supabase.from("safes").select("id, type");
  if (error) throw error;
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

  /* Один виклик на всю функцію: те саме значення йде і в dailySeries (для
     дельти проти попереднього дня), і нижче — в розбивку витрат дня на
     операційні й решту. Два окремі запити тут дали б шанс, щоб один з них
     колись мовчки розійшовся з іншим. */
  const netProfitSafeId = await netProfitSafe(supabase);

  const series = dailySeries(loaded.dataset, window.start, window.end, {
    capitalCategoryId: settings.capital_category_id,
    netProfitSafeId,
  });
  const prevKey = previousWorkingDay(day, series);
  const prevPoint = prevKey ? series.find((p) => p.day === prevKey) : undefined;

  /* Погодинний розклад бере ВИЗНАНИЙ виторг, а не збережену суму чека: інакше
     стовпчики склались би в число, відмінне від `profit.revenue` на тій самій
     сторінці. Розбіжність вилазить у крайньому випадку, який `profit.ts`
     описує окремо — підсумок чека більший за суму його позицій: рушій тоді
     фіксує виторг на позиціях і догори не тягне, а сира сума тягнула б.
     Тому продажі проходять через `allocateSaleRevenue`, і сума по всіх
     годинах дорівнює виторгу дня за побудовою.

     Ціна ремонту — уже визнаний виторг: `computeProfit` бере її як є.

     Рядки в списку операцій навмисно лишаються на збереженій сумі — там це
     відповідь на «що пробили», а не на «скільки заробили». */
  const ops: DayOperation[] = [
    ...daySales.map((s) => ({
      at: s.created_at,
      amount: allocateSaleRevenue(s.items, s.total_amount).reduce((a, b) => a + b, 0),
      kind: "sale" as const,
    })),
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
      : Promise.resolve({ data: [], error: null }),
    dayRepairs.length > 0
      ? supabase
          .from("repairs")
          .select("id, device_name, issue, payment_status, customers(name)")
          .in("id", dayRepairs.map((r) => r.id))
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("expenses")
      .select("id, amount, description, category_id, paid_from_safe_id, created_at")
      .gte("created_at", startStr)
      .lt("created_at", endStr),
    supabase.from("expense_categories").select("id, name"),
    supabase
      .from("transactions")
      .select(
        "id, amount, from_type, from_id, to_type, to_id, reference_type, reference_id, description, created_at, created_by",
      )
      .gte("created_at", startStr)
      .lt("created_at", endStr)
      .order("created_at", { ascending: false }),
    supabase.from("safes").select("id, name"),
  ]);

  // Зламаний запит і порожній день раніше виглядали однаково — жоден з цих
  // шести результатів не перевірявся на помилку.
  if (saleDetailRes.error) throw saleDetailRes.error;
  if (repairDetailRes.error) throw repairDetailRes.error;
  if (expensesRes.error) throw expensesRes.error;
  if (catRes.error) throw catRes.error;
  if (txRes.error) throw txRes.error;
  if (safesRes.error) throw safesRes.error;

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

  /* Ті самі два винятки, що й у sliceExpenses/dailySeries (lib/profit.ts), і
     рахуємо тими самими двома id — capitalCategoryId/netProfitSafeId вище:
     капітальна категорія — разові вкладення, не операційна витрата; сейф
     чистого прибутку — вилучення частки власником, уже пораховане як
     розподілений прибуток. Порахувати їх у «Витрати» вдруге — подвійний
     рахунок, і саме через це список днів і сторінка дня раніше показували
     різні цифри для того самого дня. */
  const expenses: DayExpenseRow[] = [];
  const otherExpenses: DayExpenseRow[] = [];
  for (const e of expensesRes.data ?? []) {
    const row: DayExpenseRow = {
      id: e.id,
      at: e.created_at,
      amount: e.amount,
      title: e.description || "Витрата",
      category: (e.category_id && catNames.get(e.category_id)) || "Без категорії",
      safe: (e.paid_from_safe_id && safeNames.get(e.paid_from_safe_id)) || "—",
    };
    const isCapital = !!(settings.capital_category_id && e.category_id === settings.capital_category_id);
    const isNetProfitWithdrawal = !!(netProfitSafeId && e.paid_from_safe_id === netProfitSafeId);
    (isCapital || isNetProfitWithdrawal ? otherExpenses : expenses).push(row);
  }

  const sideName = (type: string, id: string | null) => {
    if (type === "cash_register") return (id && registerNames.get(id)) || "Каса";
    if (type === "safe") return (id && safeNames.get(id)) || "Сейф";
    if (type === "customer") return "Клієнт";
    if (type === "supplier") return "Постачальник";
    return "Зовні";
  };

  const allMoves = txRes.data ?? [];

  /* Імена авторів — окремим запитом після транзакцій: до їх завантаження
     невідомо, кого питати. Порожній список id не запитуємо взагалі. */
  const authorIds = [
    ...new Set(allMoves.map((t) => t.created_by).filter((v): v is string => !!v)),
  ];
  const authorNames = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    if (error) throw new Error(error.message);
    for (const p of profiles ?? []) authorNames.set(p.id, p.full_name ?? "");
  }

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
      by: (t.created_by && authorNames.get(t.created_by)) || "",
      href:
        t.reference_id && ["sale", "repair_payment", "inventory"].includes(t.reference_type ?? "")
          ? `/admin/sales?q=${t.reference_id}`
          : null,
    }));

  return {
    day,
    profit,
    split,
    operations,
    expenses,
    otherExpenses,
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
