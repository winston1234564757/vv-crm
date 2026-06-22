import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";

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

export async function getFinanceReport() {
  const supabase = await createClient();

  const [salesRes, purchasesRes, expensesRes, expCatRes, repairsRes] = await Promise.all([
    supabase.from("sales").select("total_amount, sale_items(item_type, item_id, quantity, unit_cost)"),
    supabase.from("purchases").select("total_amount"),
    supabase.from("expenses").select("amount, category_id"),
    supabase.from("expense_categories").select("*"),
    supabase.from("repairs").select("price, cost").in("status", ["completed", "handed_over"]),
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
  const deviceCostsMap = new Map<string, { cost_price: number; repair_cost: number }>();
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

  // 3. Calculate Cost of Goods Sold (COGS) from sale_items, adding device cost + repair cost
  const salesCost = salesData.reduce((sum, sale) => {
    const items = supabaseCast<{ item_type: string; item_id: string; quantity: number; unit_cost: number }[]>(sale.sale_items ?? []);
    const itemsCost = items.reduce((itemSum, item) => {
      const qty = Number(item.quantity) || 1;
      if (item.item_type === "device" && item.item_id) {
        const dev = deviceCostsMap.get(item.item_id);
        if (dev) {
          const uCost = (dev.cost_price ?? 0) + (dev.repair_cost ?? 0);
          return itemSum + (uCost * qty);
        }
      }
      const uCost = Number(item.unit_cost) || 0;
      return itemSum + (uCost * qty);
    }, 0);
    return sum + itemsCost;
  }, 0);

  // Calculate repair margin
  const repairsData = repairsRes.data ?? [];
  const repairsRevenue = repairsData.reduce((s, r) => s + r.price, 0);
  const repairsCost = repairsData.reduce((s, r) => s + r.cost, 0);
  const repairsMargin = repairsRevenue - repairsCost;

  // Accrual Net Profit = Sales Margin (Sales - COGS) + Repairs Margin - General Expenses
  const profit = (totalSales - salesCost) + repairsMargin - totalExpenses;

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
    categoryBreakdown 
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

