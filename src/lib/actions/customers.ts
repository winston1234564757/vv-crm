"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

const customerSchema = z.object({
  name: z.string().min(2, "Ім'я повинно містити хоча б 2 символи"),
  phone: z.string().min(10, "Невірний формат телефону"),
  email: z.string().nullable().optional(),
  telegram_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  photo_urls: z.array(z.string()).optional().default([]),
  vip_status: z.string().optional().default("regular"),
  tags: z.array(z.string()).nullable().optional(),
  preferred_contact: z.string().optional().default("phone"),
  source: z.string().optional().default("walk_in"),
});

export async function createCustomer(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const tagsRaw = formData.get("tags");
    const tagsArray = typeof tagsRaw === "string" && tagsRaw.trim() ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email") || null,
      telegram_id: formData.get("telegram_id") || null,
      notes: formData.get("notes") || null,
      discount_percent: formData.get("discount_percent") || 0,
      vip_status: formData.get("vip_status") || "regular",
      tags: tagsArray.length ? tagsArray : null,
      preferred_contact: formData.get("preferred_contact") || "phone",
      source: formData.get("source") || "walk_in",
    };

    const parsed = customerSchema.parse(data);

    const supabase = await createClient();
    const { data: customer, error } = await supabase.from("customers").insert({
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      telegram_id: parsed.telegram_id,
      notes: parsed.notes,
      discount_percent: parsed.discount_percent,
      vip_status: parsed.vip_status,
      tags: tagsArray.length ? tagsArray : null,
      preferred_contact: parsed.preferred_contact,
      source: parsed.source,
      // orders_total, orders_completed, last_visit are computed by the system — not user inputs
    })
    .select("id, name, phone, discount_percent")
    .single();

    if (error) throw error;

    revalidatePath("/admin/customers");
    revalidatePath("/admin");
    
    return { success: true, data: customer };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateCustomer(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const tagsRaw = formData.get("tags");
    const tagsArray = typeof tagsRaw === "string" && tagsRaw.trim() ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email") || null,
      telegram_id: formData.get("telegram_id") || null,
      notes: formData.get("notes") || null,
      discount_percent: formData.get("discount_percent") || 0,
      vip_status: formData.get("vip_status") || "regular",
      tags: tagsArray.length ? tagsArray : null,
      preferred_contact: formData.get("preferred_contact") || "phone",
      source: formData.get("source") || "walk_in",
    };

    const parsed = customerSchema.parse(data);

    const supabase = await createClient();
    const { error } = await supabase.from("customers").update({
      ...parsed,
      tags: tagsArray.length ? tagsArray : null,
      // orders_total, orders_completed, last_visit are NOT updated from form
    }).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/customers");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteCustomer(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/customers");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
