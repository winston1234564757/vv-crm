import { createClient } from "./supabase/server";

export async function getAccessories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accessories")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

