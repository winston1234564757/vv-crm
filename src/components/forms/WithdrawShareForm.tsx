"use client";

import { useActionState, useEffect, useState } from "react";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { withdrawOwnerShareAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";

interface SourceItem {
  id: string;
  name: string;
  balance: number;
}

const initialState = { success: false, error: "" };

/**
 * Джерело завжди одне — сейф «Чистий прибуток». Раніше тут був вибір із кас і
 * сейфів, і частку регулярно брали з каси повз сейф; тоді залишок власника
 * розходився з тим, що в сейфі реально лежить. Селект лишився на випадок
 * кількох сейфів ЧП, але за замовчуванням підставляє єдиний.
 */
export function WithdrawShareForm({
  sources,
  onSuccess,
}: {
  sources: SourceItem[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(withdrawOwnerShareAction, initialState);

  const [sourceId, setSourceId] = useState(sources.length === 1 ? sources[0].id : "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const selectedSource = sources.find((s) => s.id === sourceId);

  const amountNum = parseFloat(amount) || 0;
  const hasOverdraft = selectedSource ? amountNum > selectedSource.balance : false;

  if (sources.length === 0) {
    return (
      <div className="p-5 text-sm text-text-secondary">
        Сейф «Чистий прибуток» не налаштований — частку знімати нема звідки.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose animate-entry">
          {state.error}
        </div>
      )}

      <input type="hidden" name="source_type" value="safe" />
      <input type="hidden" name="source_id" value={sourceId} />

      <div>
        <label htmlFor="source_select" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Джерело — сейф чистого прибутку
        </label>
        <select
          id="source_select"
          required
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>
            Оберіть сейф...
          </option>
          {sources.map((src) => (
            <option key={src.id} value={src.id}>
              🔒 {src.name} ({src.balance.toLocaleString("uk-UA")} грн)
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] text-text-secondary/70">
          Частку беруть тільки звідси. Щоб гроші сюди потрапили — спершу розподіліть касу.
        </p>
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

      <PaymentMethodPicker label="Чим забрано" />

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
        disabled={pending || hasOverdraft || !sourceId || !amount}
        className="btn-press mt-4 w-full rounded-xl bg-emerald py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald/90 disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Збереження..." : "💵 Виплатити частку прибутку"}
      </button>
    </form>
  );
}
