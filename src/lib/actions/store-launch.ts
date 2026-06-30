"use server";

import { requireRole } from "@/lib/utils/rbac";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

export async function createStoreLaunchCategory(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const data = {
      name: formData.get("name") as string,
      color: (formData.get("color") as string) || "slate",
      budget_limit: parseInt(formData.get("budget_limit") as string || "0", 10),
      sort_order: parseInt(formData.get("sort_order") as string || "0", 10),
    };
    const { error } = await supabase.from("store_launch_categories").insert(data);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateStoreLaunchCategory(id: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const data = {
      name: formData.get("name") as string,
      color: (formData.get("color") as string) || "slate",
      budget_limit: parseInt(formData.get("budget_limit") as string || "0", 10),
    };
    const { error } = await supabase.from("store_launch_categories").update(data).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteStoreLaunchCategory(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const { error } = await supabase.from("store_launch_categories").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function createStoreLaunchTask(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const data = {
      title: formData.get("title") as string,
      status: formData.get("status") as string || "todo",
      category_id: (formData.get("category_id") as string) || null,
      assignee: (formData.get("assignee") as string) || null,
      due_date: (formData.get("due_date") as string) || null,
    };
    const { error } = await supabase.from("store_launch_tasks").insert(data);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateStoreLaunchTaskStatus(id: string, status: string): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const { error } = await supabase.from("store_launch_tasks").update({ status }).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function createStoreLaunchExpense(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const data = {
      title: formData.get("title") as string,
      amount: parseInt(formData.get("amount") as string || "0", 10),
      category_id: (formData.get("category_id") as string) || null,
      type: formData.get("type") as string || "fee",
      url: (formData.get("url") as string) || null,
      status: formData.get("status") as string || "planned",
      paid_at: (formData.get("paid_at") as string) || null,
    };
    const { error } = await supabase.from("store_launch_expenses").insert(data);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateStoreLaunchExpenseStatus(id: string, status: string): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const { error } = await supabase.from("store_launch_expenses").update({ status }).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function createStoreLaunchMilestone(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const data = {
      title: formData.get("title") as string,
      target_date: (formData.get("target_date") as string) || null,
      is_completed: formData.get("is_completed") === "true",
    };
    const { error } = await supabase.from("store_launch_milestones").insert(data);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function toggleStoreLaunchMilestone(id: string, is_completed: boolean): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const { error } = await supabase.from("store_launch_milestones").update({ is_completed }).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateStoreLaunchTask(id: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const data = {
      title: formData.get("title") as string,
      status: formData.get("status") as string || "todo",
      category_id: (formData.get("category_id") as string) || null,
      assignee: (formData.get("assignee") as string) || null,
      due_date: (formData.get("due_date") as string) || null,
    };
    const { error } = await supabase.from("store_launch_tasks").update(data).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteStoreLaunchTask(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const { error } = await supabase.from("store_launch_tasks").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateStoreLaunchExpense(id: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const data = {
      title: formData.get("title") as string,
      amount: parseInt(formData.get("amount") as string || "0", 10),
      category_id: (formData.get("category_id") as string) || null,
      type: formData.get("type") as string || "fee",
      url: (formData.get("url") as string) || null,
      status: formData.get("status") as string || "planned",
      paid_at: (formData.get("paid_at") as string) || null,
    };
    const { error } = await supabase.from("store_launch_expenses").update(data).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteStoreLaunchExpense(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const { error } = await supabase.from("store_launch_expenses").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateStoreLaunchMilestone(id: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const data = {
      title: formData.get("title") as string,
      target_date: (formData.get("target_date") as string) || null,
    };
    const { error } = await supabase.from("store_launch_milestones").update(data).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteStoreLaunchMilestone(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner"]);
    const supabase = await createClient();
    const { error } = await supabase.from("store_launch_milestones").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/store-launch");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
