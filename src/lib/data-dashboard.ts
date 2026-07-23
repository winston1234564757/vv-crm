import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import { getSettings } from "./data-settings";
import {
  computeProfit,
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
const PARTNER_SHARE = 0.5;

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
 * Сума операційних витрат за вікно [start, end): те саме `expenses.created_at`,
 * що й скрізь, з винятком капітальної категорії (`capital_category_id`) —
 * одноразового вкладення на відкриття, яке не є операційною витратою.
 * Фільтруємо в JS, а не через `.neq()` у запиті: категорія капіталу — це
 * налаштування, яке може бути відсутнім (null), і `.neq(null)` на Supabase
 * не означає "без фільтра", а зламав би запит.
 */
async function expensesForRange(
  supabase: Supabase,
  start: Date,
  end: Date,
  capitalCategoryId: string | null,
): Promise<number> {
  if (start >= end) return 0;

  const { data } = await supabase
    .from("expenses")
    .select("amount, category_id")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  return (data ?? [])
    .filter((e) => e.category_id !== capitalCategoryId)
    .reduce((s, e) => s + e.amount, 0);
}

export async function getDashboardMoney(preset: RangePreset): Promise<DashboardMoney> {
  const supabase = await createClient();
  const now = new Date();
  const settings = await getSettings();
  const epoch = settings.finance_epoch;
  const capitalCategoryId = settings.capital_category_id;

  const range = resolveRange(preset, now);
  const todayRange = resolveRange("today", now);
  const weekRange = resolveRange("7d", now);
  const monthRange = resolveRange("month", now);

  // Кожне грошове вікно опускається до фінансової епохи окремо — тестові
  // продажі "з рук" до відкриття не мають враховуватись у жодному з них.
  const floored = floorAtEpoch(range.start, range.end, epoch);
  const todayFloored = floorAtEpoch(todayRange.start, todayRange.end, epoch);
  const weekFloored = floorAtEpoch(weekRange.start, weekRange.end, epoch);
  const monthFloored = floorAtEpoch(monthRange.start, monthRange.end, epoch);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
    safesRes,
    opexExpensesRes,
  ] = await Promise.all([
    profitForRange(supabase, floored.start, floored.end),
    preset === "today" ? Promise.resolve(null) : profitForRange(supabase, todayFloored.start, todayFloored.end),
    preset === "7d" ? Promise.resolve(null) : profitForRange(supabase, weekFloored.start, weekFloored.end),
    preset === "month" ? Promise.resolve(null) : profitForRange(supabase, monthFloored.start, monthFloored.end),
    expensesForRange(supabase, floored.start, floored.end, capitalCategoryId),
    preset === "today"
      ? Promise.resolve(null)
      : expensesForRange(supabase, todayFloored.start, todayFloored.end, capitalCategoryId),
    preset === "7d"
      ? Promise.resolve(null)
      : expensesForRange(supabase, weekFloored.start, weekFloored.end, capitalCategoryId),
    preset === "month"
      ? Promise.resolve(null)
      : expensesForRange(supabase, monthFloored.start, monthFloored.end, capitalCategoryId),
    supabase.from("cash_registers").select("balance"),
    supabase.from("safes").select("balance, type"),
    supabase.from("expenses").select("amount").gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const todayProfit = preset === "today" ? profit.profit : todayProfitResult!.profit;
  const weekProfit = preset === "7d" ? profit.profit : weekProfitResult!.profit;
  const monthProfit = preset === "month" ? profit.profit : monthProfitResult!.profit;

  // Пресети "Сьогодні" / "Тиждень" / "Місяць" можуть збігатися з обраним
  // діапазоном — тоді окремого запиту не робимо й перевикористовуємо `expenses`.
  const todayExpenses = preset === "today" ? expenses : todayExpensesResult!;
  const weekExpenses = preset === "7d" ? expenses : weekExpensesResult!;
  const monthExpenses = preset === "month" ? expenses : monthExpensesResult!;

  // Частка співвласника — 50% чистого прибутку (маржа − витрати) за
  // фіксованими вікнами: сьогодні, тиждень, місяць. Може бути від'ємною —
  // не floor'имо до нуля, знак зберігається.
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

  // OPEX run-rate: середні "звичайні" витрати (без разових >50000) за 30 днів,
  // з підлогою 500 ₴/день, щоб порожня історія не ділила на нуль.
  const regularOpexTotal = (opexExpensesRes.data ?? [])
    .filter((e) => e.amount < 50000)
    .reduce((s, e) => s + e.amount, 0);
  const dailyOpex = Math.max(Math.round(regularOpexTotal / 30), 500);

  const opexSafeBalance = (safesRes.data ?? []).find((s) => s.type === "opex")?.balance ?? 0;
  const runwayDays = Math.round(opexSafeBalance / dailyOpex);

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
  };
}
