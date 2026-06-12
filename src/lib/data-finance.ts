import { createClient } from "./supabase/server";

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
  const [crRes, sfRes, txRes] = await Promise.all([
    supabase.from("cash_registers").select("*"),
    supabase.from("safes").select("*"),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  const cashRegisters = crRes.data ?? [];
  const safes = sfRes.data ?? [];
  const transactions = txRes.data ?? [];

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
    };
  });

  return { cashRegisters, safes, transactions: resolved };
}

export async function getFinanceReport() {
  const supabase = await createClient();

  const [salesRes, purchasesRes, expensesRes, expCatRes] = await Promise.all([
    supabase.from("sales").select("total_amount"),
    supabase.from("purchases").select("total_amount"),
    supabase.from("expenses").select("amount, category_id"),
    supabase.from("expense_categories").select("*"),
  ]);


  const totalSales = (salesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);
  const totalPurchases = (purchasesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);
  const totalExpenses = (expensesRes.data ?? []).reduce((s, r) => s + r.amount, 0);
  const profit = totalSales - totalPurchases - totalExpenses;

  const catMap = new Map((expCatRes.data ?? []).map((c) => [c.id, c.name]));
  const expenseByCat: Record<string, number> = {};
  for (const e of expensesRes.data ?? []) {
    const cat = catMap.get(e.category_id) ?? "Інше";
    expenseByCat[cat] = (expenseByCat[cat] || 0) + e.amount;
  }
  const categoryBreakdown = Object.entries(expenseByCat)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { totalSales, totalPurchases, totalExpenses, profit, categoryBreakdown };
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

