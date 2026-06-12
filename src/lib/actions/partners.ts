"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

const partnerSchema = z.object({
  name: z.string().min(2, "Назва обов'язкова"),
  phone: z.string().min(5, "Телефон обов'язковий"),
  promo_code: z.string().min(3, "Промокод обов'язковий").toUpperCase(),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  reward_percent: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export async function createPartner(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      promo_code: formData.get("promo_code"),
      discount_percent: formData.get("discount_percent"),
      reward_percent: formData.get("reward_percent"),
      status: formData.get("status") || "active",
    };

    const parsed = partnerSchema.parse(data);
    const supabase = await createClient();

    // Перевірка на унікальність промокоду
    const { data: existing } = await supabase
      .from("partners")
      .select("id")
      .eq("promo_code", parsed.promo_code)
      .single();

    if (existing) {
      throw new Error("Такий промокод вже існує. Придумайте інший або згенеруйте новий.");
    }

    const { error } = await supabase.from("partners").insert(parsed);
    if (error) throw error;

    revalidatePath("/admin/partners");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updatePartner(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      promo_code: formData.get("promo_code"),
      discount_percent: formData.get("discount_percent"),
      reward_percent: formData.get("reward_percent"),
      status: formData.get("status") || "active",
    };

    const parsed = partnerSchema.parse(data);
    const supabase = await createClient();

    // Перевірка унікальності (крім поточного партнера)
    const { data: existing } = await supabase
      .from("partners")
      .select("id")
      .eq("promo_code", parsed.promo_code)
      .neq("id", id)
      .single();

    if (existing) {
      throw new Error("Такий промокод вже існує в іншого партнера.");
    }

    const { error } = await supabase.from("partners").update(parsed).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/partners");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function validatePromoCode(promo_code: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partners")
      .select("id, name, discount_percent, reward_percent, status")
      .eq("promo_code", promo_code.toUpperCase())
      .single();

    if (error || !data) return { success: false, error: "Промокод не знайдено" };
    if (data.status !== "active") return { success: false, error: "Промокод не активний" };

    return { success: true, partner: data };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
