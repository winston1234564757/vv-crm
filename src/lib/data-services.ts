import { createClient } from "./supabase/server";

export async function getServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

