"use client";

import { useState } from "react";
import { RepairsTable } from "./table";
import { AddRepairButton } from "./AddRepairButton";
import { IconRepair, IconBox, IconWarning, IconList, IconGrid } from "@/components/icons";
import StandardCard from "@/components/ui/StandardCard";
import { StatCard } from "@/components/ui/StatCard";
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
          tone="accent"
          sub={`${repairs.length} усього`}
          icon={<IconRepair size={16} />}
          className="animate-entry-stagger delay-0"
        />
        <StatCard
          label="Готові до видачі"
          value={readyCount}
          tone="info"
          sub="можна забирати"
          icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          className="animate-entry-stagger delay-1"
        />
        <StatCard
          label="Чекають деталі"
          value={awaitingParts}
          tone="danger"
          sub="постачання в очікуванні"
          icon={<IconBox size={16} />}
          className="animate-entry-stagger delay-2"
        />
        <StatCard
          label="Прострочено"
          value={overdueCount}
          tone={overdueCount > 0 ? "danger" : "default"}
          sub="дедлайн минув"
          icon={<IconWarning size={16} />}
          className="animate-entry-stagger delay-3"
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
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ink/90 text-white border border-border-strong/80 rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-3 w-max max-w-[90vw] animate-entry">
        {/* View Toggle */}
        <button
          onClick={() => setViewMode(viewMode === "kanban" ? "table" : "kanban")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/15 hover:bg-surface/25 active:scale-95 transition-all text-white cursor-pointer"
          title={viewMode === "kanban" ? "Перемкнути на список" : "Перемкнути на дошку"}
        >
          {viewMode === "kanban" ? <IconList size={16} /> : <IconGrid size={16} />}
        </button>

        <div className="h-5 w-px bg-surface/25 shrink-0" />

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
