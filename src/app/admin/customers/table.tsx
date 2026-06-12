"use client";

import { useState } from "react";
import { IconSearch, IconEdit, IconDelete } from "@/components/icons";
import { deleteCustomer } from "@/lib/actions/customers";
import Drawer from "@/components/ui/Drawer";
import { CustomerForm } from "@/components/forms/CustomerForm";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vip_status: string | null;
  source: string | null;
  preferred_contact: string | null;
  tags: string[] | null;
  total_visits: number;
  total_spent: number;
  created_at: string;
  discount_percent: number;
  notes: string | null;
  telegram_id: string | null;
};

interface SaleItem {
  id: string;
  name: string;
  quantity: number;
  total_price: number;
}

interface SaleHistoryItem {
  id: string;
  customer_id: string | null;
  total_amount: number;
  discount: number;
  created_at: string;
  items: SaleItem[];
}

interface RepairHistoryItem {
  id: string;
  customer_id: string;
  device_name: string;
  issue: string;
  status: string;
  price: number;
  created_at: string;
}

const vipLabels: Record<string, string> = { regular: "Звичайний", silver: "Срібний", gold: "Золотий", platinum: "Платінум" };
const vipColors: Record<string, string> = { regular: "text-text-secondary bg-iris/5", silver: "text-slate-600 bg-slate-100", gold: "text-amber bg-amber/10", platinum: "text-cyan bg-cyan/10" };

const statusLabels: Record<string, string> = {
  received: "Прийнято", diagnostics: "Діагностика", in_progress: "В роботі",
  awaiting_parts: "Чекає деталі", ready: "Готовий", completed: "Виконано", handed_over: "Видано", cancelled: "Скасовано",
};

export function CustomersTable({
  customers,
  sales,
  repairs
}: {
  customers: CustomerRow[];
  sales: SaleHistoryItem[];
  repairs: RepairHistoryItem[];
}) {
  const [q, setQ] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = customers.filter((c) => {
    if (!q) return true;
    const lq = q.toLowerCase();
    return c.name.toLowerCase().includes(lq) || c.phone.includes(lq);
  });

  const getClientSales = (customerId: string) => sales.filter(s => s.customer_id === customerId);
  const getClientRepairs = (customerId: string) => repairs.filter(r => r.customer_id === customerId);

  async function handleDelete(id: string) {
    if (!confirm("Видалити цього клієнта?")) return;
    await deleteCustomer(id);
    setDeletingId(null);
  }

  return (
    <>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук за ім'ям або телефоном..."
          className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
              <th className="pb-2 pr-4">Ім'я</th>
              <th className="pb-2 pr-4">Телефон</th>
              <th className="pb-2 pr-4 text-left text-xs font-medium text-text-secondary">VIP</th>
              <th className="pb-2 pr-4 text-right">Візитів</th>
              <th className="pb-2 pr-4 text-right">Витрачено</th>
              <th className="pb-2 pr-4 text-right">Дата</th>
              <th className="pb-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02] cursor-pointer"
                >
                  <td className="py-3 pr-4 font-medium">
                    <div className="flex items-center gap-2">
                      {c.name}
                      {c.discount_percent > 0 && (
                        <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan">-{c.discount_percent}%</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-text-secondary font-mono text-xs">{c.phone}</td>
                  <td className="py-3 pr-4 text-xs">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${(c.vip_status && vipColors[c.vip_status]) || ""}`}>
                      {c.vip_status ? (vipLabels[c.vip_status] || c.vip_status) : "—"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">{c.total_visits}</td>
                  <td className="py-3 pr-4 text-right font-medium">{c.total_spent.toLocaleString()} грн</td>
                  <td className="py-3 pr-4 text-right text-text-secondary text-xs">{c.created_at.split("T")[0]}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setEditingCustomer(c)}
                        className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet"
                      >
                        <IconEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"
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

      {/* Detail Drawer */}
      {selectedCustomer && (
        <Drawer
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={`Клієнт: ${selectedCustomer.name}`}
          size="default"
        >
          <div className="space-y-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 rounded-2xl bg-violet/5 border border-violet/10 p-5">
              <div>
                <p className="text-xs text-text-secondary font-medium">Телефон</p>
                <p className="mt-1 text-sm font-semibold text-text-primary font-mono">{selectedCustomer.phone}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary font-medium">Постійна знижка</p>
                <p className="mt-1 text-sm font-semibold text-cyan">
                  {selectedCustomer.discount_percent > 0 ? `${selectedCustomer.discount_percent}%` : "Відсутня"}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary font-medium">Telegram</p>
                <p className="mt-1 text-sm text-text-primary">{selectedCustomer.telegram_id || "—"}</p>
              </div>
              {selectedCustomer.email && (
                <div>
                  <p className="text-xs text-text-secondary font-medium">Email</p>
                  <p className="mt-1 text-sm text-text-primary">{selectedCustomer.email}</p>
                </div>
              )}
              {selectedCustomer.notes && (
                <div className="md:col-span-3 border-t border-warm-border pt-3">
                  <p className="text-xs text-text-secondary font-medium">Примітки</p>
                  <p className="mt-1 text-sm text-text-primary">{selectedCustomer.notes}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary border-b border-iris/10 pb-2">Історія покупок</h3>
                <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2">
                  {getClientSales(selectedCustomer.id).length === 0 ? (
                    <p className="text-xs text-text-secondary py-4">Ще немає покупок</p>
                  ) : (
                    getClientSales(selectedCustomer.id).map((sale) => (
                      <div key={sale.id} className="rounded-xl border border-warm-border/60 bg-white p-3.5 space-y-2 text-xs">
                        <div className="flex justify-between items-center text-text-secondary">
                          <span>{sale.created_at.split("T")[0]} {sale.created_at.split("T")[1]?.substring(0, 5)}</span>
                          <span className="font-semibold text-violet">{sale.total_amount.toLocaleString()} грн</span>
                        </div>
                        <div className="space-y-1">
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-text-primary">
                              <span>{item.name} <span className="text-text-secondary font-normal">x{item.quantity}</span></span>
                              <span>{item.total_price.toLocaleString()} грн</span>
                            </div>
                          ))}
                        </div>
                        {sale.discount > 0 && <div className="text-right text-[10px] text-cyan font-medium">Знижка клієнта: {sale.discount}%</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary border-b border-iris/10 pb-2">Історія ремонтів</h3>
                <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2">
                  {getClientRepairs(selectedCustomer.id).length === 0 ? (
                    <p className="text-xs text-text-secondary py-4">Ще немає ремонтів</p>
                  ) : (
                    getClientRepairs(selectedCustomer.id).map((rep) => (
                      <div key={rep.id} className="rounded-xl border border-warm-border/60 bg-white p-3.5 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-text-primary">{rep.device_name}</span>
                          <span className="font-semibold text-text-primary">{rep.price.toLocaleString()} грн</span>
                        </div>
                        <p className="text-text-secondary text-[11px]"><strong className="text-text-primary">Проблема:</strong> {rep.issue}</p>
                        <div className="flex justify-between items-center pt-2 text-[10px] text-text-secondary">
                          <span>Прийнято: {rep.created_at.split("T")[0]}</span>
                          <span className="font-semibold bg-violet/5 px-2 py-0.5 rounded text-violet">{statusLabels[rep.status] || rep.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* Edit Drawer */}
      <Drawer isOpen={!!editingCustomer} onClose={() => setEditingCustomer(null)} title="Редагувати клієнта">
        {editingCustomer && (
          <CustomerForm onSuccess={() => setEditingCustomer(null)} customer={editingCustomer} />
        )}
      </Drawer>
    </>
  );
}
