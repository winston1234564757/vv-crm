"use server";
import { requireRole } from "@/lib/utils/rbac";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { uploadMediaFiles } from "@/lib/supabase/storage";
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

  /* 2. Мапимо статус ремонту на repair_status пристрою.
     Увага: `completed` тут зустрічається у двох різних значеннях. У списках
     нижче це архівний статус рядка ремонту (живих не лишилось, тримаємо заради
     старих даних), а в типі `mappedRepairStatus` — окремий словник
     `devices.repair_status`, який ніхто не скасовував.
     Складський ремонт закривається вже на `ready`: пристрій полагоджено й він
     повертається в наявність — видавати його нема кому. */
  let mappedRepairStatus: "pending" | "waiting_parts" | "in_progress" | "completed" = "pending";
  let needsRepair = true;

  if (["handed_over", "cancelled", "ready", "completed"].includes(repairStatus)) {
    mappedRepairStatus = "completed";
    needsRepair = false;
  } else if (repairStatus === "awaiting_parts") {
    mappedRepairStatus = "waiting_parts";
  } else if (["in_progress", "diagnostics", "received"].includes(repairStatus)) {
    mappedRepairStatus = "in_progress";
  }

  // 3. Якщо пристрій вже продано або заархівовано, не міняємо його загальний статус на складі
  if (["sold", "archived"].includes(device.status)) {
    const { error } = await supabase
      .from("devices")
      .update({
        repair_status: mappedRepairStatus,
        needs_repair: needsRepair,
        repair_cost: ["completed", "handed_over", "ready"].includes(repairStatus) ? repairCost : (repairStatus === "cancelled" ? 0 : device.repair_cost)
      })
      .eq("id", deviceId);

    if (error) throw error;
    return;
  }

  // 4. Для пристроїв в наявності/в ремонті оновлюємо загальний статус та ремонтні поля
  let deviceStatus = "service";
  let finalRepairCost = device.repair_cost;

  if (["completed", "handed_over", "ready"].includes(repairStatus)) {
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
        origin_type,
        id
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
      origin: partInfo?.origin_type || "Copy",
      part_id: partInfo?.id || null
    };
  });

  // Рахуємо повну собівартість деталей
  const totalPartsCost = (repairParts ?? []).reduce((sum, rp) => sum + (rp.unit_cost * rp.quantity), 0);

  // Отримуємо поточні ручні деталі з пристрою
  const { data: currentDev } = await supabase
    .from("devices")
    .select("repair_parts_replaced")
    .eq("id", repair.inventory_device_id)
    .single();

  const currentParts = (currentDev?.repair_parts_replaced as unknown as Array<{ name: string; cost: number; origin: string; part_id?: string | null }>) || [];
  const manualParts = currentParts.filter(p => !p.part_id);
  const manualPartsCost = manualParts.reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
  const finalCost = totalPartsCost + manualPartsCost;

  // Об'єднаний список деталей (ручні + списані зі складу)
  const finalReplacedParts = [...manualParts, ...replacedParts];

  // 4. Оновлюємо масив замінених деталей та вартість ремонту в картці пристрою
  const { error: updateErr } = await supabase
    .from("devices")
    .update({
      repair_parts_replaced: finalReplacedParts,
      repair_cost: finalCost
    })
    .eq("id", repair.inventory_device_id);

  if (updateErr) throw updateErr;

  // 5. Синхронізуємо вартість ремонту в самій картці ремонту
  const { error: updateRepairErr } = await supabase
    .from("repairs")
    .update({
      cost: finalCost
    })
    .eq("id", repairId);

  if (updateRepairErr) throw updateRepairErr;
}

const repairSchema = z.object({
  is_warranty: z.boolean().optional().default(false),
  customer_id: z.string().uuid("Оберіть клієнта").nullable().optional(),
  inventory_device_id: z.string().uuid("Оберіть пристрій").nullable().optional(),
  device_name: z.string().min(2, "Назва пристрою обов'язкова"),
  device_imei: z.string().nullable().optional(),
  issue: z.string().min(2, "Вкажіть, що з пристроєм"),
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
  warranty_for_repair_id: z.string().uuid().nullable().optional(),
}).refine(data => {
  return !!data.customer_id || !!data.inventory_device_id;
}, {
  message: "Оберіть клієнта або пристрій зі складу",
  path: ["customer_id"]
});

export async function createRepair(prevState: ActionState | null, formData: FormData): Promise<ActionState<{ id: string, tracking_token: string, public_token: string, issue: string, price: number }>> {
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
      is_warranty: formData.get("is_warranty") === "true",
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
      warranty_for_repair_id: formData.get("warranty_for_repair_id") || null,
    };

    const parsed = repairSchema.parse(data);
    if (parsed.is_warranty) parsed.price = 0;

    // Upload photos if any
    const photoFiles = formData.getAll("device_condition_photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      parsed.device_condition_photos = await uploadMediaFiles(photoFiles, "repairs");
    }

    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }

    const { data: newRepair, error } = await supabase.from("repairs").insert({
      customer_id: parsed.customer_id || null,
      inventory_device_id: parsed.inventory_device_id || null,
      is_warranty: parsed.is_warranty,
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
      warranty_for_repair_id: parsed.warranty_for_repair_id,
      status: "received",
      /* Хто прийняв — той і майстер: у `repairs` немає `created_by`, тож
         `assigned_to` це єдиний слід людини на ремонті. Поле не заповнювалось
         НІКОЛИ, і через це аналітика продажів зводила виторг усіх ремонтів у
         рядок «Невідомо» — не збій даних, а порожня колонка. */
      assigned_to: user.id,
    }).select("id, tracking_token, public_token").single();

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
        await notifyStaffNewRepair(newRepair.tracking_token as string, parsed.device_name, parsed.issue, customer.name);
      }
    } else {
      await notifyStaffNewRepair(newRepair.tracking_token as string, parsed.device_name, parsed.issue, "Внутрішній ремонт (Техніка на продаж)");
    }

    revalidatePath("/admin/repairs");
    revalidatePath("/admin");
    revalidatePath("/admin/devices");

    return { success: true, data: { id: newRepair.id, tracking_token: newRepair.tracking_token as string, public_token: newRepair.public_token as string, issue: parsed.issue, price: parsed.price } };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateRepairStatus(repairId: string, status: string): Promise<ActionState> {
  try {
    const supabase = await createClient();

    const validStatuses = [
      'received', 'diagnostics', 'in_progress', 'awaiting_parts',
      'ready', 'handed_over', 'cancelled'
    ];
    if (!validStatuses.includes(status)) {
      throw new Error("Невалідний статус ремонту");
    }

    const updateFields: RepairUpdate = { status };
    if (status === "handed_over") {
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
      .select("device_name, public_token, price, cost, inventory_device_id, customers(telegram_id)")
      .eq("id", repairId)
      .single();

    if (rep?.inventory_device_id) {
      await syncDeviceStatus(supabase, rep.inventory_device_id, status, rep.cost || 0);
    }

    const customer = hasCustomerTelegram(rep?.customers) ? rep.customers : null;
    if (customer?.telegram_id && rep?.public_token) {
      await notifyCustomerRepairUpdate(
        customer.telegram_id,
        rep.public_token,
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
  is_warranty: z.boolean().optional().default(false),
  id: z.string().uuid(),
  issue: z.string().min(2, "Вкажіть несправність").optional(),
  status: z.enum([
    'received', 'diagnostics', 'in_progress', 'awaiting_parts',
    'ready', 'handed_over', 'cancelled'
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
  // payment_status is deliberately absent: it is a cache of the payment
  // ledger, maintained by pay_repair / refund_repair_payment. Letting the edit
  // form write it directly is what allowed a repair to read "Оплачено" with no
  // money behind it — the exact defect this slice removes.
  diagnosis_result: z.string().nullable().optional(),
  technician_notes_internal: z.string().nullable().optional(),
});

export async function updateRepair(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      id: formData.get("id"),
      issue: formData.get("issue"),
      is_warranty: formData.get("is_warranty") === "true",
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
      diagnosis_result: formData.get("diagnosis_result") || null,
      technician_notes_internal: formData.get("technician_notes_internal") || null,
    };

    const parsed = editRepairSchema.parse(data);
    if (parsed.is_warranty) parsed.price = 0;
    const supabase = await createClient();

    // Check old status and inventory_device_id to see if it changed
    const { data: oldRepair } = await supabase
      .from("repairs")
      .select("status, inventory_device_id")
      .eq("id", parsed.id)
      .single();

    const updateFields: RepairUpdate = {
      is_warranty: parsed.is_warranty,
      issue: parsed.issue,
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
      diagnosis_result: parsed.diagnosis_result,
      technician_notes_internal: parsed.technician_notes_internal,
    };

    /* Тільки на видачі. Раніше дата ставилась і на «Виконано», і на «Видано»,
       тож друга дія затирала першу — а дашборд розкладає прибуток по періодах
       саме за `completed_at`, і виторг переїжджав у день видачі. Тепер це один
       момент: коли клієнт забрав. */
    if (parsed.status === "handed_over") {
      updateFields.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("repairs")
      .update(updateFields)
      .eq("id", parsed.id);

    if (error) throw error;

    // The price may have moved, which changes what "fully paid" means. The
    // ledger is unchanged, so recompute the cached label from it rather than
    // leaving a repair marked paid against a price it no longer has.
    await recalcRepairPaymentStatus(supabase, parsed.id, parsed.price, oldRepair?.inventory_device_id ?? null);

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
        .select("device_name, public_token, customers(telegram_id)")
        .eq("id", parsed.id)
        .single();

      const customer = hasCustomerTelegram(rep?.customers) ? rep.customers : null;
      if (customer?.telegram_id && rep?.public_token) {
        await notifyCustomerRepairUpdate(
          customer.telegram_id,
          rep.public_token,
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
    if (status === "handed_over") {
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
  /* Ціна для клієнта. Необов'язкова: форма редагування ремонту її не питає, і
     тоді RPC сам візьме ціну з каталогу, а як і її нема — собівартість. */
  unitPrice: z.coerce.number().min(0, "Ціна не може бути менше 0").nullable().optional(),
});

export async function addPartToRepairAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const rawData = {
      repairId: formData.get("repairId"),
      partId: formData.get("partId"),
      quantity: formData.get("quantity"),
      unitCost: formData.get("unitCost"),
      unitPrice: formData.get("unitPrice") ?? null,
    };

    const parsed = addPartSchema.parse(rawData);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || "User not found"));

    // 1. Execute ATOMIC RPC to safely deduct stock, add to repair, and log status
    // @ts-expect-error - add_part_to_repair is missing from database.ts types
    const { error: rpcErr } = await supabase.rpc("add_part_to_repair", {
      p_repair_id: parsed.repairId,
      p_part_id: parsed.partId,
      p_quantity: parsed.quantity,
      p_unit_cost: parsed.unitCost,
      p_user_id: user.id,
      p_unit_price: parsed.unitPrice ?? null
    });

    if (rpcErr) throw rpcErr;

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || "User not found"));

    // 1. Get allocated part info (needed for sync afterwards)
    const { data: repairPart, error: fetchErr } = await supabase
      .from("repair_parts")
      .select("repair_id")
      .eq("id", repairPartId)
      .single();

    if (fetchErr || !repairPart) {
      throw new Error("Запис про списану деталь не знайдено");
    }

    // 2. Execute ATOMIC RPC to safely restore stock, remove from repair, and log status
    // @ts-expect-error - remove_part_from_repair is missing from database.ts types
    const { error: rpcErr } = await supabase.rpc("remove_part_from_repair", {
      p_repair_part_id: repairPartId,
      p_user_id: user.id
    });

    if (rpcErr) throw rpcErr;

    // Синхронізуємо деталі в картку пристрою на складі
    await syncDeviceReplacedParts(supabase, repairPart.repair_id);

    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const addServiceSchema = z.object({
  repairId: z.string().uuid(),
  serviceId: z.string().uuid().nullable().optional(),
  name: z.string().min(1, "Вкажіть назву послуги"),
  price: z.coerce.number().min(0, "Ціна має бути >= 0"),
  cost: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().int().min(1).default(1),
});

export async function addServiceToRepairAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const rawData = {
      repairId: formData.get("repairId"),
      serviceId: formData.get("serviceId") ? String(formData.get("serviceId")) : null,
      name: formData.get("name"),
      price: formData.get("price"),
      cost: formData.get("cost") || 0,
      quantity: formData.get("quantity") || 1,
    };

    const parsed = addServiceSchema.parse(rawData);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || "User not found"));

    const { error: insertErr } = await supabase
      .from("repair_services")
      .insert({
        repair_id: parsed.repairId,
        service_id: parsed.serviceId,
        name: parsed.name,
        price: parsed.price,
        cost: parsed.cost,
        quantity: parsed.quantity,
      });

    if (insertErr) throw insertErr;

    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function removeServiceFromRepairAction(repairServiceId: string): Promise<ActionState> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || "User not found"));

    const { error: delErr } = await supabase
      .from("repair_services")
      .delete()
      .eq("id", repairServiceId);

    if (delErr) throw delErr;

    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteRepair(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
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



// --- Warranty Flow Search ---
export async function searchCompletedRepairs(customerId?: string | null, searchQuery?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("repairs")
    .select(`
      id,
      device_name,
      device_imei,
      issue,
      created_at,
      completed_at,
      warranty_months,
      customer:customers(id, name, phone)
    `)
    .in("status", ["completed", "handed_over", "ready"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (customerId) {
    query = query.eq("customer_id", customerId);
  } else if (searchQuery && searchQuery.trim().length > 1) {
    const term = `%${searchQuery.trim()}%`;
    query = query.or(`device_name.ilike.${term},device_imei.ilike.${term},issue.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("searchCompletedRepairs error:", error);
    return [];
  }
  return data;
}

/**
 * Recomputes the cached `payment_status` from the payment ledger.
 *
 * `repairs.payment_status` is a label; the transactions carrying
 * `reference_type = 'repair_payment'` are the truth. Anything that can change
 * either side — a payment, a refund, or an edit to the price — has to call
 * this, otherwise the label drifts, which is how a repair came to read
 * "unpaid" after being handed over for 1800 UAH.
 */
async function recalcRepairPaymentStatus(
  supabase: SupabaseClient<Database>,
  repairId: string,
  price: number,
  inventoryDeviceId: string | null,
) {
  // Складський ремонт нікому не виставляють: його `price` — це внутрішня
  // вартість, а не дебіторка. Без цього винятку кожен такий ремонт назавжди
  // лишався `unpaid` і додавав неіснуючий борг до підсумків.
  //
  // `inventoryDeviceId` приходить від виклику, а не з повторного SELECT —
  // єдиний викликач (`updateRepair`) уже має `oldRepair.inventory_device_id`
  // під рукою, тож другий похід у базу за тим самим значенням був би зайвим.
  if (inventoryDeviceId) {
    await supabase
      .from("repairs")
      .update({ payment_status: null, paid_at: null })
      .eq("id", repairId);
    return;
  }

  const { data: payments, error } = await supabase
    .from("transactions")
    .select("amount, created_at")
    .eq("reference_type", "repair_payment")
    .eq("reference_id", repairId);

  if (error) return;

  const rows = payments ?? [];
  const paid = rows.reduce((s, p) => s + p.amount, 0);
  const status = paid <= 0 ? "unpaid" : paid >= price ? "paid" : "partial";

  /* `paid_at` — дата, коли борг закрився, і вона мусить рухатись разом зі
     статусом: ціну ремонту тут щойно могли підняти (борг з'явився знову) або
     опустити до вже сплаченої суми.

     У P&L ця дата більше не якір — виторг ремонту визнається на видачі
     (`repairSettledAt`). Тут вона лишається як факт про гроші: коли саме за
     ремонт розрахувались.

     Береться з самих платежів, а не `NOW()`: гроші прийшли тоді, коли прийшли,
     і правка ціни заднім числом не має переносити цю дату в сьогодні. */
  const paidAt =
    status === "paid"
      ? rows.reduce<string | null>(
          (max, p) => (!max || p.created_at > max ? p.created_at : max),
          null,
        )
      : null;

  await supabase
    .from("repairs")
    .update({ payment_status: status, paid_at: paidAt })
    .eq("id", repairId);
}

/**
 * Takes a payment against a repair: money into the till, a row in the ledger,
 * and the cached status recomputed — all inside one Postgres function so a
 * failure cannot leave the money half-recorded.
 *
 * Any authenticated user may do this: whoever is behind the counter takes the
 * cash. Reversing it is restricted — see `refundRepairPayment`.
 */
export async function payRepair(
  repairId: string,
  cashRegisterId: string,
  amount: number,
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || ""));

    const { error } = await supabase.rpc("pay_repair", {
      p_repair_id: repairId,
      p_cash_register_id: cashRegisterId,
      p_amount: Math.round(amount),
      p_user_id: user.id,
    });
    if (error) throw error;

    revalidatePath("/admin/repairs");
    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

/**
 * Reverses one repair payment: takes it back out of the till, removes the
 * ledger row and recomputes the status.
 *
 * Restricted to owner/manager, matching `deleteTransactionAction` — taking
 * money in is counter work, correcting someone's mistake is not.
 */
export async function refundRepairPayment(transactionId: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
    const supabase = await createClient();

    const { error } = await supabase.rpc("refund_repair_payment", {
      p_transaction_id: transactionId,
    });
    if (error) throw error;

    revalidatePath("/admin/repairs");
    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

/**
 * Starts a repair on a device the shop owns.
 *
 * This replaces the "Внутрішній (Склад)" toggle on the intake form, which was
 * the source of every orphaned repair row: it wrote `inventory_device_id`, and
 * all three read paths in `data-repairs.ts` filter exactly those rows out, so
 * the record vanished from the page it was created on. Started from the device
 * instead, the result is visible immediately — `deviceStage` reads an open
 * repair row as the `in_repair` stage.
 *
 * Deliberately narrow: a warehouse repair has no customer, no warranty, no
 * receipt and no condition photos — the device is already photographed in its
 * own card.
 */
export async function createWarehouseRepair(
  deviceId: string,
  issue: string,
  estimatedCost: number,
): Promise<ActionState> {
  try {
    const supabase = await createClient();

    const { data: device, error: devErr } = await supabase
      .from("devices")
      .select("id, brand, model, imei")
      .eq("id", deviceId)
      .single();
    if (devErr || !device) throw new Error("Пристрій не знайдено");

    const trimmed = issue.trim();
    if (trimmed.length < 5) throw new Error("Опишіть, що саме ремонтуємо (від 5 символів)");

    const deviceName = [device.brand, device.model].filter(Boolean).join(" ") || "Пристрій";

    const { error } = await supabase.from("repairs").insert({
      inventory_device_id: device.id,
      customer_id: null,
      device_name: deviceName,
      device_imei: device.imei,
      issue: trimmed,
      status: "received",
      price: 0,
      cost: Math.max(0, Math.round(estimatedCost)),
      warranty_months: 0,
      source: "walk_in",
    });
    if (error) throw error;

    // Keep the device card in step with the repair row it now has.
    await supabase
      .from("devices")
      .update({ needs_repair: true, repair_status: "in_progress" })
      .eq("id", device.id);

    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
