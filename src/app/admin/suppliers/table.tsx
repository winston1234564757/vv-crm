"use client";

import { useState } from "react";
import { IconSearch, IconEdit, IconDelete } from "@/components/icons";
import { deleteSupplier } from "@/lib/actions/suppliers";
import Drawer from "@/components/ui/Drawer";
import { SupplierForm } from "@/components/forms/SupplierForm";
import { InlineError } from "@/components/ui/InlineError";

type SupplierRow = { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null; notes: string | null };

export function SuppliersTable({ suppliers }: { suppliers: SupplierRow[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any>(null);
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
      <div className="overflow-x-auto">
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
                <tr key={s.id} className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02]">
                  <td className="py-3 pr-4 font-medium">{s.name}</td>
                  <td className="py-3 pr-4 text-text-secondary">{s.contact_person || "—"}</td>
                  <td className="py-3 pr-4 text-text-secondary">{s.phone || "—"}</td>
                  <td className="py-3 pr-4 text-text-secondary">{s.email || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-text-secondary truncate max-w-[200px]">{s.notes || "—"}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(s)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet"><IconEdit /></button>
                      <button onClick={() => handleDelete(s.id)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"><IconDelete /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Drawer isOpen={!!editing} onClose={() => setEditing(null)} title="Редагувати постачальника">
        {editing && <SupplierForm onSuccess={() => setEditing(null)} supplier={editing} />}
      </Drawer>
    </>
  );
}
