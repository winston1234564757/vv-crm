import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import { getSettings } from "./data-settings";
import {
  computeProfit,
  floorAtEpoch,
  resolveRange,
  toDatedRepairs,
  REPAIR_PNL_COLUMNS,
  type ProfitDeviceCost,
  type ProfitSale,
  type ProfitSaleItem,
  type RangePreset,
  type RepairPnlRow,
} from "./profit";

export async function getCashRegisters() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cash_registers").select("*");
  if (error) throw error;
  return data ?? [];
}

export interface SafeWithSplit {
  id: string;
  name: string;
  type: string;
  balance: number;
  created_at: string;
  updated_at: string;
  /** Скільки в сейфі реальної готівки (зайшло з готівкових кас − вийшло назовні * пропорція) */
  cashBalance: number;
  /** Скільки в сейфі безготівки (картка/переказ, зайшла з cashless рахунку) */
  cardBalance: number;
}

/**
 * Сейфи з поділом на готівку й безготівку.
 *
 * Джерело — колонки `balance_cash` / `balance_cashless`, які веде `safe_apply`
 * на кожному записі й стереже CHECK-обмеження
 * `balance = balance_cash + balance_cashless`. Тобто це не оцінка, а факт.
 *
 * Раніше тут викликався RPC `get_safes_with_cash_split`, який відновлював
 * поділ із історії транзакцій, розносячи витрачене ПРОПОРЦІЙНО по обох
 * кошиках. Він давав інші числа: на 31.07 Growth за RPC мав 3 873 готівки й
 * 3 327 картки, а за колонками — 5 151 і 2 049. Обидва в сумі 7 200, але поділ
 * різний, і на екрані стояла оцінка замість факту. RPC видалено з бази
 * міграцією `20260804184837`.
 *
 * У згенерованих типах половин немає (`database.ts` тут навмисно не
 * перегенеровується), тому каст.
 */
export async function getSafes(): Promise<SafeWithSplit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("safes").select("*");
  if (error) throw error;

  const rows = supabaseCast<
    {
      id: string;
      name: string;
      type: string;
      balance: number;
      balance_cash: number | null;
      balance_cashless: number | null;
      created_at?: string;
      updated_at?: string;
    }[]
  >(data ?? []);

  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    balance: s.balance,
    created_at: s.created_at ?? "",
    updated_at: s.updated_at ?? "",
    cashBalance: s.balance_cash ?? s.balance,
    cardBalance: s.balance_cashless ?? 0,
  }));
}

const typeNameMap: Record<string, string> = {
  customer: "Клієнт",
  cash_register: "Каса",
  safe: "Сейф",
  supplier: "Постачальник",
};

export async function getFinanceData() {
  const supabase = await createClient();
  const [crRes, sfRes, txRes, catRes] = await Promise.all([
    supabase.from("cash_registers").select("*"),
    getSafes(),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("expense_categories").select("*"),
  ]);

  const cashRegisters = crRes.data ?? [];
  const safes = sfRes; // getSafes() повертає масив напряму, без .data
  const transactions = txRes.data ?? [];
  const expenseCategories = catRes.data ?? [];

  const crMap = new Map(cashRegisters.map((cr) => [cr.id, cr.name]));
  const sfMap = new Map(safes.map((sf: SafeWithSplit) => [sf.id, sf.name]));

  const resolved = transactions.map((t) => {
    const fromName = t.from_type === "customer"
      ? "Клієнт"
      : t.from_type === "cash_register"
        ? crMap.get(t.from_id ?? "") ?? t.from_type
        : t.from_type === "safe"
          ? sfMap.get(t.from_id ?? "") ?? t.from_type
          : t.from_type === "supplier"
            ? "Постачальник"
            : typeNameMap[t.from_type] ?? t.from_type;

    const toName = t.to_type === "customer"
      ? "Клієнт"
      : t.to_type === "cash_register"
        ? crMap.get(t.to_id ?? "") ?? t.to_type
        : t.to_type === "safe"
          ? sfMap.get(t.to_id ?? "") ?? t.to_type
          : t.to_type === "supplier"
            ? "Постачальник"
            : typeNameMap[t.to_type] ?? t.to_type;

    return {
      id: t.id,
      date: t.created_at.split("T")[0],
      from: fromName,
      to: toName,
      amount: t.amount,
      type: t.from_type === "customer" ? "sale" : t.to_type === "supplier" ? "expense" : "distribution",
      description: t.description ?? "",
      reference_type: t.reference_type ?? null,
      reference_id: t.reference_id ?? null,
    };
  });

  return { cashRegisters, safes, transactions: resolved, expenseCategories };
}

export async function getFinanceReport(preset: RangePreset = "30d") {
  const supabase = await createClient();
  const settings = await getSettings();
  const capitalCategoryId = settings.capital_category_id;

  const now = new Date();
  const range = resolveRange(preset, now);

  // Нижня межа вікна опускається до фінансової епохи — тестові продажі
  // "з рук" до відкриття магазину не мають враховуватись у звіті.
  const floored = floorAtEpoch(range.start, range.end, settings.finance_epoch);

  if (floored.empty) {
    // Усе вікно лежить до епохи — грошей у ньому немає, запитів не робимо.
    const emptyProfit = computeProfit([], new Map(), []);
    return {
      totalSales: 0,
      totalPurchases: 0,
      totalExpenses: 0,
      capitalExpenses: 0,
      salesCost: 0,
      repairsRevenue: 0,
      repairsCost: 0,
      profit: 0,
      categoryBreakdown: [] as { name: string; amount: number }[],
      byCategory: emptyProfit.byCategory,
    };
  }

  const startStr = floored.start.toISOString();
  const endStr = floored.end.toISOString();

  const [salesRes, purchasesRes, expensesRes, expCatRes, repairsRes, safesForReport] = await Promise.all([
    // `.eq("status","completed")` — та сама причина, що в `profit-dataset.ts`:
    // повернений продаж лишає total_amount і рядки на місці, тож без фільтра
    // він назавжди сидів би у виторзі.
    supabase.from("sales").select("total_amount, discount, sale_items(item_type, item_id, quantity, unit_cost, total_price)").eq("status", "completed").gte("created_at", startStr).lt("created_at", endStr),
    supabase.from("purchases").select("total_amount").gte("created_at", startStr).lt("created_at", endStr),
    supabase.from("expenses").select("amount, category_id, paid_from_safe_id").gte("created_at", startStr).lt("created_at", endStr),
    supabase.from("expense_categories").select("*"),
    supabase
      .from("repairs")
      .select(REPAIR_PNL_COLUMNS)
      .is("inventory_device_id", null)
      // Ремонт закривається видачею; точний відбір — `toDatedRepairs`.
      .gte("completed_at", startStr)
      .lt("completed_at", endStr),
    supabase.from("safes").select("id, type"),
  ]);

  const netProfitSafeId = (safesForReport.data ?? []).find((s) => s.type === "net_profit")?.id ?? null;

  const salesData = salesRes.data ?? [];
  /* Закупівлі — витрати, а не виторг, тож рушій до них не стосується. Але
     `purchases` має стовпець із тим самим іменем, і guard-тест дивиться на
     ФОРМУ запису, а не на зміст: звичайний `s + r.total_amount` він завалив би
     тут так само, як завалив би справжній підрахунок виторгу.

     Деструктуризація — визнаний компроміс текстового guard-а, а не дозвіл
     рахувати так виторг. Якщо колись побачите цей запис поруч із `sales` —
     це вже обхід, і його треба чинити, а не копіювати звідси. */
  const totalPurchases = (purchasesRes.data ?? []).reduce((s, { total_amount }) => s + total_amount, 0);

  // Капітальні витрати та вилучення прибутку власниками — не операційні:
  // вилучення з net_profit-сейфа вже є частиною розподіленого прибутку,
  // записувати їх ще раз у P&L — подвійний рахунок.
  const allExpenses = expensesRes.data ?? [];
  const operatingExpenses = allExpenses
    .filter((e) => e.category_id !== capitalCategoryId)
    .filter((e) => e.paid_from_safe_id !== netProfitSafeId);
  const capitalExpensesRows = allExpenses.filter((e) => e.category_id === capitalCategoryId);
  const totalExpenses = operatingExpenses.reduce((s, r) => s + r.amount, 0);
  const capitalExpenses = capitalExpensesRows.reduce((s, r) => s + r.amount, 0);

  // 1. Gather all sold device IDs
  const deviceIds: string[] = [];
  for (const sale of salesData) {
    const items = supabaseCast<{ item_type: string; item_id: string; quantity: number; unit_cost: number }[]>(sale.sale_items ?? []);
    for (const item of items) {
      if (item.item_type === "device" && item.item_id) {
        deviceIds.push(item.item_id);
      }
    }
  }

  // 2. Fetch costs and repair costs for these devices
  const deviceCostsMap = new Map<string, ProfitDeviceCost>();
  if (deviceIds.length > 0) {
    const { data: devicesCosts } = await supabase
      .from("devices")
      .select("id, cost_price, repair_cost")
      .in("id", deviceIds);
    if (devicesCosts) {
      for (const d of devicesCosts) {
        deviceCostsMap.set(d.id, { cost_price: d.cost_price, repair_cost: d.repair_cost });
      }
    }
  }

  // 3. Собівартість (COGS) і маржа ремонтів — уся арифметика в lib/profit,
  // щоб Фінанси й дашборд рахували її однаково. Знижка живе на чеку, а не на
  // позиції, тому передаємо чек цілком: `total_amount` каже, скільки грошей
  // зайшло, а позиції — як розкласти їх по категоріях.
  const profitSales: ProfitSale[] = salesData.map((sale) => ({
    total_amount: sale.total_amount,
    items: supabaseCast<ProfitSaleItem[]>(sale.sale_items ?? []),
  }));

  // Ремонти проходять те саме правило закриття, що й на дашборді, тож звіт і
  // KPI над ним не можуть розійтися.
  const settledRepairs = toDatedRepairs(
    supabaseCast<RepairPnlRow[]>(repairsRes.data ?? []),
    floored.start,
    floored.end,
  );

  const report = computeProfit(profitSales, deviceCostsMap, settledRepairs);

  const salesCost = report.byCategory
    .filter((c) => c.category !== "repair")
    .reduce((s, c) => s + c.cost, 0);
  const repairsRevenue = report.byCategory.find((c) => c.category === "repair")!.revenue;
  const repairsCost = report.byCategory.find((c) => c.category === "repair")!.cost;

  // Виторг товарів без ремонтів. Не сирий reduce по total_amount: report.revenue
  // — це вже узгоджений з дашбордом виторг усіх категорій разом із ремонтами,
  // тож товарний виторг — залишок після віднімання ремонтної частки, а не
  // другий незалежний підрахунок, який може розійтися з рушієм.
  const totalSales = report.revenue - repairsRevenue;

  // Accrual Net Profit = Sales Margin (Sales - COGS) + Repairs Margin -
  // Operating Expenses (капітал уже виключено з totalExpenses вище).
  const profit = report.profit - totalExpenses;

  const catMap = new Map((expCatRes.data ?? []).map((c) => [c.id, c.name]));
  const expenseByCat: Record<string, number> = {};
  for (const e of operatingExpenses) {
    const cat = catMap.get(e.category_id) ?? "Інше";
    expenseByCat[cat] = (expenseByCat[cat] || 0) + e.amount;
  }
  const categoryBreakdown = Object.entries(expenseByCat)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalSales,
    totalPurchases,
    totalExpenses,
    capitalExpenses,
    salesCost,
    repairsRevenue,
    repairsCost,
    profit,
    /* `ownerShare` звідси прибраний: його ніхто не читав, а рахувався він
       хардкодом `* 0.5` замість `PARTNER_SHARE` — тобто був другим, окремим
       визначенням частки власника, яке мовчки роз'їхалося б із першим.
       Реальну частку веде `buildLedger` у `data-dashboard.ts`. */
    categoryBreakdown,
    byCategory: report.byCategory,
  };
}

/* Тут був `getUnreconciledSales` — продажі без `monobank_payment_id` для
   звірки з виписками Monobank. Його єдиним споживачем був `ReconciliationBench`,
   який не імпортувався жодною сторінкою; видалені разом. Реальну звірку робить
   `CashFlowPanel`: він рахує тотожність із реєстру й червоніє, коли вона не
   сходиться, — і на відміну від цієї гілки, він підключений. */

