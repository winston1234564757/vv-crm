"use client";

export function StockAlerts({ alerts, title = "Низький запас" }: { alerts: { item: string; stock: number; urgent: boolean }[]; title?: string }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-sm">
      <div>
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider tracking-tight">{title}</h3>
        <h4 className="text-sm font-bold text-slate-900 mt-0.5">Критичні залишки</h4>
      </div>
      <div className="mt-4 space-y-2.5 flex-1 justify-center flex flex-col">
        {alerts.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">Рівень запасів у нормі</p>
        ) : (
          alerts.map((a, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl px-3.5 py-2 border" style={{ background: a.urgent ? "rgba(244,63,94,0.06)" : "rgba(245,158,11,0.06)", borderColor: a.urgent ? "rgba(244,63,94,0.15)" : "rgba(245,158,11,0.15)" }}>
              <span className="text-xs text-slate-800 font-medium truncate max-w-[150px]">{a.item}</span>
              <span className="text-[11px] font-mono font-bold" style={{ color: a.urgent ? "#F43F5E" : "#F59E0B" }}>{a.stock === 0 ? "Немає" : `${a.stock} шт`}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
