"use client";

import { useMemo, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { eachDayOfInterval, eachHourOfInterval, format, parseISO } from "date-fns";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils/cn";
import { pluralUk } from "@/lib/utils/plural";
import type { SalesAnalyticsResult } from "@/lib/data-sales";
import { PERIOD_TABS, periodRange, type Period } from "./period";

const CATEGORY_LABELS: Record<string, string> = {
  device: "Техніка", accessory: "Аксесуари", part: "Запчастини", service: "Послуги",
  repair: "Ремонти",
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: "Готівка", card: "Картка", transfer: "Переказ",
};

/* Продавець приходить рядком `profiles.full_name`, а це поки що пошта — цілу
   адресу колонка все одно обрізає посередині домену. Ключ лишається як є, бо
   він же ідентифікує рядок; коротшає лише підпис. */
function sellerLabels(rows: Array<{ key: string; value: number }>): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.key, r.key.split("@")[0]]));
}

function Breakdown({ title, rows, total, empty, labels }: {
  title: string;
  rows: Array<{ key: string; value: number }>;
  total: number;
  empty: string;
  labels?: Record<string, string>;
}) {
  const sorted = rows.filter((r) => r.value > 0);
  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-muted mb-4">{title}</h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">{empty}</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <div key={r.key}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm text-ink truncate">{labels?.[r.key] ?? r.key}</span>
                  <span className="text-sm font-semibold text-ink tabular shrink-0">
                    {r.value.toLocaleString()} ₴
                    <span className="ml-2 text-xs font-normal text-muted">{pct}%</span>
                  </span>
                </div>
                <div className="w-full bg-hover h-1.5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SalesAnalytics({ data, period }: { data: SalesAnalyticsResult; period: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setPeriod(next: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("period", next);
    startTransition(() => router.replace(`${pathname}?${p.toString()}`));
  }

  // SQL only returns buckets that had sales. Fill the gaps so the chart does not
  // imply activity on days that were actually empty.
  const buckets = useMemo(() => {
    const { from, to, bucket } = periodRange(period);
    const byKey = new Map<string, number>();
    for (const t of data.trend) {
      const d = parseISO(t.bucket);
      byKey.set(format(d, bucket === "hour" ? "yyyy-MM-dd HH" : bucket === "day" ? "yyyy-MM-dd" : "yyyy-MM"), Number(t.value));
    }

    if (!from || !to) {
      return data.trend.map((t) => ({
        label: format(parseISO(t.bucket), "MM.yyyy"),
        value: Number(t.value),
      }));
    }

    const points = bucket === "hour"
      ? eachHourOfInterval({ start: from, end: to })
      : eachDayOfInterval({ start: from, end: to });

    return points.map((d) => ({
      label: format(d, bucket === "hour" ? "HH" : "dd.MM"),
      value: byKey.get(format(d, bucket === "hour" ? "yyyy-MM-dd HH" : "yyyy-MM-dd")) ?? 0,
    }));
  }, [data.trend, period]);

  const maxBucket = Math.max(...buckets.map((b) => b.value), 1);
  const hasTrend = buckets.some((b) => b.value > 0);

  return (
    <div className={cn("space-y-5 transition-opacity", isPending && "opacity-60")}>
      <Tabs tabs={PERIOD_TABS} value={period} onValueChange={setPeriod} aria-label="Період" />

      <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-4">
        <StatCard label="Оборот за період" value={`${data.revenue.toLocaleString()} ₴`} />
        <StatCard
          label="Операцій"
          tone="info"
          value={data.count}
          sub={`${data.warrantyCount} ${pluralUk(data.warrantyCount, "гарантійний", "гарантійні", "гарантійних")}`}
        />
        <StatCard label="Середній чек" tone="accent" value={`${data.avgCheck.toLocaleString()} ₴`} />
        <StatCard label="Продано на суму" tone="success" value={`${data.itemsTotal.toLocaleString()} ₴`} sub="Позиції в чеках і ремонти" />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-medium text-muted mb-4">Динаміка обороту</h3>
        {!hasTrend ? (
          <p className="text-sm text-muted py-10 text-center">За цей період продажів не було</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 min-w-[420px] h-40">
              {buckets.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div
                    className={cn("w-full rounded-t-[3px] transition-all duration-500", b.value > 0 ? "bg-accent" : "bg-hover")}
                    style={{ height: `${Math.max(Math.round((b.value / maxBucket) * 100), b.value > 0 ? 2 : 1)}%` }}
                  />
                  {b.value > 0 && (
                    <div className="hidden group-hover:block absolute bottom-full mb-1 bg-ink text-surface text-xs tabular px-2 py-1 rounded-[var(--radius-sm)] whitespace-nowrap z-10">
                      {b.label}: {b.value.toLocaleString()} ₴
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-1 min-w-[420px] mt-2">
              {buckets.map((b, i) => (
                <span key={i} className="flex-1 text-center text-[9px] text-faint tabular truncate">
                  {buckets.length > 16 ? (i % 3 === 0 ? b.label : "") : b.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
        <Breakdown title="За категоріями" rows={data.byCategory} total={data.itemsTotal} empty="Немає позицій за період" labels={CATEGORY_LABELS} />
        {/* Тільки товарні продажі: оплата ремонту йде в касу без поділу на
            готівку/картку, тож сума тут менша за оборот. */}
        <Breakdown title="За методом оплати" rows={data.byPayment} total={data.byPayment.reduce((s, r) => s + r.value, 0)} empty="Немає оплат за період" labels={PAYMENT_LABELS} />
        <Breakdown title="За продавцями" rows={data.bySeller} total={data.revenue} empty="Немає продажів за період" labels={sellerLabels(data.bySeller)} />
      </div>
    </div>
  );
}
