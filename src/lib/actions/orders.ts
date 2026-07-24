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

const orderSchema = z.object({
  customer_id: z.string().uuid("Оберіть клієнта"),
  item_type: z.enum(["device", "accessory", "part", "service"]),
  item_name: z.string().min(2, "Вкажіть назву товару"),
  item_url: z.string().trim().url("Некоректне посилання").nullable().optional(),
  agreed_price: z.coerce.number().int().min(0).default(0),
  deposit: z.coerce.number().int().min(0).default(0),
  deadline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createClientOrder(
  prevState: ActionState<CreatedClientOrder> | null,
  formData: FormData,
): Promise<ActionState<CreatedClientOrder>> {
  try {
    const urlRaw = (formData.get("item_url") as string | null)?.trim();
    const data = {
      customer_id: formData.get("customer_id"),
      item_type: formData.get("item_type"),
      item_name: formData.get("item_name"),
      item_url: urlRaw ? urlRaw : null,
      agreed_price: formData.get("agreed_price") || 0,
      deposit: formData.get("deposit") || 0,
      deadline: (formData.get("deadline") as string | null) || null,
      notes: (formData.get("notes") as string | null) || null,
    };

    const parsed = orderSchema.parse(data);

    if (parsed.deposit > parsed.agreed_price) {
      return { success: false, error: "Аванс не може перевищувати узгоджену ціну" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Касу шукаємо лише коли справді є аванс — інакше рух грошей не потрібен.
    let registerId: string | null = null;
    if (parsed.deposit > 0) {
      const registerType = REGISTER_TYPE_BY_ITEM[parsed.item_type];
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
      p_item_type: parsed.item_type,
      p_item_name: parsed.item_name,
      p_item_url: parsed.item_url ?? null,
      p_agreed_price: parsed.agreed_price,
      p_deposit: parsed.deposit,
      p_deadline: parsed.deadline || null,
      p_notes: parsed.notes ?? null,
      p_user_id: user?.id ?? null,
      p_register_id: registerId,
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
