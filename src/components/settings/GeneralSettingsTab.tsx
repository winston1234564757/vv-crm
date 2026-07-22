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

  // Tech state
  const [techOpex, setTechOpex] = useState(initialSettings.distribution_tech.opex);
  const [techGrowth, setTechGrowth] = useState(initialSettings.distribution_tech.growth);
  const [techProfit, setTechProfit] = useState(initialSettings.distribution_tech.net_profit);

  // Acc state
  const [accOpex, setAccOpex] = useState(initialSettings.distribution_accessories.opex);
  const [accGrowth, setAccGrowth] = useState(initialSettings.distribution_accessories.growth);
  const [accProfit, setAccProfit] = useState(initialSettings.distribution_accessories.net_profit);

  // Rep state
  const [repOpex, setRepOpex] = useState(initialSettings.distribution_repairs.opex);
  const [repGrowth, setRepGrowth] = useState(initialSettings.distribution_repairs.growth);
  const [repProfit, setRepProfit] = useState(initialSettings.distribution_repairs.net_profit);

  const techTotal = techOpex + techGrowth + techProfit;
  const accTotal = accOpex + accGrowth + accProfit;
  const repTotal = repOpex + repGrowth + repProfit;

  const isValid = techTotal === 100 && accTotal === 100 && repTotal === 100;

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
            Зміна розподілів впливає на розподіл нових надходжень між сейфами OPEX, Growth та Чистий прибуток.
          </p>
          {!isValid && (
            <div className="mt-3 text-xs text-rose font-medium bg-rose/5 p-2.5 rounded-lg border border-rose/10">
              ⚠️ Сума часток для кожної каси має складати рівно 100%. Перевірте повзунки нижче.
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

      {/* Splits card */}
      <div className="card p-5 space-y-5 md:col-span-2 bg-warm-surface border border-iris/10 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-text-primary text-balance tracking-tight">Фінансовий спліт (Розподіл часток каси)</h2>
          <p className="text-xs text-text-secondary mt-1">
            Налаштуйте, скільки відсотків від доходів кожної каси має йти до сейфів OPEX, Growth та Чистий прибуток.
            Сума кожної каси повинна дорівнювати <b>рівно 100%</b>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Tech splits */}
          <div className="space-y-4 p-5 rounded-2xl bg-warm-bg/30 dark:bg-zinc-950/20 border border-warm-border/50 transition-all hover:border-violet/10">
            <h3 className="text-sm font-semibold text-text-primary tracking-tight">Каса техніки</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>OPEX (Операційні витрати)</span>
                  <span className="font-semibold text-text-primary">{techOpex}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="tech_opex"
                  value={techOpex}
                  onChange={(e) => setTechOpex(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>Growth (Розвиток)</span>
                  <span className="font-semibold text-text-primary">{techGrowth}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="tech_growth"
                  value={techGrowth}
                  onChange={(e) => setTechGrowth(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>Чистий прибуток</span>
                  <span className="font-semibold text-text-primary">{techProfit}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="tech_profit"
                  value={techProfit}
                  onChange={(e) => setTechProfit(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div className="pt-3 border-t border-warm-border/60 flex justify-between items-center text-xs">
                <span className="text-text-secondary font-medium">Разом:</span>
                <span className={`font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] ${techTotal === 100 ? "bg-emerald/10 text-emerald" : "bg-rose/10 text-rose"}`}>
                  {techTotal}% {techTotal === 100 ? "✓" : "≠ 100%"}
                </span>
              </div>
            </div>
          </div>

          {/* Accessory splits */}
          <div className="space-y-4 p-5 rounded-2xl bg-warm-bg/30 dark:bg-zinc-950/20 border border-warm-border/50 transition-all hover:border-violet/10">
            <h3 className="text-sm font-semibold text-text-primary tracking-tight">Каса аксесуарів</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>OPEX (Операційні витрати)</span>
                  <span className="font-semibold text-text-primary">{accOpex}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="acc_opex"
                  value={accOpex}
                  onChange={(e) => setAccOpex(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>Growth (Розвиток)</span>
                  <span className="font-semibold text-text-primary">{accGrowth}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="acc_growth"
                  value={accGrowth}
                  onChange={(e) => setAccGrowth(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>Чистий прибуток</span>
                  <span className="font-semibold text-text-primary">{accProfit}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="acc_profit"
                  value={accProfit}
                  onChange={(e) => setAccProfit(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div className="pt-3 border-t border-warm-border/60 flex justify-between items-center text-xs">
                <span className="text-text-secondary font-medium">Разом:</span>
                <span className={`font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] ${accTotal === 100 ? "bg-emerald/10 text-emerald" : "bg-rose/10 text-rose"}`}>
                  {accTotal}% {accTotal === 100 ? "✓" : "≠ 100%"}
                </span>
              </div>
            </div>
          </div>

          {/* Repair splits */}
          <div className="space-y-4 p-5 rounded-2xl bg-warm-bg/30 dark:bg-zinc-950/20 border border-warm-border/50 transition-all hover:border-violet/10">
            <h3 className="text-sm font-semibold text-text-primary tracking-tight">Каса ремонтів</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>OPEX (Операційні витрати)</span>
                  <span className="font-semibold text-text-primary">{repOpex}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="rep_opex"
                  value={repOpex}
                  onChange={(e) => setRepOpex(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>Growth (Розвиток)</span>
                  <span className="font-semibold text-text-primary">{repGrowth}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="rep_growth"
                  value={repGrowth}
                  onChange={(e) => setRepGrowth(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                  <span>Чистий прибуток</span>
                  <span className="font-semibold text-text-primary">{repProfit}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  name="rep_profit"
                  value={repProfit}
                  onChange={(e) => setRepProfit(Number(e.target.value))}
                  className="w-full h-1.5 bg-warm-border rounded-lg appearance-none cursor-pointer accent-violet mt-1.5"
                />
              </div>
              <div className="pt-3 border-t border-warm-border/60 flex justify-between items-center text-xs">
                <span className="text-text-secondary font-medium">Разом:</span>
                <span className={`font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] ${repTotal === 100 ? "bg-emerald/10 text-emerald" : "bg-rose/10 text-rose"}`}>
                  {repTotal}% {repTotal === 100 ? "✓" : "≠ 100%"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
