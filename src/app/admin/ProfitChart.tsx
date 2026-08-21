"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { uah } from "@/lib/utils/money";
import { dayLabel } from "@/lib/utils/day";

export interface ChartPoint {
  key: string;
  label?: string;
  revenue: number;
  profit: number;
  margin?: number;
  count?: number;
}

export type ChartMode = "hourly" | "day" | "week" | "month";

const MIN_POINTS = 2;

function TooltipCard({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string; payload?: ChartPoint }[];
  label?: string | number;
  mode?: ChartMode;
}) {
  if (!active || !payload?.length || typeof label !== "string") return null;

  const item = payload[0]?.payload;
  const at = (key: string) => {
    const v = payload.find((p) => p.dataKey === key)?.value;
    return typeof v === "number" ? v : 0;
  };
  const revenue = at("revenue");
  const profit = at("profit");
  const margin = revenue === 0 ? null : (item?.margin ?? Math.round((profit / revenue) * 100));

  let headerLabel = label;
  if (mode === "hourly") {
    headerLabel = `О ${label}`;
  } else if (mode === "day") {
    headerLabel = dayLabel(label);
  } else if (item?.label) {
    headerLabel = item.label;
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-inverse-border bg-inverse-elevated px-3 py-2 text-xs shadow-xl backdrop-blur-md">
      <p className="font-semibold capitalize text-inverse-ink">{headerLabel}</p>
      <div className="mt-1.5 space-y-1">
        <p className="flex items-center justify-between gap-3 text-inverse-muted">
          <span>Виторг:</span>
          <span className="tabular font-medium text-inverse-ink">{uah(revenue)}</span>
        </p>
        <p className="flex items-center justify-between gap-3 text-inverse-muted">
          <span>Прибуток:</span>
          <span className="tabular font-semibold text-accent-on-inverse">
            {uah(profit)}
            {margin !== null && <span className="ml-1 text-[11px] opacity-80">({margin}%)</span>}
          </span>
        </p>
        {typeof item?.count === "number" && item.count > 0 && (
          <p className="flex items-center justify-between gap-3 text-[11px] text-inverse-muted pt-0.5 border-t border-inverse-border/40">
            <span>Операцій:</span>
            <span className="tabular font-medium text-inverse-ink">{item.count}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function ProfitChart({
  series,
  mode = "day",
  onPointClick,
  showAxis = true,
}: {
  series: ChartPoint[];
  mode?: ChartMode;
  onPointClick?: (key: string) => void;
  showAxis?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (series.length < MIN_POINTS) return null;

  function handlePointClick(pointKey: string | undefined) {
    if (!pointKey) return;
    if (onPointClick) {
      onPointClick(pointKey);
      return;
    }
    if (mode === "day") {
      startTransition(() => router.push(`/admin/days/${pointKey}`));
    }
  }

  const formatXAxis = (tick: string) => {
    if (mode === "hourly") {
      const hour = parseInt(tick, 10);
      if (hour % 4 === 0 || hour === 23) return tick;
      return "";
    }
    if (mode === "day") {
      const parts = tick.split("-");
      if (parts.length === 3) {
        return `${parseInt(parts[2], 10)}.${parts[1]}`;
      }
      return tick;
    }
    if (mode === "week") {
      const item = series.find((s) => s.key === tick);
      if (item?.label) {
        return item.label.split("–")[0]?.trim() || tick;
      }
      return tick.replace(/^w-/, "").slice(5);
    }
    if (mode === "month") {
      const item = series.find((s) => s.key === tick);
      if (item?.label) {
        return item.label.split(" ")[0] || tick;
      }
      return tick.slice(5);
    }
    return tick;
  };

  const showDots = mode === "month" || mode === "week" || series.length <= 15;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={series}
        margin={{ top: 8, right: 12, bottom: showAxis ? 20 : 0, left: 12 }}
        onClick={(state) => handlePointClick(state?.activeLabel as string | undefined)}
        style={{ cursor: mode === "day" || !!onPointClick ? "pointer" : "default" }}
      >
        <defs>
          <linearGradient id="profit-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-on-inverse)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-accent-on-inverse)" stopOpacity={0} />
          </linearGradient>

          <filter id="profit-neon" x="-10%" y="-25%" width="120%" height="150%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <CartesianGrid
          vertical={false}
          stroke="var(--color-inverse-border)"
          strokeDasharray="2 4"
        />

        {showAxis ? (
          <XAxis
            dataKey="key"
            tickFormatter={formatXAxis}
            stroke="var(--color-inverse-muted)"
            tick={{ fill: "var(--color-inverse-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-inverse-border)" }}
            interval={mode === "hourly" ? 0 : "preserveStartEnd"}
          />
        ) : (
          <XAxis dataKey="key" hide />
        )}

        <YAxis hide />

        <Tooltip
          content={<TooltipCard mode={mode} />}
          cursor={{ stroke: "var(--color-inverse-muted)", strokeWidth: 1 }}
          animationDuration={120}
        />

        {/* Штрих-пунктирна лінія виторгу */}
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-inverse-muted)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />

        {/* Неонове сяйво прибутку */}
        <Line
          type="monotone"
          dataKey="profit"
          stroke="var(--color-accent-on-inverse)"
          strokeWidth={3}
          strokeLinecap="round"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
          style={{ filter: "url(#profit-neon)" }}
          legendType="none"
        />

        {/* Головна лінія та область прибутку */}
        <Area
          type="monotone"
          dataKey="profit"
          stroke="var(--color-accent-on-inverse)"
          strokeWidth={2}
          fill="url(#profit-fill)"
          dot={
            showDots
              ? {
                  r: 3.5,
                  fill: "var(--color-accent-on-inverse)",
                  stroke: "var(--color-inverse-surface)",
                  strokeWidth: 1.5,
                }
              : false
          }
          activeDot={{
            r: 5,
            fill: "var(--color-accent-on-inverse)",
            stroke: "var(--color-inverse-surface)",
            strokeWidth: 2,
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
