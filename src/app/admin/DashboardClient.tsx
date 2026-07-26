"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CurrentTime } from "@/components/CurrentTime";
import { AddSaleButton } from "./AddSaleButton";
import { AddRepairButton } from "./repairs/AddRepairButton";
import { AddOrderButton } from "./AddOrderButton";
import { AttentionSection } from "./AttentionSection";
import { MoneySection } from "./MoneySection";
import { DailyShareNavigator } from "./DailyShareNavigator";
import { InsightsSection } from "./InsightsSection";
import { findAttention, type AttentionRepair, type AttentionStockItem } from "@/lib/attention";
import type { DashboardMoney } from "@/lib/data-dashboard";
import type { SalesTargets } from "@/lib/data-settings";
import type { RangePreset } from "@/lib/profit";
import { cn } from "@/lib/utils/cn";

const btnPrimary =
  "btn-press inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] h-10 px-4 text-sm font-medium bg-accent text-on-accent hover:bg-accent-hover transition-colors";

interface DashboardClientProps {
  preset: RangePreset;
  /** Обраний минулий день (`YYYY-MM-DD`) на вкладці «Сьогодні», або null. */
  selectedDay: string | null;
  attention: { repairs: AttentionRepair[]; stock: AttentionStockItem[] };
  money: DashboardMoney;
  targets: SalesTargets;
}

/**
 * The whole dashboard, down from twelve widgets and four role branches to
 * two questions: what needs the owner today (`AttentionSection`), and how
 * much was really earned (`MoneySection`). Role is no longer read at all —
 * see `page.tsx` — so there is nothing here to branch on.
 *
 * `findAttention` runs here, client-side, on the raw `{ repairs, stock }` the
 * server fetched — same pattern as the header's own `today` string below,
 * which has always been computed at render time rather than passed down.
 */
export function DashboardClient({ preset, selectedDay, attention, money, targets }: DashboardClientProps) {
  const groups = useMemo(() => findAttention(attention, new Date()), [attention]);
  const today = new Date().toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Панель керування"
        subtitle={
          <span className="flex items-center gap-1 capitalize">
            {today}
            <CurrentTime />
          </span>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <AddSaleButton className={cn(btnPrimary, "flex-1 md:flex-none")} />
            <AddRepairButton variant="secondary" className="flex-1 md:flex-none">
              Прийняти в ремонт
            </AddRepairButton>
            <AddOrderButton variant="secondary" className="flex-1 md:flex-none">
              Замовлення
            </AddOrderButton>
          </div>
        }
      />

      <AttentionSection groups={groups} />
      <MoneySection preset={preset} selectedDay={selectedDay} money={money} targets={targets} />
      <DailyShareNavigator daily={money.daily} />
      <InsightsSection preset={preset} />
    </div>
  );
}
