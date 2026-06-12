import { createClient } from "./supabase/server";

export async function getReportsData() {
  const supabase = await createClient();

  const [salesRes, itemsRes, devicesRes, accessoriesRes] = await Promise.all([
    supabase.from("sales").select("total_amount, created_at").order("created_at", { ascending: false }),
    supabase.from("sale_items").select("item_type, item_id, total_price, quantity, sales!inner(created_at)"),
    supabase.from("devices").select("id, brand, model"),
    supabase.from("accessories").select("id, name"),
  ]);


  const sales = salesRes.data ?? [];
  const items = itemsRes.data ?? [];

  const monthlyMap: Record<string, number> = {};
  for (const s of sales) {
    const mon = (s.created_at as string).substring(0, 7);
    monthlyMap[mon] = (monthlyMap[mon] || 0) + s.total_amount;
  }
  const monthlyRevenue = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6);

  const monthNames = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
  const months = monthlyRevenue.map(([m]) => monthNames[parseInt(m.split("-")[1]) - 1] || m);
  const revenue = monthlyRevenue.map(([, v]) => v);

  const catMap: Record<string, number> = {};
  for (const it of items) {
    catMap[it.item_type] = (catMap[it.item_type] || 0) + it.total_price;
  }
  const totalCat = Object.values(catMap).reduce((s, v) => s + v, 0) || 1;

  const deviceNames = new Map((devicesRes.data ?? []).map((d) => [d.id, `${d.brand} ${d.model}`]));
  const accNames = new Map((accessoriesRes.data ?? []).map((a) => [a.id, a.name]));

  const sellerMap: Record<string, { sold: number; revenue: number }> = {};
  for (const it of items) {
    const name = it.item_type === "device"
      ? (deviceNames.get(it.item_id) ?? "Товар")
      : (accNames.get(it.item_id) ?? "Аксесуар");
    if (!sellerMap[name]) sellerMap[name] = { sold: 0, revenue: 0 };
    sellerMap[name].sold += it.quantity;
    sellerMap[name].revenue += it.total_price;
  }
  const topSellers = Object.entries(sellerMap)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categoryLabels: Record<string, string> = {
    device: "Техніка", accessory: "Аксесуари", part: "Запчастини",
  };
  const categoryColors: Record<string, string> = {
    device: "var(--color-violet)", accessory: "var(--color-cyan)", part: "var(--color-amber)",
  };
  const categories = Object.entries(catMap).map(([type, amount]) => ({
    name: categoryLabels[type] || type,
    amount,
    color: categoryColors[type] || "var(--color-iris)",
    pct: Math.round((amount / totalCat) * 100),
  }));

  const totalRevenue = sales.reduce((s, r) => s + r.total_amount, 0);
  const avgCheck = sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0;

  return {
    monthlyRevenue: revenue, months, totalRevenue, avgCheck,
    transactionCount: sales.length, categories, topSellers,
  };
}
