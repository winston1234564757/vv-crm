"use client";

import { useTransition, useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { 
  IconRepair, IconCheck, IconWarning, IconEdit, IconSpinner, IconBox
} from "@/components/icons";
import { updateRepairStatus } from "@/lib/actions/repairs";
import type { RepairRow } from "./RepairsClient";

const statusColumns = [
  { status: "received", label: "Прийнято", color: "var(--color-iris)", bg: "bg-iris/10" },
  { status: "diagnostics", label: "Діагностика", color: "var(--color-amber)", bg: "bg-amber/10" },
  { status: "in_progress", label: "В роботі", color: "var(--color-violet)", bg: "bg-violet/10" },
  { status: "awaiting_parts", label: "Чекає деталі", color: "var(--color-rose)", bg: "bg-rose/10" },
  { status: "ready", label: "Готовий", color: "var(--color-cyan)", bg: "bg-cyan/10" }
];

const nextStatusActions: Record<string, { target: string; label: string; bgClass: string }> = {
  received: { target: "diagnostics", label: "Діагностика", bgClass: "bg-amber text-white hover:bg-amber-hover" },
  diagnostics: { target: "in_progress", label: "В роботу", bgClass: "bg-violet text-white hover:bg-violet-hover" },
  in_progress: { target: "ready", label: "Готовий", bgClass: "bg-cyan text-white hover:bg-cyan-hover" },
  awaiting_parts: { target: "in_progress", label: "В роботу", bgClass: "bg-violet text-white hover:bg-violet-hover" },
  ready: { target: "handed_over", label: "Видати", bgClass: "bg-iris text-white hover:bg-iris-hover" }
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
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose animate-entry">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 overflow-x-auto pb-4">
        {statusColumns.map((col) => {
          const colRepairs = repairs.filter((r) => r.status === col.status);
          
          return (
            <div 
              key={col.status} 
              className="flex flex-col rounded-2xl border border-warm-border bg-warm-sidebar/10 p-3 min-w-[250px] min-h-[500px]"
            >
              {/* Column Header */}
              <div className="mb-4 flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  <span>{col.label}</span>
                </h3>
                <span className={`rounded-full px-2 py-0.5 text-xxs font-bold ${col.bg}`} style={{ color: col.color }}>
                  {colRepairs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {colRepairs.length === 0 ? (
                  <div className="text-center py-12 text-xxs text-text-muted select-none">
                    Немає ремонтів
                  </div>
                ) : (
                  colRepairs.map((repair) => {
                    const isOverdue = 
                      repair.estimated_completion && 
                      new Date(repair.estimated_completion) < new Date() && 
                      !["ready", "completed", "handed_over", "cancelled"].includes(repair.status);
                    
                    const action = nextStatusActions[repair.status];

                    return (
                      <div
                        key={repair.id}
                        onClick={() => onCardClick(repair)}
                        className={`card group relative flex flex-col justify-between p-3.5 transition-all duration-200 card-hover cursor-pointer ${
                          actionId === repair.id ? "opacity-60" : ""
                        } ${isOverdue ? "border-rose/40 bg-rose/[0.01]" : ""}`}
                      >
                        <div>
                          {/* Card Header: Tracking ID & Edit */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div>
                              <span className="font-mono text-xxs text-text-secondary">#{repair.id.substring(0, 8)}</span>
                              <h4 className="font-semibold text-text-primary text-xs leading-snug mt-0.5">
                                {repair.device_name}
                              </h4>
                            </div>
                            
                            {/* Actions Overlay on hover */}
                            <div className="flex items-center gap-1 rounded-lg bg-warm-sidebar p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditClick(repair); }}
                                className="flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:bg-violet/10 hover:text-violet cursor-pointer"
                                title="Редагувати"
                              >
                                <IconEdit size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Client Detail */}
                          <div className="mt-2 text-xxs text-text-secondary flex flex-col gap-0.5">
                            <span className="font-medium text-text-primary">{repair.customer_name}</span>
                            <a
                              href={`tel:${repair.customer_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-violet hover:underline inline-flex items-center gap-1 font-mono"
                            >
                              📞 {repair.customer_phone}
                            </a>
                          </div>

                          {/* Issue description */}
                          <p className="mt-2.5 text-xxs text-text-secondary line-clamp-2" title={repair.issue}>
                            {repair.issue}
                          </p>

                          {/* Overdue alert */}
                          {isOverdue && repair.estimated_completion && (
                            <div className="mt-2.5 rounded-lg bg-rose/5 border border-rose/10 p-1.5 flex items-center gap-1 text-[9px] font-bold text-rose animate-pulse">
                              <span className="shrink-0"><IconWarning size={12} /></span>
                              <span>Дедлайн минув: {format(new Date(repair.estimated_completion), "dd.MM.yyyy", { locale: uk })}</span>
                            </div>
                          )}

                          {/* Expected completion if not overdue */}
                          {!isOverdue && repair.estimated_completion && (
                            <div className="mt-2.5 text-[9px] text-text-secondary font-medium">
                              📅 Очікується: {format(new Date(repair.estimated_completion), "dd.MM.yyyy", { locale: uk })}
                            </div>
                          )}
                        </div>

                        {/* Footer: Price, external label & Quick Action */}
                        <div className="mt-3.5 pt-2 border-t border-warm-border/40 flex items-center justify-between gap-1">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-text-secondary leading-none">Сума</span>
                            <span className="text-xs font-bold text-text-primary mt-0.5">
                              {repair.price > 0 ? `${repair.price.toLocaleString()} ₴` : "0 ₴"}
                            </span>
                          </div>

                          {repair.is_external_sc && (
                            <span className="rounded bg-amber/10 px-1.5 py-0.5 text-[9px] font-bold text-amber">
                              Зовнішній СЦ
                            </span>
                          )}

                          {action && (
                            <button
                              disabled={isPending && actionId === repair.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(repair.id, action.target);
                              }}
                              className={`btn-press rounded-lg px-2.5 py-1.5 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${action.bgClass} disabled:opacity-50`}
                            >
                              {isPending && actionId === repair.id ? (
                                <IconSpinner size={10} className="animate-spin" />
                              ) : (
                                <span>{action.label} →</span>
                              )}
                            </button>
                          )}
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
  );
}
