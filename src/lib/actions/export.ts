"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/utils/rbac";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

/**
 * Експортує фінансові транзакції за останні N днів у форматі CSV.
 * Доступно тільки для власника або менеджера.
 */
export async function exportFinanceReport(daysBack: number = 30): Promise<ActionState<{ csvContent: string }>> {
  try {
    await requireRole(["owner", "manager"]);
    const supabase = await createClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(`
        *,
        categories:category_id (name)
      `)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    const header = "ID,Дата,Сума,Тип,Категорія,Опис\n";

    if (!transactions || transactions.length === 0) {
      return { success: true, data: { csvContent: header } };
    }

    const rows = transactions.map(t => {
      const date = new Date(t.created_at).toLocaleDateString("uk-UA");
      const amount = t.amount.toString().replace('.', ','); 
      
      let typeStr = "Інше";
      if (t.to_type === "safe" && t.from_type !== "safe") typeStr = "Дохід";
      else if (t.from_type === "safe" && t.to_type !== "safe") typeStr = "Витрата";
      else if (t.from_type === "safe" && t.to_type === "safe") typeStr = "Переказ";

      const category = (t.categories as any)?.name || "Немає";
      const desc = `"${(t.description || "").replace(/"/g, '""')}"`;

      return `${t.id},${date},${amount},${typeStr},${category},${desc}`;
    }).join("\n");

    return { success: true, data: { csvContent: header + rows } };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
