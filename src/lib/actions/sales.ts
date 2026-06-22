"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

const saleSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().min(0, "Сума не може бути від'ємною"),
  discount: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().optional(),
  item_category: z.enum(["device", "accessory", "service"]),
  item_id: z.string().uuid().nullable().optional(),
  item_name: z.string().optional(),
  is_split: z.coerce.boolean().optional().default(false),
  cash_amount: z.coerce.number().min(0).optional().default(0),
  card_amount: z.coerce.number().min(0).optional().default(0),
  method: z.enum(["cash", "card"]).optional().default("cash"),
  sale_type: z.enum(["online", "retail"]).optional().default("retail"),
  delivery_needed: z.coerce.boolean().optional().default(false),
  delivery_address: z.string().nullable().optional(),
  delivery_tracking: z.string().nullable().optional(),
  warranty_start: z.string().nullable().optional(),
  warranty_end: z.string().nullable().optional(),
  return_reason: z.string().nullable().optional(),
  monobank_payment_id: z.string().nullable().optional(),
  partner_id: z.string().uuid().nullable().optional(),
  promo_code_used: z.string().nullable().optional(),
});

export async function createQuickSale(prevState: ActionState | null, formData: FormData): Promise<ActionState<{ saleId: string }>> {
  try {
    const data = {
      customer_id: formData.get("customer_id") || null,
      amount: formData.get("amount"),
      discount: formData.get("discount") || 0,
      notes: formData.get("notes") || "",
      item_category: formData.get("item_category"),
      item_id: formData.get("item_id") || null,
      item_name: formData.get("item_name") || "",
      is_split: formData.get("is_split") === "true",
      cash_amount: formData.get("cash_amount") || 0,
      card_amount: formData.get("card_amount") || 0,
      method: formData.get("method") || "cash",
      sale_type: formData.get("sale_type") || "retail",
      delivery_needed: formData.get("delivery_needed") === "true",
      delivery_address: formData.get("delivery_address") || null,
      delivery_tracking: formData.get("delivery_tracking") || null,
      warranty_start: formData.get("warranty_start") || null,
      warranty_end: formData.get("warranty_end") || null,
      return_reason: formData.get("return_reason") || null,
      monobank_payment_id: formData.get("monobank_payment_id") || null,
      partner_id: formData.get("partner_id") || null,
      promo_code_used: formData.get("promo_code_used") || null,
    };

    const parsed = saleSchema.parse(data);
    const supabase = await createClient();

    // 1. Get the current user profile ID for created_by
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }
    const userId = user.id;

    // 2. Resolve Cash Register automatically based on item category
    // 'accessory' -> accessories, 'device' -> tech, 'service' -> repairs
    const { data: registers, error: regError } = await supabase
      .from("cash_registers")
      .select("id, type");

    if (regError) throw regError;
    
    const regMap = registers?.reduce((acc, r) => ({ ...acc, [r.type]: r.id }), {} as Record<string, string>) || {};
    
    let targetRegType = "tech";
    if (parsed.item_category === "accessory") targetRegType = "accessories";
    else if (parsed.item_category === "service") targetRegType = "repairs";
    
    const targetRegisterId = regMap[targetRegType];
    if (!targetRegisterId) {
      throw new Error(`Касу типу "${targetRegType}" не знайдено в системі.`);
    }

    // Construct the description based on category
    let descriptionText = parsed.notes || "";
    if (parsed.item_category === "service") {
      descriptionText = `Послуга: ${parsed.item_name} ${descriptionText ? `(${descriptionText})` : ""}`;
    } else if (parsed.item_category === "device") {
      descriptionText = `Продаж техніки ${descriptionText ? `(${descriptionText})` : ""}`;
    } else {
      descriptionText = `Продаж аксесуару ${descriptionText ? `(${descriptionText})` : ""}`;
    }

    // 3. Create the sale record
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_id: parsed.customer_id,
        total_amount: parsed.amount,
        discount: parsed.discount,
        notes: descriptionText,
        created_by: userId,
        sale_type: parsed.sale_type,
        delivery_needed: parsed.delivery_needed,
        delivery_address: parsed.delivery_address,
        delivery_tracking: parsed.delivery_tracking,
        warranty_start: parsed.warranty_start,
        warranty_end: parsed.warranty_end,
        return_reason: parsed.return_reason,
        monobank_payment_id: parsed.monobank_payment_id,
        partner_id: parsed.partner_id,
        promo_code_used: parsed.promo_code_used
      } as Database["public"]["Tables"]["sales"]["Insert"])
      .select("id")
      .single();

    if (saleError) throw saleError;

    // 4. Process the item
    if (parsed.item_category === "device" && parsed.item_id) {
      // 1. Fetch device cost price
      const { data: dev } = await supabase
        .from("devices")
        .select("cost_price")
        .eq("id", parsed.item_id)
        .single();
      const costPrice = dev?.cost_price || 0;

      await supabase.from("sale_items").insert({
        sale_id: sale.id,
        item_type: "device",
        item_id: parsed.item_id,
        quantity: 1,
        unit_price: parsed.amount,
        total_price: parsed.amount,
        unit_cost: costPrice
      });
      await supabase.from("devices").update({ status: "sold" }).eq("id", parsed.item_id);
    } else if (parsed.item_category === "accessory" && parsed.item_id) {
      // 1. Read current stock and cost price
      const { data: acc, error: accReadErr } = await supabase
        .from("accessories")
        .select("stock, cost_price")
        .eq("id", parsed.item_id)
        .single();

      if (accReadErr || !acc) throw new Error("Аксесуар не знайдено");
      if (acc.stock < 1) throw new Error("Аксесуар закінчився на складі");

      // 2. Optimistic lock — update WHERE stock = known_value
      // If another request changed stock between our read and write → 0 rows updated → conflict
      const { data: updatedAcc, error: accUpdateErr } = await supabase
        .from("accessories")
        .update({ stock: acc.stock - 1 })
        .eq("id", parsed.item_id)
        .eq("stock", acc.stock) // optimistic lock condition
        .select("id");

      if (accUpdateErr) throw accUpdateErr;
      if (!updatedAcc || updatedAcc.length === 0) {
        throw new Error("Конфлікт залишку: аксесуар щойно продано. Спробуйте ще раз.");
      }

      await supabase.from("sale_items").insert({
        sale_id: sale.id,
        item_type: "accessory",
        item_id: parsed.item_id,
        quantity: 1,
        unit_price: parsed.amount,
        total_price: parsed.amount,
        unit_cost: acc.cost_price || 0
      });
    }

    // 5. Process payments (split or single)
    interface PaymentSplitData {
      amount: number;
      method: "cash" | "card" | "transfer";
    }
    
    const payments: PaymentSplitData[] = [];
    if (parsed.is_split) {
      if (parsed.cash_amount > 0) {
        payments.push({ amount: parsed.cash_amount, method: "cash" });
      }
      if (parsed.card_amount > 0) {
        payments.push({ amount: parsed.card_amount, method: "card" });
      }
      
      const totalSplit = parsed.cash_amount + parsed.card_amount;
      if (Math.abs(totalSplit - parsed.amount) > 1) {
        throw new Error(`Сума частин спліту (${totalSplit} грн) не збігається з сумою до оплати (${parsed.amount} грн)`);
      }
    } else {
      payments.push({ amount: parsed.amount, method: parsed.method });
    }

    for (const p of payments) {
      // Create payment split record
      const { error: splitError } = await supabase
        .from("payment_splits")
        .insert({
          sale_id: sale.id,
          amount: p.amount,
          method: p.method,
          cash_register_id: targetRegisterId
        });

      if (splitError) throw splitError;

      // Create transaction log
      const paymentMethodText = p.method === "cash" ? "Готівка" : p.method === "card" ? "Картка" : "Переказ";
      const { error: txError } = await supabase
        .from("transactions")
        .insert({
          amount: p.amount,
          to_type: "cash_register",
          to_id: targetRegisterId,
          from_type: parsed.customer_id ? "customer" : "external",
          from_id: parsed.customer_id,
          reference_type: "sale",
          reference_id: sale.id,
          description: `${descriptionText} [Оплата: ${paymentMethodText}]`,
          created_by: userId
        });

      if (txError) throw txError;

      // Update cash register balance
      const { data: cr } = await supabase
        .from("cash_registers")
        .select("balance")
        .eq("id", targetRegisterId)
        .single();
        
      if (cr) {
        await supabase
          .from("cash_registers")
          .update({ balance: cr.balance + p.amount })
          .eq("id", targetRegisterId);
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/accessories");
    
    return { success: true, data: { saleId: sale.id } };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function reconcileSaleWithMonobank(saleId: string, monobankPaymentId: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("sales")
      .update({ monobank_payment_id: monobankPaymentId })
      .eq("id", saleId);
    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const multiSaleItemSchema = z.object({
  item_type: z.enum(["device", "accessory", "part", "service"]),
  item_id: z.string().uuid(),
  item_name: z.string().optional(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  unit_cost: z.number().nonnegative(),
});

const multiSaleSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  discount: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().optional(),
  is_split: z.coerce.boolean().optional().default(false),
  cash_amount: z.coerce.number().min(0).optional().default(0),
  card_amount: z.coerce.number().min(0).optional().default(0),
  method: z.enum(["cash", "card", "transfer"]).optional().default("cash"),
  sale_type: z.enum(["online", "retail"]).optional().default("retail"),
  delivery_needed: z.coerce.boolean().optional().default(false),
  delivery_address: z.string().nullable().optional(),
  delivery_tracking: z.string().nullable().optional(),
  warranty_start: z.string().nullable().optional(),
  warranty_end: z.string().nullable().optional(),
  partner_id: z.string().uuid().nullable().optional(),
  promo_code_used: z.string().nullable().optional(),
  items: z.array(multiSaleItemSchema).min(1, "Кошик не може бути порожнім"),
});

export async function createMultiSaleAction(prevState: ActionState | null, formDataJson: unknown): Promise<ActionState<{ saleId: string }>> {
  let createdSaleId: string | null = null;

  try {
    const parsed = multiSaleSchema.parse(formDataJson);
    const supabase = await createClient();

    // 1. Get the current user profile ID for created_by
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }
    const userId = user.id;

    // 2. Calculate final amounts
    const subtotal = parsed.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const discountAmount = Math.round(subtotal * (parsed.discount / 100));
    const finalTotal = Math.max(0, subtotal - discountAmount);
    const itemLines = parsed.items.map((item) => {
      const itemName = item.item_name?.trim() || item.item_id;
      const lineTotal = item.unit_price * item.quantity;
      return `- ${itemName}: ${item.quantity} x ${item.unit_price} грн = ${lineTotal} грн`;
    });
    const saleNotes = [
      parsed.notes?.trim() || "Мультитоварний продаж POS",
      "Позиції:",
      ...itemLines
    ].join("\n");

    // 3. Resolve Cash Registers
    const { data: registers, error: regError } = await supabase
      .from("cash_registers")
      .select("id, type");
    
    if (regError) throw regError;
    const regMap = registers?.reduce((acc, r) => ({ ...acc, [r.type]: r.id }), {} as Record<string, string>) || {};

    // 4. Process all inventory items (validations and updates)
    for (const item of parsed.items) {
      if (item.item_type === "device") {
        const { data: device, error: devErr } = await supabase
          .from("devices")
          .select("status, brand, model")
          .eq("id", item.item_id)
          .single();
        if (devErr || !device) throw new Error(`Пристрій не знайдено в системі.`);
        if (device.status !== "in_stock") throw new Error(`Пристрій вже продано або заброньовано.`);

        const { data: updatedDev, error: devUpErr } = await supabase
          .from("devices")
          .update({ status: "sold" })
          .eq("id", item.item_id)
          .eq("status", "in_stock")
          .select("id");
        if (devUpErr) throw devUpErr;
        if (!updatedDev || updatedDev.length === 0) {
          throw new Error(`Пристрій "${device.brand || ""} ${device.model || ""}" вже продано або заброньовано.`);
        }

      } else if (item.item_type === "accessory") {
        const { data: acc, error: accErr } = await supabase
          .from("accessories")
          .select("stock")
          .eq("id", item.item_id)
          .single();
        if (accErr || !acc) throw new Error(`Аксесуар не знайдено.`);
        if (acc.stock < item.quantity) throw new Error(`Недостатній залишок аксесуару на складі.`);

        const { data: updatedAcc, error: accUpErr } = await supabase
          .from("accessories")
          .update({ stock: acc.stock - item.quantity })
          .eq("id", item.item_id)
          .eq("stock", acc.stock)
          .select("id");
        if (accUpErr) throw accUpErr;
        if (!updatedAcc || updatedAcc.length === 0) {
          throw new Error("Конфлікт залишків для аксесуару. Спробуйте ще раз.");
        }

      } else if (item.item_type === "part") {
        const { data: part, error: partErr } = await supabase
          .from("parts")
          .select("stock")
          .eq("id", item.item_id)
          .single();
        if (partErr || !part) throw new Error(`Запчастину не знайдено.`);
        if (part.stock < item.quantity) throw new Error(`Недостатній залишок запчастини на складі.`);

        const { data: updatedPart, error: partUpErr } = await supabase
          .from("parts")
          .update({ stock: part.stock - item.quantity })
          .eq("id", item.item_id)
          .eq("stock", part.stock)
          .select("id");
        if (partUpErr) throw partUpErr;
        if (!updatedPart || updatedPart.length === 0) {
          throw new Error("Конфлікт залишків для запчастини. Спробуйте ще раз.");
        }
      }
    }

    // 5. Create the header sale record
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_id: parsed.customer_id,
        total_amount: finalTotal,
        discount: parsed.discount,
        notes: saleNotes,
        created_by: userId,
        sale_type: parsed.sale_type,
        delivery_needed: parsed.delivery_needed,
        delivery_address: parsed.delivery_address,
        delivery_tracking: parsed.delivery_tracking,
        warranty_start: parsed.warranty_start,
        warranty_end: parsed.warranty_end,
        partner_id: parsed.partner_id,
        promo_code_used: parsed.promo_code_used,
      } as Database["public"]["Tables"]["sales"]["Insert"])
      .select("id")
      .single();

    if (saleError) throw saleError;
    createdSaleId = sale.id;

    // 6. Bulk Insert sale items
    const insertItems = parsed.items.map((item) => ({
      sale_id: sale.id,
      item_type: item.item_type,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
      unit_cost: item.unit_cost,
    }));

    const { error: itemsError } = await supabase
      .from("sale_items")
      .insert(insertItems);
    if (itemsError) throw itemsError;

    // 7. Calculate split cash register portions proportionally
    let techSubtotal = 0;
    let accSubtotal = 0;
    let repSubtotal = 0;

    parsed.items.forEach((item) => {
      const lineTotal = item.unit_price * item.quantity;
      if (item.item_type === "device") techSubtotal += lineTotal;
      else if (item.item_type === "accessory") accSubtotal += lineTotal;
      else repSubtotal += lineTotal; // parts & services route to repairs cash register
    });

    const totalLinesSum = techSubtotal + accSubtotal + repSubtotal;
    const techFactor = totalLinesSum > 0 ? techSubtotal / totalLinesSum : 0;
    const accFactor = totalLinesSum > 0 ? accSubtotal / totalLinesSum : 0;

    const techAmountFinal = Math.round(finalTotal * techFactor);
    const accAmountFinal = Math.round(finalTotal * accFactor);

    interface PaymentSplitData {
      amount: number;
      method: "cash" | "card" | "transfer";
    }
    const payments: PaymentSplitData[] = [];
    if (parsed.is_split) {
      if (parsed.cash_amount > 0) payments.push({ amount: parsed.cash_amount, method: "cash" });
      if (parsed.card_amount > 0) payments.push({ amount: parsed.card_amount, method: "card" });
      const totalSplit = parsed.cash_amount + parsed.card_amount;
      if (Math.abs(totalSplit - finalTotal) > 1) {
        throw new Error(`Сума частин спліту (${totalSplit} грн) не збігається з сумою до оплати (${finalTotal} грн)`);
      }
    } else {
      payments.push({ amount: finalTotal, method: parsed.method });
    }

    // Pro-rata distribution of payment amounts to their respective registers
    for (const p of payments) {
      const distribution = [
        { type: "tech", amount: Math.round(p.amount * (techAmountFinal / finalTotal)) },
        { type: "accessories", amount: Math.round(p.amount * (accAmountFinal / finalTotal)) },
        { type: "repairs", amount: 0 }
      ];
      distribution[2].amount = p.amount - distribution[0].amount - distribution[1].amount;

      for (const dist of distribution) {
        if (dist.amount <= 0) continue;
        const targetRegisterId = regMap[dist.type];
        if (!targetRegisterId) continue;

        const { error: splitError } = await supabase
          .from("payment_splits")
          .insert({
            sale_id: sale.id,
            amount: dist.amount,
            method: p.method,
            cash_register_id: targetRegisterId
          });
        if (splitError) throw splitError;

        const paymentMethodText = p.method === "cash" ? "Готівка" : p.method === "card" ? "Картка" : "Переказ";
        const catText = dist.type === "tech" ? "Техніка" : dist.type === "accessories" ? "Аксесуари" : "Послуги";
        const { error: txError } = await supabase
          .from("transactions")
          .insert({
            amount: dist.amount,
            to_type: "cash_register",
            to_id: targetRegisterId,
            from_type: parsed.customer_id ? "customer" : "external",
            from_id: parsed.customer_id,
            reference_type: "sale",
            reference_id: sale.id,
            description: `${parsed.notes || "POS Продаж"}: ${catText} [Оплата: ${paymentMethodText}]`,
            created_by: userId
          });
        if (txError) throw txError;

        const { data: cr } = await supabase
          .from("cash_registers")
          .select("balance")
          .eq("id", targetRegisterId)
          .single();
        if (cr) {
          await supabase
            .from("cash_registers")
            .update({ balance: cr.balance + dist.amount })
            .eq("id", targetRegisterId);
        }
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/accessories");
    revalidatePath("/admin/parts");
    revalidatePath("/admin/devices");

    return { success: true, data: { saleId: sale.id } };
  } catch (err) {
    console.error("MultiSaleAction Error:", err);
    if (createdSaleId) {
      const supabase = await createClient();
      await supabase.from("sales").delete().eq("id", createdSaleId);
    }
    return { success: false, error: parseError(err) };
  }
}

export async function deleteSaleAction(saleId: string): Promise<ActionState> {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }

    // 2. Fetch user role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Не вдалося перевірити права доступу користувача.");
    }

    // 3. Enforce authorization rules (only owner or manager)
    if (profile.role !== "owner" && profile.role !== "manager") {
      throw new Error("Недостатньо прав для видалення продажів. Ця дія дозволена тільки власникам та менеджерам.");
    }

    // 4. Invoke the atomic stored procedure to delete the sale and revert all dependencies
    const { error: rpcError } = await supabase.rpc("delete_sale", {
      sale_id_to_delete: saleId
    });

    if (rpcError) throw rpcError;

    // 5. Revalidate cache for layouts and tables
    revalidatePath("/admin");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/accessories");
    revalidatePath("/admin/parts");
    revalidatePath("/admin/devices");

    return { success: true };
  } catch (err) {
    console.error("deleteSaleAction Error:", err);
    return { success: false, error: parseError(err) };
  }
}

