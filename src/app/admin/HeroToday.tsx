import { BentoCell } from "@/components/ui/BentoCell";
import { ProfitChart } from "./ProfitChart";
import { cn } from "@/lib/utils/cn";
import { uah, signedPct, signedPp } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { deltaPct, RANGE_LABELS, type Comparison, type DayPoint, type RangePreset } from "@/lib/profit";
import type { ProfitResult } from "@/lib/profit";

/** Мінімум точок, за якого лінія ще читається як лінія, а не як крапка. */
const MIN_POINTS = 3;

/**
 * Головна цифра екрана на єдиній інвертованій плиті (DESIGN.md §2.1).
 *
 * Дельта рахується не «до вчора». Магазин пише 5–15 чеків на день, тож один
 * проданий апарат дав би «+280%», а наступного дня «−70%» — метрика, яку
 * швидко вчишся не читати. База для «сьогодні» — середній день за попередній
 * тиждень; підпис бази приходить готовим із `comparisonFor`.
 *
 * На НУЛЬОВОМУ виторгу відсотка немає взагалі. «−100% до середнього дня» о
 * десятій ранку формально правильне і практично беззмістовне: воно світилося
 * б щодня до першого чека й привчало не читати цей рядок. Замість відсотка
 * показуємо саму базу — «звичайно на цей момент стільки-то».
 */
export function HeroToday({
  preset,
  profit,
  comparison,
  series,
  dayLabel,
}: {
  preset: RangePreset;
  profit: ProfitResult;
  comparison: Comparison | null;
  series: DayPoint[];
  /** Підпис періоду: «Сьогодні» або конкретний обраний день. */
  dayLabel: string;
}) {
  const empty = profit.revenue === 0;
  const revenueDelta = comparison && !empty ? deltaPct(profit.revenue, comparison.revenue) : null;
  const marginDelta = comparison && !empty ? profit.margin - comparison.margin : null;
  // Вікно графіка визначає сервер (`chartWindow`) — воно йде за обраним
  // періодом, тож тут ряд уже потрібної довжини й різати його нічим.
  const chart = series;

  return (
    <BentoCell span={8} tone="inverse" className="min-h-[19rem] gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-inverse-muted">
          {preset === "today" ? dayLabel : RANGE_LABELS[preset]}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-display text-[2.75rem] font-semibold leading-none tabular tracking-tight text-inverse-ink">
            {uah(profit.revenue)}
          </p>

          {revenueDelta !== null && comparison && (
            <p className="text-sm font-medium">
              <span
                className={cn(
                  "tabular",
                  revenueDelta > 0
                    ? "text-success-on-inverse"
                    : revenueDelta < 0
                      ? "text-danger-on-inverse"
                      : "text-inverse-muted",
                )}
              >
                {revenueDelta > 0 ? "▲" : revenueDelta < 0 ? "▼" : "="} {signedPct(revenueDelta)}
              </span>{" "}
              <span className="text-inverse-muted">{comparison.label}</span>
            </p>
          )}

          {empty && comparison && (
            <p className="text-sm text-inverse-muted">
              звичайно{" "}
              <span className="tabular text-inverse-ink">{uah(comparison.revenue)}</span>
            </p>
          )}
        </div>

        {!empty && (
          <p className="mt-2 text-sm text-inverse-muted">
            прибуток{" "}
            <span
              className={cn(
                "font-medium tabular",
                profit.profit >= 0 ? "text-inverse-ink" : "text-danger-on-inverse",
              )}
            >
              {uah(profit.profit)}
            </span>
            <span className="mx-2 text-inverse-border">·</span>
            маржа <span className="font-medium tabular text-inverse-ink">{profit.margin}%</span>
            {marginDelta !== null && marginDelta !== 0 && (
              <span
                className={cn(
                  "ml-1.5 tabular",
                  marginDelta > 0 ? "text-success-on-inverse" : "text-danger-on-inverse",
                )}
              >
                {signedPp(marginDelta)}
              </span>
            )}
          </p>
        )}
      </div>

      {chart.length >= MIN_POINTS ? (
        <div className="-mx-2 min-h-[8rem] flex-1">
          <ProfitChart series={chart} />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/*
        Підказка різна для миші й пальця: «наведи» на телефоні наводити нічим,
        а «торкнись» на десктопі збиває з пантелику. Один рядок замість двох —
        на 390px попередній варіант переносився і з'їдав висоту графіка.
      */}
      <p className="text-[11px] text-inverse-muted">
        {chart.length >= MIN_POINTS ? (
          <>
            прибуток за {chart.length} {pluralUk(chart.length, "день", "дні", "днів")}
            <span className="mx-1.5 text-inverse-border">·</span>
            <span className="md:hidden">торкнись графіка</span>
            <span className="hidden md:inline">наведи, клікни — відкриє день</span>
          </>
        ) : (
          "графік з’явиться, коли назбирається три дні"
        )}
      </p>
    </BentoCell>
  );
}
