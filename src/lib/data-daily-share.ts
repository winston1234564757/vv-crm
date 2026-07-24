import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import { getSettings } from "./data-settings";
import { PARTNER_SHARE } from "./data-dashboard";
import {
  computeProfit,
  type ProfitDeviceCost,
  type ProfitRepair,
  type ProfitSale,
  type ProfitSaleItem,
} from "./profit";

export interface DailyShare {
  /** Локальна дата, `YYYY-MM-DD`. */
  date: string;
  /** Чистий прибуток дня: маржа − операційні витрати. Може бути від'ємним. */
  net: number;
  /** Частка співвласника — 50% чистого, знак збережено. */
  share: number;
}

/**
 * Локальна дата у форматі `YYYY-MM-DD`. Той самий локальний час, що й
 * `resolveRange` (`new Date(y, m, d)`), щоб денна розбивка групувалась так
 * само, як вікна дашборда.
 */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Чиста частка співвласника за кожен день від фінансової епохи до сьогодні.
 *
 * Одна вибірка всіх даних від епохи (магазин щойно відкрився, рядків мало),
 * потім групування по локальній даті й той самий `computeProfit`, що годує
 * дашборд і Фінанси — щоб сума днів за місяць збігалася з місячним числом, а
 * не рахувалась третім, розбіжним способом. Капітальна категорія виключається
 * з операційних витрат, як і всюди.
 */
export async function getDailyShares(): Promise<DailyShare[]> {
  const supabase = await createClient();
  const settings = await getSettings();
  const capitalCategoryId = settings.capital_category_id;
  const epoch = settings.finance_epoch ? new Date(settings.finance_epoch) : null;
  const epochStr = epoch && !Number.isNaN(epoch.getTime()) ? epoch.toISOString() : null;

  const salesQ = supabase
    .from("sales")
    .select("created_at, discount, sale_items(item_type, item_id, quantity, unit_cost, total_price)");
  const repairsQ = supabase
    .from("repairs")
    .select("completed_at, price, cost, external_sc_cost")
    .is("inventory_device_id", null)
    .in("status", ["completed", "handed_over"]);
  const expensesQ = supabase.from("expenses").select("created_at, amount, category_id, paid_from_safe_id");

  if (epochStr) {
    salesQ.gte("created_at", epochStr);
    repairsQ.gte("completed_at", epochStr);
    expensesQ.gte("created_at", epochStr);
  }

  const [salesRes, repairsRes, expensesRes, safesRes] = await Promise.all([salesQ, repairsQ, expensesQ,
    supabase.from("safes").select("id, type"),
  ]);

  // Сейф чистого прибутку: витрати з нього — вилучення власника, не OPEX.
  const netProfitSafeId = (safesRes.data ?? []).find((s) => s.type === "net_profit")?.id ?? null;

  const salesData = salesRes.data ?? [];

  // Собівартості проданих пристроїв — потрібні `computeProfit` (пристрій
  // рахується як cost_price + repair_cost, а не за unit_cost чека).
  const deviceIds: string[] = [];
  for (const sale of salesData) {
    const items = supabaseCast<{ item_type: string; item_id: string }[]>(sale.sale_items ?? []);
    for (const it of items) if (it.item_type === "device" && it.item_id) deviceIds.push(it.item_id);
  }
  const deviceCostsMap = new Map<string, ProfitDeviceCost>();
  if (deviceIds.length > 0) {
    const { data } = await supabase
      .from("devices")
      .select("id, cost_price, repair_cost")
      .in("id", deviceIds);
    for (const d of data ?? []) {
      deviceCostsMap.set(d.id, { cost_price: d.cost_price, repair_cost: d.repair_cost });
    }
  }

  const salesByDay = new Map<string, ProfitSale[]>();
  for (const sale of salesData) {
    const key = localDateKey(sale.created_at as string);
    const arr = salesByDay.get(key) ?? [];
    arr.push({ discount: sale.discount, items: supabaseCast<ProfitSaleItem[]>(sale.sale_items ?? []) });
    salesByDay.set(key, arr);
  }

  const repairsByDay = new Map<string, ProfitRepair[]>();
  for (const r of repairsRes.data ?? []) {
    if (!r.completed_at) continue;
    const key = localDateKey(r.completed_at as string);
    const arr = repairsByDay.get(key) ?? [];
    arr.push({ price: r.price, cost: r.cost, external_sc_cost: r.external_sc_cost });
    repairsByDay.set(key, arr);
  }

  const opexByDay = new Map<string, number>();
  for (const e of expensesRes.data ?? []) {
    if (e.category_id === capitalCategoryId) continue; // капітал — не операційна витрата
    if (e.paid_from_safe_id === netProfitSafeId) continue; // вилучення прибутку — не OPEX
    const key = localDateKey(e.created_at as string);
    opexByDay.set(key, (opexByDay.get(key) ?? 0) + e.amount);
  }

  const days = new Set<string>([
    ...salesByDay.keys(),
    ...repairsByDay.keys(),
    ...opexByDay.keys(),
  ]);

  const result: DailyShare[] = [];
  for (const date of days) {
    const profit = computeProfit(
      salesByDay.get(date) ?? [],
      deviceCostsMap,
      repairsByDay.get(date) ?? [],
    );
    const net = profit.profit - (opexByDay.get(date) ?? 0);
    result.push({ date, net, share: Math.round(net * PARTNER_SHARE) });
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}
