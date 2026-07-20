"use client";

import { pluralUk } from "@/lib/utils/plural";

export function TodaySalesStatusLine({ todayTotal, target }: { todayTotal: number; target: number }) {
  const percent = Math.min(Math.round((todayTotal / target) * 100), 100);
  const remaining = Math.max(target - todayTotal, 0);

  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-muted">Прогрес денного плану</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-display text-xl font-semibold text-ink tabular">{todayTotal.toLocaleString()} ₴</span>
            <span className="text-sm text-muted">з цілі {target.toLocaleString()} ₴</span>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-xs font-medium text-muted block">Залишилось до цілі</span>
          <span className="text-sm font-semibold text-ink tabular">
            {remaining > 0 ? `${remaining.toLocaleString()} ₴` : "Ціль досягнута"}
          </span>
        </div>
      </div>
      <div className="relative w-full bg-hover h-2.5 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all duration-1000 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-muted tabular">
        <span>0%</span>
        <span className="font-semibold text-accent-ink">{percent}% виконано</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export function SalesTargetRing({ todayTotal, target, progress }: { todayTotal: number; target: number; progress: number }) {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full md:w-[170px] card p-5 flex flex-col items-center justify-between shrink-0">
      <div className="text-center">
        <h3 className="text-sm font-medium text-muted">Денний план</h3>
        <span className="text-xs text-muted tabular mt-0.5 block">Ціль: {target.toLocaleString()} ₴</span>
      </div>
      <div className="relative flex items-center justify-center my-3">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle stroke="var(--color-border)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
          <circle stroke="var(--color-accent)" fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + " " + circumference} style={{ strokeDashoffset }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} className="transition-all duration-500" />
        </svg>
        <div className="absolute font-display text-sm font-semibold text-ink tabular">{progress}%</div>
      </div>
      <div className="text-center">
        <span className="text-xs text-muted block">Сплачено:</span>
        <span className="text-sm font-semibold text-accent-ink tabular">{todayTotal.toLocaleString()} ₴</span>
      </div>
    </div>
  );
}

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
