import Link from "next/link";
import { BentoCell } from "@/components/ui/BentoCell";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { CATEGORY_LABELS, PROFIT_CATEGORIES, RANGE_LABELS, type RangePreset } from "@/lib/profit";
import type { DashboardMoney } from "@/lib/data-dashboard";
import type { SalesTargets } from "@/lib/data-settings";

function TargetRow({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 0;
  const met = value >= target;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("font-medium tabular", met ? "text-success" : "text-ink")}>
          {uah(value)} / {uah(target)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
        <div
          className={cn("h-full rounded-full transition-all", met ? "bg-success" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Звідки взявся прибуток: розклад по категоріях за обраний період.
 *
 * Показуємо ВСІ п'ять рядків навіть при нульовому виторгу, щоб таблиця не
 * перетасовувалась між пресетами. Категорія без виторгу дає «—» у маржі, а не
 * 0%, який читався б як «продали по собівартості».
 *
 * Футер завжди про поточний місяць, незалежно від пресету — інакше
 * перемикання вкладок міняло б значення «Чистими» без зміни підпису.
 */
export function MoneyBreakdownCard({
  preset,
  money,
  targets,
}: {
  preset: RangePreset;
  money: DashboardMoney;
  targets: SalesTargets;
}) {
  const monthNet = money.monthProfit - money.monthExpenses;
  const hasTargets = targets.daily !== null || targets.monthly !== null;

  return (
    <BentoCell
      span={8}
      title={`Звідки прибуток · ${RANGE_LABELS[preset].toLowerCase()}`}
      className="gap-5"
    >
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-sm text-ink">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-muted">
              <th className="py-2 font-medium">Категорія</th>
              <th className="py-2 text-right font-medium">Виторг</th>
              <th className="py-2 text-right font-medium">Собівартість</th>
              <th className="py-2 text-right font-medium">Прибуток</th>
              <th className="py-2 text-right font-medium">Маржа</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PROFIT_CATEGORIES.map((cat) => {
              const row = money.profit.byCategory.find((c) => c.category === cat);
              const revenue = row?.revenue ?? 0;
              return (
                <tr key={cat}>
                  <td className="py-2.5">{CATEGORY_LABELS[cat]}</td>
                  <td className="py-2.5 text-right tabular">{uah(revenue)}</td>
                  <td className="py-2.5 text-right tabular text-muted">{uah(row?.cost ?? 0)}</td>
                  <td
                    className={cn(
                      "py-2.5 text-right font-medium tabular",
                      (row?.profit ?? 0) >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {uah(row?.profit ?? 0)}
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
        <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
          {targets.daily !== null && (
            <TargetRow label="Ціль на сьогодні" value={money.todayProfit} target={targets.daily} />
          )}
          {targets.monthly !== null && (
            <TargetRow label="Ціль на місяць" value={money.monthProfit} target={targets.monthly} />
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs">
        <span className="text-muted">
          Місяць, витрати: <span className="font-medium tabular text-ink">{uah(money.monthExpenses)}</span>
        </span>
        <span className="text-muted">
          Чистими:{" "}
          <span className={cn("font-medium tabular", monthNet >= 0 ? "text-success" : "text-danger")}>
            {uah(monthNet)}
          </span>
        </span>
        <span className="text-muted">
          Каса: <span className="font-medium tabular text-ink">{uah(money.cashTotal)}</span>
        </span>
        <span className="text-muted">
          Запас OPEX:{" "}
          <span className="font-medium tabular text-ink">
            {money.runwayDays} {pluralUk(money.runwayDays, "день", "дні", "днів")}
          </span>
        </span>
        <Link
          href="/admin/finance"
          className="ml-auto font-medium text-accent-ink transition-colors hover:text-accent"
        >
          Фінанси →
        </Link>
      </div>
    </BentoCell>
  );
}
