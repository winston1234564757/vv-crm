"use client";

import { useActionState, useEffect } from "react";
import { createPurchase } from "@/lib/actions/purchases";
import { Input } from "@/components/ui/Input";

const initialState = { success: false, error: "" };

export function PurchaseForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createPurchase, initialState);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4 p-2">
      {state.error && <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Постачальник (ID)</label>
        <input name="supplier_id" type="text" placeholder="ID постачальника або залиште порожнім" className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
        <p className="mt-1 text-xs text-text-secondary">Поки що введіть ID вручну. Скоро буде випадаючий список.</p>
      </div>
      <Input label="Загальна сума" name="total_amount" type="number" required defaultValue="0" />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Примітки</label>
        <textarea name="notes" rows={2} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" placeholder="Опис закупівлі, умови..." />
      </div>
      <div className="border-t border-warm-border/50 pt-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Позиції (JSON)</h3>
        <textarea name="items" rows={4} defaultValue='[{"item_type":"parts","item_id":"","quantity":1,"unit_price":0}]' className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 font-mono" />
        <p className="mt-1 text-xs text-text-secondary">Формат: масив об'єктів з item_type, item_id, quantity, unit_price</p>
      </div>
      <button type="submit" disabled={pending} className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50">
        {pending ? "Створення..." : "Створити закупівлю"}
      </button>
    </form>
  );
}
