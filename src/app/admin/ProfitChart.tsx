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
    <div className="rounded-[var(--radius-md)] border border-inverse-border bg-inverse-elevated px-3 py-2 text-xs shadow-lg">
      <p className="font-medium capitalize text-inverse-ink">{headerLabel}</p>
      <p className="mt-1 text-inverse-muted">
        виторг <span className="tabular text-inverse-ink">{uah(revenue)}</span>
      </p>
      <p className="text-inverse-muted">
        прибуток{" "}
        <span className="tabular text-accent-on-inverse">{uah(profit)}</span>
        {margin !== null && <span className="ml-1.5 tabular">· {margin}%</span>}
      </p>
      {typeof item?.count === "number" && item.count > 0 && (
        <p className="mt-0.5 text-[11px] text-inverse-muted">
          операцій: <span className="tabular text-inverse-ink">{item.count}</span>
        </p>
      )}
    </div>
  );
}

export function ProfitChart({
  series,
  mode = "day",
}: {
  series: ChartPoint[];
  mode?: ChartMode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (series.length < MIN_POINTS) return null;

  function handlePointClick(pointKey: string | undefined) {
    if (!pointKey) return;
    if (mode === "day") {
      startTransition(() => router.push(`/admin/days/${pointKey}`));
    }
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={series}
        margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
        onClick={(state) => handlePointClick(state?.activeLabel as string | undefined)}
        style={{ cursor: mode === "day" ? "pointer" : "default" }}
      >
        <defs>
          <linearGradient id="profit-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-on-inverse)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-accent-on-inverse)" stopOpacity={0} />
          </linearGradient>

          {/*
            Неон — просте розмиття, без `feFlood`: воно накладається на копію
            лінії, яка вже намальована потрібним кольором, тож підбирати колір
            усередині фільтра не треба.
          */}
          <filter id="profit-neon" x="-10%" y="-25%" width="120%" height="150%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <CartesianGrid
          vertical={false}
          stroke="var(--color-inverse-border)"
          strokeDasharray="2 4"
        />
        <XAxis dataKey="key" hide />
        <YAxis hide />

        <Tooltip
          content={<TooltipCard mode={mode} />}
          cursor={{ stroke: "var(--color-inverse-muted)", strokeWidth: 1 }}
          animationDuration={120}
        />

        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-inverse-muted)"
          strokeWidth={1}
          strokeDasharray="3 3"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        {/*
          Сяйво окремим шаром під різкою лінією
        */}
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
        <Area
          type="monotone"
          dataKey="profit"
          stroke="var(--color-accent-on-inverse)"
          strokeWidth={2}
          fill="url(#profit-fill)"
          dot={false}
          activeDot={{
            r: 4,
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
