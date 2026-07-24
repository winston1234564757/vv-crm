"use client";

import { useActionState, useEffect, useState } from "react";
import { withdrawOwnerShareAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";

interface SourceItem {
  id: string;
  name: string;
  type: "safe" | "cash_register";
  balance: number;
}

const initialState = { success: false, error: "" };

export function WithdrawShareForm({
  sources,
  onSuccess,
}: {
  sources: SourceItem[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(withdrawOwnerShareAction, initialState);

  const [selectedKey, setSelectedKey] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const [sourceType, sourceId] = selectedKey ? selectedKey.split(":") : ["", ""];
  const selectedSource = sources.find((s) => s.id === sourceId && s.type === sourceType);

  const amountNum = parseFloat(amount) || 0;
  const hasOverdraft = selectedSource ? amountNum > selectedSource.balance : false;

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose animate-entry">
          {state.error}
        </div>
      )}

      <input type="hidden" name="source_type" value={sourceType} />
      <input type="hidden" name="source_id" value={sourceId} />

      <div>
        <label htmlFor="source_select" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Джерело (Сейф або Каса)
        </label>
        <select
          id="source_select"
          required
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>
            Оберіть джерело вилучення...
          </option>
          {sources.map((src) => (
            <option key={`${src.type}:${src.id}`} value={`${src.type}:${src.id}`}>
              {src.type === "safe" ? "🔒 Сейф" : "💵 Каса"}: {src.name} ({src.balance.toLocaleString("uk-UA")} грн)
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Сума вилучення частки (грн)"
        name="amount"
        type="number"
        min="1"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={
          hasOverdraft
            ? `Сума перевищує доступний баланс джерела (${selectedSource?.balance.toLocaleString("uk-UA")} грн)`
            : undefined
        }
        placeholder="600"
      />

      <div>
        <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Коментар / Примітка (опціонально)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          placeholder="Наприклад: Вилучення частки прибутку за липень..."
        />
      </div>

      <button
        type="submit"
        disabled={pending || hasOverdraft || !selectedKey || !amount}
        className="btn-press mt-4 w-full rounded-xl bg-emerald py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald/90 disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Збереження..." : "💵 Виплатити частку прибутку"}
      </button>
    </form>
  );
}
