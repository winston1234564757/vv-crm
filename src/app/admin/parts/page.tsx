export const dynamic = "force-dynamic";

import { getParts, getPartsAlerts } from "@/lib/data-parts";
import { getSuppliers } from "@/lib/data-suppliers";
import { PartsTable } from "./table";
import { AddPartButton } from "./AddPartButton";
import { pluralUk } from "@/lib/utils/plural";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

export default async function PartsPage() {
  const [parts, alerts, suppliers] = await Promise.all([getParts(), getPartsAlerts(), getSuppliers()]);

  const totalParts = parts.length;
  const totalValue = parts.reduce((s, p) => s + p.cost_price * p.stock, 0);
  const lowCount = alerts.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Запчастини</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{totalParts} {pluralUk(totalParts, "деталь", "деталі", "деталей")}</p>
        </div>
        <AddPartButton suppliers={suppliers} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Всього позицій</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalParts}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сума запасів (собівартість)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalValue.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Закінчуються</p>
          <p className={`mt-2 text-3xl font-light tracking-tight ${lowCount > 0 ? "text-rose" : "text-cyan"}`}>{lowCount}</p>
        </GlassCard>
      </div>

      <GlassCard>
        <PartsTable parts={parts} suppliers={suppliers} />
      </GlassCard>
    </div>
  );
}
