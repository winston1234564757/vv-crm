"use client";

import { IconBox } from "@/components/icons";
import { Meter } from "@/components/charts/Meter";
import { DOW_UA, URGENCY_CONFIG, ModelAnalyticsItem, StockoutItem, HeatmapRow } from "./widget-types";

export function PhoneModelDemandWidget({ models }: { models: ModelAnalyticsItem[] }) {
  const maxScore = Math.max(...models.map((m) => m.demand_score), 1);

  return (
    <div className="card p-5 flex flex-col justify-between">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted">Топ моделей для ремонту</h3>
        <span className="text-xs bg-hover text-muted px-2 py-0.5 rounded-[var(--radius-sm)]">90 днів</span>
      </div>
      <div className="space-y-3.5 flex-1">
        {models.map((m, i) => {
          const percent = Math.round((m.demand_score / maxScore) * 100);
          const scoreTone = percent > 80 ? "text-success" : percent > 50 ? "text-info" : "text-muted";
          return (
            <div key={i} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-ink">{m.brand} {m.model}</span>
                <span className="text-xs tabular text-muted">{m.repair_count} рем.</span>
              </div>
              <div className="flex items-center gap-2">
                <Meter value={percent} className="flex-1" />
                <span className={`text-xs tabular font-semibold w-12 text-right ${scoreTone}`}>{m.demand_score.toFixed(1)}/10</span>
              </div>
              <div className="hidden group-hover:flex items-center gap-3 mt-1.5 p-1.5 bg-hover rounded-[var(--radius-sm)] text-xs tabular text-muted animate-entry">
                <span>Рентаб: <span className="text-ink font-semibold">{m.avg_margin}%</span></span>
                <span>Оборотність: <span className="text-ink font-semibold">{m.avg_days_to_sell}д</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RevenueHeatmapWidget({ heatmap }: { heatmap: HeatmapRow[] }) {
  const matrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  let maxRev = 1;

  heatmap.forEach((r) => {
    matrix[r.dow][r.hour_of_day] = r.total_revenue;
    if (r.total_revenue > maxRev) maxRev = r.total_revenue;
  });

  return (
    <div className="card p-5 flex flex-col justify-between overflow-hidden col-span-1 md:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted">Години максимального навантаження</h3>
        <div className="flex items-center gap-1.5 text-xs text-faint">
          <span>Мін</span>
          <div className="w-16 h-1.5 rounded-full bg-gradient-to-r from-hover to-accent" />
          <span>Макс</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="flex ml-6 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="flex-1 text-center text-[8px] tabular text-faint">
                {h % 2 === 0 ? h : ""}
              </div>
            ))}
          </div>
          <div className="space-y-0.5 flex flex-col">
            {DOW_UA.map((dow, d) => (
              <div key={d} className="flex items-center gap-1">
                <span className="w-5 text-xs font-medium text-muted text-right shrink-0">{dow}</span>
                <div className="flex flex-1 gap-0.5">
                  {Array.from({ length: 24 }).map((_, h) => {
                    const val = matrix[d][h];
                    const intensity = val / maxRev;
                    return (
                      <div
                        key={h}
                        className="flex-1 aspect-square rounded-[2px] transition-all hover:ring-1 hover:ring-ink cursor-pointer relative group"
                        style={{
                          backgroundColor: val === 0
                            ? "var(--color-hover)"
                            : `color-mix(in oklch, var(--color-accent) ${Math.max(15, Math.round(intensity * 100))}%, transparent)`,
                        }}
                      >
                        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-ink text-surface text-xs tabular px-2 py-1 rounded-[var(--radius-sm)] whitespace-nowrap z-10 animate-entry">
                          {dow}, {h}:00 — <span className="font-semibold">{val.toLocaleString()} ₴</span>
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
    <div className="card p-5 flex flex-col max-h-[350px] overflow-hidden">
      <h3 className="text-sm font-medium text-muted mb-4 shrink-0">Прогноз вичерпання запасів</h3>
      <div className="overflow-y-auto pr-2 space-y-2 flex-1">
        {items.map((item) => {
          const conf = URGENCY_CONFIG[item.restock_urgency] || URGENCY_CONFIG.OK;
          return (
            <div key={item.item_id} className="p-3 rounded-[var(--radius-md)] flex flex-col gap-2 transition-colors hover:bg-hover" style={{ backgroundColor: conf.bg }}>
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-ink leading-tight pr-2">{item.item_name}</h5>
                  <p className="text-xs text-muted tabular mt-0.5">Сток: <span className="font-semibold text-ink">{item.current_stock}</span> · Попит: {item.avg_daily_demand}/д</p>
                </div>
                <span className="px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[10px] font-semibold tracking-wide uppercase shrink-0" style={{ color: conf.color }}>
                  {conf.label}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 mt-0.5">
                <span className="text-xs text-muted">Закінчиться через:</span>
                <span className="text-xs tabular font-semibold" style={{ color: conf.color }}>
                  {item.days_until_stockout === 0 ? "СЬОГОДНІ" : `${item.days_until_stockout} дн.`}
                </span>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-faint">
            <IconBox className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-medium">Ризиків стокауту немає</p>
          </div>
        )}
      </div>
    </div>
  );
}
