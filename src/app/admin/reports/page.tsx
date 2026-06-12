export const dynamic = "force-dynamic";

import { getReportsData } from "@/lib/data-reports";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

export default async function ReportsPage() {
  const data = await getReportsData();
  const maxRevenue = Math.max(...data.monthlyRevenue, 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Звіти</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Аналітика за останні місяці</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="md:col-span-2">
          <GlassCard>
            <h2 className="text-sm font-semibold text-text-primary">Виручка</h2>
            <p className="mt-2 text-4xl font-light tracking-tight text-text-primary">{data.totalRevenue.toLocaleString()} грн</p>
            <p className="mt-1 text-xs text-text-secondary">за весь період</p>
          </GlassCard>
        </div>
        <GlassCard>
          <h2 className="text-sm font-semibold text-text-primary">Середній чек</h2>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{data.avgCheck.toLocaleString()} грн</p>
          <p className="mt-1 text-xs text-text-secondary">{data.transactionCount} транзакцій</p>
        </GlassCard>
        <GlassCard>
          <h2 className="text-sm font-semibold text-text-primary">Маржа</h2>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">22%</p>
          <p className="mt-1 text-xs text-text-secondary">валова рентабельність</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <GlassCard className="md:col-span-3">
          <h2 className="text-sm font-semibold text-text-primary">Динаміка виручки</h2>
          <div className="mt-4 flex items-end justify-between gap-2">
            {data.monthlyRevenue.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[0.625rem] font-medium text-text-secondary">{(v / 1000).toFixed(0)}k</span>
                <div className="w-full origin-bottom transition-transform duration-500 rounded-md" style={{ height: "140px", backgroundColor: "var(--color-violet)", transform: `scaleY(${v / maxRevenue})` }} />
                <span className="text-[0.625rem] text-text-secondary">{data.months[i]}</span>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard>
          <h2 className="text-sm font-semibold text-text-primary">За категоріями</h2>
          {data.categories.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary">Немає даних</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.categories.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs text-text-primary mb-1">
                    <span>{c.name}</span>
                    <span className="font-medium">{(c.amount / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-iris/10">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard>
          <h2 className="text-sm font-semibold text-text-primary">Топ продажів</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                  <th className="pb-2 pr-4">Товар</th>
                  <th className="pb-2 pr-4 text-right">Продано</th>
                  <th className="pb-2 text-right">Виручка</th>
                </tr>
              </thead>
              <tbody>
                {data.topSellers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-sm text-text-secondary">Немає даних</td>
                  </tr>
                ) : (
                  data.topSellers.map((s, i) => (
                    <tr key={i} className="border-b border-iris/5 text-text-primary">
                      <td className="py-3 pr-4 font-medium">{s.name}</td>
                      <td className="py-3 pr-4 text-right">{s.sold}</td>
                      <td className="py-3 text-right font-medium">{s.revenue.toLocaleString()} грн</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
