"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";

type DeviceInsert = Database["public"]["Tables"]["devices"]["Insert"];
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
  condition_grade: z.enum(["new", "A", "B", "C", "for_repair"]).optional().default("A"),
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
    } catch (e) {
      console.error("Failed to parse repair_parts_replaced:", e);
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
      photo_urls: formData.get("photo_urls") ? (formData.get("photo_urls") as string).split(",").map(s => s.trim()).filter(Boolean) : [],
    };

    const parsed = deviceSchema.parse(data);

    const supabase = await createClient();
    const { error } = await supabase.from("devices").insert({
      type: parsed.type,
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
      status: "in_stock"
    } as DeviceInsert);

    if (error) throw error;

    revalidatePath("/admin/devices");
    revalidatePath("/admin");
    
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
      description: formData.get("description") || null,
      is_visible: formData.get("is_visible") === "true",
      source: formData.get("source") || "supplier",
      barcode: formData.get("barcode") || null,
      warehouse_location: formData.get("warehouse_location") || null,
    };

    const parsed = accessorySchema.parse(data);

    const supabase = await createClient();
    const { error } = await supabase.from("accessories").insert({
      type: parsed.type,
      name: parsed.name,
      price: parsed.price,
      cost_price: parsed.cost_price,
      stock: parsed.stock,
      description: parsed.description,
      is_visible: parsed.is_visible,
      source: parsed.source,
      barcode: parsed.barcode,
      warehouse_location: parsed.warehouse_location,
      status: "active"
    } as AccessoryInsert);

    if (error) throw error;

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
});

export async function createService(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      description: formData.get("description") || null,
      price: formData.get("price"),
      category: formData.get("category"),
      is_visible: formData.get("is_visible") === "true",
      photo_urls: [],
    };

    const parsed = serviceSchema.parse(data);

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
    };

    const parsed = serviceSchema.parse(data);

    const supabase = await createClient();
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
    } catch (e) {
      console.error("Failed to parse repair_parts_replaced:", e);
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
      photo_urls: formData.get("photo_urls") ? (formData.get("photo_urls") as string).split(",").map(s => s.trim()).filter(Boolean) : [],
    };

    const parsed = deviceSchema.parse(data);

    const supabase = await createClient();
    const { error } = await supabase.from("devices").update(parsed as DeviceUpdate).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/devices");
    revalidatePath("/admin");
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

    const { error } = await supabase.from("accessories").insert(parsed);
    if (error) throw error;

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
    const updatePayload: any = { status };
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
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

