import { createClient } from "./server";

/**
 * Uploads an array of File objects to the "crm_media" Supabase Storage bucket.
 * Returns an array of public URLs for the uploaded files.
 * @param files Array of files to upload (e.g. from formData.getAll('photos'))
 * @param folder Optional folder prefix (e.g. "repairs", "devices")
 */
export async function uploadMediaFiles(files: File[], folder: string = "general"): Promise<string[]> {
  const supabase = await createClient();
  const urls: string[] = [];

  for (const file of files) {
    if (!file || file.size === 0) continue;

    // Sanitize file name and create a unique path
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage.from("crm_media").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      throw new Error(`Помилка завантаження файлу ${file.name}: ${error.message}`);
    }

    const { data } = supabase.storage.from("crm_media").getPublicUrl(filePath);
    if (data?.publicUrl) {
      urls.push(data.publicUrl);
    }
  }

  return urls;
}
