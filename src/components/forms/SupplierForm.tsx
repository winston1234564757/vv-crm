"use client";

import { useActionState, useEffect } from "react";
import { createSupplier, updateSupplier } from "@/lib/actions/suppliers";
import { Input } from "@/components/ui/Input";

const initialState = { success: false, error: "" };

export function SupplierForm({ onSuccess, supplier }: {
  onSuccess: () => void;
  supplier?: { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null; notes: string | null }
}) {
  const action = supplier ? updateSupplier.bind(null, supplier.id) : createSupplier;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4 p-2">
      {state.error && <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>}
      <Input label="Назва постачальника" name="name" required placeholder="ТОВ &quot;Електроніка&quot;" defaultValue={supplier?.name ?? ""} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Контактна особа" name="contact_person" placeholder="Олександр" defaultValue={supplier?.contact_person ?? ""} />
        <Input label="Телефон" name="phone" placeholder="+380991234567" defaultValue={supplier?.phone ?? ""} />
      </div>
      <Input label="Email" name="email" type="email" placeholder="post@example.com" defaultValue={supplier?.email ?? ""} />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Примітки</label>
        <textarea name="notes" rows={2} defaultValue={supplier?.notes ?? ""} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" placeholder="Умови співпраці, доставка..." />
      </div>
      <button type="submit" disabled={pending} className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50">
        {pending ? "Збереження..." : supplier ? "Зберегти зміни" : "Додати постачальника"}
      </button>
    </form>
  );
}
