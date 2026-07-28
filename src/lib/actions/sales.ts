"use server";
import { requireRole } from "@/lib/utils/rbac";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import { targetRegisterType } from "@/lib/utils/finance";
import type { ActionState } from "./types";

const saleSchema = z.object({
  is_warranty: z.boolean().optional().default(false),
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
      is_warranty: formData.get("is_warranty") === "true",
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
    if (parsed.is_warranty) {
      parsed.amount = 0;
      parsed.cash_amount = 0;
      parsed.card_amount = 0;
    }
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
    
    // Категорія більше не вирішує сама: карткова частина чека належить
    // рахунку безготівки, готівкова — касі за категорією товару.
    const cashRegType = targetRegisterType("cash", parsed.item_category);
    const targetRegisterId = regMap[cashRegType];
    if (!targetRegisterId) {
      throw new Error(`Касу типу "${cashRegType}" не знайдено в системі.`);
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

    // Build payment parts. Validation stays in JS to give clear user-facing errors.
    interface PaymentSplitData {
      amount: number;
      method: "cash" | "card" | "transfer";
      cash_register_id: string;
    }

    function registerFor(method: string): string {
      const type = targetRegisterType(method, parsed.item_category);
      const id = regMap[type];
      if (!id) throw new Error(`Касу типу "${type}" не знайдено в системі.`);
      return id;
    }

    const payments: PaymentSplitData[] = [];
    if (parsed.is_split) {
      if (parsed.cash_amount > 0) {
        payments.push({
          amount: parsed.cash_amount,
          method: "cash",
          cash_register_id: registerFor("cash"),
        });
      }
      if (parsed.card_amount > 0) {
        payments.push({
          amount: parsed.card_amount,
          method: "card",
          cash_register_id: registerFor("card"),
        });
      }

      const totalSplit = parsed.cash_amount + parsed.card_amount;
      if (Math.abs(totalSplit - parsed.amount) > 1) {
        throw new Error(`Сума частин спліту (${totalSplit} грн) не збігається з сумою до оплати (${parsed.amount} грн)`);
      }
    } else if (parsed.amount > 0) {
      payments.push({
        amount: parsed.amount,
        method: parsed.method,
        cash_register_id: registerFor(parsed.method),
      });
    }

    // Atomic write: sale header + item stock + payment splits + transactions +
    // cash register balance, all in one DB transaction (no partial state on failure).
    // @ts-expect-error - process_quick_sale is not in generated database.ts types
    const { data: newSaleId, error: rpcError } = await supabase.rpc("process_quick_sale", {
      p_is_warranty: parsed.is_warranty,
      p_customer_id: parsed.customer_id ?? null,
      p_amount: parsed.amount,
      p_discount: parsed.discount,
      p_notes: descriptionText,
      p_created_by: userId,
      p_sale_type: parsed.sale_type,
      p_delivery_needed: parsed.delivery_needed,
      p_delivery_address: parsed.delivery_address ?? null,
      p_delivery_tracking: parsed.delivery_tracking ?? null,
      p_warranty_start: parsed.warranty_start ?? null,
      p_warranty_end: parsed.warranty_end ?? null,
      p_return_reason: parsed.return_reason ?? null,
      p_monobank_payment_id: parsed.monobank_payment_id ?? null,
      p_partner_id: parsed.partner_id ?? null,
      p_promo_code_used: parsed.promo_code_used ?? null,
      p_item_category: parsed.item_category,
      p_item_id: parsed.item_id ?? null,
      p_cash_register_id: targetRegisterId,
      p_payments: payments,
    });

    if (rpcError) throw rpcError;

    revalidatePath("/admin");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/accessories");

    return { success: true, data: { saleId: newSaleId as unknown as string } };
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
  link_device_to_customer: z.coerce.boolean().optional().default(false),
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

    let deviceNameToLink: string | null = null;

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

    // 4. Prepare JSON payload for Items
    const rpcItems = parsed.items.map(item => ({
      item_type: item.item_type,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_cost: item.unit_cost,
    }));

    // 5. Prepare JSON payload for Payments (Calculate split proportions)
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

    const rpcPayments = [];
    // finalTotal === 0 (повністю знижений/безкоштовний продаж) → жодних оплат,
    // інакше ділення на нуль дає NaN, який просочується у суми транзакцій.
    for (const p of payments) {
      if (finalTotal <= 0) break;
      const distribution = [
        { type: "tech", amount: Math.round(p.amount * (techAmountFinal / finalTotal)) },
        { type: "accessories", amount: Math.round(p.amount * (accAmountFinal / finalTotal)) },
        { type: "repairs", amount: 0 }
      ];
      distribution[2].amount = p.amount - distribution[0].amount - distribution[1].amount;

      for (const dist of distribution) {
        if (!(dist.amount > 0)) continue;

        const category =
          dist.type === "tech" ? "device" : dist.type === "accessories" ? "accessory" : "service";
        const regType = targetRegisterType(p.method, category);
        const targetRegisterId = regMap[regType];
        // Пропустити рядок означало б створити продаж із нульовою оплатою:
        // виторг записано, грошей ніде, помилки нема. Швидкий продаж у цьому
        // ж файлі кидає — тут має бути так само.
        if (!targetRegisterId) {
          throw new Error(`Касу типу "${regType}" не знайдено в системі.`);
        }

        const paymentMethodText = p.method === "cash" ? "Готівка" : p.method === "card" ? "Картка" : "Переказ";
        const catText = dist.type === "tech" ? "Техніка" : dist.type === "accessories" ? "Аксесуари" : "Послуги";

        // Рядки лишаються розбитими по категоріях навіть коли всі вони їдуть
        // на один рахунок: категорія — єдине, що потім пояснює, за що гроші.
        rpcPayments.push({
          amount: dist.amount,
          method: p.method,
          cash_register_id: targetRegisterId,
          description: `${parsed.notes || "POS Продаж"}: ${catText} [Оплата: ${paymentMethodText}]`
        });
      }
    }

    // 6. Execute ATOMIC RPC 
    // @ts-expect-error - process_pos_sale is missing from database.ts types
    const { data: saleId, error: rpcError } = await supabase.rpc("process_pos_sale", {
      p_customer_id: parsed.customer_id || null,
      p_total_amount: finalTotal,
      p_discount: parsed.discount,
      p_notes: saleNotes,
      p_sale_type: parsed.sale_type,
      p_delivery_needed: parsed.delivery_needed,
      p_delivery_address: parsed.delivery_address || null,
      p_delivery_tracking: parsed.delivery_tracking || null,
      p_warranty_start: parsed.warranty_start || null,
      p_warranty_end: parsed.warranty_end || null,
      p_partner_id: parsed.partner_id || null,
      p_promo_code_used: parsed.promo_code_used || null,
      p_user_id: userId,
      p_items: rpcItems,
      p_payments: rpcPayments
    });

    if (rpcError) throw rpcError;
    createdSaleId = saleId as unknown as string;

    revalidatePath("/admin");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/accessories");
    revalidatePath("/admin/parts");
    revalidatePath("/admin/devices");

    if (parsed.customer_id && parsed.link_device_to_customer) {
      // Find device name from items for linking if requested
      const devItem = parsed.items.find(i => i.item_type === "device");
      if (devItem) {
        await supabase
          .from("customers")
          .update({ device_name: devItem.item_name || "Пристрій" })
          .eq("id", parsed.customer_id);
        revalidatePath("/admin/customers");
      }
    }

    return { success: true, data: { saleId: createdSaleId! } };
  } catch (err) {
    console.error("MultiSaleAction Error:", err);
    if (createdSaleId) {
      const supabase = await createClient();
      await supabase.from("sales").delete().eq("id", createdSaleId);
    }
    return { success: false, error: parseError(err) };
  }
}

export async function processRefundAction(saleId: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: " + (authError?.message || "User not found"));

    const { error } = await supabase.rpc("refund_sale", {
      sale_id_to_refund: saleId
    });

    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/finance");

    return { success: true };
  } catch (err) {
    console.error("processRefundAction Error:", err);
    return { success: false, error: parseError(err) };
  }
}

export async function deleteSaleAction(saleId: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
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

