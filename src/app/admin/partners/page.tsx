import { createClient } from "@/lib/supabase/server";
import { PartnersClient } from "./PartnersClient";

export const metadata = {
  title: "Партнерська Програма | VV CRM",
};

export default async function PartnersPage() {
  const supabase = await createClient();

  // Отримуємо всіх партнерів (RLS забезпечить доступ для authenticated)
  const { data: partners, error } = await supabase
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching partners:", error);
  }

  return <PartnersClient initialPartners={partners || []} />;
}
