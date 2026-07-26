"use client";

import { BentoCell } from "@/components/ui/BentoCell";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/utils/cn";
import { uah, signedPct, signedPp } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { deltaPct, RANGE_LABELS, type Comparison, type DayPoint, type RangePreset } from "@/lib/profit";
import type { ProfitResult } from "@/lib/profit";

/** Скільки днів показує спарклайн. Менше за графік — це настрій, не аналіз. */
const SPARK_DAYS = 14;

/**
 * Головна цифра екрана на єдиній інвертованій плиті (DESIGN.md §2.1).
 *
 * Дельта рахується не «до вчора». Магазин пише 5–15 чеків на день, тож один
 * проданий апарат дав би «+280%», а наступного дня «−70%» — метрика, яку
 * швидко вчишся не читати. База для «сьогодні» — середній день за попередній
 * тиждень; підпис бази приходить готовим із `comparisonFor`, тож UI не
 * вигадує, з чим порівнює.
 *
 * Коли бази бракує (магазин працює третій день, або період до епохи), дельти
 * немає взагалі — замість «+100%» проти нуля показуємо саму цифру.
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
  const revenueDelta = comparison ? deltaPct(profit.revenue, comparison.revenue) : null;
  const marginDelta = comparison ? profit.margin - comparison.margin : null;
  const spark = series.slice(-SPARK_DAYS).map((p) => p.profit);

  return (
    <BentoCell span={8} tone="inverse" className="justify-between gap-6">
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
        </div>

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
      </div>

      {spark.length >= 3 && (
        <div>
          <Sparkline
            values={spark}
            stroke="var(--color-accent-on-inverse)"
            gradientId="hero-spark"
            label={`Прибуток за останні ${spark.length} днів`}
            className="h-11 w-full"
          />
          <p className="mt-1.5 text-[11px] text-inverse-muted">
            прибуток за {spark.length} {pluralUk(spark.length, "день", "дні", "днів")}
          </p>
        </div>
      )}
    </BentoCell>
  );
}
