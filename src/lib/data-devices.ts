import { createClient } from "./supabase/server";

export async function getDevices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error in getDevices:", error);
    return [];
  }
  return data ?? [];
}

