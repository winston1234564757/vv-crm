"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconPlus, IconCustomer, IconBox } from "@/components/icons";
import { AddRepairButton } from "./repairs/AddRepairButton";
import { AddSaleButton } from "./AddSaleButton";
import { CurrentTime } from "@/components/CurrentTime";
import Drawer from "@/components/ui/Drawer";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { SaleDetailView } from "@/components/SaleDetailView";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { pluralUk } from "@/lib/utils/plural";
import { cn } from "@/lib/utils/cn";

import type { DashboardData } from "@/lib/data-dashboard";
import type { getCustomers } from "@/lib/data-customers";
import type { getCashRegisters } from "@/lib/data-finance";
import type { getDevices } from "@/lib/data-devices";
import type { getAccessories } from "@/lib/data-accessories";
import type { getServices } from "@/lib/data-services";
import type { SaleWithDetails } from "@/lib/data-sales";

type Customers = Awaited<ReturnType<typeof getCustomers>>;
type CashRegisters = Awaited<ReturnType<typeof getCashRegisters>>;
type Devices = Awaited<ReturnType<typeof getDevices>>;
type Accessories = Awaited<ReturnType<typeof getAccessories>>;
type Services = Awaited<ReturnType<typeof getServices>>;

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

const statusTones: Record<string, BadgeTone> = {
  received: "info",
  diagnostics: "warning",
  in_progress: "accent",
  awaiting_parts: "danger",
  ready: "success",
  completed: "success",
  handed_over: "neutral",
  cancelled: "danger",
};

const btnPrimary =
  "btn-press inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] h-10 px-4 text-sm font-medium bg-accent text-on-accent hover:bg-accent-hover transition-colors";
const btnSecondary =
  "btn-press inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] h-10 px-4 text-sm font-medium bg-surface text-ink border border-border-strong hover:bg-hover transition-colors";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {children}
    </section>
  );
}

interface DashboardClientProps {
  userRole: "owner" | "manager" | "technician" | "sales";
  stats: DashboardData;
  repairs: any[];
  customers: Customers;
  cashRegisters: CashRegisters;
  devices: Devices;
  accessories: Accessories;
  services: Services;
}

import {
  TodaySalesStatusLine,
  SLASupplyChainMonitor,
  OpexRunwayCard,
  RefurbishmentWidget,
  B2BPartnerShareWidget,
  CrossSellWidget,
  SalesVelocityMatrix,
  PhoneModelDemandWidget,
  RevenueHeatmapWidget,
  StockoutIntelligenceWidget,
  StockAlerts,
} from "@/components/dashboard/Widgets";

export function DashboardClient({ userRole, stats, repairs, customers, cashRegisters, devices, accessories, services }: DashboardClientProps) {
  const router = useRouter();
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<any | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
  const today = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });

  const isLeadership = userRole === "owner" || userRole === "manager";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink flex items-center gap-2.5 text-balance">
            Панель керування <CurrentTime />
          </h1>
          <p className="mt-1 text-sm text-muted capitalize">{today}</p>
        </div>
        {isLeadership && (
          <div className="flex flex-row gap-2 w-full md:w-auto">
            <AddSaleButton customers={customers} cashRegisters={cashRegisters} devices={devices} accessories={accessories} services={services} className={cn(btnPrimary, "flex-1 md:flex-none")}>
              <IconPlus /> <span className="hidden sm:inline">Новий продаж</span><span className="sm:hidden">Продаж</span>
            </AddSaleButton>
            <AddRepairButton customers={customers} variant="secondary" className="flex-1 md:flex-none">
              <span className="hidden sm:inline">Прийняти в ремонт</span><span className="sm:hidden">Ремонт</span>
            </AddRepairButton>
          </div>
        )}
      </header>

      {/* Ціль по прибутку для власника/менеджера рендериться в Task 8 з
          owner-set sales_targets; захардкоджену виторгову ціль прибрано. */}
      {userRole === "sales" && stats.salesStats && (
        <TodaySalesStatusLine todayTotal={stats.salesStats.todaySalesTotal} target={15000} />
      )}

      {isLeadership && stats.ownerStats && (
        <>
          <Section title="Сьогодні">
            <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-4">
              <div className="md:col-span-3 flex flex-col md:flex-row gap-4 md:gap-5">
                <SLASupplyChainMonitor repairs={repairs} delayRate={stats.ownerStats.supplyChainDelayRate} missingParts={stats.ownerStats.expressPartsOrderList} />
                <OpexRunwayCard runwayDays={stats.ownerStats.opexRunwayDays} dailyRate={stats.ownerStats.dailyOpexRunRate} balance={stats.ownerStats.dailyOpexRunRate * stats.ownerStats.opexRunwayDays} />
              </div>
              <StatCard
                label="Утримання клієнтів"
                tone="info"
                value={`${stats.ownerStats.customerReturnRate}%`}
                sub={<>Повторні візити (90д) · <span className="text-ink font-medium">{stats.ownerStats.newCustomers}</span> нових</>}
              />
            </div>
          </Section>

          <Section title="Гроші">
            <div className="card p-5">
              <p className="text-sm font-medium text-muted mb-4">Фінансові баланси</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {stats.ownerStats.cashRegisters.map((cr) => (
                  <button key={cr.id} onClick={() => router.push("/admin/finance")} className="btn-press flex flex-col justify-between rounded-[var(--radius-md)] bg-hover p-4 text-left cursor-pointer border border-border hover:border-border-strong transition-colors">
                    <span className="text-xs font-medium text-muted truncate">{cr.name}</span>
                    <p className="mt-3 text-lg font-semibold tabular text-ink">{cr.balance.toLocaleString()} ₴</p>
                  </button>
                ))}
                {stats.ownerStats.safes.map((sf) => (
                  <button key={sf.id} onClick={() => router.push("/admin/finance")} className="btn-press flex flex-col justify-between rounded-[var(--radius-md)] bg-hover p-4 text-left cursor-pointer border border-border hover:border-border-strong transition-colors">
                    <span className="text-xs font-medium text-muted truncate">Сейф: {sf.name}</span>
                    <p className="mt-3 text-lg font-semibold tabular text-accent-ink">{sf.balance.toLocaleString()} ₴</p>
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Продажі та канали">
            <div className="grid grid-cols-1 gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <SalesVelocityMatrix velocity={stats.ownerStats.salesVelocity} peakHours={stats.ownerStats.peakHours} />
              <RefurbishmentWidget capital={stats.ownerStats.refurbishmentCapital} margin={stats.ownerStats.refurbishmentMargin} onClick={() => router.push("/admin/devices")} />
              <B2BPartnerShareWidget share={stats.ownerStats.partnerVolumeShare} revenue={stats.ownerStats.partnerRevenueTotal} />
              <CrossSellWidget conversionRate={stats.ownerStats.crossSellConversionRate} revenue={stats.ownerStats.crossSellRevenue30Days} dealsCount={stats.ownerStats.crossSellDealsCount} />
            </div>
          </Section>

          <Section title="Склад — сигнали">
            <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-2">
              <StockAlerts alerts={stats.ownerStats.alerts} />
              <StockoutIntelligenceWidget items={stats.ownerStats.stockoutForecast} />
            </div>
          </Section>

          <Section title="Аналітика">
            <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
              <PhoneModelDemandWidget models={stats.ownerStats.modelAnalytics} />
              <RevenueHeatmapWidget heatmap={stats.ownerStats.revenueHeatmap} />
            </div>
          </Section>
        </>
      )}

      {userRole === "technician" && stats.techStats && (
        <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
          <div className="md:col-span-2 card p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">Мої ремонти в роботі</h3>
            {stats.techStats.repairs.map((r) => (
              <button key={r.id} onClick={() => setSelectedRepair(r)} className="flex w-full items-center justify-between py-3 text-left cursor-pointer border-b border-border last:border-0 hover:bg-hover transition-colors rounded-[var(--radius-sm)] px-2 -mx-2">
                <span className="text-ink">{r.device_name}</span>
                <Badge tone={statusTones[r.status] ?? "neutral"}>{statusLabels[r.status] ?? r.status}</Badge>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-4 md:gap-5">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink mb-2">Заблоковані ремонти</h3>
              {stats.techStats.frozenRepairs.map((fr, i) => (
                <div key={i} className="text-xs text-danger p-2.5 bg-danger-subtle rounded-[var(--radius-md)] mt-2">
                  {fr.device_name} — бракує: {fr.missing_part}
                </div>
              ))}
            </div>
            <StockAlerts alerts={stats.techStats.alerts} title="Деталі майстерні" />
          </div>
        </div>
      )}

      {userRole === "sales" && stats.salesStats && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
            <StatCard label="Моя зміна" tone="info" value={`${stats.salesStats.todaySalesTotal.toLocaleString()} ₴`} sub="Всього продажів за сьогодні" />
            <StatCard label="Угоди через партнерів" tone="accent" value={stats.salesStats.partnerDealsCount} sub="Залучено B2B контактів за 30д" />
            <StatCard label="Чеки з аксесуарами" tone="success" value={`${stats.salesStats.accessoriesSharePercent}%`} sub="Частка додаткових продажів за 30д" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
            <div className="card p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">Швидкі дії POS</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Швидкий перехід до нових угод, пошуку клієнтів або перевірки наявності товарів.
                </p>
              </div>
              <div className="mt-5 space-y-3">
                <AddSaleButton customers={customers} cashRegisters={cashRegisters} devices={devices} accessories={accessories} services={services} className={cn(btnPrimary, "w-full")}>
                  <IconPlus /> Відкрити POS термінал
                </AddSaleButton>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/admin/customers" className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] bg-hover border border-border hover:border-border-strong p-3.5 transition-colors text-center text-muted hover:text-ink">
                    <IconCustomer size={20} />
                    <span className="text-xs font-medium mt-1">Пошук клієнтів</span>
                  </Link>
                  <Link href="/admin/accessories" className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] bg-hover border border-border hover:border-border-strong p-3.5 transition-colors text-center text-muted hover:text-ink">
                    <IconBox size={20} />
                    <span className="text-xs font-medium mt-1">Перевірка складу</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="card p-5 md:col-span-2 flex flex-col">
              <h3 className="text-sm font-semibold text-ink">Останні продажі зміни</h3>
              <div className="mt-4 flex-1">
                {stats.salesStats.recentSales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <p className="text-sm text-muted">Сьогодні ви ще не здійснювали продажів</p>
                    <p className="text-xs text-faint mt-1">Оформіть новий продаж через POS термінал</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-ink">
                      <thead>
                        <tr className="border-b border-border text-xs font-medium text-muted">
                          <th className="py-2.5 font-medium">Час</th>
                          <th className="py-2.5 font-medium">Клієнт</th>
                          <th className="py-2.5 font-medium text-center">Товари</th>
                          <th className="py-2.5 font-medium text-right">Сума</th>
                          <th className="py-2.5 font-medium text-right">Дія</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stats.salesStats.recentSales.map((sale: any) => {
                          const date = new Date(sale.created_at);
                          const timeStr = date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
                          const itemCount = sale.items?.length || 0;
                          return (
                            <tr key={sale.id} className="hover:bg-hover">
                              <td className="py-3 tabular text-xs text-muted">{timeStr}</td>
                              <td className="py-3">
                                <div className="font-medium text-ink">{sale.customer_name}</div>
                                {sale.customer_phone && <div className="text-xs text-muted tabular mt-0.5">{sale.customer_phone}</div>}
                              </td>
                              <td className="py-3 text-center">
                                <Badge tone="neutral">{itemCount} {pluralUk(itemCount, "товар", "товари", "товарів")}</Badge>
                              </td>
                              <td className="py-3 text-right font-semibold tabular text-success">{sale.total_amount.toLocaleString()} ₴</td>
                              <td className="py-3 text-right">
                                <button onClick={() => setSelectedSale(sale)} className="text-xs font-medium text-accent-ink hover:text-accent transition-colors">
                                  Деталі
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
            <StockAlerts alerts={stats.salesStats.alerts} title="Склад аксесуарів" />
            <div className="card p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-ink">Робочі інструкції</h3>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-[var(--radius-md)] bg-hover border border-border">
                  <p className="font-semibold text-accent-ink mb-1">Продаж аксесуарів</p>
                  <p className="text-muted leading-relaxed">
                    Завжди пропонуйте захисне скло або чохол до кожного пристрою — це збільшує середній чек і маржинальність.
                  </p>
                </div>
                <div className="p-3.5 rounded-[var(--radius-md)] bg-hover border border-border">
                  <p className="font-semibold text-info mb-1">Партнерська програма</p>
                  <p className="text-muted leading-relaxed">
                    У B2B-угодах обов&apos;язково вказуйте ідентифікатор партнера для коректного кешбеку та обліку обсягів.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Drawer isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title="Деталі продажу" size="half">
        {selectedSale && <SaleDetailView sale={selectedSale} onClose={() => setSelectedSale(null)} />}
      </Drawer>

      <Drawer isOpen={!!selectedRepair} onClose={() => { setSelectedRepair(null); setIsEditingRepair(false); }} title={isEditingRepair ? "Редагувати ремонт" : "Деталі ремонту"} size="half">
        {selectedRepair && (isEditingRepair ? <EditRepairForm onSuccess={() => { setSelectedRepair(null); setIsEditingRepair(false); router.refresh(); }} repair={selectedRepair} /> : <RepairDetailView repair={selectedRepair} onEdit={() => setIsEditingRepair(true)} onClose={() => setSelectedRepair(null)} />)}
      </Drawer>
    </div>
  );
}
