"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

const supplierSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  contact_person: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createSupplier(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      contact_person: formData.get("contact_person") || null,
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      notes: formData.get("notes") || null,
    };
    const parsed = supplierSchema.parse(data);
    const supabase = await createClient();
    const { error } = await supabase.from("suppliers").insert(parsed);
    if (error) throw error;
    revalidatePath("/admin/suppliers");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateSupplier(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      contact_person: formData.get("contact_person") || null,
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      notes: formData.get("notes") || null,
    };
    const parsed = supplierSchema.parse(data);
    const supabase = await createClient();
    const { error } = await supabase.from("suppliers").update(parsed).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/suppliers");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteSupplier(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/suppliers");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
