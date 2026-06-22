"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";

const nodeLabelsForRepair: Record<string, string> = {
  display: "Заміна дисплея",
  battery: "Заміна акумулятора",
  charging_port: "Ремонт порту зарядки",
  speaker: "Ремонт динаміка/мікрофона",
  camera: "Ремонт камери",
  button: "Ремонт кнопок",
  housing: "Ремонт корпусу",
  water_damage: "Усунення наслідків вологи",
  software: "Прошивка/ПЗ",
  other_node: "Ремонт (інше)",
};

/**
 * Idempotent: creates a repair card for a warehouse device only if no active repair exists.
 */
async function autoCreateRepairForDevice(
  supabase: SupabaseClient<Database>,
  deviceId: string
): Promise<void> {
  // 1. Fetch device info
  const { data: device } = await supabase
    .from("devices")
    .select("brand, model, imei, repair_node, repair_cost")
    .eq("id", deviceId)
    .single();

  if (!device) return;

  // 2. Idempotency: check for existing active repair
  const { data: existing } = await supabase
    .from("repairs")
    .select("id")
    .eq("inventory_device_id", deviceId)
    .not("status", "in", `("completed","handed_over","cancelled")`)
    .limit(1)
    .maybeSingle();

  if (existing) return; // already has an active repair

  const deviceName = [device.brand, device.model].filter(Boolean).join(" ") || "Без назви";
  const issue = device.repair_node
    ? nodeLabelsForRepair[device.repair_node] ?? device.repair_node
    : "Потребує ремонту";

  const tracking_token = randomBytes(3).toString("hex").toUpperCase();

  await supabase.from("repairs").insert({
    inventory_device_id: deviceId,
    device_name: deviceName,
    device_imei: device.imei ?? null,
    issue,
    price: device.repair_cost ?? 0,
    status: "in_progress",
    tracking_token,
    warranty_months: 0,
  });
}

type DeviceUpdate = Database["public"]["Tables"]["devices"]["Update"];
type AccessoryInsert = Database["public"]["Tables"]["accessories"]["Insert"];
type AccessoryUpdate = Database["public"]["Tables"]["accessories"]["Update"];
type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];

const deviceSchema = z.object({
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
      origin: z.string()
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

    // 1. Determine safe and check balance BEFORE insert
    const safeId = formData.get("safe_id") as string | null;
    let chosenSafeId = safeId;
    if (!chosenSafeId) {
      const { data: opexSafe } = await supabase
        .from("safes")
        .select("id")
        .eq("type", "opex")
        .single();
      chosenSafeId = opexSafe?.id ?? null;
    }

    if (parsed.cost_price > 0 && chosenSafeId) {
      const { data: safeData } = await supabase
        .from("safes")
        .select("balance, name")
        .eq("id", chosenSafeId)
        .single();

      if (!safeData) {
        throw new Error("Сейф для списання коштів не знайдено");
      }

      if (safeData.balance < parsed.cost_price) {
        throw new Error(`Недостатньо коштів на сейфі "${safeData.name}". Доступно: ${safeData.balance} грн`);
      }
    }

    // 2. Perform insert
    const { data: inserted, error } = await supabase.from("devices").insert({
      type: parsed.type as string,
      brand: parsed.brand,
      model: parsed.model,
      imei: parsed.imei,
      price: parsed.price,
      cost_price: parsed.cost_price,
      ram: parsed.ram,
      storage: parsed.storage,
      color: parsed.color,
      battery_health: parsed.battery_health,
      screen_size: parsed.screen_size,
      cpu: parsed.cpu,
      gpu: parsed.gpu,
      needs_repair: parsed.needs_repair,
      repair_node: parsed.repair_node,
      repair_cost: parsed.repair_cost,
      repair_np_ttn: parsed.repair_np_ttn,
      repair_status: parsed.repair_status,
      repair_parts_replaced: parsed.repair_parts_replaced,
      description: parsed.description,
      is_visible: parsed.is_visible,
      source: parsed.source,
      source_reference: parsed.source_reference,
      purchased_from: parsed.purchased_from,
      condition_grade: parsed.condition_grade,
      condition_description: parsed.condition_description,
      original_box: parsed.original_box,
      accessories_included: parsed.accessories_included,
      serial_number: parsed.serial_number,
      warehouse_location: parsed.warehouse_location,
      photo_urls: parsed.photo_urls,
    }).select("id").single();

    if (error) throw error;

    // 3. Perform safe balance deduction
    if (parsed.cost_price > 0 && chosenSafeId && inserted?.id) {
      try {
        const description = `Закупівля техніки: ${parsed.brand} ${parsed.model}${parsed.imei ? ` (IMEI: ${parsed.imei})` : ""}`;
        const { error: rpcErr } = await supabase.rpc("purchase_inventory_item", {
          item_type: "device",
          item_id: inserted.id,
          safe_id: chosenSafeId,
          amount: parsed.cost_price,
          description,
          user_id: user.id,
        });
        if (rpcErr) throw rpcErr;
      } catch (rpcError) {
        // Rollback insert on failure
        await supabase.from("devices").delete().eq("id", inserted.id);
        throw rpcError;
      }
    }

    // Auto-create repair card if device needs repair
    if (parsed.needs_repair && inserted?.id) {
      await autoCreateRepairForDevice(supabase, inserted.id);
    }

    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    revalidatePath("/admin/repairs");
    
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}


const accessorySchema = z.object({
  type: z.enum(["case", "charger", "cable", "headphones", "screen_protector", "other"]),
  name: z.string().min(1, "Назва обов'язкова"),
  price: z.coerce.number().min(0),
  cost_price: z.coerce.number().min(0),
  stock: z.coerce.number().min(0),
  warranty_months: z.coerce.number().min(0).optional().default(6),
  description: z.string().nullable().optional(),
  is_visible: z.coerce.boolean().optional().default(false),
  source: z.string().optional().default("supplier"),
  barcode: z.string().nullable().optional(),
  warehouse_location: z.string().nullable().optional(),
});

export async function createAccessory(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      type: formData.get("type"),
      name: formData.get("name"),
      price: formData.get("price"),
      cost_price: formData.get("cost_price"),
      stock: formData.get("stock"),
      warranty_months: formData.get("warranty_months") || null,
      description: formData.get("description") || null,
      is_visible: formData.get("is_visible") === "true",
      source: formData.get("source") || "supplier",
      barcode: formData.get("barcode") || null,
      warehouse_location: formData.get("warehouse_location") || null,
    };

    const parsed = accessorySchema.parse(data);

    const supabase = await createClient();

    // Get current user profile for logging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Неавторизовано: " + (authError?.message || "Користувач не знайдений"));
    }

    // 1. Determine safe and check balance BEFORE insert
    const safeId = formData.get("safe_id") as string | null;
    let chosenSafeId = safeId;
    if (!chosenSafeId) {
      const { data: opexSafe } = await supabase
        .from("safes")
        .select("id")
        .eq("type", "opex")
        .single();
      chosenSafeId = opexSafe?.id ?? null;
    }

    const totalCost = parsed.cost_price * parsed.stock;
    if (totalCost > 0 && chosenSafeId) {
      const { data: safeData } = await supabase
        .from("safes")
        .select("balance, name")
        .eq("id", chosenSafeId)
        .single();

      if (!safeData) {
        throw new Error("Сейф для списання коштів не знайдено");
      }

      if (safeData.balance < totalCost) {
        throw new Error(`Недостатньо коштів на сейфі "${safeData.name}". Доступно: ${safeData.balance} грн`);
      }
    }

    // 2. Perform insert
    const { data: inserted, error } = await supabase.from("accessories").insert({
      type: parsed.type,
      name: parsed.name,
      price: parsed.price,
      cost_price: parsed.cost_price,
      stock: parsed.stock,
      warranty_months: parsed.warranty_months,
      description: parsed.description,
      is_visible: parsed.is_visible,
      source: parsed.source,
      barcode: parsed.barcode,
      warehouse_location: parsed.warehouse_location,
      status: "active"
    } as AccessoryInsert).select("id").single();

    if (error) throw error;

    // 3. Perform safe balance deduction
    if (totalCost > 0 && chosenSafeId && inserted?.id) {
      try {
        const description = `Закупівля аксесуарів: ${parsed.name} (Кількість: ${parsed.stock} шт.)`;
        const { error: rpcErr } = await supabase.rpc("purchase_inventory_item", {
          item_type: "accessory",
          item_id: inserted.id,
          safe_id: chosenSafeId,
          amount: totalCost,
          description,
          user_id: user.id,
        });
        if (rpcErr) throw rpcErr;
      } catch (rpcError) {
        // Rollback insert on failure
        await supabase.from("accessories").delete().eq("id", inserted.id);
        throw rpcError;
      }
    }

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const serviceSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  description: z.string().nullable().optional(),
  price: z.coerce.number().min(0, "Ціна не може бути від'ємною"),
  category: z.string().min(1, "Категорія обов'язкова"),
  is_visible: z.coerce.boolean().optional().default(true),
  photo_urls: z.array(z.string()).optional().default([]),
  warranty_days: z.coerce.number().min(0).nullable().optional(),
  duration_minutes: z.coerce.number().min(0).nullable().optional(),
});

import { uploadMediaFiles } from "@/lib/supabase/storage";

export async function createService(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      description: formData.get("description") || null,
      price: formData.get("price"),
      category: formData.get("category"),
      is_visible: formData.get("is_visible") === "true",
      warranty_days: formData.get("warranty_days") || null,
      duration_minutes: formData.get("duration_minutes") || null,
      photo_urls: [],
    };

    const parsed = serviceSchema.parse(data);

    // Upload photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      parsed.photo_urls = await uploadMediaFiles(photoFiles, "services");
    }

    const supabase = await createClient();
    const { error } = await supabase.from("services").insert(parsed as ServiceInsert);
    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateService(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      description: formData.get("description") || null,
      price: formData.get("price"),
      category: formData.get("category"),
      is_visible: formData.get("is_visible") === "true",
      warranty_days: formData.get("warranty_days") || null,
      duration_minutes: formData.get("duration_minutes") || null,
      photo_urls: [], // we will update this separately
    };

    const parsed = serviceSchema.parse(data);

    const supabase = await createClient();
    
    // Upload new photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      const newPhotoUrls = await uploadMediaFiles(photoFiles, "services");
      
      // Get existing photos
      const { data: existingService } = await supabase.from("services").select("photo_urls").eq("id", id).single();
      const existingPhotos = existingService?.photo_urls || [];
      
      parsed.photo_urls = [...existingPhotos, ...newPhotoUrls];
    } else {
      // Keep existing
      const { data: existingService } = await supabase.from("services").select("photo_urls").eq("id", id).single();
      parsed.photo_urls = existingService?.photo_urls || [];
    }

    const { error } = await supabase.from("services").update(parsed as ServiceUpdate).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteService(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateDevice(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
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

    const supabase = await createClient();

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

    // Захист: якщо пристрій має активний складський ремонт, ігноруємо ручні зміни ремонтних полів форми
    const { data: activeRepair } = await supabase
      .from("repairs")
      .select("id, cost, status")
      .eq("inventory_device_id", id)
      .not("status", "in", `("completed","handed_over","cancelled")`)
      .limit(1)
      .maybeSingle();

    if (activeRepair) {
      parsed.needs_repair = true;
      
      // Якщо вартість ремонту на формі відрізняється від поточної в БД, оновлюємо картку ремонту
      if (parsed.repair_cost !== activeRepair.cost) {
        await supabase
          .from("repairs")
          .update({ cost: parsed.repair_cost })
          .eq("id", activeRepair.id);
      }

      let mappedRepairStatus: "pending" | "waiting_parts" | "in_progress" | "completed" = "pending";
      if (activeRepair.status === "awaiting_parts") {
        mappedRepairStatus = "waiting_parts";
      } else if (["in_progress", "diagnostics"].includes(activeRepair.status)) {
        mappedRepairStatus = "in_progress";
      } else if (activeRepair.status === "ready") {
        mappedRepairStatus = "completed";
      }
      parsed.repair_status = mappedRepairStatus;

      // Зберігаємо раніше записані деталі (вони управляються автоматично через списання)
      const { data: currentDev } = await supabase
        .from("devices")
        .select("repair_parts_replaced")
        .eq("id", id)
        .single();
      if (currentDev) {
        parsed.repair_parts_replaced = (currentDev.repair_parts_replaced as unknown as { name: string; cost: number; origin: string }[]) || [];
      }
    }

    // Check previous needs_repair value before update
    const { data: prevDevice } = await supabase
      .from("devices")
      .select("needs_repair")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("devices").update(parsed as DeviceUpdate).eq("id", id);
    if (error) throw error;

    // Auto-create repair if needs_repair just turned true
    if (parsed.needs_repair && !prevDevice?.needs_repair) {
      await autoCreateRepairForDevice(supabase, id);
    }

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

export async function updateAccessory(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      type: formData.get("type"),
      name: formData.get("name"),
      price: formData.get("price"),
      cost_price: formData.get("cost_price"),
      stock: formData.get("stock"),
      warranty_months: formData.get("warranty_months") || null,
      description: formData.get("description") || null,
      is_visible: formData.get("is_visible") === "true",
      source: formData.get("source") || "supplier",
      barcode: formData.get("barcode") || null,
      warehouse_location: formData.get("warehouse_location") || null,
    };

    const parsed = accessorySchema.parse(data);

    const supabase = await createClient();
    const { error } = await supabase.from("accessories").update(parsed as AccessoryUpdate).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteAccessory(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("accessories").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function importAccessories(items: unknown[]): Promise<ActionState> {
  try {
    const supabase = await createClient();
    
    const schema = z.array(z.object({
      name: z.string().min(1, "Назва обов'язкова"),
      type: z.enum(["case", "charger", "cable", "headphones", "screen_protector", "other"]),
      price: z.coerce.number().min(0, "Ціна не може бути менше 0"),
      cost_price: z.coerce.number().min(0, "Собівартість не може бути менше 0"),
      stock: z.coerce.number().min(0, "Кількість не може бути менше 0"),
      min_stock: z.coerce.number().min(0).optional().default(3),
      status: z.string().default("active"),
      description: z.string().nullable().optional(),
      is_visible: z.coerce.boolean().optional().default(false),
    }));

    const parsed = schema.parse(items);

    // Get current user profile for logging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Неавторизовано: " + (authError?.message || "Користувач не знайдений"));
    }

    // 1. Calculate total import cost and check balance
    const { data: opexSafe } = await supabase
      .from("safes")
      .select("id, balance, name")
      .eq("type", "opex")
      .single();

    if (!opexSafe) {
      throw new Error("Сейф OPEX для списання коштів не знайдено");
    }

    const totalImportCost = parsed.reduce((sum, item) => sum + (item.cost_price * item.stock), 0);
    if (totalImportCost > 0 && opexSafe.balance < totalImportCost) {
      throw new Error(`Недостатньо коштів на сейфі "${opexSafe.name}". Необхідно: ${totalImportCost} грн, доступно: ${opexSafe.balance} грн`);
    }

    // 2. Perform insert
    const { data: inserted, error } = await supabase.from("accessories").insert(parsed).select("id, name, cost_price, stock");
    if (error) throw error;

    // 3. Perform safe balance deduction
    if (inserted && inserted.length > 0) {
      const processedIds: string[] = [];
      try {
        for (const item of inserted) {
          const totalCost = item.cost_price * item.stock;
          if (totalCost > 0) {
            const description = `Імпорт аксесуарів: ${item.name} (Кількість: ${item.stock} шт.)`;
            const { error: rpcErr } = await supabase.rpc("purchase_inventory_item", {
              item_type: "accessory",
              item_id: item.id,
              safe_id: opexSafe.id,
              amount: totalCost,
              description,
              user_id: user.id,
            });
            if (rpcErr) throw rpcErr;
            processedIds.push(item.id);
          }
        }
      } catch (rpcError) {
        // Rollback: delete all successfully inserted items from this batch
        await supabase.from("accessories").delete().in("id", inserted.map(i => i.id));
        throw rpcError;
      }
    }

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    
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

    // Auto-create repair when device goes to service
    if (status === "service") {
      await autoCreateRepairForDevice(supabase, id);
    }

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

    // Auto-create repair for each device going to service
    if (status === "service") {
      await Promise.all(ids.map((id) => autoCreateRepairForDevice(supabase, id)));
    }

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

