"use client";

import { useState } from "react";
import { IconSearch, IconEdit, IconDelete } from "@/components/icons";
import { deleteAccessory } from "@/lib/actions/inventory";
import Drawer from "@/components/ui/Drawer";
import { AccessoryForm } from "@/components/forms/AccessoryForm";
import { InlineError } from "@/components/ui/InlineError";

type AccessoryRow = {
  id: string;
  type: string;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  description: string | null;
  is_visible: boolean;
};

const typeLabels: Record<string, string> = { case: "Чохол", screen_protector: "Захисне скло", charger: "Зарядка", cable: "Кабель", headphones: "Навушники", other: "Інше" };

export function AccessoriesTable({ accessories }: { accessories: AccessoryRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingAccessory, setEditingAccessory] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleDelete(id: string) {
    if (!confirm("Видалити цей аксесуар?")) return;
    const res = await deleteAccessory(id);
    if (!res.success) setError(res.error ?? "");
  }

  const filtered = accessories.filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    if (!query) return true;
    return a.name.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук за назвою..."
            className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "case", "screen_protector", "charger", "cable", "headphones"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? "bg-violet text-white" : "bg-violet/5 text-text-secondary hover:bg-violet/10 hover:text-text-primary"}`}
            >
              {f === "all" ? "Усі" : typeLabels[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
              <th className="pb-2 pr-4">Назва</th>
              <th className="pb-2 pr-4">Тип</th>
              <th className="pb-2 pr-4 text-right">Ціна</th>
              <th className="pb-2 pr-4 text-right">Собівартість</th>
              <th className="pb-2 pr-4 text-right">Запас</th>
              <th className="pb-2 pr-4 text-right">Мін.</th>
              <th className="pb-2 pr-4 text-right">Статус</th>
              <th className="pb-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02]">
                  <td className="py-3 pr-4 font-medium">{a.name}</td>
                  <td className="py-3 pr-4 text-text-secondary text-xs">{typeLabels[a.type]}</td>
                  <td className="py-3 pr-4 text-right">{a.price.toLocaleString()} грн</td>
                  <td className="py-3 pr-4 text-right text-text-secondary">{a.cost_price.toLocaleString()} грн</td>
                  <td className="py-3 pr-4 text-right font-medium">{a.stock}</td>
                  <td className="py-3 pr-4 text-right text-text-secondary text-xs">{a.min_stock}</td>
                  <td className="py-3 pr-4 text-right">
                    {a.stock === 0 ? (
                      <span className="rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in oklch, var(--color-rose) 18%, transparent)", color: "var(--color-rose)" }}>Немає</span>
                    ) : (
                      <span className="rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in oklch, var(--color-cyan) 18%, transparent)", color: "var(--color-cyan)" }}>{a.stock} шт</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditingAccessory(a)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet">
                        <IconEdit />
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose">
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

      <Drawer isOpen={!!editingAccessory} onClose={() => setEditingAccessory(null)} title="Редагувати аксесуар">
        {editingAccessory && <AccessoryForm onSuccess={() => setEditingAccessory(null)} accessory={editingAccessory} />}
      </Drawer>
    </>
  );
}
