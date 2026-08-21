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
  dayLabel: string;
  selectedDate?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const empty = profit.revenue === 0;
  const revenueDelta = comparison && !empty ? deltaPct(profit.revenue, comparison.revenue) : null;
  const marginDelta = comparison && !empty ? profit.margin - comparison.margin : null;

  const [todayView, setTodayView] = useState<"hourly" | "trend">("hourly");
  const [periodGroupBy, setPeriodGroupBy] = useState<GroupBy>("month");

  const todayKeyStr = dayKey(new Date());
  const currentDateKey = selectedDate || todayKeyStr;
  const isToday = currentDateKey === todayKeyStr;

  // Навігація без useSearchParams — формуємо URL вручну, щоб не ламати Suspense
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
  const handleNextDay = () => { if (!isToday) navigateToDay(addDays(currentDateKey, 1)); };
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

  // ── Рендер ───────────────────────────────────────────────────────────────
  return (
    <BentoCell
      span={8}
      tone="inverse"
      className={cn("min-h-[19.5rem] gap-3 transition-opacity", isPending && "opacity-60")}
    >
      {/* ── Шапка картки ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">

        {/* ЛІВО: навігатор дня або лейбл пресету */}
        {preset === "today" ? (
          <div className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="Попередній день"
              className="rounded px-1.5 py-0.5 text-white/60 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              ◀
            </button>

            {/* Кнопка-дата = клік відкриває <input type=date> */}
            <label className="relative cursor-pointer px-1">
              <span className="font-semibold text-white text-[11px] capitalize hover:underline">
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
              className="rounded px-1.5 py-0.5 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
            >
              ▶
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={handleToday}
                className="ml-1 rounded bg-[var(--color-accent-on-inverse)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-inverse-surface)] hover:opacity-90 transition-opacity cursor-pointer"
              >
                Сьогодні
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            {RANGE_LABELS[preset]}
          </p>
        )}

        {/* ПРАВО: перемикачі масштабу графіка */}
        {preset === "today" ? (
          hourlySeries && hourlySeries.length > 0 ? (
            <div className="flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5 text-[11px]">
              {(["hourly", "trend"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTodayView(v)}
                  className={cn(
                    "rounded px-2.5 py-1 transition-all cursor-pointer",
                    todayView === v
                      ? "bg-[var(--color-accent-on-inverse)] font-bold text-[var(--color-inverse-surface)]"
                      : "text-white/60 hover:text-white",
                  )}
                >
                  {v === "hourly" ? "Погодинно" : "14 днів"}
                </button>
              ))}
            </div>
          ) : null
        ) : preset === "all" ? (
          <div className="flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5 text-[11px]">
            {(["day", "week", "month"] as GroupBy[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPeriodGroupBy(v)}
                className={cn(
                  "rounded px-2.5 py-1 transition-all cursor-pointer",
                  periodGroupBy === v
                    ? "bg-[var(--color-accent-on-inverse)] font-bold text-[var(--color-inverse-surface)]"
                    : "text-white/60 hover:text-white",
                )}
              >
                {v === "day" ? "Дні" : v === "week" ? "Тижні" : "Місяці"}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5 text-[11px]">
            {(["day", "week"] as GroupBy[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPeriodGroupBy(v)}
                className={cn(
                  "rounded px-2.5 py-1 transition-all cursor-pointer",
                  periodGroupBy === v
                    ? "bg-[var(--color-accent-on-inverse)] font-bold text-[var(--color-inverse-surface)]"
                    : "text-white/60 hover:text-white",
                )}
              >
                {v === "day" ? "Дні" : "Тижні"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Числові показники ── */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-display text-[2.75rem] font-semibold leading-none tabular tracking-tight text-white">
            {uah(profit.revenue)}
          </p>

          {revenueDelta !== null && comparison && (
            <p className="text-sm font-medium">
              <span
                className={cn(
                  "tabular",
                  revenueDelta > 0
                    ? "text-green-400"
                    : revenueDelta < 0
                      ? "text-red-400"
                      : "text-white/50",
                )}
              >
                {revenueDelta > 0 ? "▲" : revenueDelta < 0 ? "▼" : "="} {signedPct(revenueDelta)}
              </span>{" "}
              <span className="text-white/50">{comparison.label}</span>
            </p>
          )}

          {empty && comparison && (
            <p className="text-sm text-white/50">
              звичайно{" "}
              <span className="tabular text-white">{uah(comparison.revenue)}</span>
            </p>
          )}
        </div>

        {!empty && (
          <p className="mt-1.5 text-sm text-white/60">
            прибуток{" "}
            <span className={cn("font-semibold tabular", profit.profit >= 0 ? "text-white" : "text-red-400")}>
              {uah(profit.profit)}
            </span>
            <span className="mx-2 text-white/20">·</span>
            маржа <span className="font-semibold tabular text-white">{profit.margin}%</span>
            {marginDelta !== null && marginDelta !== 0 && (
              <span className={cn("ml-1.5 tabular", marginDelta > 0 ? "text-green-400" : "text-red-400")}>
                {signedPp(marginDelta)}
              </span>
            )}
          </p>
        )}
      </div>

      {/* ── Графік ── */}
      {chartData.length >= MIN_POINTS ? (
        <div className="-mx-2 min-h-[9.5rem] flex-1">
          <ProfitChart
            series={chartData}
            mode={chartMode}
            onPointClick={(key) => {
              if (chartMode === "day") navigateToDay(key);
            }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-[6rem] flex items-center justify-center text-xs text-white/40">
          Недостатньо даних для графіка
        </div>
      )}

      {/* ── Підказка ── */}
      <p className="text-[11px] text-white/40">
        {chartData.length >= MIN_POINTS ? (
          <>
            <span className="text-white/60">{chartHint}</span>
            {chartMode === "day" && (
              <>
                <span className="mx-1.5 text-white/20">·</span>
                <span>наведи, клікни — відкрий день</span>
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
