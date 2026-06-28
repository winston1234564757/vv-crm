"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  IconPlus, 
  IconWarning, 
  IconSearch, 
  IconDevice, 
  IconCustomer, 
  IconFinance, 
  IconBox 
} from "@/components/icons";
import GlassCard from "@/components/GlassCard";
import { AddRepairButton } from "./repairs/AddRepairButton";
import { AddSaleButton } from "./AddSaleButton";
import { AddDeviceButton } from "./devices/AddDeviceButton";
import { CurrentTime } from "@/components/CurrentTime";
import Drawer from "@/components/ui/Drawer";
import { SaleDetailView } from "@/components/SaleDetailView";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { pluralUk } from "@/lib/utils/plural";

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

const statusColors: Record<string, string> = {
  received: "#6366F1", // Neo-Violet
  diagnostics: "#F59E0B", // Neon Amber
  in_progress: "#A855F7", // Neon Purple
  awaiting_parts: "#F43F5E", // Neon Rose
  ready: "#06B6D4", // Electric Cyan
  completed: "#10B981", // Green
  handed_over: "#6B7280", // Gray
  cancelled: "#EF4444", // Red
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
  SalesTargetRing,
  OpexRunwayCard,
  RefurbishmentWidget,
  RefurbishmentDetailsModal,
  B2BPartnerShareWidget,
  CrossSellWidget,
  SalesVelocityMatrix,
  PhoneModelDemandWidget,
  RevenueHeatmapWidget,
  StockoutIntelligenceWidget,
  AIInsightPanel,
  StockAlerts
} from "@/components/dashboard/Widgets";

export function DashboardClient({ userRole, stats, repairs, customers, cashRegisters, devices, accessories, services }: DashboardClientProps) {
  const router = useRouter();
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<any | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
  const [isRefurbModalOpen, setIsRefurbModalOpen] = useState(false);
  const today = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    const linkId = "google-fonts-dashboard";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="space-y-6 text-slate-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">Панель керування <CurrentTime /></h1>
          <p className="mt-1 text-xs text-slate-500 capitalize font-medium">{today}</p>
        </div>
        {(userRole === "owner" || userRole === "manager") && (
          <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 sm:static sm:z-auto sm:flex-row sm:gap-2 items-end">
            <div className="shadow-2xl sm:shadow-none rounded-full sm:rounded-none bg-white sm:bg-transparent">
            <AddSaleButton customers={customers} cashRegisters={cashRegisters} devices={devices} accessories={accessories} services={services} size="default" />
            </div>
            <div className="shadow-2xl sm:shadow-none rounded-full sm:rounded-none bg-white sm:bg-transparent">
              <AddRepairButton customers={customers} devices={devices} size="default" className="flex items-center justify-center gap-1.5 rounded-full sm:rounded-xl border border-[#6366F1]/30 bg-[#6366F1] sm:bg-[#6366F1]/10 px-5 py-4 sm:py-3 text-sm font-semibold text-white sm:text-[#6366F1] transition-all hover:bg-[#6366F1]/90 sm:hover:bg-[#6366F1]/20 cursor-pointer">
              <IconPlus /> <span className="hidden sm:inline">Прийняти в ремонт</span>
            </AddRepairButton>
            </div>
          </div>
        )}
      </div>

      {/* Sales Target Status Line Widget */}
      {(userRole === "owner" || userRole === "manager") && stats.ownerStats && (
        <TodaySalesStatusLine 
          todayTotal={stats.ownerStats.todaySalesTotal} 
          target={stats.ownerStats.salesTarget} 
        />
      )}
      {userRole === "sales" && stats.salesStats && (
        <TodaySalesStatusLine 
          todayTotal={stats.salesStats.todaySalesTotal} 
          target={15000} // Target is 15k
        />
      )}

      {(userRole === "owner" || userRole === "manager") && stats.ownerStats && (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <div className="md:col-span-3 flex flex-col md:flex-row gap-5">
              <SLASupplyChainMonitor repairs={repairs} delayRate={stats.ownerStats.supplyChainDelayRate} missingParts={stats.ownerStats.expressPartsOrderList} />
              <SalesTargetRing todayTotal={stats.ownerStats.todaySalesTotal} target={stats.ownerStats.salesTarget} progress={stats.ownerStats.salesProgress} />
              <OpexRunwayCard runwayDays={stats.ownerStats.opexRunwayDays} dailyRate={stats.ownerStats.dailyOpexRunRate} balance={stats.ownerStats.dailyOpexRunRate * stats.ownerStats.opexRunwayDays} />
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Утримання клієнтів</h3>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">Retention & Loyalty</h4>
              </div>
              <div className="my-3">
                <p className="text-[10px] text-slate-500">Коефіцієнт повернень (90д)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold font-mono text-[#06B6D4]">{stats.ownerStats.customerReturnRate}%</span>
                  <span className="text-[9px] text-[#10B981] font-semibold">Повторні візити</span>
                </div>
                <div className="mt-3.5 border-t border-slate-100 pt-2 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Активні клієнти зміни:</span>
                  <span className="text-slate-800 font-bold">{stats.ownerStats.newCustomers} нових</span>
                </div>
              </div>
              <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between font-mono">
                <span>Loyalty metrics</span>
                <span className="text-[#06B6D4] font-medium">LTV Flow</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <SalesVelocityMatrix velocity={stats.ownerStats.salesVelocity} peakHours={stats.ownerStats.peakHours} />
            <RefurbishmentWidget 
              capital={stats.ownerStats.refurbishmentCapital} 
              margin={stats.ownerStats.refurbishmentMargin} 
              onClick={() => setIsRefurbModalOpen(true)}
            />
            <B2BPartnerShareWidget share={stats.ownerStats.partnerVolumeShare} revenue={stats.ownerStats.partnerRevenueTotal} />
            <CrossSellWidget conversionRate={stats.ownerStats.crossSellConversionRate} revenue={stats.ownerStats.crossSellRevenue30Days} dealsCount={stats.ownerStats.crossSellDealsCount} />
            <StockAlerts alerts={stats.ownerStats.alerts} />
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-4">💰 Фінансові баланси</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-6">
              {stats.ownerStats.cashRegisters.map((cr) => (
                <div key={cr.id} onClick={() => router.push("/admin/finance")} className="group flex flex-col justify-between rounded-xl bg-slate-50 p-4 cursor-pointer hover:bg-slate-100/60 transition-all border border-slate-200/40 hover:border-[#6366F1]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[80px]">{cr.name}</span>
                    <span className="h-2 w-2 rounded-full bg-[#06B6D4] animate-pulse shrink-0" />
                  </div>
                  <p className="mt-3 text-lg font-bold font-mono text-slate-900">{cr.balance.toLocaleString()} ₴</p>
                </div>
              ))}
              {stats.ownerStats.safes.map((sf) => (
                <div key={sf.id} onClick={() => router.push("/admin/finance")} className="group flex flex-col justify-between rounded-xl bg-slate-50 p-4 cursor-pointer hover:bg-slate-100/60 transition-all border border-slate-200/40 hover:border-[#A855F7]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[80px]">Сейф: {sf.name}</span>
                    <span className="h-2 w-2 rounded-full bg-[#A855F7] animate-pulse shrink-0" />
                  </div>
                  <p className="mt-3 text-lg font-bold font-mono text-[#A855F7]">{sf.balance.toLocaleString()} ₴</p>
                </div>
              ))}
            </div>
          </div>

          {/* Smart Intelligence Row 1: Model Demand + Revenue Heatmap */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <PhoneModelDemandWidget models={stats.ownerStats.modelAnalytics} />
            <RevenueHeatmapWidget heatmap={stats.ownerStats.revenueHeatmap} />
          </div>

          {/* Smart Intelligence Row 2: Stockout + AI Insights */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <StockoutIntelligenceWidget items={stats.ownerStats.stockoutForecast} />
            <AIInsightPanel ownerStats={stats.ownerStats} />
          </div>
        </>
      )}

      {userRole === "technician" && stats.techStats && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="md:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Мої ремонти в роботі</h3>
            {stats.techStats.repairs.map((r) => (
              <div key={r.id} onClick={() => setSelectedRepair(r)} className="flex items-center justify-between py-3 cursor-pointer border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <span className="text-slate-800">{r.device_name}</span>
                <span className="text-xs px-2 py-1 rounded bg-slate-50" style={{ color: statusColors[r.status] }}>{statusLabels[r.status]}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">Заблоковані ремонти</h3>
              {stats.techStats.frozenRepairs.map((fr, i) => (
                <div key={i} className="text-xs text-red-600 p-2.5 bg-red-50/60 border border-red-100/50 rounded-xl mt-2">{fr.device_name} (Бракує: {fr.missing_part})</div>
              ))}
            </div>
            <StockAlerts alerts={stats.techStats.alerts} title="Деталі майстерні" />
          </div>
        </div>
      )}

      {userRole === "sales" && stats.salesStats && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden group hover:border-[#06B6D4]/30 transition-all duration-300 shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#06B6D4]/5 rounded-full blur-2xl group-hover:bg-[#06B6D4]/10 transition-all duration-500" />
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Моя зміна</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold font-mono text-[#06B6D4]">{stats.salesStats.todaySalesTotal.toLocaleString()} ₴</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">Всього продажів за сьогодні</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden group hover:border-[#A855F7]/30 transition-all duration-300 shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#A855F7]/5 rounded-full blur-2xl group-hover:bg-[#A855F7]/10 transition-all duration-500" />
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Угоди через партнерів</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold font-mono text-[#A855F7]">{stats.salesStats.partnerDealsCount}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">Залучено B2B контактів за 30д</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden group hover:border-[#10B981]/30 transition-all duration-300 shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#10B981]/5 rounded-full blur-2xl group-hover:bg-[#10B981]/10 transition-all duration-500" />
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Чеки з аксесуарами</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold font-mono text-[#10B981]">{stats.salesStats.accessoriesSharePercent}%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">Частка додаткових продажів за 30д</p>
            </div>
          </div>

          {/* Bento Grid layout for actions, feed and stock */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* Block 1: POS Quick Actions */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between group hover:border-[#6366F1]/30 transition-all duration-300 shadow-sm">
              <div>
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Швидкі дії POS</h3>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">POS Quick Actions</h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed font-light">
                  Швидкий перехід до створення нових угод, пошуку клієнтів у базі або перевірки наявності товарів.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <AddSaleButton 
                  customers={customers} 
                  cashRegisters={cashRegisters} 
                  devices={devices} 
                  accessories={accessories} 
                  services={services} 
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#06B6D4] text-white font-bold py-3.5 px-4 shadow-lg hover:shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] w-full cursor-pointer text-sm font-semibold"
                >
                  <IconPlus /> Відкрити POS термінал
                </AddSaleButton>

                <div className="grid grid-cols-2 gap-2">
                  <Link 
                    href="/admin/customers"
                    className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200/40 hover:bg-slate-100 hover:border-slate-200 p-3.5 transition-all text-center group/btn text-slate-500 hover:text-slate-800"
                  >
                    <IconCustomer size={20} />
                    <span className="text-[10px] font-bold text-slate-700 mt-1">Пошук клієнтів</span>
                  </Link>

                  <Link 
                    href="/admin/accessories"
                    className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200/40 hover:bg-slate-100 hover:border-slate-200 p-3.5 transition-all text-center group/btn text-slate-500 hover:text-slate-800"
                  >
                    <IconBox size={20} />
                    <span className="text-[10px] font-bold text-slate-700 mt-1">Перевірка складу</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Block 2: Recent Sales Feed */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 md:col-span-2 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Продажі зміни</h3>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">Останні продажі та транзакції</h4>
              </div>

              <div className="mt-4 flex-1">
                {stats.salesStats.recentSales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <p className="text-xs text-slate-400 italic">Сьогодні ви ще не здійснювали продажів</p>
                    <p className="text-[10px] text-slate-400 mt-1">Оформіть новий продаж через POS термінал</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5">Час</th>
                          <th className="py-2.5">Клієнт</th>
                          <th className="py-2.5 text-center">Товари</th>
                          <th className="py-2.5 text-right">Сума</th>
                          <th className="py-2.5 text-right">Дія</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.salesStats.recentSales.map((sale: any) => {
                          const date = new Date(sale.created_at);
                          const timeStr = date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
                          const itemCount = sale.items?.length || 0;
                          return (
                            <tr key={sale.id} className="group hover:bg-slate-50/50">
                              <td className="py-3 font-mono text-[11px] text-slate-500">{timeStr}</td>
                              <td className="py-3">
                                <div className="font-semibold text-slate-900">{sale.customer_name}</div>
                                {sale.customer_phone && (
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{sale.customer_phone}</div>
                                )}
                              </td>
                              <td className="py-3 text-center font-mono">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200/50 text-[10px] text-slate-700">
                                  {itemCount} {pluralUk(itemCount, "товар", "товари", "товарів")}
                                </span>
                              </td>
                              <td className="py-3 text-right font-bold font-mono text-[#10B981]">
                                {sale.total_amount.toLocaleString()} ₴
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => setSelectedSale(sale)}
                                  className="text-[10px] font-bold text-[#6366F1] hover:text-[#06B6D4] transition-colors bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded px-2.5 py-1"
                                >
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

          {/* Additional lower row: Stock warnings for sales representative */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <StockAlerts alerts={stats.salesStats.alerts} title="Склад аксесуарів" />
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between md:col-span-2 shadow-sm">
              <div>
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Робочі інструкції</h3>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">Операційні стандарти</h4>
              </div>
              <div className="my-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/40">
                  <p className="font-bold text-[#06B6D4] mb-1 font-semibold">Продаж аксесуарів</p>
                  <p className="text-slate-500 leading-relaxed text-[11px] font-light">
                    Завжди пропонуйте захисне скло або чохол до кожного купленого пристрою. Це збільшує середній чек та підвищує загальний показник маржинальності.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/40">
                  <p className="font-bold text-[#A855F7] mb-1 font-semibold">Партнерська програма</p>
                  <p className="text-slate-500 leading-relaxed text-[11px] font-light">
                    При проведенні угод B2B обов&apos;язково вказуйте ідентифікатор партнера для коректного нарахування кешбеку та відстеження обсягів продажів.
                  </p>
                </div>
              </div>
              <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between font-mono">
                <span>KPI target checklist</span>
                <span className="text-[#10B981] font-medium">Active Session</span>
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
