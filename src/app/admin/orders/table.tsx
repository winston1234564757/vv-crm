"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { StatusPill } from "@/components/ui/StatusPill";
import { Select } from "@/components/ui/Select";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";
import { IconSearch, IconDownload, IconDelete } from "@/components/icons";
import { orderStatus, optionsOf } from "@/lib/domain-labels";
import { updateOrderStatus, deleteClientOrder } from "@/lib/actions/orders";
import type { ClientOrderWithCustomer } from "@/types/orders";

type ReceiptData = React.ComponentProps<typeof ReceiptPrintModal>["data"];

function toReceipt(o: ClientOrderWithCustomer): ReceiptData {
  return {
    id: o.id,
    created_at: o.created_at,
    order_no: o.order_no,
    public_token: o.public_token,
    customer_name: o.customers?.name || "Клієнт",
    customer_phone: o.customers?.phone,
    order_items: (o.client_order_items ?? []).map((it) => ({
      item_name: it.item_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
    })),
    agreed_price: o.agreed_price,
    deposit: o.deposit,
    deadline: o.deadline,
    order_status: o.status,
  };
}

const money = (n: number) => `${n.toLocaleString("uk-UA")} грн`;

/** Короткий опис позицій замовлення для списку. */
function itemSummary(o: ClientOrderWithCustomer): string {
  const list = o.client_order_items ?? [];
  if (list.length === 0) return "—";
  return list.length > 1 ? `${list[0].item_name} +${list.length - 1}` : list[0].item_name;
}

export function OrdersTable({ orders }: { orders: ClientOrderWithCustomer[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<ClientOrderWithCustomer | null>(null);

  const filtered = orders.filter((o) => {
    if (!q) return true;
    const lq = q.toLowerCase();
    const itemsText = (o.client_order_items ?? []).map((i) => i.item_name).join(" ").toLowerCase();
    return (
      o.order_no.toLowerCase().includes(lq) ||
      itemsText.includes(lq) ||
      (o.customers?.name ?? "").toLowerCase().includes(lq) ||
      (o.customers?.phone ?? "").includes(lq)
    );
  });

  const pager = usePagination(filtered, { resetKey: `${q}` });

  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id);
    const res = await updateOrderStatus(id, status);
    setUpdatingId(null);
    if (!res.success) {
      alert(res.error || "Не вдалося змінити статус");
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Видалити це замовлення?")) return;
    const res = await deleteClientOrder(id);
    if (!res.success) {
      alert(res.error || "Не вдалося видалити");
      return;
    }
    router.refresh();
  }

  const remainingOf = (o: ClientOrderWithCustomer) =>
    Math.max(0, (o.agreed_price ?? 0) - (o.deposit ?? 0));

  return (
    <>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук за номером, товаром або клієнтом..."
          className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
        />
      </div>

      <div className="mt-4">
        {/* Мобільні картки */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">Замовлень немає</p>
          ) : (
            pager.pageItems.map((o) => (
              <div key={o.id} className="rounded-2xl border border-warm-border bg-surface p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-text-secondary">#{o.order_no}</p>
                    <h4 className="font-bold text-sm text-text-primary">{itemSummary(o)}</h4>
                    <p className="text-xs text-text-secondary mt-0.5">{(o.client_order_items ?? []).length} поз.</p>
                  </div>
                  <StatusPill map={orderStatus} value={o.status} />
                </div>

                <div className="flex justify-between border-t border-border pt-2.5 text-xs">
                  <span className="text-text-secondary">{o.customers?.name ?? "—"}</span>
                  <span className="text-text-primary font-medium">
                    {money(o.agreed_price ?? 0)}
                    {(o.deposit ?? 0) > 0 && <span className="text-text-secondary"> · зал. {money(remainingOf(o))}</span>}
                  </span>
                </div>

                <div className="flex items-center gap-2 border-t border-border pt-2.5">
                  <Select
                    inline
                    aria-label="Статус"
                    value={o.status}
                    disabled={updatingId === o.id}
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    options={optionsOf(orderStatus)}
                    className="max-w-none flex-1"
                  />
                  <button
                    onClick={() => setPrintOrder(o)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet/5 text-violet transition-colors hover:bg-violet/10"
                    aria-label="Друк чека"
                  >
                    <IconDownload size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(o.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose/5 text-rose transition-colors hover:bg-rose/10"
                    aria-label="Видалити"
                  >
                    <IconDelete size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Десктопна таблиця */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                <th className="pb-2 pr-4">№</th>
                <th className="pb-2 pr-4">Клієнт</th>
                <th className="pb-2 pr-4">Товар</th>
                <th className="pb-2 pr-4 text-right">Ціна / Залишок</th>
                <th className="pb-2 pr-4">Термін</th>
                <th className="pb-2 pr-4">Статус</th>
                <th className="pb-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-text-secondary">Замовлень немає</td>
                </tr>
              ) : (
                pager.pageItems.map((o) => (
                  <tr key={o.id} className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02]">
                    <td className="py-3 pr-4 font-mono text-xs text-text-secondary">#{o.order_no}</td>
                    <td className="py-3 pr-4">{o.customers?.name ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{itemSummary(o)}</div>
                      <div className="text-xs text-text-secondary">{(o.client_order_items ?? []).length} поз.</div>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="font-medium">{money(o.agreed_price ?? 0)}</div>
                      {(o.deposit ?? 0) > 0 && (
                        <div className="text-xs text-text-secondary">залишок {money(remainingOf(o))}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary text-xs">
                      {o.deadline ? new Date(o.deadline).toLocaleDateString("uk-UA") : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <Select
                        inline
                        aria-label="Статус"
                        value={o.status}
                        disabled={updatingId === o.id}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        options={optionsOf(orderStatus)}
                      />
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPrintOrder(o)}
                          className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet"
                          aria-label="Друк чека"
                        >
                          <IconDownload />
                        </button>
                        <button
                          onClick={() => handleDelete(o.id)}
                          className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"
                          aria-label="Видалити"
                        >
                          <IconDelete />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          start={pager.start}
          shown={pager.pageItems.length}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
          itemLabel="замовлень"
        />
      </div>

      {printOrder && (
        <ReceiptPrintModal
          isOpen={!!printOrder}
          onClose={() => setPrintOrder(null)}
          type="order"
          data={toReceipt(printOrder)}
        />
      )}
    </>
  );
}
