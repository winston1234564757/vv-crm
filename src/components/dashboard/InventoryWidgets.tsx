"use client";

import { cn } from "@/lib/utils/cn";

export function StockAlerts({ alerts, title = "Низький запас" }: { alerts: { item: string; stock: number; urgent: boolean }[]; title?: string }) {
  return (
    <div className="card p-5 flex flex-col">
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      <div className="mt-4 space-y-2 flex-1 flex flex-col justify-center">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Рівень запасів у нормі</p>
        ) : (
          alerts.map((a, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between rounded-[var(--radius-md)] px-3.5 py-2",
                a.urgent ? "bg-danger-subtle" : "bg-warning-subtle",
              )}
            >
              <span className="text-sm text-ink truncate max-w-[150px]">{a.item}</span>
              <span className={cn("text-xs font-semibold tabular", a.urgent ? "text-danger" : "text-warning")}>
                {a.stock === 0 ? "Немає" : `${a.stock} шт`}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
