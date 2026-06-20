"use client";

import { 
  IconEdit, IconFinance, IconBox, IconTruck 
} from "./icons";

interface Purchase {
  id: string;
  supplier_id: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  purchase_items?: unknown[];
}

type SupplierDetailViewProps = {
  supplier: {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
  };
  purchases: Purchase[];
  onEdit: () => void;
  onClose: () => void;
};

const statusLabels: Record<string, string> = { 
  pending: "Очікується", 
  received: "Отримано", 
  paid: "Оплачено", 
  cancelled: "Скасовано" 
};

const statusColors: Record<string, string> = { 
  pending: "text-amber bg-amber/10", 
  received: "text-cyan bg-cyan/10", 
  paid: "text-emerald bg-emerald/10", 
  cancelled: "text-rose bg-rose/10" 
};

export function SupplierDetailView({ supplier, purchases, onEdit, onClose }: SupplierDetailViewProps) {
  const totalPurchasesCount = purchases.length;
  const totalPurchasesVolume = purchases
    .filter(p => p.status !== "cancelled")
    .reduce((sum, p) => sum + p.total_amount, 0);

  return (
    <div className="space-y-6 p-4">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-warm-surface border border-warm-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">#{supplier.id.substring(0, 8)}</span>
            <span className="rounded-lg bg-violet/5 text-violet px-2.5 py-1 text-[11px] font-semibold">
              Постачальник
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-text-primary">{supplier.name}</h2>
          {supplier.contact_person && (
            <p className="mt-1 text-xs text-text-secondary">
              Контактна особа: {supplier.contact_person}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="btn-press flex items-center gap-1.5 rounded-xl border border-warm-border bg-white hover:bg-warm-hover px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
          >
            <IconEdit size={14} /> Редагувати профіль
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        {/* Contact Info */}
        <div className="card p-5 space-y-4 border border-violet/5">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconTruck size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Контакти</h3>
          </div>
          <div className="space-y-3">
            {supplier.phone && (
              <div>
                <p className="text-text-muted">Телефон</p>
                <p className="mt-1 text-sm font-semibold font-mono">
                  <a href={`tel:${supplier.phone}`} className="text-violet hover:underline">
                    {supplier.phone}
                  </a>
                </p>
              </div>
            )}
            {supplier.email && (
              <div>
                <p className="text-text-muted">Email адреса</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  <a href={`mailto:${supplier.email}`} className="text-violet hover:underline">
                    {supplier.email}
                  </a>
                </p>
              </div>
            )}
            {!supplier.phone && !supplier.email && (
              <p className="text-text-muted italic">Контактні дані не вказані</p>
            )}
          </div>
        </div>

        {/* Analytics card */}
        <div className="card p-5 space-y-4 border border-violet/5">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Статистика замовлень</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-text-muted">Всього закупівель</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{totalPurchasesCount} замовлень</p>
            </div>
            <div>
              <p className="text-text-muted">Обіг викупу (без скасованих)</p>
              <p className="mt-1 text-lg font-bold text-violet">{totalPurchasesVolume.toLocaleString()} ₴</p>
            </div>
          </div>
        </div>

        {/* Order History */}
        <div className="card p-5 space-y-4 md:col-span-2 border border-violet/10">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Історія замовлень</h3>
          </div>
          {purchases.length === 0 ? (
            <p className="text-text-muted italic py-4">Немає замовлень у цього постачальника</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-warm-border text-xs font-semibold text-text-secondary">
                    <th className="pb-2">ID Закупівлі</th>
                    <th className="pb-2">Дата</th>
                    <th className="pb-2 text-right">Позицій</th>
                    <th className="pb-2 text-right">Сума</th>
                    <th className="pb-2 text-right">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-warm-border/40 last:border-0 text-text-primary">
                      <td className="py-2.5 font-mono">#{p.id.substring(0, 8)}</td>
                      <td className="py-2.5 text-text-secondary">{new Date(p.created_at).toLocaleDateString("uk-UA")}</td>
                      <td className="py-2.5 text-right text-text-secondary">{p.purchase_items?.length || 0} шт.</td>
                      <td className="py-2.5 text-right font-mono font-bold text-violet">{p.total_amount.toLocaleString()} ₴</td>
                      <td className="py-2.5 text-right">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusColors[p.status] || ""}`}>
                          {statusLabels[p.status] || p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notes info */}
        {supplier.notes && (
          <div className="card p-5 space-y-3 md:col-span-2">
            <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2">Примітки</h4>
            <p className="text-text-primary leading-relaxed bg-warm-bg p-3 rounded-lg whitespace-pre-line">{supplier.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
