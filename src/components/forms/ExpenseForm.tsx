"use client";

import { useActionState, useEffect, useState } from "react";
import { createExpenseAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";
import {
  PaymentSourcePicker,
  type ChosenSource,
  type SourceAccount,
} from "@/components/ui/PaymentSourcePicker";

interface ExpenseCategory {
  id: string;
  name: string;
  safe_type?: string;
  description: string | null;
}

const initialState = { success: false, error: "" };

export function ExpenseForm({
  expenseCategories,
  registers = [],
  onSuccess,
}: {
  expenseCategories: ExpenseCategory[];
  safes?: unknown[];
  registers?: SourceAccount[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createExpenseAction, initialState);

  const [categoryId, setCategoryId] = useState("");
  const [source, setSource] = useState<ChosenSource | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  // За замовчуванням обираємо перший доступний рахунок (наприклад, Безготівка або перша каса)
  useEffect(() => {
    if (!source && registers.length > 0) {
      const defaultReg = registers.find(r => r.type === "cashless") ?? registers[0];
      if (defaultReg) {
        setSource({
          type: "cash_register",
          id: defaultReg.id,
          method: defaultReg.type === "cashless" ? "cashless" : "cash",
          name: defaultReg.name,
        });
      }
    }
  }, [registers, source]);

  const selectedBalance =
    source === null
      ? null
      : registers.find((a) => a.id === source.id)?.balance ?? null;
  const amountNum = parseFloat(amount) || 0;
  const hasOverdraft = selectedBalance !== null && amountNum > selectedBalance;

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
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <PaymentSourcePicker
        label="Списати з (Готівка або Безготівка)"
        registers={registers}
        legacyName="paid_from_safe_id"
        value={source}
        onChange={setSource}
      />

      <Input
        label="Сума витрати (грн)"
        name="amount"
        type="number"
        min="1"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={hasOverdraft ? `Сума перевищує доступний баланс (${selectedBalance?.toLocaleString()} грн)` : undefined}
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
        disabled={pending || hasOverdraft || !categoryId || !source || !amount}
        className="btn-press mt-4 w-full rounded-xl bg-rose py-3.5 text-sm font-medium text-white transition-colors hover:bg-rose-hover disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Збереження витрати..." : "Додати витрату"}
      </button>
    </form>
  );
}
