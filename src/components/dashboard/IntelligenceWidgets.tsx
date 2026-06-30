"use client";

import { IconWarning, IconSearch, IconDevice, IconCustomer, IconFinance, IconBox } from "@/components/icons";
import { 
  DOW_UA, 
  URGENCY_CONFIG, 
  ModelAnalyticsItem, 
  StockoutItem, 
  HeatmapRow, 
  SmartInsight 
} from "./widget-types";

export function PhoneModelDemandWidget({ models }: { models: ModelAnalyticsItem[] }) {
  const maxScore = Math.max(...models.map((m) => m.demand_score), 1);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div className="mb-4">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Розподіл попиту</h3>
        <div className="flex items-center justify-between mt-0.5">
          <h4 className="text-sm font-bold text-slate-900">Топ моделей для ремонту</h4>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">90 днів</span>
        </div>
      </div>
      <div className="space-y-3.5 flex-1">
        {models.map((m, i) => {
          const percent = Math.round((m.demand_score / maxScore) * 100);
          return (
            <div key={i} className="group cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-800">
                  {m.brand} {m.model}
                </span>
                <span className="text-[10px] font-mono font-medium text-slate-500">{m.repair_count} рем.</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 bg-slate-800" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-[9px] font-mono font-bold w-12 text-right" style={{ color: percent > 80 ? "#10B981" : percent > 50 ? "#06B6D4" : "#64748B" }}>
                  {m.demand_score.toFixed(1)}/10
                </span>
              </div>
              {/* Detailed tooltip-like expanded view on hover for BI */}
              <div className="hidden group-hover:flex items-center gap-3 mt-1.5 p-1.5 bg-slate-50 rounded text-[9px] font-mono text-slate-500 animate-entry">
                <span>Рентаб: <span className="text-slate-800 font-bold">{m.avg_margin}%</span></span>
                <span>Оборотність: <span className="text-slate-800 font-bold">{m.avg_days_to_sell}д</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RevenueHeatmapWidget({ heatmap }: { heatmap: HeatmapRow[] }) {
  // Simple matrix 7x24
  const matrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  let maxRev = 1;

  heatmap.forEach((r) => {
    matrix[r.dow][r.hour_of_day] = r.total_revenue;
    if (r.total_revenue > maxRev) maxRev = r.total_revenue;
  });

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm overflow-hidden col-span-1 md:col-span-2">
      <div className="mb-4">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Теплова карта доходу</h3>
        <div className="flex items-center justify-between mt-0.5">
          <h4 className="text-sm font-bold text-slate-900">Години максимального навантаження</h4>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
            <span>Мін</span>
            <div className="w-16 h-1.5 rounded-full bg-gradient-to-r from-slate-100 to-[#6366F1]" />
            <span>Макс</span>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Header (hours) */}
          <div className="flex ml-6 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="flex-1 text-center text-[8px] font-mono text-slate-400">
                {h % 2 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {/* Grid */}
          <div className="space-y-0.5 flex flex-col">
            {DOW_UA.map((dow, d) => (
              <div key={d} className="flex items-center gap-1">
                <span className="w-5 text-[9px] font-medium text-slate-500 text-right shrink-0">{dow}</span>
                <div className="flex flex-1 gap-0.5">
                  {Array.from({ length: 24 }).map((_, h) => {
                    const val = matrix[d][h];
                    const intensity = val / maxRev;
                    // Custom color mapping: 0 -> slate-100, 1 -> indigo-500 (#6366F1)
                    return (
                      <div 
                        key={h} 
                        className="flex-1 aspect-square rounded-[2px] transition-all hover:ring-1 hover:ring-slate-900 cursor-pointer relative group"
                        style={{ 
                          backgroundColor: val === 0 ? "#F1F5F9" : `rgba(99, 102, 241, ${Math.max(0.15, intensity)})`
                        }}
                      >
                        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded whitespace-nowrap z-10 animate-entry">
                          {dow}, {h}:00 - <span className="font-bold text-[#A855F7]">{val.toLocaleString()} ₴</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StockoutIntelligenceWidget({ items }: { items: StockoutItem[] }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col shadow-sm max-h-[350px] overflow-hidden">
      <div className="mb-4 shrink-0">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Прогноз вичерпання</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">Stockout Alerts</h4>
      </div>
      <div className="overflow-y-auto pr-2 space-y-2 flex-1 custom-scrollbar">
        {items.map((item) => {
          const conf = URGENCY_CONFIG[item.restock_urgency] || URGENCY_CONFIG.OK;
          return (
            <div key={item.item_id} className="p-3 border rounded-xl flex flex-col gap-2 transition-all hover:bg-slate-50" style={{ borderColor: conf.border }}>
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="text-[11px] font-bold text-slate-900 leading-tight pr-2">{item.item_name}</h5>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">Сток: <span className="font-bold text-slate-700">{item.current_stock}</span> | Попит: {item.avg_daily_demand}/д</p>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase font-mono shrink-0" style={{ backgroundColor: conf.bg, color: conf.color }}>
                  {conf.label}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Закінчиться через:</span>
                <span className="text-xs font-mono font-extrabold" style={{ color: conf.color }}>
                  {item.days_until_stockout === 0 ? "СЬОГОДНІ" : `${item.days_until_stockout} дн.`}
                </span>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <IconBox className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs font-medium">Ризиків стокауту немає</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AIInsightPanel({
  insights
}: {
  insights: SmartInsight[];
}) {
  const getIcon = (type: string) => {
    switch (type) {
      case "opportunity": return <IconFinance className="w-4 h-4 text-[#10B981]" />;
      case "warning": return <IconWarning className="w-4 h-4 text-[#F59E0B]" />;
      case "achievement": return <IconCustomer className="w-4 h-4 text-[#A855F7]" />;
      default: return <IconSearch className="w-4 h-4 text-[#6366F1]" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case "opportunity": return "bg-[#10B981]/5 border-[#10B981]/20";
      case "warning": return "bg-[#F59E0B]/5 border-[#F59E0B]/20";
      case "achievement": return "bg-[#A855F7]/5 border-[#A855F7]/20";
      default: return "bg-[#6366F1]/5 border-[#6366F1]/20";
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 shadow-lg col-span-1 md:col-span-2 lg:col-span-3 text-white overflow-hidden relative">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#6366F1] rounded-full blur-[80px] opacity-20 pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#06B6D4] rounded-full blur-[80px] opacity-20 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
            <svg className="w-4 h-4 text-[#06B6D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Gemini AI Аналітика</h3>
            <p className="text-[10px] text-slate-400 font-mono">Автоматичні інсайти на основі даних</p>
          </div>
        </div>

        {insights.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-slate-400 border border-white/5 rounded-xl bg-white/5">
            <span className="animate-pulse">Аналізую поточні дані...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border backdrop-blur-sm flex flex-col justify-between group transition-all hover:-translate-y-1 hover:shadow-lg ${getBg(insight.type)}`}
              >
                <div>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="p-1.5 bg-white rounded-md shadow-sm shrink-0">
                      {getIcon(insight.type)}
                    </div>
                    <h4 className="text-[13px] font-bold text-white leading-tight pt-0.5">{insight.title}</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3">{insight.description}</p>
                </div>
                {insight.action && (
                  <div className="mt-auto pt-3 border-t border-white/10">
                    <button className="text-[10px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1 group-hover:text-[#06B6D4] transition-colors">
                      {insight.action} <span className="text-lg leading-none">&rarr;</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-white/10 pt-2 mt-4 flex items-center justify-between text-[9px] text-slate-500 font-mono">
          <span>Оновлено щойно</span>
          <span className="text-[#06B6D4] font-medium">VV Intelligence Engine v2.0</span>
        </div>
      </div>
    </div>
  );
}
