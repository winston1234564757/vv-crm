"use client";

import { useState } from "react";
import { RepairsTable } from "./table";
import { AddRepairButton } from "./AddRepairButton";
import { IconRepair, IconBox, IconWarning, IconList, IconGrid } from "@/components/icons";
import StandardCard from "@/components/ui/StandardCard";
import { pluralUk } from "@/lib/utils/plural";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Device {
  id: string;
  brand: string | null;
  model: string | null;
  imei: string | null;
  status: string;
  needs_repair?: boolean;
  repair_node?: string | null;
  repair_cost?: number;
}

export interface RepairRow {
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
}

function StatCard({
  label,
  value,
  accent,
  sub,
  icon,
  delay = 0,
}: {
  label: string;
  value: string | number;
  accent: "violet" | "cyan" | "rose" | "amber" | "iris";
  sub?: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  const accentColors = {
    violet: { bg: "bg-violet/[0.06] border-violet/10", text: "text-violet" },
    cyan: { bg: "bg-cyan/[0.06] border-cyan/10", text: "text-cyan" },
    rose: { bg: "bg-rose/[0.06] border-rose/10", text: "text-rose" },
    amber: { bg: "bg-amber/[0.06] border-amber/10", text: "text-amber" },
    iris: { bg: "bg-iris/[0.06] border-iris/10", text: "text-iris" },
  };
  const c = accentColors[accent];

  return (
    <div 
      className={`rounded-[2rem] border border-slate-100 bg-slate-50/40 p-1.5 shadow-sm shadow-slate-100/30 flex flex-col transition-all duration-500 hover:shadow-md hover:border-slate-200/80 animate-entry-stagger delay-${delay}`}
    >
      <div 
        className="rounded-[calc(2rem-0.375rem)] bg-white p-5 flex flex-col justify-between h-full shadow-[inset_0_1px_1px_rgba(255,255,255,1)] relative overflow-hidden"
      >
        {/* Subtle background glow orb */}
        <div className={`absolute -right-4 -bottom-4 w-12 h-12 rounded-full blur-2xl opacity-20 ${c.bg}`} />
        
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-1 block">Показник</span>
            <p className="text-xs font-semibold text-slate-600 leading-tight">{label}</p>
          </div>
          <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${c.bg} ${c.text} shrink-0 border shadow-sm`}>
            {icon}
          </span>
        </div>
        
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-[10px] text-slate-400 font-medium flex items-center gap-1 font-mono">
              <span>●</span>
              <span>{sub}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function RepairsClient({
  repairs,
  customers,
  inStockDevices,
}: {
  repairs: RepairRow[];
  customers: Customer[];
  inStockDevices: Device[];
}) {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  const activeRepairs = repairs.filter(
    (r) => !["completed", "handed_over", "cancelled"].includes(r.status)
  );
  const readyCount = repairs.filter((r) => r.status === "ready").length;
  const awaitingParts = repairs.filter((r) => r.status === "awaiting_parts").length;
  const overdueCount = repairs.filter(
    (r) =>
      r.estimated_completion &&
      new Date(r.estimated_completion) < new Date() &&
      !["ready", "completed", "handed_over", "cancelled"].includes(r.status)
  ).length;

  const customerActive = activeRepairs.filter((r) => r.repair_type === "customer").length;
  const internalActive = activeRepairs.filter((r) => r.repair_type === "internal").length;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <IconRepair size={18} />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary text-balance">Ремонти</h1>
          </div>
          <p className="text-sm text-text-secondary pl-[46px]">
            {repairs.length} {pluralUk(repairs.length, "заявка", "заявки", "заявок")} всього
            {" "}·{" "}
            <span className="text-violet font-medium">{customerActive} клієнтські</span>
            {" "}·{" "}
            <span className="text-amber font-medium">{internalActive} складські</span>
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <AddRepairButton customers={customers} devices={inStockDevices} />
        </div>
      </div>

      {/* ── Stats Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Активні ремонти"
          value={activeRepairs.length}
          accent="violet"
          sub={`${repairs.length} усього`}
          icon={<IconRepair size={16} />}
          delay={0}
        />
        <StatCard
          label="Готові до видачі"
          value={readyCount}
          accent="cyan"
          sub="можна забирати"
          icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          delay={1}
        />
        <StatCard
          label="Чекають деталі"
          value={awaitingParts}
          accent="rose"
          sub="постачання в очікуванні"
          icon={<IconBox size={16} />}
          delay={2}
        />
        <StatCard
          label="Прострочено"
          value={overdueCount}
          accent={overdueCount > 0 ? "rose" : "iris"}
          sub="дедлайн минув"
          icon={<IconWarning size={16} />}
          delay={3}
        />
      </div>

      {/* ── Overdue Alert Banner ─────────────────────────────── */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose/20 bg-rose/[0.04] px-4 py-3 animate-entry">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose/10 text-rose">
            <IconWarning size={15} />
          </span>
          <div>
            <p className="text-sm font-semibold text-rose">
              {overdueCount} {pluralUk(overdueCount, "ремонт прострочено", "ремонти прострочено", "ремонтів прострочено")}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">Зверніть увагу — дедлайн минув</p>
          </div>
        </div>
      )}

      {/* ── Unified Repairs Table ────────────────────────────── */}
      <StandardCard>
        <RepairsTable 
          repairs={repairs} 
          viewMode={viewMode} 
          setViewMode={setViewMode} 
        />
      </StandardCard>

      {/* ── Mobile Floating Control Island ───────────────────── */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 text-white border border-slate-800/80 rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-3 w-max max-w-[90vw] animate-entry">
        {/* View Toggle */}
        <button
          onClick={() => setViewMode(viewMode === "kanban" ? "table" : "kanban")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-surface hover:bg-warm-surface active:scale-95 transition-all text-white cursor-pointer"
          title={viewMode === "kanban" ? "Перемкнути на список" : "Перемкнути на дошку"}
        >
          {viewMode === "kanban" ? <IconList size={16} /> : <IconGrid size={16} />}
        </button>

        <div className="h-5 w-px bg-warm-surface shrink-0" />

        {/* Add Repair Button */}
        <AddRepairButton 
          customers={customers} 
          devices={inStockDevices}
          className="flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-xs font-semibold text-white transition-all active:scale-95 cursor-pointer shadow-sm shadow-violet/20"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-white">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Новий ремонт</span>
        </AddRepairButton>
      </div>
    </div>
  );
}
