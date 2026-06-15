"use client";

import { useState } from "react";
import { IconSearch, IconDelete } from "@/components/icons";
import { deletePurchase, updatePurchaseStatus } from "@/lib/actions/purchases";
import Drawer from "@/components/ui/Drawer";
import { PurchaseDetailView } from "@/components/PurchaseDetailView";
import { InlineError } from "@/components/ui/InlineError";
import { PayPurchaseModal } from "@/components/PayPurchaseModal";

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
}

type PurchaseRow = {
  id: string; supplier_id: string | null; total_amount: number; status: string;
  paid_from_safe_id: string | null; notes: string | null; created_by: string;
  paid_at: string | null; received_at: string | null; created_at: string; updated_at: string;
  suppliers?: { name: string } | null;
  purchase_items?: { id: string; item_type: string; quantity: number; unit_price: number; total_price: number }[];
};

const statusLabels: Record<string, string> = { pending: "Очікується", received: "Отримано", paid: "Оплачено", cancelled: "Скасовано" };
const statusColors: Record<string, string> = { pending: "text-amber bg-amber/10", received: "text-cyan bg-cyan/10", paid: "text-emerald bg-emerald/10", cancelled: "text-rose bg-rose/10" };

export function PurchasesTable({ purchases, safes = [] }: { purchases: PurchaseRow[]; safes?: Safe[] }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);

  const [payPurchaseId, setPayPurchaseId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [isPaying, setIsPaying] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Видалити закупівлю?")) return;
    const res = await deletePurchase(id);
    if (!res.success) setError(res.error ?? "");
  }

  async function handleStatus(id: string, status: string) {
    const res = await updatePurchaseStatus(id, status);
    if (!res.success) setError(res.error ?? "");
  }

  async function handleConfirmPayment(safeId: string) {
    if (!payPurchaseId) return;
    setIsPaying(true);
    const res = await updatePurchaseStatus(payPurchaseId, "paid", safeId);
    setIsPaying(false);
    if (res.success) {
      setPayPurchaseId(null);
    } else {
      setError(res.error ?? "Помилка оплати");
    }
  }

  const filtered = purchases.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (p.suppliers?.name ?? "").toLowerCase().includes(q) || (p.notes ?? "").toLowerCase().includes(q) || p.status.toLowerCase().includes(q);
  });

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />
      <div className="flex items-center max-w-xs relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук закупівлі..." className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
              <th className="pb-2 pr-4">Постачальник</th>
              <th className="pb-2 pr-4">Сума</th>
              <th className="pb-2 pr-4">Статус</th>
              <th className="pb-2 pr-4">Позицій</th>
              <th className="pb-2 pr-4">Примітки</th>
              <th className="pb-2 pr-4">Створено</th>
              <th className="pb-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td></tr>
            ) : (
              filtered.map(p => (
                <tr 
                  key={p.id} 
                  onClick={() => setSelectedPurchase(p)}
                  className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02] cursor-pointer"
                >
                  <td className="py-3 pr-4 font-medium">{p.suppliers?.name || "—"}</td>
                  <td className="py-3 pr-4 font-mono text-sm">{p.total_amount.toLocaleString()} грн</td>
                  <td className="py-3 pr-4 text-xs">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusColors[p.status] || ""}`}>
                      {statusLabels[p.status] || p.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-text-secondary text-xs">{p.purchase_items?.length || 0}</td>
                  <td className="py-3 pr-4 text-xs text-text-secondary truncate max-w-[150px]">{p.notes || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-text-secondary">{new Date(p.created_at).toLocaleDateString("uk-UA")}</td>
                  <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {p.status === "pending" && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleStatus(p.id, "received"); }} className="btn-press rounded-lg bg-cyan/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan transition-colors hover:bg-cyan/20 cursor-pointer">Отримано</button>
                          <button onClick={(e) => { e.stopPropagation(); handleStatus(p.id, "cancelled"); }} className="btn-press rounded-lg bg-rose/10 px-2.5 py-1.5 text-[11px] font-medium text-rose transition-colors hover:bg-rose/20 cursor-pointer">Скасувати</button>
                        </>
                      )}
                      {p.status === "received" && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setPayPurchaseId(p.id); 
                            setPayAmount(p.total_amount);
                          }} 
                          className="btn-press rounded-lg bg-emerald/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald transition-colors hover:bg-emerald/20 cursor-pointer"
                        >
                          Оплачено
                        </button>
                      )}
                      {(p.status === "pending" || p.status === "cancelled") ? (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose cursor-pointer"><IconDelete /></button>
                      ) : (
                        <div className="w-8 h-8" /> /* Займає місце для вирівнювання */
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedPurchase && (
        <Drawer
          isOpen={!!selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          title={`Деталі закупівлі #${selectedPurchase.id.substring(0, 8)}`}
        >
          <PurchaseDetailView
            purchase={selectedPurchase}
            safes={safes}
            onStatusUpdated={() => {
              setSelectedPurchase(null);
            }}
            onClose={() => setSelectedPurchase(null)}
          />
        </Drawer>
      )}

      <PayPurchaseModal
        isOpen={payPurchaseId !== null}
        onClose={() => setPayPurchaseId(null)}
        onConfirm={handleConfirmPayment}
        safes={safes}
        amount={payAmount}
        isPending={isPaying}
      />
    </>
  );
}
