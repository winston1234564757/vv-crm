"use client";

import { 
  IconEdit, IconFinance, IconBox, IconWarning, IconCheck
} from "./icons";

type AccessoryDetailViewProps = {
  accessory: {
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
  sales?: Array<{
    id: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    total_amount: number;
    items: Array<{
      item_id: string;
      quantity: number;
      unit_price: number;
    }>;
  }>;
  onEdit: () => void;
  onClose: () => void;
};

const typeLabels: Record<string, string> = {
  case: "Чохол",
  screen_protector: "Захисне скло",
  charger: "Зарядка",
  cable: "Кабель",
  headphones: "Навушники",
  other: "Інше"
};

export function AccessoryDetailView({ accessory, sales = [], onEdit, onClose }: AccessoryDetailViewProps) {
  const margin = accessory.price - accessory.cost_price;
  const isLowStock = accessory.stock <= accessory.min_stock;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-warm-surface border border-warm-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">#{accessory.id.substring(0, 8)}</span>
            <span className="rounded-lg bg-violet/5 text-violet px-2.5 py-1 text-[11px] font-semibold">
              {typeLabels[accessory.type] || accessory.type}
            </span>
            <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
              accessory.is_visible ? "text-cyan bg-cyan/10" : "text-text-muted bg-warm-sidebar"
            }`}>
              {accessory.is_visible ? "Видимий у шопі" : "Прихований"}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-text-primary">{accessory.name}</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="btn-press flex items-center gap-1.5 rounded-xl border border-warm-border bg-white hover:bg-warm-hover px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
          >
            <IconEdit size={14} /> Редагувати
          </button>
        </div>
      </div>

      {/* Low Stock Warning Alert (Fixes M11) */}
      {isLowStock && (
        <div className={`flex items-start gap-3 rounded-2xl p-4 border text-xs ${
          accessory.stock === 0 
            ? "bg-rose/10 border-rose/20 text-rose" 
            : "bg-amber/10 border-amber/20 text-amber"
        }`}>
          <span className="shrink-0 mt-0.5"><IconWarning size={16} /></span>
          <div>
            <h4 className="font-bold">
              {accessory.stock === 0 ? "Товар закінчився!" : "Критичний рівень запасів!"}
            </h4>
            <p className="mt-1 leading-relaxed text-[11px]">
              {accessory.stock === 0 
                ? "Цього аксесуару немає в наявності на складі. Потрібно замовити нову партію."
                : `На складі залишилось всього ${accessory.stock} шт. (мінімальний ліміт: ${accessory.min_stock} шт.).`}
            </p>
          </div>
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        {/* Stock status */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Складські запаси</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-text-muted">Поточний залишок</p>
              <p className={`mt-1 text-lg font-bold ${isLowStock ? "text-rose" : "text-cyan"}`}>
                {accessory.stock} шт.
              </p>
            </div>
            <div>
              <p className="text-text-muted">Мінімальний ліміт</p>
              <p className="mt-1 text-lg font-bold text-text-primary">
                {accessory.min_stock} шт.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing calculations */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Калькуляція ціни</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-warm-bg rounded-xl p-2.5">
              <p className="text-[10px] text-text-muted font-medium">Роздріб</p>
              <p className="mt-1 font-bold text-text-primary">{accessory.price.toLocaleString()} ₴</p>
            </div>
            <div className="bg-warm-bg rounded-xl p-2.5">
              <p className="text-[10px] text-text-muted font-medium">Собівартість</p>
              <p className="mt-1 font-bold text-text-secondary">{accessory.cost_price.toLocaleString()} ₴</p>
            </div>
            <div className="bg-violet-subtle rounded-xl p-2.5">
              <p className="text-[10px] text-violet font-medium">Маржа</p>
              <p className="mt-1 font-bold text-violet">{margin.toLocaleString()} ₴</p>
            </div>
          </div>
        </div>

        {/* Description info */}
        {accessory.description && (
          <div className="card p-5 space-y-3 md:col-span-2">
            <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2">Опис аксесуару</h4>
            <p className="text-text-primary leading-relaxed bg-warm-bg p-3 rounded-lg">{accessory.description}</p>
          </div>
        )}

        {/* Sales history */}
        <div className="card p-5 space-y-4 md:col-span-2 border border-violet/10">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Історія роздрібних продажів</h3>
          </div>
          {sales.length === 0 ? (
            <p className="text-text-muted italic text-[11px] py-4">Продажів цього аксесуару ще не було</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {sales.map((sale) => {
                const item = sale.items.find(i => i.item_id === accessory.id);
                const qty = item?.quantity || 1;
                const price = item?.unit_price || accessory.price;
                return (
                  <div key={sale.id} className="rounded-xl border border-warm-border/60 bg-warm-bg/30 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>{sale.created_at.split("T")[0]} {sale.created_at.split("T")[1]?.substring(0, 5)}</span>
                      <span className="font-semibold text-violet">Всього за чеком: {sale.total_amount.toLocaleString()} ₴</span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary font-medium">
                      <span>{sale.customer_name} {sale.customer_phone && <span className="text-text-secondary font-mono text-[10px]">({sale.customer_phone})</span>}</span>
                      <span>{qty} шт. × {price.toLocaleString()} ₴ = {(qty * price).toLocaleString()} ₴</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
