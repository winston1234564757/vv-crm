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
  photo_urls: z.array(z.string()).optional().default([]),
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
      photo_urls: [], // will be handled after parsing
    };

    const parsed = accessorySchema.parse(data);

    // Upload photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      parsed.photo_urls = await uploadMediaFiles(photoFiles, "accessories");
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
      photo_urls: parsed.photo_urls,
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
      photo_urls: [], // placeholder
    };

    const parsed = accessorySchema.parse(data);

    const supabase = await createClient();
    
    // Upload photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      const { data: existingAcc } = await supabase.from("accessories").select("photo_urls").eq("id", id).single();
      const existingUrls = existingAcc?.photo_urls || [];
      const newUrls = await uploadMediaFiles(photoFiles, "accessories");
      parsed.photo_urls = [...existingUrls, ...newUrls];
    } else {
      // Don't overwrite existing photos if no new ones are uploaded
      delete (parsed as any).photo_urls;
    }

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
    await requireRole(["owner", "manager"]);
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
