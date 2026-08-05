"use client";

/* Тут був `OpexRunwayCard` — кільце «запас OPEX у днях». Не рендерився ніде:
   те саме число показує `CashCard` на дашборді, рядком і без кільця. */

export function RefurbishmentWidget({ capital, margin, onClick }: { capital: number; margin: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card card-hover btn-press p-5 flex flex-col justify-between text-left cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted">Відновлення техніки</h3>
        <span className="text-xs font-medium text-accent-ink opacity-0 group-hover:opacity-100 transition-opacity">Деталі →</span>
      </div>
      <div className="my-4 space-y-3">
        <div>
          <p className="text-xs text-muted">Кошти у відновленні (активні)</p>
          <p className="text-lg font-semibold text-info tabular">{capital.toLocaleString()} ₴</p>
        </div>
        <div>
          <p className="text-xs text-muted">Чистий прибуток (30д)</p>
          <p className="text-lg font-semibold text-success tabular">+{margin.toLocaleString()} ₴</p>
        </div>
      </div>
      <p className="text-xs text-faint border-t border-border pt-2">Внутрішній цикл ремонту</p>
    </button>
  );
}

export function B2BPartnerShareWidget({ share, revenue }: { share: number; revenue: number }) {
  return (
    <div className="card p-5 flex flex-col justify-between">
      <h3 className="text-sm font-medium text-muted">Партнерська мережа (B2B)</h3>
      <div className="my-4">
        <p className="text-xs text-muted">Оборот партнерів (30д)</p>
        <p className="text-lg font-semibold text-info tabular">{revenue.toLocaleString()} ₴</p>
        <div className="mt-3.5 w-full bg-hover h-2 rounded-full overflow-hidden">
          <div className="bg-info h-full rounded-full transition-all duration-500" style={{ width: `${share}%` }} />
        </div>
        <p className="text-xs text-muted mt-2 tabular">Частка в загальному доході: <span className="text-ink font-semibold">{share}%</span></p>
      </div>
      <p className="text-xs text-faint border-t border-border pt-2">Розподіл B2B / B2C</p>
    </div>
  );
}
