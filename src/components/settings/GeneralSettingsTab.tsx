"use client";

import { useState } from "react";
import type { ParsedSettings } from "@/lib/data-settings";

interface GeneralSettingsTabProps {
  initialSettings: ParsedSettings;
  action: (formData: FormData) => void;
  isPending: boolean;
}

export function GeneralSettingsTab({
  initialSettings,
  action,
  isPending,
}: GeneralSettingsTabProps) {
  const [shopName, setShopName] = useState(initialSettings.shop_name);

  // Sales targets — measured in profit, not revenue. Empty field = null = no target.
  const [targetDaily, setTargetDaily] = useState(
    initialSettings.sales_targets.daily !== null ? String(initialSettings.sales_targets.daily) : ""
  );
  const [targetMonthly, setTargetMonthly] = useState(
    initialSettings.sales_targets.monthly !== null ? String(initialSettings.sales_targets.monthly) : ""
  );

  // 2-point Fund distribution: Reinvest & Profit
  const [reinvestPct, setReinvestPct] = useState(
    initialSettings.finance_distribution_shares?.reinvest_percent ?? 40
  );
  const [profitPct, setProfitPct] = useState(
    initialSettings.finance_distribution_shares?.profit_percent ?? 60
  );

  const totalPct = reinvestPct + profitPct;
  const isValid = totalPct === 100;

  return (
    <form action={action} className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Store settings card */}
      <div className="card p-5 space-y-4 bg-warm-surface border border-iris/10 rounded-2xl shadow-sm">
        <h2 className="text-base font-semibold text-text-primary text-balance tracking-tight">Параметри магазину</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="shop_name" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Назва магазину / майстерні
            </label>
            <input
              id="shop_name"
              name="shop_name"
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full rounded-xl border border-warm-border/60 bg-warm-surface/50 px-4 py-3 text-sm text-text-primary outline-none transition-all focus:border-violet/40 focus:ring-2 focus:ring-violet/5"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Валюта системи</label>
            <input
              type="text"
              value="UAH (Гривня)"
              disabled
              className="w-full rounded-xl border border-warm-border/40 bg-warm-bg/50 px-4 py-3 text-sm text-text-secondary/60 outline-none cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Action card */}
      <div className="card p-5 bg-warm-surface border border-iris/10 rounded-2xl shadow-sm flex flex-col justify-between">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-text-primary text-balance tracking-tight">Зберегти зміни</h2>
          <p className="text-xs leading-relaxed text-text-secondary">
            Зміна назви магазину оновлює заголовок у сайдбарі та на публічній сторінці трекінгу ремонтів.
            Зміна розподілу визначає частки нарахування у фонд Реінвесту та Чистий прибуток.
          </p>
          {!isValid && (
            <div className="mt-3 text-xs text-rose font-medium bg-rose/5 p-2.5 rounded-lg border border-rose/10">
              ⚠️ Сума часток Реінвесту та Прибутку має складати рівно 100%.
            </div>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isPending || !isValid}
          className="btn-press mt-6 flex w-full items-center justify-center rounded-xl bg-violet py-3.5 text-sm font-semibold text-white transition-all hover:bg-violet-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-violet/15 active:scale-[0.98]"
        >
          {isPending ? "Збереження..." : "Зберегти всі налаштування"}
        </button>
      </div>

      {/* Sales targets card */}
      <div className="card p-5 space-y-4 md:col-span-2 bg-warm-surface border border-iris/10 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-text-primary text-balance tracking-tight">Цілі по прибутку</h2>
          <p className="text-xs text-text-secondary mt-1">
            Ціль вимірюється чистим прибутком, а не виторгом — виторг легко нагнати, продаючи в нуль.
            Порожнє поле — ціль не показується.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="target_daily" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Ціль прибутку за день, ₴
            </label>
            <input
              id="target_daily"
              name="target_daily"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="Порожнє — ціль не показується"
              value={targetDaily}
              onChange={(e) => setTargetDaily(e.target.value)}
              className="w-full rounded-xl border border-warm-border/60 bg-warm-surface/50 px-4 py-3 text-sm text-text-primary outline-none transition-all focus:border-violet/40 focus:ring-2 focus:ring-violet/5"
            />
          </div>

          <div>
            <label htmlFor="target_monthly" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Ціль прибутку за місяць, ₴
            </label>
            <input
              id="target_monthly"
              name="target_monthly"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="Порожнє — ціль не показується"
              value={targetMonthly}
              onChange={(e) => setTargetMonthly(e.target.value)}
              className="w-full rounded-xl border border-warm-border/60 bg-warm-surface/50 px-4 py-3 text-sm text-text-primary outline-none transition-all focus:border-violet/40 focus:ring-2 focus:ring-violet/5"
            />
          </div>
        </div>
      </div>

      {/* Splits card: 2 items (Operational Account & Profit) */}
      <div className="card p-5 space-y-5 md:col-span-2 bg-warm-surface border border-iris/10 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-text-primary text-balance tracking-tight">Автоматичний розподіл прибутку</h2>
          <p className="text-xs text-text-secondary mt-1">
            Налаштуйте, як розподіляється маржа (Прибуток = Ціна - Собівартість) від готівкових оплат між <b>Операційним рахунком</b> (оборотні кошти й покриття витрат) та <b>Чистим прибутком</b> (доступно до зняття). Собівартість товару/запчастин завжди повертається в Операційний рахунок у повному обсязі (100%).
          </p>
        </div>

        <input type="hidden" name="reinvest_percent" value={reinvestPct} />
        <input type="hidden" name="profit_percent" value={profitPct} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Operational Account */}
          <div className="space-y-4 p-5 rounded-2xl bg-warm-bg/30 dark:bg-zinc-950/20 border border-warm-border/50 transition-all hover:border-violet/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary tracking-tight">Операційний рахунок</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">Оборотні кошти: закупівлі та операційні витрати</p>
              </div>
              <span className="text-lg font-bold tabular text-violet">{reinvestPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={reinvestPct}
              onChange={(e) => {
                const val = Number(e.target.value);
                setReinvestPct(val);
                setProfitPct(100 - val);
              }}
              className="w-full h-2 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet"
            />
          </div>

          {/* Profit */}
          <div className="space-y-4 p-5 rounded-2xl bg-warm-bg/30 dark:bg-zinc-950/20 border border-warm-border/50 transition-all hover:border-violet/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary tracking-tight">Чистий прибуток</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">Фонд доступний до зняття власниками</p>
              </div>
              <span className="text-lg font-bold tabular text-emerald">{profitPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={profitPct}
              onChange={(e) => {
                const val = Number(e.target.value);
                setProfitPct(val);
                setReinvestPct(100 - val);
              }}
              className="w-full h-2 bg-warm-border rounded-lg appearance-none cursor-pointer accent-emerald"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-warm-border/60 flex justify-between items-center text-xs">
          <span className="text-text-secondary font-medium">Сума часток:</span>
          <span className={`font-bold flex items-center gap-1 px-3 py-1 rounded-full text-xs ${isValid ? "bg-emerald/10 text-emerald" : "bg-rose/10 text-rose"}`}>
            {totalPct}% {isValid ? "✓ Готово до збереження" : "≠ 100% (скоригуйте)"}
          </span>
        </div>
      </div>
    </form>
  );
}
