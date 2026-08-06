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
import { getMoneyPicture } from "@/lib/data-bridge";
import { CashBridgePanel } from "./CashBridgePanel";
import { NetWorthPanel } from "./NetWorthPanel";
import { resolveViewMode } from "@/components/ui/view-mode";
import { Meter, MeterStack } from "@/components/charts/Meter";
import { getSkuReport } from "@/lib/data-sku";
import { SkuPanel } from "./SkuPanel";
import { isRangePreset, RANGE_LABELS, type RangePreset } from "@/lib/profit";
import { RangeTabs } from "../RangeTabs";

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
  ]);

  const todayTx = transactions.filter((t) => t.date === new Date().toISOString().split("T")[0]).length;
  const kinds = splitByKind(cashRegisters);

  /* Ліквідність рахується по касах І СЕЙФАХ разом.
     Раніше тут стояли самі каси, і при 16 000 купюр, які лежали в сейфах,
     рядок казав «Готівкою 0 ₴». Формально він відповідав на «скільки в касах»,
     але читався як «скільки в магазині грошей» — і відповідав неправдою. Блок
     «Зараз у касах і сейфах» нижче весь час показував правильні 16 000, тож
     два сусідні місця на одному екрані розходились удвічі.
     `Нерозподілені каси` у «Статусі активів» лишається по касах: воно про те,
     що ЩЕ НЕ рознесене по сейфах, і сейфи туди за визначенням не входять. */
  const safeRows = safes as SafeWithSplit[];
  /* Купюри в сейфах — окремо від їхнього повного балансу: безготівкова половина
     лежить на банківському рахунку, а не в сейфі, і рахувати її «резервом»
     означало б назвати резервом те, чого в сейфі немає. */
  const safesCash = safeRows.reduce((s, v) => s + v.cashBalance, 0);
  const liquidity = {
    cash: kinds.cash + safesCash,
    cashless: kinds.cashless + safeRows.reduce((s, v) => s + v.cardBalance, 0),
  };


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
          <RangeTabs preset={preset} />
          <AIFinanceButton />
          {/* Усі сейфи, не лише ЧП: решта потрібна формі під аванс, коли в ЧП
              не вистачило. Джерело частки кнопка відбирає сама. */}
          <WithdrawShareButton safes={safes as SafeWithSplit[]} />
          <AddTopUpButton safes={safes} />
          <AddExpenseButton
            expenseCategories={expenseCategories}
            safes={safes}
            registers={cashRegisters}
          />
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
                        <MeterStack
                          segments={[
                            {
                              key: "cash",
                              value: cashPct,
                              tone: "accent",
                              title: `Готівка: ${s.cashBalance.toLocaleString()} ₴`,
                            },
                            {
                              key: "card",
                              value: cardPct,
                              tone: "info",
                              title: `Картка: ${s.cardBalance.toLocaleString()} ₴`,
                            },
                          ]}
                        />
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
                      <Meter size="xs" value={avgTarget} />
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
                <p className="text-xs text-muted">Нерозподілені каси</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-ink">
                  {kinds.cash.toLocaleString()} ₴
                </p>
              </div>

              <div className="border-b border-border pb-3 space-y-2">
                <p className="text-xs text-muted">На рахунку</p>
                <p className="text-xl font-semibold tabular text-ink">
                  {liquidity.cashless.toLocaleString()} ₴
                </p>
                {/* Розбивка: картка на рахунку + картка-частина сейфів */}
                <div className="space-y-1 pt-0.5">
                  {/* Каса безготівки */}
                  {cashRegisters.filter(cr => cr.type === "cashless").map(cr => (
                    <div key={cr.id} className="flex justify-between items-baseline text-[11px]">
                      <span className="text-muted truncate mr-2">На картці</span>
                      <span className="tabular text-ink font-medium shrink-0">{cr.balance.toLocaleString()} ₴</span>
                    </div>
                  ))}
                  {/* Картка-частина кожного сейфа (якщо > 0) */}
                  {safeRows
                    .filter(s => s.cardBalance > 0)
                    .map(s => (
                      <div key={s.id} className="flex justify-between items-baseline text-[11px]">
                        <span className="text-muted truncate mr-2">У сейфі «{s.name}»</span>
                        <span className="tabular text-ink font-medium shrink-0">{s.cardBalance.toLocaleString()} ₴</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted">Чисті резерви (сейфи)</p>
                <p className="mt-0.5 text-xl font-semibold tabular text-ink">
                  {safesCash.toLocaleString()} ₴
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
