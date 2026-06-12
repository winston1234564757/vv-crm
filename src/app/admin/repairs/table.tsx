"use client";

import { useState, useTransition } from "react";
import { IconSearch } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { updateRepairStatus } from "@/lib/actions/repairs";

type RepairRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  device_name: string;
  device_imei: string | null;
  issue: string;
  status: string;
  payment_status: string | null;
  source: string | null;
  device_condition: string | null;
  price: number;
  cost: number;
  warranty_months: number;
  notes: string | null;
  np_ttn: string | null;
  is_external_sc: boolean;
  external_sc_cost: number;
  markup_amount: number;
  created_at: string;
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
  const [selectedRepair, setSelectedRepair] = useState<RepairRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [statusError, setStatusError] = useState("");

  const filtered = repairs.filter((r) => {
    if (filter === "external") return r.is_external_sc;
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

  return (
    <>
      {statusError && (
        <div className="mb-4 rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {statusError}
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex gap-1.5 flex-wrap">
          {["all", "diagnostics", "in_progress", "awaiting_parts", "ready", "external", "completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? "bg-violet text-white" : "bg-violet/5 text-text-secondary hover:bg-violet/10 hover:text-text-primary"}`}
            >
              {f === "all" ? "Усі" : f === "external" ? "Сторонній СЦ" : statusLabels[f] || f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
              <th className="pb-2 pr-4">№</th>
              <th className="pb-2 pr-4">Клієнт</th>
              <th className="pb-2 pr-4">Пристрій</th>
              <th className="pb-2 pr-4">ТТН Нової Пошти</th>
              <th className="pb-2 pr-4 text-right">Ціна</th>
              <th className="pb-2 pr-4">Статус</th>
              <th className="pb-2 pr-4">Оплата</th>
              <th className="pb-2 pr-4">Джерело</th>
              <th className="pb-2 pr-4">Стан</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr 
                  key={r.id} 
                  onClick={() => setSelectedRepair(r)}
                  className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02] cursor-pointer"
                >
                  <td className="py-3 pr-4 font-mono text-xs text-text-secondary">{r.id.substring(0, 8)}</td>
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
                  <td className="py-3 pr-4 text-text-secondary">
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
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${paymentColors[r.payment_status ?? ""] || ""}`}>
                      {paymentLabels[r.payment_status ?? ""] || "—"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-text-secondary">{sourceLabels[r.source ?? ""] || r.source || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-text-secondary">{conditionLabels[r.device_condition ?? ""] || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Drawer isOpen={!!selectedRepair} onClose={() => setSelectedRepair(null)} title="Редагувати ремонт">
        {selectedRepair && (
          <EditRepairForm onSuccess={() => setSelectedRepair(null)} repair={selectedRepair} />
        )}
      </Drawer>
    </>
  );
}

