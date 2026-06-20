"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { SaleWithDetails } from "@/lib/data-sales";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";

const paymentMethods: Record<string, string> = {
  cash: "Готівка",
  card: "Картка",
  transfer: "Переказ"
};

const itemTypeLabels: Record<SaleWithDetails["items"][number]["item_type"], string> = {
  device: "Техніка",
  accessory: "Аксесуар",
  part: "Запчастина",
  service: "Послуга"
};

type SaleDetailViewProps = {
  sale: SaleWithDetails;
  onClose: () => void;
};

export function SaleDetailView({ sale }: SaleDetailViewProps) {
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const fallbackItems = parseItemsFromNotes(sale.notes);

  function handlePrintReceipt() {
    setIsPrintModalOpen(true);
  }

  return (
    <div className="space-y-6 animate-entry text-xs">
      {/* Top Summary Card */}
      <div className="rounded-2xl bg-violet/5 border border-violet/10 p-5 flex justify-between items-center text-xs">
        <div>
          <p className="text-text-secondary">Номер укладеної угоди</p>
          <p className="text-sm font-mono font-bold text-text-primary mt-1">#{sale.id.substring(0, 8)}</p>
        </div>
        <div className="text-right">
          <p className="text-text-secondary">Сума продажу</p>
          <p className="text-lg font-extrabold text-violet mt-1">{sale.total_amount.toLocaleString()} ₴</p>
        </div>
      </div>

      {/* Bento Grid breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Items Card */}
        <div className="card p-5 space-y-3 md:col-span-2">
          <h4 className="font-semibold text-sm text-text-primary border-b border-warm-border pb-2 font-medium">Список товарів</h4>
          <div className="space-y-2">
            {sale.items.length === 0 ? (
              fallbackItems.length > 0 ? (
                fallbackItems.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 py-2 border-b border-warm-border/40 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary break-words">{item.name}</p>
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        Кількість: {item.quantity} | Ціна за од.: {item.unit_price.toLocaleString()} ₴
                      </p>
                    </div>
                    <span className="font-bold text-text-primary whitespace-nowrap">{item.total_price.toLocaleString()} ₴</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between items-center gap-3 py-1.5">
                  <span className="font-medium text-text-primary break-words">{sale.notes || "Товар / послуга"}</span>
                  <span className="font-bold text-text-primary whitespace-nowrap">{sale.total_amount.toLocaleString()} ₴</span>
                </div>
              )
            ) : (
              sale.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-2 border-b border-warm-border/40 last:border-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-violet/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet">
                        {itemTypeLabels[item.item_type]}
                      </span>
                      <p className="font-medium text-text-primary break-words">{item.name}</p>
                    </div>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      Кількість: {item.quantity} | Ціна за од.: {item.unit_price.toLocaleString()} ₴
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5 font-mono">ID позиції: {item.item_id.substring(0, 8)}</p>
                  </div>
                  <span className="font-bold text-text-primary whitespace-nowrap">{item.total_price.toLocaleString()} ₴</span>
                </div>
              ))
            )}
          </div>
          {sale.discount > 0 && (
            <p className="text-right text-[10px] text-cyan font-bold pt-1">Знижка: {sale.discount}%</p>
          )}
        </div>

        {/* Customer and Seller Card */}
        <div className="card p-5 space-y-3">
          <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 font-medium">Покупець та Продавець</h4>
          <div className="space-y-2">
            <div>
              <p className="text-text-muted font-medium">Клієнт</p>
              <p className="font-semibold mt-0.5 text-text-primary">{sale.customer_name}</p>
              {sale.customer_phone && (
                <a href={`tel:${sale.customer_phone}`} className="text-violet hover:underline block font-mono mt-0.5">
                  {sale.customer_phone}
                </a>
              )}
            </div>
            <div className="border-t border-warm-border/50 pt-2">
              <p className="text-text-muted font-medium">Продавець</p>
              <p className="font-semibold mt-0.5 text-text-primary">{sale.seller_name}</p>
            </div>
          </div>
        </div>

        {/* Finance details */}
        <div className="card p-5 space-y-3">
          <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 font-medium">Каса та Оплата</h4>
          <div className="space-y-2">
            {sale.payments.map((p) => (
              <div key={p.id} className="flex justify-between items-center py-1">
                <div>
                  <p className="font-medium text-text-primary">{paymentMethods[p.method] || p.method}</p>
                  <p className="text-[10px] text-text-secondary">{p.register_name}</p>
                </div>
                <span className="font-bold text-text-primary">{p.amount.toLocaleString()} ₴</span>
              </div>
            ))}
            
            {(sale.partner_id || sale.promo_code_used) && (
              <div className="border-t border-warm-border/50 pt-2 text-[10px]">
                {sale.promo_code_used && <p className="text-cyan font-bold">Промокод: {sale.promo_code_used}</p>}
                {sale.partner_id && <p className="text-text-secondary mt-0.5">Залучено через партнерську мережу</p>}
              </div>
            )}
          </div>
        </div>

        {/* Warranty and Shipping */}
        {(sale.warranty_end || sale.delivery_needed) && (
          <div className="card p-5 space-y-3 md:col-span-2">
            <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 font-medium">Логістика та Гарантія</h4>
            <div className="grid grid-cols-2 gap-4">
              {sale.warranty_end && (
                <div>
                  <p className="text-text-muted font-medium">Гарантійний термін</p>
                  <p className="font-semibold text-text-primary mt-1">
                    до {format(new Date(sale.warranty_end), "dd.MM.yyyy")}
                  </p>
                </div>
              )}
              {sale.delivery_needed && (
                <div>
                  <p className="text-text-muted font-medium">Доставка Новою Поштою</p>
                  <p className="font-semibold text-text-primary mt-1">{sale.delivery_address || "Адреса не вказана"}</p>
                  {sale.delivery_tracking && (
                    <a 
                      href={`https://novaposhta.ua/tracking/?cargo_number=${sale.delivery_tracking}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-violet hover:underline text-[10px] block mt-1 font-bold"
                    >
                      ТТН: {sale.delivery_tracking} ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Print Button */}
      <div className="card p-5 flex justify-between items-center">
        <span className="text-xs text-text-secondary">Роздрукувати квитанцію для клієнта</span>
        <button
          onClick={handlePrintReceipt}
          className="btn-press rounded-xl bg-violet hover:bg-violet-hover text-white px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
        >
          Друкувати чек
        </button>
      </div>

      {/* WYSIWYG Print Modal */}
      <ReceiptPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        type="sale"
        data={{
          id: sale.id,
          created_at: sale.created_at,
          customer_name: sale.customer_name,
          customer_phone: sale.customer_phone || "",
          seller_name: sale.seller_name,
          items: sale.items.length === 0 ? (
            fallbackItems.length > 0 ? fallbackItems : [{
              name: sale.notes || "Товар",
              quantity: 1,
              unit_price: sale.total_amount,
              total_price: sale.total_amount
            }]
          ) : sale.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          })),
          total_amount: sale.total_amount,
          discount: sale.discount,
          warranty_end: sale.warranty_end,
          register_name: sale.payments?.[0]?.register_name || ""
        }}
      />
    </div>
  );
}

function parseItemsFromNotes(notes: string | null) {
  if (!notes?.includes("Позиції:")) return [];

  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const match = line.match(/^- (.+): (\d+) x ([\d.]+) грн = ([\d.]+) грн$/);
      if (!match) return null;

      return {
        name: match[1],
        quantity: Number(match[2]),
        unit_price: Number(match[3]),
        total_price: Number(match[4])
      };
    })
    .filter((item): item is { name: string; quantity: number; unit_price: number; total_price: number } => item !== null);
}
