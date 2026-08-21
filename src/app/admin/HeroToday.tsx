"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BentoCell } from "@/components/ui/BentoCell";
import { ProfitChart, type ChartMode, type ChartPoint } from "./ProfitChart";
import { cn } from "@/lib/utils/cn";
import { uah, signedPct, signedPp } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { addDays, dayKey, dayLabel as formatDayLabel } from "@/lib/utils/day";
import {
  aggregateSeries,
  deltaPct,
  RANGE_LABELS,
  type Comparison,
  type DayPoint,
  type HourlyPoint,
  type RangePreset,
  type GroupBy,
  type ProfitResult,
} from "@/lib/profit";

const MIN_POINTS = 2;

/**
 * Головний графік та показники на інвертованій плиті.
 *
 * Підтримує:
 * - Перегляд будь-якого окремого дня з навігацією ◀ ▶ та погодинним графіком (00:00–23:00).
 * - Перегляд "За весь час" з перемиканням на тижні (week) та місяці (month).
 * - Перемикання масштабу прямо на картці графіка.
 */
export function HeroToday({
  preset,
  profit,
  comparison,
  series,
  hourlySeries,
  dayLabel: initialDayLabel,
  selectedDate,
}: {
  preset: RangePreset;
  profit: ProfitResult;
  comparison: Comparison | null;
  series: DayPoint[];
  hourlySeries?: HourlyPoint[];
  /** Підпис періоду: «Сьогодні» або конкретний обраний день. */
  dayLabel: string;
  /** Поточна вибрана дата (YYYY-MM-DD). */
  selectedDate?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const empty = profit.revenue === 0;
  const revenueDelta = comparison && !empty ? deltaPct(profit.revenue, comparison.revenue) : null;
  const marginDelta = comparison && !empty ? profit.margin - comparison.margin : null;

  const [todayView, setTodayView] = useState<"hourly" | "trend">("hourly");
  const [periodGroupBy, setPeriodGroupBy] = useState<GroupBy>("month");

  const todayKeyStr = dayKey(new Date());
  const currentDateKey = selectedDate || todayKeyStr;
  const isToday = currentDateKey === todayKeyStr;

  const navigateToDay = (dateStr: string) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set("range", "today");
    if (dateStr === todayKeyStr) {
      q.delete("date");
    } else {
      q.set("date", dateStr);
    }
    startTransition(() => {
      router.replace(`${pathname}?${q.toString()}`);
    });
  };

  const handlePrevDay = () => {
    const prev = addDays(currentDateKey, -1);
    navigateToDay(prev);
  };

  const handleNextDay = () => {
    if (isToday) return;
    const next = addDays(currentDateKey, 1);
    navigateToDay(next);
  };

  const handleToday = () => {
    navigateToDay(todayKeyStr);
  };

  let dynamicDayLabel = initialDayLabel;
  if (preset === "today") {
    if (isToday) {
      dynamicDayLabel = "Сьогодні";
    } else {
      dynamicDayLabel = formatDayLabel(currentDateKey);
    }
  }

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
      chartHint = `погодинна динаміка 00:00–23:00 (${currentDateKey})`;
    } else {
      chartMode = "day";
      chartData = series.map((d) => ({
        key: d.day,
        label: d.day,
        revenue: d.revenue,
        profit: d.profit,
        margin: d.margin,
      }));
      chartHint = `тренд за ${series.length} ${pluralUk(series.length, "день", "дні", "днів")}`;
    }
  } else if (preset === "all") {
    chartMode = periodGroupBy;
    const aggregated = aggregateSeries(series, periodGroupBy);
    chartData = aggregated.map((a) => ({
      key: a.key,
      label: a.label,
      revenue: a.revenue,
      profit: a.profit,
      margin: a.margin,
    }));
    chartHint =
      periodGroupBy === "day"
        ? `за ${aggregated.length} ${pluralUk(aggregated.length, "день", "дні", "днів")}`
        : periodGroupBy === "week"
          ? `за ${aggregated.length} ${pluralUk(aggregated.length, "тиждень", "тижні", "тижнів")}`
          : `за ${aggregated.length} ${pluralUk(aggregated.length, "місяць", "місяці", "місяців")}`;
  } else {
    // 7d, 30d, month, prev
    if (periodGroupBy === "week" && series.length >= 7) {
      chartMode = "week";
      const aggregated = aggregateSeries(series, "week");
      chartData = aggregated.map((a) => ({
        key: a.key,
        label: a.label,
        revenue: a.revenue,
        profit: a.profit,
        margin: a.margin,
      }));
      chartHint = `за ${aggregated.length} ${pluralUk(aggregated.length, "тиждень", "тижні", "тижнів")}`;
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
  }

  return (
    <BentoCell span={8} tone="inverse" className={cn("min-h-[19.5rem] gap-3 transition-opacity", isPending && "opacity-60")}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-inverse-border/30 pb-2.5">
          {/* Ліва частина: вибір дня або назва періоду */}
          {preset === "today" ? (
            <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-inverse-elevated/80 px-2.5 py-1 text-xs shadow-inner">
              <button
                type="button"
                onClick={handlePrevDay}
                aria-label="Попередній день"
                className="rounded-[var(--radius-xs)] px-1.5 py-0.5 text-inverse-muted transition-colors hover:bg-inverse-surface hover:text-inverse-ink cursor-pointer"
              >
                ◀
              </button>
              <label className="relative flex items-center cursor-pointer px-1">
                <span className="font-semibold text-inverse-ink text-xs capitalize hover:underline flex items-center gap-1">
                  📅 {dynamicDayLabel}
                </span>
                <input
                  type="date"
                  value={currentDateKey}
                  max={todayKeyStr}
                  onChange={(e) => e.target.value && navigateToDay(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
              <button
                type="button"
                onClick={handleNextDay}
                disabled={isToday}
                aria-label="Наступний день"
                className="rounded-[var(--radius-xs)] px-1.5 py-0.5 text-inverse-muted transition-colors hover:bg-inverse-surface hover:text-inverse-ink disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
              >
                ▶
              </button>
              {!isToday && (
                <button
                  type="button"
                  onClick={handleToday}
                  className="ml-1.5 rounded-[var(--radius-xs)] bg-accent-on-inverse px-2 py-0.5 text-[11px] font-bold text-inverse-surface hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Сьогодні
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-inverse-muted">
                {RANGE_LABELS[preset]}
              </p>
            </div>
          )}

          {/* Права частина: перемикачі масштабу графіка */}
          {preset === "today" ? (
            hourlySeries && hourlySeries.length > 0 && (
              <div className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-inverse-elevated/80 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTodayView("hourly")}
                  className={cn(
                    "rounded-[var(--radius-xs)] px-2.5 py-1 transition-all cursor-pointer",
                    todayView === "hourly"
                      ? "bg-accent-on-inverse font-bold text-inverse-surface shadow-xs"
                      : "text-inverse-muted hover:text-inverse-ink",
                  )}
                >
                  Погодинно (24г)
                </button>
                <button
                  type="button"
                  onClick={() => setTodayView("trend")}
                  className={cn(
                    "rounded-[var(--radius-xs)] px-2.5 py-1 transition-all cursor-pointer",
                    todayView === "trend"
                      ? "bg-accent-on-inverse font-bold text-inverse-surface shadow-xs"
                      : "text-inverse-muted hover:text-inverse-ink",
                  )}
                >
                  14 днів
                </button>
              </div>
            )
          ) : preset === "all" ? (
            <div className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-inverse-elevated/80 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setPeriodGroupBy("day")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2.5 py-1 transition-all cursor-pointer",
                  periodGroupBy === "day"
                    ? "bg-accent-on-inverse font-bold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По днях
              </button>
              <button
                type="button"
                onClick={() => setPeriodGroupBy("week")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2.5 py-1 transition-all cursor-pointer",
                  periodGroupBy === "week"
                    ? "bg-accent-on-inverse font-bold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По тижнях
              </button>
              <button
                type="button"
                onClick={() => setPeriodGroupBy("month")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2.5 py-1 transition-all cursor-pointer",
                  periodGroupBy === "month"
                    ? "bg-accent-on-inverse font-bold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По місяцях
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-inverse-elevated/80 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setPeriodGroupBy("day")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2.5 py-1 transition-all cursor-pointer",
                  periodGroupBy === "day"
                    ? "bg-accent-on-inverse font-bold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По днях
              </button>
              <button
                type="button"
                onClick={() => setPeriodGroupBy("week")}
                className={cn(
                  "rounded-[var(--radius-xs)] px-2.5 py-1 transition-all cursor-pointer",
                  periodGroupBy === "week"
                    ? "bg-accent-on-inverse font-bold text-inverse-surface shadow-xs"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                По тижнях
              </button>
            </div>
          )}
        </div>

        {/* Числові показники */}
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
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
          <p className="mt-1.5 text-sm text-inverse-muted">
            прибуток{" "}
            <span
              className={cn(
                "font-semibold tabular",
                profit.profit >= 0 ? "text-inverse-ink" : "text-danger-on-inverse",
              )}
            >
              {uah(profit.profit)}
            </span>
            <span className="mx-2 text-inverse-border">·</span>
            маржа <span className="font-semibold tabular text-inverse-ink">{profit.margin}%</span>
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

      {/* Графік */}
      {chartData.length >= MIN_POINTS ? (
        <div className="-mx-2 min-h-[9.5rem] flex-1">
          <ProfitChart
            series={chartData}
            mode={chartMode}
            onPointClick={(key) => {
              if (chartMode === "day") {
                navigateToDay(key);
              }
            }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-[6rem] flex items-center justify-center text-xs text-inverse-muted">
          Даних за цей відрізок недостатньо для побудови графіка
        </div>
      )}

      {/* Підказка внизу картки */}
      <p className="text-[11px] text-inverse-muted">
        {chartData.length >= MIN_POINTS ? (
          <>
            <span className="font-medium text-inverse-ink/80">{chartHint}</span>
            <span className="mx-1.5 text-inverse-border">·</span>
            {chartMode === "day" ? (
              <span>клікни по даті або точці для перегляду погодинного графіка</span>
            ) : (
              <span>наведи курсор на графік для перегляду деталей</span>
            )}
          </>
        ) : (
          "графік з’явиться, коли назбирається достатньо даних"
        )}
      </p>
    </BentoCell>
  );
}
