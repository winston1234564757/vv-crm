"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import {
  PaymentSourcePicker,
  spendableRegisters,
  type ChosenSource,
  type SourceAccount,
} from "@/components/ui/PaymentSourcePicker";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";

export interface CostAdjustmentData {
  action: "apply" | "none";
  sourceType: "safe" | "cash_register";
  sourceId: string;
  paymentMethod: "cash" | "cashless";
}

interface CostAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CostAdjustmentData) => void;
  itemName: string;
  oldCost: number;
  newCost: number;
  safes: SourceAccount[];
  registers: SourceAccount[];
  isPending?: boolean;
}

export function CostAdjustmentModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  oldCost,
  newCost,
  safes = [],
  registers = [],
  isPending = false,
}: CostAdjustmentModalProps) {
  const delta = Math.round((newCost - oldCost) * 100) / 100;
  const isIncrease = delta > 0;
  const absDelta = Math.abs(delta);

  const [shouldAdjust, setShouldAdjust] = useState<boolean>(true);
  const [source, setSource] = useState<ChosenSource | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "cashless">("cash");

  const spendable = spendableRegisters(registers);
  const allAccounts = [...safes, ...spendable];

  const selectedBalance =
    source === null
      ? null
      : allAccounts.find((a) => a.id === source.id)?.balance ?? null;

  const hasOverdraft =
    isIncrease && shouldAdjust && selectedBalance !== null && absDelta > selectedBalance;

  const handleConfirm = () => {
    if (!shouldAdjust) {
      onConfirm({
        action: "none",
        sourceType: "safe",
        sourceId: "",
        paymentMethod: "cash",
      });
      return;
    }

    if (!source) return;

    onConfirm({
      action: "apply",
      sourceType: source.type,
      sourceId: source.id,
      paymentMethod: source.type === "safe" ? paymentMethod : (source.method ?? "cashless"),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Коригування закупівлі"
      size="md"
      description={`Зміна вартості для: ${itemName}`}
    >
      <div className="space-y-4">
        {/* Банер зміни ціни */}
        <div className="rounded-2xl border border-warm-border/60 bg-warm-hover/30 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Попередня закупівля:</span>
            <span className="font-semibold text-text-primary">{oldCost.toLocaleString()} грн</span>
          </div>
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Нова закупівля:</span>
            <span className="font-semibold text-text-primary">{newCost.toLocaleString()} грн</span>
          </div>
          <div className="border-t border-warm-border/40 pt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-primary">Різниця суми:</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isIncrease
                  ? "bg-rose/10 text-rose border border-rose/20"
                  : "bg-emerald/10 text-emerald border border-emerald/20"
              }`}
            >
              {isIncrease ? `+${absDelta.toLocaleString()} грн (збільшення)` : `-${absDelta.toLocaleString()} грн (зменшення)`}
            </span>
          </div>
        </div>

        {/* Питання користувачу */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-text-secondary block">
            {isIncrease
              ? `Чи списати ${absDelta.toLocaleString()} грн додатково з сейфу / каси?`
              : `Чи повернути ${absDelta.toLocaleString()} грн переплати в сейф / касу?`}
          </label>

          {/* Вибір варіанту: з рухом коштів чи без */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShouldAdjust(true)}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                shouldAdjust
                  ? "border-violet bg-violet/5 shadow-sm ring-1 ring-violet/20"
                  : "border-warm-border/60 bg-warm-surface hover:bg-warm-hover/50 text-text-secondary"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${shouldAdjust ? "border-violet bg-violet" : "border-text-tertiary"}`}>
                  {shouldAdjust && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className={`text-xs font-semibold ${shouldAdjust ? "text-violet" : "text-text-primary"}`}>
                  {isIncrease ? "Списати різницю" : "Повернути кошти"}
                </span>
              </div>
              <span className="text-[11px] text-text-secondary pl-5">
                {isIncrease
                  ? `Списати ${absDelta.toLocaleString()} грн з обраного сейфу/каси`
                  : `Зарахувати ${absDelta.toLocaleString()} грн до балансу сейфу/каси`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShouldAdjust(false)}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                !shouldAdjust
                  ? "border-violet bg-violet/5 shadow-sm ring-1 ring-violet/20"
                  : "border-warm-border/60 bg-warm-surface hover:bg-warm-hover/50 text-text-secondary"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${!shouldAdjust ? "border-violet bg-violet" : "border-text-tertiary"}`}>
                  {!shouldAdjust && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className={`text-xs font-semibold ${!shouldAdjust ? "text-violet" : "text-text-primary"}`}>
                  Без руху коштів
                </span>
              </div>
              <span className="text-[11px] text-text-secondary pl-5">
                Лише оновити собівартість у картці товару
              </span>
            </button>
          </div>
        </div>

        {/* Вибір сейфу/каси якщо обрано рух коштів */}
        {shouldAdjust && (
          <div className="space-y-3 pt-1 animate-entry">
            <PaymentSourcePicker
              label={isIncrease ? "Списати з сейфу / рахунку" : "Повернути у сейф / рахунок"}
              safes={safes}
              registers={spendable}
              value={source}
              onChange={setSource}
            />

            {source?.type === "safe" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Спосіб оплати / половина сейфу</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      paymentMethod === "cash"
                        ? "border-violet bg-violet text-white shadow-sm"
                        : "border-warm-border/60 bg-warm-surface text-text-secondary hover:bg-warm-hover"
                    }`}
                  >
                    💵 Готівка
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cashless")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      paymentMethod === "cashless"
                        ? "border-violet bg-violet text-white shadow-sm"
                        : "border-warm-border/60 bg-warm-surface text-text-secondary hover:bg-warm-hover"
                    }`}
                  >
                    💳 Безготівка
                  </button>
                </div>
              </div>
            )}

            {selectedBalance !== null && (
              <div
                className={`rounded-xl p-3 text-xs border animate-entry ${
                  hasOverdraft
                    ? "bg-rose/5 border-rose/20 text-rose"
                    : "bg-emerald/5 border-emerald/20 text-emerald"
                }`}
              >
                {hasOverdraft ? (
                  <span>⚠️ Недостатньо коштів на балансі ({selectedBalance.toLocaleString()} грн) для списання {absDelta.toLocaleString()} грн</span>
                ) : (
                  <span>
                    Поточний баланс: <strong>{selectedBalance.toLocaleString()} грн</strong>
                    {isIncrease
                      ? ` (після списання: ${(selectedBalance - absDelta).toLocaleString()} грн)`
                      : ` (після повернення: ${(selectedBalance + absDelta).toLocaleString()} грн)`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Кнопки дій */}
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-warm-border/40 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-warm-border bg-surface hover:bg-warm-hover text-text-secondary px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || (shouldAdjust && (!source || hasOverdraft))}
            className="rounded-xl bg-violet hover:bg-violet-hover text-white px-5 py-2.5 text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50"
          >
            {isPending ? "Збереження..." : "Підтвердити і зберегти"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
