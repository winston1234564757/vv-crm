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


  return (
    <div className="space-y-6 animate-entry">
      {/* Шапка. Пульсуюча крапка з написом «LEDGER TELEMETRY : ACTIVE» звідси
          прибрана: вона нічого не міряла й нічого не означала. */}
      <div className="border-b border-border pb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-balance">Фінанси</h1>
          <p className="mt-0.5 text-sm text-muted">Каси, сейфи, рух грошей і прибуток</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <AIFinanceButton />
          {/* Усі сейфи, не лише ЧП: решта потрібна формі під аванс, коли в ЧП
              не вистачило. Джерело частки кнопка відбирає сама. */}
          <WithdrawShareButton safes={safes as SafeWithSplit[]} />
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
          
          {/* A. Прибуток за період. Кольорова смуга збоку прибрана —
              DESIGN.md §7 забороняє side-stripe акценти. */}
          <div className="card border border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-xs font-medium text-muted">Чистий операційний результат</p>
                <h2
                  className={`font-display text-3xl font-semibold tabular tracking-tight mt-1 ${report.profit >= 0 ? "text-success" : "text-danger"}`}
                >
                  {report.profit.toLocaleString()} ₴
                </h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted">Рентабельність</p>
                <p className="font-display text-2xl font-semibold tabular text-ink mt-1">
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

          {/* B. Каси й сейфи. Кольорові смуги зверху карток прибрані — тип каси
              несе підпис, а не колір; чотири різні акценти на екрані читались
              як чотири різні смисли, яких немає. */}
          <div className="space-y-4">
            <h3 className="border-b border-border pb-1 text-sm font-semibold text-ink">
              Розподіл ліквідності
            </h3>

            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs text-muted">
              <span>
                Готівкою <span className="font-semibold tabular text-ink">{kinds.cash.toLocaleString()} ₴</span>
              </span>
              <span>
                Карткою <span className="font-semibold tabular text-ink">{kinds.cashless.toLocaleString()} ₴</span>
              </span>
              <span>
                Разом <span className="font-semibold tabular text-ink">{kinds.total.toLocaleString()} ₴</span>
              </span>
            </div>

            {/* Каси */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cashRegisters.map((cr) => (
                <div
                  key={cr.id}
                  className="card card-hover flex min-h-[90px] flex-col justify-between border border-border bg-surface p-4 transition-colors"
                >
                  <div>
                    <span className="text-[11px] text-faint">
                      {isCashless(cr.type) ? "Безготівковий рахунок" : "Поточна каса"}
                    </span>
                    <h4 className="mt-0.5 text-xs font-semibold text-ink">{cr.name}</h4>
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular text-ink">
                    {cr.balance.toLocaleString()} ₴
                  </p>
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
                  <div
                    key={s.id}
                    className="card card-hover flex flex-col justify-between border border-border bg-surface p-4 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-faint">Сейф резерву</span>
                        <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] tabular text-muted">
                          сер. {avgTarget}%
                        </span>
                      </div>
                      <h4 className="mt-0.5 text-xs font-semibold text-ink">{s.name}</h4>
                      <p
                        className={`mt-2 text-lg font-semibold tabular ${isOverdraft ? "text-danger" : "text-ink"}`}
                      >
                        {s.balance.toLocaleString()} ₴
                      </p>

                      {/* Половини сейфа: готівка проти безготівки. Смуга —
                          єдине місце на картці, де колір несе сенс, тож вона
                          лишається двоколірною. */}
                      <div className="mt-2 space-y-1">
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hover">
                          <div
                            className="h-full rounded-l-full bg-accent transition-all duration-500"
                            style={{ width: `${cashPct}%` }}
                            title={`Готівка: ${s.cashBalance.toLocaleString()} ₴`}
                          />
                          <div
                            className="h-full bg-info transition-all duration-500"
                            style={{ width: `${cardPct}%` }}
                            title={`Картка: ${s.cardBalance.toLocaleString()} ₴`}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted">
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                            Готівка <span className="tabular">{s.cashBalance.toLocaleString()} ₴</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-info" />
                            Картка <span className="tabular">{s.cardBalance.toLocaleString()} ₴</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-hover">
                        <div className="h-full bg-accent" style={{ width: `${avgTarget}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-1 text-[11px] leading-none text-muted">
                        <div className="border-r border-border pr-1">Тех: <span className="tabular">{techSplit}%</span></div>
                        <div className="border-r border-border px-1">Акс: <span className="tabular">{accSplit}%</span></div>
                        <div className="pl-1">Рем: <span className="tabular">{repSplit}%</span></div>
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
          
          {/* Статус активів. Кольорові крапки-індикатори прибрані: вони не
              означали стану, лише розфарбовували рядки. */}
          <div className="card flex flex-col gap-4 border border-border bg-surface p-5">
            <h3 className="border-b border-border pb-1 text-sm font-semibold text-ink">
              Статус активів
            </h3>

            <div className="space-y-4">
              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted">Нерозподілені каси</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-ink">
                  {kinds.cash.toLocaleString()} ₴
                </p>
              </div>

              <div className="border-b border-border pb-3">
                {/* Картка/переказ, ще не розподілені по сейфах — не готівка */}
                <p className="text-xs text-muted">Безготівка</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-ink">
                  {kinds.cashless.toLocaleString()} ₴
                </p>
              </div>

              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted">Чисті резерви (сейфи)</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-ink">
                  {totalSafes.toLocaleString()} ₴
                </p>
              </div>

              <div>
                <p className="text-xs text-muted">Транзакції за сьогодні</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-ink">{todayTx}</p>
              </div>
            </div>
          </div>

          {/* Expense Categories chart/breakdown */}
          {report.categoryBreakdown.length > 0 && (
            <div className="card border border-border bg-surface p-5">
              <h3 className="mb-3 border-b border-border pb-2 text-sm font-semibold text-ink">
                Витрати за категоріями
              </h3>

              <div className="space-y-3">
                {report.categoryBreakdown.map((c) => {
                  const maxAmt = Math.max(...report.categoryBreakdown.map((x) => x.amount), 1);
                  const pct = Math.round((c.amount / maxAmt) * 100);

                  return (
                    <div key={c.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{c.name}</span>
                        <span className="tabular text-muted">{c.amount.toLocaleString()} ₴</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/*
            Тут стояв блок «LEDGER TELEMETRY TERMINAL» із рядками «DB CONNECTION:
            SECURED», «AUDIT TRAIL: VERIFIED» тощо. Усі чотири були захардкоджені
            й не прив'язані до жодної перевірки — сторінка стверджувала, що аудит
            верифіковано, нічого не перевіряючи. Видалено, а не перефарбовано:
            фейковий індикатор гірший за його відсутність, бо ним користуються.

            Справжню звірку показує блок «Рух грошей від відкриття» вище: він
            рахує тотожність із леджера й червоніє, коли вона не сходиться.
          */}

        </div>
      </div>
    </div>
  );
}
