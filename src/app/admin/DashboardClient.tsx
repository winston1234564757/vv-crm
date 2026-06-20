"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconPlus, IconWarning, IconSearch } from "@/components/icons";
import GlassCard from "@/components/GlassCard";
import { AddRepairButton } from "./repairs/AddRepairButton";
import { AddSaleButton } from "./AddSaleButton";
import { AddDeviceButton } from "./devices/AddDeviceButton";
import { CurrentTime } from "@/components/CurrentTime";
import Drawer from "@/components/ui/Drawer";
import { SaleDetailView } from "@/components/SaleDetailView";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";

import type { getDashboardStats } from "@/lib/data-dashboard";
import type { getRepairsDashboard } from "@/lib/data-repairs";
import type { getCustomers } from "@/lib/data-customers";
import type { getCashRegisters } from "@/lib/data-finance";
import type { getDevices } from "@/lib/data-devices";
import type { getAccessories } from "@/lib/data-accessories";
import type { getServices } from "@/lib/data-services";
import type { SaleWithDetails } from "@/lib/data-sales";

type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
type RepairsDashboard = Awaited<ReturnType<typeof getRepairsDashboard>>;
type Customers = Awaited<ReturnType<typeof getCustomers>>;
type CashRegisters = Awaited<ReturnType<typeof getCashRegisters>>;
type Devices = Awaited<ReturnType<typeof getDevices>>;
type Accessories = Awaited<ReturnType<typeof getAccessories>>;
type Services = Awaited<ReturnType<typeof getServices>>;

const statusColors: Record<string, string> = {
  received: "var(--color-iris)",
  diagnostics: "var(--color-amber)",
  in_progress: "var(--color-violet)",
  awaiting_parts: "var(--color-rose)",
  ready: "var(--color-cyan)",
  completed: "var(--color-iris)",
  handed_over: "var(--color-iris)",
  cancelled: "var(--color-iris)",
};

const statusLabels: Record<string, string> = {
  received: "Прийнято",
  diagnostics: "Діагностика",
  in_progress: "В роботі",
  awaiting_parts: "Чекає деталі",
  ready: "Готовий",
  completed: "Виконано",
  handed_over: "Видано",
  cancelled: "Скасовано",
};

interface DashboardClientProps {
  stats: DashboardStats;
  repairs: RepairsDashboard;
  customers: Customers;
  cashRegisters: CashRegisters;
  devices: Devices;
  accessories: Accessories;
  services: Services;
}

function SalesChart({ weeklySales, weeklyDays }: { weeklySales: number[]; weeklyDays: string[] }) {
  const maxSale = Math.max(...weeklySales, 1);
  return (
    <GlassCard className="md:col-span-3" interactive>
      <h2 className="text-sm font-semibold text-text-primary">Продажі за тиждень</h2>
      <div className="mt-4 flex items-end justify-between gap-2">
        {weeklySales.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[0.625rem] font-medium text-text-secondary">{(v / 1000).toFixed(1)}k</span>
            <div
              className="w-full origin-bottom transition-transform duration-500"
              role="img"
              aria-label={`${weeklyDays[i]}: ${v.toLocaleString()} грн`}
              style={{
                height: "140px",
                backgroundColor: "var(--color-violet)",
                transform: `scaleY(${v / maxSale})`,
                borderRadius: "0.375rem",
              }}
            />
            <span className="text-[0.625rem] text-text-secondary">{weeklyDays[i]}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function StockAlerts({ alerts }: { alerts: { item: string; stock: number; urgent: boolean }[] }) {
  return (
    <GlassCard interactive>
      <h2 className="text-sm font-semibold text-text-primary">Низький запас</h2>
      <div className="mt-3 space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-text-secondary">Немає попереджень</p>
        ) : (
          alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl px-3.5 py-2"
              style={{
                background: a.urgent
                  ? "color-mix(in oklch, var(--color-rose) 8%, transparent)"
                  : "color-mix(in oklch, var(--color-amber) 8%, transparent)",
              }}
            >
              <span className="text-sm text-text-primary">{a.item}</span>
              <span
                className="text-xs font-semibold"
                style={{ color: a.urgent ? "var(--color-rose)" : "var(--color-amber)" }}
              >
                {a.stock === 0 ? "Немає" : `${a.stock} шт`}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

export function DashboardClient({
  stats,
  repairs,
  customers,
  cashRegisters,
  devices,
  accessories,
  services,
}: DashboardClientProps) {
  const router = useRouter();
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<RepairsDashboard[number] | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);

  const today = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary flex items-center gap-2">
            Дашборд
            <CurrentTime />
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary capitalize">{today}</p>
        </div>
        <div className="hidden md:flex gap-2">
          <AddSaleButton
            customers={customers}
            cashRegisters={cashRegisters}
            devices={devices}
            accessories={accessories}
            services={services}
            size="default"
          />
          <AddRepairButton
            customers={customers}
            devices={devices}
            size="default"
            className="flex items-center gap-1.5 rounded-xl border border-violet/20 px-5 py-3 text-sm font-medium text-violet transition-colors hover:bg-violet/5"
          >
            <IconPlus /> Ремонт
          </AddRepairButton>
        </div>
      </div>

      {/* Mobile Quick Actions (Premium UX) */}
      <div className="flex md:hidden gap-3 mb-2">
        <AddSaleButton
          customers={customers}
          cashRegisters={cashRegisters}
          devices={devices}
          accessories={accessories}
          services={services}
          className="flex-1 flex flex-col items-center justify-center gap-2.5 rounded-[20px] bg-violet py-4 px-2 text-[12px] font-semibold text-white shadow-[0_8px_16px_rgba(100,50,255,0.2)] active:scale-95 transition-all text-center leading-tight"
        >
          <span className="p-2 bg-white/20 rounded-full">
            <IconPlus />
          </span>
          Новий продаж
        </AddSaleButton>
        <AddRepairButton
          customers={customers}
          devices={devices}
          className="flex-1 flex flex-col items-center justify-center gap-2.5 rounded-[20px] bg-white border border-warm-border py-4 px-2 text-[12px] font-semibold text-text-primary shadow-[0_4px_12px_rgba(0,0,0,0.04)] active:scale-95 transition-all text-center leading-tight"
        >
          <span className="p-2 bg-violet/10 text-violet rounded-full">
            <IconPlus />
          </span>
          Новий ремонт
        </AddRepairButton>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="md:col-span-2">
          <GlassCard interactive>
            <p className="text-xs font-medium tracking-wider text-text-secondary">Продажі сьогодні</p>
            <p className="mt-2 text-4xl font-light tracking-tight text-text-primary">
              {stats.todaySalesTotal.toLocaleString()} грн
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-xs font-medium text-cyan">↑</span>
              <span className="text-xs text-text-secondary">за сьогодні</span>
            </div>
          </GlassCard>
        </div>
        <GlassCard interactive>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Активні ремонти</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{stats.activeRepairs}</p>
          {stats.awaitingParts > 0 && <p className="mt-1 text-xs text-amber">{stats.awaitingParts} очікують деталі</p>}
        </GlassCard>
        <GlassCard interactive>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Нові клієнти</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{stats.newCustomers}</p>
          <p className="mt-1 text-xs text-cyan">за сьогодні</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <SalesChart weeklySales={stats.weeklySales} weeklyDays={stats.weeklyDays} />
        <GlassCard interactive>
          <h2 className="text-sm font-semibold text-text-primary">Швидкі дії</h2>
          <div className="mt-3 space-y-2">
            <AddDeviceButton className="flex w-full items-center gap-2 rounded-xl bg-violet/5 px-4 py-3 text-sm font-medium text-violet transition-colors hover:bg-violet/10" />
            <AddRepairButton
              customers={customers}
              devices={devices}
              className="flex w-full items-center gap-2 rounded-xl bg-cyan/5 px-4 py-3 text-sm font-medium text-cyan transition-colors hover:bg-cyan/10"
            >
              <IconPlus /> Новий ремонт
            </AddRepairButton>
            <Link
              href="/admin/customers"
              className="btn-press flex w-full items-center gap-2 rounded-xl bg-amber/5 px-4 py-3 text-sm font-medium text-amber transition-colors hover:bg-amber/10"
            >
              <IconSearch /> Знайти клієнта
            </Link>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <GlassCard className="md:col-span-1" interactive>
          <h2 className="text-sm font-semibold text-text-primary">Статуси ремонтів</h2>
          <div className="mt-3 space-y-2.5">
            {repairs.length === 0 ? (
              <p className="text-sm text-text-secondary">Немає активних ремонтів</p>
            ) : (
              repairs.map((r, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedRepair(r)}
                  className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-colors"
                >
                  <span className="truncate text-sm text-text-primary hover:text-violet transition-colors">{r.device_name}</span>
                  <span
                    className="shrink-0 rounded-lg px-2.5 py-0.5 text-[11px] font-medium"
                    style={{
                      background: `color-mix(in oklch, ${statusColors[r.status]} 18%, transparent)`,
                      color: statusColors[r.status],
                    }}
                  >
                    {statusLabels[r.status]}
                  </span>
                </div>
              ))
            )}
          </div>
        </GlassCard>
        <StockAlerts alerts={stats.alerts} />
        <GlassCard interactive>
          <h2 className="text-sm font-semibold text-text-primary">Останні продажі</h2>
          <div className="mt-3 divide-y divide-iris/10">
            {stats.recentSales.map((s, i) => (
              <div
                key={i}
                onClick={() => setSelectedSale(s)}
                className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-white/5 px-1.5 rounded-lg transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary hover:text-violet transition-colors">
                    {s.items.length === 1 ? s.items[0].name : `${s.items[0]?.name || "Товар"} та ще ${s.items.length - 1}`}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {s.customer_name} • {new Date(s.created_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-violet">{s.total_amount.toLocaleString()} грн</p>
              </div>
            ))}
            {stats.recentSales.length === 0 && (
              <p className="py-4 text-sm text-text-secondary text-center">Ще немає продажів</p>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard interactive>
          <h2 className="text-sm font-semibold text-text-primary flex items-center justify-between">
            <span>💰 Касові сейфи та баланси кас</span>
            <span className="text-xs font-normal text-text-secondary">
              Всього в касах: {cashRegisters.reduce((sum, c) => sum + c.balance, 0).toLocaleString()} грн
            </span>
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {cashRegisters.map((cr) => {
              const crColors: Record<string, string> = { 
                tech: "var(--color-violet)", 
                accessories: "var(--color-cyan)", 
                repairs: "var(--color-amber)" 
              };
              const dotColor = crColors[cr.type] ?? "var(--color-iris)";
              return (
                <div
                  key={cr.id}
                  onClick={() => router.push("/admin/finance")}
                  className="btn-press flex flex-col justify-between rounded-xl bg-violet/[0.03] p-4 cursor-pointer hover:bg-violet/[0.08] transition-all border border-warm-border/30 hover:border-violet/20"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                    <span className="text-xs font-medium text-text-secondary">{cr.name}</span>
                  </div>
                  <p className="mt-3 text-2xl font-light tracking-tight text-text-primary">
                    {cr.balance.toLocaleString()} грн
                  </p>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Sale Detail Drawer */}
      <Drawer isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title="Деталі продажу" size="half">
        {selectedSale && <SaleDetailView sale={selectedSale} onClose={() => setSelectedSale(null)} />}
      </Drawer>

      {/* Repair Detail/Edit Drawer */}
      <Drawer
        isOpen={!!selectedRepair}
        onClose={() => {
          setSelectedRepair(null);
          setIsEditingRepair(false);
        }}
        title={isEditingRepair ? "Редагувати ремонт" : "Деталі ремонту"}
        size="half"
      >
        {selectedRepair &&
          (isEditingRepair ? (
            <EditRepairForm
              onSuccess={() => {
                setSelectedRepair(null);
                setIsEditingRepair(false);
                router.refresh();
              }}
              repair={selectedRepair}
            />
          ) : (
            <RepairDetailView
              repair={selectedRepair}
              onEdit={() => setIsEditingRepair(true)}
              onClose={() => setSelectedRepair(null)}
            />
          ))}
      </Drawer>
    </div>
  );
}
