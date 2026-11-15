"use client";

import { useState } from "react";
import Link from "next/link";
import { BentoCell } from "@/components/ui/BentoCell";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import type { ActiveRepairRow, QueueBucket } from "@/lib/data-operations";
import type { AttentionGroup } from "@/lib/attention";

type HubTab = "ready" | "working" | "received" | "parts" | "attention";

const VISIBLE_LIMIT = 6;

export function RepairsHubCard({
  queueTotal,
  activeRepairs,
  pickupDebt,
  attentionGroups,
  span = 7,
}: {
  queue?: QueueBucket[];
  queueTotal: number;
  activeRepairs: ActiveRepairRow[];
  pickupDebt: number;
  attentionGroups: AttentionGroup[];
  span?: 5 | 6 | 7 | 8 | 12;
}) {
  const readyRepairs = activeRepairs.filter((r) => r.status === "ready");
  const workingRepairs = activeRepairs.filter(
    (r) => r.status === "in_progress" || r.status === "diagnostics",
  );
  const receivedRepairs = activeRepairs.filter((r) => r.status === "received");
  const partsRepairs = activeRepairs.filter((r) => r.status === "awaiting_parts");

  const repairAttentionGroups = attentionGroups.filter((g) => g.code !== "stock_low");
  const repairAttentionCount = repairAttentionGroups.reduce((s, g) => s + g.total, 0);
  const stockAttentionGroup = attentionGroups.find((g) => g.code === "stock_low");

  const defaultTab: HubTab =
    readyRepairs.length > 0
      ? "ready"
      : repairAttentionCount > 0
        ? "attention"
        : workingRepairs.length > 0
          ? "working"
          : receivedRepairs.length > 0
            ? "received"
            : "parts";

  const [activeTab, setActiveTab] = useState<HubTab>(defaultTab);
  const [showAll, setShowAll] = useState(false);

  const tabs: {
    id: HubTab;
    label: string;
    count: number;
    tone: "success" | "accent" | "warning" | "danger" | "neutral";
  }[] = [
    {
      id: "ready",
      label: "На видачу",
      count: readyRepairs.length,
      tone: readyRepairs.length > 0 ? "success" : "neutral",
    },
    {
      id: "working",
      label: "В роботі",
      count: workingRepairs.length,
      tone: workingRepairs.length > 0 ? "accent" : "neutral",
    },
    {
      id: "received",
      label: "Прийнято",
      count: receivedRepairs.length,
      tone: "neutral",
    },
    {
      id: "parts",
      label: "Чекає деталь",
      count: partsRepairs.length,
      tone: partsRepairs.length > 0 ? "warning" : "neutral",
    },
    ...(repairAttentionCount > 0
      ? [
          {
            id: "attention" as const,
            label: "Увага / Борг",
            count: repairAttentionCount,
            tone: "danger" as const,
          },
        ]
      : []),
  ];

  const currentRepairs =
    activeTab === "ready"
      ? readyRepairs
      : activeTab === "working"
        ? workingRepairs
        : activeTab === "received"
          ? receivedRepairs
          : activeTab === "parts"
            ? partsRepairs
            : [];

  const visibleRepairs = showAll ? currentRepairs : currentRepairs.slice(0, VISIBLE_LIMIT);

  return (
    <BentoCell span={span} className="justify-between gap-4">
      <div className="space-y-3.5">
        {/* ── Шапка блока ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Ремонти в роботі та на видачу
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-display text-2xl font-semibold leading-none tabular tracking-tight text-ink">
                {queueTotal}{" "}
                <span className="font-sans text-xs font-normal text-muted">
                  {pluralUk(queueTotal, "активний апарат", "активні апарати", "активних апаратів")}
                </span>
              </p>
              {pickupDebt > 0 && (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-warning-bg px-2 py-0.5 text-xs font-semibold tabular text-warning">
                  До отримання на видачі: {uah(pickupDebt)}
                </span>
              )}
            </div>
          </div>

          <Link
            href="/admin/repairs"
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-hover"
          >
            Усі ремонти →
          </Link>
        </div>

        {/* ── Компактна сегментована шкала статусів (Воронка + Фільтр) ── */}
        <div
          role="tablist"
          aria-label="Статуси ремонтів"
          className={cn(
            "grid grid-cols-2 gap-1.5",
            tabs.length === 5 ? "sm:grid-cols-5" : "sm:grid-cols-4",
          )}
        >
          {tabs.map((tab, idx) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowAll(false);
                }}
                className={cn(
                  "flex flex-col justify-between rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors cursor-pointer",
                  tabs.length === 5 && idx === 4 && "col-span-2 sm:col-span-1",
                  isSelected
                    ? "border-ink bg-surface-elevated shadow-xs"
                    : "border-border-subtle bg-background/60 hover:border-border hover:bg-hover/60",
                )}
              >
                <span className="flex items-center justify-between gap-1 text-[11px] font-medium text-muted">
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      tab.tone === "success" && "bg-success",
                      tab.tone === "accent" && "bg-accent",
                      tab.tone === "warning" && "bg-warning",
                      tab.tone === "danger" && "bg-danger",
                      tab.tone === "neutral" && "bg-subtle",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "mt-1 font-display text-lg font-semibold leading-none tabular",
                    isSelected ? "text-ink" : "text-muted",
                    tab.tone === "danger" && tab.count > 0 && "text-danger",
                    tab.tone === "success" && tab.count > 0 && isSelected && "text-success",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Живий список ремонтів обраної вкладки ── */}
        {activeTab === "attention" ? (
          <div className="space-y-3">
            {repairAttentionGroups.map((group) => (
              <div key={group.code} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span>{group.label}</span>
                  <span className="tabular">{group.total}</span>
                </div>
                <ul className="divide-y divide-border-subtle border-y border-border-subtle">
                  {group.rows.map((row) => (
                    <li key={`${group.code}:${row.id}`}>
                      <Link
                        href={`/admin/repairs/${row.id}`}
                        className="flex items-center justify-between gap-3 py-2 px-1.5 -mx-1.5 rounded-[var(--radius-sm)] text-xs transition-colors hover:bg-hover"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "size-2 rounded-full shrink-0",
                              group.code === "repair_unpaid" ? "bg-danger" : "bg-warning",
                            )}
                          />
                          <span className="truncate font-medium text-ink">{row.title}</span>
                        </span>
                        <span className="shrink-0 tabular text-muted">{row.note}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : currentRepairs.length === 0 ? (
          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-dashed border-border-subtle px-3.5 py-4 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-success shrink-0" />
              У категорії «{tabs.find((t) => t.id === activeTab)?.label}» зараз порожньо
            </span>
            <Link href="/admin/repairs" className="font-medium text-ink hover:underline">
              Відкрити реєстр →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <ul className="divide-y divide-border-subtle border-y border-border-subtle">
              {visibleRepairs.map((r) => {
                const isLongWait =
                  (r.status === "ready" && r.days >= 5) ||
                  (r.status === "awaiting_parts" && r.days >= 7) ||
                  (r.status !== "ready" && r.days >= 3);

                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/repairs/${r.id}`}
                      className="group flex items-center justify-between gap-3 py-2.5 px-1.5 -mx-1.5 rounded-[var(--radius-sm)] transition-colors hover:bg-hover"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-ink group-hover:text-accent transition-colors">
                            {r.device}
                          </span>
                          {r.status === "diagnostics" && (
                            <span className="shrink-0 rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-muted border border-border-subtle">
                              Діагностика
                            </span>
                          )}
                          {r.isWarranty && (
                            <span className="shrink-0 rounded bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                              Гарантія
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                          {r.issue && (
                            <>
                              <span className="truncate max-w-[16rem] text-ink/80">{r.issue}</span>
                              <span className="text-subtle">·</span>
                            </>
                          )}
                          <span className="truncate">{r.customer}</span>
                          {r.phone && (
                            <span className="tabular text-[11px] text-muted">
                              · {r.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] tabular",
                            isLongWait
                              ? "bg-warning-bg font-semibold text-warning"
                              : "text-muted",
                          )}
                          title="Днів у поточному статусі"
                        >
                          {r.days === 0 ? "сьогодні" : `${r.days} дн.`}
                        </span>

                        <div className="min-w-[4rem] sm:min-w-[5rem] text-right">
                          {r.debt > 0 ? (
                            <span className="inline-block rounded bg-warning-bg px-1.5 sm:px-2 py-0.5 text-xs font-semibold tabular text-warning">
                              {uah(r.debt)}
                            </span>
                          ) : r.price > 0 ? (
                            <span className="text-xs font-medium tabular text-success">
                              {uah(r.price)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted">без ціни</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {currentRepairs.length > VISIBLE_LIMIT && (
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs font-medium text-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {showAll
                    ? "Згорнути список"
                    : `Показати ще ${currentRepairs.length - VISIBLE_LIMIT} ${pluralUk(
                        currentRepairs.length - VISIBLE_LIMIT,
                        "ремонт",
                        "ремонти",
                        "ремонтів",
                      )}`}
                </button>
                <Link
                  href={`/admin/repairs?status=${activeTab === "working" ? "in_progress" : activeTab}`}
                  className="text-xs font-medium text-muted hover:text-ink transition-colors"
                >
                  У реєстрі →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Нижній індикатор складу (якщо є дефіцит запчастин/аксесуарів) ── */}
      {stockAttentionGroup && stockAttentionGroup.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full bg-warning shrink-0" />
            <span className="font-medium text-ink">Склад вичерпується:</span>
            <span className="truncate text-muted">
              {stockAttentionGroup.rows
                .slice(0, 3)
                .map((s) => `${s.title} (${s.note})`)
                .join(", ")}
              {stockAttentionGroup.total > 3 && ` +${stockAttentionGroup.total - 3}`}
            </span>
          </div>
          <Link href="/admin/inventory" className="shrink-0 font-semibold text-ink hover:underline">
            Склад ({stockAttentionGroup.total}) →
          </Link>
        </div>
      )}
    </BentoCell>
  );
}
