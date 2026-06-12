export const dynamic = "force-dynamic";

import { getFinanceData, getFinanceReport, getUnreconciledSales } from "@/lib/data-finance";
import { AddTransferButton } from "./AddTransferButton";
import ReconciliationBench from "./ReconciliationBench";
import { getSettings } from "@/lib/data-settings";
import type { SafeDistribution } from "@/lib/data-settings";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

const typeColors: Record<string, string> = {
  sale: "var(--color-cyan)", expense: "var(--color-rose)", distribution: "var(--color-violet)",
};
const typeLabels: Record<string, string> = {
  sale: "Надходження", expense: "Витрата", distribution: "Розподіл",
};

export default async function FinancePage() {
  const { cashRegisters, safes, transactions } = await getFinanceData();
  const report = await getFinanceReport();
  const unreconciledSales = await getUnreconciledSales();
  const settings = await getSettings();


  const totalCash = cashRegisters.reduce((s, c) => s + c.balance, 0);
  const totalSafes = safes.reduce((s, c) => s + c.balance, 0);
  const todayTx = transactions.filter((t) => t.date === new Date().toISOString().split("T")[0]).length;

  const crColors: Record<string, string> = { tech: "var(--color-violet)", accessories: "var(--color-cyan)", repairs: "var(--color-amber)" };
  const sfColors: Record<string, string> = { opex: "var(--color-rose)", growth: "var(--color-violet)", net_profit: "var(--color-cyan)" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Фінанси</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Каси, сейфи та рух коштів</p>
        </div>
        <AddTransferButton cashRegisters={cashRegisters} safes={safes} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <GlassCard className="md:col-span-2">
          <p className="text-xs font-medium tracking-wider text-text-secondary">Всього в касах</p>
          <p className="mt-2 text-4xl font-light tracking-tight text-text-primary">{totalCash.toLocaleString()} грн</p>
          <p className="mt-1 text-xs text-text-secondary">очікує розподілу</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Всього в сейфах</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalSafes.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Транзакцій сьогодні</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">{todayTx}</p>
        </GlassCard>
      </div>

      {/* Profit/Loss */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Дохід (продажі)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">{report.totalSales.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Витрати</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-rose">{(report.totalPurchases + report.totalExpenses).toLocaleString()} грн</p>
          <p className="mt-1 text-xs text-text-secondary">закупівлі {report.totalPurchases.toLocaleString()} + витрати {report.totalExpenses.toLocaleString()}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Прибуток</p>
          <p className={`mt-2 text-3xl font-light tracking-tight ${report.profit >= 0 ? "text-emerald" : "text-rose"}`}>{report.profit.toLocaleString()} грн</p>
          <p className="mt-1 text-xs text-text-secondary">{report.profit >= 0 ? "✅ Позитивний" : "⚠️ Негативний"}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Маржа</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-violet">{report.totalSales > 0 ? Math.round((report.profit / report.totalSales) * 100) : 0}%</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {cashRegisters.map((cr) => (
          <GlassCard key={cr.id}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: crColors[cr.type] ?? "var(--color-iris)" }} />
              <p className="text-xs font-medium text-text-secondary">{cr.name}</p>
            </div>
            <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{cr.balance.toLocaleString()} грн</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {safes.map((s) => {
          const techSplit = settings.distribution_tech[s.type as keyof SafeDistribution] ?? 0;
          const accSplit = settings.distribution_accessories[s.type as keyof SafeDistribution] ?? 0;
          const repSplit = settings.distribution_repairs[s.type as keyof SafeDistribution] ?? 0;
          const avgTarget = Math.round((techSplit + accSplit + repSplit) / 3);

          return (
            <GlassCard key={s.id}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-text-secondary">{s.name}</p>
                <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[10px] font-medium text-violet">Сер. {avgTarget}%</span>
              </div>
              <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{s.balance.toLocaleString()} грн</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-iris/10">
                <div className="h-full rounded-full" style={{ width: `${avgTarget}%`, backgroundColor: sfColors[s.type] ?? "var(--color-iris)" }} />
              </div>
              <div className="mt-2.5 flex justify-between text-[10px] text-text-secondary">
                <span>Техніка: {techSplit}%</span>
                <span>Аксесуари: {accSplit}%</span>
                <span>Ремонти: {repSplit}%</span>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Expense Categories */}
      {report.categoryBreakdown.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <GlassCard>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Витрати за категоріями</h2>
            <div className="space-y-2">
              {report.categoryBreakdown.map((c) => (
                <div key={c.name} className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">{c.name}</span>
                  <span className="text-sm font-medium text-text-primary">{c.amount.toLocaleString()} грн</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        <ReconciliationBench initialSales={unreconciledSales} />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard>
          <h2 className="text-sm font-semibold text-text-primary">Рух коштів</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                  <th className="pb-2 pr-4">Дата</th>
                  <th className="pb-2 pr-4">Від</th>
                  <th className="pb-2 pr-4">До</th>
                  <th className="pb-2 pr-4">Тип</th>
                  <th className="pb-2 pr-4 max-w-[200px]">Опис</th>
                  <th className="pb-2 text-right">Сума</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02]">
                    <td className="py-3 pr-4 text-xs text-text-secondary whitespace-nowrap">{t.date}</td>
                    <td className="py-3 pr-4 text-text-secondary">{t.from}</td>
                    <td className="py-3 pr-4 font-medium">{t.to}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ background: `color-mix(in oklch, ${typeColors[t.type] ?? "var(--color-iris)"} 18%, transparent)`, color: typeColors[t.type] ?? "var(--color-iris)" }}>
                        {typeLabels[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-secondary text-xs max-w-[200px] truncate">{t.description}</td>
                    <td className="py-3 text-right font-medium whitespace-nowrap">{t.amount.toLocaleString()} грн</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-text-secondary">Немає транзакцій</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
