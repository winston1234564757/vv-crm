"use client";

import { useActionState, useEffect, useState } from "react";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import {
  PaymentSourcePicker,
  spendableRegisters,
  type ChosenSource,
  type SourceAccount,
} from "@/components/ui/PaymentSourcePicker";
import { createPart, updatePart } from "@/lib/actions/parts";
import { Input } from "@/components/ui/Input";
import type { Database } from "@/types/database";

type PartRow = Database['public']['Tables']['parts']['Row'];

const initialState = { success: false, error: "" };

export function PartForm({
  onSuccess,
  part,
  suppliers,
  safes = [],
  registers = []
}: {
  onSuccess: () => void;
  part?: PartRow;
  suppliers: { id: string; name: string }[];
  safes?: Database["public"]["Tables"]["safes"]["Row"][];
  /** Каси як джерело оплати. Пікер лишить із них лише безготівкові. */
  registers?: SourceAccount[];
}) {
  const action = part ? updatePart.bind(null, part.id) : createPart;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [source, setSource] = useState<ChosenSource | null>(null);
  const [status, setStatus] = useState<"in_stock" | "transit">(
    (part?.status as "in_stock" | "transit") ?? "in_stock"
  );
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "deferred">("paid");
  const [defaultDueDate] = useState(() => {
    return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  });

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  const isTransit = status === "transit";
  const isCreating = !part;

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
      
      {/* Status selector — only when creating */}
      {isCreating && (
        <div>
          <label className="mb-2 block text-xs font-medium text-text-secondary">Де знаходиться деталь?</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus("in_stock")}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                !isTransit
                  ? "border-emerald/60 bg-emerald/5 text-emerald"
                  : "border-warm-border bg-warm-surface text-text-secondary hover:border-border-strong"
              }`}
            >
              <span>📦</span>
              <span>На складі</span>
            </button>
            <button
              type="button"
              onClick={() => setStatus("transit")}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                isTransit
                  ? "border-amber/60 bg-amber/5 text-amber"
                  : "border-warm-border bg-warm-surface text-text-secondary hover:border-border-strong"
              }`}
            >
              <span>🚚</span>
              <span>В дорозі</span>
            </button>
          </div>
          <input type="hidden" name="status" value={status} />
          {isTransit && (
            <p className="mt-2 text-[11px] text-amber bg-amber/5 rounded-lg px-3 py-2 border border-amber/20">
              Гроші з сейфу НЕ списуються. Прийомка на склад — після отримання посилки.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input label="Собівартість (грн)" name="cost_price" type="number" required placeholder="500" defaultValue={part?.cost_price.toString() ?? ""} />
        <Input label="Ціна продажу (грн)" name="price" type="number" placeholder="800" defaultValue={part?.price?.toString() ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Hide stock input for transit parts (server forces stock=0) */}
        {!isTransit && (
          <Input label="На складі (шт)" name="stock" type="number" required placeholder="5" defaultValue={part?.stock.toString() ?? "0"} />
        )}
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

      {/* Safe deduction / Deferred payment — only when in_stock (not transit) and creating */}
      {isCreating && !isTransit && (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-text-secondary">Спосіб оплати</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentStatus("paid")}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                paymentStatus === "paid"
                  ? "border-violet bg-violet/5 text-violet"
                  : "border-warm-border bg-warm-surface text-text-secondary hover:border-border-strong"
              }`}
            >
              <span>💳</span>
              <span>Оплатити зараз</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentStatus("deferred")}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                paymentStatus === "deferred"
                  ? "border-rose bg-rose/5 text-rose"
                  : "border-warm-border bg-warm-surface text-text-secondary hover:border-border-strong"
              }`}
            >
              <span>📅</span>
              <span>Відкладена оплата</span>
            </button>
          </div>
          <input type="hidden" name="payment_status" value={paymentStatus} />

          {paymentStatus === "paid" && safes.length > 0 && (
            <div>
              <PaymentSourcePicker
                label="Списати з"
                safes={safes}
                registers={spendableRegisters(registers)}
                legacyName="safe_id"
                value={source}
                onChange={setSource}
              />
              {/* Половини має лише сейф — у каси спосіб оплати це вона сама. */}
              {source?.type === "safe" && (
                <div className="mt-3">
                  <PaymentMethodPicker />
                </div>
              )}
            </div>
          )}

          {paymentStatus === "deferred" && (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">Дата оплати постачальнику</label>
              <input
                type="date"
                name="payment_due_date"
                required
                defaultValue={defaultDueDate}
                className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-2.5 text-sm text-text-primary outline-none focus:border-violet/40"
              />
            </div>
          )}
        </div>
      )}

      {/* When editing a deferred payment part, allow editing the due date */}
      {!isCreating && part?.payment_status === "deferred" && (
        <div className="rounded-xl border border-rose/20 bg-rose/[0.01] p-3 space-y-2">
          <div className="flex justify-between text-xs text-text-secondary">
            <span>Статус оплати:</span>
            <span className="font-semibold text-rose uppercase tracking-wider text-[10px]">Відкладена оплата</span>
          </div>
          <div className="flex justify-between text-xs text-text-secondary">
            <span>Сума боргу:</span>
            <span className="font-bold text-text-primary">{part.debt_amount?.toLocaleString() || 0} ₴</span>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">Дата оплати постачальнику</label>
            <input
              type="date"
              name="payment_due_date"
              defaultValue={part.payment_due_date ? part.payment_due_date.split('T')[0] : ""}
              className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-2.5 text-sm text-text-primary outline-none focus:border-violet/40"
            />
          </div>
        </div>
      )}

      {!isCreating && part?.payment_status === "paid" && (
        <div className="rounded-xl border border-emerald/20 bg-emerald/[0.01] p-3 flex justify-between text-xs text-text-secondary">
          <span>Статус оплати:</span>
          <span className="font-semibold text-emerald uppercase tracking-wider text-[10px]">Оплачено</span>
        </div>
      )}

      <Input label="ТТН Нової Пошти" name="np_ttn" placeholder="20450799384635" defaultValue={part?.np_ttn ?? ""} />
      <button type="submit" disabled={pending} className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer">
        {pending ? "Збереження..." : part ? "Зберегти зміни" : isTransit ? "Додати деталь (в дорозі 🚚)" : "Додати деталь"}
      </button>
    </form>
  );
}
