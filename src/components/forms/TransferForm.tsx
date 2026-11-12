"use client";

import { useActionState, useEffect, useState } from "react";
import { createTransfer } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";

interface CashRegister {
  id: string;
  name: string;
  type: string;
  balance: number;
}

const initialState = { success: false, error: "" };

export function TransferForm({ 
  cashRegisters, 
  onSuccess 
}: { 
  cashRegisters: CashRegister[];
  safes?: unknown[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createTransfer, initialState);

  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const selectedSource = cashRegisters.find((cr) => cr.id === fromId);
  const selectedTarget = cashRegisters.find((cr) => cr.id === toId);

  const availableBalance = selectedSource?.balance ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const hasOverdraft = selectedSource ? amountNum > availableBalance : false;

  const paymentMethod = selectedSource?.type === "cashless" ? "cashless" : "cash";

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose animate-entry">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="from_select" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Джерело (Звідки списуємо)
        </label>
        <select
          id="from_select"
          required
          value={fromId}
          onChange={(e) => {
            setFromId(e.target.value);
            setAmount("");
          }}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>Оберіть джерело...</option>
          {cashRegisters.map((cr) => {
            const isCard = cr.type === "cashless";
            return (
              <option key={cr.id} value={cr.id}>
                {isCard ? "💳 Безготівка" : "💵 Готівка"} · {cr.name} ({cr.balance.toLocaleString()} грн)
              </option>
            );
          })}
        </select>
        <input type="hidden" name="from_type" value="cash_register" />
        <input type="hidden" name="from_id" value={fromId} />
        <input type="hidden" name="payment_method" value={paymentMethod} />
      </div>

      <div>
        <label htmlFor="to_select" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Одержувач (Куди зараховуємо)
        </label>
        <select
          id="to_select"
          required
          value={toId}
          onChange={(e) => setToId(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>Оберіть одержувача...</option>
          {cashRegisters
            .filter((cr) => cr.id !== fromId)
            .map((cr) => {
              const isCard = cr.type === "cashless";
              return (
                <option key={cr.id} value={cr.id}>
                  {isCard ? "💳 Безготівка" : "💵 Готівка"} · {cr.name} ({cr.balance.toLocaleString()} грн)
                </option>
              );
            })}
        </select>
        <input type="hidden" name="to_type" value="cash_register" />
        <input type="hidden" name="to_id" value={toId} />
      </div>

      <div>
        <Input
          label={selectedSource ? `Сума переказу (доступно: ${availableBalance.toLocaleString()} грн)` : "Сума переказу (грн)"}
          name="amount"
          type="number"
          min="1"
          max={availableBalance}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={hasOverdraft ? `Сума перевищує доступний залишок (${availableBalance.toLocaleString()} грн)` : undefined}
          placeholder="1000"
        />
        {selectedSource && !hasOverdraft && amountNum > 0 && (
          <p className="mt-1 text-[11px] text-text-secondary">
            Залишок після переказу: <span className="font-semibold text-text-primary">{(availableBalance - amountNum).toLocaleString()} грн</span>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="transfer_desc" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Призначення / Коментар (опціонально)
        </label>
        <textarea
          id="transfer_desc"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Наприклад: Зняття готівки в касу / Інкасація на розрахунковий рахунок..."
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
        />
      </div>

      <button
        type="submit"
        disabled={pending || hasOverdraft || !fromId || !toId || amountNum <= 0}
        className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Виконання переказу..." : "Переказати кошти"}
      </button>
    </form>
  );
}