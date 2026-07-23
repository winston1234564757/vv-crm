import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import {
  computeProfit,
  resolveRange,
  type ProfitDeviceCost,
  type ProfitResult,
  type ProfitSale,
  type ProfitSaleItem,
  type RangePreset,
} from "./profit";

type Supabase = Awaited<ReturnType<typeof createClient>>;

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
}

/**
 * Прибуток за довільне вікно [start, end). Дзеркалить `getFinanceReport` у
 * `data-finance.ts` (Task 2) один в один: той самий фільтр по `sales.created_at`,
 * ті самі зовнішні завершені ремонти по `repairs.completed_at`, той самий
 * фолбек собівартості пристрою. Розходження тут — це розходження між
 * дашбордом і Фінансами, а звірку між ними перевіряє §8 спеки.
 */
async function profitForRange(
  supabase: Supabase,
  start: Date,
  end: Date,
): Promise<ProfitResult> {
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

export async function getDashboardMoney(preset: RangePreset): Promise<DashboardMoney> {
  const supabase = await createClient();
  const now = new Date();

  const range = resolveRange(preset, now);
  const todayRange = resolveRange("today", now);
  const monthRange = resolveRange("month", now);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    profit,
    todayProfitResult,
    monthProfitResult,
    expensesRes,
    monthExpensesRes,
    cashRegistersRes,
    safesRes,
    opexExpensesRes,
  ] = await Promise.all([
    profitForRange(supabase, range.start, range.end),
    preset === "today" ? Promise.resolve(null) : profitForRange(supabase, todayRange.start, todayRange.end),
    preset === "month" ? Promise.resolve(null) : profitForRange(supabase, monthRange.start, monthRange.end),
    supabase
      .from("expenses")
      .select("amount")
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString()),
    preset === "month"
      ? Promise.resolve(null)
      : supabase
          .from("expenses")
          .select("amount")
          .gte("created_at", monthRange.start.toISOString())
          .lt("created_at", monthRange.end.toISOString()),
    supabase.from("cash_registers").select("balance"),
    supabase.from("safes").select("balance, type"),
    supabase.from("expenses").select("amount").gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const todayProfit = preset === "today" ? profit.profit : todayProfitResult!.profit;
  const monthProfit = preset === "month" ? profit.profit : monthProfitResult!.profit;

  const expenses = (expensesRes.data ?? []).reduce((s, e) => s + e.amount, 0);
  // Пресет "Місяць" — той самий діапазон, що й обраний, тому окремого
  // запиту не робимо й перевикористовуємо `expenses`.
  const monthExpenses =
    preset === "month" ? expenses : (monthExpensesRes?.data ?? []).reduce((s, e) => s + e.amount, 0);
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

  return { profit, expenses, cashTotal, runwayDays, dailyOpex, monthProfit, todayProfit, monthExpenses };
}
