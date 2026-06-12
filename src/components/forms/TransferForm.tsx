"use client";

import { useActionState, useEffect, useState } from "react";
import { createTransfer } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";

interface FinanceItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  kind: "cash_register" | "safe";
}

const initialState = { success: false, error: "" };

export function TransferForm({ 
  cashRegisters, 
  safes, 
  onSuccess 
}: { 
  cashRegisters: Array<{ id: string; name: string; type: string; balance: number }>;
  safes: Array<{ id: string; name: string; type: string; balance: number }>;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createTransfer, initialState);

  const [fromItem, setFromItem] = useState<string>("");
  const [toItem, setToItem] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  // Combine registers and safes for dropdowns
  const items: FinanceItem[] = [
    ...cashRegisters.map(cr => ({ ...cr, kind: "cash_register" as const })),
    ...safes.map(s => ({ ...s, kind: "safe" as const }))
  ];

  const selectedSource = items.find(i => i.id === fromItem);
  const amountNum = parseFloat(amount) || 0;
  const hasOverdraft = selectedSource ? amountNum > selectedSource.balance : false;

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="from_select" className="mb-1.5 block text-xs font-medium text-text-secondary">Джерело (Звідки списуємо)</label>
        <select
          id="from_select"
          required
          value={fromItem}
          onChange={(e) => {
            setFromItem(e.target.value);
            setAmount(""); // Reset amount when changing source
          }}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>Оберіть джерело...</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.kind === "safe" ? "Сейф" : "Каса"} — {item.name} ({item.balance.toLocaleString()} грн)
            </option>
          ))}
        </select>
        {/* Hidden inputs to pass kind to server action */}
        {selectedSource && (
          <input type="hidden" name="from_type" value={selectedSource.kind} />
        )}
        <input type="hidden" name="from_id" value={fromItem} />
      </div>

      <div>
        <label htmlFor="to_select" className="mb-1.5 block text-xs font-medium text-text-secondary">Одержувач (Куди зараховуємо)</label>
        <select
          id="to_select"
          required
          value={toItem}
          onChange={(e) => setToItem(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>Оберіть одержувача...</option>
          {items
            .filter((item) => item.id !== fromItem) // Prevent sending to the same item
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.kind === "safe" ? "Сейф" : "Каса"} — {item.name} ({item.balance.toLocaleString()} грн)
              </option>
            ))}
        </select>
        {/* Hidden inputs to pass kind to server action */}
        {items.find(i => i.id === toItem) && (
          <input type="hidden" name="to_type" value={items.find(i => i.id === toItem)?.kind} />
        )}
        <input type="hidden" name="to_id" value={toItem} />
      </div>

      <Input 
        label="Сума переказу (грн)" 
        name="amount" 
        type="number" 
        min="1" 
        required 
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={hasOverdraft ? `Сума перевищує доступний баланс (${selectedSource?.balance.toLocaleString()} грн)` : undefined}
        placeholder="1000" 
      />

      <div>
        <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-text-secondary">Призначення / Опис (опціонально)</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          placeholder="Напр. Розподіл прибутку, інкасація..."
        />
      </div>

      <button
        type="submit"
        disabled={pending || hasOverdraft || !fromItem || !toItem || !amount}
        className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending ? "Здійснення переказу..." : "Переказати кошти"}
      </button>
    </form>
  );
}
