import { getCurrentUserRole } from "@/lib/utils/rbac";
import { canSeeMoney } from "@/lib/roles";
import { getSettings } from "@/lib/data-settings";
import { getOperationsData } from "@/lib/data-operations";
import { getDashboardMoney } from "@/lib/data-dashboard";
import { findAttention } from "@/lib/attention";
import { isRangePreset, type RangePreset } from "@/lib/profit";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getCurrentUserRole();
  if (!session) return null;

  const { user, role } = session;
  const showMoney = canSeeMoney(role);

  const { range } = await searchParams;
  const preset: RangePreset = isRangePreset(range) ? range : "today";

  // Гроші не просто ховаються в розмітці — вони не читаються з бази взагалі.
  // Інакше прибуток і залишки кас доїхали б у клієнтський payload, де їх
  // видно в DevTools попри відсутність на екрані.
  const [settings, operations, money] = await Promise.all([
    getSettings(),
    getOperationsData(),
    showMoney ? getDashboardMoney(preset, user.id) : null,
  ]);

  // `findAttention` — чиста функція, тож рахуємо її тут, а не в браузері:
  // на клієнт їде вже готовий список, а не всі рядки ремонтів і складу.
  const attention = findAttention(operations.attention, new Date());

  return (
    <DashboardClient
      preset={preset}
      attention={attention}
      money={money}
      operations={operations}
      targets={settings.sales_targets}
    />
  );
}
