import { createClient } from "./supabase/server";

function todayRange() {
  const s = new Date();
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return { start: s.toISOString(), end: e.toISOString() };
}

function nDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getDashboardStats() {
  const supabase = await createClient();

  const { start, end } = todayRange();
  const weekAgo = nDaysAgo(7);

  const [
    todaySalesRes, newCustomersRes, weeklySalesRes,
    recentSalesRes, repairStatusesRes, totalSalesRes,
  ] = await Promise.all([
    supabase.from("sales").select("total_amount").gte("created_at", start).lt("created_at", end),
    supabase.from("customers").select("id").gte("created_at", start).lt("created_at", end),
    supabase.from("sales").select("total_amount, created_at").gte("created_at", weekAgo),
    supabase.from("sales").select("id, total_amount, created_at, customers(name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("repairs").select("status"),
    supabase.from("sales").select("total_amount"),
  ]);

  const { data: activeRepairsData } = await supabase
    .from("repairs")
    .select("id, status")
    .not("status", "in", '("completed","handed_over","cancelled")');

  const { data: allAcc } = await supabase.from("accessories").select("name, stock, min_stock");
  const alerts = (allAcc ?? []).filter((a) => a.stock <= a.min_stock).map((a) => ({
    item: a.name, stock: a.stock, urgent: a.stock === 0,
  }));

  const dayTotals: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    dayTotals[d.toISOString().split("T")[0]] = 0;
  }
  for (const s of weeklySalesRes.data ?? []) {
    const day = (s.created_at as string).split("T")[0];
    if (day in dayTotals) dayTotals[day] += (s.total_amount as number);
  }

  const todaySalesTotal = (todaySalesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);
  const activeRepairs = activeRepairsData?.length ?? 0;
  const newCustomers = newCustomersRes.data?.length ?? 0;
  const awaitingParts = (repairStatusesRes.data ?? []).filter((r) => r.status === "awaiting_parts").length;
  const totalSales = (totalSalesRes.data ?? []).reduce((s, r) => s + r.total_amount, 0);

  const statusCounts: Record<string, number> = {};
  for (const r of repairStatusesRes.data ?? []) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  return {
    todaySalesTotal,
    activeRepairs,
    newCustomers,
    awaitingParts,
    weeklySales: Object.values(dayTotals),
    weeklyDays: Object.keys(dayTotals).map((d) => {
      const date = new Date(d + "T12:00:00");
      return date.toLocaleDateString("uk-UA", { weekday: "short" });
    }),
    recentSales: (recentSalesRes.data ?? []).map((s) => ({
      id: s.id,
      item: "Продаж",
      customer: ((s as unknown as { customers: { name: string } | null }).customers?.name) ?? "—",
      amount: s.total_amount,
      time: new Date(s.created_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }),
    })),
    alerts,
    totalSales,
  };
}
