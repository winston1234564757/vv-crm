"use client";

import { useActionState, useEffect } from "react";
import { createAccessory, updateAccessory } from "@/lib/actions/inventory";
import { Input } from "@/components/ui/Input";

const initialState = { success: false, error: "" };

import type { Database } from "@/types/database";

type Safe = Database["public"]["Tables"]["safes"]["Row"];

export function AccessoryForm({ 
  onSuccess, 
  accessory,
  safes = []
}: { 
  onSuccess: () => void; 
  accessory?: { id: string; type: string; name: string; price: number; cost_price: number; stock: number; warranty_months?: number; description: string | null; is_visible: boolean; source?: string; barcode?: string | null; warehouse_location?: string | null };
  safes?: Safe[];
}) {
  const action = accessory ? updateAccessory.bind(null, accessory.id) : createAccessory;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="fixed bottom-5 right-5 z-[9999] max-w-sm rounded-xl border border-rose/30 bg-warm-surface p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3">
            <span className="text-rose text-base mt-0.5">⚠️</span>
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">{state.error}</p>
              {state.error.toLowerCase().includes("недостатньо коштів") && (
                <div className="pt-1">
                  <a
                    href="/admin/finance"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-hover cursor-pointer"
                  >
                    Перейти до фінансів ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
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

      <div className="grid grid-cols-2 gap-4">
        <Input label="Кількість на складі" name="stock" type="number" required placeholder="10" defaultValue={accessory?.stock.toString() ?? "1"} />
        <Input label="Гарантія (міс)" name="warranty_months" type="number" required placeholder="6" defaultValue={accessory?.warranty_months?.toString() ?? "6"} />
      </div>

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

        {!accessory && safes.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Списати з сейфу</label>
              <select
                name="safe_id"
                required
                defaultValue={safes.find(s => s.type === "opex")?.id ?? safes[0]?.id ?? ""}
                className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
              >
                {safes.map((safe) => (
                  <option key={safe.id} value={safe.id}>
                    {safe.name} ({safe.balance.toLocaleString()} грн)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
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
