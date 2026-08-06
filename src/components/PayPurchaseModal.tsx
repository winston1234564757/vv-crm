"use client";

import { useState } from "react";
import { IconClose } from "@/components/icons";
import {
  PaymentSourcePicker,
  spendableRegisters,
  type ChosenSource,
} from "@/components/ui/PaymentSourcePicker";

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function PayPurchaseModal({
  isOpen,
  onClose,
  onConfirm,
  safes,
  registers = [],
  amount,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (source: ChosenSource) => void;
  safes: Safe[];
  /** Каси як джерело. Пікер лишить із них лише безготівкові. */
  registers?: Safe[];
  amount: number;
  isPending: boolean;
}) {
  const [source, setSource] = useState<ChosenSource | null>(null);

  if (!isOpen) return null;

  /* Баланс шукаємо і серед сейфів, і серед кас: підказка про нестачу мусить
     знати про обидва види джерел, інакше оплата з рахунку показувала б
     «баланс невідомий» і кнопка ніколи не блокувалась би. */
  const selectedBalance =
    source === null
      ? null
      : (source.type === "safe" ? safes : registers).find((a) => a.id === source.id)?.balance ?? null;
  const hasOverdraft = selectedBalance !== null && amount > selectedBalance;

  return (
    <div className="fixed inset-0 bg-text-primary/40 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-warm-surface border border-warm-border rounded-2xl shadow-xl p-6 relative animate-entry">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <IconClose />
        </button>

        <h3 className="text-base font-semibold text-text-primary mb-2 tracking-tight">Підтвердження оплати закупівлі</h3>
        <p className="text-xs text-text-secondary mb-4">
          Сума до оплати: <span className="font-semibold text-text-primary">{amount.toLocaleString()} грн</span>. Оберіть сейф, з якого будуть списані кошти.
        </p>

        <div className="space-y-3">
          <PaymentSourcePicker
            label="Чим платимо"
            safes={safes}
            registers={spendableRegisters(registers)}
            value={source}
            onChange={setSource}
          />

          {selectedBalance !== null && (
            <div className={`rounded-xl p-3 text-xs border animate-entry ${hasOverdraft ? "bg-rose/5 border-rose/20 text-rose" : "bg-emerald/5 border-emerald/20 text-emerald"}`}>
              {hasOverdraft ? (
                <span>⚠️ Недостатньо коштів (Баланс: {selectedBalance.toLocaleString()} грн)</span>
              ) : (
                <span>Залишок після оплати: {(selectedBalance - amount).toLocaleString()} грн</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-warm-border bg-surface hover:bg-warm-hover text-text-secondary px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={() => source && onConfirm(source)}
            disabled={isPending || hasOverdraft || !source}
            className="rounded-xl bg-emerald hover:bg-emerald/90 text-white px-5 py-2 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
          >
            {isPending ? "Оплата..." : "Підтвердити оплату"}
          </button>
        </div>
      </div>
    </div>
  );
}
