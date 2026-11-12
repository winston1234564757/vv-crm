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
    finance_distribution_shares?: { reinvest_percent: number; profit_percent: number };
    distribution_tech?: { opex: number; growth: number; net_profit: number };
    distribution_accessories?: { opex: number; growth: number; net_profit: number };
    distribution_repairs?: { opex: number; growth: number; net_profit: number };
  };
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(distributeFundsAction, initialState);

  const [registerId, setRegisterId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [manualReinvest, setManualReinvest] = useState("0");
  const [manualProfit, setManualProfit] = useState("0");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const selectedRegister = cashRegisters.find((r) => r.id === registerId);

  useEffect(() => {
    if (selectedRegister) {
      setAmount(selectedRegister.balance.toString());
    } else {
      setAmount("");
    }
    setManualReinvest("0");
    setManualProfit("0");
  }, [registerId, selectedRegister]);

  const amountNum = parseFloat(amount) || 0;
  const hasOverdraft = selectedRegister ? amountNum > selectedRegister.balance : false;
  const cashless = isCashless(selectedRegister?.type ?? "");

  const reinvestPct = settings.finance_distribution_shares?.reinvest_percent ?? 40;
  const profitPct = settings.finance_distribution_shares?.profit_percent ?? 60;

  const manualReinvestNum = parseFloat(manualReinvest) || 0;
  const manualProfitNum = parseFloat(manualProfit) || 0;
  const manualSum = manualReinvestNum + manualProfitNum;
  const manualSumMismatch = cashless && amountNum > 0 && Math.abs(manualSum - amountNum) > 0.01;

  // Розрахунок часток: для безготівки — з ручних полів, для готівки — за 2 відсотками
  const reinvestShare = cashless ? manualReinvestNum : Math.round(amountNum * (reinvestPct / 100));
  const profitShare = cashless ? manualProfitNum : amountNum > 0 ? amountNum - reinvestShare : 0;

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

      <div>
        <Input
          label={selectedRegister ? `Сума для розподілу (доступно: ${selectedRegister.balance.toLocaleString()} грн)` : "Сума для розподілу (грн)"}
          name="amount"
          type="number"
          min="1"
          max={selectedRegister?.balance}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={hasOverdraft ? `🚫 Сума ${amountNum.toLocaleString()} грн перевищує баланс каси (${selectedRegister?.balance.toLocaleString()} грн)` : undefined}
          placeholder="5000"
        />
        {selectedRegister && !hasOverdraft && amountNum > 0 && (
          <p className="mt-1 text-[11px] text-text-secondary">
            Залишок після розподілу: <span className="font-semibold text-text-primary">{(selectedRegister.balance - amountNum).toLocaleString()} грн</span>
          </p>
        )}
      </div>

      {/* Hidden inputs to send shares to server action */}
      <input type="hidden" name="reinvest_amount" value={reinvestShare} />
      <input type="hidden" name="profit_amount" value={profitShare} />
      <input type="hidden" name="growth_amount" value={reinvestShare} />
      <input type="hidden" name="net_profit_amount" value={profitShare} />

      {/* Cashless: manual split for cashless if needed */}
      {cashless && selectedRegister && (
        <div className="rounded-2xl border border-violet/10 bg-violet/[0.02] p-4 space-y-3 animate-entry">
          <p className="text-xs font-semibold text-text-primary">Розподіл коштів (вручну):</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Реінвест (грн)"
              name="reinvest_amount_display"
              type="number"
              min="0"
              value={manualReinvest}
              onChange={(e) => setManualReinvest(e.target.value)}
            />
            <Input
              label="Прибуток (грн)"
              name="profit_amount_display"
              type="number"
              min="0"
              value={manualProfit}
              onChange={(e) => setManualProfit(e.target.value)}
            />
          </div>
          {manualSumMismatch && (
            <p className="text-xs text-rose">
              Сума Реінвесту + Прибутку ({manualSum.toLocaleString()} грн) має дорівнювати сумі розподілу ({amountNum.toLocaleString()} грн).
            </p>
          )}
        </div>
      )}

      {/* Visual Shares Breakdown: 2 items */}
      {!cashless && selectedRegister && amountNum > 0 && !hasOverdraft && (
        <div className="rounded-2xl border border-violet/10 bg-violet/[0.02] p-4 space-y-3 animate-entry">
          <p className="text-xs font-semibold text-text-primary">Нарахування у фонди ({reinvestPct}% / {profitPct}%):</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-violet/5 border border-violet/10 p-3 text-center">
              <p className="text-xxs font-medium text-violet uppercase tracking-wider">Реінвест</p>
              <p className="mt-1 text-base font-bold text-text-primary">{reinvestShare.toLocaleString()} грн</p>
              <p className="text-[10px] text-text-secondary">{reinvestPct}% на закупівлі</p>
            </div>
            <div className="rounded-xl bg-emerald/5 border border-emerald/10 p-3 text-center">
              <p className="text-xxs font-medium text-emerald uppercase tracking-wider">Чистий прибуток</p>
              <p className="mt-1 text-base font-bold text-text-primary">{profitShare.toLocaleString()} грн</p>
              <p className="text-[10px] text-text-secondary">{profitPct}% доступно до зняття</p>
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
