"use client";

import { 
  IconEdit, IconFinance, IconBox, IconCheck
} from "./icons";

type ServiceDetailViewProps = {
  service: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    category: string;
    is_visible: boolean;
    duration_minutes: number | null;
    warranty_days: number | null;
  };
  sales?: Array<{
    id: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    total_amount: number;
    items: Array<{
      item_id: string;
      item_type: string;
      quantity: number;
      unit_price: number;
    }>;
  }>;
  onEdit: () => void;
  onClose: () => void;
};

const categoryLabels: Record<string, string> = {
  diagnostics: "Діагностика",
  software: "ПЗ / Прошивка",
  cleaning: "Чистка",
  setup: "Налаштування",
  other: "Інше"
};

export function ServiceDetailView({ service, sales = [], onEdit, onClose }: ServiceDetailViewProps) {
  // Filter sales that contain this service
  const serviceSales = sales.filter(s => 
    s.items.some(i => i.item_type === "service" && i.item_id === service.id)
  );

  const totalProvidedCount = serviceSales.reduce((acc, sale) => {
    const item = sale.items.find(i => i.item_type === "service" && i.item_id === service.id);
    return acc + (item?.quantity || 0);
  }, 0);

  const totalRevenue = serviceSales.reduce((acc, sale) => {
    const item = sale.items.find(i => i.item_type === "service" && i.item_id === service.id);
    const qty = item?.quantity || 0;
    const price = item?.unit_price || service.price;
    return acc + (qty * price);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-warm-surface border border-warm-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">#{service.id.substring(0, 8)}</span>
            <span className="rounded-lg bg-violet/5 text-violet px-2.5 py-1 text-[11px] font-semibold">
              {categoryLabels[service.category] || service.category}
            </span>
            <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
              service.is_visible ? "text-cyan bg-cyan/10" : "text-text-muted bg-warm-sidebar"
            }`}>
              {service.is_visible ? "На вітрині" : "Прихована"}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-text-primary">{service.name}</h2>
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

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        {/* Service Specs */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Параметри виконання</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-text-muted">Тривалість</p>
              <p className="mt-1 text-lg font-bold text-text-primary">
                {service.duration_minutes ? `${service.duration_minutes} хв` : "—"}
              </p>
            </div>
            <div>
              <p className="text-text-muted">Гарантія</p>
              <p className="mt-1 text-lg font-bold text-text-primary">
                {service.warranty_days ? `${service.warranty_days} днів` : "Без гарантії"}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing & Income calculations */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Ціноутворення та Виручка</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-warm-bg rounded-xl p-2.5">
              <p className="text-[10px] text-text-muted font-medium">Ціна послуги</p>
              <p className="mt-1 font-bold text-text-primary">{service.price.toLocaleString()} ₴</p>
            </div>
            <div className="bg-warm-bg rounded-xl p-2.5">
              <p className="text-[10px] text-text-muted font-medium">Надано разів</p>
              <p className="mt-1 font-bold text-text-secondary">{totalProvidedCount} шт</p>
            </div>
            <div className="bg-violet-subtle rounded-xl p-2.5">
              <p className="text-[10px] text-violet font-medium">Загальний дохід</p>
              <p className="mt-1 font-bold text-violet">{totalRevenue.toLocaleString()} ₴</p>
            </div>
          </div>
        </div>

        {/* Description info */}
        {service.description && (
          <div className="card p-5 space-y-3 md:col-span-2">
            <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2">Опис послуги</h4>
            <p className="text-text-primary leading-relaxed bg-warm-bg p-3 rounded-lg">{service.description}</p>
          </div>
        )}

        {/* Sales history */}
        <div className="card p-5 space-y-4 md:col-span-2 border border-violet/10">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Історія надання послуги</h3>
          </div>
          {serviceSales.length === 0 ? (
            <p className="text-text-muted italic text-[11px] py-4">Цю послугу ще жодного разу не надавали в замовленнях</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {serviceSales.map((sale) => {
                const item = sale.items.find(i => i.item_type === "service" && i.item_id === service.id);
                const qty = item?.quantity || 1;
                const price = item?.unit_price || service.price;
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
