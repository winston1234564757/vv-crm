"use client";

import { useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { IconSearch } from "@/components/icons";
import { SaleDetailView } from "@/components/SaleDetailView";
import Drawer from "@/components/ui/Drawer";
import type { SaleWithDetails } from "@/lib/data-sales";

const paymentMethods: Record<string, string> = {
  cash: "Готівка",
  card: "Картка",
  transfer: "Переказ"
};

const categoryLabels: Record<string, string> = {
  device: "Техніка",
  accessory: "Аксесуар",
  service: "Послуга"
};

export function SalesTable({ sales }: { sales: SaleWithDetails[] }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);

  // Filter Sales
  const filtered = sales.filter((s) => {
    // Search filter (customer name, notes, item names, sale ID)
    const q = query.toLowerCase();
    const matchesSearch = !q || 
      s.customer_name.toLowerCase().includes(q) || 
      (s.notes && s.notes.toLowerCase().includes(q)) || 
      s.id.toLowerCase().includes(q) ||
      s.items.some(item => item.name.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // Category filter
    if (categoryFilter !== "all") {
      const hasCategory = s.items.some(item => item.item_type === categoryFilter);
      // Fallback check if category is set via notes description (e.g. services)
      const matchesNotes = categoryFilter === "service" && s.notes?.toLowerCase().includes("послуга");
      if (!hasCategory && !matchesNotes) return false;
    }

    // Payment method filter
    if (paymentFilter !== "all") {
      const hasPaymentMethod = s.payments.some(p => p.method === paymentFilter);
      if (!hasPaymentMethod) return false;
    }

    return true;
  });

  return (
    <>
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch size={15} /></span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук за товаром, покупцем..."
            className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
          />
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          {/* Category Filters */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-warm-border bg-warm-surface px-3 py-2 text-text-primary outline-none focus:border-violet/40 cursor-pointer"
          >
            <option value="all">Всі категорії</option>
            <option value="device">Техніка</option>
            <option value="accessory">Аксесуари</option>
            <option value="service">Послуги</option>
          </select>

          {/* Payment Method Filters */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-xl border border-warm-border bg-warm-surface px-3 py-2 text-text-primary outline-none focus:border-violet/40 cursor-pointer"
          >
            <option value="all">Всі оплати</option>
            <option value="cash">Готівка</option>
            <option value="card">Картка</option>
            <option value="transfer">Переказ</option>
          </select>
        </div>
      </div>

      {/* Sales Table list */}
      <div>
        {/* Мобільний список карток */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">Продажів не знайдено</p>
          ) : (
            filtered.map((sale) => {
              const date = new Date(sale.created_at);
              const formattedDate = format(date, "dd.MM.yyyy HH:mm");
              const paymentsList = sale.payments.map(p => paymentMethods[p.method] || p.method).join(" + ");
              const itemsSummary = sale.items.length > 0 
                ? sale.items.map(i => `${i.name} (x${i.quantity})`).join(", ")
                : sale.notes || "Товар / Послуга";

              return (
                <div
                  key={sale.id}
                  onClick={() => setSelectedSale(sale)}
                  className="rounded-2xl border border-warm-border p-4 bg-white shadow-sm flex flex-col gap-2.5 transition-colors hover:border-slate-300 cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-800">#{sale.id.substring(0, 8)}</span>
                      <h4 className="font-bold text-sm text-text-primary mt-1">{sale.customer_name}</h4>
                    </div>
                    <span className="text-[11px] text-text-secondary font-mono bg-warm-sidebar px-2 py-0.5 rounded">
                      {paymentsList || "—"}
                    </span>
                  </div>

                  <div className="text-xs text-text-secondary border-t border-slate-100/60 pt-2.5">
                    <span className="font-medium text-text-primary">{itemsSummary}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100/60 pt-2.5 text-xs">
                    <span className="text-[10px] text-text-muted">{formattedDate}</span>
                    <span className="font-bold text-sm text-emerald-600">{sale.is_warranty ? <span className="text-violet flex items-center gap-1"><span className="text-[10px]">🛡️</span> Гарантія</span> : `${sale.total_amount.toLocaleString()} ₴`}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Десктопна таблиця */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Дата</th>
                <th className="pb-2 pr-4">Клієнт</th>
                <th className="pb-2 pr-4">Товари</th>
                <th className="pb-2 pr-4">Метод оплати</th>
                <th className="pb-2 pr-4 text-right">Сума</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-text-secondary">Продажів не знайдено</td>
                </tr>
              ) : (
                filtered.map((sale) => {
                  const date = new Date(sale.created_at);
                  const formattedDate = format(date, "dd.MM.yyyy HH:mm");
                  const paymentsList = sale.payments.map(p => paymentMethods[p.method] || p.method).join(" + ");
                  const itemsSummary = sale.items.length > 0 
                    ? sale.items.map(i => `${i.name} (x${i.quantity})`).join(", ")
                    : sale.notes || "Товар / Послуга";

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02] cursor-pointer"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-text-secondary">{sale.id.substring(0, 8)}</td>
                      <td className="py-3 pr-4 text-xs text-text-secondary">{formattedDate}</td>
                      <td className="py-3 pr-4 font-medium">{sale.customer_name}</td>
                      <td className="py-3 pr-4 max-w-[240px] truncate text-xs" title={itemsSummary}>{itemsSummary}</td>
                      <td className="py-3 pr-4 text-xs text-text-secondary">{paymentsList || "—"}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                        {sale.is_warranty ? <span className="inline-flex items-center gap-1 rounded bg-violet/10 px-2 py-0.5 text-[10px] font-bold text-violet">🛡️ Гарантія</span> : `${sale.total_amount.toLocaleString()} ₴`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Drawer */}
      <Drawer
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title="Деталі продажу"
        size="half"
      >
        {selectedSale && (
          <SaleDetailView sale={selectedSale} onClose={() => setSelectedSale(null)} />
        )}
      </Drawer>
    </>
  );
}
