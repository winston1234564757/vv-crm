"use client";

import { pluralUk } from "@/lib/utils/plural";

export function TodaySalesStatusLine({ todayTotal, target }: { todayTotal: number; target: number }) {
  const percent = Math.min(Math.round((todayTotal / target) * 100), 100);
  const remaining = Math.max(target - todayTotal, 0);

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Прогрес денного плану продажів</h3>
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
          className="h-full rounded-full bg-violet transition-all duration-1000 ease-out" 
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

export function SalesTargetRing({ todayTotal, target, progress }: { todayTotal: number; target: number; progress: number }) {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full md:w-[170px] bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-between shrink-0 shadow-sm">
      <div className="text-center">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Денний план</h3>
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

export function CrossSellWidget({ conversionRate, revenue, dealsCount }: { conversionRate: number; revenue: number; dealsCount: number }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Крос-продажі (30д)</h3>
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

export function SalesVelocityMatrix({ velocity, peakHours }: { velocity: { device: number; accessory: number; part: number; service: number }; peakHours: number[] }) {
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
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Аналітика доходів (30д)</h3>
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
