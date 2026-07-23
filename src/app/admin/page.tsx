import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data-settings";
import { getAttentionData } from "@/lib/data-attention";
import { getDashboardMoney } from "@/lib/data-dashboard";
import { getDailyShares } from "@/lib/data-daily-share";
import { isRangePreset, type RangePreset } from "@/lib/profit";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { range } = await searchParams;
  const preset: RangePreset = isRangePreset(range) ? range : "today";

  const [settings, attention, money, daily] = await Promise.all([
    getSettings(),
    getAttentionData(),
    getDashboardMoney(preset),
    getDailyShares(),
  ]);

  return (
    <DashboardClient
      preset={preset}
      attention={attention}
      money={money}
      targets={settings.sales_targets}
      daily={daily}
    />
  );
}
