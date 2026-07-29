"use server";
import { requireRole } from "@/lib/utils/rbac";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { uploadMediaFiles } from "@/lib/supabase/storage";

type DeviceUpdate = Database["public"]["Tables"]["devices"]["Update"];
type AccessoryInsert = Database["public"]["Tables"]["accessories"]["Insert"];
type AccessoryUpdate = Database["public"]["Tables"]["accessories"]["Update"];
type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];


const deviceSchema = z.object({
  // Сейф тримає дві половини, і закупівля мусить сказати, з якої брати.
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
  type: z.enum(["phone", "tablet", "laptop", "watch", "other"]),
  brand: z.string().min(1, "Бренд обов'язковий"),
  model: z.string().min(1, "Модель обов'язкова"),
  imei: z.string().nullable().optional(),
  price: z.coerce.number().min(0, "Ціна не може бути від'ємною"),
  cost_price: z.coerce.number().min(0, "Собівартість не може бути від'ємною"),
  ram: z.string().nullable().optional(),
  storage: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  battery_health: z.coerce.number().min(0).max(100).nullable().optional(),
  screen_size: z.string().nullable().optional(),
  cpu: z.string().nullable().optional(),
  gpu: z.string().nullable().optional(),
  needs_repair: z.coerce.boolean().optional().default(false),
  repair_node: z.string().nullable().optional(),
  repair_cost: z.coerce.number().min(0).optional().default(0),
  repair_np_ttn: z.string().nullable().optional(),
  repair_status: z.enum(["pending", "waiting_parts", "in_progress", "completed"]).optional().default("pending"),
  repair_parts_replaced: z.array(
    z.object({
      name: z.string(),
      cost: z.number(),
      origin: z.string(),
      part_id: z.string().nullable().optional()
    })
  ).optional().default([]),
  description: z.string().nullable().optional(),
  is_visible: z.coerce.boolean().optional().default(false),
  source: z.enum(["supplier", "trade_in", "buyout", "olx", "customer_return"]).optional().default("supplier"),
  source_reference: z.string().nullable().optional(),
  purchased_from: z.string().nullable().optional(),
  condition_grade: z.enum(["perfect", "good", "fair", "poor", "damaged"]).optional().default("good"),
  condition_description: z.string().nullable().optional(),
  original_box: z.coerce.boolean().optional().default(false),
  accessories_included: z.string().nullable().optional(),
  serial_number: z.string().nullable().optional(),
  warehouse_location: z.string().nullable().optional(),
  photo_urls: z.array(z.string()).optional().default([]),
});

export async function createDevice(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const rawParts = formData.get("repair_parts_replaced");
    let parsedParts = [];
    try {
      parsedParts = rawParts ? JSON.parse(rawParts as string) : [];
    } catch {
      // silently ignore invalid JSON — defaults to empty array
    }

    const data = {
      type: formData.get("type"),
      brand: formData.get("brand"),
      model: formData.get("model"),
      imei: formData.get("imei") || null,
      price: formData.get("price"),
      cost_price: formData.get("cost_price"),
      ram: formData.get("ram") || null,
      storage: formData.get("storage") || null,
      color: formData.get("color") || null,
      battery_health: formData.get("battery_health") || null,
      screen_size: formData.get("screen_size") || null,
      cpu: formData.get("cpu") || null,
      gpu: formData.get("gpu") || null,
      needs_repair: formData.get("needs_repair") === "true",
      repair_node: formData.get("repair_node") || null,
      repair_cost: formData.get("repair_cost") || 0,
      repair_np_ttn: formData.get("repair_np_ttn") || null,
      repair_status: formData.get("repair_status") || "pending",
      repair_parts_replaced: parsedParts,
      description: formData.get("description") || null,
      is_visible: formData.get("is_visible") === "true",
      source: formData.get("source") || "supplier",
      source_reference: formData.get("source_reference") || null,
      purchased_from: formData.get("purchased_from") || null,
      condition_grade: formData.get("condition_grade") || "good",
      condition_description: formData.get("condition_description") || null,
      original_box: formData.get("original_box") === "true",
      accessories_included: formData.get("accessories_included") || null,
      serial_number: formData.get("serial_number") || null,
      warehouse_location: formData.get("warehouse_location") || null,
      photo_urls: [], // will be handled after parsing
    };

    const parsed = deviceSchema.parse(data);

    // Upload photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      parsed.photo_urls = await uploadMediaFiles(photoFiles, "devices");
    }

    const supabase = await createClient();

    // Get current user profile for logging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Неавторизовано: " + (authError?.message || "Користувач не знайдений"));
    }

    // 1. Determine safe
    const safeId = formData.get("safe_id") as string | null;
    let chosenSafeId = safeId;
    if (!chosenSafeId && parsed.cost_price > 0) {
      const { data: opexSafe } = await supabase
        .from("safes")
        .select("id")
        .eq("type", "opex")
        .single();
      chosenSafeId = opexSafe?.id ?? null;
    }

    // 2. Execute ATOMIC RPC for Device Purchase
    // @ts-expect-error - register_device_purchase is missing from database.ts types
    const { data: insertedId, error: rpcError } = await supabase.rpc("register_device_purchase", {
      p_type: parsed.type as string,
      p_brand: parsed.brand,
      p_model: parsed.model,
      p_imei: parsed.imei,
      p_price: parsed.price,
      p_cost_price: parsed.cost_price,
      p_ram: parsed.ram,
      p_storage: parsed.storage,
      p_color: parsed.color,
      p_battery_health: parsed.battery_health,
      p_screen_size: parsed.screen_size,
      p_cpu: parsed.cpu,
      p_gpu: parsed.gpu,
      p_needs_repair: parsed.needs_repair,
      p_repair_node: parsed.repair_node,
      p_repair_cost: parsed.repair_cost,
      p_repair_np_ttn: parsed.repair_np_ttn,
      p_repair_status: parsed.repair_status,
      p_repair_parts_replaced: parsed.repair_parts_replaced,
      p_description: parsed.description,
      p_is_visible: parsed.is_visible,
      p_source: parsed.source,
      p_source_reference: parsed.source_reference,
      p_purchased_from: parsed.purchased_from,
      p_condition_grade: parsed.condition_grade,
      p_condition_description: parsed.condition_description,
      p_original_box: parsed.original_box,
      p_accessories_included: parsed.accessories_included,
      p_serial_number: parsed.serial_number,
      p_warehouse_location: parsed.warehouse_location,
      p_photo_urls: parsed.photo_urls,
      p_safe_id: chosenSafeId,
      p_user_id: user.id
    });

    if (rpcError) throw rpcError;
    const inserted = { id: insertedId };





    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    revalidatePath("/admin/repairs");
    
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}




export async function updateDeviceStatus(
  id: string,
  status: "in_stock" | "transit" | "service" | "sold" | "returned" | "archived",
  repair_status?: "pending" | "waiting_parts" | "in_progress" | "completed"
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const updatePayload: DeviceUpdate = { status };
    if (repair_status) {
      updatePayload.repair_status = repair_status;
    }
    
    // Якщо пристрій відправляється в ремонт, автоматично встановлюємо потребу в ремонті
    if (status === "service") {
      updatePayload.needs_repair = true;
      if (!repair_status) {
        updatePayload.repair_status = "pending";
      }
    }
    
    const { error } = await supabase
      .from("devices")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw error;



    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function bulkUpdateDevicesStatus(
  ids: string[],
  status: "in_stock" | "transit" | "service" | "sold" | "returned" | "archived"
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const updatePayload: DeviceUpdate = { status };
    if (status === "service") {
      updatePayload.needs_repair = true;
      updatePayload.repair_status = "pending";
    }
    
    const { error } = await supabase
      .from("devices")
      .update(updatePayload)
      .in("id", ids);

    if (error) throw error;



    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function bulkUpdateDevicesTtn(ids: string[], ttn: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    
    const { data: devices, error: fetchErr } = await supabase
      .from("devices")
      .select("id, notes")
      .in("id", ids);
      
    if (fetchErr) throw fetchErr;
    
    // Group devices by current notes content to minimize UPDATE calls
    const ttnNote = `ТТН закупівлі: ${ttn}`;
    const withExistingTtn: string[] = [];
    const withoutTtn: string[] = [];
    const devicesMap: Record<string, string> = {};

    for (const dev of devices || []) {
      devicesMap[dev.id] = dev.notes || "";
      if ((dev.notes || "").includes("ТТН закупівлі:")) {
        withExistingTtn.push(dev.id);
      } else {
        withoutTtn.push(dev.id);
      }
    }

    // For devices without TTN: append the note (same for all — one UPDATE call)
    if (withoutTtn.length > 0) {
      // Each device may have different existing notes, so we still need per-device updates
      // but batch by groups that have the exact same notes value
      const noteGroups: Record<string, string[]> = {};
      for (const id of withoutTtn) {
        const currentNotes = devicesMap[id];
        const newNotes = currentNotes ? `${currentNotes}\n${ttnNote}` : ttnNote;
        if (!noteGroups[newNotes]) noteGroups[newNotes] = [];
        noteGroups[newNotes].push(id);
      }
      // Batch: one UPDATE per unique note value (typically 1-2 groups)
      for (const [newNotes, groupIds] of Object.entries(noteGroups)) {
        const { error: updErr } = await supabase
          .from("devices")
          .update({ notes: newNotes })
          .in("id", groupIds);
        if (updErr) throw updErr;
      }
    }

    // For devices with existing TTN: replace the TTN line
    if (withExistingTtn.length > 0) {
      const noteGroups: Record<string, string[]> = {};
      for (const id of withExistingTtn) {
        const currentNotes = devicesMap[id];
        const newNotes = currentNotes.replace(/ТТН закупівлі: [^\n]*/g, ttnNote);
        if (!noteGroups[newNotes]) noteGroups[newNotes] = [];
        noteGroups[newNotes].push(id);
      }
      for (const [newNotes, groupIds] of Object.entries(noteGroups)) {
        const { error: updErr } = await supabase
          .from("devices")
          .update({ notes: newNotes })
          .in("id", groupIds);
        if (updErr) throw updErr;
      }
    }
    
    revalidatePath("/admin/devices");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function receiveDeviceFromTransit(
  deviceId: string,
  safeId?: string | null,
  /* Спосіб оплати не має значення за замовчуванням «готівка» просто так:
     ця дія викликається з інтерфейсу, де його питають, і сейф має дві
     половини — списати треба з тієї, якою справді заплатили. */
  paymentMethod: "cash" | "cashless" = "cash",
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || ""));

    // 1. Отримуємо дані про пристрій
    const { data: device, error: devErr } = await supabase
      .from("devices")
      .select("id, brand, model, status, cost_price")
      .eq("id", deviceId)
      .single();

    if (devErr || !device) throw new Error("Пристрій не знайдено");
    if (device.status !== "transit") {
      throw new Error("Пристрій не перебуває в дорозі (transit)");
    }

    // 2. Оновлюємо статус пристрою на складі
    const { error: updateErr } = await supabase
      .from("devices")
      .update({ status: "in_stock" })
      .eq("id", deviceId);

    if (updateErr) throw updateErr;

    // 3. Якщо вказано сейф та ціна закупівлі більша за 0, списуємо кошти
    if (safeId) {
      const amount = device.cost_price;
      if (amount > 0) {
        const description = `Прийняття пристрою на склад: ${device.brand} ${device.model}`;
        const { error: deductErr } = await supabase.rpc("purchase_inventory_item", {
          item_type: "device",
          item_id: deviceId,
          safe_id: safeId,
          amount: amount,
          description,
          user_id: user.id,
          payment_method: paymentMethod,
        });
        if (deductErr) throw deductErr;
      }
    }

    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}






export async function updateDevice(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const rawParts = formData.get("repair_parts_replaced");
    let parsedParts: Array<{ name: string; cost: number; origin: string; part_id?: string | null }> = [];
    try {
      parsedParts = rawParts ? JSON.parse(rawParts as string) : [];
    } catch {
      // silently ignore invalid JSON — defaults to empty array
    }

    const data = {
      type: formData.get("type"),
      brand: formData.get("brand"),
      model: formData.get("model"),
      imei: formData.get("imei") || null,
      price: formData.get("price"),
      cost_price: formData.get("cost_price"),
      ram: formData.get("ram") || null,
      storage: formData.get("storage") || null,
      color: formData.get("color") || null,
      battery_health: formData.get("battery_health") || null,
      screen_size: formData.get("screen_size") || null,
      cpu: formData.get("cpu") || null,
      gpu: formData.get("gpu") || null,
      needs_repair: formData.get("needs_repair") === "true",
      repair_node: formData.get("repair_node") || null,
      repair_cost: formData.get("repair_cost") || 0,
      repair_np_ttn: formData.get("repair_np_ttn") || null,
      repair_status: formData.get("repair_status") || "pending",
      repair_parts_replaced: parsedParts,
      description: formData.get("description") || null,
      is_visible: formData.get("is_visible") === "true",
      source: formData.get("source") || "supplier",
      source_reference: formData.get("source_reference") || null,
      purchased_from: formData.get("purchased_from") || null,
      condition_grade: formData.get("condition_grade") || "good",
      condition_description: formData.get("condition_description") || null,
      original_box: formData.get("original_box") === "true",
      accessories_included: formData.get("accessories_included") || null,
      serial_number: formData.get("serial_number") || null,
      warehouse_location: formData.get("warehouse_location") || null,
      photo_urls: [], // will be handled after parsing
    };

    const parsed = deviceSchema.parse(data);

    const supabase = await createClient();

    // Get current user profile for logging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Неавторизовано: " + (authError?.message || "Користувач не знайдений"));
    }

    // Upload new photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      const newPhotoUrls = await uploadMediaFiles(photoFiles, "devices");
      
      // Get existing photos
      const { data: existingDevice } = await supabase.from("devices").select("photo_urls").eq("id", id).single();
      const existingPhotos = existingDevice?.photo_urls || [];
      
      parsed.photo_urls = [...existingPhotos, ...newPhotoUrls];
    } else {
      // Keep existing
      const { data: existingDevice } = await supabase.from("devices").select("photo_urls").eq("id", id).single();
      parsed.photo_urls = existingDevice?.photo_urls || [];
    }

    const updatePayload: DeviceUpdate = { ...parsed };

    // Отримуємо поточний стан пристрою для обробки списання деталей
    const { data: existingDeviceData } = await supabase
      .from("devices")
      .select("repair_parts_replaced, status")
      .eq("id", id)
      .single();

    if (existingDeviceData) {
      const wantToComplete = !parsed.needs_repair || parsed.repair_status === "completed";
      if (wantToComplete && existingDeviceData.status === "service") {
        updatePayload.status = "in_stock";
      }

      const oldParts = (existingDeviceData.repair_parts_replaced || []) as Array<any>;
      const newParts = (parsed.repair_parts_replaced || []) as Array<any>;

      // Count occurrences of each part_id in old state
      const oldCounts: Record<string, number> = {};
      oldParts.forEach(p => { if (p.part_id) oldCounts[p.part_id] = (oldCounts[p.part_id] || 0) + 1; });

      // Count occurrences in new state
      const newCounts: Record<string, number> = {};
      newParts.forEach(p => { if (p.part_id) newCounts[p.part_id] = (newCounts[p.part_id] || 0) + 1; });

      const allPartIds = new Set([...Object.keys(oldCounts), ...Object.keys(newCounts)]);

      // Adjust stock for the difference
      for (const partId of allPartIds) {
        const oldQty = oldCounts[partId] || 0;
        const newQty = newCounts[partId] || 0;
        const delta = oldQty - newQty; 
        
        if (delta !== 0) {
          await supabase.rpc('adjust_part_stock', {
            p_id: partId,
            amount_delta: delta,
            p_user_id: user.id,
            p_description: delta < 0 
              ? `Використано додатково для пристрою (ID: ${id})` 
              : `Повернуто з пристрою (ID: ${id})`
          });
        }
      }
    }

    const { error } = await supabase.from("devices").update(updatePayload).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    revalidatePath("/admin/repairs");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteDevice(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
    const supabase = await createClient();
    const { error } = await supabase.from("devices").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
