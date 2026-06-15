"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";

type PurchaseUpdate = Database["public"]["Tables"]["purchases"]["Update"];

interface InputPurchaseItem {
  item_type: "device" | "accessory" | "part" | "service";
  item_name: string;
  quantity: number;
  unit_price: number;
}

const purchaseSchema = z.object({
  supplier_id: z.string().nullable().optional(),
  total_amount: z.coerce.number().min(0, "Сума не може бути від'ємною"),
  status: z.string().optional().default("pending"),
  paid_from_safe_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createPurchase(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      supplier_id: formData.get("supplier_id") || null,
      total_amount: formData.get("total_amount") || 0,
      status: "pending",
      paid_from_safe_id: formData.get("paid_from_safe_id") || null,
      notes: formData.get("notes") || null,
    };
    const parsed = purchaseSchema.parse(data);

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || "User not found"));

    const { data: purchase, error } = await supabase.from("purchases").insert({
      ...parsed,
      created_by: user.id,
    }).select().single();

    if (error) throw error;

    // Handle items from dynamically generated JSON field
    const itemsRaw = formData.get("items");
    if (typeof itemsRaw === "string" && itemsRaw.trim()) {
      const items = JSON.parse(itemsRaw) as InputPurchaseItem[];
      if (items.length > 0) {
        const purchaseItems = [];

        for (const item of items) {
          let inventoryItemId: string | null = null;

          if (item.item_type === "device") {
            // Для пристроїв: створюємо записи у статусі transit
            const brand = item.item_name.split(" ")[0] || "Unknown";
            const model = item.item_name.substring(brand.length).trim() || "Device";
            
            for (let i = 0; i < item.quantity; i++) {
              const { data: dev, error: devErr } = await supabase.from("devices").insert({
                type: "phone", // за замовчуванням телефон
                brand,
                model,
                status: "transit",
                cost_price: item.unit_price,
                price: Math.round(item.unit_price * 1.25),
                purchase_id: purchase.id,
                supplier_id: parsed.supplier_id || null,
                repair_parts_replaced: [],
              }).select("id").single();
              
              if (devErr) throw devErr;
              if (dev && i === 0) {
                // Зв'язуємо першу створену одиницю з purchase_item
                inventoryItemId = dev.id;
              }
            }
          } else if (item.item_type === "accessory") {
            // Для аксесуарів: шукаємо або створюємо
            const { data: existing } = await supabase
              .from("accessories")
              .select("id")
              .eq("name", item.item_name)
              .maybeSingle();

            if (existing) {
              inventoryItemId = existing.id;
            } else {
              const { data: created, error: accErr } = await supabase.from("accessories").insert({
                name: item.item_name,
                type: "other",
                stock: 0,
                cost_price: item.unit_price,
                price: Math.round(item.unit_price * 1.25),
                supplier_id: parsed.supplier_id || null,
              }).select("id").single();
              
              if (accErr) throw accErr;
              inventoryItemId = created?.id || null;
            }
          } else if (item.item_type === "part") {
            // Для запчастин: шукаємо або створюємо
            const { data: existing } = await supabase
              .from("parts")
              .select("id")
              .eq("name", item.item_name)
              .maybeSingle();

            if (existing) {
              inventoryItemId = existing.id;
            } else {
              const { data: created, error: partErr } = await supabase.from("parts").insert({
                name: item.item_name,
                type: "other",
                stock: 0,
                cost_price: item.unit_price,
                price: Math.round(item.unit_price * 1.25),
                supplier_id: parsed.supplier_id || null,
              }).select("id").single();
              
              if (partErr) throw partErr;
              inventoryItemId = created?.id || null;
            }
          }

          purchaseItems.push({
            purchase_id: purchase.id,
            item_type: item.item_type,
            item_id: inventoryItemId,
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            total_price: (item.quantity || 1) * (item.unit_price || 0),
          });
        }

        const itemNamesDesc = items.map(i => `${i.item_type}: ${i.item_name} (${i.quantity} шт по ${i.unit_price} грн)`).join(", ");
        const updatedNotes = parsed.notes ? `${parsed.notes}\n\nПозиції: ${itemNamesDesc}` : `Позиції: ${itemNamesDesc}`;
        await supabase.from("purchases").update({ notes: updatedNotes }).eq("id", purchase.id);

        const { error: itemError } = await supabase.from("purchase_items").insert(purchaseItems);
        if (itemError) throw itemError;
      }
    }

    revalidatePath("/admin/purchases");
    revalidatePath("/admin/devices");
    revalidatePath("/admin/accessories");
    revalidatePath("/admin/parts");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updatePurchaseStatus(id: string, status: string, safeId?: string | null): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || "User not found"));

    if (status === "received") {
      const { error: rpcError } = await supabase.rpc("receive_purchase_atomic", {
        p_id: id
      });
      if (rpcError) throw rpcError;
    } else if (status === "paid") {
      if (!safeId) {
        throw new Error("Оберіть сейф для оплати закупівлі");
      }
      const { error: rpcError } = await supabase.rpc("pay_purchase_atomic", {
        p_id: id,
        p_safe_id: safeId,
        user_id: user.id
      });
      if (rpcError) throw rpcError;
    } else {
      const updateData: PurchaseUpdate = { status };
      const { error } = await supabase.from("purchases").update(updateData).eq("id", id);
      if (error) throw error;
    }

    revalidatePath("/admin/purchases");
    revalidatePath("/admin/devices");
    revalidatePath("/admin/accessories");
    revalidatePath("/admin/parts");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deletePurchase(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    
    // 1. Отримуємо поточний статус закупівлі
    const { data: purchase, error: getErr } = await supabase
      .from("purchases")
      .select("status")
      .eq("id", id)
      .single();

    if (getErr) throw getErr;
    if (!purchase) throw new Error("Закупівлю не знайдено");

    // 2. Блокуємо видалення отриманих та оплачених закупівель
    if (purchase.status === "received" || purchase.status === "paid") {
      throw new Error("Неможливо видалити вже отриману або оплачену закупівлю.");
    }
    
    // Видаляємо зв'язані пристрої у статусі transit
    await supabase.from("devices").delete().eq("purchase_id", id).eq("status", "transit");

    const { error } = await supabase.from("purchase_items").delete().eq("purchase_id", id);
    if (error) throw error;
    
    const { error: delError } = await supabase.from("purchases").delete().eq("id", id);
    if (delError) throw delError;

    revalidatePath("/admin/purchases");
    revalidatePath("/admin/devices");
    revalidatePath("/admin/parts");
    revalidatePath("/admin/accessories");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
