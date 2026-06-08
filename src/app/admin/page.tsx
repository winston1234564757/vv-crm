"use client";

import { useState } from "react";

/* ---------- types ---------- */

type Metric = {
  label: string;
  value: string;
  delta: string;
  up: boolean;
};

type Sale = {
  id: string;
  item: string;
  customer: string;
  amount: number;
  time: string;
};

type Repair = {
  id: string;
  device: string;
  customer: string;
  status: string;
  statusColor: string;
};

type StockAlert = {
  item: string;
  stock: number;
};

/* ---------- mock data ---------- */

const MOCK_METRICS: Metric[] = [
  { label: "Продажі сьогодні", value: "18 450 грн", delta: "+12%", up: true },
  { label: "Активні ремонти", value: "7", delta: "-2", up: false },
  { label: "Нові клієнти", value: "4", delta: "+2", up: true },
  { label: "Низький запас", value: "3", delta: "позицій", up: false },
];

const MOCK_SALES: Sale[] = [
  { id: "1", item: "iPhone 15 Pro 256GB", customer: "Олена К.", amount: 38500, time: "14:32" },
  { id: "2", item: "Samsung Galaxy S24", customer: "Максим Р.", amount: 29900, time: "13:15" },
  { id: "3", item: "Навушники AirPods Pro", customer: "Анна В.", amount: 8500, time: "12:00" },
  { id: "4", item: "MacBook Air M3", customer: "Дмитро С.", amount: 52000, time: "10:45" },
  { id: "5", item: "Захисне скло iPhone", customer: "Ірина П.", amount: 350, time: "10:10" },
];

const MOCK_REPAIRS: Repair[] = [
  { id: "R-001", device: "iPhone 13 — заміна дисплея", customer: "Андрій М.", status: "Готовий", statusColor: "oklch(55% 0.14 145)" },
  { id: "R-002", device: "Samsung A54 — розбитий екран", customer: "Наталія К.", status: "В роботі", statusColor: "var(--color-amber)" },
  { id: "R-003", device: "Xiaomi Redmi — не заряджається", customer: "Петро В.", status: "Діагностика", statusColor: "var(--color-ink)" },
  { id: "R-004", device: "iPad 9 — заміна батареї", customer: "Юлія С.", status: "В роботі", statusColor: "var(--color-amber)" },
  { id: "R-005", device: "iPhone 12 — не вмикається", customer: "Олексій Г.", status: "Очікує деталі", statusColor: "var(--color-error)" },
];

const MOCK_ALERTS: StockAlert[] = [
  { item: "iPhone 15 Pro Max 256GB", stock: 1 },
  { item: "Захисні скла iPhone 15", stock: 2 },
  { item: "USB-C зарядні блоки 20W", stock: 0 },
];

const WEEKLY_SALES = [12400, 18900, 15200, 22100, 18450, 25800, 20100];
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const MAX_SALE = Math.max(...WEEKLY_SALES);

/* ---------- sub-components ---------- */

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="flex flex-col gap-1 rounded-sm bg-cork p-5 bench-edge">
      <span className="text-xs font-medium uppercase tracking-wider text-ink">
        {metric.label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-iron">
          {metric.value}
        </span>
        <span
          className={`text-xs font-medium ${
            metric.up ? "text-amber" : "text-error"
          }`}
        >
          {metric.delta}
        </span>
      </div>
    </div>
  );
}

function SalesChart() {
  const maxH = 120;
  return (
    <Widget title="Продажі за тиждень" className="md:col-span-2">
      <div className="flex items-end justify-between gap-2 pt-2">
        {WEEKLY_SALES.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-ink">
              {(v / 1000).toFixed(1)}k
            </span>
            <div
              className="w-full rounded-t-sm transition-all duration-500 ease-out-quart"
              style={{
                height: `${(v / MAX_SALE) * maxH}px`,
                backgroundColor: "var(--color-selvedge)",
              }}
            />
            <span className="text-[10px] text-ink">{DAYS[i]}</span>
          </div>
        ))}
      </div>
    </Widget>
  );
}

function RepairStatus() {
  const items = [
    { label: "Готовий", count: 1, color: "oklch(55% 0.14 145)" },
    { label: "В роботі", count: 2, color: "var(--color-amber)" },
    { label: "Діагностика", count: 1, color: "var(--color-ink)" },
    { label: "Очікує деталі", count: 1, color: "var(--color-error)" },
  ];
  const total = items.reduce((a, b) => a + b.count, 0);
  let offset = 0;
  const slices = items.map((item) => {
    const p = item.count / total;
    const dash = `${p * 100} ${(1 - p) * 100}`;
    const slice = (
      <circle
        key={item.label}
        r="36"
        cx="40"
        cy="40"
        fill="none"
        stroke={item.color}
        strokeWidth="8"
        strokeDasharray={dash}
        strokeDashoffset={-offset}
        transform="rotate(-90 40 40)"
      />
    );
    offset += p * 100;
    return slice;
  });

  return (
    <Widget title="Статуси ремонтів">
      <div className="flex items-center gap-4 pt-2">
        <svg width="80" height="80" viewBox="0 0 80 80">
          {slices}
        </svg>
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-ink">{item.label}</span>
              <span className="ml-auto font-medium text-iron">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </Widget>
  );
}

function RecentSales() {
  if (MOCK_SALES.length === 0) {
    return (
      <Widget title="Останні продажі">
        <p className="py-6 text-center text-sm text-ink">
          Сьогодні ще не було продажів
        </p>
      </Widget>
    );
  }
  return (
    <Widget title="Останні продажі">
      <div className="divide-y divide-worn/50 text-sm">
        {MOCK_SALES.map((sale) => (
          <div
            key={sale.id}
            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-iron">{sale.item}</p>
              <p className="text-xs text-ink">{sale.customer}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-iron">
                {sale.amount.toLocaleString()} грн
              </p>
              <p className="text-xs text-ink">{sale.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Widget>
  );
}

function RecentRepairs() {
  if (MOCK_REPAIRS.length === 0) {
    return (
      <Widget title="Активні ремонти">
        <p className="py-6 text-center text-sm text-ink">
          Немає активних ремонтів
        </p>
      </Widget>
    );
  }
  return (
    <Widget title="Активні ремонти">
      <div className="divide-y divide-worn/50 text-sm">
        {MOCK_REPAIRS.map((repair) => (
          <div
            key={repair.id}
            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-iron">{repair.device}</p>
              <p className="text-xs text-ink">{repair.customer}</p>
            </div>
            <span
              className="whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `color-mix(in oklch, ${repair.statusColor} 15%, transparent)`,
                color: repair.statusColor,
              }}
            >
              {repair.status}
            </span>
          </div>
        ))}
      </div>
    </Widget>
  );
}

function StockAlerts() {
  if (MOCK_ALERTS.length === 0) {
    return null;
  }
  return (
    <Widget title="Низький запас">
      <div className="space-y-2 text-sm">
        {MOCK_ALERTS.map((alert) => (
          <div
            key={alert.item}
            className="flex items-center justify-between rounded-sm bg-error/5 px-3 py-2"
          >
            <span className="text-iron">{alert.item}</span>
            <span
              className={`text-xs font-semibold ${
                alert.stock === 0 ? "text-error" : "text-amber"
              }`}
            >
              {alert.stock === 0 ? "Немає" : `${alert.stock} шт`}
            </span>
          </div>
        ))}
      </div>
    </Widget>
  );
}

function Widget({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-sm bg-cork p-5 bench-edge ${className ?? ""}`}>
      <h2 className="text-sm font-semibold tracking-tight text-iron">
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <div className="max-w-sm text-center">
        <p className="text-4xl font-bold text-iron">◈</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-iron">
           Ласкаво просимо до VV CRM
        </h1>
        <p className="mt-2 text-sm text-ink">
          Додайте перший товар або створіть ремонт, і ваша майстерня
          оживе на цьому дашборді.
        </p>
      </div>
    </div>
  );
}

function WidgetGrid() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const widgets: { id: string; node: React.ReactNode }[] = [
    { id: "sales-chart", node: <SalesChart /> },
    { id: "repair-status", node: <RepairStatus /> },
    { id: "recent-sales", node: <RecentSales /> },
    { id: "recent-repairs", node: <RecentRepairs /> },
    { id: "stock-alerts", node: <StockAlerts /> },
  ];

  const visible = widgets.filter((w) => !collapsed[w.id]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {visible.map((w) => (
        <div key={w.id} className="group relative">
          <button
            onClick={() =>
              setCollapsed((prev) => ({ ...prev, [w.id]: true }))
            }
            className="absolute top-3 right-3 z-10 hidden h-5 w-5 items-center justify-center rounded text-xs text-ink opacity-0 transition-opacity hover:bg-worn group-hover:opacity-100 group-hover:flex"
            aria-label="Сховати віджет"
          >
            ✕
          </button>
          {w.node}
        </div>
      ))}
      {collapsed["stock-alerts"] || MOCK_ALERTS.length === 0 ? null : null}
    </div>
  );
}

/* ---------- exported page ---------- */

export default function AdminDashboard() {
  const [loaded] = useState(true);
  const [hasData] = useState(true);
  const [error] = useState<string | null>(null);

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="max-w-sm text-center">
          <p className="text-4xl text-error">⚠</p>
          <h2 className="mt-4 text-lg font-semibold text-iron">
            Помилка завантаження
          </h2>
          <p className="mt-1 text-sm text-ink">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-sm bg-selvedge px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-selvedge-deep"
          >
            Спробувати знову
          </button>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="animate-pulse space-y-4 p-6">
        <div className="h-8 w-48 rounded-sm bg-worn" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-sm bg-worn" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="col-span-2 h-64 rounded-sm bg-worn" />
          <div className="h-64 rounded-sm bg-worn" />
        </div>
      </div>
    );
  }

  if (!hasData) {
    return <EmptyState />;
  }

  const today = new Date().toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-iron">
            Дашборд
          </h1>
          <p className="mt-0.5 text-sm text-ink" style={{ textTransform: "capitalize" }}>
            {today}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        {MOCK_METRICS.map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div>

      <WidgetGrid />
    </div>
  );
}
