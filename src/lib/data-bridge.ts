import { createClient } from "./supabase/server";
import { getSettings } from "./data-settings";
import { loadDataset } from "./profit-dataset";
import { sliceProfit, sliceExpenses } from "./profit";
import { buildBridge, netWorth, type CashBridge, type NetWorth } from "./bridge";
import { supabaseCast } from "./utils/supabase";
import { getAllTransactions, getAllRegistersRaw, getAllSafesRaw } from "./request-cache";

/**
 * Дані для містка «прибуток → гроші» і для «скільки коштує бізнес».
 *
 * Вікно — від фінансової епохи до зараз. Не за 30 днів: питання «то де гроші»
 * стосується всього, що заробили відколи ведуть облік, а не останнього місяця.
 *
 * `bridge.ts` лишається чистим і не знає про Supabase — цей модуль рахує йому
 * входи. Прибуток береться з `profit.ts` (єдиний рушій), рух грошей — з
 * `transactions`, і зводяться вони тільки тут, у містку.
 */
export interface MoneyPicture {
  bridge: CashBridge;
  worth: NetWorth;
  epoch: string | null;
}

/** Рухи власника й капіталу з реєстру — усе, чого прибуток не бачить. */
interface LedgerSums {
  inventorySpend: number;
  ownerContributions: number;
  ownerDraws: number;
  adjustments: number;
  deferredRevenue: number;
  cashChange: number;
}

/** Закупівлі товару: усе, що пішло з рахунків на поповнення складу. */
const INVENTORY_KINDS = new Set(["inventory", "device", "part", "accessory", "purchase"]);

export async function getMoneyPicture(): Promise<MoneyPicture> {
  const supabase = await createClient();
  const settings = await getSettings();
  const epochIso = settings.finance_epoch;

  const start = epochIso ? new Date(epochIso) : new Date(0);
  const end = new Date();

  /* Реєстр, каси й сейфи — через `request-cache`: ті самі три таблиці на цій
     сторінці читає ще `getCashFlow`, і без спільного кешу вони летіли б у базу
     двічі. Решта запитів тут свої, бо більше нікому не потрібні. */
  const [loaded, txRows, registers, safes, devRes, accRes, partRes, repairRes, moveRes] =
    await Promise.all([
      loadDataset(supabase, start, end),
      getAllTransactions(),
      getAllRegistersRaw(),
      getAllSafesRaw(),
      supabase.from("devices").select("cost_price, repair_cost, status"),
      supabase.from("accessories").select("cost_price, stock"),
      supabase.from("parts").select("*"),
      supabase.from("repairs").select("id, price, status, completed_at, inventory_device_id"),
      /* `*`, а не перелік колонок: `unit_cost` немає в згенерованих типах
         (`database.ts` навмисно не перегенеровується), а названа в `.select()`
         невідома колонка ламає типізацію всього запиту. */
      supabase
        .from("inventory_movements")
        .select("*")
        .eq("item_type", "accessory")
        .in("reason", ["write_off", "adjustment"])
        .gte("created_at", epochIso ?? "1970-01-01T00:00:00Z"),
    ]);

  for (const r of [devRes, accRes, partRes, repairRes, moveRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const netProfitSafeId = safes.find((s) => s.type === "net_profit")?.id ?? null;

  const dataset = loaded.dataset;
  const profit = sliceProfit(dataset, start, end);
  const opex = sliceExpenses(dataset, start, end, settings.capital_category_id, netProfitSafeId);
  const netProfit = profit.profit - opex;

  const ledger = summariseLedger(
    txRows,
    supabaseCast<{ id: string; status: string }[]>(repairRes.data ?? []),
    epochIso,
  );

  /* Капітальні витрати й вилучення через сейф ЧП — обидва свідомо виключені з
     P&L (`sliceExpenses` їх відкидає), тож прибуток їх не бачить, а каса
     бачить. У містку вони мусять стояти явними рядками, інакше та сама сума
     осяде в нев'язці й буде виглядати помилкою обліку. */
  const { capitalExpenses, netProfitSafeSpend } = splitExcludedExpenses(
    dataset,
    start,
    end,
    settings.capital_category_id,
    netProfitSafeId,
  );

  /* Списаний товар теж вибув зі складу — просто не через продаж.
     `profit.cost` бачить лише собівартість ПРОДАНОГО, тож без цього доданку
     списання двох кабелів по 140 ₴ зменшило б «Вартість бізнесу» на 280 ₴, а
     міст цього не пояснив би: на сторінці фінансів засвітилась би «Нев'язка
     280 ₴» там, де насправді все чесно.

     `write_off` (товар був і зник) і `adjustment` (товару ніколи не було)
     рахуються разом. Для розбору різниця важлива й лежить у `note`, але для
     містка вона одна: вартість пішла зі складу без продажу. */
  const writtenOff = writtenOffValue(supabaseCast<MovementRow[]>(moveRes.data ?? []));
  const inventoryDelta = ledger.inventorySpend - profit.cost - writtenOff;

  const bridge = buildBridge({
    netProfit,
    inventoryDelta,
    deferredRevenue: ledger.deferredRevenue,
    receivablesDelta: 0,
    payablesDelta: payablesTotal(supabaseCast<PartRow[]>(partRes.data ?? [])),
    capitalExpenses,
    ownerContributions: ledger.ownerContributions,
    ownerDraws: ledger.ownerDraws + netProfitSafeSpend,
    adjustments: ledger.adjustments,
    actualCashChange: ledger.cashChange,
  });

  const devices = supabaseCast<DeviceRow[]>(devRes.data ?? []);
  const accessories = supabaseCast<{ cost_price: number; stock: number }[]>(accRes.data ?? []);
  const parts = supabaseCast<PartRow[]>(partRes.data ?? []);

  const worth = netWorth({
    registers: registers.reduce((s, r) => s + r.balance, 0),
    safes: safes.reduce((s, r) => s + r.balance, 0),
    /* Склад — за собівартістю і тільки те, що ще можна продати. Проданий
       апарат тут був би подвійним рахунком: його гроші вже в касі. */
    devicesAtCost: devices
      .filter((d) => d.status === "in_stock" || d.status === "service" || d.status === "transit")
      .reduce((s, d) => s + d.cost_price + d.repair_cost, 0),
    accessoriesAtCost: accessories
      .filter((a) => a.stock > 0)
      .reduce((s, a) => s + a.cost_price * a.stock, 0),
    partsAtCost: parts.filter((p) => p.stock > 0).reduce((s, p) => s + p.cost_price * p.stock, 0),
    receivables: 0,
    payables: payablesTotal(parts),
    ownerCount: 2,
  });

  return { bridge, worth, epoch: epochIso };
}

interface LedgerRow {
  amount: number;
  from_type: string;
  to_type: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

interface PartRow {
  cost_price: number;
  stock: number;
  payment_status: string | null;
  debt_amount: number | null;
}

interface DeviceRow {
  cost_price: number;
  repair_cost: number;
  status: string;
}

interface MovementRow {
  quantity_change: number;
  unit_cost: number | null;
}

/**
 * Вартість товару, що вибув зі складу не через продаж.
 *
 * Рахує по `unit_cost` руху, а не по поточному `cost_price` картки: картка
 * після списання ще не раз зміниться закупівлями, а вибуло стільки, скільки
 * коштувало ТОДІ. Рухи без `unit_cost` (записані до цієї колонки) дають нуль —
 * вигадувати їм ціну гірше, ніж визнати, що її не записали.
 */
export function writtenOffValue(moves: MovementRow[]): number {
  return moves.reduce((s, m) => s + Math.abs(m.quantity_change) * (m.unit_cost ?? 0), 0);
}

/** Борг постачальникам: запчастини, взяті з відтермінуванням і ще не оплачені. */
function payablesTotal(parts: PartRow[]): number {
  return parts
    .filter((p) => p.payment_status === "deferred")
    .reduce((s, p) => s + (p.debt_amount ?? 0), 0);
}

/**
 * Витрати, які P&L свідомо не бачить, — розділені за причиною.
 *
 * `sliceExpenses` відкидає обидві категорії одним фільтром, але в містку вони
 * різні рядки: капітальні — це вкладення в бізнес, витрати з сейфа ЧП — це
 * вилучення частки в іншій обгортці. Змішати їх означало б показати власникам
 * «капітальні витрати 4 100 ₴» там, де 600 з них вони забрали собі.
 */
function splitExcludedExpenses(
  dataset: Awaited<ReturnType<typeof loadDataset>>["dataset"],
  start: Date,
  end: Date,
  capitalCategoryId: string | null,
  netProfitSafeId: string | null,
): { capitalExpenses: number; netProfitSafeSpend: number } {
  let capitalExpenses = 0;
  let netProfitSafeSpend = 0;

  for (const e of dataset.expenses) {
    // `created_at`, а не `paid_at`: саме по ньому ріже `sliceExpenses`, і якби
    // тут було інше поле, витрата могла б випасти з OPEX і не потрапити в жоден
    // рядок містка — тобто осісти в нев'язці як фальшива помилка обліку.
    const at = new Date(e.created_at).getTime();
    if (at < start.getTime() || at >= end.getTime()) continue;

    // Порядок гілок важливий: витрата з сейфа ЧП рахується вилученням навіть
    // якщо вона ще й капітальна, інакше одні й ті самі гроші стали б двома
    // рядками містка й нев'язка поїхала б рівно на їхню суму.
    if (netProfitSafeId && e.paid_from_safe_id === netProfitSafeId) {
      netProfitSafeSpend += e.amount;
    } else if (capitalCategoryId && e.category_id === capitalCategoryId) {
      capitalExpenses += e.amount;
    }
  }

  return { capitalExpenses, netProfitSafeSpend };
}

/**
 * Одним проходом по реєстру — усе, що потрібно містку.
 *
 * `cashChange` рахується як дельта рахунків від епохи, а не як
 * «поточний залишок»: до епохи магазин уже торгував, і той залишок у касах
 * лежить досі. Порівнювати прибуток після епохи з усіма грошима в касі
 * означало б покласти дозепохову торгівлю в нев'язку.
 */
function summariseLedger(
  rows: LedgerRow[],
  repairs: { id: string; status: string }[],
  epochIso: string | null,
): LedgerSums {
  const epochMs = epochIso ? new Date(epochIso).getTime() : null;
  const undelivered = new Set(
    repairs.filter((r) => r.status !== "handed_over" && r.status !== "cancelled").map((r) => r.id),
  );

  const sums: LedgerSums = {
    inventorySpend: 0,
    ownerContributions: 0,
    ownerDraws: 0,
    adjustments: 0,
    deferredRevenue: 0,
    cashChange: 0,
  };

  const isAccount = (t: string) => t === "cash_register" || t === "safe";

  for (const t of rows) {
    if (epochMs !== null && new Date(t.created_at).getTime() < epochMs) continue;

    if (t.to_type && isAccount(t.to_type)) sums.cashChange += t.amount;
    if (t.from_type && isAccount(t.from_type)) sums.cashChange -= t.amount;

    const kind = t.reference_type ?? "";

    if (INVENTORY_KINDS.has(kind) && isAccount(t.from_type)) {
      sums.inventorySpend += t.amount;
    }
    if (kind === "top_up") sums.ownerContributions += t.amount;
    if (kind === "distribution" && t.to_type === "external") sums.ownerDraws += t.amount;
    if (kind === "adjustment") {
      // Списання йде з рахунку, дозапис — на рахунок. Знак задає напрям.
      sums.adjustments += isAccount(t.from_type) ? -t.amount : t.amount;
    }
    /* Гроші за ремонт, який ще не видали, і передоплати замовлень: у касі вже
       є, виторгом стануть на видачі. Без цього рядка міст не сходиться рівно
       на суму таких оплат. */
    if (kind === "repair_payment" && t.reference_id && undelivered.has(t.reference_id)) {
      sums.deferredRevenue += t.amount;
    }
    if (kind === "client_order" && isAccount(t.to_type)) {
      sums.deferredRevenue += t.amount;
    }
  }

  return sums;
}
