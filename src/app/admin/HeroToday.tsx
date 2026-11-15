"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
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

export function HeroToday({
  preset,
  profit,
  expenses = 0,
  dailyTarget = 0,
  comparison,
  series,
  hourlySeries,
  dayLabel: initialDayLabel,
  selectedDate,
}: {
  preset: RangePreset;
  profit: ProfitResult;
  expenses?: number;
  dailyTarget?: number;
  comparison: Comparison | null;
  series: DayPoint[];
  hourlySeries?: HourlyPoint[];
  dayLabel: string;
  selectedDate?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const empty = profit.revenue === 0;
  const revenueDelta = comparison && !empty ? deltaPct(profit.revenue, comparison.revenue) : null;
  const marginDelta = comparison && !empty ? profit.margin - comparison.margin : null;
  const netProfit = profit.profit - expenses;

  const [todayView, setTodayView] = useState<"hourly" | "trend">("hourly");
  const [periodGroupBy, setPeriodGroupBy] = useState<GroupBy>("month");

  const todayKeyStr = dayKey(new Date());
  const currentDateKey = selectedDate || todayKeyStr;
  const isToday = currentDateKey === todayKeyStr;

  const navigateToDay = (dateStr: string) => {
    const params = new URLSearchParams();
    params.set("range", "today");
    if (dateStr !== todayKeyStr) {
      params.set("date", dateStr);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const handlePrevDay = () => navigateToDay(addDays(currentDateKey, -1));
  const handleNextDay = () => {
    if (!isToday) navigateToDay(addDays(currentDateKey, 1));
  };
  const handleToday = () => navigateToDay(todayKeyStr);

  let dynamicDayLabel = initialDayLabel;
  if (preset === "today") {
    dynamicDayLabel = isToday ? "Сьогодні" : formatDayLabel(currentDateKey);
  }

  // ── Побудова даних для графіка ───────────────────────────────────────────
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
      chartHint = `погодинна динаміка 00:00–23:00 · ${currentDateKey}`;
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

  const targetPct =
    preset === "today" && dailyTarget > 0
      ? Math.min(100, Math.round(( Math.max(0, profit.profit) / dailyTarget) * 100))
      : null;

  return (
    <BentoCell
      span={7}
      tone="inverse"
      className={cn("min-h-[20rem] gap-3.5 transition-opacity", isPending && "opacity-60")}
    >
      {/* ── Шапка картки ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-inverse-border pb-2.5">
        {preset === "today" ? (
          <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-inverse-border bg-inverse-elevated px-1.5 py-1 text-xs">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="Попередній день"
              className="inline-flex size-6 items-center justify-center rounded text-inverse-muted transition-colors hover:bg-inverse-border hover:text-inverse-ink cursor-pointer"
            >
              <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden="true">
                <path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <label className="relative inline-flex cursor-pointer items-center gap-1.5 px-1.5 py-0.5">
              <span className="size-1.5 rounded-full bg-accent-on-inverse shrink-0" />
              <span className="font-semibold text-inverse-ink text-xs capitalize">
                {dynamicDayLabel}
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
              className="inline-flex size-6 items-center justify-center rounded text-inverse-muted transition-colors hover:bg-inverse-border hover:text-inverse-ink disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
            >
              <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden="true">
                <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={handleToday}
                className="ml-1 rounded bg-accent-on-inverse px-2 py-0.5 text-[11px] font-semibold text-inverse-surface hover:opacity-90 transition-opacity cursor-pointer"
              >
                Сьогодні
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent-on-inverse" />
            <p className="text-xs font-semibold uppercase tracking-wider text-inverse-muted">
              {RANGE_LABELS[preset]}
            </p>
          </div>
        )}

        {/* ПРАВО: перемикачі масштабу графіка */}
        {preset === "today" ? (
          hourlySeries && hourlySeries.length > 0 ? (
            <div className="flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-inverse-border bg-inverse-elevated p-0.5 text-[11px]">
              {(["hourly", "trend"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTodayView(v)}
                  className={cn(
                    "rounded px-2.5 py-1 transition-colors cursor-pointer",
                    todayView === v
                      ? "bg-accent-on-inverse font-semibold text-inverse-surface"
                      : "text-inverse-muted hover:text-inverse-ink",
                  )}
                >
                  {v === "hourly" ? "Погодинно" : "14 днів"}
                </button>
              ))}
            </div>
          ) : null
        ) : preset === "all" ? (
          <div className="flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-inverse-border bg-inverse-elevated p-0.5 text-[11px]">
            {(["day", "week", "month"] as GroupBy[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPeriodGroupBy(v)}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors cursor-pointer",
                  periodGroupBy === v
                    ? "bg-accent-on-inverse font-semibold text-inverse-surface"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                {v === "day" ? "Дні" : v === "week" ? "Тижні" : "Місяці"}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-inverse-border bg-inverse-elevated p-0.5 text-[11px]">
            {(["day", "week"] as GroupBy[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPeriodGroupBy(v)}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors cursor-pointer",
                  periodGroupBy === v
                    ? "bg-accent-on-inverse font-semibold text-inverse-surface"
                    : "text-inverse-muted hover:text-inverse-ink",
                )}
              >
                {v === "day" ? "Дні" : "Тижні"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Головне число (Виторг) + Дельта + Компактна матриця KPI ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-inverse-muted">
                Виторг за період
              </p>
              <p className="mt-0.5 font-display text-3xl sm:text-[2.5rem] font-semibold leading-none tabular tracking-tight text-inverse-ink">
                {uah(profit.revenue)}
              </p>
            </div>

            {revenueDelta !== null && comparison && (
              <p className="text-xs font-medium">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 tabular font-semibold",
                    revenueDelta > 0
                      ? "bg-inverse-elevated text-success-on-inverse"
                      : revenueDelta < 0
                        ? "bg-inverse-elevated text-danger-on-inverse"
                        : "text-inverse-muted",
                  )}
                >
                  {revenueDelta > 0 ? "▲" : revenueDelta < 0 ? "▼" : "="} {signedPct(revenueDelta)}
                </span>{" "}
                <span className="text-inverse-muted">{comparison.label}</span>
              </p>
            )}

            {empty && comparison && (
              <p className="text-xs text-inverse-muted">
                звичайно{" "}
                <span className="tabular font-medium text-inverse-ink">{uah(comparison.revenue)}</span>
              </p>
            )}
          </div>

          {targetPct !== null && (
            <div className="flex w-full sm:w-auto flex-col items-end gap-1 sm:min-w-[8.5rem]">
              <div className="flex items-center justify-between w-full gap-2 text-[11px]">
                <span className="text-inverse-muted">План дня (маржа)</span>
                <span className="tabular font-semibold text-inverse-ink">{targetPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-inverse-elevated">
                <div
                  className="h-full rounded-full bg-accent-on-inverse transition-all"
                  style={{ width: `${targetPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 4-колонкова B2B-стрічка ключових метрик */}
        <dl className="grid grid-cols-2 gap-2 border-y border-inverse-border py-2.5 sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-inverse-muted">Валовий прибуток</dt>
            <dd className="mt-0.5 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "tabular text-sm font-semibold",
                  profit.profit >= 0 ? "text-accent-on-inverse" : "text-danger-on-inverse",
                )}
              >
                {uah(profit.profit)}
              </span>
              <span className="tabular text-xs text-inverse-muted">({profit.margin}%)</span>
              {marginDelta !== null && marginDelta !== 0 && (
                <span
                  className={cn(
                    "tabular text-[11px]",
                    marginDelta > 0 ? "text-success-on-inverse" : "text-danger-on-inverse",
                  )}
                >
                  {signedPp(marginDelta)}
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] text-inverse-muted">Чистими (− витрати)</dt>
            <dd
              className={cn(
                "mt-0.5 tabular text-sm font-semibold",
                netProfit >= 0 ? "text-inverse-ink" : "text-danger-on-inverse",
              )}
            >
              {uah(netProfit)}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] text-inverse-muted">Собівартість</dt>
            <dd className="mt-0.5 tabular text-sm font-medium text-inverse-ink">
              {uah(profit.cost)}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] text-inverse-muted">Витрати / Одиниць</dt>
            <dd className="mt-0.5 tabular text-sm font-medium text-inverse-ink">
              {uah(expenses)} <span className="text-inverse-muted">·</span>{" "}
              <span className="text-xs text-inverse-muted">{profit.units} од.</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Графік ── */}
      {chartData.length >= MIN_POINTS ? (
        <div className="-mx-2 min-h-[9rem] flex-1">
          <ProfitChart
            series={chartData}
            mode={chartMode}
            onPointClick={(key) => {
              if (chartMode === "day") navigateToDay(key);
            }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-[6rem] flex items-center justify-center text-xs text-inverse-muted">
          Недостатньо даних для графіка
        </div>
      )}

      {/* ── Підказка ── */}
      <p className="text-[11px] text-inverse-muted">
        {chartData.length >= MIN_POINTS ? (
          <>
            <span>{chartHint}</span>
            {chartMode === "day" && (
              <>
                <span className="mx-1.5 opacity-40">·</span>
                <span>клік по точці відкриває день</span>
              </>
            )}
          </>
        ) : (
          "графік з'явиться, коли назбирається достатньо даних"
        )}
      </p>
    </BentoCell>
  );
}
