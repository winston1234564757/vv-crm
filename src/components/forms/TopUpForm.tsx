"use client";

import { useActionState, useEffect, useState } from "react";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { topUpSafeAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
}

const initialState = { success: false, error: "" };

export function TopUpForm({ 
  safes, 
  onSuccess 
}: { 
  safes: Safe[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(topUpSafeAction, initialState);

  const [safeId, setSafeId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="safe_select" className="mb-1.5 block text-xs font-medium text-text-secondary">Сейф одержувач (Куди вносимо)</label>
        <select
          id="safe_select"
          required
          value={safeId}
          onChange={(e) => setSafeId(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>Оберіть сейф...</option>
          {safes.map((safe) => (
            <option key={safe.id} value={safe.id}>
              Сейф {safe.name} ({safe.balance.toLocaleString()} грн)
            </option>
          ))}
        </select>
        <input type="hidden" name="safe_id" value={safeId} />
      </div>

      <Input 
        label="Сума поповнення (грн)" 
        name="amount" 
        type="number" 
        min="1" 
        required 
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="1000" 
      />

      <PaymentMethodPicker label="Чим поповнено" />

      <div>
        <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-text-secondary">Джерело / Призначення (опціонально)</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          placeholder="Напр. Особисті заощадження власника, стартовий капітал..."
        />
      </div>

      <button
        type="submit"
        disabled={pending || !safeId || !amount}
        className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending ? "Внесення коштів..." : "Внести кошти в сейф"}
      </button>
    </form>
  );
}
