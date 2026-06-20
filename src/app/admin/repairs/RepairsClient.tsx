"use client";

import { RepairsTable } from "./table";
import { AddRepairButton } from "./AddRepairButton";
import { IconRepair, IconBox, IconWarning } from "@/components/icons";
import GlassCard from "@/components/GlassCard";
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
  const accentStyles = {
    violet: { border: "border-t-violet", iconBg: "bg-violet/10", iconColor: "text-violet", value: "text-violet" },
    cyan:   { border: "border-t-cyan",   iconBg: "bg-cyan/10",   iconColor: "text-cyan",   value: "text-cyan"   },
    rose:   { border: "border-t-rose",   iconBg: "bg-rose/10",   iconColor: "text-rose",   value: "text-rose"   },
    amber:  { border: "border-t-amber",  iconBg: "bg-amber/10",  iconColor: "text-amber",  value: "text-amber"  },
    iris:   { border: "border-t-iris",   iconBg: "bg-iris/10",   iconColor: "text-iris",   value: "text-text-primary" },
  };
  const s = accentStyles[accent];
  return (
    <div className={`card p-5 border-t-[3px] ${s.border} animate-entry-stagger delay-${delay} flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-text-secondary leading-tight max-w-[70%]">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${s.iconBg} ${s.iconColor} shrink-0`}>
          {icon}
        </span>
      </div>
      <div>
        <p className={`text-3xl font-semibold tracking-tight ${s.value}`}>{value}</p>
        {sub && <p className="mt-1 text-[11px] text-text-muted">{sub}</p>}
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
  const activeRepairs = repairs.filter(
    (r) => !["completed", "handed_over", "cancelled"].includes(r.status)
  );
  const readyCount    = repairs.filter((r) => r.status === "ready").length;
  const awaitingParts = repairs.filter((r) => r.status === "awaiting_parts").length;
  const overdueCount  = repairs.filter(
    (r) =>
      r.estimated_completion &&
      new Date(r.estimated_completion) < new Date() &&
      !["ready", "completed", "handed_over", "cancelled"].includes(r.status)
  ).length;

  const customerActive  = activeRepairs.filter((r) => r.repair_type === "customer").length;
  const internalActive  = activeRepairs.filter((r) => r.repair_type === "internal").length;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <IconRepair size={18} />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Ремонти</h1>
          </div>
          <p className="text-sm text-text-secondary pl-[46px]">
            {repairs.length} {pluralUk(repairs.length, "заявка", "заявки", "заявок")} всього
            {" "}·{" "}
            <span className="text-violet font-medium">{customerActive} клієнтські</span>
            {" "}·{" "}
            <span className="text-amber font-medium">{internalActive} складські</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      <GlassCard>
        <RepairsTable repairs={repairs} />
      </GlassCard>
    </div>
  );
}
