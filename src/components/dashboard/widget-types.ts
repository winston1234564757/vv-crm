// `DashboardClientProps`, `DashboardData` and the lookup type aliases that
// used to live here were the old role-branching dashboard's props. Task 8
// rebuilt the dashboard around attention + money and dropped all of it;
// nothing else in the app imported them (checked via grep before deleting).

export const statusColors: Record<string, string> = {
  received: "var(--color-accent)",
  diagnostics: "var(--color-warning)",
  in_progress: "var(--color-info)",
  awaiting_parts: "var(--color-danger)",
  ready: "var(--color-success)",
  completed: "var(--color-success)",
  handed_over: "var(--color-muted)",
  cancelled: "var(--color-danger)",
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
  CRITICAL: { label: "КРИТИЧНО", color: "var(--color-danger)", bg: "var(--color-danger-subtle)", border: "var(--color-danger-subtle)" },
  LOW: { label: "МАЛО", color: "var(--color-warning)", bg: "var(--color-warning-subtle)", border: "var(--color-warning-subtle)" },
  DEAD_STOCK: { label: "МЕРТВИЙ СТОК", color: "var(--color-accent-ink)", bg: "var(--color-accent-subtle)", border: "var(--color-accent-subtle)" },
  OK: { label: "ОК", color: "var(--color-success)", bg: "var(--color-success-subtle)", border: "var(--color-success-subtle)" },
};

export const DOW_UA = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
