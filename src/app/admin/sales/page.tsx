import StandardCard from "@/components/ui/StandardCard";
import { StatCard } from "@/components/ui/StatCard";
import { getSales, getSalesStats } from "@/lib/data-sales";
import { SalesTable } from "./table";
import { pluralUk } from "@/lib/utils/plural";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [sales, stats] = await Promise.all([getSales(), getSalesStats()]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-balance">Продажі</h1>
        <p className="mt-0.5 text-sm text-muted">
          {stats.totalSales} {pluralUk(stats.totalSales, "продаж", "продажі", "продажів")} у системі
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
        <StatCard label="Загальний оборот" value={`${stats.totalRevenue.toLocaleString()} ₴`} />
        <StatCard label="Кількість продажів" tone="info" value={stats.totalSales} />
        <StatCard label="Середній чек" tone="accent" value={`${stats.averageCheck.toLocaleString()} ₴`} />
      </div>

      <StandardCard>
        <SalesTable sales={sales} />
      </StandardCard>
    </div>
  );
}
