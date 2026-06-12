"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { notifyStaffLowStock } from "@/lib/services/telegram";


type PartInsert = Database["public"]["Tables"]["parts"]["Insert"];
type PartUpdate = Database["public"]["Tables"]["parts"]["Update"];

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
    const { error } = await supabase.from("parts").insert(parsed as PartInsert);
    if (error) throw error;
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
    const { error } = await supabase.from("parts").update(parsed as PartUpdate).eq("id", id);
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
    const { data: part } = await supabase.from("parts").select("stock").eq("id", partId).single();
    if (!part) throw new Error("Деталь не знайдено");
    const newStock = Math.max(0, part.stock + quantityChange);
    await supabase.from("parts").update({ stock: newStock }).eq("id", partId);
    await supabase.from("inventory_movements").insert({
      item_type: "part",
      item_id: partId,
      quantity_change: quantityChange,
      reason,
      reference_id: referenceId,
    });

    // Alert staff if stock falls below minimum
    const { data: updatedPart } = await supabase
      .from("parts")
      .select("name, stock, min_stock")
      .eq("id", partId)
      .single();

    if (updatedPart && updatedPart.stock <= updatedPart.min_stock) {
      const isUrgent = updatedPart.stock === 0;
      await notifyStaffLowStock(updatedPart.name, updatedPart.stock, isUrgent);
    }

    revalidatePath("/admin/parts");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
