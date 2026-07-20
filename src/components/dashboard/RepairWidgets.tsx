"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const POINT_COLORS = ["var(--color-accent)", "var(--color-warning)", "var(--color-info)", "var(--color-success)"];

export function SLASupplyChainMonitor({ repairs, delayRate, missingParts }: { repairs: any[], delayRate: number, missingParts: Array<{ name: string; quantity: number }> }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const statuses = ["received", "diagnostics", "in_progress", "ready"];
  const labels = ["Прийнято", "Діагностика", "В роботі", "Готово"];

  const counts = statuses.map((status) => repairs.filter((r) => r.status === status).length);
  const maxCount = Math.max(...counts, 2);

  const width = 500;
  const height = 110;
  const paddingX = 40;
  const paddingY = 15;

  const points = counts.map((count, idx) => {
    const x = paddingX + (idx * (width - paddingX * 2)) / (statuses.length - 1);
    const y = height - paddingY - (count / maxCount) * (height - paddingY * 2);
    return { x, y, count, label: labels[idx], color: POINT_COLORS[idx] };
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

  const delayed = delayRate > 25;

  return (
    <div className="flex-1 min-w-0 card p-5 relative overflow-hidden flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-medium text-muted">Монітор SLA та логістики</h3>
        {hoveredIdx !== null ? (
          <div className="text-xs tabular px-2 py-0.5 rounded-[var(--radius-sm)] bg-ink text-surface animate-entry">
            <span style={{ color: points[hoveredIdx].color }}>●</span> {points[hoveredIdx].label}:{" "}
            <span className="font-semibold">{points[hoveredIdx].count}</span>
          </div>
        ) : (
          <span className="text-xs text-faint">Наведіть на вершину</span>
        )}
      </div>

      <div className="relative mt-4 h-24 w-full flex items-center justify-center">
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {pathD && <path d={pathD} fill="none" stroke="var(--color-accent)" strokeWidth={3} strokeLinecap="round" />}
          {points.map((pt, idx) => (
            <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
              <circle cx={pt.x} cy={pt.y} r={hoveredIdx === idx ? 8 : 4} fill={pt.color} />
            </g>
          ))}
        </svg>
      </div>

      <div className="border-t border-border pt-3 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", delayed ? "bg-danger" : "bg-success")} />
          <span className="text-sm text-ink">
            Затримка логістики: <span className={cn("font-semibold tabular", delayed ? "text-danger" : "text-success")}>{delayRate}%</span>
          </span>
        </div>
        {missingParts.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted bg-hover rounded-[var(--radius-sm)] px-2 py-0.5 max-w-[220px] truncate">
            <span>Замовити:</span>
            <span className="font-semibold text-ink">{missingParts.map((p) => `${p.name} (${p.quantity}шт)`).join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
