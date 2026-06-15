import { createClient } from "@/lib/supabase/server";
import { getSales } from "@/lib/data-sales";
import { PartnersClient, type PartnerData } from "./PartnersClient";

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

  const sales = await getSales();

  return <PartnersClient initialPartners={(partners as PartnerData[]) || []} sales={sales} />;
}
