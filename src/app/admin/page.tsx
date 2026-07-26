import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data-settings";
import { getOperationsData } from "@/lib/data-operations";
import { getDashboardMoney } from "@/lib/data-dashboard";
import { findAttention } from "@/lib/attention";
import { isRangePreset, type RangePreset } from "@/lib/profit";
import { isDayKey, dayKey } from "@/lib/utils/day";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; day?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { range, day } = await searchParams;
  const preset: RangePreset = isRangePreset(range) ? range : "today";

  // Денна навігація живе лише на вкладці «Сьогодні». Сьогоднішній день — це
  // просто пресет `today`, тож `day` тримаємо тільки для минулих днів, щоб URL
  // не ніс надлишковий `?day=<сьогодні>`.
  const todayKey = dayKey(new Date());
  const selectedDay =
    preset === "today" && isDayKey(day) && day < todayKey ? day : null;

  const [settings, operations, money] = await Promise.all([
    getSettings(),
    getOperationsData(),
    getDashboardMoney(preset, user.id, selectedDay),
  ]);

  // `findAttention` — чиста функція, тож рахуємо її тут, а не в браузері:
  // на клієнт їде вже готовий список, а не всі рядки ремонтів і складу.
  const attention = findAttention(operations.attention, new Date());

  return (
    <DashboardClient
      preset={preset}
      selectedDay={selectedDay}
      attention={attention}
      money={money}
      operations={operations}
      targets={settings.sales_targets}
    />
  );
}
