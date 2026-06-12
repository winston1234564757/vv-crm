"use client";

import { useState } from "react";
import { IconSearch, IconEdit, IconDelete, IconWarning } from "@/components/icons";
import { deletePart } from "@/lib/actions/parts";
import Drawer from "@/components/ui/Drawer";
import { PartForm } from "@/components/forms/PartForm";
import { InlineError } from "@/components/ui/InlineError";

type PartRow = { id: string; name: string; part_number: string | null; type: string; compatible_with: string | null; cost_price: number; price: number | null; stock: number; min_stock: number; supplier_name: string; np_ttn: string | null; origin_type: string | null };

const typeLabels: Record<string, string> = { screen: "Екран", battery: "АКБ", charging_port: "Порт", cable: "Шлейф", button: "Кнопка", camera: "Камера", speaker: "Динамік", other: "Інше" };

export function PartsTable({ parts, suppliers }: { parts: PartRow[]; suppliers: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  async function handleDelete(id: string) {
    if (!confirm("Видалити цю деталь?")) return;
    const res = await deletePart(id);
    if (!res.success) setError(res.error ?? "");
  }

  const filtered = parts.filter(p => {
    if (filter === "low" && p.stock > p.min_stock) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.part_number ?? "").toLowerCase().includes(q) || (p.compatible_with ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук деталі..." className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${filter === "all" ? "bg-violet text-white" : "bg-violet/5 text-text-secondary hover:bg-violet/10"}`}>Усі</button>
          <button onClick={() => setFilter("low")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${filter === "low" ? "bg-rose text-white" : "bg-rose/5 text-text-secondary hover:bg-rose/10"}`}>Закінчуються</button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
              <th className="pb-2 pr-4">Назва</th>
              <th className="pb-2 pr-4">Part №</th>
              <th className="pb-2 pr-4">Тип</th>
              <th className="pb-2 pr-4">Походження</th>
              <th className="pb-2 pr-4">Сумісність</th>
              <th className="pb-2 pr-4">Постачальник</th>
              <th className="pb-2 pr-4">ТТН</th>
              <th className="pb-2 pr-4 text-right">Склад</th>
              <th className="pb-2 pr-4 text-right">Собів.</th>
              <th className="pb-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td></tr>
            ) : (
              filtered.map(p => {
                const isLow = p.stock <= p.min_stock;
                return (
                  <tr key={p.id} className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02]">
                    <td className="py-3 pr-4 font-medium">{p.name}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary font-mono">{p.part_number || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary"><span className="rounded bg-iris/5 px-2 py-0.5">{typeLabels[p.type] || p.type}</span></td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">
                      {p.origin_type ? <span className="rounded bg-violet/5 px-2 py-0.5 font-semibold text-violet">{p.origin_type}</span> : "—"}
                    </td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">{p.compatible_with || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">{p.supplier_name}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">{p.np_ttn ? <a href={`https://novaposhta.ua/tracking/#${p.np_ttn}`} target="_blank" rel="noopener noreferrer" className="text-violet hover:underline font-mono cursor-pointer">{p.np_ttn}</a> : "—"}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`font-medium ${isLow ? "text-rose" : "text-cyan"}`}>
                        {p.stock} {isLow && <span className="inline-flex items-center ml-1 text-rose"><IconWarning size={12} /></span>}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-text-secondary">{p.cost_price.toLocaleString()} грн</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(p)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet cursor-pointer"><IconEdit /></button>
                        <button onClick={() => handleDelete(p.id)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose cursor-pointer"><IconDelete /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Drawer isOpen={!!editing} onClose={() => setEditing(null)} title="Редагувати деталь" size="half">
        {editing && <PartForm onSuccess={() => setEditing(null)} part={editing} suppliers={suppliers} />}
      </Drawer>
    </>
  );
}
