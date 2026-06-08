"use client";

import { useState } from "react";

const WEEKLY_SALES = [12400, 18900, 15200, 22100, 18450, 25800, 20100];
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const MAX_SALE = Math.max(...WEEKLY_SALES);

const SALES = [
  { item: "iPhone 15 Pro 256GB", customer: "Олена К.", amount: 38500, time: "14:32" },
  { item: "Samsung Galaxy S24", customer: "Максим Р.", amount: 29900, time: "13:15" },
  { item: "AirPods Pro", customer: "Анна В.", amount: 8500, time: "12:00" },
  { item: "MacBook Air M3", customer: "Дмитро С.", amount: 52000, time: "10:45" },
];

const REPAIRS = [
  { device: "iPhone 13 — дисплей", customer: "Андрій М.", status: "Готовий", color: "oklch(55% 0.2 145)" },
  { device: "Samsung A54 — екран", customer: "Наталія К.", status: "В роботі", color: "var(--color-amber)" },
  { device: "Xiaomi Redmi — зарядка", customer: "Петро В.", status: "Діагностика", color: "var(--color-iris)" },
  { device: "iPad 9 — батарея", customer: "Юлія С.", status: "В роботі", color: "var(--color-amber)" },
];

const ALERTS = [
  { item: "iPhone 15 Pro Max 256GB", stock: 1, urgent: false },
  { item: "Захисні скла iPhone 15", stock: 2, urgent: false },
  { item: "USB-C зарядки 20W", stock: 0, urgent: true },
];

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`glass rounded-2xl p-5 ${className ?? ""}`}>{children}</div>;
}

function MetricCard({ label, value, delta, up, accent }: { label: string; value: string; delta: string; up: boolean; accent: string }) {
  return (
    <GlassCard>
      <p className="text-xs font-medium tracking-wider text-iris">{label}</p>
      <p className="mt-1 text-3xl font-light tracking-tight text-indigo">{value}</p>
      <p className="mt-1 text-xs font-medium" style={{ color: accent }}>
        {up ? "↑ " : "↓ "}{delta}
      </p>
    </GlassCard>
  );
}

function SalesChart() {
  return (
    <GlassCard className="md:col-span-3">
      <h2 className="text-sm font-semibold text-indigo">Продажі за тиждень</h2>
      <div className="mt-4 flex items-end justify-between gap-2">
        {WEEKLY_SALES.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[0.625rem] font-medium text-iris">{(v / 1000).toFixed(1)}k</span>
            <div
              className="w-full rounded-md transition-all duration-500"
              style={{
                height: `${(v / MAX_SALE) * 140}px`,
                background: `linear-gradient(to top, var(--color-violet), var(--color-cyan))`,
              }}
            />
            <span className="text-[0.625rem] text-iris">{DAYS[i]}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function RepairStatus() {
  return (
    <GlassCard>
      <h2 className="text-sm font-semibold text-indigo">Статуси ремонтів</h2>
      <div className="mt-3 space-y-2.5">
        {REPAIRS.map((r, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="truncate text-sm text-indigo">{r.device}</span>
            <span className="shrink-0 rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in oklch, ${r.color} 18%, transparent)`, color: r.color }}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function StockAlerts() {
  return (
    <GlassCard>
      <h2 className="text-sm font-semibold text-indigo">Низький запас</h2>
      <div className="mt-3 space-y-2">
        {ALERTS.map((a, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl px-3.5 py-2" style={{ background: a.urgent ? "oklch(55% 0.2 10 / 0.08)" : "oklch(70% 0.18 80 / 0.08)" }}>
            <span className="text-sm text-indigo">{a.item}</span>
            <span className="text-xs font-semibold" style={{ color: a.urgent ? "var(--color-rose)" : "var(--color-amber)" }}>
              {a.stock === 0 ? "Немає" : `${a.stock} шт`}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function RecentSales() {
  return (
    <GlassCard>
      <h2 className="text-sm font-semibold text-indigo">Останні продажі</h2>
      <div className="mt-3 divide-y divide-iris/10">
        {SALES.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-indigo">{s.item}</p>
              <p className="text-xs text-iris">{s.customer} • {s.time}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-violet">{s.amount.toLocaleString()} грн</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function RecentRepairs() {
  return (
    <GlassCard>
      <h2 className="text-sm font-semibold text-indigo">Активні ремонти</h2>
      <div className="mt-3 space-y-2">
        {REPAIRS.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-violet/[0.03] px-3.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-indigo">{r.device}</p>
              <p className="text-xs text-iris">{r.customer}</p>
            </div>
            <span className="shrink-0 text-xs font-medium" style={{ color: r.color }}>{r.status}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <GlassCard className="max-w-sm text-center">
        <p className="text-4xl text-violet">◆</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-indigo">Ласкаво просимо до VV CRM</h1>
        <p className="mt-2 text-sm text-iris">Додайте перший товар або створіть ремонт, і ваша майстерня оживе на цьому дашборді.</p>
      </GlassCard>
    </div>
  );
}

export default function AdminDashboard() {
  const [error] = useState<string | null>(null);

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <GlassCard className="max-w-sm text-center">
          <p className="text-3xl text-rose">!</p>
          <h2 className="mt-3 text-lg font-semibold text-indigo">Помилка завантаження</h2>
          <p className="mt-1 text-sm text-iris">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-violet px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-deep">
            Спробувати знову
          </button>
        </GlassCard>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-indigo">Дашборд</h1>
          <p className="mt-0.5 text-sm text-iris" style={{ textTransform: "capitalize" }}>{today}</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl bg-violet px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-deep">+ Новий продаж</button>
          <button className="rounded-xl border border-violet/20 px-5 py-2.5 text-sm font-medium text-violet transition-colors hover:bg-violet/5">+ Ремонт</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="md:col-span-2 md:row-span-1">
          <GlassCard className="h-full">
            <p className="text-xs font-medium tracking-wider text-iris">Продажі сьогодні</p>
            <p className="mt-2 text-4xl font-light tracking-tight text-indigo">18 450 грн</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-xs font-medium text-cyan">↑ 12%</span>
              <span className="text-xs text-iris">в порівнянні з вчора</span>
            </div>
          </GlassCard>
        </div>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-iris">Активні ремонти</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-indigo">7</p>
          <p className="mt-1 text-xs text-amber">2 очікують деталі</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-iris">Нові клієнти</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-indigo">4</p>
          <p className="mt-1 text-xs text-cyan">+2 за сьогодні</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SalesChart />
        <GlassCard>
          <h2 className="text-sm font-semibold text-indigo">Швидкі дії</h2>
          <div className="mt-3 space-y-2">
            <button className="w-full rounded-xl bg-violet/5 px-4 py-3 text-left text-sm font-medium text-violet transition-colors hover:bg-violet/10">
              + Додати товар
            </button>
            <button className="w-full rounded-xl bg-cyan/5 px-4 py-3 text-left text-sm font-medium text-cyan transition-colors hover:bg-cyan/10">
              + Новий ремонт
            </button>
            <button className="w-full rounded-xl bg-amber/5 px-4 py-3 text-left text-sm font-medium text-amber transition-colors hover:bg-amber/10">
              ⚡ Знайти клієнта
            </button>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <RepairStatus />
        <StockAlerts />
        <RecentSales />
      </div>

      <RecentRepairs />
    </div>
  );
}
