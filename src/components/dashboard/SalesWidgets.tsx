"use client";

import { pluralUk } from "@/lib/utils/plural";

/* Тут жили `TodaySalesStatusLine` і `SalesTargetRing` — два різні віджети
   денного плану, і жоден не рендерився. Прогрес до цілі показує
   `MoneyBreakdownCard` на дашборді, смугою. */

export function CrossSellWidget({ conversionRate, revenue, dealsCount }: { conversionRate: number; revenue: number; dealsCount: number }) {
  return (
    <div className="card p-5 flex flex-col justify-between">
      <h3 className="text-sm font-medium text-muted">Крос-продажі (30д)</h3>
      <div className="my-4 space-y-3">
        <div>
          <p className="text-xs text-muted">Конверсія допродажів</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-display text-2xl font-semibold text-info tabular">{conversionRate}%</span>
            <span className="text-xs text-muted">({dealsCount} {pluralUk(dealsCount, "угода", "угоди", "угод")})</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted">Додатковий дохід</p>
          <p className="text-lg font-semibold text-success tabular">+{revenue.toLocaleString()} ₴</p>
        </div>
      </div>
      <p className="text-xs text-faint border-t border-border pt-2">Аксесуари та супутні товари</p>
    </div>
  );
}

export function SalesVelocityMatrix({ velocity, peakHours }: { velocity: { device: number; accessory: number; part: number; service: number }; peakHours: number[] }) {
  const totals = Object.values(velocity);
  const maxVal = Math.max(...totals, 1);
  const categories = [
    { key: "device", label: "Пристрої", color: "var(--color-accent)" },
    { key: "accessory", label: "Аксесуари", color: "var(--color-info)" },
    { key: "part", label: "Запчастини", color: "var(--color-warning)" },
    { key: "service", label: "Послуги / Роботи", color: "var(--color-success)" },
  ];
  return (
    <div className="card p-5 flex flex-col justify-between">
      <h3 className="text-sm font-medium text-muted">Аналітика доходів (30д)</h3>
      <div className="my-3.5 space-y-2.5">
        {categories.map((c) => {
          const val = velocity[c.key as keyof typeof velocity] || 0;
          const percent = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
          return (
            <div key={c.key}>
              <div className="flex items-center justify-between text-xs text-ink mb-1">
                <span>{c.label}</span>
                <span className="tabular font-semibold">{val.toLocaleString()} ₴</span>
              </div>
              <div className="w-full bg-hover h-1.5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: c.color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border pt-2 text-xs text-muted flex items-center justify-between">
        <span>Пікові години:</span>
        <span className="font-semibold text-ink tabular">{peakHours.map((h) => `${h}:00`).join(", ")}</span>
      </div>
    </div>
  );
}
