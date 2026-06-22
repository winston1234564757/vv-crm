"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { notifyCustomerRepairUpdate, notifyStaffNewRepair } from "@/lib/services/telegram";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseCast } from "@/lib/utils/supabase";


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

// Допоміжна функція для синхронізації статусу та вартості ремонту пристрою зі складу
async function syncDeviceStatus(supabase: SupabaseClient<Database>, deviceId: string | null, repairStatus: string, repairCost: number) {
  if (!deviceId) return;

  // 1. Зчитуємо поточний статус пристрою
  const { data: device, error: fetchErr } = await supabase
    .from("devices")
    .select("status, repair_cost")
    .eq("id", deviceId)
    .single();

  if (fetchErr || !device) return;

  // 2. Мапимо статус ремонту на repair_status пристрою
  let mappedRepairStatus: "pending" | "waiting_parts" | "in_progress" | "completed" = "pending";
  let needsRepair = true;

  if (["completed", "handed_over", "cancelled"].includes(repairStatus)) {
    mappedRepairStatus = "completed";
    needsRepair = false;
  } else if (repairStatus === "ready") {
    mappedRepairStatus = "completed";
    needsRepair = false; // ремонт виконано
  } else if (repairStatus === "awaiting_parts") {
    mappedRepairStatus = "waiting_parts";
  } else if (["in_progress", "diagnostics"].includes(repairStatus)) {
    mappedRepairStatus = "in_progress";
  }

  // 3. Якщо пристрій вже продано або заархівовано, не міняємо його загальний статус на складі
  if (["sold", "archived"].includes(device.status)) {
    const { error } = await supabase
      .from("devices")
      .update({
        repair_status: mappedRepairStatus,
        needs_repair: needsRepair,
        repair_cost: ["completed", "handed_over"].includes(repairStatus) ? repairCost : (repairStatus === "cancelled" ? 0 : device.repair_cost)
      })
      .eq("id", deviceId);

    if (error) throw error;
    return;
  }

  // 4. Для пристроїв в наявності/в ремонті оновлюємо загальний статус та ремонтні поля
  let deviceStatus = "service";
  let finalRepairCost = device.repair_cost;

  if (["completed", "handed_over"].includes(repairStatus)) {
    deviceStatus = "in_stock";
    finalRepairCost = repairCost;
  } else if (repairStatus === "cancelled") {
    deviceStatus = "in_stock";
    finalRepairCost = 0;
  }

  const { error } = await supabase
    .from("devices")
    .update({ 
      status: deviceStatus,
      repair_cost: finalRepairCost,
      repair_status: mappedRepairStatus,
      needs_repair: needsRepair
    })
    .eq("id", deviceId);

  if (error) throw error;
}

// Допоміжна функція для синхронізації списаних запчастин ремонту в картку пристрою на складі
async function syncDeviceReplacedParts(supabase: SupabaseClient<Database>, repairId: string) {
  // 1. Отримуємо linked inventory_device_id
  const { data: repair, error: repairErr } = await supabase
    .from("repairs")
    .select("inventory_device_id")
    .eq("id", repairId)
    .single();

  if (repairErr || !repair || !repair.inventory_device_id) return;

  // 2. Отримуємо всі запчастини, списані на цей ремонт
  const { data: repairParts, error: partsErr } = await supabase
    .from("repair_parts")
    .select(`
      quantity,
      unit_cost,
      parts (
        name,
        origin_type
      )
    `)
    .eq("repair_id", repairId);

  if (partsErr) throw partsErr;

  // 3. Форматуємо для JSONB поля пристрою
  const replacedParts = (repairParts ?? []).map((rp) => {
    const partInfo = rp.parts as any;
    return {
      name: partInfo?.name || "Невідома деталь",
      cost: rp.unit_cost,
      origin: partInfo?.origin_type || "Copy"
    };
  });

  // 4. Оновлюємо масив замінених деталей у картці пристрою
  const { error: updateErr } = await supabase
    .from("devices")
    .update({
      repair_parts_replaced: replacedParts
    })
    .eq("id", repair.inventory_device_id);

  if (updateErr) throw updateErr;
}

const repairSchema = z.object({
  customer_id: z.string().uuid("Оберіть клієнта").nullable().optional(),
  inventory_device_id: z.string().uuid("Оберіть пристрій").nullable().optional(),
  device_name: z.string().min(2, "Назва пристрою обов'язкова"),
  device_imei: z.string().nullable().optional(),
  issue: z.string().min(5, "Детально опишіть проблему"),
  price: z.coerce.number().min(0, "Орієнтовна вартість не може бути від'ємною"),
  warranty_months: z.coerce.number().min(0).default(3),
  notes: z.string().nullable().optional(),
  issue_nodes: z.array(z.string()).optional().default([]),
  issue_diagnostics: z.array(z.string()).optional().default([]),
  source: z.enum(["walk_in", "phone", "online", "marketplace"]).optional().default("walk_in"),
  device_password: z.string().nullable().optional(),
  device_accessories_included: z.string().nullable().optional(),
  device_condition: z.enum(["perfect", "good", "fair", "poor", "damaged"]).nullable().optional(),
  device_condition_description: z.string().nullable().optional(),
  estimated_completion: z.string().nullable().optional(),
  partner_id: z.string().uuid().nullable().optional(),
  promo_code_used: z.string().nullable().optional(),
  device_condition_photos: z.array(z.string()).optional().default([]),
}).refine(data => {
  return !!data.customer_id || !!data.inventory_device_id;
}, {
  message: "Оберіть клієнта або пристрій зі складу",
  path: ["customer_id"]
});

export async function createRepair(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    let customerIdInput = formData.get("customer_id") as string | null;
    if (customerIdInput === "" || customerIdInput === "null" || customerIdInput === "undefined") {
      customerIdInput = null;
    }
    let inventoryDeviceIdInput = formData.get("inventory_device_id") as string | null;
    if (inventoryDeviceIdInput === "" || inventoryDeviceIdInput === "null" || inventoryDeviceIdInput === "undefined") {
      inventoryDeviceIdInput = null;
    }

    const data = {
      customer_id: customerIdInput,
      inventory_device_id: inventoryDeviceIdInput,
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
      partner_id: formData.get("partner_id") || null,
      promo_code_used: formData.get("promo_code_used") || null,
      device_condition_photos: [], // handle below
    };

    const parsed = repairSchema.parse(data);

    // Upload photos if any
    const photoFiles = formData.getAll("device_condition_photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      const { uploadMediaFiles } = await import("@/lib/supabase/storage");
      parsed.device_condition_photos = await uploadMediaFiles(photoFiles, "repairs");
    }

    // Generate a cryptographically secure 6-char tracking token
    const tracking_token = randomBytes(3).toString("hex").toUpperCase();

    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }

    const { error } = await supabase.from("repairs").insert({
      customer_id: parsed.customer_id || null,
      inventory_device_id: parsed.inventory_device_id || null,
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
      device_condition_photos: parsed.device_condition_photos,
      estimated_completion: parsed.estimated_completion,
      status: "received",
      tracking_token,
    });

    if (error) throw error;

    // Sync warehouse device status
    if (parsed.inventory_device_id) {
      await syncDeviceStatus(supabase, parsed.inventory_device_id, "received", 0);
    }

    // Load customer name for staff alert
    if (parsed.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name")
        .eq("id", parsed.customer_id)
        .single();

      if (customer) {
        await notifyStaffNewRepair(tracking_token, parsed.device_name, parsed.issue, customer.name);
      }
    } else {
      await notifyStaffNewRepair(tracking_token, parsed.device_name, parsed.issue, "Внутрішній ремонт (Техніка на продаж)");
    }

    revalidatePath("/admin/repairs");
    revalidatePath("/admin");
    revalidatePath("/admin/devices");

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
      .select("device_name, tracking_token, price, cost, inventory_device_id, customers(telegram_id)")
      .eq("id", repairId)
      .single();

    if (rep?.inventory_device_id) {
      await syncDeviceStatus(supabase, rep.inventory_device_id, status, rep.cost || 0);
    }

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
    revalidatePath("/admin/devices");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const editRepairSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'received', 'diagnostics', 'in_progress', 'awaiting_parts',
    'ready', 'completed', 'handed_over', 'cancelled'
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

    // Check old status and inventory_device_id to see if it changed
    const { data: oldRepair } = await supabase
      .from("repairs")
      .select("status, inventory_device_id")
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

    // Sync warehouse device status if any
    if (oldRepair?.inventory_device_id) {
      await syncDeviceStatus(supabase, oldRepair.inventory_device_id, parsed.status, parsed.cost);
    }

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
    revalidatePath("/admin/devices");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function bulkUpdateRepairsStatus(ids: string[], status: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    
    const { data: repairs, error: fetchErr } = await supabase
      .from("repairs")
      .select("id, status, inventory_device_id, cost")
      .in("id", ids);
      
    if (fetchErr) throw fetchErr;

    const updatePayload: RepairUpdate = { status };
    if (status === "completed" || status === "handed_over") {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("repairs")
      .update(updatePayload)
      .in("id", ids);

    if (error) throw error;

    for (const rep of repairs || []) {
      if (rep.inventory_device_id) {
        await syncDeviceStatus(supabase, rep.inventory_device_id, status, rep.cost);
      }
      
      if (rep.status !== status) {
        await supabase.from("repair_status_log").insert({
          repair_id: rep.id,
          from_status: rep.status,
          to_status: status,
          notes: "Групове оновлення статусу"
        });
      }
    }

    revalidatePath("/admin/repairs");
    revalidatePath("/admin");
    revalidatePath("/admin/devices");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function bulkUpdateRepairsTtn(ids: string[], ttn: string | null): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("repairs")
      .update({ np_ttn: ttn })
      .in("id", ids);

    if (error) throw error;
    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const addPartSchema = z.object({
  repairId: z.string().uuid("Некоректний ID ремонту"),
  partId: z.string().uuid("Оберіть деталь зі складу"),
  quantity: z.coerce.number().int().min(1, "Кількість має бути не менше 1"),
  unitCost: z.coerce.number().min(0, "Ціна не може бути менше 0"),
});

export async function addPartToRepairAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const rawData = {
      repairId: formData.get("repairId"),
      partId: formData.get("partId"),
      quantity: formData.get("quantity"),
      unitCost: formData.get("unitCost"),
    };

    const parsed = addPartSchema.parse(rawData);
    const supabase = await createClient();

    // 1. Verify part availability
    const { data: part, error: partErr } = await supabase
      .from("parts")
      .select("stock, name")
      .eq("id", parsed.partId)
      .single();

    if (partErr || !part) {
      throw new Error("Деталь не знайдено на складі");
    }

    if (part.stock < parsed.quantity) {
      throw new Error(`Недостатньо запчастин на складі (в наявності: ${part.stock} шт)`);
    }

    // 2. Deduct stock from parts with Optimistic Locking
    const { data: updatedPart, error: updatePartErr } = await supabase
      .from("parts")
      .update({ stock: part.stock - parsed.quantity })
      .eq("id", parsed.partId)
      .eq("stock", part.stock) // optimistic lock check
      .select("id");

    if (updatePartErr) throw updatePartErr;
    if (!updatedPart || updatedPart.length === 0) {
      throw new Error("Конфлікт оновлення залишку: запчастину щойно було змінено на складі іншим користувачем. Спробуйте ще раз.");
    }

    // 3. Insert into repair_parts
    const { error: insertErr } = await supabase
      .from("repair_parts")
      .insert({
        repair_id: parsed.repairId,
        part_id: parsed.partId,
        quantity: parsed.quantity,
        unit_cost: parsed.unitCost,
      });

    if (insertErr) throw insertErr;

    // 4. Update repair total cost
    const { data: repair, error: fetchRepairErr } = await supabase
      .from("repairs")
      .select("cost")
      .eq("id", parsed.repairId)
      .single();

    if (fetchRepairErr || !repair) throw fetchRepairErr || new Error("Ремонт не знайдено");

    const newCost = (repair.cost || 0) + (parsed.unitCost * parsed.quantity);

    const { error: updateRepairErr } = await supabase
      .from("repairs")
      .update({ cost: newCost })
      .eq("id", parsed.repairId);

    if (updateRepairErr) throw updateRepairErr;

    // 5. Add status log entry
    await supabase.from("repair_status_log").insert({
      repair_id: parsed.repairId,
      to_status: "in_progress",
      notes: `Додано деталь зі складу: ${part.name} (${parsed.quantity} шт) на суму ${parsed.unitCost * parsed.quantity} грн`
    });

    // Синхронізуємо деталі в картку пристрою на складі
    await syncDeviceReplacedParts(supabase, parsed.repairId);

    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function removePartFromRepairAction(repairPartId: string): Promise<ActionState> {
  try {
    const supabase = await createClient();

    // 1. Get allocated part info
    const { data: repairPart, error: fetchErr } = await supabase
      .from("repair_parts")
      .select("repair_id, part_id, quantity, unit_cost, parts(name)")
      .eq("id", repairPartId)
      .single();

    if (fetchErr || !repairPart) {
      throw new Error("Запис про списану деталь не знайдено");
    }

    const partName = supabaseCast<{ name: string }>(repairPart.parts)?.name || "Деталь";

    // 2. Restore stock level with Optimistic Locking
    const { data: part, error: partErr } = await supabase
      .from("parts")
      .select("stock")
      .eq("id", repairPart.part_id)
      .single();

    if (partErr || !part) throw partErr || new Error("Деталь на складі не знайдено");

    const { data: updatedPart, error: updatePartErr } = await supabase
      .from("parts")
      .update({ stock: part.stock + repairPart.quantity })
      .eq("id", repairPart.part_id)
      .eq("stock", part.stock) // optimistic lock check
      .select("id");

    if (updatePartErr) throw updatePartErr;
    if (!updatedPart || updatedPart.length === 0) {
      throw new Error("Конфлікт оновлення залишку: запчастину щойно було змінено на складі іншим користувачем. Спробуйте ще раз.");
    }

    // 3. Delete from repair_parts
    const { error: deleteErr } = await supabase
      .from("repair_parts")
      .delete()
      .eq("id", repairPartId);

    if (deleteErr) throw deleteErr;

    // 4. Decrease repair cost
    const { data: repair, error: fetchRepairErr } = await supabase
      .from("repairs")
      .select("cost")
      .eq("id", repairPart.repair_id)
      .single();

    if (fetchRepairErr || !repair) throw fetchRepairErr || new Error("Ремонт не знайдено");

    const newCost = Math.max(0, (repair.cost || 0) - (repairPart.unit_cost * repairPart.quantity));

    const { error: updateRepairErr } = await supabase
      .from("repairs")
      .update({ cost: newCost })
      .eq("id", repairPart.repair_id);

    if (updateRepairErr) throw updateRepairErr;

    // 5. Add status log entry
    await supabase.from("repair_status_log").insert({
      repair_id: repairPart.repair_id,
      to_status: "in_progress",
      notes: `Вилучено деталь: ${partName} (${repairPart.quantity} шт). Повернуто на склад.`
    });

    // Синхронізуємо деталі в картку пристрою на складі
    await syncDeviceReplacedParts(supabase, repairPart.repair_id);

    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteRepair(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();

    // 1. Get repair info (to check if there is a linked inventory device)
    const { data: repair, error: fetchErr } = await supabase
      .from("repairs")
      .select("inventory_device_id")
      .eq("id", id)
      .single();

    if (fetchErr || !repair) {
      throw new Error("Ремонт не знайдено");
    }

    // 2. Retrieve all allocated parts for this repair
    const { data: allocatedParts, error: partsErr } = await supabase
      .from("repair_parts")
      .select("part_id, quantity")
      .eq("repair_id", id);

    if (partsErr) throw partsErr;

    // 3. Return all allocated parts back to warehouse stock
    if (allocatedParts && allocatedParts.length > 0) {
      for (const item of allocatedParts) {
        const { data: part, error: partErr } = await supabase
          .from("parts")
          .select("stock")
          .eq("id", item.part_id)
          .single();

        if (!partErr && part) {
          await supabase
            .from("parts")
            .update({ stock: part.stock + item.quantity })
            .eq("id", item.part_id);
        }
      }
    }

    // 4. Update warehouse device status if one was linked to this repair
    if (repair.inventory_device_id) {
      const { data: dev } = await supabase
        .from("devices")
        .select("status")
        .eq("id", repair.inventory_device_id)
        .single();

      if (dev) {
        const updatePayload: any = {
          repair_cost: 0,
          needs_repair: false,
          repair_status: "completed"
        };

        if (!["sold", "archived"].includes(dev.status)) {
          updatePayload.status = "in_stock";
        }

        const { error: deviceErr } = await supabase
          .from("devices")
          .update(updatePayload)
          .eq("id", repair.inventory_device_id);

        if (deviceErr) throw deviceErr;
      }
    }

    // 5. Delete the main repair record (repair_status_log and repair_parts delete cascade)
    const { error: deleteErr } = await supabase
      .from("repairs")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    // 6. Revalidate all dependent routes
    revalidatePath("/admin/repairs");
    revalidatePath("/admin/devices");
    revalidatePath("/admin");

    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}


