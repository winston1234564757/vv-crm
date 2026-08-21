import { getCurrentUserRole } from "@/lib/utils/rbac";
import { canSeeMoney } from "@/lib/roles";
import { getSettings } from "@/lib/data-settings";
import { getOperationsData } from "@/lib/data-operations";
import { getDashboardMoney } from "@/lib/data-dashboard";
import { getAveragesSinceEpoch } from "@/lib/data-averages";
import { findAttention } from "@/lib/attention";
import { isRangePreset, type RangePreset } from "@/lib/profit";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string }>;
}) {
  const session = await getCurrentUserRole();
  if (!session) return null;

  const { user, role } = session;
  const showMoney = canSeeMoney(role);

  const { range, date } = await searchParams;
  const preset: RangePreset = isRangePreset(range) ? range : "today";

  // Гроші не просто ховаються в розмітці — вони не читаються з бази взагалі.
  // Інакше прибуток і залишки кас доїхали б у клієнтський payload, де їх
  // видно в DevTools попри відсутність на екрані.
  const [settings, operations, money, averages] = await Promise.all([
    getSettings(),
    getOperationsData(),
    showMoney ? getDashboardMoney(preset, user.id, date) : null,
    showMoney ? getAveragesSinceEpoch() : null,
  ]);

  // `findAttention` — чиста функція, тож рахуємо її тут, а не в браузері:
  // на клієнт їде вже готовий список, а не всі рядки ремонтів і складу.
  const attention = findAttention(operations.attention, new Date());

  return (
    <DashboardClient
      preset={preset}
      attention={attention}
      money={money}
      averages={averages}
      operations={operations}
      targets={settings.sales_targets}
    />
  );
}
