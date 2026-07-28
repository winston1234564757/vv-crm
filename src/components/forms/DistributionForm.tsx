"use client";

import { useActionState, useEffect, useState } from "react";
import { distributeFundsAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";
import type { SafeDistribution } from "@/lib/data-settings";
import { isCashless } from "@/lib/utils/finance";

interface CashRegister {
  id: string;
  name: string;
  type: string;
  balance: number;
}

const initialState = { success: false, error: "" };

export function DistributionForm({
  cashRegisters,
  settings,
  onSuccess,
}: {
  cashRegisters: CashRegister[];
  settings: {
    distribution_tech: SafeDistribution;
    distribution_accessories: SafeDistribution;
    distribution_repairs: SafeDistribution;
  };
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(distributeFundsAction, initialState);

  const [registerId, setRegisterId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [manualOpex, setManualOpex] = useState("0");
  const [manualGrowth, setManualGrowth] = useState("0");
  const [manualNetProfit, setManualNetProfit] = useState("0");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const selectedRegister = cashRegisters.find(r => r.id === registerId);

  // Set default amount to register's full balance when register is selected
  useEffect(() => {
    if (selectedRegister) {
      setAmount(selectedRegister.balance.toString());
    } else {
      setAmount("");
    }
    // Ручні суми завжди скидаються на 0 при зміні каси — старі значення від
    // іншої каси не мають ніякого стосунку до нового розподілу.
    setManualOpex("0");
    setManualGrowth("0");
    setManualNetProfit("0");
  }, [registerId, selectedRegister]);

  const amountNum = parseFloat(amount) || 0;
  const hasOverdraft = selectedRegister ? amountNum > selectedRegister.balance : false;
  const cashless = isCashless(selectedRegister?.type ?? "");

  // Resolve percentages based on register type. Для безготівки відсотків у
  // налаштуваннях немає навмисно: власник обрав ручний режим — скільки саме
  // зняти з рахунку, вирішує він щоразу.
  const getPercentages = () => {
    if (!selectedRegister || cashless) return { opex: 0, growth: 0, net_profit: 0 };
    if (selectedRegister.type === "tech") return settings.distribution_tech;
    if (selectedRegister.type === "accessories") return settings.distribution_accessories;
    if (selectedRegister.type === "repairs") return settings.distribution_repairs;
    return { opex: 0, growth: 0, net_profit: 0 };
  };

  const pct = getPercentages();

  const manualOpexNum = parseFloat(manualOpex) || 0;
  const manualGrowthNum = parseFloat(manualGrowth) || 0;
  const manualNetProfitNum = parseFloat(manualNetProfit) || 0;
  const manualSum = manualOpexNum + manualGrowthNum + manualNetProfitNum;
  const manualSumMismatch = cashless && amountNum > 0 && Math.abs(manualSum - amountNum) > 0.01;

  // Calculate shares: безготівка бере суми напряму з ручних полів, решта — з відсотків
  const opexShare = cashless ? manualOpexNum : Math.round(amountNum * (pct.opex / 100));
  const growthShare = cashless ? manualGrowthNum : Math.round(amountNum * (pct.growth / 100));
  const netProfitShare = cashless
    ? manualNetProfitNum
    : amountNum > 0
      ? amountNum - opexShare - growthShare
      : 0;

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose animate-entry">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="register_select" className="mb-1.5 block text-xs font-medium text-text-secondary">Каса для розподілу</label>
        <select
          id="register_select"
          required
          value={registerId}
          onChange={(e) => setRegisterId(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>Оберіть касу...</option>
          {cashRegisters.map((cr) => (
            <option key={cr.id} value={cr.id}>
              {cr.name} ({cr.balance.toLocaleString()} грн)
            </option>
          ))}
        </select>
        <input type="hidden" name="cash_register_id" value={registerId} />
      </div>

      <Input
        label="Сума для розподілу (грн)"
        name="amount"
        type="number"
        min="1"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={hasOverdraft ? `Сума перевищує доступний баланс каси (${selectedRegister?.balance.toLocaleString()} грн)` : undefined}
        placeholder="5000"
      />

      {/* Hidden inputs to send shares to server action */}
      <input type="hidden" name="opex_amount" value={opexShare} />
      <input type="hidden" name="growth_amount" value={growthShare} />
      <input type="hidden" name="net_profit_amount" value={netProfitShare} />

      {/* Cashless: no percentage setting exists on purpose — the amounts are typed in by hand every time */}
      {cashless && selectedRegister && (
        <div className="rounded-2xl border border-violet/10 bg-violet/[0.02] p-4 space-y-3 animate-entry">
          <p className="text-xs font-semibold text-text-primary">Розподіл коштів (вручну):</p>
          <div className="grid grid-cols-3 gap-2">
            <Input
              label="OPEX (грн)"
              name="opex_amount_display"
              type="number"
              min="0"
              value={manualOpex}
              onChange={(e) => setManualOpex(e.target.value)}
            />
            <Input
              label="Growth (грн)"
              name="growth_amount_display"
              type="number"
              min="0"
              value={manualGrowth}
              onChange={(e) => setManualGrowth(e.target.value)}
            />
            <Input
              label="Прибуток (грн)"
              name="net_profit_amount_display"
              type="number"
              min="0"
              value={manualNetProfit}
              onChange={(e) => setManualNetProfit(e.target.value)}
            />
          </div>
          {manualSumMismatch && (
            <p className="text-xs text-rose">
              Сума OPEX + Growth + Прибуток ({manualSum.toLocaleString()} грн) має дорівнювати сумі розподілу ({amountNum.toLocaleString()} грн).
            </p>
          )}
          <p className="text-xs text-text-secondary">
            Для безготівки відсотки не задані — впишіть суми вручну.
          </p>
        </div>
      )}

      {/* Visual Shares Breakdown */}
      {!cashless && selectedRegister && amountNum > 0 && !hasOverdraft && (
        <div className="rounded-2xl border border-violet/10 bg-violet/[0.02] p-4 space-y-3 animate-entry">
          <p className="text-xs font-semibold text-text-primary">Прогноз розподілу коштів ({pct.opex}% / {pct.growth}% / {pct.net_profit}%):</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-rose/5 border border-rose/10 p-2.5 text-center">
              <p className="text-xxs font-medium text-rose uppercase tracking-wider">OPEX</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{opexShare.toLocaleString()} грн</p>
              <p className="text-[10px] text-text-secondary">{pct.opex}%</p>
            </div>
            <div className="rounded-xl bg-violet/5 border border-violet/10 p-2.5 text-center">
              <p className="text-xxs font-medium text-violet uppercase tracking-wider">Growth</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{growthShare.toLocaleString()} грн</p>
              <p className="text-[10px] text-text-secondary">{pct.growth}%</p>
            </div>
            <div className="rounded-xl bg-cyan/5 border border-cyan/10 p-2.5 text-center">
              <p className="text-xxs font-medium text-cyan uppercase tracking-wider">Прибуток</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{netProfitShare.toLocaleString()} грн</p>
              <p className="text-[10px] text-text-secondary">{pct.net_profit}%</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-text-secondary">Коментар (опціонально)</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          placeholder="Напр. Щомісячний розподіл каси аксесуарів..."
        />
      </div>

      <button
        type="submit"
        disabled={pending || hasOverdraft || !registerId || amountNum <= 0 || manualSumMismatch}
        className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Розподіл коштів..." : "Розподілити кошти"}
      </button>
    </form>
  );
}
