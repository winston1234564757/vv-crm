"use client";

import { 
  IconCheck, IconWarning, IconFinance, IconBox, IconTruck 
} from "./icons";
import { updatePurchaseStatus } from "@/lib/actions/purchases";
import { useState } from "react";
import { PayPurchaseModal } from "@/components/PayPurchaseModal";

interface PurchaseItem {
  id: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
}

type PurchaseDetailViewProps = {
  purchase: {
    id: string;
    supplier_id: string | null;
    total_amount: number;
    status: string;
    paid_from_safe_id: string | null;
    notes: string | null;
    created_by: string;
    paid_at: string | null;
    received_at: string | null;
    created_at: string;
    updated_at: string;
    suppliers?: { name: string } | null;
    purchase_items?: PurchaseItem[];
  };
  safes?: Safe[];
  onStatusUpdated?: () => void;
  onClose: () => void;
};

const statusLabels: Record<string, string> = { 
  pending: "Очікується", 
  received: "Отримано на склад", 
  paid: "Оплачено постачальнику", 
  cancelled: "Скасовано" 
};

const statusColors: Record<string, string> = { 
  pending: "var(--color-amber)", 
  received: "var(--color-cyan)", 
  paid: "var(--color-emerald)", 
  cancelled: "var(--color-rose)" 
};

const typeLabels: Record<string, string> = {
  device: "Техніка",
  accessory: "Аксесуар",
  part: "Запчастина",
  service: "Послуга"
};

export function PurchaseDetailView({ purchase, safes = [], onStatusUpdated, onClose }: PurchaseDetailViewProps) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  async function handleStatus(status: string) {
    setError("");
    setPending(true);
    const res = await updatePurchaseStatus(purchase.id, status);
    setPending(false);
    if (res.success) {
      if (onStatusUpdated) onStatusUpdated();
    } else {
      setError(res.error ?? "Сталася помилка");
    }
  }

  async function handleConfirmPayment(safeId: string) {
    setError("");
    setPending(true);
    const res = await updatePurchaseStatus(purchase.id, "paid", safeId);
    setPending(false);
    if (res.success) {
      setIsPayModalOpen(false);
      if (onStatusUpdated) onStatusUpdated();
    } else {
      setError(res.error ?? "Сталася помилка при оплаті");
    }
  }

  // Спробуємо розпарсити назви з приміток, якщо вони там є (як ми записуємо їх у createPurchase)
  const itemsWithNames = (purchase.purchase_items || []).map((item, idx) => {
    // Шукаємо в примітках відповідні назви
    let name = `${typeLabels[item.item_type] || item.item_type} #${idx + 1}`;
    if (purchase.notes) {
      // Спробуємо знайти підрядок "Позиції:" або аналогічний
      const partsIndex = purchase.notes.indexOf("Позиції:");
      if (partsIndex !== -1) {
        const partsText = purchase.notes.substring(partsIndex + 8).trim();
        const itemsArr = partsText.split(", ");
        if (itemsArr[idx]) {
          // Формат: "device: iPhone 12 (1 шт по 12000 грн)" -> витягнемо саму назву
          const cleanName = itemsArr[idx].replace(/^[a-z]+:\s*/i, "").replace(/\s*\(\d+\s*шт.*/i, "");
          if (cleanName) name = cleanName;
        }
      }
    }
    return { ...item, name };
  });

  return (
    <div className="space-y-6 p-4">
      {error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {error}
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-warm-surface border border-warm-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">#{purchase.id.substring(0, 8)}</span>
            <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  style={{ 
                    background: `color-mix(in oklch, ${statusColors[purchase.status] || 'var(--color-iris)'} 15%, transparent)`, 
                    color: statusColors[purchase.status] 
                  }}>
              {statusLabels[purchase.status] || purchase.status}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-text-primary">
            Закупівля від {purchase.suppliers?.name || "Постачальник не вказаний"}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Створено: {new Date(purchase.created_at).toLocaleDateString("uk-UA")} о {new Date(purchase.created_at).toLocaleTimeString("uk-UA", {hour: '2-digit', minute:'2-digit'})}
          </p>
        </div>
        <div className="flex gap-2">
          {purchase.status === "pending" && (
            <>
              <button
                onClick={() => handleStatus("received")}
                disabled={pending}
                className="btn-press flex items-center gap-1.5 rounded-xl bg-cyan hover:bg-cyan-hover text-white px-4 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <IconCheck size={14} /> Отримано
              </button>
              <button
                onClick={() => handleStatus("cancelled")}
                disabled={pending}
                className="btn-press flex items-center gap-1.5 rounded-xl bg-rose hover:bg-rose-hover text-white px-4 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Скасувати
              </button>
            </>
          )}
          {purchase.status === "received" && (
            <button
              onClick={() => setIsPayModalOpen(true)}
              disabled={pending}
              className="btn-press flex items-center gap-1.5 rounded-xl bg-emerald hover:bg-emerald-hover text-white px-4 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <IconFinance size={14} /> Сплатити
            </button>
          )}
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        {/* Financial Info */}
        <div className="card p-5 space-y-4 border border-violet/5">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Фінансові реквізити</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-text-muted">Загальна сума закупівлі</p>
              <p className="mt-1 text-lg font-bold text-violet">
                {purchase.total_amount.toLocaleString()} ₴
              </p>
            </div>
            <div>
              <p className="text-text-muted">Оплачено з сейфу</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {purchase.paid_from_safe_id ? "Так (оплачено)" : "Ні (в борг / очікує)"}
              </p>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="card p-5 space-y-4 border border-violet/5">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconTruck size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Транзит та логістика</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {purchase.received_at && (
              <div>
                <p className="text-text-muted">Отримано на склад</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {new Date(purchase.received_at).toLocaleDateString("uk-UA")}
                </p>
              </div>
            )}
            {purchase.paid_at && (
              <div>
                <p className="text-text-muted">Дата оплати</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {new Date(purchase.paid_at).toLocaleDateString("uk-UA")}
                </p>
              </div>
            )}
            {!purchase.received_at && !purchase.paid_at && (
              <div className="col-span-2">
                <p className="text-text-muted">Статус транзиту</p>
                <p className="mt-1 text-sm font-semibold text-text-primary flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber animate-pulse"></span>
                  Замовлення очікує доставки на склад
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Purchase Items List */}
        <div className="card p-5 space-y-4 md:col-span-2 border border-violet/10">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Позиції закупівлі</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-warm-border text-xs font-semibold text-text-secondary">
                  <th className="pb-2">Товар</th>
                  <th className="pb-2">Тип</th>
                  <th className="pb-2 text-right">Кількість</th>
                  <th className="pb-2 text-right">Ціна за од.</th>
                  <th className="pb-2 text-right">Загальна вартість</th>
                </tr>
              </thead>
              <tbody>
                {itemsWithNames.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-muted italic">Товари не вказані</td>
                  </tr>
                ) : (
                  itemsWithNames.map((item) => (
                    <tr key={item.id} className="border-b border-warm-border/40 last:border-0 text-text-primary">
                      <td className="py-2.5 font-medium">{item.name}</td>
                      <td className="py-2.5 text-text-secondary">{typeLabels[item.item_type] || item.item_type}</td>
                      <td className="py-2.5 text-right font-mono font-medium">{item.quantity} шт.</td>
                      <td className="py-2.5 text-right font-mono">{item.unit_price.toLocaleString()} ₴</td>
                      <td className="py-2.5 text-right font-mono font-bold text-violet">{item.total_price.toLocaleString()} ₴</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes info */}
        {purchase.notes && (
          <div className="card p-5 space-y-3 md:col-span-2">
            <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2">Деталі та внутрішні примітки</h4>
            <p className="text-text-primary leading-relaxed bg-warm-bg p-3 rounded-lg whitespace-pre-line">{purchase.notes}</p>
          </div>
        )}
      </div>

      <PayPurchaseModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        onConfirm={handleConfirmPayment}
        safes={safes}
        amount={purchase.total_amount}
        isPending={pending}
      />
    </div>
  );
}
