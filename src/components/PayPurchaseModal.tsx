"use client";

import { useState } from "react";
import { IconClose } from "@/components/icons";

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
  amount,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (safeId: string) => void;
  safes: Safe[];
  amount: number;
  isPending: boolean;
}) {
  const [selectedSafeId, setSelectedSafeId] = useState("");

  if (!isOpen) return null;

  const selectedSafe = safes.find(s => s.id === selectedSafeId);
  const hasOverdraft = selectedSafe ? amount > selectedSafe.balance : false;

  return (
    <div className="fixed inset-0 bg-text-primary/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-warm-surface border border-warm-border rounded-2xl shadow-xl p-6 relative animate-entry">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <IconClose />
        </button>

        <h3 className="text-base font-semibold text-text-primary mb-2">Підтвердження оплати закупівлі</h3>
        <p className="text-xs text-text-secondary mb-4">
          Сума до оплати: <span className="font-semibold text-text-primary">{amount.toLocaleString()} грн</span>. Оберіть сейф, з якого будуть списані кошти.
        </p>

        <div className="space-y-3">
          <div>
            <label htmlFor="safe_payment_select" className="mb-1.5 block text-xs font-medium text-text-secondary">Сейф для оплати</label>
            <select
              id="safe_payment_select"
              required
              value={selectedSafeId}
              onChange={(e) => setSelectedSafeId(e.target.value)}
              className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
            >
              <option value="" disabled>Оберіть сейф...</option>
              {safes.map((safe) => (
                <option key={safe.id} value={safe.id}>
                  {safe.name} ({safe.balance.toLocaleString()} грн)
                </option>
              ))}
            </select>
          </div>

          {selectedSafe && (
            <div className={`rounded-xl p-3 text-xs border animate-entry ${hasOverdraft ? "bg-rose/5 border-rose/20 text-rose" : "bg-emerald/5 border-emerald/20 text-emerald"}`}>
              {hasOverdraft ? (
                <span>⚠️ Недостатньо коштів на цьому сейфі (Баланс: {selectedSafe.balance.toLocaleString()} грн)</span>
              ) : (
                <span>Залишок після оплати: {(selectedSafe.balance - amount).toLocaleString()} грн</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-warm-border bg-white hover:bg-warm-hover text-text-secondary px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={() => onConfirm(selectedSafeId)}
            disabled={isPending || hasOverdraft || !selectedSafeId}
            className="rounded-xl bg-emerald hover:bg-emerald/90 text-white px-5 py-2 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
          >
            {isPending ? "Оплата..." : "Підтвердити оплату"}
          </button>
        </div>
      </div>
    </div>
  );
}
