"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { notifyCustomerRepairUpdate, notifyStaffNewRepair } from "@/lib/services/telegram";


type RepairUpdate = Database["public"]["Tables"]["repairs"]["Update"];

interface CustomerWithTelegram {
  telegram_id: string | null;
}

function hasCustomerTelegram(obj: unknown): obj is CustomerWithTelegram {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "telegram_id" in obj &&
    (typeof (obj as Record<string, unknown>).telegram_id === "string" ||
      (obj as Record<string, unknown>).telegram_id === null)
  );
}

const repairSchema = z.object({
  customer_id: z.string().uuid("Оберіть клієнта"),
  device_name: z.string().min(2, "Назва пристрою обов'язкова"),
  device_imei: z.string().nullable().optional(),
  issue: z.string().min(5, "Детально опишіть проблему"),
  price: z.coerce.number().min(0, "Орієнтовна вартість не може бути від'ємною"),
  warranty_months: z.coerce.number().min(0).default(3),
  notes: z.string().nullable().optional(),
  issue_nodes: z.array(z.string()).optional().default([]),
  issue_diagnostics: z.array(z.string()).optional().default([]),
  source: z.enum(["store", "online", "recommendation"]).optional().default("store"),
  device_password: z.string().nullable().optional(),
  device_accessories_included: z.string().nullable().optional(),
  device_condition: z.enum(["new", "A", "B", "C", "for_repair"]).nullable().optional(),
  device_condition_description: z.string().nullable().optional(),
  estimated_completion: z.string().nullable().optional(),
  partner_id: z.string().uuid().nullable().optional(),
  promo_code_used: z.string().nullable().optional(),
});

export async function createRepair(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      customer_id: formData.get("customer_id"),
      device_name: formData.get("device_name"),
      device_imei: formData.get("device_imei") || null,
      issue: formData.get("issue"),
      price: formData.get("price"),
      warranty_months: formData.get("warranty_months") || 3,
      notes: formData.get("notes") || null,
      issue_nodes: JSON.parse((formData.get("issue_nodes") as string) || "[]"),
      issue_diagnostics: JSON.parse((formData.get("issue_diagnostics") as string) || "[]"),
      source: formData.get("source") || "walk_in",
      device_password: formData.get("device_password") || null,
      device_accessories_included: formData.get("device_accessories_included") || null,
      device_condition: formData.get("device_condition") || null,
      device_condition_description: formData.get("device_condition_description") || null,
      estimated_completion: formData.get("estimated_completion") || null,
    };

    const parsed = repairSchema.parse(data);

    // Generate a random tracking token (e.g. 6 chars uppercase alphanumeric)
    const tracking_token = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }

    const { error } = await supabase.from("repairs").insert({
      customer_id: parsed.customer_id,
      device_name: parsed.device_name,
      device_imei: parsed.device_imei,
      issue: parsed.issue,
      price: parsed.price,
      warranty_months: parsed.warranty_months,
      notes: parsed.notes,
      issue_nodes: parsed.issue_nodes,
      issue_diagnostics: parsed.issue_diagnostics,
      source: parsed.source,
      device_password: parsed.device_password,
      device_accessories_included: parsed.device_accessories_included,
      partner_id: parsed.partner_id,
      promo_code_used: parsed.promo_code_used,
      device_condition: parsed.device_condition,
      device_condition_description: parsed.device_condition_description,
      estimated_completion: parsed.estimated_completion,
      status: "received",
      tracking_token,
    });

    if (error) throw error;

    // Load customer name for staff alert
    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("id", parsed.customer_id)
      .single();
    
    if (customer) {
      await notifyStaffNewRepair(tracking_token, parsed.device_name, parsed.issue, customer.name);
    }

    revalidatePath("/admin/repairs");
    revalidatePath("/admin");
    
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateRepairStatus(repairId: string, status: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    
    const validStatuses = [
      'received', 'diagnostics', 'in_progress', 'awaiting_parts',
      'ready', 'completed', 'handed_over', 'cancelled'
    ];
    if (!validStatuses.includes(status)) {
      throw new Error("Невалідний статус ремонту");
    }

    const updateFields: RepairUpdate = { status };
    if (status === "completed" || status === "handed_over") {
      updateFields.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("repairs")
      .update(updateFields)
      .eq("id", repairId);

    if (error) throw error;

    // Log status change
    await supabase.from("repair_status_log").insert({
      repair_id: repairId,
      to_status: status,
      notes: "Швидка зміна статусу"
    });

    // Notify customer about status update
    const { data: rep } = await supabase
      .from("repairs")
      .select("device_name, tracking_token, price, customers(telegram_id)")
      .eq("id", repairId)
      .single();
    
    const customer = hasCustomerTelegram(rep?.customers) ? rep.customers : null;
    if (customer?.telegram_id && rep?.tracking_token) {
      await notifyCustomerRepairUpdate(
        customer.telegram_id,
        rep.tracking_token,
        rep.device_name,
        status,
        rep.price
      );
    }

    revalidatePath("/admin/repairs");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const editRepairSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'received', 'diagnostics', 'in_progress', 'awaiting_parts',
    'completed', 'handed_over', 'cancelled'
  ]),
  price: z.coerce.number().min(0),
  cost: z.coerce.number().min(0),
  np_ttn: z.string().nullable().optional(),
  is_external_sc: z.coerce.boolean().optional().default(false),
  external_sc_cost: z.coerce.number().min(0).optional().default(0),
  markup_amount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().nullable().optional(),
  issue_nodes: z.array(z.string()).optional().default([]),
  issue_diagnostics: z.array(z.string()).optional().default([]),
  payment_status: z.enum(["unpaid", "paid", "partial"]).optional().default("unpaid"),
  diagnosis_result: z.string().nullable().optional(),
  technician_notes_internal: z.string().nullable().optional(),
});

export async function updateRepair(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      id: formData.get("id"),
      status: formData.get("status"),
      price: formData.get("price"),
      cost: formData.get("cost"),
      np_ttn: formData.get("np_ttn") || null,
      is_external_sc: formData.get("is_external_sc") === "true",
      external_sc_cost: formData.get("external_sc_cost") || 0,
      markup_amount: formData.get("markup_amount") || 0,
      notes: formData.get("notes") || null,
      issue_nodes: JSON.parse((formData.get("issue_nodes") as string) || "[]"),
      issue_diagnostics: JSON.parse((formData.get("issue_diagnostics") as string) || "[]"),
      payment_status: formData.get("payment_status") || "unpaid",
      diagnosis_result: formData.get("diagnosis_result") || null,
      technician_notes_internal: formData.get("technician_notes_internal") || null,
    };

    const parsed = editRepairSchema.parse(data);
    const supabase = await createClient();

    // Check old status to see if it changed
    const { data: oldRepair } = await supabase
      .from("repairs")
      .select("status")
      .eq("id", parsed.id)
      .single();

    const updateFields: RepairUpdate = {
      status: parsed.status,
      price: parsed.price,
      cost: parsed.cost,
      np_ttn: parsed.np_ttn,
      is_external_sc: parsed.is_external_sc,
      external_sc_cost: parsed.external_sc_cost,
      markup_amount: parsed.markup_amount,
      notes: parsed.notes,
      issue_nodes: parsed.issue_nodes,
      issue_diagnostics: parsed.issue_diagnostics,
      payment_status: parsed.payment_status,
      diagnosis_result: parsed.diagnosis_result,
      technician_notes_internal: parsed.technician_notes_internal,
    };

    if (parsed.status === "completed" || parsed.status === "handed_over") {
      updateFields.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("repairs")
      .update(updateFields)
      .eq("id", parsed.id);

    if (error) throw error;

    // Log status change if changed
    if (oldRepair && oldRepair.status !== parsed.status) {
      await supabase.from("repair_status_log").insert({
        repair_id: parsed.id,
        from_status: oldRepair.status,
        to_status: parsed.status,
        notes: "Оновлення картки ремонту"
      });

      // Notify customer about status update
      const { data: rep } = await supabase
        .from("repairs")
        .select("device_name, tracking_token, customers(telegram_id)")
        .eq("id", parsed.id)
        .single();
      
      const customer = hasCustomerTelegram(rep?.customers) ? rep.customers : null;
      if (customer?.telegram_id && rep?.tracking_token) {
        await notifyCustomerRepairUpdate(
          customer.telegram_id,
          rep.tracking_token,
          rep.device_name,
          parsed.status,
          parsed.price
        );
      }
    }

    revalidatePath("/admin/repairs");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
