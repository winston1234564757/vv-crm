import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import { computeProfit, type ProfitDeviceCost, type ProfitSaleItem } from "./profit";

export async function getCashRegisters() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cash_registers").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getSafes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("safes").select("*");
  if (error) throw error;
  return data ?? [];
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
    supabase.from("safes").select("*"),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("expense_categories").select("*"),
  ]);

  const cashRegisters = crRes.data ?? [];
  const safes = sfRes.data ?? [];
  const transactions = txRes.data ?? [];
  const expenseCategories = catRes.data ?? [];

  const crMap = new Map(cashRegisters.map((cr) => [cr.id, cr.name]));
  const sfMap = new Map(safes.map((sf) => [sf.id, sf.name]));

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

export async function getFinanceReport(daysBack = 30) {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);
  const startStr = startDate.toISOString();

  const [salesRes, purchasesRes, expensesRes, expCatRes, repairsRes] = await Promise.all([
    supabase.from("sales").select("total_amount, sale_items(item_type, item_id, quantity, unit_cost)").gte("created_at", startStr),
    supabase.from("purchases").select("total_amount").gte("created_at", startStr),
    supabase.from("expenses").select("amount, category_id").gte("created_at", startStr),
    supabase.from("expense_categories").select("*"),
    supabase
      .from("repairs")
      .select("price, cost, external_sc_cost")
      .is("inventory_device_id", null)
      .in("status", ["completed", "handed_over"])
      .gte("completed_at", startStr),
  ]);

  const salesData = salesRes.data ?? [];
  const totalSales = salesData.reduce((s, r) => s + r.total_amount, 0);
  const totalPurchases = (purchasesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);
  const totalExpenses = (expensesRes.data ?? []).reduce((s, r) => s + r.amount, 0);

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
  // щоб Фінанси й дашборд рахували її однаково.
  const allItems: ProfitSaleItem[] = salesData.flatMap((sale) =>
    supabaseCast<ProfitSaleItem[]>(sale.sale_items ?? []),
  );

  const report = computeProfit(allItems, deviceCostsMap, repairsRes.data ?? []);

  const salesCost = report.byCategory
    .filter((c) => c.category !== "repair")
    .reduce((s, c) => s + c.cost, 0);
  const repairsRevenue = report.byCategory.find((c) => c.category === "repair")!.revenue;
  const repairsCost = report.byCategory.find((c) => c.category === "repair")!.cost;

  // Accrual Net Profit = Sales Margin (Sales - COGS) + Repairs Margin - General Expenses
  const profit = report.profit - totalExpenses;

  const catMap = new Map((expCatRes.data ?? []).map((c) => [c.id, c.name]));
  const expenseByCat: Record<string, number> = {};
  for (const e of expensesRes.data ?? []) {
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
    salesCost,
    repairsRevenue,
    repairsCost,
    profit,
    categoryBreakdown,
    byCategory: report.byCategory,
  };
}

interface CustomerWithName {
  name: string;
}

function hasCustomerName(obj: unknown): obj is CustomerWithName {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    typeof (obj as Record<string, unknown>).name === "string"
  );
}

export async function getUnreconciledSales() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select("id, total_amount, created_at, notes, customers(name)")
    .is("monobank_payment_id", null)
    .order("created_at", { ascending: false })
    .limit(30);
    
  if (error) throw error;
  
  return (data ?? []).map(s => ({
    id: s.id,
    amount: s.total_amount,
    date: s.created_at.split("T")[0],
    notes: s.notes ?? "",
    customer_name: hasCustomerName(s.customers) ? s.customers.name : "Роздрібний покупець",
  }));
}

