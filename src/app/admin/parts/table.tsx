"use client";

import { useState, useTransition } from "react";
import { IconSearch, IconEdit, IconDelete, IconWarning } from "@/components/icons";
import { deletePart, bulkUpdatePartsTtn } from "@/lib/actions/parts";
import Drawer from "@/components/ui/Drawer";
import { PartForm } from "@/components/forms/PartForm";
import { PartDetailView } from "@/components/PartDetailView";
import { InlineError } from "@/components/ui/InlineError";

import type { Database } from "@/types/database";

type PartRow = Database["public"]["Tables"]["parts"]["Row"] & { supplier_name: string };

const typeLabels: Record<string, string> = { screen: "Екран", battery: "АКБ", charging_port: "Порт", cable: "Шлейф", button: "Кнопка", camera: "Камера", speaker: "Динамік", other: "Інше" };

export function PartsTable({ 
  parts, 
  suppliers,
  usage = []
}: { 
  parts: PartRow[]; 
  suppliers: { id: string; name: string }[];
  usage?: Parameters<typeof PartDetailView>[0]["usage"];
}) {
  const [query, setQuery] = useState("");
  const [selectedPart, setSelectedPart] = useState<PartRow | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTtn, setBulkTtn] = useState("");
  const [isPending, startTransition] = useTransition();

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

  async function handleBulkUpdateTtn() {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkUpdatePartsTtn(selectedIds, bulkTtn || null);
      if (res.success) {
        setSelectedIds([]);
        setBulkTtn("");
      } else {
        setError(res.error || "Помилка оновлення ТТН");
      }
    });
  }

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />
      
      {/* BULK ACTIONS PANEL */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-violet/5 border border-violet/20 p-4 animate-entry mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet text-white text-xxs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-text-primary">деталей обрано для групових дій</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={bulkTtn}
              onChange={(e) => setBulkTtn(e.target.value)}
              placeholder="Введіть ТТН Нової Пошти..."
              className="rounded-xl border border-warm-border bg-white px-3.5 py-2 text-xs text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40 min-w-[200px]"
            />
            <button
              onClick={handleBulkUpdateTtn}
              disabled={isPending}
              className="rounded-xl bg-violet hover:bg-violet-hover text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isPending ? "Застосування..." : "Застосувати ТТН"}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-warm-border bg-white hover:bg-warm-hover text-text-secondary px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

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
              <th className="pb-2 pr-4 w-10">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(filtered.map(p => p.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                />
              </th>
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
              <tr><td colSpan={11} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td></tr>
            ) : (
              filtered.map(p => {
                const isLow = p.stock <= p.min_stock;
                const isSelected = selectedIds.includes(p.id);
                return (
                  <tr 
                    key={p.id} 
                    onClick={() => { setSelectedPart(p); setIsEditingProfile(false); }}
                    className={`border-b border-iris/5 text-text-primary transition-colors cursor-pointer ${isSelected ? "bg-violet/[0.04]" : "hover:bg-violet/[0.02]"}`}
                  >
                    <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, p.id]);
                          } else {
                            setSelectedIds(selectedIds.filter(id => id !== p.id));
                          }
                        }}
                        className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                      />
                    </td>
                    <td className="py-3 pr-4 font-medium">{p.name}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary font-mono">{p.part_number || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary"><span className="rounded bg-iris/5 px-2 py-0.5">{typeLabels[p.type] || p.type}</span></td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">
                      {p.origin_type ? <span className="rounded bg-violet/5 px-2 py-0.5 font-semibold text-violet">{p.origin_type}</span> : "—"}
                    </td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">{p.compatible_with || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">{p.supplier_name}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">{p.np_ttn ? <a href={`https://novaposhta.ua/tracking/#${p.np_ttn}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-violet hover:underline font-mono cursor-pointer">{p.np_ttn}</a> : "—"}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`font-medium ${isLow ? "text-rose" : "text-cyan"}`}>
                        {p.stock} {isLow && <span className="inline-flex items-center ml-1 text-rose"><IconWarning size={12} /></span>}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-text-secondary">{p.cost_price.toLocaleString()} грн</td>
                    <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelectedPart(p); setIsEditingProfile(true); }} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet cursor-pointer"><IconEdit /></button>
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

      <Drawer 
        isOpen={!!selectedPart} 
        onClose={() => { setSelectedPart(null); setIsEditingProfile(false); }} 
        title={isEditingProfile ? "Редагувати деталь" : "Деталі запчастини"} 
        size="half"
      >
        {selectedPart && (
          isEditingProfile ? (
            <PartForm 
              onSuccess={() => { setSelectedPart(null); setIsEditingProfile(false); }} 
              part={selectedPart} 
              suppliers={suppliers} 
            />
          ) : (
            <PartDetailView 
              part={selectedPart} 
              usage={usage.filter(u => u.part_id === selectedPart.id)}
              onEdit={() => setIsEditingProfile(true)} 
              onClose={() => setSelectedPart(null)} 
            />
          )
        )}
      </Drawer>
    </>
  );
}
