"use client";

export function OpexRunwayCard({ runwayDays, dailyRate, balance }: { runwayDays: number; dailyRate: number; balance: number }) {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = Math.min(Math.round((runwayDays / 90) * 100), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full md:w-[170px] card p-5 flex flex-col items-center justify-between shrink-0">
      <div className="text-center">
        <h3 className="text-sm font-medium text-muted">Запас OPEX</h3>
        <span className="text-xs text-muted tabular mt-0.5 block truncate max-w-[130px]">Резерв: {balance.toLocaleString()} ₴</span>
      </div>
      <div className="relative flex items-center justify-center my-3">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle stroke="var(--color-border)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
          <circle stroke="var(--color-accent)" fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + " " + circumference} style={{ strokeDashoffset }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} className="transition-all duration-500" />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="font-display text-sm font-semibold text-ink tabular">{runwayDays}</span>
          <span className="text-[10px] text-muted">днів</span>
        </div>
      </div>
      <div className="text-center">
        <span className="text-xs text-muted block">Витрати:</span>
        <span className="text-xs font-semibold text-ink tabular">{dailyRate.toLocaleString()} ₴/д</span>
      </div>
    </div>
  );
}

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
