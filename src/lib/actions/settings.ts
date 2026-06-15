"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    if (profile?.role !== "owner") {
      throw new Error("Тільки власник може змінювати налаштування системи");
    }

    // Update keys using admin client to bypass RLS policies for global settings
    const adminSupabase = createAdminClient();
    const updates = [
      adminSupabase.from("settings").upsert({ key: "shop_name", value: parsed.shop_name }, { onConflict: "key" }),
      adminSupabase.from("settings").upsert({ key: "distribution_tech", value: techSplit }, { onConflict: "key" }),
      adminSupabase.from("settings").upsert({ key: "distribution_accessories", value: accSplit }, { onConflict: "key" }),
      adminSupabase.from("settings").upsert({ key: "distribution_repairs", value: repSplit }, { onConflict: "key" }),
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

    if (profile?.role !== "owner") {
      throw new Error("Тільки власник може змінювати ролі користувачів");
    }

    if (profileId === user.id) {
      throw new Error("Ви не можете змінити власну роль");
    }

    // Check if we are demoting an owner, and ensure at least one owner remains
    const { data: profileToChange } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", profileId)
      .single();

    if (profileToChange?.role === "owner" && role !== "owner") {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "owner");

      if (count !== null && count <= 1) {
        throw new Error("Не можна понизити останнього власника в системі");
      }
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

const receiptTemplateSchema = z.object({
  title: z.string().min(2, "Заголовок шаблону має містити хоча б 2 символи").max(100, "Заголовок шаблону занадто довгий (макс. 100 символів)"),
  show_seller: z.preprocess((val) => val === "true" || val === true, z.boolean()),
  show_buyer: z.preprocess((val) => val === "true" || val === true, z.boolean()),
  warranty_text: z.string().min(2, "Текст гарантії має містити хоча б 2 символи").max(3000, "Текст гарантії занадто довгий (макс. 3000 символів)"),
  show_qr: z.preprocess((val) => val === "true" || val === true, z.boolean()),
});

const receiptSettingsSchema = z.object({
  company_name: z.string().min(2, "Назва компанії має містити хоча б 2 символи").max(100, "Назва компанії занадто довга (макс. 100 символів)"),
  company_subtitle: z.string().min(2, "Підзаголовок має містити хоча б 2 символи").max(150, "Підзаголовок занадто довгий (макс. 150 символів)"),
  address: z.string().min(2, "Адреса має містити хоча б 2 символи").max(200, "Адреса занадто довга (макс. 200 символів)"),
  phone: z.string().min(2, "Телефон має містити хоча б 2 символи").max(50, "Телефон занадто довгий (макс. 50 символів)"),
  footer_text: z.string().min(2, "Текст підвалу має містити хоча б 2 символи").max(3000, "Текст підвалу занадто довгий (макс. 3000 символів)"),
  templates: z.object({
    sale: receiptTemplateSchema,
    repair_acceptance: receiptTemplateSchema,
    repair_warranty: receiptTemplateSchema,
  }),
});

export async function updateReceiptSettingsAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  try {
    const rawData = {
      company_name: formData.get("company_name"),
      company_subtitle: formData.get("company_subtitle"),
      address: formData.get("address"),
      phone: formData.get("phone"),
      footer_text: formData.get("footer_text"),
      templates: {
        sale: {
          title: formData.get("sale_title"),
          show_seller: formData.get("sale_show_seller") === "true",
          show_buyer: formData.get("sale_show_buyer") === "true",
          warranty_text: formData.get("sale_warranty_text"),
          show_qr: formData.get("sale_show_qr") === "true",
        },
        repair_acceptance: {
          title: formData.get("repair_acceptance_title"),
          show_seller: formData.get("repair_acceptance_show_seller") === "true",
          show_buyer: formData.get("repair_acceptance_show_buyer") === "true",
          warranty_text: formData.get("repair_acceptance_warranty_text"),
          show_qr: formData.get("repair_acceptance_show_qr") === "true",
        },
        repair_warranty: {
          title: formData.get("repair_warranty_title"),
          show_seller: formData.get("repair_warranty_show_seller") === "true",
          show_buyer: formData.get("repair_warranty_show_buyer") === "true",
          warranty_text: formData.get("repair_warranty_warranty_text"),
          show_qr: formData.get("repair_warranty_show_qr") === "true",
        },
      },
    };

    const parsed = receiptSettingsSchema.parse(rawData);

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

    if (profile?.role !== "owner") {
      throw new Error("Тільки власник може змінювати налаштування системи");
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from("settings")
      .upsert({ key: "receipt_settings", value: parsed }, { onConflict: "key" });

    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/admin/settings");

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const detailedErrors = err.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      return { success: false, error: detailedErrors };
    }
    return { success: false, error: parseError(err) };
  }
}
