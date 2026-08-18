"use client";

import { useState } from "react";
import { BentoCell } from "@/components/ui/BentoCell";
import { ProfitChart, type ChartMode, type ChartPoint } from "./ProfitChart";
import { cn } from "@/lib/utils/cn";
import { uah, signedPct, signedPp } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import {
  aggregateSeries,
  deltaPct,
  RANGE_LABELS,
  type Comparison,
  type DayPoint,
  type HourlyPoint,
  type RangePreset,
  type GroupBy,
} from "@/lib/profit";
import type { ProfitResult } from "@/lib/profit";

const MIN_POINTS = 2;

/**
 * Головна цифра екрана на єдиній інвертованій плиті (DESIGN.md §2.1).
 *
 * Для «Сьогодні»: підтримує погодинний графік (00:00–23:00) за замовчуванням
 * та перемикач на 14-денний контекст.
 * Для «За весь час»: підтримує групування по днях, тижнях або місяцях.
 */
export function HeroToday({
  preset,
  profit,
  comparison,
  series,
  hourlySeries,
  dayLabel,
}: {
  preset: RangePreset;
  profit: ProfitResult;
  comparison: Comparison | null;
  series: DayPoint[];
  hourlySeries?: HourlyPoint[];
  /** Підпис періоду: «Сьогодні» або конкретний обраний день. */
  dayLabel: string;
}) {
  const empty = profit.revenue === 0;
  const revenueDelta = comparison && !empty ? deltaPct(profit.revenue, comparison.revenue) : null;
  const marginDelta = comparison && !empty ? profit.margin - comparison.margin : null;

  const [todayView, setTodayView] = useState<"hourly" | "trend">("hourly");
  const [allGroupBy, setAllGroupBy] = useState<GroupBy>("month");

  let chartData: ChartPoint[] = [];
  let chartMode: ChartMode = "day";
  let chartHint = "";

  if (preset === "today") {
    if (todayView === "hourly" && hourlySeries && hourlySeries.length > 0) {
      chartMode = "hourly";
      chartData = hourlySeries.map((h) => ({
        key: h.label,
        label: h.label,
        revenue: h.revenue,
        profit: h.profit,
        margin: h.margin,
        count: h.count,
      }));
      chartHint = "погодинна динаміка доби (00:00–23:00)";
    } else {
      chartMode = "day";
      chartData = series.map((d) => ({
        key: d.day,
        label: d.day,
        revenue: d.revenue,
        profit: d.profit,
        margin: d.margin,
      }));
      chartHint = `прибуток за ${series.length} ${pluralUk(series.length, "день", "дні", "днів")}`;
    }
  } else if (preset === "all") {
    chartMode = allGroupBy;
    const aggregated = aggregateSeries(series, allGroupBy);
    chartData = aggregated.map((a) => ({
      key: a.key,
      label: a.label,
      revenue: a.revenue,
      profit: a.profit,
      margin: a.margin,
    }));
    chartHint =
      allGroupBy === "day"
        ? `за ${aggregated.length} ${pluralUk(aggregated.length, "день", "дні", "днів")}`
        : allGroupBy === "week"
          ? `за ${aggregated.length} ${pluralUk(aggregated.length, "тиждень", "тижні", "тижнів")}`
          : `за ${aggregated.length} ${pluralUk(aggregated.length, "місяць", "місяці", "місяців")}`;
  } else {
    chartMode = "day";
    chartData = series.map((d) => ({
      key: d.day,
      label: d.day,
      revenue: d.revenue,
      profit: d.profit,
      margin: d.margin,
    }));
    chartHint = `прибуток за ${series.length} ${pluralUk(series.length, "день", "дні", "днів")}`;
  }

  return (
    <BentoCell span={8} tone="inverse" className="min-h-[19rem] gap-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-inverse-muted">
            {preset === "today" ? dayLabel : RANGE_LABELS[preset]}
          </p>

          {/* Перемикач для "Сьогодні" */}
          {preset === "today" && hourlySeries && hourlySeries.length > 0 && (
            <div className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-inverse-elevated/70 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setTodayView("hourly")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2 py-0.5 transition-colors",
                  todayView === "hourly"
                    ? "bg-accent-on-inverse font-semibold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По годинах
              </button>
              <button
                type="button"
                onClick={() => setTodayView("trend")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2 py-0.5 transition-colors",
                  todayView === "trend"
                    ? "bg-accent-on-inverse font-semibold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                14 днів
              </button>
            </div>
          )}

          {/* Перемикач групування для "За весь час" */}
          {preset === "all" && (
            <div className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-inverse-elevated/70 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setAllGroupBy("day")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2 py-0.5 transition-colors",
                  allGroupBy === "day"
                    ? "bg-accent-on-inverse font-semibold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По днях
              </button>
              <button
                type="button"
                onClick={() => setAllGroupBy("week")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2 py-0.5 transition-colors",
                  allGroupBy === "week"
                    ? "bg-accent-on-inverse font-semibold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По тижнях
              </button>
              <button
                type="button"
                onClick={() => setAllGroupBy("month")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2 py-0.5 transition-colors",
                  allGroupBy === "month"
                    ? "bg-accent-on-inverse font-semibold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По місяцях
              </button>
            </div>
          )}
        </div>

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

      {chartData.length >= MIN_POINTS ? (
        <div className="-mx-2 min-h-[8rem] flex-1">
          <ProfitChart series={chartData} mode={chartMode} />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <p className="text-[11px] text-inverse-muted">
        {chartData.length >= MIN_POINTS ? (
          <>
            {chartHint}
            <span className="mx-1.5 text-inverse-border">·</span>
            {chartMode === "day" ? (
              <>
                <span className="md:hidden">торкнись графіка</span>
                <span className="hidden md:inline">наведи, клікни — відкриє день</span>
              </>
            ) : (
              <span>наведи для деталей</span>
            )}
          </>
        ) : (
          "графік з’явиться, коли назбирається достатньо даних"
        )}
      </p>
    </BentoCell>
  );
}
