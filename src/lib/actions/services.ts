"use server";
import { requireRole } from "@/lib/utils/rbac";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { uploadMediaFiles } from "@/lib/supabase/storage";

type DeviceUpdate = Database["public"]["Tables"]["devices"]["Update"];
type AccessoryInsert = Database["public"]["Tables"]["accessories"]["Insert"];
type AccessoryUpdate = Database["public"]["Tables"]["accessories"]["Update"];
type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];


const serviceSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  description: z.string().nullable().optional(),
  price: z.coerce.number().min(0, "Ціна не може бути від'ємною"),
  category: z.string().min(1, "Категорія обов'язкова"),
  is_visible: z.coerce.boolean().optional().default(true),
  photo_urls: z.array(z.string()).optional().default([]),
  warranty_days: z.coerce.number().min(0).nullable().optional(),
  duration_minutes: z.coerce.number().min(0).nullable().optional(),
});


export async function createService(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      description: formData.get("description") || null,
      price: formData.get("price"),
      category: formData.get("category"),
      is_visible: formData.get("is_visible") === "true",
      warranty_days: formData.get("warranty_days") || null,
      duration_minutes: formData.get("duration_minutes") || null,
      photo_urls: [],
    };

    const parsed = serviceSchema.parse(data);

    // Upload photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      parsed.photo_urls = await uploadMediaFiles(photoFiles, "services");
    }

    const supabase = await createClient();
    const { error } = await supabase.from("services").insert(parsed as ServiceInsert);
    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateService(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      name: formData.get("name"),
      description: formData.get("description") || null,
      price: formData.get("price"),
      category: formData.get("category"),
      is_visible: formData.get("is_visible") === "true",
      warranty_days: formData.get("warranty_days") || null,
      duration_minutes: formData.get("duration_minutes") || null,
      photo_urls: [], // we will update this separately
    };

    const parsed = serviceSchema.parse(data);

    const supabase = await createClient();
    
    // Upload new photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      const newPhotoUrls = await uploadMediaFiles(photoFiles, "services");
      
      // Get existing photos
      const { data: existingService } = await supabase.from("services").select("photo_urls").eq("id", id).single();
      const existingPhotos = existingService?.photo_urls || [];
      
      parsed.photo_urls = [...existingPhotos, ...newPhotoUrls];
    } else {
      // Keep existing
      const { data: existingService } = await supabase.from("services").select("photo_urls").eq("id", id).single();
      parsed.photo_urls = existingService?.photo_urls || [];
    }

    const { error } = await supabase.from("services").update(parsed as ServiceUpdate).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteService(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
    const supabase = await createClient();
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
