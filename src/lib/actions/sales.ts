"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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

export async function createQuickSale(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
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
      })
      .select("id")
      .single();

    if (saleError) throw saleError;

    // 4. Process the item
    if (parsed.item_category === "device" && parsed.item_id) {
      await supabase.from("sale_items").insert({
        sale_id: sale.id,
        item_type: "device",
        item_id: parsed.item_id,
        quantity: 1,
        unit_price: parsed.amount,
        total_price: parsed.amount
      });
      await supabase.from("devices").update({ status: "sold" }).eq("id", parsed.item_id);
    } else if (parsed.item_category === "accessory" && parsed.item_id) {
      await supabase.from("sale_items").insert({
        sale_id: sale.id,
        item_type: "accessory",
        item_id: parsed.item_id,
        quantity: 1,
        unit_price: parsed.amount,
        total_price: parsed.amount
      });
      const { data: acc } = await supabase.from("accessories").select("stock").eq("id", parsed.item_id).single();
      if (acc) {
        await supabase.from("accessories").update({ stock: Math.max(0, acc.stock - 1) }).eq("id", parsed.item_id);
      }
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
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports");
    
    return { success: true };
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

