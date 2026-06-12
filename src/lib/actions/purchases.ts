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
  item_id?: string | null;
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

    // Handle items from JSON field
    const itemsRaw = formData.get("items");
    if (typeof itemsRaw === "string" && itemsRaw.trim()) {
      const items = JSON.parse(itemsRaw) as InputPurchaseItem[];
      const purchaseItems = items.map((item) => ({
        purchase_id: purchase.id,
        item_type: item.item_type,
        item_id: item.item_id || null,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: (item.quantity || 1) * (item.unit_price || 0),
      }));
      const { error: itemError } = await supabase.from("purchase_items").insert(purchaseItems);
      if (itemError) throw itemError;
    }

    revalidatePath("/admin/purchases");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updatePurchaseStatus(id: string, status: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const updateData: PurchaseUpdate = { status };
    if (status === "received") updateData.received_at = new Date().toISOString();
    if (status === "paid") updateData.paid_at = new Date().toISOString();

    const { error } = await supabase.from("purchases").update(updateData).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/purchases");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deletePurchase(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("purchase_items").delete().eq("purchase_id", id);
    if (error) throw error;
    const { error: delError } = await supabase.from("purchases").delete().eq("id", id);
    if (delError) throw delError;
    revalidatePath("/admin/purchases");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
