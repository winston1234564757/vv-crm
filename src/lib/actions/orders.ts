"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/utils/rbac";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { CreatedClientOrder, OrderItemType, OrderStatus } from "@/types/orders";

const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "ordered",
  "arrived",
  "ready",
  "completed",
  "cancelled",
];

/**
 * Каса для авансу обирається за категорією товару — той самий маршрут, що й у
 * продажах (`sales.ts`): техніка → каса техніки, аксесуар → каса аксесуарів,
 * запчастина/послуга → каса ремонтів.
 */
const REGISTER_TYPE_BY_ITEM: Record<OrderItemType, string> = {
  device: "tech",
  accessory: "accessories",
  part: "repairs",
  service: "repairs",
};

const orderItemSchema = z.object({
  item_type: z.enum(["device", "accessory", "part", "service"]),
  item_name: z.string().trim().min(2, "Вкажіть назву товару"),
  item_url: z.string().trim().url("Некоректне посилання").nullable().optional(),
  unit_price: z.coerce.number().int().min(0).default(0),
  quantity: z.coerce.number().int().min(1).default(1),
});

const orderSchema = z.object({
  customer_id: z.string().uuid("Оберіть клієнта"),
  items: z.array(orderItemSchema).min(1, "Додайте хоча б один товар"),
  deposit: z.coerce.number().int().min(0).default(0),
  deadline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createClientOrder(
  prevState: ActionState<CreatedClientOrder> | null,
  formData: FormData,
): Promise<ActionState<CreatedClientOrder>> {
  try {
    let itemsRaw: unknown = [];
    try {
      itemsRaw = JSON.parse((formData.get("items") as string) || "[]");
    } catch {
      return { success: false, error: "Некоректний список товарів" };
    }

    const parsed = orderSchema.parse({
      customer_id: formData.get("customer_id"),
      items: itemsRaw,
      deposit: formData.get("deposit") || 0,
      deadline: (formData.get("deadline") as string | null) || null,
      notes: (formData.get("notes") as string | null) || null,
    });

    const total = parsed.items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);

    if (parsed.deposit > total) {
      return { success: false, error: "Аванс не може перевищувати підсумок" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Касу шукаємо лише коли є аванс. Для змішаного замовлення маршрутизуємо
    // за категорією першої позиції — той самий принцип, що й у продажах.
    let registerId: string | null = null;
    if (parsed.deposit > 0) {
      const registerType = REGISTER_TYPE_BY_ITEM[parsed.items[0].item_type];
      const { data: register, error: regError } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("type", registerType)
        .single();
      if (regError || !register) {
        return { success: false, error: "Не знайдено касу для авансу" };
      }
      registerId = register.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase as any).rpc("create_client_order", {
      p_customer_id: parsed.customer_id,
      p_total: total,
      p_deposit: parsed.deposit,
      p_deadline: parsed.deadline || null,
      p_notes: parsed.notes ?? null,
      p_user_id: user?.id ?? null,
      p_register_id: registerId,
      p_items: parsed.items.map((it) => ({
        item_type: it.item_type,
        item_name: it.item_name,
        item_url: it.item_url ?? null,
        unit_price: it.unit_price,
        quantity: it.quantity,
      })),
    });

    if (error) throw error;

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return { success: true, data: result as CreatedClientOrder };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateOrderStatus(id: string, status: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);

    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      return { success: false, error: "Невідомий статус" };
    }

    const supabase = await createClient();
    // client_orders не в згенерованих типах — локальний каст (див. types/orders.ts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("client_orders")
      .update({ status })
      .eq("id", id);
    if (error) throw error;

    // Історія статусів пишеться тригером log_client_order_status (auth.uid()).
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteClientOrder(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("client_orders").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
