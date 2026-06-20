import { getSales, getSalesStats } from "@/lib/data-sales";
import { SalesTable } from "./table";
import { pluralUk } from "@/lib/utils/plural";

export const dynamic = "force-dynamic";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

export default async function SalesPage() {
  const [sales, stats] = await Promise.all([
    getSales(),
    getSalesStats()
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Продажі</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {stats.totalSales} {pluralUk(stats.totalSales, "продаж", "продажі", "продажів")} у системі
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Загальний оборот</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">
            {stats.totalRevenue.toLocaleString()} ₴
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Кількість продажів</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">
            {stats.totalSales}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Середній чек</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-violet">
            {stats.averageCheck.toLocaleString()} ₴
          </p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard>
          <SalesTable sales={sales} />
        </GlassCard>
      </div>
    </div>
  );
}
