import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data-settings";
import { getAttentionData } from "@/lib/data-attention";
import { getDashboardMoney } from "@/lib/data-dashboard";
import { getDailyShares } from "@/lib/data-daily-share";
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

  const [settings, attention, money, daily] = await Promise.all([
    getSettings(),
    getAttentionData(),
    getDashboardMoney(preset, user.id, selectedDay),
    getDailyShares(),
  ]);

  return (
    <DashboardClient
      preset={preset}
      selectedDay={selectedDay}
      attention={attention}
      money={money}
      targets={settings.sales_targets}
      daily={daily}
    />
  );
}
