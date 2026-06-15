"use client";

import { useActionState, useEffect, useState } from "react";
import { createPurchase } from "@/lib/actions/purchases";
import { Input } from "@/components/ui/Input";
import { IconPlus, IconDelete } from "@/components/icons";

const initialState = { success: false, error: "" };

interface PurchaseItem {
  id: string; // temp id for ui
  item_type: "device" | "accessory" | "part" | "service";
  item_name: string;
  quantity: number;
  unit_price: number;
}

export function PurchaseForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createPurchase, initialState);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), item_type: "part", item_name: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof PurchaseItem, value: string | number) => {
    setItems(items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const totalCalculated = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <form action={formAction} className="space-y-5 p-2">
      {state.error && <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>}
      
      <div className="rounded-xl bg-violet/5 p-4 border border-violet/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Позиції закупівлі</h3>
          <button type="button" onClick={addItem} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-violet transition-colors hover:bg-violet/10 border border-violet/20">
            <IconPlus size={14} /> Додати позицію
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-4 border border-dashed border-iris/20 rounded-xl">Немає жодної позиції. Додайте хоча б одну.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="relative rounded-xl border border-iris/20 bg-white p-3 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Позиція #{index + 1}</span>
                  <button type="button" onClick={() => removeItem(item.id)} className="text-rose hover:text-rose-hover transition-colors">
                    <IconDelete size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">Тип товару</label>
                    <select value={item.item_type} onChange={(e) => updateItem(item.id, "item_type", e.target.value)} className="w-full rounded-lg border border-iris/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-violet cursor-pointer">
                      <option value="part">Запчастина</option>
                      <option value="device">Техніка</option>
                      <option value="accessory">Аксесуар</option>
                      <option value="service">Послуга</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">Назва товару</label>
                    <input type="text" required value={item.item_name} onChange={(e) => updateItem(item.id, "item_name", e.target.value)} placeholder="Напр. Дисплей iPhone 13" className="w-full rounded-lg border border-iris/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-violet" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">Кількість</label>
                    <input type="number" min="1" required value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-iris/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-violet" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">Ціна за 1 од. (грн)</label>
                    <input type="number" min="0" required value={item.unit_price} onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-iris/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-violet" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="grid grid-cols-2 gap-4 items-end">
        <Input label="Загальна сума (введена вручну)" name="total_amount" type="number" required defaultValue={totalCalculated > 0 ? totalCalculated.toString() : "0"} />
        <div className="pb-2">
          <p className="text-xs text-text-secondary">Підраховано по позиціях:</p>
          <p className="text-sm font-semibold text-violet">{totalCalculated} грн</p>
        </div>
      </div>
      
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Примітки</label>
        <textarea name="notes" rows={2} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" placeholder="Опис закупівлі, умови..." />
      </div>
      
      <button type="submit" disabled={pending || items.length === 0} className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50">
        {pending ? "Створення..." : "Створити закупівлю"}
      </button>
    </form>
  );
}
