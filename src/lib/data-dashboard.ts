import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import { getSettings } from "./data-settings";
import {
  computeProfit,
  dayRange,
  floorAtEpoch,
  resolveRange,
  type ProfitDeviceCost,
  type ProfitResult,
  type ProfitSale,
  type ProfitSaleItem,
  type RangePreset,
} from "./profit";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Частка співвласника в чистому прибутку. Фіксовано 50%, не налаштовується. */
export const PARTNER_SHARE = 0.5;

export interface DashboardMoney {
  profit: ProfitResult;
  /** Витрати за обраний період (`expenses.created_at`, той самий діапазон, що й profit). */
  expenses: number;
  /** Сума балансів усіх кас і сейфів. */
  cashTotal: number;
  runwayDays: number;
  dailyOpex: number;
  /** Прибуток за поточний місяць — незалежно від обраного пресету. */
  monthProfit: number;
  /** Прибуток за сьогодні — незалежно від обраного пресету. */
  todayProfit: number;
  /** Витрати за поточний місяць — незалежно від обраного пресету. Для футера. */
  monthExpenses: number;
  /**
   * Частка співвласника — 50% чистого прибутку (маржа − витрати) за
   * фіксованими вікнами. Може бути від'ємною.
   */
  partnerShare: {
    today: { net: number; share: number };
    week: { net: number; share: number };
    month: { net: number; share: number };
  };
  /**
   * Накопичувальний рахунок прибутку поточного власника.
   * Нараховано = 50% усіх розподілів у сейф ЧП;
   * Знято = сума переказів з сейфа ЧП, зроблених цим користувачем;
   * Залишок = нараховано − знято.
   */
  partnerLedger: {
    totalDistributed: number;
    myWithdrawn: number;
    myAccrued: number;
    myAvailable: number;
    safeBalance: number;
  };
  sources: { id: string; name: string; type: "safe" | "cash_register"; balance: number }[];
}

/**
 * Прибуток за довільне вікно [start, end). Дзеркалить `getFinanceReport` у
 * `data-finance.ts` (Task 2) один в один: той самий фільтр по `sales.created_at`,
 * ті самі зовнішні завершені ремонти по `repairs.completed_at`, той самий
 * фолбек собівартості пристрою. Розходження тут — це розходження між
 * дашбордом і Фінансами, а звірку між ними перевіряє §8 спеки.
 *
 * `start`/`end` мають бути вже опущені до фінансової епохи викликачем
 * (`floorAtEpoch`) — ця функція про епоху нічого не знає, вона лише коротить
 * запит, коли вікно порожнє (`start >= end`), замість того щоб бити Supabase
 * діапазоном навпаки.
 */
async function profitForRange(
  supabase: Supabase,
  start: Date,
  end: Date,
): Promise<ProfitResult> {
  if (start >= end) return computeProfit([], new Map(), []);

  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const [salesRes, repairsRes] = await Promise.all([
    supabase
      .from("sales")
      .select("discount, sale_items(item_type, item_id, quantity, unit_cost, total_price)")
      .gte("created_at", startStr)
      .lt("created_at", endStr),
    supabase
      .from("repairs")
      .select("price, cost, external_sc_cost")
      .is("inventory_device_id", null)
      .in("status", ["completed", "handed_over"])
      .gte("completed_at", startStr)
      .lt("completed_at", endStr),
  ]);

  const salesData = salesRes.data ?? [];

  const deviceIds: string[] = [];
  for (const sale of salesData) {
    const items = supabaseCast<{ item_type: string; item_id: string }[]>(sale.sale_items ?? []);
    for (const item of items) {
      if (item.item_type === "device" && item.item_id) deviceIds.push(item.item_id);
    }
  }

  const deviceCostsMap = new Map<string, ProfitDeviceCost>();
  if (deviceIds.length > 0) {
    const { data: devicesCosts } = await supabase
      .from("devices")
      .select("id, cost_price, repair_cost")
      .in("id", deviceIds);
    for (const d of devicesCosts ?? []) {
      deviceCostsMap.set(d.id, { cost_price: d.cost_price, repair_cost: d.repair_cost });
    }
  }

  const profitSales: ProfitSale[] = salesData.map((sale) => ({
    discount: sale.discount,
    items: supabaseCast<ProfitSaleItem[]>(sale.sale_items ?? []),
  }));

  return computeProfit(profitSales, deviceCostsMap, repairsRes.data ?? []);
}

/**
 * Сума операційних витрат за вікно [start, end): той самий `expenses.created_at`,
 * з двома винятками:
 *   1. `capitalCategoryId` — разові вкладення на відкриття (не OPEX).
 *   2. `netProfitSafeId`   — вилучення прибутку власниками. Гроші з
 *      net_profit-сейфа вже є частиною розподіленого чистого прибутку;
 *      записувати їх ще раз як витрату — подвійний рахунок, який спотворює P&L.
 */
async function expensesForRange(
  supabase: Supabase,
  start: Date,
  end: Date,
  capitalCategoryId: string | null,
  netProfitSafeId: string | null,
): Promise<number> {
  if (start >= end) return 0;

  const { data } = await supabase
    .from("expenses")
    .select("amount, category_id, paid_from_safe_id")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  return (data ?? [])
    .filter((e) => e.category_id !== capitalCategoryId)
    .filter((e) => e.paid_from_safe_id !== netProfitSafeId)
    .reduce((s, e) => s + e.amount, 0);
}

/**
 * @param day необов'язковий ключ `YYYY-MM-DD` — коли заданий, головні цифри
 *   (`profit`/`expenses`) рахуються за цей конкретний день замість вікна
 *   пресету. Використовується денною навігацією на вкладці «Сьогодні». Решта
 *   (todayProfit, monthProfit, partnerShare, ledger) завжди прив'язані до
 *   `now`, тож день-оверрайд вимикає reuse-скорочення нижче.
 */
export async function getDashboardMoney(
  preset: RangePreset,
  userId?: string,
  day?: string | null,
): Promise<DashboardMoney> {
  const supabase = await createClient();
  const now = new Date();
  const settings = await getSettings();
  const epoch = settings.finance_epoch;
  const capitalCategoryId = settings.capital_category_id;

  const dayWin = day ? dayRange(day) : null;
  const range = dayWin ?? resolveRange(preset, now);
  const todayRange = resolveRange("today", now);
  const weekRange = resolveRange("7d", now);
  const monthRange = resolveRange("month", now);

  // День-оверрайд зсуває головне вікно з вікна пресету, тож фіксовані
  // сьогодні/тиждень/місяць більше не збігаються з ним — рахуємо їх окремо.
  const reuseToday = !dayWin && preset === "today";
  const reuseWeek = !dayWin && preset === "7d";
  const reuseMonth = !dayWin && preset === "month";

  const floored = floorAtEpoch(range.start, range.end, epoch);
  const todayFloored = floorAtEpoch(todayRange.start, todayRange.end, epoch);
  const weekFloored = floorAtEpoch(weekRange.start, weekRange.end, epoch);
  const monthFloored = floorAtEpoch(monthRange.start, monthRange.end, epoch);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Step 1: Отримаємо сейфи першими — це маленький запит (у нас завжди ≤ 5 рядків).
  // `netProfitSafeId` необхідний для: (a) фільтрації витрат з P&L,
  // (b) OPEX run-rate без вилучень, (c) запитів Partner Ledger.
  const safesRes = await supabase.from("safes").select("balance, type, id, name");
  const netProfitSafe = (safesRes.data ?? []).find((s) => s.type === "net_profit");
  const netProfitSafeId = netProfitSafe?.id ?? null;
  const netProfitSafeBalance = netProfitSafe?.balance ?? 0;

  // Step 2: Усі паралельні запити (netProfitSafeId вже відомий)
  const [
    profit,
    todayProfitResult,
    weekProfitResult,
    monthProfitResult,
    expenses,
    todayExpensesResult,
    weekExpensesResult,
    monthExpensesResult,
    cashRegistersRes,
    opexExpensesRes,
    npInflowsRes,
    myWithdrawalsRes,
  ] = await Promise.all([
    profitForRange(supabase, floored.start, floored.end),
    reuseToday ? Promise.resolve(null) : profitForRange(supabase, todayFloored.start, todayFloored.end),
    reuseWeek ? Promise.resolve(null) : profitForRange(supabase, weekFloored.start, weekFloored.end),
    reuseMonth ? Promise.resolve(null) : profitForRange(supabase, monthFloored.start, monthFloored.end),
    expensesForRange(supabase, floored.start, floored.end, capitalCategoryId, netProfitSafeId),
    reuseToday
      ? Promise.resolve(null)
      : expensesForRange(supabase, todayFloored.start, todayFloored.end, capitalCategoryId, netProfitSafeId),
    reuseWeek
      ? Promise.resolve(null)
      : expensesForRange(supabase, weekFloored.start, weekFloored.end, capitalCategoryId, netProfitSafeId),
    reuseMonth
      ? Promise.resolve(null)
      : expensesForRange(supabase, monthFloored.start, monthFloored.end, capitalCategoryId, netProfitSafeId),
    supabase.from("cash_registers").select("balance, id, name"),
    // OPEX run-rate: останні 30 днів, без вилучень прибутку власника
    supabase.from("expenses").select("amount, paid_from_safe_id").gte("created_at", thirtyDaysAgo.toISOString()),
    // Partner Ledger: загальна сума розподілів у сейф ЧП (за всі часи)
    netProfitSafeId
      ? supabase.from("transactions").select("amount").eq("to_type", "safe").eq("to_id", netProfitSafeId).eq("reference_type", "distribution")
      : Promise.resolve({ data: [] as { amount: number }[] }),
    // Partner Ledger: вилучення прибутку поточним користувачем (за всі часи)
    userId
      ? supabase
          .from("transactions")
          .select("amount, from_id, reference_type")
          .eq("created_by", userId)
          .eq("to_type", "external")
      : Promise.resolve({ data: [] as { amount: number; from_id: string | null; reference_type: string | null }[] }),
  ]);

  const todayProfit = reuseToday ? profit.profit : todayProfitResult!.profit;
  const weekProfit = reuseWeek ? profit.profit : weekProfitResult!.profit;
  const monthProfit = reuseMonth ? profit.profit : monthProfitResult!.profit;

  const todayExpenses = reuseToday ? expenses : todayExpensesResult!;
  const weekExpenses = reuseWeek ? expenses : weekExpensesResult!;
  const monthExpenses = reuseMonth ? expenses : monthExpensesResult!;

  const todayNet = todayProfit - todayExpenses;
  const weekNet = weekProfit - weekExpenses;
  const monthNet = monthProfit - monthExpenses;
  const partnerShare = {
    today: { net: todayNet, share: Math.round(todayNet * PARTNER_SHARE) },
    week: { net: weekNet, share: Math.round(weekNet * PARTNER_SHARE) },
    month: { net: monthNet, share: Math.round(monthNet * PARTNER_SHARE) },
  };

  const cashTotal =
    (cashRegistersRes.data ?? []).reduce((s, c) => s + c.balance, 0) +
    (safesRes.data ?? []).reduce((s, sf) => s + sf.balance, 0);

  // OPEX run-rate: без вилучень прибутку, без капіталу, без одноразових бурстів (> 50k)
  const regularOpexTotal = (opexExpensesRes.data ?? [])
    .filter((e) => e.amount < 50000 && e.paid_from_safe_id !== netProfitSafeId)
    .reduce((s, e) => s + e.amount, 0);
  const dailyOpex = Math.max(Math.round(regularOpexTotal / 30), 500);

  const opexSafeBalance = (safesRes.data ?? []).find((s) => s.type === "opex")?.balance ?? 0;
  const runwayDays = Math.round(opexSafeBalance / dailyOpex);

  // Partner Ledger — накопичувальний рахунок власника
  const totalDistributed = ((npInflowsRes as { data: { amount: number }[] | null }).data ?? []).reduce((s, t) => s + t.amount, 0);

  // Вилучення прибутку поточним користувачем (з сейфу ЧП або як розподіл)
  const rawWithdrawals = (myWithdrawalsRes as { data: { amount: number; from_id: string | null; reference_type: string | null }[] | null }).data ?? [];
  const myWithdrawn = rawWithdrawals
    .filter((t) => (netProfitSafeId && t.from_id === netProfitSafeId) || t.reference_type === "distribution")
    .reduce((s, t) => s + t.amount, 0);

  // Моя частка згенерованого чистого прибутку за місяць (50%)
  const myAccrued = Math.round(monthNet * PARTNER_SHARE);
  // Залишок доступний до вилучення: Нараховано 50% − Вилучено мною
  const myAvailable = myAccrued - myWithdrawn;

  const sources = [
    ...(safesRes.data ?? []).map((s) => ({ id: s.id, name: s.name, type: "safe" as const, balance: s.balance })),
    ...(cashRegistersRes.data ?? []).map((c) => ({ id: c.id, name: c.name, type: "cash_register" as const, balance: c.balance })),
  ];

  return {
    profit,
    expenses,
    cashTotal,
    runwayDays,
    dailyOpex,
    monthProfit,
    todayProfit,
    monthExpenses,
    partnerShare,
    partnerLedger: {
      totalDistributed,
      myWithdrawn,
      myAccrued,
      myAvailable,
      safeBalance: netProfitSafeBalance,
    },
    sources,
  };
}


