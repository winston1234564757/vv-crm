"use client";

import { useActionState, useEffect } from "react";
import { createPart, updatePart } from "@/lib/actions/parts";
import { Input } from "@/components/ui/Input";
import type { Database } from "@/types/database";

type PartRow = Database['public']['Tables']['parts']['Row'];

const initialState = { success: false, error: "" };

export function PartForm({ 
  onSuccess, 
  part, 
  suppliers,
  safes = []
}: {
  onSuccess: () => void;
  part?: PartRow;
  suppliers: { id: string; name: string }[];
  safes?: Database["public"]["Tables"]["safes"]["Row"][];
}) {
  const action = part ? updatePart.bind(null, part.id) : createPart;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4 p-2">
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
      <Input label="Назва деталі" name="name" required placeholder="Display iPhone 13" defaultValue={part?.name ?? ""} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Part Number" name="part_number" placeholder="LP134-1" defaultValue={part?.part_number ?? ""} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Тип</label>
          <select name="type" required defaultValue={part?.type ?? "screen"} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer">
            <option value="screen">Екран</option>
            <option value="battery">Акумулятор</option>
            <option value="charging_port">Порт зарядки</option>
            <option value="cable">Шлейф</option>
            <option value="button">Кнопка</option>
            <option value="camera">Камера</option>
            <option value="speaker">Динамік</option>
            <option value="other">Інше</option>
          </select>
        </div>
      </div>
      <Input label="Сумісність (моделі)" name="compatible_with" placeholder="iPhone 13, 14, 15..." defaultValue={part?.compatible_with ?? ""} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Собівартість (грн)" name="cost_price" type="number" required placeholder="500" defaultValue={part?.cost_price.toString() ?? ""} />
        <Input label="Ціна продажу (грн)" name="price" type="number" placeholder="800" defaultValue={part?.price?.toString() ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="На складі (шт)" name="stock" type="number" required placeholder="5" defaultValue={part?.stock.toString() ?? "0"} />
        <Input label="Мін. залишок" name="min_stock" type="number" placeholder="3" defaultValue={part?.min_stock.toString() ?? "3"} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Постачальник</label>
          <select name="supplier_id" defaultValue={part?.supplier_id ?? ""} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer">
            <option value="">Не вказано</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Походження деталі</label>
          <select name="origin_type" defaultValue={part?.origin_type ?? ""} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer">
            <option value="">Не вказано</option>
            <option value="Copy">Copy</option>
            <option value="HC">HC</option>
            <option value="Brand Copy">Brand Copy</option>
            <option value="OEM">OEM</option>
          </select>
        </div>
      </div>

      {!part && safes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <Input label="ТТН Нової Пошти" name="np_ttn" placeholder="20450799384635" defaultValue={part?.np_ttn ?? ""} />
      <button type="submit" disabled={pending} className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer">
        {pending ? "Збереження..." : part ? "Зберегти зміни" : "Додати деталь"}
      </button>
    </form>
  );
}
