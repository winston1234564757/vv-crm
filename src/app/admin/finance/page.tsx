export const dynamic = "force-dynamic";

import { requirePageRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { getFinanceData, getFinanceReport } from "@/lib/data-finance";
import { AddTransferButton } from "./AddTransferButton";
import { AddExpenseButton } from "./AddExpenseButton";
import { AddDistributionButton } from "./AddDistributionButton";
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
import { getMoneyPicture } from "@/lib/data-bridge";
import { CashBridgePanel } from "./CashBridgePanel";
import { NetWorthPanel } from "./NetWorthPanel";
import { resolveViewMode } from "@/components/ui/view-mode";
import { Meter, MeterStack } from "@/components/charts/Meter";
import { getSkuReport } from "@/lib/data-sku";
import { SkuPanel } from "./SkuPanel";
import { isRangePreset, RANGE_LABELS, type RangePreset } from "@/lib/profit";
import { RangeTabs } from "../RangeTabs";
import { getAveragesSinceEpoch } from "@/lib/data-averages";
import { AveragesPanel } from "@/components/AveragesPanel";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; range?: string }>;
}) {
  await requirePageRole(MONEY_ROLES);

  const { view, range } = await searchParams;
  const viewMode = resolveViewMode(view);
  /* `getFinanceReport` завжди приймав пресет, але сторінка кликала його без
     аргументу — тобто звіт був вічно тридцятиденним, і ніде на екрані про це
     не було сказано. Найгірше не те, що період не перемикався: те, що цифри
     виглядали як «за весь час». */
  const preset: RangePreset = isRangePreset(range) ? range : "30d";

  const [
    { cashRegisters, safes, transactions, expenseCategories },
    report,
    settings,
    sales,
    repairs,
    purchases,
    cashFlow,
    picture,
    sku,
    averages,
  ] = await Promise.all([
    getFinanceData(),
    getFinanceReport(preset),
    getSettings(),
    getSales(),
    getRepairs(),
    getPurchases(),
    getCashFlow(),
    getMoneyPicture(),
    getSkuReport(preset),
    getAveragesSinceEpoch(),
  ]);

  const todayTx = transactions.filter((t) => t.date === new Date().toISOString().split("T")[0]).length;
  const kinds = splitByKind(cashRegisters);

  /* Ліквідність: чисті фізичні гроші магазину — Готівка в касах і Безготівка на рахунку */
  const liquidity = {
    cash: kinds.cash,
    cashless: kinds.cashless,
  };


  return (
    <div className="space-y-6 animate-entry">
      {/* Шапка. Пульсуюча крапка з написом «LEDGER TELEMETRY : ACTIVE» звідси
          прибрана: вона нічого не міряла й нічого не означала. */}
      <div className="border-b border-border pb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-balance">Фінанси</h1>
          <p className="mt-0.5 text-sm text-muted">Каси, рахунки, рух грошей і прибуток</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <RangeTabs preset={preset} />
          <AIFinanceButton />
          <WithdrawShareButton
            profitFund={settings.finance_profit_fund}
            cashRegisters={cashRegisters}
          />
          <AddExpenseButton
            expenseCategories={expenseCategories}
            registers={cashRegisters}
          />
          <AddDistributionButton cashRegisters={cashRegisters} settings={settings} />
          <AddTransferButton cashRegisters={cashRegisters} />
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
                <p className="text-xs font-medium text-muted">
                  Чистий операційний результат ·{" "}
                  <span className="text-faint">{RANGE_LABELS[preset].toLowerCase()}</span>
                </p>
                <h2
                  className={`font-display text-3xl font-semibold tabular tracking-tight mt-1 ${report.profit >= 0 ? "text-success" : "text-danger"}`}
                >
                  {report.profit.toLocaleString()} ₴
                </h2>
              </div>
              {/* «Чиста», а не просто «Рентабельність»: тут прибуток ПІСЛЯ
                  операційних витрат, а на дашборді в розкладі по категоріях
                  стоїть ВАЛОВА маржа — до них. Обидва числа правильні, але
                  доти, доки обидва звались «маржа», два сусідні екрани
                  показували різні відсотки під однією назвою, і різниця
                  виглядала помилкою. */}
              <div className="text-right">
                <p className="text-xs font-medium text-muted">Чиста рентабельність</p>
                <p className="font-display text-2xl font-semibold tabular text-ink mt-1">
                  {report.totalSales + report.repairsRevenue > 0
                    ? Math.round((report.profit / (report.totalSales + report.repairsRevenue)) * 100)
                    : 0}%
                </p>
                <p className="mt-0.5 text-[11px] text-faint">після витрат</p>
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

          {/* A2. Середні показники — не залежать від обраного пресету вгорі:
              завжди від фінансової епохи до зараз, бо «в середньому на день»
              за останні 7 днів і за весь час — два різних питання. */}
          {averages && (
            <div className="card border border-border bg-surface p-6">
              <h3 className="border-b border-border pb-3 text-sm font-semibold text-ink">
                Середні показники · з відкриття
              </h3>
              <div className="pt-4">
                <AveragesPanel averages={averages} />
              </div>
            </div>
          )}

          {/* B. Каси й сейфи. Кольорові смуги зверху карток прибрані — тип каси
              несе підпис, а не колір; чотири різні акценти на екрані читались
              як чотири різні смисли, яких немає. */}
          <div className="space-y-4">
            <h3 className="border-b border-border pb-1 text-sm font-semibold text-ink">
              Розподіл ліквідності
            </h3>

            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs text-muted">
              <span>
                Готівкою <span className="font-semibold tabular text-ink">{liquidity.cash.toLocaleString()} ₴</span>
              </span>
              <span>
                Карткою <span className="font-semibold tabular text-ink">{liquidity.cashless.toLocaleString()} ₴</span>
              </span>
              <span>
                Разом{" "}
                <span className="font-semibold tabular text-ink">
                  {(liquidity.cash + liquidity.cashless).toLocaleString()} ₴
                </span>
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

            {/* Показники фондів (Реінвест та Прибуток) — просто цифри без окремих сейфів */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
                Розрахункові показники (фонди)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Реінвест */}
                <div className="card border border-violet/20 bg-surface p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-violet">🔄 Фонд Реінвесту</span>
                      <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-semibold text-violet">
                        {settings.finance_distribution_shares?.reinvest_percent ?? 40}% від розподілу
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular text-ink">
                      {settings.finance_reinvest_fund.toLocaleString()} ₴
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Бюджет на закупівлі запчастин, аксесуарів та техніки
                    </p>
                  </div>
                </div>

                {/* 2. Чистий прибуток */}
                <div className="card border border-emerald/20 bg-surface p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-emerald">💰 Чистий прибуток</span>
                      <span className="rounded-full bg-emerald/10 px-2 py-0.5 text-[11px] font-semibold text-emerald">
                        {settings.finance_distribution_shares?.profit_percent ?? 60}% від розподілу
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular text-emerald">
                      {settings.finance_profit_fund.toLocaleString()} ₴
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Нарахована сума, яку власник може зняти в будь-який момент
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border flex justify-end">
                    <WithdrawShareButton
                      profitFund={settings.finance_profit_fund}
                      cashRegisters={cashRegisters}
                      label="💵 Зняти прибуток"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* B2. Звідки взялись гроші в касах. Стоїть після балансів і перед
              списком транзакцій: спершу скільки лежить, потім як воно таким
              стало, потім що конкретно рухалось. */}
          <CashFlowPanel report={cashFlow} />

          {/* B3. Міст «прибуток → гроші» і вартість бізнесу.
              Стоїть після руху грошей і перед списком транзакцій: рух показує,
              ЩО рухалось, міст — чому зароблене не дорівнює тому, що лишилось.
              Це два різні питання, і власники ставили саме друге.

              Обидві панелі беруть один об'єкт `picture` і не рахують нічого
              самі — тому таблиця й графіки не можуть розійтись. */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-6 lg:grid-cols-12">
            <CashBridgePanel bridge={picture.bridge} mode={viewMode} />
            <NetWorthPanel worth={picture.worth} mode={viewMode} />
            <SkuPanel
              report={sku}
              mode={viewMode}
              periodLabel={RANGE_LABELS[preset]}
              preset={preset}
            />
          </div>

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

            {/* Три рядки ділять усі гроші магазину рівно один раз: готівка в
                касах, готівка в сейфах і вся безготівка. Разом вони дають те
                саме, що «Разом» у ліквідності — 26 604 ₴.

                Раніше «Чисті резерви» показували повний баланс сейфів (16 887),
                тобто купюри ПЛЮС 887 картки, що числяться за Growth, а
                «Безготівка» рахувала саму касу. Ті 887 потрапляли в резерви,
                хоч у сейфі їх фізично немає, і рядок «резерви» переставав бути
                числом, яке можна перерахувати руками. */}
            <div className="space-y-4">
              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted">Готівка на точці</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-ink">
                  {liquidity.cash.toLocaleString()} ₴
                </p>
              </div>

              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted">На банківському рахунку</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-ink">
                  {liquidity.cashless.toLocaleString()} ₴
                </p>
              </div>

              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted">Всього реальних коштів</p>
                <p className="mt-0.5 text-xl font-bold tabular text-ink">
                  {(liquidity.cash + liquidity.cashless).toLocaleString()} ₴
                </p>
              </div>

              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted">Доступно прибутку до виведення</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-emerald">
                  {settings.finance_profit_fund.toLocaleString()} ₴
                </p>
              </div>

              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted">Фонд реінвесту (на закупівлі)</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-violet">
                  {settings.finance_reinvest_fund.toLocaleString()} ₴
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
                      <Meter value={pct} />
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
