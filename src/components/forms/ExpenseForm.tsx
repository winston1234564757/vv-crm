"use client";

import { useActionState, useEffect, useState } from "react";
import { createExpenseAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import {
  PaymentSourcePicker,
  spendableRegisters,
  type ChosenSource,
  type SourceAccount,
} from "@/components/ui/PaymentSourcePicker";

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
  registers = [],
  onSuccess,
}: {
  expenseCategories: ExpenseCategory[];
  safes: Safe[];
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

  // Auto-select correct safe type based on category safe_type setting
  useEffect(() => {
    if (categoryId) {
      const cat = expenseCategories.find(c => c.id === categoryId);
      if (cat) {
        /* Категорія підказує сейф — але лише поки користувач не обрав джерело
           сам. Інакше вибір «Безготівка» стирався б на кожну зміну категорії. */
        const matchingSafe = safes.find(s => s.type === cat.safe_type);
        if (matchingSafe) {
          setSource((cur) =>
            cur === null ? { type: "safe", id: matchingSafe.id, method: null, name: matchingSafe.name } : cur,
          );
        }
      }
    }
  }, [categoryId, expenseCategories, safes]);

  /* Баланс шукаємо і серед сейфів, і серед кас: підказка про перевищення
     мусить знати про обидва види джерел, інакше витрата з рахунку показувала б
     «баланс невідомий» і кнопка ніколи не блокувалась би. */
  const selectedBalance =
    source === null
      ? null
      : (source.type === "safe" ? safes : registers).find((a) => a.id === source.id)?.balance ?? null;
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
              {cat.name} ({cat.safe_type === "opex" ? "OPEX" : "Growth"})
            </option>
          ))}
        </select>
      </div>

      {/* Сейф АБО рахунок. Сейф чистого прибутку виключений як і раніше:
          вилучення частки — це Переказ, а не Витрата. */}
      <PaymentSourcePicker
        label="Списати з"
        safes={safes}
        registers={spendableRegisters(registers)}
        excludeSafeTypes={["net_profit"]}
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

      {/* Спосіб оплати питаємо лише для сейфа: у нього дві половини, і треба
          сказати, з якої брати. У каси половин немає — її природа і є спосіб,
          тому питання зникає замість того, щоб дозволити хибну відповідь. */}
      {source?.type === "safe" && <PaymentMethodPicker />}

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
