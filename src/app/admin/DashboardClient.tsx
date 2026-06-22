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

function TodaySalesStatusLine({ todayTotal, target }: { todayTotal: number; target: number }) {
  const percent = Math.min(Math.round((todayTotal / target) * 100), 100);
  const remaining = Math.max(target - todayTotal, 0);

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Прогрес денного плану продажів</h3>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-extrabold text-slate-900 font-mono">{todayTotal.toLocaleString()} ₴</span>
            <span className="text-xs text-slate-500">з цілі {target.toLocaleString()} ₴</span>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Залишилось до цілі</span>
          <span className="text-sm font-bold text-slate-700 font-mono">
            {remaining > 0 ? `${remaining.toLocaleString()} ₴` : "Ціль досягнута! 🎉"}
          </span>
        </div>
      </div>
      <div className="relative w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200/40">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#06B6D4] transition-all duration-1000 ease-out" 
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 font-mono">
        <span>0%</span>
        <span className="font-bold text-[#6366F1]">{percent}% виконано</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function SLASupplyChainMonitor({ repairs, delayRate, missingParts }: { repairs: any[], delayRate: number, missingParts: Array<{ name: string; quantity: number }> }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const statuses = ["received", "diagnostics", "in_progress", "ready"];
  const labels = ["Прийнято", "Діагностика", "В роботі", "Готово"];
  const colors = ["#6366F1", "#F59E0B", "#A855F7", "#06B6D4"];

  const counts = statuses.map((status) => repairs.filter((r) => r.status === status).length);
  const maxCount = Math.max(...counts, 2);

  const width = 500;
  const height = 110;
  const paddingX = 40;
  const paddingY = 15;

  const points = counts.map((count, idx) => {
    const x = paddingX + (idx * (width - paddingX * 2)) / (statuses.length - 1);
    const y = height - paddingY - (count / maxCount) * (height - paddingY * 2);
    return { x, y, count, label: labels[idx], color: colors[idx] };
  });

  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
  }

  return (
    <div className="flex-1 min-w-0 bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Монітор SLA та логістики</h3>
          <h4 className="text-sm font-bold text-slate-900 mt-0.5">SLA Wave & Supply Chain</h4>
        </div>
        {hoveredIdx !== null ? (
          <div className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-white animate-entry">
            <span style={{ color: points[hoveredIdx].color }}>●</span> {points[hoveredIdx].label}:{" "}
            <span className="font-bold">{points[hoveredIdx].count}</span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 font-mono">Наведіть на вершину</span>
        )}
      </div>

      <div className="relative mt-4 h-24 w-full flex items-center justify-center">
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          {pathD && <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth={3} strokeLinecap="round" />}
          {points.map((pt, idx) => (
            <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
              <circle cx={pt.x} cy={pt.y} r={hoveredIdx === idx ? 8 : 4} fill={pt.color} />
            </g>
          ))}
        </svg>
      </div>

      <div className="border-t border-slate-100 pt-3 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${delayRate > 25 ? "bg-[#F43F5E] animate-ping" : "bg-[#10B981]"}`} />
          <span className="text-xs text-slate-700">
            Затримка логістики: <span className="font-bold font-mono text-[#F43F5E]">{delayRate}%</span>
          </span>
        </div>
        {missingParts.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 font-mono max-w-[200px] truncate">
            <span>Замовити:</span>
            <span className="font-bold text-slate-900">{missingParts.map(p => `${p.name} (${p.quantity}шт)`).join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SalesTargetRing({ todayTotal, target, progress }: { todayTotal: number; target: number; progress: number }) {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full md:w-[170px] bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-between shrink-0 shadow-sm">
      <div className="text-center">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Денний план</h3>
        <span className="text-[11px] text-slate-600 font-mono mt-0.5 font-semibold">Ціль: {target.toLocaleString()} ₴</span>
      </div>
      <div className="relative flex items-center justify-center my-3">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle stroke="rgba(0,0,0,0.04)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
          <circle stroke="url(#ringGrad)" fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + " " + circumference} style={{ strokeDashoffset }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} className="transition-all duration-500" />
          <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366F1" /><stop offset="100%" stopColor="#06B6D4" /></linearGradient></defs>
        </svg>
        <div className="absolute font-mono text-sm font-extrabold text-slate-900">{progress}%</div>
      </div>
      <div className="text-center font-mono">
        <span className="text-[10px] text-slate-500 block">Сплачено:</span>
        <span className="text-sm font-bold text-[#6366F1]">{todayTotal.toLocaleString()} ₴</span>
      </div>
    </div>
  );
}

function OpexRunwayCard({ runwayDays, dailyRate, balance }: { runwayDays: number; dailyRate: number; balance: number }) {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = Math.min(Math.round((runwayDays / 90) * 100), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full md:w-[170px] bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-between shrink-0 shadow-sm">
      <div className="text-center">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Запас OPEX</h3>
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

function RefurbishmentWidget({ capital, margin }: { capital: number; margin: number }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Капіталізація складу</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">Відновлення техніки</h4>
      </div>
      <div className="my-4 space-y-3">
        <div>
          <p className="text-[10px] text-slate-500">Кошти у відновленні (активні)</p>
          <p className="text-lg font-bold font-mono text-[#06B6D4]">{capital.toLocaleString()} ₴</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Створена додана вартість (30д)</p>
          <p className="text-lg font-bold font-mono text-[#10B981]">+{margin.toLocaleString()} ₴</p>
        </div>
      </div>
      <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between">
        <span>Внутрішній цикл ремонту</span>
        <span className="text-[#10B981] font-medium font-mono">Margin Active</span>
      </div>
    </div>
  );
}

function B2BPartnerShareWidget({ share, revenue }: { share: number; revenue: number }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">B2B Канал продажів</h3>
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

function CrossSellWidget({ conversionRate, revenue, dealsCount }: { conversionRate: number; revenue: number; dealsCount: number }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Крос-продажі (30д)</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">Cross-selling BI</h4>
      </div>
      <div className="my-4 space-y-3">
        <div>
          <p className="text-[10px] text-slate-500">Конверсія допродажів</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-extrabold font-mono text-[#06B6D4]">{conversionRate}%</span>
            <span className="text-[10px] text-slate-500 font-semibold">({dealsCount} {pluralUk(dealsCount, "угода", "угоди", "угод")})</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Додатковий дохід</p>
          <p className="text-lg font-bold font-mono text-[#10B981]">+{revenue.toLocaleString()} ₴</p>
        </div>
      </div>
      <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between font-mono">
        <span>Cross-sell Ratio</span>
        <span className="text-[#10B981] font-medium">Accessories</span>
      </div>
    </div>
  );
}

function SalesVelocityMatrix({ velocity, peakHours }: { velocity: { device: number; accessory: number; part: number; service: number }; peakHours: number[] }) {
  const totals = Object.values(velocity);
  const maxVal = Math.max(...totals, 1);
  const categories = [
    { key: "device", label: "Пристрої", color: "#6366F1" },
    { key: "accessory", label: "Аксесуари", color: "#06B6D4" },
    { key: "part", label: "Запчастини", color: "#F59E0B" },
    { key: "service", label: "Послуги / Роботи", color: "#A855F7" },
  ];
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Аналітика доходів (30д)</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">Sales Velocity Matrix</h4>
      </div>
      <div className="my-3.5 space-y-2.5">
        {categories.map((c) => {
          const val = velocity[c.key as keyof typeof velocity] || 0;
          const percent = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
          return (
            <div key={c.key}>
              <div className="flex items-center justify-between text-[10px] text-slate-800 font-medium mb-1">
                <span>{c.label}</span>
                <span className="font-mono font-bold">{val.toLocaleString()} ₴</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/30">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: c.color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-100 pt-2 text-[9px] text-slate-500 flex items-center justify-between">
        <span>Найактивніші години клієнтів:</span>
        <span className="font-bold text-slate-800 font-mono">{peakHours.map(h => `${h}:00`).join(", ")}</span>
      </div>
    </div>
  );
}

function StockAlerts({ alerts, title = "Низький запас" }: { alerts: { item: string; stock: number; urgent: boolean }[]; title?: string }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">Критичні залишки</h4>
      </div>
      <div className="mt-4 space-y-2.5 flex-1 justify-center flex flex-col">
        {alerts.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">Рівень запасів у нормі</p>
        ) : (
          alerts.map((a, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl px-3.5 py-2 border" style={{ background: a.urgent ? "rgba(244,63,94,0.06)" : "rgba(245,158,11,0.06)", borderColor: a.urgent ? "rgba(244,63,94,0.15)" : "rgba(245,158,11,0.15)" }}>
              <span className="text-xs text-slate-800 font-medium truncate max-w-[150px]">{a.item}</span>
              <span className="text-[11px] font-mono font-bold" style={{ color: a.urgent ? "#F43F5E" : "#F59E0B" }}>{a.stock === 0 ? "Немає" : `${a.stock} шт`}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// SMART INTELLIGENCE WIDGETS
// ============================================================

type ModelAnalyticsItem = {
  brand: string;
  model: string;
  repair_count: number;
  sold_count: number;
  avg_margin: number;
  avg_days_to_sell: number;
  demand_score: number;
};

type StockoutItem = {
  item_id: string;
  item_name: string;
  item_type: string;
  current_stock: number;
  avg_daily_demand: number;
  days_until_stockout: number;
  restock_urgency: string;
  margin_percent: number;
};

type HeatmapRow = {
  dow: number;
  hour_of_day: number;
  total_revenue: number;
  tx_count: number;
  avg_check: number;
};

type SmartInsight = {
  type: "opportunity" | "warning" | "achievement" | "info";
  title: string;
  description: string;
  action?: string;
  impact: "high" | "medium" | "low";
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL:   { label: "КРИТИЧНО",   color: "#F43F5E", bg: "rgba(244,63,94,0.06)",  border: "rgba(244,63,94,0.18)" },
  LOW:        { label: "МАЛО",       color: "#F59E0B", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)" },
  DEAD_STOCK: { label: "DEAD STOCK", color: "#6366F1", bg: "rgba(99,102,241,0.06)", border: "rgba(99,102,241,0.18)" },
  OK:         { label: "ОК",         color: "#10B981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.18)" },
};

const DOW_UA = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function PhoneModelDemandWidget({ models }: { models: ModelAnalyticsItem[] }) {
  const maxScore = Math.max(...models.map((m) => m.demand_score), 1);

  if (models.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Аналітика попиту</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">📱 Топ моделей телефонів</h4>
        <p className="text-xs text-slate-400 italic text-center py-8">Дані з&apos;являться після перших продажів та ремонтів</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Аналітика попиту (90 днів)</h3>
            <h4 className="text-sm font-bold text-slate-900 mt-0.5">📱 Топ моделей телефонів</h4>
          </div>
          <span className="text-[9px] text-slate-400 font-mono bg-slate-50 border border-slate-100 px-2 py-1 rounded shrink-0 ml-2">
            Demand Score
          </span>
        </div>
        <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
          <p className="text-[10px] text-slate-600 font-semibold">Як рахується Demand Score?</p>
          <p className="text-[11px] font-mono text-slate-700 mt-1">
            Score = (ремонти × 0.35) + (продажі × 0.65)
          </p>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            Ремонтам менший вагомий коефіцієнт — це сигнал попиту на обслуговування.
            Продажі важливіші, бо генерують живий виторг і маржу.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {models.slice(0, 8).map((m, idx) => {
          const percent = maxScore > 0 ? Math.round((m.demand_score / maxScore) * 100) : 0;
          const isHot = m.demand_score >= maxScore * 0.7;
          const repairPart = Math.round(m.repair_count * 0.35 * 10) / 10;
          const salesPart = Math.round(m.sold_count * 0.65 * 10) / 10;
          return (
            <div key={idx} className={`rounded-xl p-3 border ${isHot ? "border-orange-100 bg-orange-50/30" : "border-slate-100"}`}>
              <div className="flex items-center gap-1.5 mb-2.5">
                {isHot && <span className="text-[#F43F5E] text-[11px] animate-pulse">🔥</span>}
                <span className="text-[13px] font-bold text-slate-900">{m.brand} {m.model}</span>
                {isHot && <span className="ml-auto text-[9px] font-bold text-[#F43F5E] bg-red-50 border border-red-100 px-1.5 py-0.5 rounded shrink-0">Топ попит</span>}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-2.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Ремонтів за 90 днів</span>
                  <span className="font-bold font-mono text-[#A855F7]">{m.repair_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Продажів за 90 днів</span>
                  <span className="font-bold font-mono text-[#6366F1]">{m.sold_count}</span>
                </div>
                {m.avg_margin > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Середня маржа</span>
                    <span className="font-bold font-mono text-[#10B981]">+{m.avg_margin.toLocaleString()} ₴</span>
                  </div>
                )}
                {m.avg_days_to_sell > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Середній обіг</span>
                    <span className="font-bold font-mono text-slate-600">~{m.avg_days_to_sell} днів</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${percent}%`,
                      background: isHot
                        ? "linear-gradient(90deg, #F43F5E, #F59E0B)"
                        : "linear-gradient(90deg, #6366F1, #06B6D4)",
                    }}
                  />
                </div>
                <span className="text-[11px] font-bold font-mono shrink-0 w-8 text-right" style={{ color: isHot ? "#F43F5E" : "#6366F1" }}>
                  {m.demand_score}
                </span>
              </div>

              <p className="text-[9px] text-slate-400 font-mono">
                ({m.repair_count} × 0.35 = {repairPart}) + ({m.sold_count} × 0.65 = {salesPart}) = {m.demand_score}
              </p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 pt-3 mt-4">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-700">Як використовувати:</span>{" "}
          Моделі з найвищим Score — тримати на складі в першу чергу.
          Висока маржа + короткий обіг = пріоритет замовлення.
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-slate-400 font-mono">ремонти × 0.35 + продажі × 0.65</span>
          <span className="text-[9px] text-[#6366F1] font-medium font-mono">Demand Intelligence</span>
        </div>
      </div>
    </div>
  );
}


function RevenueHeatmapWidget({ heatmap }: { heatmap: HeatmapRow[] }) {
  const workingDows = [1, 2, 3, 4, 5, 6]; // Mon–Sat
  const workingHours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  // Build lookup: dow → hour → avg_check
  const lookup = new Map<string, number>();
  let maxAvgCheck = 0;
  heatmap.forEach((row) => {
    const key = `${row.dow}-${row.hour_of_day}`;
    lookup.set(key, row.avg_check);
    if (row.avg_check > maxAvgCheck) maxAvgCheck = row.avg_check;
  });

  // Best slot (peak money moment)
  let bestDow = 0;
  let bestHour = 0;
  let bestCheck = 0;
  heatmap.forEach((row) => {
    if (row.avg_check > bestCheck) {
      bestCheck = row.avg_check;
      bestDow = row.dow;
      bestHour = row.hour_of_day;
    }
  });

  function cellColor(val: number): string {
    if (val === 0) return "rgba(0,0,0,0.03)";
    const ratio = val / maxAvgCheck;
    if (ratio > 0.75) return "rgba(99,102,241,0.85)";
    if (ratio > 0.5)  return "rgba(99,102,241,0.45)";
    if (ratio > 0.25) return "rgba(99,102,241,0.2)";
    return "rgba(99,102,241,0.08)";
  }

  if (heatmap.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Настрій покупців</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">Пікові години доходу</h4>
        <p className="text-xs text-slate-400 italic text-center py-8">Дані з'являться після перших продажів</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Настрій покупців (60д)</h3>
          <h4 className="text-sm font-bold text-slate-900 mt-0.5">🕐 Коли найбільший середній чек</h4>
        </div>
        {bestCheck > 0 && (
          <div className="text-right">
            <span className="text-[9px] text-slate-400 block">Пік</span>
            <span className="text-xs font-bold font-mono text-[#6366F1]">
              {DOW_UA[bestDow]} {bestHour}:00
            </span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] font-mono border-separate" style={{ borderSpacing: "2px" }}>
          <thead>
            <tr>
              <th className="text-slate-400 font-normal pr-1 text-right w-[28px]"></th>
              {workingDows.map((d) => (
                <th key={d} className="text-center text-slate-500 font-semibold pb-1" style={{ width: "14%" }}>
                  {DOW_UA[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workingHours.map((h) => (
              <tr key={h}>
                <td className="text-slate-400 font-normal pr-1 text-right">{h}:00</td>
                {workingDows.map((d) => {
                  const val = lookup.get(`${d}-${h}`) ?? 0;
                  const isPeak = d === bestDow && h === bestHour && val > 0;
                  return (
                    <td key={d} title={val > 0 ? `${val.toLocaleString()} ₴` : "—"}
                      className="text-center rounded transition-all duration-200 cursor-default"
                      style={{
                        background: isPeak ? "rgba(99,102,241,1)" : cellColor(val),
                        height: "18px",
                        outline: isPeak ? "2px solid #6366F1" : "none",
                      }}
                    >
                      {val > 0 && (
                        <span style={{ color: cellColor(val) === "rgba(0,0,0,0.03)" ? "#aaa" : "white", fontSize: "8px" }}>
                          {(val / 1000).toFixed(0)}к
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 pt-2 mt-3 flex items-center justify-between text-[9px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span>Слабо</span>
          <div className="flex gap-0.5">
            {[0.08, 0.2, 0.45, 0.85].map((op, i) => (
              <div key={i} className="w-3 h-2 rounded-sm" style={{ background: `rgba(99,102,241,${op})` }} />
            ))}
          </div>
          <span>Сильно</span>
        </div>
        <span className="text-[#6366F1] font-medium">Revenue Heatmap</span>
      </div>
    </div>
  );
}

function StockoutIntelligenceWidget({ items }: { items: StockoutItem[] }) {
  const criticalItems = items.filter((i) => i.restock_urgency !== "OK").slice(0, 8);

  if (criticalItems.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Прогноз залишків</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">📦 Stockout Intelligence</h4>
        <p className="text-xs text-slate-400 italic text-center py-8">Всі позиції в нормальному запасі ✅</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Прогноз залишків</h3>
          <h4 className="text-sm font-bold text-slate-900 mt-0.5">📦 Stockout Intelligence</h4>
        </div>
        <span className="text-[10px] font-bold text-[#F43F5E] font-mono bg-red-50 border border-red-100 px-2 py-0.5 rounded">
          {criticalItems.filter((i) => i.restock_urgency === "CRITICAL").length} критичних
        </span>
      </div>
      <div className="space-y-3">
        {criticalItems.map((item) => {
          const cfg = URGENCY_CONFIG[item.restock_urgency] ?? URGENCY_CONFIG.OK;
          const maxDays = 30;
          const daysBar = item.days_until_stockout >= 999
            ? 100
            : Math.min(Math.round((item.days_until_stockout / maxDays) * 100), 100);
          return (
            <div key={item.item_id}
              className="rounded-xl px-3.5 py-2.5 border"
              style={{ background: cfg.bg, borderColor: cfg.border }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-slate-800 block truncate">{item.item_name}</span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {item.item_type === "part" ? "Запчастина" : "Аксесуар"} · {item.current_stock} шт · {item.avg_daily_demand.toFixed(1)} шт/д
                  </span>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: cfg.color }}>
                    {cfg.label}
                  </span>
                  {item.days_until_stockout < 999 && (
                    <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                      ~{item.days_until_stockout}д
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-white/60 h-1 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${daysBar}%`, background: cfg.color }}
                />
              </div>
              {item.margin_percent > 0 && (
                <p className="text-[9px] text-slate-500 font-mono mt-1">Маржа: {item.margin_percent}%</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-100 pt-2 mt-3 flex items-center justify-between text-[9px] text-slate-400 font-mono">
        <span>Попит за 30 днів</span>
        <span className="text-[#F59E0B] font-medium">Inventory Forecast</span>
      </div>
    </div>
  );
}

function AIInsightPanel({
  ownerStats,
}: {
  ownerStats: NonNullable<DashboardData["ownerStats"]>;
}) {
  const [insights, setInsights] = useState<SmartInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      try {
        const peakSlot = ownerStats.revenueHeatmap.reduce(
          (best, row) => (row.avg_check > (best?.avg_check ?? 0) ? row : best),
          ownerStats.revenueHeatmap[0] ?? null
        );

        const payload = {
          todaySalesTotal: ownerStats.todaySalesTotal,
          salesTarget: ownerStats.salesTarget,
          salesProgress: ownerStats.salesProgress,
          activeRepairs: ownerStats.activeRepairs,
          awaitingParts: ownerStats.awaitingParts,
          crossSellConversionRate: ownerStats.crossSellConversionRate,
          crossSellRevenue30Days: ownerStats.crossSellRevenue30Days,
          supplyChainDelayRate: ownerStats.supplyChainDelayRate,
          customerReturnRate: ownerStats.customerReturnRate,
          partnerVolumeShare: ownerStats.partnerVolumeShare,
          opexRunwayDays: ownerStats.opexRunwayDays,
          dailyOpexRunRate: ownerStats.dailyOpexRunRate,
          topModels: ownerStats.modelAnalytics.slice(0, 5),
          criticalStockout: ownerStats.stockoutForecast
            .filter((s) => s.restock_urgency === "CRITICAL" || s.restock_urgency === "LOW")
            .slice(0, 5),
          peakRevenueDow: peakSlot?.dow ?? 1,
          peakRevenueHour: peakSlot?.hour_of_day ?? 15,
          peakAvgCheck: peakSlot?.avg_check ?? 0,
        };

        const res = await fetch("/api/ai-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        setInsights(Array.isArray(data.insights) ? data.insights : []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, [ownerStats]);

  const typeConfig: Record<SmartInsight["type"], { border: string; bg: string }> = {
    opportunity: { border: "rgba(16,185,129,0.25)",  bg: "rgba(16,185,129,0.04)" },
    warning:     { border: "rgba(244,63,94,0.25)",   bg: "rgba(244,63,94,0.04)" },
    achievement: { border: "rgba(99,102,241,0.25)",  bg: "rgba(99,102,241,0.04)" },
    info:        { border: "rgba(245,158,11,0.25)",  bg: "rgba(245,158,11,0.04)" },
  };

  const impactDot: Record<SmartInsight["impact"], string> = {
    high:   "#F43F5E",
    medium: "#F59E0B",
    low:    "#10B981",
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">AI Бізнес-аналітик</h3>
          <h4 className="text-sm font-bold text-slate-900 mt-0.5">✨ VV Intelligence — Gemini</h4>
        </div>
        {loading && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6366F1] animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#A855F7] animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#06B6D4] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-3.5 animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-2/3 mb-2" />
              <div className="h-2 bg-slate-100 rounded w-full mb-1" />
              <div className="h-2 bg-slate-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-xs text-slate-400 italic text-center py-6">
          Не вдалося отримати AI-інсайти. Перевірте підключення.
        </p>
      )}

      {!loading && !error && insights.length === 0 && (
        <p className="text-xs text-slate-400 italic text-center py-6">
          Недостатньо даних для аналізу. Додайте більше продажів та ремонтів.
        </p>
      )}

      {!loading && insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((insight, idx) => {
            const cfg = typeConfig[insight.type];
            return (
              <div
                key={idx}
                className="rounded-xl border p-3.5 transition-all duration-200 hover:shadow-sm"
                style={{ background: cfg.bg, borderColor: cfg.border }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: impactDot[insight.impact] }}
                      />
                      <h5 className="text-[12px] font-bold text-slate-900 leading-tight">{insight.title}</h5>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
                {insight.action && (
                  <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-between">
                    <span className="text-[10px] font-semibold" style={{ color: cfg.border.replace("0.25", "1").replace("rgba", "rgb").replace(/,\s*[\d.]+\)/, ")") }}>
                      → {insight.action}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {insight.impact === "high" ? "🔴" : insight.impact === "medium" ? "🟡" : "🟢"} {insight.impact}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-slate-100 pt-2 mt-3 flex items-center justify-between text-[9px] text-slate-400 font-mono">
        <span>Powered by Gemini Flash</span>
        <span className="text-[#6366F1] font-medium">VV Intelligence</span>
      </div>
    </div>
  );
}

export function DashboardClient({ userRole, stats, repairs, customers, cashRegisters, devices, accessories, services }: DashboardClientProps) {
  const router = useRouter();
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<any | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
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
          <div className="flex gap-2">
            <AddSaleButton customers={customers} cashRegisters={cashRegisters} devices={devices} accessories={accessories} services={services} size="default" />
            <AddRepairButton customers={customers} devices={devices} size="default" className="flex items-center gap-1.5 rounded-xl border border-[#6366F1]/30 bg-[#6366F1]/10 px-5 py-3 text-sm font-semibold text-[#6366F1] transition-all hover:bg-[#6366F1]/20 cursor-pointer">
              <IconPlus /> Прийняти в ремонт
            </AddRepairButton>
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
            <RefurbishmentWidget capital={stats.ownerStats.refurbishmentCapital} margin={stats.ownerStats.refurbishmentMargin} />
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
