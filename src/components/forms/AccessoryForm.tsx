"use client";

import { useActionState, useEffect } from "react";
import { createAccessory, updateAccessory } from "@/lib/actions/inventory";
import { Input } from "@/components/ui/Input";

const initialState = { success: false, error: "" };

export function AccessoryForm({ onSuccess, accessory }: { onSuccess: () => void; accessory?: { id: string; type: string; name: string; price: number; cost_price: number; stock: number; description: string | null; is_visible: boolean; source?: string; barcode?: string | null; warehouse_location?: string | null } }) {
  const action = accessory ? updateAccessory.bind(null, accessory.id) : createAccessory;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>
      )}

      <div className="w-full">
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Категорія</label>
        <select
          name="type"
          required
          defaultValue={accessory?.type ?? "case"}
          className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40"
        >
          <option value="case">Чохол</option>
          <option value="charger">Зарядний пристрій</option>
          <option value="cable">Кабель</option>
          <option value="headphones">Навушники</option>
          <option value="screen_protector">Захисне скло / плівка</option>
          <option value="other">Інше</option>
        </select>
      </div>

      <Input label="Назва аксесуару" name="name" required placeholder="Чохол Silicone Case iPhone 15" defaultValue={accessory?.name ?? ""} />

      <div className="grid grid-cols-2 gap-4">
        <Input label="Собівартість (грн)" name="cost_price" type="number" required placeholder="300" defaultValue={accessory?.cost_price.toString() ?? ""} />
        <Input label="Ціна продажу (грн)" name="price" type="number" required placeholder="600" defaultValue={accessory?.price.toString() ?? ""} />
      </div>

      <Input label="Кількість на складі" name="stock" type="number" required placeholder="10" defaultValue={accessory?.stock.toString() ?? "1"} />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Опис (опціонально)</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={accessory?.description ?? ""}
          placeholder="Короткий опис для вітрини..."
          className="w-full resize-none rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" name="is_visible" value="true" defaultChecked={accessory?.is_visible ?? false} className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet" />
        <span className="text-sm font-medium text-text-primary">Показувати на вітрині</span>
      </label>

      <div className="border-t border-warm-border/50 pt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Джерело</label>
            <select name="source" defaultValue={accessory?.source ?? "supplier"} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40">
              <option value="supplier">Постачальник</option>
              <option value="trade_in">Trade-In</option>
              <option value="buyout">Викуп</option>
              <option value="olx">OLX</option>
              <option value="other">Інше</option>
            </select>
          </div>
          <Input label="Штрих-код (EAN)" name="barcode" placeholder="4820000000000" defaultValue={accessory?.barcode ?? ""} />
          <Input label="Розташування на складі" name="warehouse_location" placeholder="Стелаж Б, полиця 1" defaultValue={accessory?.warehouse_location ?? ""} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-press mt-4 w-full rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending ? "Збереження..." : accessory ? "Зберегти зміни" : "Додати аксесуар"}
      </button>
    </form>
  );
}
