"use server";
import { requireRole } from "@/lib/utils/rbac";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import { notifyStaffLowStock } from "@/lib/services/telegram";

const partSchema = z.object({
  // Сейф тримає дві половини, і закупівля мусить сказати, з якої брати.
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
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

    const isTransit = parsed.status === "transit";
    const isDeferred = !isTransit && parsed.payment_status === "deferred";
    const stockToInsert = isTransit ? 0 : parsed.stock;
    const totalCost = parsed.cost_price * stockToInsert;

    /* Джерело оплати — сейф або каса. `safe_id` лишається для сумісності зі
       старими викликами й веде перед `p_source_id`. */
    const sourceTypeRaw = (formData.get("source_type") as string | null) ?? "safe";
    const sourceType: "safe" | "cash_register" =
      sourceTypeRaw === "cash_register" ? "cash_register" : "safe";
    let sourceId =
      (formData.get("source_id") as string | null) || (formData.get("safe_id") as string | null);
    let chosenType = sourceType;

    if (!sourceId && !isTransit && !isDeferred && totalCost > 0) {
      const { data: opexSafe } = await supabase
        .from("safes")
        .select("id")
        .eq("type", "opex")
        .single();
      sourceId = opexSafe?.id ?? null;
      chosenType = "safe";
    }

    // @ts-expect-error - register_part_purchase is missing from database.ts types
    const { error: rpcError } = await supabase.rpc("register_part_purchase", {
      p_name: parsed.name,
      p_part_number: parsed.part_number,
      p_type: parsed.type,
      p_compatible_with: parsed.compatible_with,
      p_cost_price: parsed.cost_price,
      p_price: parsed.price,
      p_stock: parsed.stock,
      p_min_stock: parsed.min_stock,
      p_supplier_id: parsed.supplier_id,
      p_np_ttn: parsed.np_ttn,
      p_origin_type: parsed.origin_type,
      p_status: parsed.status,
      p_payment_status: parsed.payment_status,
      p_payment_due_date: parsed.payment_due_date,
      // Веде перед `p_source_id`; для каси мусить бути null.
      p_safe_id: chosenType === "safe" ? sourceId : null,
      p_user_id: user.id,
      p_payment_method: parsed.payment_method,
      p_source_type: chosenType,
      p_source_id: sourceId,
    });

    if (rpcError) throw rpcError;

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
    // `payment_method` описує платіж, а не деталь — колонки під нього в `parts`
    // немає, тож у запис він не їде.
    const { payment_method: _method, ...partFields } = parsed;
    const supabase = await createClient();
    const { error } = await supabase.from("parts").update(partFields).eq("id", id);
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
  paymentDueDate?: string | null,
  /* Спосіб оплати не має значення за замовчуванням «готівка» просто так:
     ця дія викликається з інтерфейсу, де його питають, і сейф має дві
     половини — списати треба з тієї, якою справді заплатили. */
  paymentMethod: "cash" | "cashless" = "cash",
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
          payment_method: paymentMethod,
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
  safeId: string,
  /* Спосіб оплати не має значення за замовчуванням «готівка» просто так:
     ця дія викликається з інтерфейсу, де його питають, і сейф має дві
     половини — списати треба з тієї, якою справді заплатили. */
  paymentMethod: "cash" | "cashless" = "cash",
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
      payment_method: paymentMethod,
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
