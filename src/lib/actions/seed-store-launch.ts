"use server";

import { requireRole } from "@/lib/utils/rbac";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function seedStoreLaunchData() {
  await requireRole(["owner"]);
  const supabase = await createClient();

  // 1. Delete existing data (order matters for FKs, though mostly SET NULL)
  await supabase.from("store_launch_tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("store_launch_expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("store_launch_milestones").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("store_launch_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // 2. Insert Categories
  const categoriesToInsert = [
    { name: "Документи", budget_limit: 15000, sort_order: 1, color: "emerald" },
    { name: "Ремонт", budget_limit: 150000, sort_order: 2, color: "amber" },
    { name: "Обладнання", budget_limit: 80000, sort_order: 3, color: "sky" },
    { name: "Товар", budget_limit: 300000, sort_order: 4, color: "violet" },
    { name: "Маркетинг", budget_limit: 20000, sort_order: 5, color: "rose" },
  ];

  const { data: categories, error: catError } = await supabase
    .from("store_launch_categories")
    .insert(categoriesToInsert)
    .select();
  
  if (catError || !categories) {
    console.error("Failed to insert categories:", catError);
    return;
  }

  // Helper to get cat id by name
  const getCatId = (name: string) => categories.find(c => c.name === name)?.id;

  // 3. Insert Milestones
  const now = new Date();
  const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7);
  const nextMonth = new Date(now); nextMonth.setMonth(now.getMonth() + 1);
  const twoMonths = new Date(now); twoMonths.setMonth(now.getMonth() + 2);

  const milestonesToInsert = [
    { title: "Підписання договору оренди", target_date: now.toISOString().split('T')[0], is_completed: true },
    { title: "Завершення ремонту", target_date: nextWeek.toISOString().split('T')[0], is_completed: false },
    { title: "Завезення товару та вітрин", target_date: nextMonth.toISOString().split('T')[0], is_completed: false },
    { title: "Офіційне відкриття", target_date: twoMonths.toISOString().split('T')[0], is_completed: false },
  ];
  await supabase.from("store_launch_milestones").insert(milestonesToInsert);

  // 4. Insert Tasks
  const tasksToInsert = [
    // Done
    { title: "Укласти договір оренди", status: "done", category_id: getCatId("Документи") },
    { title: "Замовити проект електрики", status: "done", category_id: getCatId("Ремонт") },
    { title: "Оплатити перший місяць оренди", status: "done", category_id: getCatId("Документи") },
    // In Progress
    { title: "Монтаж освітлення", status: "in_progress", category_id: getCatId("Ремонт") },
    { title: "Замовлення касового апарату", status: "in_progress", category_id: getCatId("Обладнання") },
    { title: "Формування першого замовлення аксесуарів", status: "in_progress", category_id: getCatId("Товар") },
    { title: "Розробка вивіски", status: "in_progress", category_id: getCatId("Маркетинг") },
    // Todo
    { title: "Підписати договір з охороною", status: "todo", category_id: getCatId("Документи") },
    { title: "Встановити камери відеонагляду", status: "todo", category_id: getCatId("Обладнання") },
    { title: "Пофарбувати стіни (основний зал)", status: "todo", category_id: getCatId("Ремонт") },
    { title: "Замовити вітрини для телефонів", status: "todo", category_id: getCatId("Обладнання") },
    { title: "Завезти першу партію товару", status: "todo", category_id: getCatId("Товар") },
    { title: "Налаштувати CRM", status: "todo", category_id: getCatId("Обладнання") },
    { title: "Надрукувати флаєри", status: "todo", category_id: getCatId("Маркетинг") },
  ];
  await supabase.from("store_launch_tasks").insert(tasksToInsert);

  // 5. Insert Expenses
  const expensesToInsert = [
    { title: "Оренда (1 місяць + застава)", amount: 30000, category_id: getCatId("Документи"), type: "fee", status: "paid" },
    { title: "Проект електрики", amount: 3500, category_id: getCatId("Ремонт"), type: "fee", status: "paid" },
    { title: "Матеріали для ремонту (Епіцентр)", amount: 45000, category_id: getCatId("Ремонт"), type: "purchase", status: "paid" },
    { title: "Касовий апарат ПРРО", amount: 12000, category_id: getCatId("Обладнання"), type: "purchase", status: "planned" },
    { title: "Партія чохлів оптом", amount: 65000, category_id: getCatId("Товар"), type: "purchase", status: "planned" },
    { title: "Замовлення вивіски", amount: 18000, category_id: getCatId("Маркетинг"), type: "purchase", status: "planned" },
    { title: "Послуги електрика", amount: 15000, category_id: getCatId("Ремонт"), type: "fee", status: "planned" },
  ];
  await supabase.from("store_launch_expenses").insert(expensesToInsert);

  revalidatePath("/admin/store-launch");
  return { success: true };
}

export async function clearStoreLaunchData() {
  await requireRole(["owner"]);
  const supabase = await createClient();

  await supabase.from("store_launch_tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("store_launch_expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("store_launch_milestones").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("store_launch_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  revalidatePath("/admin/store-launch");
  return { success: true };
}
