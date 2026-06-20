"use client";

import { useActionState, useEffect, useState } from "react";
import { createExpenseAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";

interface ExpenseCategory {
  id: string;
  name: string;
  safe_type: string;
  description: string | null;
}

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
}

const initialState = { success: false, error: "" };

export function ExpenseForm({
  expenseCategories,
  safes,
  onSuccess,
}: {
  expenseCategories: ExpenseCategory[];
  safes: Safe[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createExpenseAction, initialState);

  const [categoryId, setCategoryId] = useState("");
  const [paidFromSafeId, setPaidFromSafeId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  // Auto-select correct safe type based on category safe_type setting
  useEffect(() => {
    if (categoryId) {
      const cat = expenseCategories.find(c => c.id === categoryId);
      if (cat) {
        const matchingSafe = safes.find(s => s.type === cat.safe_type);
        if (matchingSafe) {
          setPaidFromSafeId(matchingSafe.id);
        }
      }
    }
  }, [categoryId, expenseCategories, safes]);

  const selectedSafe = safes.find(s => s.id === paidFromSafeId);
  const amountNum = parseFloat(amount) || 0;
  const hasOverdraft = selectedSafe ? amountNum > selectedSafe.balance : false;

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose animate-entry">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="category_select" className="mb-1.5 block text-xs font-medium text-text-secondary">Категорія витрати</label>
        <select
          id="category_select"
          name="category_id"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>Оберіть категорію...</option>
          {expenseCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.safe_type === "opex" ? "OPEX" : "Growth"})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="safe_select" className="mb-1.5 block text-xs font-medium text-text-secondary">Списати з сейфу</label>
        <select
          id="safe_select"
          name="paid_from_safe_id"
          required
          value={paidFromSafeId}
          onChange={(e) => setPaidFromSafeId(e.target.value)}
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

      <Input
        label="Сума витрати (грн)"
        name="amount"
        type="number"
        min="1"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={hasOverdraft ? `Сума перевищує доступний баланс сейфу (${selectedSafe?.balance.toLocaleString()} грн)` : undefined}
        placeholder="1000"
      />

      <div>
        <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-text-secondary">Коментар / Деталі (опціонально)</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          placeholder="Наприклад: Оплата за інтернет за червень..."
        />
      </div>

      <button
        type="submit"
        disabled={pending || hasOverdraft || !categoryId || !paidFromSafeId || !amount}
        className="btn-press mt-4 w-full rounded-xl bg-rose py-3.5 text-sm font-medium text-white transition-colors hover:bg-rose-hover disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Збереження витрати..." : "Додати витрату"}
      </button>
    </form>
  );
}
