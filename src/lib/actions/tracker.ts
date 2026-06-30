"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

export type TrackerRepair = {
  id: string;
  tracking_token: string | null;
  device_name: string;
  issue: string;
  status: string;
  price: number;
  created_at: string;
  completed_at: string | null;
  estimated_completion: string | null;
  warranty_months: number;
};

export async function getRepairsByPhone(phone: string): Promise<ActionState<TrackerRepair[]>> {
  try {
    // Очищаємо номер телефону (залишаємо тільки цифри, можливо плюс на початку)
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    
    if (cleanPhone.length < 9) {
      throw new Error("Введіть коректний номер телефону");
    }

    const supabase = createAdminClient();

    // Шукаємо клієнта за телефоном
    // В БД телефон може бути збережений у різних форматах, тому використовуємо ilike
    const { data: customers, error: customerErr } = await supabase
      .from("customers")
      .select("id")
      .ilike("phone", `%${cleanPhone.slice(-9)}%`)
      .limit(1);

    if (customerErr) throw customerErr;
    
    if (!customers || customers.length === 0) {
      throw new Error("Клієнта з таким номером телефону не знайдено. Перевірте правильність вводу.");
    }

    const customerId = customers[0].id;

    // Шукаємо ремонти клієнта
    const { data: repairs, error: repairsErr } = await supabase
      .from("repairs")
      .select(`
        id, 
        tracking_token, 
        device_name, 
        issue, 
        status, 
        price, 
        created_at, 
        completed_at, 
        estimated_completion, 
        warranty_months
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (repairsErr) throw repairsErr;

    return { success: true, data: repairs || [] };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
