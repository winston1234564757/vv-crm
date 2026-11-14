"use client";

import { useState } from "react";
import {
  IconReport,
  IconWarning,
  IconCheck,
  IconRocket,
  IconCash,
  IconBox,
  IconRepair,
  IconDevice,
  IconAccessory,
  IconChevronDown,
} from "@/components/icons";
import { pluralUk } from "@/lib/utils/plural";
import type { CategoryProfit } from "@/lib/profit";

interface CFOInsightsPanelProps {
  periodLabel: string;
  totalSales: number;
  repairsRevenue: number;
  salesCost: number;
  repairsCost: number;
  totalExpenses: number;
  profit: number;
  salesCount: number;
  repairsCount: number;
  daysInPeriod: number;
  byCategory: CategoryProfit[];
  categoryBreakdown: { name: string; amount: number; count: number }[];
  cashBalance: number;
  cashlessBalance: number;
  reinvestFund: number;
  profitFund: number;
  reinvestPct: number;
  profitPct: number;
  inventoryValue: number;
  netWorthTotal: number;
}

export function CFOInsightsPanel({
  periodLabel,
  totalSales,
  repairsRevenue,
  salesCost,
  repairsCost,
  totalExpenses,
  profit,
  salesCount,
  repairsCount,
  daysInPeriod,
  byCategory,
  categoryBreakdown,
  cashBalance,
  cashlessBalance,
  reinvestFund,
  profitFund,
  reinvestPct,
  profitPct,
  inventoryValue,
  netWorthTotal,
}: CFOInsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // 1. P&L Waterfall Math
  const grossRevenue = totalSales + repairsRevenue;
  const totalCogs = salesCost + repairsCost;
  const grossMargin = grossRevenue - totalCogs;
  const grossMarginPct = grossRevenue > 0 ? Math.round((grossMargin / grossRevenue) * 100) : 0;
  const cogsRoiPct = totalCogs > 0 ? Math.round((grossMargin / totalCogs) * 100) : 0;

  // 2. Break-Even & OPEX Diagnostics
  const breakEvenCoveragePct =
    totalExpenses > 0 ? Math.min(100, Math.max(0, Math.round((grossMargin / totalExpenses) * 100))) : 100;
  const marginDeficit = Math.max(0, totalExpenses - grossMargin);
  const effectiveMarginRate = grossRevenue > 0 && grossMargin > 0 ? grossMargin / grossRevenue : 0.45;
  const additionalRevenueNeeded =
    marginDeficit > 0 && effectiveMarginRate > 0 ? Math.round(marginDeficit / effectiveMarginRate) : 0;

  const dailyBurnRate = daysInPeriod > 0 ? Math.round(totalExpenses / daysInPeriod) : 0;
  const dailyGrossMargin = daysInPeriod > 0 ? Math.round(grossMargin / daysInPeriod) : 0;

  // Average margin per repair & per sale
  const repairCat = byCategory.find((c) => c.category === "repair");
  const repairGrossProfit = repairCat ? repairCat.profit : repairsRevenue - repairsCost;
  const avgRepairMargin =
    repairsCount > 0 ? Math.max(200, Math.round(repairGrossProfit / repairsCount)) : 800;
  const repairsNeededForBreakEven =
    marginDeficit > 0 ? Math.ceil(marginDeficit / avgRepairMargin) : 0;

  // Detect clustered multi-payments in the period (e.g. 2-3 rent payments inside 30d window)
  const multiPaymentSpikes = categoryBreakdown.filter(
    (c) =>
      c.count >= 2 &&
      c.amount >= 8000 &&
      /оренд|подат|комунал/i.test(c.name),
  );

  // 3. Unit Economics across the 3 Engines (Repairs vs Devices vs Accessories/Parts)
  const devCat = byCategory.find((c) => c.category === "device");
  const accCat = byCategory.find((c) => c.category === "accessory");
  const partCat = byCategory.find((c) => c.category === "part");
  const srvCat = byCategory.find((c) => c.category === "service");

  const engines = [
    {
      key: "repairs",
      label: "Сервіс та Ремонти",
      icon: (
        <span className="text-violet flex items-center">
          <IconRepair size={15} />
        </span>
      ),
      revenue: (repairCat?.revenue ?? 0) + (srvCat?.revenue ?? 0),
      cost: (repairCat?.cost ?? 0) + (srvCat?.cost ?? 0),
      profit: (repairCat?.profit ?? 0) + (srvCat?.profit ?? 0),
    },
    {
      key: "accessories",
      label: "Аксесуари та Деталі",
      icon: (
        <span className="text-emerald flex items-center">
          <IconAccessory size={15} />
        </span>
      ),
      revenue: (accCat?.revenue ?? 0) + (partCat?.revenue ?? 0),
      cost: (accCat?.cost ?? 0) + (partCat?.cost ?? 0),
      profit: (accCat?.profit ?? 0) + (partCat?.profit ?? 0),
    },
    {
      key: "devices",
      label: "Продаж Техніки",
      icon: (
        <span className="text-accent-ink flex items-center">
          <IconDevice size={15} />
        </span>
      ),
      revenue: devCat?.revenue ?? 0,
      cost: devCat?.cost ?? 0,
      profit: devCat?.profit ?? 0,
    },
  ].map((e) => {
    const marginPct = e.revenue > 0 ? Math.round((e.profit / e.revenue) * 100) : 0;
    const roiPct = e.cost > 0 ? Math.round((e.profit / e.cost) * 100) : e.profit > 0 ? 100 : 0;
    const shareOfGrossProfit =
      grossMargin > 0 ? Math.max(0, Math.round((Math.max(0, e.profit) / grossMargin) * 100)) : 0;
    return { ...e, marginPct, roiPct, shareOfGrossProfit };
  });

  const topEngine = [...engines].sort((a, b) => b.profit - a.profit)[0];

  // 4. Liquidity, Working Capital & Dividend Limit Math
  const totalLiquidity = cashBalance + cashlessBalance;
  const virtualFundsTotal = reinvestFund + profitFund;
  const fundsBalanced = Math.abs(totalLiquidity - virtualFundsTotal) <= 1;
  const reinvestOverdraft = reinvestFund < 0 ? Math.abs(reinvestFund) : 0;
  const withdrawableProfitNow = Math.max(0, Math.min(profitFund, totalLiquidity));

  const totalAssets = totalLiquidity + inventoryValue;
  const cashRatioPct = totalAssets > 0 ? Math.round((totalLiquidity / totalAssets) * 100) : 0;
  const inventoryRatioPct = totalAssets > 0 ? 100 - cashRatioPct : 0;

  return (
    <section className="card border border-border bg-surface overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-hover/40 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent-ink">
            <IconReport size={18} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-ink">
                Фінансова діагностика та інсайти CFO
              </h2>
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
                {periodLabel}
              </span>
              {fundsBalanced ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2.5 py-0.5 text-[11px] font-semibold text-success">
                  <IconCheck size={12} /> Баланс кас і фондів сходиться 1:1
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2.5 py-0.5 text-[11px] font-semibold text-danger">
                  <IconWarning size={12} /> Розбіжність фондів
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              Управлінський P&L (воронка маржі), точка беззбитковості, рентабельність напрямів та реальний ліміт дивідендів
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:text-ink transition-colors cursor-pointer"
        >
          <span>{isExpanded ? "Згорнути інсайти" : "Розгорнути інсайти"}</span>
          <IconChevronDown
            size={14}
            className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="p-5 space-y-5">
          {/* 1. P&L WATERFALL BAR (5 СХОДИНОК ВІД ВИТОРГУ ДО ЧИСТОГО P&L) */}
          <div className="rounded-2xl border border-border bg-hover/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Воронка формування фінансового результату (P&L Waterfall · {periodLabel.toLowerCase()})
              </span>
              <span className="text-[11px] text-muted">
                Середня генерація маржі:{" "}
                <strong className="tabular text-success">+{dailyGrossMargin.toLocaleString()} ₴/день</strong>
                {" · "}Навантаження OPEX:{" "}
                <strong className="tabular text-danger">−{dailyBurnRate.toLocaleString()} ₴/день</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* Step 1: Gross Revenue */}
              <div className="rounded-xl border border-border bg-surface p-3.5">
                <p className="text-[11px] font-medium text-muted">1. Валовий виторг</p>
                <p className="mt-1 font-display text-xl font-bold tabular text-ink">
                  {grossRevenue.toLocaleString()} ₴
                </p>
                <p className="mt-1 text-[11px] text-faint">
                  {salesCount} {pluralUk(salesCount, "продаж", "продажі", "продажів")} · {repairsCount}{" "}
                  {pluralUk(repairsCount, "ремонт", "ремонти", "ремонтів")}
                </p>
              </div>

              {/* Step 2: COGS */}
              <div className="rounded-xl border border-border bg-surface p-3.5">
                <p className="text-[11px] font-medium text-muted">2. Собівартість (COGS)</p>
                <p className="mt-1 font-display text-xl font-bold tabular text-ink">
                  −{totalCogs.toLocaleString()} ₴
                </p>
                <p className="mt-1 text-[11px] text-faint">
                  Товар: {salesCost.toLocaleString()} ₴ · Деталі: {repairsCost.toLocaleString()} ₴
                </p>
              </div>

              {/* Step 3: Gross Margin (The true operational earning!) */}
              <div className="rounded-xl border border-success/30 bg-success-subtle/40 p-3.5">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-semibold text-success">3. Валова маржа (Заробіток)</p>
                  <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold tabular text-success">
                    {grossMarginPct}% маржа
                  </span>
                </div>
                <p className="mt-1 font-display text-xl font-bold tabular text-success">
                  +{grossMargin.toLocaleString()} ₴
                </p>
                <p className="mt-1 text-[11px] text-success/80">
                  Чистий плюс з угод · ROI +{cogsRoiPct}%
                </p>
              </div>

              {/* Step 4: Fixed OPEX */}
              <div className="rounded-xl border border-border bg-surface p-3.5">
                <p className="text-[11px] font-medium text-muted">4. Постійні витрати (OPEX)</p>
                <p className="mt-1 font-display text-xl font-bold tabular text-danger">
                  −{totalExpenses.toLocaleString()} ₴
                </p>
                <p className="mt-1 text-[11px] text-faint truncate">
                  {categoryBreakdown.length > 0
                    ? categoryBreakdown
                        .slice(0, 2)
                        .map((c) => `${c.name}: ${c.amount.toLocaleString()} ₴`)
                        .join(" · ")
                    : "Оренда, податки, комуналка"}
                </p>
              </div>

              {/* Step 5: Net P&L */}
              <div
                className={`rounded-xl border p-3.5 ${
                  profit >= 0
                    ? "border-success/30 bg-success-subtle/30"
                    : "border-danger/30 bg-danger-subtle/30"
                }`}
              >
                <p className="text-[11px] font-semibold text-muted">5. Чистий P&L періоду</p>
                <p
                  className={`mt-1 font-display text-xl font-bold tabular ${
                    profit >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {profit >= 0 ? "+" : ""}
                  {profit.toLocaleString()} ₴
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {profit >= 0
                    ? "Всі витрати OPEX перекрито!"
                    : `Покрито ${breakEvenCoveragePct}% касових витрат`}
                </p>
              </div>
            </div>
          </div>

          {/* 2. FOUR CFO INSIGHT CARDS */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* INSIGHT 1: BREAK-EVEN & OPEX ANOMALIES */}
            <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <IconRocket size={15} className="text-accent-ink" />
                    1. Точка беззбитковості (Break-Even Point)
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular ${
                      profit >= 0
                        ? "bg-success-subtle text-success"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {breakEvenCoveragePct}% OPEX покрито
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">
                      Зароблена маржа:{" "}
                      <strong className="tabular text-success">+{grossMargin.toLocaleString()} ₴</strong>
                    </span>
                    <span className="text-muted">
                      Витрати OPEX:{" "}
                      <strong className="tabular text-ink">{totalExpenses.toLocaleString()} ₴</strong>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-hover">
                    <div
                      className={`h-full rounded-full transition-all ${
                        profit >= 0 ? "bg-success" : "bg-accent"
                      }`}
                      style={{ width: `${breakEvenCoveragePct}%` }}
                    />
                  </div>
                </div>

                {profit < 0 ? (
                  <div className="rounded-xl bg-hover/60 p-3 text-xs space-y-1.5">
                    <p className="text-ink leading-relaxed">
                      💡 <strong>Інсайт CFO:</strong> Сама торгівля та ремонти працюють{" "}
                      <span className="font-semibold text-success">
                        у плюс (+{grossMargin.toLocaleString()} ₴ чистої маржі при рентабельності {grossMarginPct}%)
                      </span>
                      . Щоб повністю перекрити залишок витрат періоду (
                      <strong className="tabular text-danger">{marginDeficit.toLocaleString()} ₴</strong>),
                      потрібно зробити ще{" "}
                      <strong className="tabular text-ink">
                        ≈ {additionalRevenueNeeded.toLocaleString()} ₴ виторгу
                      </strong>{" "}
                      (це приблизно{" "}
                      <strong className="tabular text-ink">
                        {repairsNeededForBreakEven}{" "}
                        {pluralUk(repairsNeededForBreakEven, "середній ремонт", "середні ремонти", "середніх ремонтів")}
                      </strong>{" "}
                      по ~{avgRepairMargin.toLocaleString()} ₴ маржі).
                    </p>
                    {multiPaymentSpikes.length > 0 && (
                      <p className="text-[11px] text-warning font-medium border-t border-border pt-1.5">
                        ⚠️ Бухгалтерська примітка: у вибраний період потрапило кілька великих списань по статтях{" "}
                        {multiPaymentSpikes
                          .map(
                            (s) =>
                              `«${s.name}» (${s.count} ${pluralUk(s.count, "платіж", "платежі", "платежів")} на ${s.amount.toLocaleString()} ₴)`,
                          )
                          .join(", ")}
                        . Касовий метод фіксує всю суму в день оплати, що штучно завищило витрати цього вікна.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-success-subtle/50 p-3 text-xs text-ink leading-relaxed">
                    ✅ <strong>Точку беззбитковості пройдено!</strong> Валова маржа (+
                    {grossMargin.toLocaleString()} ₴) повністю покрила всі постійні витрати магазину (
                    {totalExpenses.toLocaleString()} ₴) і згенерувала{" "}
                    <strong className="text-success">+{profit.toLocaleString()} ₴</strong> чистого приросту капіталу.
                  </div>
                )}
              </div>
            </div>

            {/* INSIGHT 2: UNIT ECONOMICS OF 3 BUSINESS ENGINES */}
            <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <IconBox size={15} className="text-violet" />
                    2. Unit-економіка напрямів (Хто годує магазин)
                  </span>
                  {topEngine && topEngine.profit > 0 && (
                    <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-semibold text-violet">
                      Лідер: {topEngine.label} ({topEngine.shareOfGrossProfit}% прибутку)
                    </span>
                  )}
                </div>

                <div className="divide-y divide-border rounded-xl border border-border bg-hover/20">
                  {engines.map((eng) => (
                    <div
                      key={eng.key}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-[155px]">
                        {eng.icon}
                        <div>
                          <p className="font-semibold text-ink">{eng.label}</p>
                          <p className="text-[10px] text-muted tabular">
                            Виторг: {eng.revenue.toLocaleString()} ₴ · Собів.: {eng.cost.toLocaleString()} ₴
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 ml-auto">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular ${
                            eng.marginPct >= 40
                              ? "bg-success-subtle text-success"
                              : eng.marginPct >= 20
                                ? "bg-accent/10 text-accent-ink"
                                : "bg-warning/15 text-warning"
                          }`}
                          title="Рентабельність виторгу (Маржа / Виторг)"
                        >
                          Маржа {eng.marginPct}%
                        </span>
                        <span
                          className="rounded-md bg-hover px-1.5 py-0.5 text-[10px] font-semibold tabular text-muted"
                          title="Віддача на вкладену собівартість (Маржа / Собівартість)"
                        >
                          ROI +{eng.roiPct}%
                        </span>
                        <div className="text-right min-w-[82px]">
                          <p
                            className={`font-bold tabular ${
                              eng.profit >= 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {eng.profit >= 0 ? "+" : ""}
                            {eng.profit.toLocaleString()} ₴
                          </p>
                          <p className="text-[10px] text-faint tabular">
                            {eng.shareOfGrossProfit}% усього плюсу
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted leading-relaxed">
                  💡 <strong>Висновок CFO:</strong>{" "}
                  {engines[0].shareOfGrossProfit + engines[1].shareOfGrossProfit >= 75 ? (
                    <>
                      <strong>Сервіс ({engines[0].shareOfGrossProfit}%)</strong> та{" "}
                      <strong>Аксесуари ({engines[1].shareOfGrossProfit}%)</strong> генерують{" "}
                      <strong className="text-ink">
                        {engines[0].shareOfGrossProfit + engines[1].shareOfGrossProfit}% усього валового заробітку
                      </strong>{" "}
                      при високому ROI (+{engines[0].roiPct}% та +{engines[1].roiPct}%). Техніка дає{" "}
                      {engines[2].marginPct}% маржі — не купуйте пристрої з очікуваним ROI менше 25% та обов&apos;язково
                      додавайте скло/чохол до кожного чека.
                    </>
                  ) : (
                    <>
                      Найвищу рентабельність показує напрям «{topEngine?.label}» (маржа {topEngine?.marginPct}%, ROI +
                      {topEngine?.roiPct}%). Фокусуйте оборотний капітал на позиціях зі швидкою оборотністю.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* INSIGHT 3: DOUBLE-ENTRY FUNDS & REAL DIVIDEND LIMIT */}
            <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <IconCash size={15} className="text-emerald" />
                    3. Реальний ліміт дивідендів та Баланс фондів ({reinvestPct}% / {profitPct}%)
                  </span>
                  <span className="rounded-full bg-emerald/10 px-2 py-0.5 text-[11px] font-bold tabular text-emerald">
                    До видачі зараз: {withdrawableProfitNow.toLocaleString()} ₴
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-border bg-hover/30 p-2.5">
                    <p className="text-[10px] text-muted">Нарахований прибуток</p>
                    <p className="mt-0.5 text-sm font-bold tabular text-emerald">
                      {profitFund.toLocaleString()} ₴
                    </p>
                    <p className="text-[10px] text-faint">квота {profitPct}% маржі</p>
                  </div>

                  <div className="rounded-xl border border-border bg-hover/30 p-2.5">
                    <p className="text-[10px] text-muted">Операційний фонд</p>
                    <p
                      className={`mt-0.5 text-sm font-bold tabular ${
                        reinvestFund >= 0 ? "text-violet" : "text-warning"
                      }`}
                    >
                      {reinvestFund >= 0 ? "+" : ""}
                      {reinvestFund.toLocaleString()} ₴
                    </p>
                    <p className="text-[10px] text-faint">
                      {reinvestFund >= 0 ? "резерв закупівель" : "вкладено в товар"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-2.5">
                    <p className="text-[10px] font-semibold text-emerald">Живих грошей у касі</p>
                    <p className="mt-0.5 text-sm font-bold tabular text-ink">
                      {totalLiquidity.toLocaleString()} ₴
                    </p>
                    <p className="text-[10px] text-muted tabular">
                      💵 {cashBalance.toLocaleString()} · 💳 {cashlessBalance.toLocaleString()}
                    </p>
                  </div>
                </div>

                {reinvestOverdraft > 0 ? (
                  <p className="rounded-xl bg-warning/10 border border-warning/20 p-2.5 text-[11px] text-ink leading-relaxed">
                    📌 <strong>Куди поділися {reinvestOverdraft.toLocaleString()} ₴ різниці між прибутком і касою:</strong>{" "}
                    Ви закупили запчастин/товару на <strong>{reinvestOverdraft.toLocaleString()} ₴</strong> більше, ніж
                    було на Операційному рахунку. Ці кошти тимчасово взяті з каси прибутку й зараз лежать у деталях на
                    складі. Прямо зараз фізично можна зняти{" "}
                    <strong className="text-emerald">{withdrawableProfitNow.toLocaleString()} ₴</strong>, а решта{" "}
                    <strong>{reinvestOverdraft.toLocaleString()} ₴</strong> автоматично повернеться в касу при оплаті
                    наступних ремонтів і продажів.
                  </p>
                ) : (
                  <p className="rounded-xl bg-success-subtle/40 p-2.5 text-[11px] text-ink leading-relaxed">
                    ✅ <strong>Фонд прибутку на 100% забезпечений живою готівкою:</strong> Увесь нарахований чистий
                    прибуток ({profitFund.toLocaleString()} ₴) фізично лежить у касах і доступний до виведення без
                    шкоди для оборотних закупівель ({reinvestFund.toLocaleString()} ₴).
                  </p>
                )}
              </div>
            </div>

            {/* INSIGHT 4: WORKING CAPITAL & LIQUIDITY RATIO */}
            <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <span className="text-accent-ink flex items-center">
                      <IconReport size={15} />
                    </span>
                    4. Структура капіталу та Заморозка в складі
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular ${
                      cashRatioPct >= 15
                        ? "bg-success-subtle text-success"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    Ліквідність: {cashRatioPct}% у грошах / {inventoryRatioPct}% у товарі
                  </span>
                </div>

                {/* Stacked Bar: Cash vs Inventory */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">
                      💵 Живі гроші:{" "}
                      <strong className="tabular text-ink">{totalLiquidity.toLocaleString()} ₴</strong> ({cashRatioPct}
                      %)
                    </span>
                    <span className="text-muted">
                      📦 Заморожено в товарі:{" "}
                      <strong className="tabular text-ink">{inventoryValue.toLocaleString()} ₴</strong> (
                      {inventoryRatioPct}%)
                    </span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-hover">
                    <div
                      className="h-full bg-emerald transition-all"
                      style={{ width: `${Math.max(4, cashRatioPct)}%` }}
                      title={`Живі гроші: ${totalLiquidity.toLocaleString()} ₴`}
                    />
                    <div
                      className="h-full bg-violet/70 transition-all"
                      style={{ width: `${Math.min(96, inventoryRatioPct)}%` }}
                      title={`Склад за собівартістю: ${inventoryValue.toLocaleString()} ₴`}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-hover/60 p-3 text-[11px] text-ink leading-relaxed">
                  💡 <strong>Діагноз оборотного капіталу (Вартість бізнесу: {netWorthTotal.toLocaleString()} ₴):</strong>{" "}
                  {cashRatioPct < 15 ? (
                    <>
                      Зараз <strong>{inventoryRatioPct}%</strong> ваших активів ({inventoryValue.toLocaleString()} ₴ за
                      собівартістю) лежить на полицях у техніці, запчастинах та аксесуарах, а в живих грошах — лише{" "}
                      <strong>{cashRatioPct}%</strong> ({totalLiquidity.toLocaleString()} ₴).{" "}
                      <span className="text-warning font-semibold">
                        Рекомендація CFO:
                      </span>{" "}
                      тимчасово пригальмуйте викуп нетермінової техніки в запас і розпродайте залежані позиції (45+ днів
                      у розділі «Техніка»), щоб вивільнити хоча б{" "}
                      <strong>{Math.round(inventoryValue * 0.15).toLocaleString()} ₴</strong> у живу касову подушку під
                      наступну оренду.
                    </>
                  ) : (
                    <>
                      Здорова пропорція ліквідності: у касах достатній запас живих коштів ({totalLiquidity.toLocaleString()}{" "}
                      ₴), а товарний запас ({inventoryValue.toLocaleString()} ₴) забезпечує стабільні продажі.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
