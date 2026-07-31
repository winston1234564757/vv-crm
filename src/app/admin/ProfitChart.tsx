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
import type { DayPoint } from "@/lib/profit";

/**
 * Графік прибутку в hero.
 *
 * Кольорів рівно один: прибуток — тілова заливка з градієнтом у прозоре
 * (єдиний дозволений градієнт, DESIGN.md §4.1), виторг — тонка нейтральна
 * лінія. Дві серії розрізняються і кольором, і типом позначки, тож
 * категоріальна палітра не потрібна — а отже й не потрібно валідувати її на
 * дальтонізм. Вісь одна: обидві серії в гривнях.
 *
 * Тултіп власний: дефолтний у recharts приходить із власним світлим фоном і
 * на інвертованій плиті виглядає як чужий елемент.
 *
 * Клік по точці відкриває сторінку того дня (`/admin/days/<день>`) — повний
 * зріз із операціями, витратами й рухом грошей. Раніше клік вмикав режим
 * `?day=` на самому дашборді, але той застосовувався лише до hero й таблиці
 * категорій, а операційні картки лишались на сьогодні.
 */

const MIN_POINTS = 3;

function TooltipCard({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length || typeof label !== "string") return null;

  const at = (key: string) => {
    const v = payload.find((p) => p.dataKey === key)?.value;
    return typeof v === "number" ? v : 0;
  };
  const revenue = at("revenue");
  const profit = at("profit");
  const margin = revenue === 0 ? null : Math.round((profit / revenue) * 100);

  return (
    <div className="rounded-[var(--radius-md)] border border-inverse-border bg-inverse-elevated px-3 py-2 text-xs shadow-lg">
      <p className="font-medium capitalize text-inverse-ink">{dayLabel(label)}</p>
      <p className="mt-1 text-inverse-muted">
        виторг <span className="tabular text-inverse-ink">{uah(revenue)}</span>
      </p>
      <p className="text-inverse-muted">
        прибуток{" "}
        <span className="tabular text-accent-on-inverse">{uah(profit)}</span>
        {margin !== null && <span className="ml-1.5 tabular">· {margin}%</span>}
      </p>
    </div>
  );
}

export function ProfitChart({ series }: { series: DayPoint[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (series.length < MIN_POINTS) return null;

  function openDay(day: string | undefined) {
    if (!day) return;
    startTransition(() => router.push(`/admin/days/${day}`));
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={series}
        margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
        onClick={(state) => openDay(state?.activeLabel as string | undefined)}
        style={{ cursor: "pointer" }}
      >
        <defs>
          <linearGradient id="profit-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-on-inverse)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-accent-on-inverse)" stopOpacity={0} />
          </linearGradient>

          {/*
            Неон — просте розмиття, без `feFlood`: воно накладається на копію
            лінії, яка вже намальована потрібним кольором, тож підбирати колір
            усередині фільтра не треба. Це навмисно, а не спрощення — CSS-змінні
            у presentation-атрибутах фільтрів (`flood-color`) резолвляться не в
            усіх браузерах, і сяйво тихо ставало б чорним.

            Не `drop-shadow` на всій області: тоді світилася б і градієнтна
            заливка, і замість чистого сяйва по лінії плита набувала б
            каламутного ореолу.
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
        <XAxis dataKey="day" hide />
        <YAxis hide />

        <Tooltip
          content={<TooltipCard />}
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
          Сяйво окремим шаром під різкою лінією: та сама серія без заливки,
          товщою і крізь фільтр. Порядок у recharts = порядок малювання, тож
          різка лінія лягає зверху й лишається чіткою.
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
