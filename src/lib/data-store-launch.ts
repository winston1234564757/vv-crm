import { createClient } from "./supabase/server";
import { requireRole } from "@/lib/utils/rbac";

export async function getStoreLaunchCategories() {
  await requireRole(["owner"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_launch_categories")
    .select("*")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStoreLaunchTasks() {
  await requireRole(["owner"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_launch_tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStoreLaunchExpenses() {
  await requireRole(["owner"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_launch_expenses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStoreLaunchMilestones() {
  await requireRole(["owner"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_launch_milestones")
    .select("*")
    .order("target_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
