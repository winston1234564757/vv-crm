"use client";

import { useState } from "react";

export function SLASupplyChainMonitor({ repairs, delayRate, missingParts }: { repairs: any[], delayRate: number, missingParts: Array<{ name: string; quantity: number }> }) {
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
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">Монітор SLA та логістики</h3>
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
