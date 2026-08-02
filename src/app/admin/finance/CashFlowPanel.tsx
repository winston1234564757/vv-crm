import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import type { CashFlowReport } from "@/lib/data-cashflow";

/**
 * Звідки взялись гроші, які зараз у касах.
 *
 * Це НЕ прибуток. Закупівля товару тут витрата, хоч у P&L вона нею не є;
 * вилучення частки — теж. Панель стоїть під балансами кас навмисно: спершу
 * скільки лежить, потім як воно таким стало, потім що конкретно рухалось.
 *
 * Токени тут v3 (`text-ink`, `border-border`), хоч сторінка навколо написана
 * до редизайну. Блок виглядатиме інакше — це свідомо: додати ще заборонених
 * токенів означає збільшити майбутній ретон, а видимий шов чесніший за
 * замаскований борг.
 */
function Line({
  line,
}: {
  line: { label: string; amount: number; count: number; owner: boolean };
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-xs">
      <span className={cn("truncate", line.owner ? "text-muted" : "text-ink")}>
        {line.label}
        {line.owner && <span className="ml-1.5 text-faint">власник</span>}
      </span>
      <span className="flex shrink-0 items-baseline gap-3">
        <span className="tabular text-ink">{uah(line.amount)}</span>
        <span className="w-24 text-right tabular text-faint">
          {line.count} {pluralUk(line.count, "операція", "операції", "операцій")}
        </span>
      </span>
    </div>
  );
}

export function CashFlowPanel({ report }: { report: CashFlowReport }) {
  const epochLabel = report.epoch
    ? format(new Date(report.epoch), "d MMMM yyyy", { locale: uk })
    : null;
  const balanced = report.drift === 0;

  return (
    <section className="card border border-border bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Рух грошей від відкриття</h3>
        <span className="text-[11px] text-faint">не прибуток — гроші</span>
      </div>

      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-xs">
        <span className="text-muted">
          На момент відкриття
          {epochLabel && <span className="ml-1.5 text-faint">{epochLabel}</span>}
        </span>
        <span className="tabular text-ink">{uah(report.opening)}</span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-ink">Надійшло</span>
          <span className="text-sm font-semibold tabular text-success">+{uah(report.inflow)}</span>
        </div>
        <div className="mt-1 space-y-0.5 border-l border-border pl-3">
          {report.inflowLines.map((l) => (
            <Line key={l.key} line={l} />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-ink">Витрачено</span>
          <span className="text-sm font-semibold tabular text-danger">−{uah(report.outflow)}</span>
        </div>
        <div className="mt-1 space-y-0.5 border-l border-border pl-3">
          {report.outflowLines.map((l) => (
            <Line key={l.key} line={l} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm font-medium text-ink">Зараз у касах і сейфах</span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-lg font-semibold tabular text-ink">
            {uah(report.closing)}
          </span>
          {balanced ? (
            <span className="text-[11px] text-success">✓ сходиться</span>
          ) : (
            <span className="text-[11px] font-semibold text-danger">
              розрив {uah(report.drift)}
            </span>
          )}
        </span>
      </div>

      {!balanced && (
        <p className="mt-2 text-[11px] leading-relaxed text-danger">
          Залишок не сходиться з рухами. Це означає, що баланс рахунку змінили в
          обхід леджера — цифри на цій сторінці далі показувати можна, але
          довіряти їм не варто, доки розрив не пояснено.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs">
        <span className="text-muted">
          Операційний потік{" "}
          <span
            className={cn(
              "font-semibold tabular",
              report.operatingNet >= 0 ? "text-success" : "text-danger",
            )}
          >
            {uah(report.operatingNet)}
          </span>
        </span>
        <span className="text-muted">
          Власник вніс − забрав{" "}
          <span className="font-semibold tabular text-ink">{uah(report.ownerNet)}</span>
        </span>
      </div>

      {report.internal.count > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Плюс <span className="tabular">{report.internal.count}</span>{" "}
          {pluralUk(report.internal.count, "переказ", "перекази", "переказів")} між своїми
          рахунками на <span className="tabular">{uah(report.internal.total)}</span> — це не рух
          грошей, а розподіл по сейфах.
        </p>
      )}
    </section>
  );
}
