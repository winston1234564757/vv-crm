"use client";

import { useState } from "react";
import { IconSearch, IconEdit, IconDelete } from "@/components/icons";
import { deleteSupplier } from "@/lib/actions/suppliers";
import Drawer from "@/components/ui/Drawer";
import { SupplierForm } from "@/components/forms/SupplierForm";
import { SupplierDetailView } from "@/components/SupplierDetailView";
import { InlineError } from "@/components/ui/InlineError";

type SupplierRow = { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null; notes: string | null };

export function SuppliersTable({ 
  suppliers, 
  purchases = [] 
}: { 
  suppliers: SupplierRow[]; 
  purchases?: Parameters<typeof SupplierDetailView>[0]["purchases"];
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(id: string) {
    if (!confirm("Видалити постачальника?")) return;
    const res = await deleteSupplier(id);
    if (!res.success) setError(res.error ?? "");
  }

  const filtered = suppliers.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.contact_person ?? "").toLowerCase().includes(q) || (s.phone ?? "").includes(q);
  });

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />
      <div className="flex items-center max-w-xs relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук постачальника..." className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
      </div>
      <div className="mt-4">
        {/* Мобільні картки постачальників */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</p>
          ) : (
            filtered.map((s) => {
              return (
                <div
                  key={s.id}
                  onClick={() => { setSelectedSupplier(s); setIsEditingProfile(false); }}
                  className="rounded-2xl border border-warm-border p-4 bg-surface shadow-sm flex flex-col gap-2.5 transition-colors hover:border-border-strong cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-text-primary">{s.name}</h4>
                      {s.contact_person && (
                        <p className="text-xs text-text-secondary mt-0.5">{s.contact_person}</p>
                      )}
                    </div>
                  </div>

                  {(s.phone || s.email) && (
                    <div className="text-xs text-text-secondary flex flex-col gap-1 border-t border-border pt-2.5">
                      {s.phone && (
                        <div className="flex justify-between">
                          <span>Телефон:</span>
                          <span className="text-text-primary font-medium">{s.phone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex justify-between">
                          <span>Email:</span>
                          <span className="text-text-primary font-medium">{s.email}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {s.notes && (
                    <div className="text-xs text-text-secondary border-t border-border pt-2.5">
                      <p className="font-medium text-text-primary mb-0.5">Примітки:</p>
                      <p className="line-clamp-2 text-xxs font-mono leading-relaxed bg-warm-surface p-2 rounded-lg border border-warm-border/60">{s.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 border-t border-border pt-2.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setSelectedSupplier(s); setIsEditingProfile(true); }}
                      className="flex h-8 px-2.5 items-center justify-center rounded-xl bg-violet/5 hover:bg-violet/10 text-violet text-xs font-semibold gap-1 transition-colors cursor-pointer"
                    >
                      <IconEdit size={14} />
                      <span>Редагувати</span>
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose/5 hover:bg-rose/10 text-rose transition-colors cursor-pointer"
                    >
                      <IconDelete size={14} />
                    </button>
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
                <th className="pb-2 pr-4">Назва</th>
                <th className="pb-2 pr-4">Контакт</th>
                <th className="pb-2 pr-4">Телефон</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4 max-w-[200px]">Примітки</th>
                <th className="pb-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td></tr>
              ) : (
                filtered.map(s => (
                  <tr 
                    key={s.id} 
                    onClick={() => { setSelectedSupplier(s); setIsEditingProfile(false); }}
                    className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02] cursor-pointer"
                  >
                    <td className="py-3 pr-4 font-medium">{s.name}</td>
                    <td className="py-3 pr-4 text-text-secondary">{s.contact_person || "—"}</td>
                    <td className="py-3 pr-4 text-text-secondary">{s.phone || "—"}</td>
                    <td className="py-3 pr-4 text-text-secondary">{s.email || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary truncate max-w-[200px]">{s.notes || "—"}</td>
                    <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelectedSupplier(s); setIsEditingProfile(true); }} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet"><IconEdit /></button>
                        <button onClick={() => handleDelete(s.id)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"><IconDelete /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer 
        isOpen={!!selectedSupplier} 
        onClose={() => { setSelectedSupplier(null); setIsEditingProfile(false); }} 
        title={isEditingProfile ? "Редагувати постачальника" : "Деталі постачальника"}
      >
        {selectedSupplier && (
          isEditingProfile ? (
            <SupplierForm 
              onSuccess={() => { setSelectedSupplier(null); setIsEditingProfile(false); }} 
              supplier={selectedSupplier} 
            />
          ) : (
            <SupplierDetailView 
              supplier={selectedSupplier} 
              purchases={purchases.filter(p => p.supplier_id === selectedSupplier.id)}
              onEdit={() => setIsEditingProfile(true)} 
              onClose={() => setSelectedSupplier(null)} 
            />
          )
        )}
      </Drawer>
    </>
  );
}
