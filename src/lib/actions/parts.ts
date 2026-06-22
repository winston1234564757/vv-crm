"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import { notifyStaffLowStock } from "@/lib/services/telegram";

const partSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  part_number: z.string().nullable().optional(),
  type: z.string().min(1, "Тип обов'язковий"),
  compatible_with: z.string().nullable().optional(),
  cost_price: z.coerce.number().min(0),
  price: z.coerce.number().min(0).nullable().optional(),
  stock: z.coerce.number().min(0),
  min_stock: z.coerce.number().min(0).default(3),
  supplier_id: z.string().uuid().nullable().optional(),
  np_ttn: z.string().nullable().optional(),
  origin_type: z.string().nullable().optional(),
});

export async function createPart(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      part_number: formData.get("part_number") || null,
      type: formData.get("type"),
      compatible_with: formData.get("compatible_with") || null,
      cost_price: formData.get("cost_price"),
      price: formData.get("price") || null,
      stock: formData.get("stock"),
      min_stock: formData.get("min_stock") || 3,
      supplier_id: formData.get("supplier_id") || null,
      np_ttn: formData.get("np_ttn") || null,
      origin_type: formData.get("origin_type") || null,
    };
    const parsed = partSchema.parse(data);
    const supabase = await createClient();

    // Get current user profile for logging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Неавторизовано: " + (authError?.message || "Користувач не знайдений"));
    }

    const { data: inserted, error } = await supabase.from("parts").insert(parsed).select("id").single();
    if (error) throw error;

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
    if (totalCost > 0 && chosenSafeId && inserted?.id) {
      const description = `Закупівля деталей: ${parsed.name} (Кількість: ${parsed.stock} шт.)`;
      const { error: rpcErr } = await supabase.rpc("purchase_inventory_item", {
        item_type: "part",
        item_id: inserted.id,
        safe_id: chosenSafeId,
        amount: totalCost,
        description,
        user_id: user.id,
      });
      if (rpcErr) throw rpcErr;
    }
    revalidatePath("/admin/parts");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updatePart(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      part_number: formData.get("part_number") || null,
      type: formData.get("type"),
      compatible_with: formData.get("compatible_with") || null,
      cost_price: formData.get("cost_price"),
      price: formData.get("price") || null,
      stock: formData.get("stock"),
      min_stock: formData.get("min_stock") || 3,
      supplier_id: formData.get("supplier_id") || null,
      np_ttn: formData.get("np_ttn") || null,
      origin_type: formData.get("origin_type") || null,
    };
    const parsed = partSchema.parse(data);
    const supabase = await createClient();
    const { error } = await supabase.from("parts").update(parsed).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/parts");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deletePart(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/parts");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function adjustPartStock(partId: string, quantityChange: number, reason: string, referenceId?: string): Promise<ActionState> {
  try {
    const supabase = await createClient();

    // Read current stock
    const { data: part } = await supabase.from("parts").select("stock, name, min_stock").eq("id", partId).single();
    if (!part) throw new Error("Деталь не знайдено");

    const newStock = Math.max(0, part.stock + quantityChange);

    // Optimistic lock: only update if stock hasn't changed since we read it
    const { data: updatedRows, error: updateErr } = await supabase
      .from("parts")
      .update({ stock: newStock })
      .eq("id", partId)
      .eq("stock", part.stock) // optimistic lock condition
      .select("id");

    if (updateErr) throw updateErr;
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error("Конфлікт залишку: запчастина перед цим була змінена. Спробуйте ще раз.");
    }

    await supabase.from("inventory_movements").insert({
      item_type: "part",
      item_id: partId,
      quantity_change: quantityChange,
      reason,
      reference_id: referenceId,
    });

    // Alert staff if stock falls below minimum
    if (newStock <= part.min_stock) {
      const isUrgent = newStock === 0;
      await notifyStaffLowStock(part.name, newStock, isUrgent);
    }

    revalidatePath("/admin/parts");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function bulkUpdatePartsTtn(ids: string[], ttn: string | null): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("parts")
      .update({ np_ttn: ttn })
      .in("id", ids);

    if (error) throw error;
    revalidatePath("/admin/parts");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
