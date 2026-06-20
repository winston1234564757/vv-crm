"use client";

import { 
  IconEdit, IconFinance, IconBox, IconRepair, IconWarning 
} from "./icons";

interface RepairUsage {
  id: string;
  part_id: string;
  quantity: number;
  unit_cost: number;
  repairs?: {
    id: string;
    device_name: string;
    issue: string;
    status: string;
    price: number;
    created_at: string;
  } | null;
}

type PartDetailViewProps = {
  part: {
    id: string;
    name: string;
    part_number: string | null;
    type: string;
    origin_type: string | null;
    compatible_with: string | null;
    supplier_name: string;
    np_ttn: string | null;
    stock: number;
    min_stock: number;
    cost_price: number;
  };
  usage: RepairUsage[];
  onEdit: () => void;
  onClose: () => void;
};

const typeLabels: Record<string, string> = { 
  screen: "Екран", 
  battery: "АКБ", 
  charging_port: "Порт", 
  cable: "Шлейф", 
  button: "Кнопка", 
  camera: "Камера", 
  speaker: "Динамік", 
  other: "Інше" 
};

const statusLabels: Record<string, string> = {
  received: "Прийнято",
  diagnostics: "Діагностика",
  in_progress: "В роботі",
  awaiting_parts: "Чекає деталі",
  ready: "Готовий",
  completed: "Виконано",
  handed_over: "Видано",
  cancelled: "Скасовано"
};

export function PartDetailView({ part, usage, onEdit, onClose }: PartDetailViewProps) {
  const isLowStock = part.stock <= part.min_stock;
  const totalUsedCount = usage.reduce((sum, u) => sum + u.quantity, 0);

  return (
    <div className="space-y-6 p-4">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-warm-surface border border-warm-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">#{part.id.substring(0, 8)}</span>
            <span className="rounded-lg bg-violet/5 text-violet px-2.5 py-1 text-[11px] font-semibold">
              {typeLabels[part.type] || part.type}
            </span>
            {part.origin_type && (
              <span className="rounded-lg bg-cyan/10 text-cyan px-2.5 py-1 text-[11px] font-semibold">
                {part.origin_type}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-bold text-text-primary">{part.name}</h2>
          {part.part_number && (
            <p className="mt-1 text-xs font-mono text-text-secondary">
              Артикул: {part.part_number}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="btn-press flex items-center gap-1.5 rounded-xl border border-warm-border bg-white hover:bg-warm-hover px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
          >
            <IconEdit size={14} /> Редагувати деталь
          </button>
        </div>
      </div>

      {/* Critical Stock Alert */}
      {isLowStock && (
        <div className={`flex items-start gap-3 rounded-2xl p-4 border text-xs ${
          part.stock === 0 ? "bg-rose/10 border-rose/20 text-rose" : "bg-amber/10 border-amber/20 text-amber"
        }`}>
          <span className="shrink-0 mt-0.5"><IconWarning size={16} /></span>
          <div>
            <h4 className="font-bold">
              {part.stock === 0 ? "Запчастина закінчилась!" : "Низький запас на складі!"}
            </h4>
            <p className="mt-1 leading-relaxed text-[11px]">
              {part.stock === 0 
                ? "Цієї деталі немає на складі. Терміново замовте нову поставку."
                : `Залишилось всього ${part.stock} шт. при мінімальному ліміті ${part.min_stock} шт.`}
            </p>
          </div>
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        {/* Specifications */}
        <div className="card p-5 space-y-4 border border-violet/5">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Реквізити запчастини</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-text-muted">Сумісність (Моделі)</p>
              <p className="mt-1 font-semibold text-text-primary text-sm">{part.compatible_with || "Сумісна з усіма моделями"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-warm-border/50 pt-2.5">
              <div>
                <p className="text-text-muted">Постачальник</p>
                <p className="mt-1 font-semibold text-text-primary">{part.supplier_name}</p>
              </div>
              {part.np_ttn && (
                <div>
                  <p className="text-text-muted">ТТН Нової Пошти</p>
                  <a href={`https://novaposhta.ua/tracking/?cargo_number=${part.np_ttn}`} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-violet hover:underline">
                    {part.np_ttn} ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stock & Cost */}
        <div className="card p-5 space-y-4 border border-violet/5">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Баланс та собівартість</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-warm-bg rounded-xl p-3">
              <p className="text-[10px] text-text-muted font-medium">Залишок</p>
              <p className={`mt-1 text-lg font-bold ${isLowStock ? "text-rose" : "text-cyan"}`}>{part.stock} шт.</p>
            </div>
            <div className="bg-warm-bg rounded-xl p-3">
              <p className="text-[10px] text-text-muted font-medium">Собівартість од.</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{part.cost_price.toLocaleString()} ₴</p>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-warm-border/50 pt-2.5">
            <span className="text-text-muted font-medium">Всього встановлено в ремонтах</span>
            <span className="font-bold text-text-primary">{totalUsedCount} шт.</span>
          </div>
        </div>

        {/* Repairs Usage History */}
        <div className="card p-5 space-y-4 md:col-span-2 border border-violet/10">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconRepair size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Використання в ремонтах</h3>
          </div>
          {usage.length === 0 ? (
            <p className="text-text-muted italic py-4">Ця деталь ще не встановлювалася в процесі ремонтів</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {usage.map((u) => {
                const rep = u.repairs;
                if (!rep) return null;
                return (
                  <div key={u.id} className="rounded-xl border border-warm-border/60 bg-warm-bg/30 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>{new Date(rep.created_at).toLocaleDateString("uk-UA")}</span>
                      <span className="rounded bg-violet/5 px-2 py-0.5 text-[10px] text-violet font-semibold capitalize">
                        {statusLabels[rep.status] || rep.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-text-primary font-medium">
                      <span>{rep.device_name}</span>
                      <span>Встановлено: {u.quantity} шт (собів. {u.unit_cost.toLocaleString()} ₴)</span>
                    </div>
                    <p className="text-text-secondary leading-snug"><strong className="text-text-primary">Проблема:</strong> {rep.issue}</p>
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
