export const dynamic = "force-dynamic";

import { getParts, getPartsAlerts, getPartsUsage } from "@/lib/data-parts";
import { getSuppliers } from "@/lib/data-suppliers";
import { getSafes } from "@/lib/data-finance";
import { createClient } from "@/lib/supabase/server";
import { PartsTable } from "./table";
import { AddPartButton } from "./AddPartButton";
import { pluralUk } from "@/lib/utils/plural";

import GlassCard from "@/components/GlassCard";

export default async function PartsPage() {
  const supabase = await createClient();

  const [parts, alerts, suppliers, usage, { data: stockoutForecast }, safes] = await Promise.all([
    getParts(),
    getPartsAlerts(),
    getSuppliers(),
    getPartsUsage(),
    supabase.rpc("get_inventory_stockout_forecast"),
    getSafes(),
  ]);

  const totalParts = parts.length;
  const totalValue = parts.reduce((s, p) => s + p.cost_price * p.stock, 0);
  const lowCount = alerts.length;

  const shortageItems = (stockoutForecast || [])
    .filter(f => f.days_until_stockout < 45)
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Запчастини</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{totalParts} {pluralUk(totalParts, "деталь", "деталі", "деталей")}</p>
        </div>
        <AddPartButton suppliers={suppliers} safes={safes} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Всього позицій</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalParts}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сума запасів (собівартість)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalValue.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Закінчуються</p>
          <p className={`mt-2 text-3xl font-light tracking-tight ${lowCount > 0 ? "text-rose" : "text-cyan"}`}>{lowCount}</p>
        </GlassCard>
      </div>

      {/* AI Smart Forecast Card */}
      {shortageItems.length > 0 && (
        <GlassCard className="border border-violet/20 bg-violet/[0.01]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-violet font-semibold text-sm">✨ ШІ Прогноз Дефіциту та Залишків</span>
            <span className="text-[10px] text-text-secondary bg-violet/5 px-2 py-0.5 rounded-full">Аналітика за останні 30 днів</span>
          </div>
          <p className="text-xs text-text-secondary mb-4 leading-relaxed">
            Штучний інтелект проаналізував частоту використання запчастин та аксесуарів у виконаних ремонтах та продажах. 
            Ось позиції, які можуть вичерпатися найближчим часом:
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {shortageItems.map((item) => {
              const days = Number(item.days_until_stockout);
              const isCritical = item.restock_urgency === "CRITICAL" || days < 7;
              return (
                <div 
                  key={item.item_id} 
                  className={`p-3.5 rounded-xl border relative overflow-hidden flex flex-col justify-between min-h-[110px] transition-all duration-200 hover:-translate-y-0.5 ${
                    isCritical 
                      ? "bg-rose/[0.02] border-rose/30 hover:border-rose/50" 
                      : "bg-amber/[0.02] border-amber/30 hover:border-amber/50"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-semibold text-xs text-text-primary line-clamp-1">{item.item_name}</span>
                      <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded leading-none ${
                        isCritical ? "bg-rose/10 text-rose" : "bg-amber/10 text-amber"
                      }`}>
                        {item.item_type === "part" ? "запчастина" : "аксесуар"}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-secondary mt-1 font-mono">
                      Поточний запас: <span className="font-bold text-text-primary">{item.current_stock} шт.</span>
                    </p>
                  </div>
                  <div className="mt-3 border-t border-warm-border/50 pt-2 flex justify-between items-end">
                    <div>
                      <span className="text-[9px] text-text-secondary block">Вистачить орієнтовно на:</span>
                      <span className={`text-sm font-bold font-mono ${isCritical ? "text-rose" : "text-amber"}`}>
                        {days === 0 ? "Сьогодні" : `${days} ${pluralUk(days, "день", "дні", "днів")}`}
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-text-muted">
                      Попит: {item.avg_daily_demand}/день
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <PartsTable parts={parts} suppliers={suppliers} usage={usage} />
      </GlassCard>
    </div>
  );
}
