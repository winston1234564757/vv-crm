import type { DashboardData } from "@/lib/data-dashboard";
import type { getCustomers } from "@/lib/data-customers";
import type { getCashRegisters } from "@/lib/data-finance";
import type { getDevices } from "@/lib/data-devices";
import type { getAccessories } from "@/lib/data-accessories";
import type { getServices } from "@/lib/data-services";

export type Customers = Awaited<ReturnType<typeof getCustomers>>;
export type CashRegisters = Awaited<ReturnType<typeof getCashRegisters>>;
export type Devices = Awaited<ReturnType<typeof getDevices>>;
export type Accessories = Awaited<ReturnType<typeof getAccessories>>;
export type Services = Awaited<ReturnType<typeof getServices>>;

export interface DashboardClientProps {
  userRole: "owner" | "manager" | "technician" | "sales";
  stats: DashboardData;
  repairs: any[];
  customers: Customers;
  cashRegisters: CashRegisters;
  devices: Devices;
  accessories: Accessories;
  services: Services;
}

export const statusColors: Record<string, string> = {
  received: "#6366F1", // Neo-Violet
  diagnostics: "#F59E0B", // Neon Amber
  in_progress: "#A855F7", // Neon Purple
  awaiting_parts: "#F43F5E", // Neon Rose
  ready: "#06B6D4", // Electric Cyan
  completed: "#10B981", // Green
  handed_over: "#6B7280", // Gray
  cancelled: "#EF4444", // Red
};

export const statusLabels: Record<string, string> = {
  received: "Прийнято",
  diagnostics: "Діагностика",
  in_progress: "В роботі",
  awaiting_parts: "Чекає деталі",
  ready: "Готовий",
  completed: "Виконано",
  handed_over: "Видано",
  cancelled: "Скасовано",
};

export type ModelAnalyticsItem = {
  brand: string;
  model: string;
  repair_count: number;
  sold_count: number;
  avg_margin: number;
  avg_days_to_sell: number;
  demand_score: number;
};

export type StockoutItem = {
  item_id: string;
  item_name: string;
  item_type: string;
  current_stock: number;
  avg_daily_demand: number;
  days_until_stockout: number;
  restock_urgency: string;
  margin_percent: number;
};

export type HeatmapRow = {
  dow: number;
  hour_of_day: number;
  total_revenue: number;
  tx_count: number;
  avg_check: number;
};

export type SmartInsight = {
  type: "opportunity" | "warning" | "achievement" | "info";
  title: string;
  description: string;
  action?: string;
  impact: "high" | "medium" | "low";
};

export const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL: { label: "КРИТИЧНО", color: "#F43F5E", bg: "rgba(244,63,94,0.06)", border: "rgba(244,63,94,0.18)" },
  LOW: { label: "МАЛО", color: "#F59E0B", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)" },
  DEAD_STOCK: { label: "DEAD STOCK", color: "#6366F1", bg: "rgba(99,102,241,0.06)", border: "rgba(99,102,241,0.18)" },
  OK: { label: "ОК", color: "#10B981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.18)" },
};

export const DOW_UA = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
