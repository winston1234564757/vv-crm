"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconDevice } from "@/components/icons";
import { statusColors, statusLabels } from "./widget-types";

export function OpexRunwayCard({ runwayDays, dailyRate, balance }: { runwayDays: number; dailyRate: number; balance: number }) {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = Math.min(Math.round((runwayDays / 90) * 100), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full md:w-[170px] bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-between shrink-0 shadow-sm">
      <div className="text-center">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Запас OPEX</h3>
        <span className="text-[10px] text-slate-600 font-mono mt-0.5 block truncate max-w-[130px] font-medium">Резерв: {balance.toLocaleString()} ₴</span>
      </div>
      <div className="relative flex items-center justify-center my-3">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle stroke="rgba(0,0,0,0.04)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
          <circle stroke="url(#runwayGrad)" fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + " " + circumference} style={{ strokeDashoffset }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} className="transition-all duration-500" />
          <defs><linearGradient id="runwayGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#06B6D4" /></linearGradient></defs>
        </svg>
        <div className="absolute flex flex-col items-center justify-center font-mono text-center">
          <span className="text-sm font-extrabold text-slate-900">{runwayDays}</span>
          <span className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold">днів</span>
        </div>
      </div>
      <div className="text-center font-mono">
        <span className="text-[10px] text-slate-500 block">Витрати:</span>
        <span className="text-xs font-bold text-[#10B981]">{dailyRate.toLocaleString()} ₴/д</span>
      </div>
    </div>
  );
}

export function RefurbishmentWidget({ capital, margin, onClick }: { capital: number; margin: number; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm cursor-pointer hover:bg-slate-50/50 hover:border-slate-300 hover:shadow-md transition-all group"
    >
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Капіталізація складу</h3>
        <div className="flex items-center justify-between mt-0.5">
          <h4 className="text-sm font-bold text-slate-900">Відновлення техніки</h4>
          <span className="text-[10px] font-bold text-[#6366F1] opacity-0 group-hover:opacity-100 transition-opacity">Деталі →</span>
        </div>
      </div>
      <div className="my-4 space-y-3">
        <div>
          <p className="text-[10px] text-slate-500">Кошти у відновленні (активні)</p>
          <p className="text-lg font-bold font-mono text-[#06B6D4]">{capital.toLocaleString()} ₴</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Чистий прибуток від відновлення (30д)</p>
          <p className="text-lg font-bold font-mono text-[#10B981]">+{margin.toLocaleString()} ₴</p>
        </div>
      </div>
      <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between">
        <span>Внутрішній цикл ремонту</span>
        <span className="text-[#10B981] font-medium font-mono">Profit Active</span>
      </div>
    </div>
  );
}

export function RefurbishmentDetailsModal({
  isOpen,
  onClose,
  capitalDevices = [],
  marginDevices = [],
  totalCapital,
  totalMargin,
}: {
  isOpen: boolean;
  onClose: () => void;
  capitalDevices?: any[];
  marginDevices?: any[];
  totalCapital: number;
  totalMargin: number;
}) {
  const [activeTab, setActiveTab] = useState<"margin" | "capital">("margin");

  if (!isOpen) return null;

  const devices = activeTab === "margin" ? marginDevices : capitalDevices;

  const soldDevices = activeTab === "margin" ? devices.filter((d: any) => d.status === "sold") : [];
  const stockDevices = activeTab === "margin" ? devices.filter((d: any) => d.status === "in_stock") : [];

  const totalCostPrice = activeTab === "margin" 
    ? soldDevices.reduce((sum: number, d: any) => sum + (d.cost_price || 0), 0)
    : devices.reduce((sum: number, d: any) => sum + (d.cost_price || 0), 0);

  const totalRepairCost = activeTab === "margin"
    ? soldDevices.reduce((sum: number, d: any) => sum + (d.repair_cost || 0), 0)
    : devices.reduce((sum: number, d: any) => sum + (d.repair_cost || 0), 0);
  
  const totalTargetPrice = activeTab === "margin"
    ? soldDevices.reduce((sum: number, d: any) => sum + (d.sale_price || d.price || 0), 0)
    : devices.reduce((sum: number, d: any) => sum + (d.price || 0), 0);
  
  const totalNetProfit = totalTargetPrice - totalCostPrice - totalRepairCost;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 "
          />

          {/* Modal Body */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] z-10 font-sans"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 text-balance tracking-tight">Розшифровка відновлення техніки</h2>
                <p className="text-[10px] text-slate-500 font-medium">Статистика чистого прибутку та активних витрат</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all cursor-pointer"
              >
                <span className="text-lg font-bold leading-none">&times;</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <button
                onClick={() => setActiveTab("margin")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "margin" 
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200 ring-1 ring-slate-900/5" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                }`}
              >
                Завершені (Margin)
              </button>
              <button
                onClick={() => setActiveTab("capital")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "capital" 
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200 ring-1 ring-slate-900/5" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                }`}
              >
                В процесі (Capital)
              </button>
            </div>

            {/* Content Container (Scrollable) */}
            <div className="overflow-y-auto flex-1 bg-slate-50">
              <div className="p-6">
                
                {/* Metrics Summary Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Кількість пристроїв</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-slate-900">{devices.length}</span>
                      {activeTab === "margin" && (
                        <span className="text-xs text-slate-500 font-medium">({soldDevices.length} продано, {stockDevices.length} на вітрині)</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Собівартість викупу</p>
                    <span className="text-2xl font-bold font-mono text-slate-700">{totalCostPrice.toLocaleString()} ₴</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Вартість ремонту</p>
                    <span className="text-2xl font-bold font-mono text-[#F59E0B]">{totalRepairCost.toLocaleString()} ₴</span>
                  </div>
                  <div className={`p-4 rounded-xl border shadow-sm ${activeTab === "margin" ? "bg-[#10B981]/5 border-[#10B981]/20" : "bg-[#06B6D4]/5 border-[#06B6D4]/20"}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: activeTab === "margin" ? "#047857" : "#0E7490" }}>
                      {activeTab === "margin" ? "Чистий прибуток (продані)" : "Потенційний прибуток"}
                    </p>
                    <span className="text-2xl font-bold font-mono" style={{ color: activeTab === "margin" ? "#10B981" : "#06B6D4" }}>
                      {activeTab === "margin" ? `+${totalNetProfit.toLocaleString()}` : `~${totalNetProfit.toLocaleString()}`} ₴
                    </span>
                  </div>
                </div>

                {/* Data Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          <th className="px-4 py-3">Пристрій</th>
                          <th className="px-4 py-3">IMEI</th>
                          <th className="px-4 py-3 text-right">Викуп</th>
                          <th className="px-4 py-3 text-right">Ремонт</th>
                          {activeTab === "margin" && <th className="px-4 py-3 text-right">Продаж</th>}
                          <th className="px-4 py-3 text-right">Цільова ціна</th>
                          <th className="px-4 py-3 text-right">Маржа</th>
                          <th className="px-4 py-3 text-center">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {devices.map((device: any) => {
                          const cost = device.cost_price || 0;
                          const repair = device.repair_cost || 0;
                          const sale = device.sale_price || device.price || 0; // Use actual sale price if available
                          const isSold = device.status === "sold";
                          
                          // Calculate margin only using sale price if sold, otherwise target price
                          const deviceMargin = isSold 
                            ? (device.sale_price || 0) - cost - repair 
                            : (device.price || 0) - cost - repair;

                          return (
                            <tr key={device.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 bg-slate-100 rounded-md text-slate-500">
                                    <IconDevice className="w-4 h-4" />
                                  </div>
                                  <span className="font-semibold text-slate-900">{device.brand} {device.model}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-slate-500">{device.imei || "—"}</td>
                              <td className="px-4 py-3 text-right font-mono text-slate-700">{cost.toLocaleString()} ₴</td>
                              <td className="px-4 py-3 text-right font-mono text-[#F59E0B]">{repair.toLocaleString()} ₴</td>
                              
                              {activeTab === "margin" && (
                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                                  {device.sale_price ? `${device.sale_price.toLocaleString()} ₴` : "—"}
                                </td>
                              )}
                              
                              <td className="px-4 py-3 text-right font-mono text-slate-500">
                                {device.price?.toLocaleString() || "0"} ₴
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: deviceMargin > 0 ? "#10B981" : deviceMargin < 0 ? "#EF4444" : "#64748B" }}>
                                {deviceMargin > 0 ? "+" : ""}{deviceMargin.toLocaleString()} ₴
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase font-mono" style={{ 
                                  backgroundColor: activeTab === "capital" ? "rgba(99,102,241,0.1)" : isSold ? "rgba(16,185,129,0.1)" : "rgba(6,182,212,0.1)",
                                  color: activeTab === "capital" ? "#6366F1" : isSold ? "#10B981" : "#06B6D4",
                                }}>
                                  {activeTab === "capital" ? "SERVICE" : isSold ? "SOLD" : "IN STOCK"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {devices.length === 0 && (
                          <tr>
                            <td colSpan={activeTab === "margin" ? 8 : 7} className="px-4 py-8 text-center text-slate-400 italic">
                              Немає пристроїв у цій категорії
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0 text-right">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
              >
                Закрити
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function B2BPartnerShareWidget({ share, revenue }: { share: number; revenue: number }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">B2B Канал продажів</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">Партнерська мережа</h4>
      </div>
      <div className="my-4">
        <p className="text-[10px] text-slate-500">Оборот партнерів (30д)</p>
        <p className="text-lg font-bold font-mono text-[#A855F7]">{revenue.toLocaleString()} ₴</p>
        <div className="mt-3.5 w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/30">
          <div className="bg-[#A855F7] h-full rounded-full transition-all duration-500" style={{ width: `${share}%` }} />
        </div>
        <p className="text-[10px] text-slate-500 mt-2 font-mono">Частка в загальному доході: <span className="text-slate-800 font-bold">{share}%</span></p>
      </div>
      <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between">
        <span>B2B / B2C Розподіл</span>
        <span className="text-[#A855F7] font-medium font-mono">B2B Share</span>
      </div>
    </div>
  );
}
