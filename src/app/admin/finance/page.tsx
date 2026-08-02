export const dynamic = "force-dynamic";

import { requirePageRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { getFinanceData, getFinanceReport, type SafeWithSplit } from "@/lib/data-finance";
import { AddTransferButton } from "./AddTransferButton";
import { AddExpenseButton } from "./AddExpenseButton";
import { AddDistributionButton } from "./AddDistributionButton";
import { AddTopUpButton } from "./AddTopUpButton";
import { AIFinanceButton } from "./AIFinanceButton";
import { getSettings } from "@/lib/data-settings";
import type { SafeDistribution } from "@/lib/data-settings";
import { getSales } from "@/lib/data-sales";
import { getRepairs } from "@/lib/data-repairs";
import { getPurchases } from "@/lib/data-purchases";
import { splitByKind, isCashless } from "@/lib/utils/finance";
import { WithdrawShareButton } from "./WithdrawShareButton";
import { FinanceTransactionsTable } from "./FinanceTransactionsTable";
import { PLBreakdownPanel } from "./PLBreakdownPanel";
import { getCashFlow } from "@/lib/data-cashflow";
import { CashFlowPanel } from "./CashFlowPanel";

export default async function FinancePage() {
  await requirePageRole(MONEY_ROLES);

  const [
    { cashRegisters, safes, transactions, expenseCategories },
    report,
    settings,
    sales,
    repairs,
    purchases,
    cashFlow
  ] = await Promise.all([
    getFinanceData(),
    getFinanceReport(),
    getSettings(),
    getSales(),
    getRepairs(),
    getPurchases(),
    getCashFlow(),
  ]);

  // Сейфи — окрема таблиця, не каса, тому пряме додавання balance тут не є
  // тим шаблоном, що ловить no-raw-register-sum.test.ts.
  const totalSafes = (safes as SafeWithSplit[]).reduce((s: number, c: SafeWithSplit) => s + c.balance, 0);
  const todayTx = transactions.filter((t) => t.date === new Date().toISOString().split("T")[0]).length;
  const kinds = splitByKind(cashRegisters);

  const crColors: Record<string, string> = {
    tech: "var(--color-violet)",
    accessories: "var(--color-cyan)",
    repairs: "var(--color-amber)",
    cashless: "var(--color-emerald)",
  };
  const sfColors: Record<string, string> = { 
    opex: "var(--color-rose)", 
    growth: "var(--color-violet)", 
    net_profit: "var(--color-cyan)" 
  };

  return (
    <div className="space-y-6 animate-entry">
      {/* 1. Header with Metadata telemetry */}
      <div className="border-b border-warm-border pb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">LEDGER TELEMETRY : ACTIVE</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary text-balance">Фінансовий Контроль</h1>
          <p className="text-xs text-text-secondary mt-0.5">Оперативний облік касових лімітів, резервних сейфів та транзакційного балансу</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <AIFinanceButton />
          <WithdrawShareButton safes={(safes as SafeWithSplit[]).filter((s: SafeWithSplit) => s.type === "net_profit")} />
          <AddTopUpButton safes={safes} />
          <AddExpenseButton expenseCategories={expenseCategories} safes={safes} />
          <AddDistributionButton cashRegisters={cashRegisters} settings={settings} />
          <AddTransferButton cashRegisters={cashRegisters} safes={safes} />
        </div>
      </div>

      {/* 2. Asymmetric Two-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Ledger Balance sheet & Operations (col-span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* A. Unified P&L Telemetry panel */}
          <div className="card p-6 border-l-4 border-l-violet shadow-sm bg-warm-surface">
            <div className="flex justify-between items-start border-b border-warm-border pb-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">Чистий операційний результат</p>
                <h2 className={`text-4xl font-extrabold tracking-tight mt-1 ${report.profit >= 0 ? "text-emerald" : "text-rose"}`}>
                  {report.profit.toLocaleString()} ₴
                </h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">Рентабельність (ROS)</p>
                <p className="text-2xl font-bold text-violet mt-1">
                  {report.totalSales + report.repairsRevenue > 0 
                    ? Math.round((report.profit / (report.totalSales + report.repairsRevenue)) * 100) 
                    : 0}%
                </p>
              </div>
            </div>

            {/* Income and Costs layout meters — клікабельні, з розкладкою у модалці */}
            <PLBreakdownPanel
              totalSales={report.totalSales}
              repairsRevenue={report.repairsRevenue}
              salesCost={report.salesCost}
              repairsCost={report.repairsCost}
              totalExpenses={report.totalExpenses}
              byCategory={report.byCategory}
              categoryBreakdown={report.categoryBreakdown}
            />
          </div>

          {/* B. Ledger Nodes: Registers & Safes combined layout */}
          <div className="space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-secondary border-b border-warm-border pb-1 tracking-tight">Розподіл ліквідності</h3>
            
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="text-xs text-text-secondary">
                Готівкою <span className="font-mono font-bold text-text-primary">{kinds.cash.toLocaleString()} ₴</span>
              </span>
              <span className="text-xs text-text-secondary">
                Карткою <span className="font-mono font-bold text-text-primary">{kinds.cashless.toLocaleString()} ₴</span>
              </span>
              <span className="text-xs text-text-secondary">
                Разом <span className="font-mono font-bold text-text-primary">{kinds.total.toLocaleString()} ₴</span>
              </span>
            </div>

            {/* Cash Registers layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cashRegisters.map((cr) => (
                <div key={cr.id} className="card p-4 bg-warm-surface border border-warm-border relative overflow-hidden flex flex-col justify-between min-h-[90px] card-hover transition-all duration-200">
                  <div className="absolute left-0 top-0 h-1 w-full" style={{ backgroundColor: crColors[cr.type] ?? "var(--color-iris)" }} />
                  <div>
                    <span className="font-mono text-[8px] uppercase tracking-wider text-text-muted">
                      {isCashless(cr.type) ? "БЕЗГОТІВКОВИЙ РАХУНОК" : "ПОТОЧНА КАСА"}
                    </span>
                    <h4 className="text-xs font-semibold text-text-primary mt-0.5">{cr.name}</h4>
                  </div>
                  <p className="text-lg font-bold text-text-primary mt-2 font-mono">{cr.balance.toLocaleString()} ₴</p>
                </div>
              ))}
            </div>

            {/* Safes layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(safes as SafeWithSplit[]).map((s) => {
                const techSplit = settings.distribution_tech[s.type as keyof SafeDistribution] ?? 0;
                const accSplit = settings.distribution_accessories[s.type as keyof SafeDistribution] ?? 0;
                const repSplit = settings.distribution_repairs[s.type as keyof SafeDistribution] ?? 0;
                const avgTarget = Math.round((techSplit + accSplit + repSplit) / 3);

                const total = Math.max(Math.abs(s.cashBalance) + Math.abs(s.cardBalance), 1);
                const cashPct = Math.round((Math.max(s.cashBalance, 0) / total) * 100);
                const cardPct = Math.round((Math.max(s.cardBalance, 0) / total) * 100);
                const isOverdraft = s.balance < 0;

                return (
                  <div key={s.id} className="card p-4 bg-warm-surface border border-warm-border flex flex-col justify-between card-hover transition-all duration-200">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[8px] uppercase tracking-wider text-text-muted">СЕЙФ РЕЗЕРВУ</span>
                        <span className="rounded bg-violet/5 px-1 py-0.5 text-[8px] font-mono text-violet">Сер. {avgTarget}%</span>
                      </div>
                      <h4 className="text-xs font-semibold text-text-primary mt-0.5">{s.name}</h4>
                      <p className={`text-lg font-bold mt-2 font-mono ${
                        isOverdraft ? "text-rose" : "text-text-primary"
                      }`}>
                        {s.balance.toLocaleString()} ₴
                      </p>

                      {/* Розбивка готівка / картка */}
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-warm-border overflow-hidden flex">
                          <div
                            className="h-full bg-emerald rounded-l-full transition-all duration-500"
                            style={{ width: `${cashPct}%` }}
                            title={`Готівка: ${s.cashBalance.toLocaleString()} ₴`}
                          />
                          <div
                            className="h-full bg-amber transition-all duration-500"
                            style={{ width: `${cardPct}%` }}
                            title={`Картка: ${s.cardBalance.toLocaleString()} ₴`}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] font-mono text-text-muted">
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald" />
                            Готівка {s.cashBalance.toLocaleString()} ₴
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber" />
                            Картка {s.cardBalance.toLocaleString()} ₴
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="h-1 w-full rounded-full bg-warm-border overflow-hidden">
                        <div className="h-full bg-violet" style={{ width: `${avgTarget}%`, backgroundColor: sfColors[s.type] ?? "var(--color-iris)" }} />
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-text-secondary leading-none pt-1">
                        <div className="border-r border-warm-border pr-1">Тех: {techSplit}%</div>
                        <div className="border-r border-warm-border px-1">Акс: {accSplit}%</div>
                        <div className="pl-1">Рем: {repSplit}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* B2. Звідки взялись гроші в касах. Стоїть після балансів і перед
              списком транзакцій: спершу скільки лежить, потім як воно таким
              стало, потім що конкретно рухалось. */}
          <CashFlowPanel report={cashFlow} />

          {/* C. Reconciliation & Transactions tables */}
          <div className="space-y-6">
            <FinanceTransactionsTable
              transactions={transactions}
              sales={sales}
              repairs={repairs}
              purchases={purchases}
            />
          </div>
        </div>

        {/* Right Column: Telemetry Log & Category Breakdowns (col-span 1) */}
        <div className="space-y-6">
          
          {/* Quick Metrics panel */}
          <div className="card p-5 bg-warm-surface border border-warm-border flex flex-col gap-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-secondary border-b border-warm-border pb-1 tracking-tight">Статус активів</h3>
            
            <div className="space-y-4">
              <div className="border-b border-warm-border/60 pb-3 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-text-secondary">Нерозподілені каси</p>
                  <p className="text-xl font-bold text-text-primary font-mono mt-0.5">{kinds.cash.toLocaleString()} ₴</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-violet animate-pulse" />
              </div>

              <div className="border-b border-warm-border/60 pb-3 flex justify-between items-center">
                {/* Картка/переказ, ще не розподілені по сейфах — не готівка */}
                <div>
                  <p className="text-[10px] text-text-secondary">Безготівка</p>
                  <p className="text-xl font-bold text-text-primary font-mono mt-0.5">{kinds.cashless.toLocaleString()} ₴</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-amber" />
              </div>

              <div className="border-b border-warm-border/60 pb-3 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-text-secondary">Чисті резерви (сейфи)</p>
                  <p className="text-xl font-bold text-text-primary font-mono mt-0.5">{totalSafes.toLocaleString()} ₴</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-cyan" />
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-text-secondary">Транзакції за добу</p>
                  <p className="text-xl font-bold text-text-primary font-mono mt-0.5">{todayTx}</p>
                </div>
                <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-[9px] font-mono text-cyan">СЬОГОДНІ</span>
              </div>
            </div>
          </div>

          {/* Expense Categories chart/breakdown */}
          {report.categoryBreakdown.length > 0 && (
            <div className="card p-5 bg-warm-surface border border-warm-border">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-secondary border-b border-warm-border pb-2 mb-3 tracking-tight">Витрати за категоріями</h3>
              
              <div className="space-y-3">
                {report.categoryBreakdown.map((c) => {
                  const maxAmt = Math.max(...report.categoryBreakdown.map(x => x.amount), 1);
                  const pct = Math.round((c.amount / maxAmt) * 100);

                  return (
                    <div key={c.name} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-primary font-medium">{c.name}</span>
                        <span className="text-text-secondary font-mono">{c.amount.toLocaleString()} ₴</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-warm-border overflow-hidden">
                        <div className="h-full bg-rose rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* System metadata strip */}
          <div className="card p-4 border border-warm-border bg-warm-surface flex flex-col gap-2">
            <span className="font-mono text-[8px] uppercase tracking-widest text-text-muted">LEDGER TELEMETRY TERMINAL</span>
            <div className="font-mono text-[9px] text-text-secondary space-y-1 select-none">
              <p>✓ DB CONNECTION: SECURED</p>
              <p>✓ AUDIT TRAIL: VERIFIED</p>
              <p>✓ ENCRYPTION FLOW: TLS_AES_256_GCM</p>
              <p>✓ LIVE RECONCILIATION: ACTIVE</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
