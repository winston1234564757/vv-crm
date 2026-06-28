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

interface Safe {
  id: string;
  name: string;
  balance: number;
}

type PaymentType = "transit" | "on_receipt" | "prepaid";

const paymentOptions: { value: PaymentType; label: string; desc: string; icon: string }[] = [
  {
    value: "transit",
    label: "В дорозі",
    desc: "Товар ще не отриманий. Гроші не списуються.",
    icon: "🚚",
  },
  {
    value: "on_receipt",
    label: "Оплата при отриманні",
    desc: "Гроші спишуться коли підтвердите отримання.",
    icon: "📦",
  },
  {
    value: "prepaid",
    label: "Передплата зараз",
    desc: "Гроші списуються одразу з обраного сейфу.",
    icon: "💳",
  },
];

export function PurchaseForm({
  onSuccess,
  safes = [],
}: {
  onSuccess: () => void;
  safes?: Safe[];
}) {
  const [state, formAction, pending] = useActionState(createPurchase, initialState);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [paymentType, setPaymentType] = useState<PaymentType>("transit");
  const [prepaidSafeId, setPrepaidSafeId] = useState<string>(safes[0]?.id ?? "");

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

      {/* Позиції закупівлі */}
      <div className="rounded-xl bg-violet/5 p-4 border border-violet/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary tracking-tight">Позиції закупівлі</h3>
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

      {/* Тип оплати */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Тип оплати</label>
        <input type="hidden" name="payment_type" value={paymentType} />
        <div className="grid grid-cols-1 gap-2">
          {paymentOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPaymentType(opt.value)}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                paymentType === opt.value
                  ? "border-violet bg-violet/5 shadow-sm"
                  : "border-warm-border bg-warm-surface hover:border-iris/40"
              }`}
            >
              <span className="text-xl leading-none mt-0.5">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${paymentType === opt.value ? "text-violet" : "text-text-primary"}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-text-secondary mt-0.5 leading-snug">{opt.desc}</p>
              </div>
              <div className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                paymentType === opt.value ? "border-violet" : "border-iris/30"
              }`}>
                {paymentType === opt.value && <div className="h-2 w-2 rounded-full bg-violet" />}
              </div>
            </button>
          ))}
        </div>

        {/* Вибір сейфу при передплаті */}
        {paymentType === "prepaid" && (
          <div className="mt-3 rounded-xl border border-violet/20 bg-violet/5 p-3.5">
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Списати з сейфу
            </label>
            {safes.length === 0 ? (
              <p className="text-xs text-rose">Немає доступних сейфів</p>
            ) : (
              <>
                <select
                  value={prepaidSafeId}
                  onChange={(e) => setPrepaidSafeId(e.target.value)}
                  className="w-full rounded-lg border border-violet/30 bg-white px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-violet cursor-pointer"
                >
                  {safes.map((safe) => (
                    <option key={safe.id} value={safe.id}>
                      {safe.name} — {safe.balance.toLocaleString()} грн
                    </option>
                  ))}
                </select>
                {totalCalculated > 0 && prepaidSafeId && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Буде списано:{" "}
                    <span className={`font-bold ${(safes.find(s => s.id === prepaidSafeId)?.balance ?? 0) < totalCalculated ? "text-rose" : "text-emerald"}`}>
                      {totalCalculated.toLocaleString()} грн
                    </span>
                    {" "}/ залишиться:{" "}
                    <span className="font-semibold text-text-primary">
                      {((safes.find(s => s.id === prepaidSafeId)?.balance ?? 0) - totalCalculated).toLocaleString()} грн
                    </span>
                  </p>
                )}
              </>
            )}
            <input type="hidden" name="prepaid_safe_id" value={prepaidSafeId} />
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Примітки</label>
        <textarea name="notes" rows={2} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" placeholder="Опис закупівлі, умови..." />
      </div>

      <button
        type="submit"
        disabled={pending || items.length === 0 || (paymentType === "prepaid" && !prepaidSafeId)}
        className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending
          ? "Створення..."
          : paymentType === "prepaid"
          ? `💳 Створити та списати ${totalCalculated.toLocaleString()} грн`
          : "Створити закупівлю"}
      </button>
    </form>
  );
}
