import Link from "next/link";
import { BentoCell } from "@/components/ui/BentoCell";
import { Meter } from "@/components/charts/Meter";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { CATEGORY_LABELS, PROFIT_CATEGORIES, RANGE_LABELS, type RangePreset } from "@/lib/profit";
import type { DashboardMoney } from "@/lib/data-dashboard";
import type { SalesTargets } from "@/lib/data-settings";

function TargetRow({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 0;
  const met = value >= target;
  return (
    <div className="space-y-1.5 rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated px-3 py-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted">{label}</span>
        <span className={cn("font-semibold tabular", met ? "text-success" : "text-ink")}>
          {uah(value)} <span className="font-normal text-muted">/ {uah(target)} ({pct}%)</span>
        </span>
      </div>
      <Meter value={pct} tone={met ? "success" : "accent"} />
    </div>
  );
}

export function MoneyBreakdownCard({
  preset,
  money,
  targets,
  span = 7,
}: {
  preset: RangePreset;
  money: DashboardMoney;
  targets: SalesTargets;
  span?: 6 | 7 | 8 | 12;
}) {
  const monthNet = money.monthProfit - money.monthExpenses;
  const hasTargets = targets.daily !== null || targets.monthly !== null;
  const maxCategoryRevenue = Math.max(
    1,
    ...PROFIT_CATEGORIES.map(
      (cat) => money.profit.byCategory.find((c) => c.category === cat)?.revenue ?? 0,
    ),
  );

  return (
    <BentoCell span={span} className="justify-between gap-4">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Структура прибутку · {RANGE_LABELS[preset].toLowerCase()}
          </h2>

          <Link
            href="/admin/finance"
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-hover"
          >
            Фінанси →
          </Link>
        </div>

        {/* Мобільна компактна версія (без горизонтального скролу) */}
        <div className="divide-y divide-border-subtle border-y border-border-subtle sm:hidden">
          {PROFIT_CATEGORIES.map((cat) => {
            const row = money.profit.byCategory.find((c) => c.category === cat);
            const revenue = row?.revenue ?? 0;
            const cost = row?.cost ?? 0;
            const units = row?.units ?? 0;
            const profitVal = row?.profit ?? 0;
            const shareWidth =
              revenue > 0 ? Math.max(4, Math.round((revenue / maxCategoryRevenue) * 100)) : 0;

            return (
              <div key={cat} className="py-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-ink truncate">{CATEGORY_LABELS[cat]}</span>
                    {units > 0 && (
                      <span className="rounded bg-surface-elevated border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium tabular text-muted">
                        {units} од.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        "font-semibold tabular text-xs",
                        profitVal > 0
                          ? "text-success"
                          : profitVal < 0
                            ? "text-danger"
                            : "text-muted",
                      )}
                    >
                      {profitVal > 0 ? `+${uah(profitVal)}` : uah(profitVal)}
                    </span>
                    {revenue > 0 && (
                      <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium tabular text-muted">
                        {row!.margin}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
                  <div className="h-1 flex-1 max-w-[7rem] overflow-hidden rounded-full bg-border-subtle">
                    {shareWidth > 0 && (
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${shareWidth}%` }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 tabular">
                    <span>
                      Виторг: <strong className="font-medium text-ink">{uah(revenue)}</strong>
                    </span>
                    <span>·</span>
                    <span>Собів.: {uah(cost)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Десктопна таблиця (sm+) */}
        <div className="-mx-1 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[460px] text-left text-xs text-ink">
            <thead>
              <tr className="border-b border-border text-[11px] font-medium text-muted">
                <th className="py-2 font-medium">Напрямок</th>
                <th className="py-2 text-right font-medium">Од.</th>
                <th className="py-2 text-right font-medium">Виторг</th>
                <th className="py-2 text-right font-medium">Собівартість</th>
                <th className="py-2 text-right font-medium">Валовий прибуток</th>
                <th
                  className="py-2 text-right font-medium"
                  title="Виторг мінус собівартість, без операційних витрат"
                >
                  Маржа
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {PROFIT_CATEGORIES.map((cat) => {
                const row = money.profit.byCategory.find((c) => c.category === cat);
                const revenue = row?.revenue ?? 0;
                const units = row?.units ?? 0;
                const profitVal = row?.profit ?? 0;
                const shareWidth = revenue > 0 ? Math.max(4, Math.round((revenue / maxCategoryRevenue) * 100)) : 0;

                return (
                  <tr key={cat} className="group">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">{CATEGORY_LABELS[cat]}</span>
                      </div>
                      <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-border-subtle">
                        {shareWidth > 0 && (
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${shareWidth}%` }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular text-muted">
                      {units > 0 ? units : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular font-medium text-ink">
                      {uah(revenue)}
                    </td>
                    <td className="py-2.5 text-right tabular text-muted">
                      {uah(row?.cost ?? 0)}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-semibold tabular",
                        profitVal > 0
                          ? "text-success"
                          : profitVal < 0
                            ? "text-danger"
                            : "text-muted",
                      )}
                    >
                      {uah(profitVal)}
                    </td>
                    <td className="py-2.5 text-right tabular text-muted">
                      {revenue === 0 ? "—" : `${row!.margin}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasTargets && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {targets.daily !== null && (
              <TargetRow label="Ціль на сьогодні (маржа)" value={money.todayProfit} target={targets.daily} />
            )}
            {targets.monthly !== null && (
              <TargetRow label="Ціль на місяць (маржа)" value={money.monthProfit} target={targets.monthly} />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-muted">
            Поточний місяць · маржа:{" "}
            <strong className="font-semibold tabular text-ink">{uah(money.monthProfit)}</strong>
          </span>
          <span className="text-muted">
            витрати:{" "}
            <strong className="font-semibold tabular text-ink">{uah(money.monthExpenses)}</strong>
          </span>
        </div>
        <span className="text-muted">
          Чистими за місяць:{" "}
          <strong
            className={cn(
              "font-semibold tabular",
              monthNet >= 0 ? "text-success" : "text-danger",
            )}
          >
            {uah(monthNet)}
          </strong>
        </span>
      </div>
    </BentoCell>
  );
}
