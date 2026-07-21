"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { IconSearch } from "@/components/icons";
import { SaleDetailView } from "@/components/SaleDetailView";
import Drawer from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/utils/cn";
import type { SaleWithDetails } from "@/lib/data-sales";

const paymentMethods: Record<string, string> = {
  cash: "Готівка", card: "Картка", transfer: "Переказ",
};

const selectClass =
  "rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent cursor-pointer";

interface SalesTableProps {
  sales: SaleWithDetails[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  query: string;
  category: string;
  payment: string;
}

export function SalesTable({ sales, total, page, pageSize, pageCount, query, category, payment }: SalesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);

  // Local mirror so typing stays responsive while the server catches up.
  const [draftQuery, setDraftQuery] = useState(query);
  useEffect(() => setDraftQuery(query), [query]);

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || v === "all") p.delete(k);
        else p.set(k, v);
      }
      // Any change to search/filters/page size returns to the first page.
      if (!("page" in patch)) p.delete("page");
      startTransition(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
    },
    [router, pathname, searchParams],
  );

  // Debounce search so each keystroke does not hit the database.
  useEffect(() => {
    if (draftQuery === query) return;
    const t = setTimeout(() => push({ q: draftQuery || null }), 350);
    return () => clearTimeout(t);
  }, [draftQuery, query, push]);

  function summarize(sale: SaleWithDetails) {
    return sale.items.length > 0
      ? sale.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")
      : sale.notes || "Товар / Послуга";
  }

  const empty = sales.length === 0;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><IconSearch size={15} /></span>
          <input
            type="text"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="Пошук за товаром, покупцем..."
            className="w-full rounded-[var(--radius-md)] border border-border bg-surface pl-9 pr-4 py-2 text-base md:text-sm text-ink placeholder-faint outline-none transition-colors focus:border-accent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={category} onChange={(e) => push({ cat: e.target.value })} className={selectClass}>
            <option value="all">Всі категорії</option>
            <option value="device">Техніка</option>
            <option value="accessory">Аксесуари</option>
            <option value="service">Послуги</option>
            <option value="part">Запчастини</option>
          </select>
          <select value={payment} onChange={(e) => push({ pay: e.target.value })} className={selectClass}>
            <option value="all">Всі оплати</option>
            <option value="cash">Готівка</option>
            <option value="card">Картка</option>
            <option value="transfer">Переказ</option>
          </select>
        </div>
      </div>

      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        {/* Мобільний список карток */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {empty ? (
            <p className="py-12 text-center text-sm text-muted">Продажів не знайдено</p>
          ) : (
            sales.map((sale) => {
              const paymentsList = sale.payments.map((p) => paymentMethods[p.method] || p.method).join(" + ");
              return (
                <button
                  key={sale.id}
                  onClick={() => setSelectedSale(sale)}
                  className="card card-hover btn-press p-4 flex flex-col gap-2.5 text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="tabular text-xs text-muted">#{sale.id.substring(0, 8)}</span>
                      <h4 className="font-semibold text-sm text-ink mt-1">{sale.customer_name}</h4>
                    </div>
                    <Badge tone="neutral">{paymentsList || "—"}</Badge>
                  </div>
                  <div className="text-xs text-muted border-t border-border pt-2.5">
                    <span className="text-ink">{summarize(sale)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <span className="text-muted tabular">{format(new Date(sale.created_at), "dd.MM.yyyy HH:mm")}</span>
                    {sale.is_warranty ? (
                      <Badge tone="accent">Гарантія</Badge>
                    ) : (
                      <span className="font-semibold text-sm text-success tabular">{sale.total_amount.toLocaleString()} ₴</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Десктопна таблиця */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="pb-2 pr-4 font-medium">ID</th>
                <th className="pb-2 pr-4 font-medium">Дата</th>
                <th className="pb-2 pr-4 font-medium">Клієнт</th>
                <th className="pb-2 pr-4 font-medium">Товари</th>
                <th className="pb-2 pr-4 font-medium">Метод оплати</th>
                <th className="pb-2 pr-4 font-medium text-right">Сума</th>
              </tr>
            </thead>
            <tbody>
              {empty ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted">Продажів не знайдено</td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const paymentsList = sale.payments.map((p) => paymentMethods[p.method] || p.method).join(" + ");
                  const itemsSummary = summarize(sale);
                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className="border-b border-border text-ink transition-colors hover:bg-hover cursor-pointer"
                    >
                      <td className="py-3 pr-4 tabular text-xs text-muted">{sale.id.substring(0, 8)}</td>
                      <td className="py-3 pr-4 text-xs text-muted tabular">{format(new Date(sale.created_at), "dd.MM.yyyy HH:mm")}</td>
                      <td className="py-3 pr-4 font-medium">{sale.customer_name}</td>
                      <td className="py-3 pr-4 max-w-[240px] truncate text-xs" title={itemsSummary}>{itemsSummary}</td>
                      <td className="py-3 pr-4 text-xs text-muted">{paymentsList || "—"}</td>
                      <td className="py-3 pr-4 text-right font-semibold tabular">
                        {sale.is_warranty ? <Badge tone="accent">Гарантія</Badge> : `${sale.total_amount.toLocaleString()} ₴`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        start={(page - 1) * pageSize}
        shown={sales.length}
        pageSize={pageSize}
        onPageChange={(next) => push({ page: String(next) })}
        onPageSizeChange={(size) => push({ size: String(size) })}
        itemLabel="продажів"
      />

      <Drawer isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title="Деталі продажу" size="half">
        {selectedSale && <SaleDetailView sale={selectedSale} onClose={() => setSelectedSale(null)} />}
      </Drawer>
    </>
  );
}
