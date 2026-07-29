"use client";

import { Pagination, usePagination } from "@/components/ui/Pagination";
import { Fragment, useState } from "react";
import { IconSearch, IconEdit, IconDelete, IconWarning } from "@/components/icons";
import { deleteAccessory } from "@/lib/actions/accessories";
import Drawer from "@/components/ui/Drawer";
import { AccessoryForm } from "@/components/forms/AccessoryForm";
import { AccessoryDetailView } from "@/components/AccessoryDetailView";
import { InlineError } from "@/components/ui/InlineError";
import type { SaleWithDetails } from "@/lib/data-sales";
import { accessoryType, labelOf } from "@/lib/domain-labels";

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
  warranty_months?: number;
  source?: string | null;
  barcode?: string | null;
  warehouse_location?: string | null;
  photo_urls?: string[] | null;
  created_at?: string | null;
};

type SortMode = "name" | "date";

/**
 * День приходу партії. Групуємо саме за днем, а не за міткою часу: одна
 * поставка заводиться кількома хвилинами, і посекундна точність розсипала б
 * її на десятки «партій».
 */
function intakeDay(a: AccessoryRow): string {
  return a.created_at ? a.created_at.slice(0, 10) : "";
}

function intakeLabel(day: string): string {
  if (!day) return "Дата невідома";
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

/* «Усі» плюс усі категорії словника — раніше список був набраний руками, і
   «Інше» в нього не потрапило: аксесуари цієї категорії не показувалися в
   жодному фільтрі, крім «Усі». */
const TYPE_FILTERS = ["all", ...Object.keys(accessoryType)];

export function AccessoriesTable({ accessories, sales = [] }: { accessories: AccessoryRow[]; sales?: SaleWithDetails[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortMode>("name");
  const [selectedAccessory, setSelectedAccessory] = useState<AccessoryRow | null>(null);
  const [isEditingAccessory, setIsEditingAccessory] = useState(false);
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

  /* Копія перед сортуванням: `filtered` походить від пропа, а `sort` мутує
     масив на місці й переставив би рядки в батьківському наборі. */
  const sorted = [...filtered].sort((a, b) =>
    sort === "date"
      ? intakeDay(b).localeCompare(intakeDay(a)) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name),
  );

  const pager = usePagination(sorted, { resetKey: `${query}|${filter}|${sort}` });

  /* Підсумки рахуємо по всьому відфільтрованому набору, а не по сторінці:
     партія майже завжди більша за сторінку, і «12 позицій» замість «41»
     ввело б в оману саме там, де цифра й потрібна. */
  const batchTotals = new Map<string, { positions: number; units: number; cost: number }>();
  for (const a of sorted) {
    const day = intakeDay(a);
    const t = batchTotals.get(day) ?? { positions: 0, units: 0, cost: 0 };
    t.positions += 1;
    t.units += a.stock;
    t.cost += a.stock * a.cost_price;
    batchTotals.set(day, t);
  }

  /* Перший рядок кожного дня на поточній сторінці. Заголовок ставимо саме
     тут, а не групуванням списку: пагінація ріже набір, і група, розірвана
     між сторінками, отримає підзаголовок на кожній. */
  const dayHeadIds = new Set<string>();
  if (sort === "date") {
    let prev: string | null = null;
    for (const a of pager.pageItems) {
      const day = intakeDay(a);
      if (day !== prev) dayHeadIds.add(a.id);
      prev = day;
    }
  }

  function BatchHeading({ day }: { day: string }) {
    const t = batchTotals.get(day);
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-text-primary">{intakeLabel(day)}</span>
        {t && (
          <span className="text-xs text-text-secondary">
            {t.positions} поз. · {t.units} шт · {t.cost.toLocaleString()} грн закупки
          </span>
        )}
      </div>
    );
  }

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
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? "bg-violet text-white" : "bg-violet/5 text-text-secondary hover:bg-violet/10 hover:text-text-primary"}`}
            >
              {f === "all" ? "Усі" : labelOf(accessoryType, f).label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary">Порядок:</span>
        {([
          { key: "name", label: "За назвою" },
          { key: "date", label: "За датою приходу" },
        ] as const).map((o) => (
          <button
            key={o.key}
            onClick={() => setSort(o.key)}
            aria-pressed={sort === o.key}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${sort === o.key ? "bg-violet text-white" : "bg-violet/5 text-text-secondary hover:bg-violet/10 hover:text-text-primary"}`}
          >
            {o.label}
          </button>
        ))}
        {sort === "date" && (
          <span className="text-[11px] text-text-muted">
            новіші зверху; позиції, яким лише доливали кількість, лишаються в даті першого приходу
          </span>
        )}
      </div>

      <div className="mt-4">
        {/* Мобільні картки аксесуарів */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</p>
          ) : (
            pager.pageItems.map((a) => {
              const isLow = a.stock <= a.min_stock;
              const isOut = a.stock === 0;
              return (
                <div key={a.id} className="flex flex-col gap-3">
                {dayHeadIds.has(a.id) && (
                  <div className="border-t border-warm-border pt-3 first:border-t-0 first:pt-0">
                    <BatchHeading day={intakeDay(a)} />
                  </div>
                )}
                <div
                  onClick={() => { setSelectedAccessory(a); setIsEditingAccessory(false); }}
                  className="rounded-2xl border border-warm-border p-4 bg-surface shadow-sm flex flex-col gap-2.5 transition-colors hover:border-border-strong cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-text-primary">{a.name}</h4>
                      {a.description && (
                        <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-1">{a.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] bg-iris/5 px-2 py-0.5 rounded font-medium text-text-secondary">
                      {labelOf(accessoryType, a.type).label}
                    </span>
                  </div>

                  <div className="text-xs text-text-secondary flex justify-between border-t border-border pt-2.5">
                    <span>Ціна:</span>
                    <span className="text-text-primary font-bold">{a.price.toLocaleString()} грн</span>
                  </div>

                  <div className="text-xs text-text-secondary flex justify-between">
                    <span>Собівартість:</span>
                    <span className="text-text-primary font-medium">{a.cost_price.toLocaleString()} грн</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <div className="flex items-center gap-1">
                      <span>Запас:</span>
                      <span className={`font-bold ${isOut ? "text-rose" : isLow ? "text-warning" : "text-cyan"}`}>
                        {a.stock} шт
                      </span>
                      <span className="text-text-secondary text-[10px]">(мін {a.min_stock})</span>
                      {isLow && <span className="inline-flex items-center text-rose"><IconWarning size={12} /></span>}
                    </div>
                    <div>
                      {isOut ? (
                        <span className="rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in oklch, var(--color-rose) 18%, transparent)", color: "var(--color-rose)" }}>Немає</span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in oklch, var(--color-amber) 18%, transparent)", color: "var(--color-amber)" }}>Мало</span>
                      ) : (
                        <span className="rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in oklch, var(--color-cyan) 18%, transparent)", color: "var(--color-cyan)" }}>В наявності</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border pt-2.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setSelectedAccessory(a); setIsEditingAccessory(true); }}
                      className="flex h-8 px-2.5 items-center justify-center rounded-xl bg-violet/5 hover:bg-violet/10 text-violet text-xs font-semibold gap-1 transition-colors cursor-pointer"
                    >
                      <IconEdit size={14} />
                      <span>Редагувати</span>
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose/5 hover:bg-rose/10 text-rose transition-colors cursor-pointer"
                    >
                      <IconDelete size={14} />
                    </button>
                  </div>
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
                pager.pageItems.map((a) => (
                  <Fragment key={a.id}>
                  {dayHeadIds.has(a.id) && (
                    <tr>
                      <td colSpan={8} className="pt-5 pb-2">
                        <BatchHeading day={intakeDay(a)} />
                      </td>
                    </tr>
                  )}
                  <tr
                    
                    onClick={() => { setSelectedAccessory(a); setIsEditingAccessory(false); }}
                    className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02] cursor-pointer"
                  >
                    <td className="py-3 pr-4 font-medium">{a.name}</td>
                    <td className="py-3 pr-4 text-text-secondary text-xs">{labelOf(accessoryType, a.type).label}</td>
                    <td className="py-3 pr-4 text-right">{a.price.toLocaleString()} грн</td>
                    <td className="py-3 pr-4 text-right text-text-secondary">{a.cost_price.toLocaleString()} грн</td>
                    <td className="py-3 pr-4 text-right font-medium">{a.stock}</td>
                    <td className="py-3 pr-4 text-right text-text-secondary text-xs">{a.min_stock}</td>
                    <td className="py-3 pr-4 text-right">
                      {a.stock === 0 ? (
                        <span className="rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in oklch, var(--color-rose) 18%, transparent)", color: "var(--color-rose)" }}>Немає</span>
                      ) : a.stock <= a.min_stock ? (
                        <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in oklch, var(--color-amber) 18%, transparent)", color: "var(--color-amber)" }}>
                          <IconWarning size={12} />
                          Мало: {a.stock} шт
                        </span>
                      ) : (
                        <span className="rounded-lg px-2.5 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in oklch, var(--color-cyan) 18%, transparent)", color: "var(--color-cyan)" }}>{a.stock} шт</span>
                      )}
                    </td>
                    <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedAccessory(a); setIsEditingAccessory(true); }} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet">
                          <IconEdit />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose">
                          <IconDelete />
                        </button>
                      </div>
                    </td>
                  </tr>
                  </Fragment>
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
          itemLabel="аксесуарів"
        />
      </div>

      <Drawer 
        isOpen={!!selectedAccessory} 
        onClose={() => { setSelectedAccessory(null); setIsEditingAccessory(false); }} 
        title={isEditingAccessory ? "Редагувати аксесуар" : "Деталі аксесуару"}
      >
        {selectedAccessory && (
          isEditingAccessory ? (
            <AccessoryForm 
              onSuccess={() => { setSelectedAccessory(null); setIsEditingAccessory(false); }} 
              accessory={selectedAccessory} 
            />
          ) : (
            <AccessoryDetailView 
              accessory={selectedAccessory} 
              onEdit={() => setIsEditingAccessory(true)} 
              onClose={() => setSelectedAccessory(null)} 
              sales={sales.filter(s => s.items.some(item => item.item_type === "accessory" && item.item_id === selectedAccessory.id))}
            />
          )
        )}
      </Drawer>
    </>
  );
}

