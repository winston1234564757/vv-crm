"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

const distributionPartSchema = z.object({
  opex: z.coerce.number().min(0).max(100, "Частка має бути від 0 до 100%"),
  growth: z.coerce.number().min(0).max(100, "Частка має бути від 0 до 100%"),
  net_profit: z.coerce.number().min(0).max(100, "Частка має бути від 0 до 100%"),
});

const settingsSchema = z.object({
  shop_name: z.string().min(2, "Назва магазину має містити хоча б 2 символи"),
  tech_opex: z.coerce.number(),
  tech_growth: z.coerce.number(),
  tech_profit: z.coerce.number(),
  acc_opex: z.coerce.number(),
  acc_growth: z.coerce.number(),
  acc_profit: z.coerce.number(),
  rep_opex: z.coerce.number(),
  rep_growth: z.coerce.number(),
  rep_profit: z.coerce.number(),
});

export async function updateSettingsAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  try {
    const rawData = {
      shop_name: formData.get("shop_name"),
      tech_opex: formData.get("tech_opex"),
      tech_growth: formData.get("tech_growth"),
      tech_profit: formData.get("tech_profit"),
      acc_opex: formData.get("acc_opex"),
      acc_growth: formData.get("acc_growth"),
      acc_profit: formData.get("acc_profit"),
      rep_opex: formData.get("rep_opex"),
      rep_growth: formData.get("rep_growth"),
      rep_profit: formData.get("rep_profit"),
    };

    const parsed = settingsSchema.parse(rawData);

    // Validate splits
    const techSplit = distributionPartSchema.parse({
      opex: parsed.tech_opex,
      growth: parsed.tech_growth,
      net_profit: parsed.tech_profit,
    });
    if (techSplit.opex + techSplit.growth + techSplit.net_profit !== 100) {
      throw new Error("Розподіл для техніки має сумарно складати 100%");
    }

    const accSplit = distributionPartSchema.parse({
      opex: parsed.acc_opex,
      growth: parsed.acc_growth,
      net_profit: parsed.acc_profit,
    });
    if (accSplit.opex + accSplit.growth + accSplit.net_profit !== 100) {
      throw new Error("Розподіл для аксесуарів має сумарно складати 100%");
    }

    const repSplit = distributionPartSchema.parse({
      opex: parsed.rep_opex,
      growth: parsed.rep_growth,
      net_profit: parsed.rep_profit,
    });
    if (repSplit.opex + repSplit.growth + repSplit.net_profit !== 100) {
      throw new Error("Розподіл для ремонтів має сумарно складати 100%");
    }

    const supabase = await createClient();

    // Check authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Неавторизовано");

    // Fetch user profile to verify role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" && user.email !== "viktor.koshel24@gmail.com") {
      throw new Error("Тільки власник може змінювати налаштування системи");
    }

    // Update keys
    const updates = [
      supabase.from("settings").upsert({ key: "shop_name", value: parsed.shop_name }),
      supabase.from("settings").upsert({ key: "distribution_tech", value: techSplit }),
      supabase.from("settings").upsert({ key: "distribution_accessories", value: accSplit }),
      supabase.from("settings").upsert({ key: "distribution_repairs", value: repSplit }),
    ];

    const results = await Promise.all(updates);
    for (const res of results) {
      if (res.error) throw res.error;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/settings");

    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateProfileRoleAction(
  profileId: string,
  role: string
): Promise<ActionState> {
  try {
    const validRoles = ["owner", "manager", "sales", "technician"];
    if (!validRoles.includes(role)) {
      throw new Error("Невалідна роль користувача");
    }

    const supabase = await createClient();

    // Check authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Неавторизовано");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner" && user.email !== "viktor.koshel24@gmail.com") {
      throw new Error("Тільки власник може змінювати ролі користувачів");
    }

    if (profileId === user.id) {
      throw new Error("Ви не можете змінити власну роль");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", profileId);

    if (error) throw error;

    revalidatePath("/admin/settings");

    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
