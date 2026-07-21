"use client";

import { useState, useMemo } from "react";
import {
  startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths,
  eachDayOfInterval, eachHourOfInterval, format, isWithinInterval,
} from "date-fns";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils/cn";
import { pluralUk } from "@/lib/utils/plural";
import type { SaleWithDetails } from "@/lib/data-sales";

type Period = "today" | "7d" | "30d" | "month" | "prev_month" | "all";

const PERIOD_TABS = [
  { value: "today" as const, label: "Сьогодні" },
  { value: "7d" as const, label: "7 днів" },
  { value: "30d" as const, label: "30 днів" },
  { value: "month" as const, label: "Цей місяць" },
  { value: "prev_month" as const, label: "Минулий місяць" },
  { value: "all" as const, label: "Увесь час" },
];

const CATEGORY_LABELS: Record<string, string> = {
  device: "Техніка",
  accessory: "Аксесуари",
  part: "Запчастини",
  service: "Послуги",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Готівка",
  card: "Картка",
  transfer: "Переказ",
};

function getRange(period: Period): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "7d": return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d": return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "month": return { start: startOfMonth(now), end: endOfDay(now) };
    case "prev_month": {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case "all": return null;
  }
}

/** Horizontal breakdown bars — label, share bar, amount, percent. */
function Breakdown({
  title, rows, total, empty,
}: {
  title: string;
  rows: Array<{ key: string; label: string; value: number }>;
  total: number;
  empty: string;
}) {
  const sorted = [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);

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
                  <span className="text-sm text-ink truncate">{r.label}</span>
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

export function SalesAnalytics({ sales }: { sales: SaleWithDetails[] }) {
  const [period, setPeriod] = useState<Period>("30d");

  const data = useMemo(() => {
    const range = getRange(period);
    const periodSales = range
      ? sales.filter((s) => isWithinInterval(new Date(s.created_at), range))
      : sales;

    const revenue = periodSales.reduce((sum, s) => sum + s.total_amount, 0);
    const count = periodSales.length;
    const avgCheck = count > 0 ? Math.round(revenue / count) : 0;
    const warrantyCount = periodSales.filter((s) => s.is_warranty).length;

    // --- breakdowns ---
    const byCategory = new Map<string, number>();
    for (const s of periodSales) {
      for (const it of s.items) {
        byCategory.set(it.item_type, (byCategory.get(it.item_type) ?? 0) + it.total_price);
      }
    }

    const byPayment = new Map<string, number>();
    for (const s of periodSales) {
      for (const p of s.payments) {
        byPayment.set(p.method, (byPayment.get(p.method) ?? 0) + p.amount);
      }
    }

    const bySeller = new Map<string, number>();
    for (const s of periodSales) {
      const name = s.seller_name?.trim() || "Невідомо";
      bySeller.set(name, (bySeller.get(name) ?? 0) + s.total_amount);
    }

    // --- trend buckets ---
    let buckets: Array<{ label: string; value: number }> = [];
    if (range && period === "today") {
      buckets = eachHourOfInterval(range).map((h) => ({
        label: format(h, "HH"),
        value: periodSales
          .filter((s) => new Date(s.created_at).getHours() === h.getHours())
          .reduce((sum, s) => sum + s.total_amount, 0),
      }));
    } else if (range) {
      buckets = eachDayOfInterval(range).map((d) => {
        const key = format(d, "yyyy-MM-dd");
        return {
          label: format(d, "dd.MM"),
          value: periodSales
            .filter((s) => format(new Date(s.created_at), "yyyy-MM-dd") === key)
            .reduce((sum, s) => sum + s.total_amount, 0),
        };
      });
    } else {
      const byMonth = new Map<string, number>();
      for (const s of periodSales) {
        const key = format(new Date(s.created_at), "yyyy-MM");
        byMonth.set(key, (byMonth.get(key) ?? 0) + s.total_amount);
      }
      buckets = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({ label: key.split("-").reverse().join("."), value }));
    }

    return {
      revenue, count, avgCheck, warrantyCount, buckets,
      itemsTotal: Array.from(byCategory.values()).reduce((a, b) => a + b, 0),
      paymentsTotal: Array.from(byPayment.values()).reduce((a, b) => a + b, 0),
      categoryRows: Array.from(byCategory.entries()).map(([key, value]) => ({
        key, label: CATEGORY_LABELS[key] ?? key, value,
      })),
      paymentRows: Array.from(byPayment.entries()).map(([key, value]) => ({
        key, label: PAYMENT_LABELS[key] ?? key, value,
      })),
      sellerRows: Array.from(bySeller.entries()).map(([key, value]) => ({
        key, label: key, value,
      })),
    };
  }, [sales, period]);

  const maxBucket = Math.max(...data.buckets.map((b) => b.value), 1);
  const hasTrend = data.buckets.some((b) => b.value > 0);

  return (
    <div className="space-y-5">
      <Tabs
        tabs={PERIOD_TABS}
        value={period}
        onValueChange={(v) => setPeriod(v as Period)}
        aria-label="Період"
      />

      <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-4">
        <StatCard label="Оборот за період" value={`${data.revenue.toLocaleString()} ₴`} />
        <StatCard
          label="Чеків"
          tone="info"
          value={data.count}
          sub={`${data.warrantyCount} ${pluralUk(data.warrantyCount, "гарантійний", "гарантійні", "гарантійних")}`}
        />
        <StatCard label="Середній чек" tone="accent" value={`${data.avgCheck.toLocaleString()} ₴`} />
        <StatCard
          label="Товарів продано"
          tone="success"
          value={`${data.itemsTotal.toLocaleString()} ₴`}
          sub="Сума позицій у чеках"
        />
      </div>

      {/* Динаміка */}
      <div className="card p-5">
        <h3 className="text-sm font-medium text-muted mb-4">Динаміка обороту</h3>
        {!hasTrend ? (
          <p className="text-sm text-muted py-10 text-center">За цей період продажів не було</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 min-w-[420px] h-40">
              {data.buckets.map((b, i) => {
                const h = Math.round((b.value / maxBucket) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className={cn(
                        "w-full rounded-t-[3px] transition-all duration-500",
                        b.value > 0 ? "bg-accent" : "bg-hover",
                      )}
                      style={{ height: `${Math.max(h, b.value > 0 ? 2 : 1)}%` }}
                    />
                    {b.value > 0 && (
                      <div className="hidden group-hover:block absolute bottom-full mb-1 bg-ink text-surface text-xs tabular px-2 py-1 rounded-[var(--radius-sm)] whitespace-nowrap z-10">
                        {b.label}: {b.value.toLocaleString()} ₴
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 min-w-[420px] mt-2">
              {data.buckets.map((b, i) => (
                <span key={i} className="flex-1 text-center text-[9px] text-faint tabular truncate">
                  {data.buckets.length > 16 ? (i % 3 === 0 ? b.label : "") : b.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Розбивки */}
      <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
        <Breakdown
          title="За категоріями"
          rows={data.categoryRows}
          total={data.itemsTotal}
          empty="Немає позицій за період"
        />
        <Breakdown
          title="За методом оплати"
          rows={data.paymentRows}
          total={data.paymentsTotal}
          empty="Немає оплат за період"
        />
        <Breakdown
          title="За продавцями"
          rows={data.sellerRows}
          total={data.revenue}
          empty="Немає продажів за період"
        />
      </div>
    </div>
  );
}
