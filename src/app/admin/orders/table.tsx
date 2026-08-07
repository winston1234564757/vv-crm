"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { StatusPill } from "@/components/ui/StatusPill";
import { Select } from "@/components/ui/Select";
import Drawer from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";
import { IconSearch, IconDownload, IconDelete, IconSale } from "@/components/icons";
import { orderStatus, orderItemType, optionsOf, labelOf } from "@/lib/domain-labels";
import { updateOrderStatus, deleteClientOrder } from "@/lib/actions/orders";
import type { ClientOrderWithCustomer, OrderStatus } from "@/types/orders";

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
  const [detailOrder, setDetailOrder] = useState<ClientOrderWithCustomer | null>(null);

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

  /* Продаж проводиться рівно один раз: `sale_id` — це і зв'язок із чеком, і
     замок. Скасоване замовлення видавати нічого. */
  const canSell = (o: ClientOrderWithCustomer) => !o.sale_id && o.status !== "cancelled";

  async function handleDetailStatus(status: string) {
    if (!detailOrder) return;
    await handleStatusChange(detailOrder.id, status);
    setDetailOrder({ ...detailOrder, status: status as OrderStatus });
  }

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
              <div
                key={o.id}
                onClick={() => setDetailOrder(o)}
                className="cursor-pointer rounded-2xl border border-warm-border bg-surface p-4 shadow-sm space-y-3 transition-colors hover:border-border-strong"
              >
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

                <div
                  className="flex items-center gap-2 border-t border-border pt-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Select
                    inline
                    aria-label="Статус"
                    value={o.status}
                    disabled={updatingId === o.id}
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    options={optionsOf(orderStatus)}
                    className="max-w-none flex-1"
                  />
                  {canSell(o) && (
                    <button
                      onClick={() => router.push(`/admin/sales/pos?order=${o.id}`)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald/5 text-emerald transition-colors hover:bg-emerald/10"
                      aria-label="Провести продаж"
                    >
                      <IconSale size={15} />
                    </button>
                  )}
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
                  <tr
                    key={o.id}
                    onClick={() => setDetailOrder(o)}
                    className="cursor-pointer border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02]"
                  >
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
                    <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                      <Select
                        inline
                        aria-label="Статус"
                        value={o.status}
                        disabled={updatingId === o.id}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        options={optionsOf(orderStatus)}
                      />
                    </td>
                    <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canSell(o) && (
                          <button
                            onClick={() => router.push(`/admin/sales/pos?order=${o.id}`)}
                            className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-emerald/5 hover:text-emerald"
                            aria-label="Провести продаж"
                            title="Провести продаж"
                          >
                            <IconSale />
                          </button>
                        )}
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

      {detailOrder && (
        <Drawer
          isOpen={!!detailOrder}
          onClose={() => setDetailOrder(null)}
          title={`Замовлення #${detailOrder.order_no}`}
          size="half"
        >
          <div className="space-y-6 p-1">
            {/* Клієнт + статус */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-text-secondary">Клієнт</p>
                <p className="font-semibold text-text-primary">{detailOrder.customers?.name ?? "—"}</p>
                {detailOrder.customers?.phone && (
                  <a href={`tel:${detailOrder.customers.phone}`} className="font-mono text-sm text-violet hover:underline">
                    {detailOrder.customers.phone}
                  </a>
                )}
              </div>
              <StatusPill map={orderStatus} value={detailOrder.status} />
            </div>

            {/* Зміна статусу */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-secondary">Статус замовлення</p>
              <Select
                aria-label="Статус"
                value={detailOrder.status}
                disabled={updatingId === detailOrder.id}
                onChange={(e) => handleDetailStatus(e.target.value)}
                options={optionsOf(orderStatus)}
              />
            </div>

            {/* Позиції */}
            <div>
              <p className="mb-2 text-xs font-medium text-text-secondary">
                Товари ({(detailOrder.client_order_items ?? []).length})
              </p>
              <div className="space-y-2">
                {(detailOrder.client_order_items ?? []).map((it) => (
                  <div key={it.id} className="rounded-xl border border-warm-border/60 p-3">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-text-primary">{it.item_name}</span>
                      <span className="whitespace-nowrap font-medium text-text-primary">{money(it.unit_price * it.quantity)}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-xs text-text-secondary">
                      <span>{labelOf(orderItemType, it.item_type).label} · {money(it.unit_price)} × {it.quantity}</span>
                      {it.item_url && (
                        <a href={it.item_url} target="_blank" rel="noreferrer" className="shrink-0 text-violet hover:underline">
                          Посилання
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Підсумки */}
            <div className="space-y-1.5 rounded-xl border border-warm-border/60 bg-warm-bg/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Підсумок</span>
                <span className="font-medium">{money(detailOrder.agreed_price ?? 0)}</span>
              </div>
              {(detailOrder.deposit ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Аванс</span>
                  <span className="font-medium text-success">− {money(detailOrder.deposit ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-warm-border/60 pt-1.5">
                <span className="font-medium">Залишок</span>
                <span className="font-semibold">{money(remainingOf(detailOrder))}</span>
              </div>
            </div>

            {/* Деталі */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-text-secondary">Термін</p>
                <p className="text-text-primary">
                  {detailOrder.deadline ? new Date(detailOrder.deadline).toLocaleDateString("uk-UA") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Створено</p>
                <p className="text-text-primary">{new Date(detailOrder.created_at).toLocaleDateString("uk-UA")}</p>
              </div>
              {detailOrder.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-text-secondary">Нотатки</p>
                  <p className="text-text-primary">{detailOrder.notes}</p>
                </div>
              )}
            </div>

            {/* Дії */}
            <div className="flex flex-wrap items-center gap-2 border-t border-warm-border pt-4">
              {canSell(detailOrder) ? (
                <Button
                  leadingIcon={<IconSale />}
                  onClick={() => router.push(`/admin/sales/pos?order=${detailOrder.id}`)}
                >
                  Провести продаж
                </Button>
              ) : detailOrder.sale_id ? (
                <span className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-success/10 px-4 text-sm font-medium text-success">
                  Продаж проведено
                </span>
              ) : null}
              <Button variant="secondary" leadingIcon={<IconDownload />} onClick={() => setPrintOrder(detailOrder)}>
                Друк чека
              </Button>
              <a
                href={`/track/${detailOrder.public_token}`}
                target="_blank"
                rel="noreferrer"
                className="btn-press inline-flex h-10 items-center rounded-[var(--radius-md)] border border-border-strong px-4 text-sm font-medium text-ink transition-colors hover:bg-hover"
              >
                Сторінка статусу
              </a>
              <Button
                variant="danger"
                leadingIcon={<IconDelete />}
                className="ml-auto"
                onClick={async () => {
                  await handleDelete(detailOrder.id);
                  setDetailOrder(null);
                }}
              >
                Видалити
              </Button>
            </div>
          </div>
        </Drawer>
      )}

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
