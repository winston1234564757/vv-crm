"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { IconSearch, IconCheck, IconGrid, IconList, IconWarning } from "@/components/icons";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { RepairDetailView } from "@/components/RepairDetailView";
import Drawer from "@/components/ui/Drawer";
import { RepairsKanban } from "./RepairsKanban";
import { updateRepairStatus, bulkUpdateRepairsStatus, bulkUpdateRepairsTtn } from "@/lib/actions/repairs";

type RepairRow = {
  id: string;
  customer_id: string | null;
  inventory_device_id: string | null;
  repair_type: "customer" | "internal";
  customer_name: string;
  customer_phone: string;
  customer_telegram: string | null;
  device_name: string;
  device_imei: string | null;
  device_password?: string | null;
  device_accessories_included?: string | null;
  device_condition?: string | null;
  device_condition_description?: string | null;
  device_condition_photos?: string[] | null;
  issue: string;
  issue_nodes?: string[] | null;
  issue_diagnostics?: string[] | null;
  status: string;
  payment_status: string | null;
  source: string | null;
  price: number;
  cost: number;
  warranty_months: number;
  notes: string | null;
  np_ttn: string | null;
  is_external_sc: boolean;
  external_sc_cost: number;
  markup_amount: number;
  created_at: string;
  estimated_completion?: string | null;
};

const statusColors: Record<string, string> = {
  received: "var(--color-iris)", diagnostics: "var(--color-amber)", in_progress: "var(--color-violet)",
  awaiting_parts: "var(--color-rose)", ready: "var(--color-cyan)", completed: "var(--color-iris)", handed_over: "var(--color-iris)", cancelled: "var(--color-iris)",
};
const statusLabels: Record<string, string> = {
  received: "Прийнято", diagnostics: "Діагностика", in_progress: "В роботі",
  awaiting_parts: "Чекає деталі", ready: "Готовий", completed: "Виконано", handed_over: "Видано", cancelled: "Скасовано",
};
const paymentLabels: Record<string, string> = { unpaid: "Не оплачено", paid: "Оплачено", partial: "Частково" };
const paymentColors: Record<string, string> = { unpaid: "text-rose bg-rose/10", paid: "text-cyan bg-cyan/10", partial: "text-amber bg-amber/10" };
const sourceLabels: Record<string, string> = { walk_in: "Візит", phone: "Телефон", online: "Онлайн", marketplace: "Маркетплейс" };
const conditionLabels: Record<string, string> = { new: "Новий", like_new: "Як новий", good: "Добрий", fair: "Задовільний", poor: "Поганий" };

export function RepairsTable({ repairs }: { repairs: RepairRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [selectedRepair, setSelectedRepair] = useState<RepairRow | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [statusError, setStatusError] = useState("");
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTtn, setBulkTtn] = useState("");

  const filtered = repairs.filter((r) => {
    if (filter === "external") return r.is_external_sc;
    if (filter === "customer") return r.repair_type === "customer";
    if (filter === "internal") return r.repair_type === "internal";
    if (filter !== "all" && r.status !== filter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return r.customer_name.toLowerCase().includes(q) || r.device_name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  async function handleStatusChange(repairId: string, status: string, e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    setStatusError("");
    startTransition(async () => {
      const res = await updateRepairStatus(repairId, status);
      if (!res.success) {
        setStatusError(res.error || "Помилка при оновленні статусу");
      }
    });
  }

  async function handleBulkStatusChange(status: string) {
    if (selectedIds.length === 0) return;
    setStatusError("");
    startTransition(async () => {
      const res = await bulkUpdateRepairsStatus(selectedIds, status);
      if (res.success) {
        setSelectedIds([]);
      } else {
        setStatusError(res.error || "Помилка групового оновлення статусу");
      }
    });
  }

  async function handleBulkUpdateTtn() {
    if (selectedIds.length === 0) return;
    setStatusError("");
    startTransition(async () => {
      const res = await bulkUpdateRepairsTtn(selectedIds, bulkTtn || null);
      if (res.success) {
        setSelectedIds([]);
        setBulkTtn("");
      } else {
        setStatusError(res.error || "Помилка групового оновлення ТТН");
      }
    });
  }

  return (
    <>
      {statusError && (
        <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {statusError}
        </div>
      )}

      {/* BULK ACTIONS PANEL */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-violet/5 border border-violet/20 p-4 animate-entry mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet text-white text-xxs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-text-primary">ремонтів обрано для групових дій</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <select
              disabled={isPending}
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value);
                  e.target.value = "";
                }
              }}
              className="rounded-xl border border-warm-border bg-white px-3 py-2 text-xs font-medium text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
            >
              <option value="">Змінити статус...</option>
              {Object.entries(statusLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            
            <div className="h-6 w-px bg-iris/20 hidden sm:block mx-1" />
            
            <input
              type="text"
              value={bulkTtn}
              onChange={(e) => setBulkTtn(e.target.value)}
              placeholder="ТТН відправки..."
              className="rounded-xl border border-warm-border bg-white px-3.5 py-2 text-xs text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40 min-w-[150px]"
            />
            <button
              onClick={handleBulkUpdateTtn}
              disabled={isPending || !bulkTtn}
              className="rounded-xl bg-violet hover:bg-violet-hover text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              Задати ТТН
            </button>
            <button
              onClick={() => { setSelectedIds([]); setBulkTtn(""); }}
              className="rounded-xl border border-warm-border bg-white hover:bg-warm-hover text-text-secondary px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук за клієнтом, пристроєм..."
              className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
            />
          </div>
          
          {/* View Toggle */}
          <div className="flex p-0.5 bg-warm-sidebar rounded-xl border border-warm-border shrink-0">
            <button
              onClick={() => setViewMode("kanban")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Дошка"
            >
              <IconGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Список"
            >
              <IconList size={13} />
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {["all", "customer", "internal", "diagnostics", "in_progress", "awaiting_parts", "ready", "external", "completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? f === "customer" ? "bg-violet text-white"
                  : f === "internal" ? "bg-amber text-white"
                  : "bg-violet text-white"
                  : "bg-violet/5 text-text-secondary hover:bg-violet/10 hover:text-text-primary"
              }`}
            >
              {f === "all" ? "Усі"
                : f === "customer" ? "👤 Клієнтські"
                : f === "internal" ? "📦 Складські"
                : f === "external" ? "Сторонній СЦ"
                : statusLabels[f] || f}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="mt-4 -mx-5 -mb-5">
          <RepairsKanban 
            repairs={filtered} 
            onCardClick={(r) => { setSelectedRepair(r); setIsEditing(false); }}
            onEditClick={(r) => { setSelectedRepair(r); setIsEditing(true); }}
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                <th className="pb-2 pr-4 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filtered.map(r => r.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                  />
                </th>
                <th className="pb-2 pr-4">№</th>
                <th className="pb-2 pr-4 hidden md:table-cell">Тип</th>
                <th className="pb-2 pr-4">Клієнт</th>
                <th className="pb-2 pr-4">Пристрій</th>
                <th className="pb-2 pr-4 hidden md:table-cell">Дедлайн</th>
                <th className="pb-2 pr-4 hidden md:table-cell">ТТН Нової Пошти</th>
                <th className="pb-2 pr-4 text-right">Ціна</th>
                <th className="pb-2 pr-4">Статус</th>
                <th className="pb-2 pr-4 hidden sm:table-cell">Оплата</th>
                <th className="pb-2 pr-4 hidden lg:table-cell">Джерело</th>
                <th className="pb-2 pr-4 hidden lg:table-cell">Стан</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const isSelected = selectedIds.includes(r.id);
                  return (
                    <tr 
                      key={r.id} 
                      onClick={() => { setSelectedRepair(r); setIsEditing(false); }}
                      className={`border-b border-iris/5 text-text-primary transition-colors cursor-pointer ${isSelected ? "bg-violet/[0.04]" : "hover:bg-violet/[0.02]"}`}
                    >
                      <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, r.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== r.id));
                            }
                          }}
                          className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                        />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-text-secondary">{r.id.substring(0, 8)}</td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          r.repair_type === "internal"
                            ? "bg-amber/10 text-amber"
                            : "bg-violet/10 text-violet"
                        }`}>
                          {r.repair_type === "internal" ? "📦 Склад" : "👤 Клієнт"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium">{r.customer_name}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col">
                          <span>{r.device_name}</span>
                          {r.is_external_sc && (
                            <span className="mt-1 self-start rounded bg-amber/10 px-2 py-0.5 text-[9px] font-semibold text-amber">
                              Сторонній СЦ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        {r.estimated_completion ? (() => {
                          const isOverdue = 
                            new Date(r.estimated_completion) < new Date() && 
                            !["ready", "completed", "handed_over", "cancelled"].includes(r.status);
                          
                          const isClose = 
                            !isOverdue &&
                            (new Date(r.estimated_completion).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000) &&
                            !["ready", "completed", "handed_over", "cancelled"].includes(r.status);

                          const formattedDate = format(new Date(r.estimated_completion), "dd.MM.yyyy", { locale: uk });

                          if (isOverdue) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose" title="Прострочено!">
                                <span className="shrink-0 animate-pulse"><IconWarning size={13} /></span>
                                {formattedDate}
                              </span>
                            );
                          }
                          if (isClose) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber" title="Дедлайн менше ніж за добу">
                                <span className="shrink-0"><IconWarning size={13} /></span>
                                {formattedDate}
                              </span>
                            );
                          }
                          return <span className="text-xs text-text-secondary">{formattedDate}</span>;
                        })() : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-text-secondary hidden md:table-cell">
                        {r.np_ttn ? (
                          <a
                            href={`https://novaposhta.ua/tracking/?cargo_number=${r.np_ttn}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-violet hover:underline font-semibold text-xs"
                            onClick={(e) => e.stopPropagation()} // Prevent opening drawer
                          >
                            {r.np_ttn} ↗
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium">{r.price.toLocaleString()} грн</td>
                      <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {r.status === "handed_over" || r.status === "cancelled" ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium border-0`}
                                style={{ 
                                  background: `color-mix(in oklch, ${statusColors[r.status]} 18%, transparent)`, 
                                  color: statusColors[r.status] 
                                }}>
                            {r.status === "handed_over" ? <IconCheck size={12} /> : null}
                            {statusLabels[r.status]}
                          </span>
                        ) : (
                          <select
                            value={r.status}
                            disabled={isPending}
                            onChange={(e) => handleStatusChange(r.id, e.target.value, e)}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-medium border-0 outline-none cursor-pointer"
                            style={{ 
                              background: `color-mix(in oklch, ${statusColors[r.status]} 18%, transparent)`, 
                              color: statusColors[r.status] 
                            }}
                          >
                            {Object.entries(statusLabels).map(([val, label]) => (
                              <option key={val} value={val} className="text-text-primary bg-white">{label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs hidden sm:table-cell">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${paymentColors[r.payment_status ?? ""] || ""}`}>
                          {paymentLabels[r.payment_status ?? ""] || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-text-secondary hidden lg:table-cell">{sourceLabels[r.source ?? ""] || r.source || "—"}</td>
                      <td className="py-3 pr-4 text-xs text-text-secondary hidden lg:table-cell">{conditionLabels[r.device_condition ?? ""] || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Drawer 
        isOpen={!!selectedRepair} 
        onClose={() => { setSelectedRepair(null); setIsEditing(false); }} 
        title={isEditing ? "Редагувати ремонт" : "Деталі ремонту"}
        size="half"
      >
        {selectedRepair && (
          isEditing ? (
            <EditRepairForm 
              onSuccess={() => { setSelectedRepair(null); setIsEditing(false); }} 
              repair={selectedRepair} 
            />
          ) : (
            <RepairDetailView 
              repair={selectedRepair} 
              onEdit={() => setIsEditing(true)} 
              onClose={() => setSelectedRepair(null)} 
            />
          )
        )}
      </Drawer>
    </>
  );
}


