export const dynamic = "force-dynamic";

import { getRepairs } from "@/lib/data-repairs";
import { getCustomers } from "@/lib/data-customers";
import { IconPlus } from "@/components/icons";
import { RepairsTable } from "./table";
import { AddRepairButton } from "./AddRepairButton";
import { pluralUk } from "@/lib/utils/plural";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

export default async function RepairsPage() {
  const [repairs, customers] = await Promise.all([
    getRepairs(),
    getCustomers()
  ]);

  const active = repairs.filter((r) => !["completed", "handed_over", "cancelled"].includes(r.status)).length;
  const ready = repairs.filter((r) => r.status === "ready").length;
  const awaiting = repairs.filter((r) => r.status === "awaiting_parts").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Ремонти</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {repairs.length} {pluralUk(repairs.length, "заявка", "заявки", "заявок")} у системі
          </p>
        </div>
        <AddRepairButton customers={customers} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Активні</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{active}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Готові до видачі</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">{ready}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Чекають деталі</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-rose">{awaiting}</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard>
          <RepairsTable repairs={repairs} />
        </GlassCard>
      </div>
    </div>
  );
}
