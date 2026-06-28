"use server";
import { requireRole } from "@/lib/utils/rbac";

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
  status: z.enum(["transit", "in_stock"]).default("in_stock"),
  payment_status: z.enum(["paid", "deferred"]).default("paid"),
  payment_due_date: z.string().nullable().optional(),
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
      status: formData.get("status") || "in_stock",
      payment_status: formData.get("payment_status") || "paid",
      payment_due_date: formData.get("payment_due_date") || null,
    };
    const parsed = partSchema.parse(data);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Неавторизовано: " + (authError?.message || "Користувач не знайдений"));
    }

    // Transit parts: don't charge safe, set stock = 0 regardless of input
    const isTransit = parsed.status === "transit";
    const stockToInsert = isTransit ? 0 : parsed.stock;

    // For transit parts, payment status doesn't apply yet (handled upon receiving)
    const isDeferred = !isTransit && parsed.payment_status === "deferred";
    const debtAmount = isDeferred ? parsed.cost_price * stockToInsert : 0;

    const { data: inserted, error } = await supabase
      .from("parts")
      .insert({ 
        ...parsed, 
        stock: stockToInsert,
        payment_status: isTransit ? "paid" : parsed.payment_status,
        payment_due_date: isDeferred ? parsed.payment_due_date : null,
        debt_amount: debtAmount
      })
      .select("id")
      .single();
    if (error) throw error;

    // Only deduct from safe if part is already in stock (not in transit) and not deferred
    if (!isTransit && !isDeferred) {
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

      const totalCost = parsed.cost_price * stockToInsert;
      if (totalCost > 0 && chosenSafeId && inserted?.id) {
        const { data: safeData } = await supabase
          .from("safes")
          .select("balance, name")
          .eq("id", chosenSafeId)
          .single();

        if (!safeData) throw new Error("Сейф для списання коштів не знайдено");
        if (safeData.balance < totalCost) {
          throw new Error(`Недостатньо коштів на сейфі "${safeData.name}". Доступно: ${safeData.balance} грн`);
        }

        try {
          const description = `Закупівля деталей: ${parsed.name} (Кількість: ${stockToInsert} шт.)`;
          const { error: rpcErr } = await supabase.rpc("purchase_inventory_item", {
            item_type: "part",
            item_id: inserted.id,
            safe_id: chosenSafeId,
            amount: totalCost,
            description,
            user_id: user.id,
          });
          if (rpcErr) throw rpcErr;
        } catch (rpcError) {
          await supabase.from("parts").delete().eq("id", inserted.id);
          throw rpcError;
        }
      }
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
      payment_due_date: formData.get("payment_due_date") || null,
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
    await requireRole(["owner", "manager"]);
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

// ============================================================
// RECEIVE PART FROM TRANSIT — marks part as received on warehouse
// ============================================================
export async function receivePartFromTransit(
  partId: string,
  quantity: number,
  safeId?: string | null,
  paymentStatus: "paid" | "deferred" = "paid",
  paymentDueDate?: string | null
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || ""));

    // 1. Get part details
    const { data: part, error: partErr } = await supabase
      .from("parts")
      .select("id, name, cost_price, status")
      .eq("id", partId)
      .single();
    if (partErr || !part) throw new Error("Деталь не знайдено");

    if (part.status === "in_stock") {
      throw new Error("Ця деталь вже на складі");
    }

    // 2. Call RPC to mark as received and increment stock
    const { error: rpcErr } = await supabase.rpc("receive_part_transit", {
      p_part_id: partId,
      p_quantity: quantity,
    });
    if (rpcErr) throw rpcErr;

    // 3. Handle payment status
    if (paymentStatus === "deferred") {
      const debtAmount = part.cost_price * quantity;
      const { error: updateErr } = await supabase
        .from("parts")
        .update({
          payment_status: "deferred",
          payment_due_date: paymentDueDate || null,
          debt_amount: debtAmount
        })
        .eq("id", partId);
      if (updateErr) throw updateErr;
    } else if (safeId) {
      const totalCost = part.cost_price * quantity;
      if (totalCost > 0) {
        const description = `Прийняття деталі на склад: ${part.name} (${quantity} шт.)`;
        const { error: deductErr } = await supabase.rpc("purchase_inventory_item", {
          item_type: "part",
          item_id: partId,
          safe_id: safeId,
          amount: totalCost,
          description,
          user_id: user.id,
        });
        if (deductErr) throw deductErr;
      }
    }

    revalidatePath("/admin/parts");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

// ============================================================
// PAY DEFERRED PART — pays off supplier debt for a part from a safe
// ============================================================
export async function payDeferredPartAction(
  partId: string,
  safeId: string
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || ""));

    // 1. Get part details
    const { data: part, error: partErr } = await supabase
      .from("parts")
      .select("id, name, cost_price, payment_status, debt_amount, supplier_id")
      .eq("id", partId)
      .single();
    if (partErr || !part) throw new Error("Деталь не знайдено");

    if (part.payment_status !== "deferred" || part.debt_amount <= 0) {
      throw new Error("Ця деталь не має відстроченого платежу або вже оплачена");
    }

    // 2. Check safe balance
    const { data: safe, error: safeErr } = await supabase
      .from("safes")
      .select("id, name, balance")
      .eq("id", safeId)
      .single();
    if (safeErr || !safe) throw new Error("Сейф не знайдено");

    if (safe.balance < part.debt_amount) {
      throw new Error(`Недостатньо коштів на сейфі "${safe.name}". Доступно: ${safe.balance} грн, потрібно: ${part.debt_amount} грн`);
    }

    // 3. Deduct from safe and register transaction atomically
    const description = `Оплата боргу за деталь: ${part.name}`;
    const { error: rpcErr } = await supabase.rpc("purchase_inventory_item", {
      item_type: "part",
      item_id: partId,
      safe_id: safeId,
      amount: part.debt_amount,
      description,
      user_id: user.id,
    });
    if (rpcErr) throw rpcErr;

    // 4. Update part status
    const { error: updateErr } = await supabase
      .from("parts")
      .update({
        payment_status: "paid",
        paid_from_safe_id: safeId,
        paid_at: new Date().toISOString(),
        debt_amount: 0
      })
      .eq("id", partId);
    if (updateErr) throw updateErr;

    revalidatePath("/admin/parts");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
