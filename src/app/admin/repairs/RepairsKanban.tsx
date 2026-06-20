"use client";

import { useTransition, useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import {
  IconRepair, IconCheck, IconWarning, IconEdit, IconSpinner
} from "@/components/icons";
import { updateRepairStatus } from "@/lib/actions/repairs";
import type { RepairRow } from "./RepairsClient";

const statusColumns = [
  {
    status: "received",
    label: "Прийнято",
    emoji: "📥",
    color: "var(--color-iris)",
    bg: "bg-iris/10",
    textColor: "text-iris",
    accentClass: "border-t-iris",
  },
  {
    status: "diagnostics",
    label: "Діагностика",
    emoji: "🔬",
    color: "var(--color-amber)",
    bg: "bg-amber/10",
    textColor: "text-amber",
    accentClass: "border-t-amber",
  },
  {
    status: "in_progress",
    label: "В роботі",
    emoji: "🔧",
    color: "var(--color-violet)",
    bg: "bg-violet/10",
    textColor: "text-violet",
    accentClass: "border-t-violet",
  },
  {
    status: "awaiting_parts",
    label: "Чекає деталі",
    emoji: "📦",
    color: "var(--color-rose)",
    bg: "bg-rose/10",
    textColor: "text-rose",
    accentClass: "border-t-rose",
  },
  {
    status: "ready",
    label: "Готовий",
    emoji: "✅",
    color: "var(--color-cyan)",
    bg: "bg-cyan/10",
    textColor: "text-cyan",
    accentClass: "border-t-cyan",
  },
];

const nextStatusActions: Record<string, { target: string; label: string; bgClass: string }> = {
  received: { target: "diagnostics", label: "Діагностика", bgClass: "bg-amber/10 text-amber hover:bg-amber/20 border border-amber/20" },
  diagnostics: { target: "in_progress", label: "В роботу", bgClass: "bg-violet/10 text-violet hover:bg-violet/20 border border-violet/20" },
  in_progress: { target: "ready", label: "Готовий →", bgClass: "bg-cyan/10 text-cyan hover:bg-cyan/20 border border-cyan/20" },
  awaiting_parts: { target: "in_progress", label: "В роботу", bgClass: "bg-violet/10 text-violet hover:bg-violet/20 border border-violet/20" },
  ready: { target: "handed_over", label: "Видати ✓", bgClass: "bg-iris/10 text-iris hover:bg-iris/20 border border-iris/20" },
};

const paymentBadge: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "Не оплачено", cls: "bg-rose/10 text-rose" },
  paid: { label: "Оплачено", cls: "bg-cyan/10 text-cyan" },
  partial: { label: "Частково", cls: "bg-amber/10 text-amber" },
};

interface RepairsKanbanProps {
  repairs: RepairRow[];
  onCardClick: (repair: RepairRow) => void;
  onEditClick: (repair: RepairRow) => void;
}

export function RepairsKanban({ repairs, onCardClick, onEditClick }: RepairsKanbanProps) {
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleStatusChange = (repairId: string, nextStatus: string) => {
    setError("");
    setActionId(repairId);
    startTransition(async () => {
      const res = await updateRepairStatus(repairId, nextStatus);
      setActionId(null);
      if (!res.success) {
        setError(res.error || "Помилка оновлення статусу");
      }
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl bg-rose/10 p-3.5 text-sm text-rose animate-entry border border-rose/20">
          {error}
        </div>
      )}

      {/* Scrollable kanban board */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 px-5 pb-5 pt-0" style={{ minWidth: "max-content" }}>
        {statusColumns.map((col) => {
          const colRepairs = repairs.filter((r) => r.status === col.status);

          return (
            <div
              key={col.status}
              className="flex flex-col rounded-2xl border border-warm-border bg-warm-sidebar/30 shrink-0 w-[260px]"
              style={{ minHeight: 480 }}
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between px-3.5 py-3 border-b border-warm-border`}>
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{col.emoji}</span>
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    {col.label}
                  </h3>
                </div>
                <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${col.bg} ${col.textColor}`}>
                  {colRepairs.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2.5 p-2.5 flex-1 overflow-y-auto" style={{ maxHeight: 580 }}>
                {colRepairs.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-10 text-center">
                    <p className="text-xs text-text-muted select-none">Немає ремонтів</p>
                  </div>
                ) : (
                  colRepairs.map((repair) => {
                    const isOverdue =
                      repair.estimated_completion &&
                      new Date(repair.estimated_completion) < new Date() &&
                      !["ready", "completed", "handed_over", "cancelled"].includes(repair.status);

                    const isClose =
                      !isOverdue &&
                      repair.estimated_completion &&
                      new Date(repair.estimated_completion).getTime() - Date.now() < 86_400_000 &&
                      !["ready", "completed", "handed_over", "cancelled"].includes(repair.status);

                    const action = nextStatusActions[repair.status];
                    const payment = paymentBadge[repair.payment_status ?? ""];
                    const isLoading = isPending && actionId === repair.id;

                    return (
                      <div
                        key={repair.id}
                        onClick={() => onCardClick(repair)}
                        className={`group relative flex flex-col gap-0 rounded-xl border bg-white transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-px border-t-[3px] ${col.accentClass} ${
                          isOverdue
                            ? "border-rose/30"
                            : "border-warm-border"
                        } ${isLoading ? "opacity-60" : ""}`}
                      >
                        {/* Card body */}
                        <div className="p-3.5">
                          {/* Top row: ID + edit + type badge */}
                          <div className="flex items-start justify-between gap-1.5 mb-2.5">
                            <div>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-mono text-[9px] text-text-muted tracking-wider">
                                  #{repair.id.substring(0, 8)}
                                </span>
                                <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold leading-none ${
                                  repair.repair_type === "internal"
                                    ? "bg-amber/10 text-amber"
                                    : "bg-violet/10 text-violet"
                                }`}>
                                  {repair.repair_type === "internal" ? "📦 Склад" : "👤 Клієнт"}
                                </span>
                              </div>
                              <h4 className="font-semibold text-text-primary text-[12px] leading-snug">
                                {repair.device_name}
                              </h4>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditClick(repair); }}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-violet/10 hover:text-violet transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                              title="Редагувати"
                            >
                              <IconEdit size={12} />
                            </button>
                          </div>

                          {/* Client info */}
                          <div className="flex flex-col gap-0.5 mb-3">
                            <span className="text-[11px] font-semibold text-text-primary">{repair.customer_name}</span>
                            <a
                              href={`tel:${repair.customer_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-violet hover:underline font-mono"
                            >
                              {repair.customer_phone}
                            </a>
                          </div>

                          {/* Issue */}
                          <p className="text-[10px] text-text-secondary line-clamp-2 leading-relaxed mb-2.5" title={repair.issue}>
                            {repair.issue}
                          </p>

                          {/* Deadline */}
                          {repair.estimated_completion && (
                            <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold ${
                              isOverdue
                                ? "bg-rose/8 text-rose border border-rose/15 animate-pulse"
                                : isClose
                                ? "bg-amber/8 text-amber border border-amber/15"
                                : "bg-warm-sidebar text-text-secondary"
                            }`}>
                              <span className="shrink-0">
                                {isOverdue || isClose ? <IconWarning size={10} /> : "📅"}
                              </span>
                              <span>
                                {isOverdue ? "Прострочено: " : isClose ? "Сьогодні: " : ""}
                                {format(new Date(repair.estimated_completion), "dd.MM.yyyy", { locale: uk })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Card footer */}
                        <div className="flex items-center justify-between gap-1.5 border-t border-warm-border/60 px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-text-primary">
                              {repair.price > 0 ? `${repair.price.toLocaleString()} ₴` : "0 ₴"}
                            </span>
                            {repair.is_external_sc && (
                              <span className="rounded bg-amber/10 px-1.5 py-0.5 text-[8px] font-bold text-amber">
                                СЦ
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Payment badge */}
                            {payment && (
                              <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${payment.cls}`}>
                                {payment.label}
                              </span>
                            )}

                            {/* Action button */}
                            {action && (
                              <button
                                disabled={isLoading}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(repair.id, action.target);
                                }}
                                className={`btn-press rounded-lg px-2.5 py-1 text-[9px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${action.bgClass} disabled:opacity-50`}
                              >
                                {isLoading ? (
                                  <IconSpinner size={9} className="animate-spin" />
                                ) : (
                                  action.label
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
