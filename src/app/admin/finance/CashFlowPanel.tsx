"use client";

import { useCallback, useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { DrilldownModal } from "@/components/finance/DrilldownModal";
import { getCashFlowLineRows } from "@/lib/data-drilldown";
import type { CashFlowReport } from "@/lib/data-cashflow";

/**
 * Звідки взялись гроші, які зараз у касах.
 *
 * Це НЕ прибуток. Закупівля товару тут витрата, хоч у P&L вона нею не є;
 * вилучення частки — теж. Панель стоїть під балансами кас навмисно: спершу
 * скільки лежить, потім як воно таким стало, потім що конкретно рухалось.
 *
 * Кожне число, під яким стоять операції, відкриває їх список. Доти панель
 * казала «45 операцій» і не давала подивитись жодну — рахунок, який не можна
 * розкрити, доводиться приймати на віру, а за цим звітом двоє власників
 * ділять гроші.
 *
 * Токени тут v3 (`text-ink`, `border-border`), хоч сторінка навколо написана
 * до редизайну. Блок виглядатиме інакше — це свідомо: додати ще заборонених
 * токенів означає збільшити майбутній ретон, а видимий шов чесніший за
 * замаскований борг.
 */

/* Рядок, який відкриває свої операції. Візуально не кнопка — дев'ять кнопок
   поспіль перетворили б звіт на панель керування; підсвітка на наведенні
   каже те саме, не займаючи місця.

   Ширина через `calc`, а не `w-full`: при `w-full` бокс лишається завширшки з
   контейнер, а від'ємне поле зсуває його вліво цілком — підсвітка й праві
   суми поїхали б на 8px від решти колонки. Вкладені статті висять під лінією
   `border-l`, тож зліва вилазять на 4px замість 8: інакше підсвітка
   перекреслювала б саму лінію. */
const ROW =
  "-mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-[var(--radius-sm)] px-2 text-left transition-colors hover:bg-hover";

const ROW_NESTED =
  "-ml-1 -mr-2 w-[calc(100%+0.75rem)] cursor-pointer rounded-[var(--radius-sm)] pl-1 pr-2 text-left transition-colors hover:bg-hover";

function Line({
  line,
  direction,
  onOpen,
}: {
  line: { key: string; label: string; amount: number; count: number; owner: boolean };
  direction: "inflow" | "outflow";
  onOpen: (key: string, label: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(`${direction}:${line.key}`, line.label)}
      className={cn(ROW_NESTED, "flex items-baseline justify-between gap-3 py-1 text-xs")}
    >
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
    </button>
  );
}

export function CashFlowPanel({ report }: { report: CashFlowReport }) {
  const epochLabel = report.epoch
    ? format(new Date(report.epoch), "d MMMM yyyy", { locale: uk })
    : null;
  const balanced = report.drift === 0;

  const [open, setOpen] = useState<{ key: string; label: string } | null>(null);
  const onOpen = useCallback((key: string, label: string) => setOpen({ key, label }), []);

  // `useCallback` не косметика: `DrilldownModal` тягне дані в ефекті з `load`
  // у залежностях, і нова функція на кожен рендер зациклила б запит.
  const openKey = open?.key ?? null;
  const load = useCallback(() => getCashFlowLineRows(openKey ?? ""), [openKey]);

  return (
    <section className="card border border-border bg-surface p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Рух грошей від відкриття</h3>
        <span className="text-[11px] text-faint">не прибуток — гроші</span>
      </div>
      <p className="mb-3 text-[11px] text-faint">Клік по рядку — усі операції з датами й призначенням.</p>

      <button
        type="button"
        onClick={() => onOpen("opening", "На момент відкриття")}
        className={cn(ROW, "flex items-baseline justify-between gap-3 py-1 text-xs")}
      >
        <span className="text-muted">
          На момент відкриття
          {epochLabel && <span className="ml-1.5 text-faint">{epochLabel}</span>}
        </span>
        <span className="tabular text-ink">{uah(report.opening)}</span>
      </button>
      <div className="mt-1 border-b border-border" />

      <div className="mt-3">
        <button
          type="button"
          onClick={() => onOpen("inflow", "Надійшло")}
          className={cn(ROW, "flex items-baseline justify-between gap-3 py-0.5")}
        >
          <span className="text-xs font-medium text-ink">Надійшло</span>
          <span className="text-sm font-semibold tabular text-success">+{uah(report.inflow)}</span>
        </button>
        <div className="mt-1 space-y-0.5 border-l border-border pl-3">
          {report.inflowLines.map((l) => (
            <Line key={l.key} line={l} direction="inflow" onOpen={onOpen} />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => onOpen("outflow", "Витрачено")}
          className={cn(ROW, "flex items-baseline justify-between gap-3 py-0.5")}
        >
          <span className="text-xs font-medium text-ink">Витрачено</span>
          <span className="text-sm font-semibold tabular text-danger">−{uah(report.outflow)}</span>
        </button>
        <div className="mt-1 space-y-0.5 border-l border-border pl-3">
          {report.outflowLines.map((l) => (
            <Line key={l.key} line={l} direction="outflow" onOpen={onOpen} />
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

      {/* Єдине число, яке можна перерахувати руками. Стоїть окремо, бо
          «зараз у касах і сейфах» включає банківський рахунок, а його в
          шухляді немає — саме через це щоденна звірка й не сходилась. */}
      <div className="mt-2 space-y-1 rounded-[var(--radius-md)] bg-hover px-3 py-2 text-xs">
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-medium text-ink">З них купюрами</span>
          <span className="font-semibold tabular text-ink">{uah(report.banknotes)}</span>
        </p>
        <p className="flex items-baseline justify-between gap-3 text-muted">
          <span>На рахунку</span>
          <span className="tabular">{uah(report.closing - report.banknotes)}</span>
        </p>
        <p className="pt-1 leading-relaxed text-faint">
          Перерахуйте купюри в касі й сейфах — має вийти{" "}
          <span className="tabular text-muted">{uah(report.banknotes)}</span>. Решта лежить на
          банківському рахунку.
        </p>
      </div>

      {!balanced && (
        <p className="mt-2 text-[11px] leading-relaxed text-danger">
          Залишок не сходиться з рухами. Це означає, що баланс рахунку змінили в
          обхід леджера — цифри на цій сторінці далі показувати можна, але
          довіряти їм не варто, доки розрив не пояснено.
        </p>
      )}


      {/* Блок «Неокруглені суми» прибраний на прохання власника 03.08. Він
          ловив суми, не кратні 10 ₴, як підозру на картковий платіж, записаний
          готівкою, і три реальні помилки знайшов (SSD 542, чорнила 620,
          підгонка 101). Але потім у ньому постійно висіли записи, які помилками
          не були, і блок перетворився на фон. */}

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
        <button
          type="button"
          onClick={() => onOpen("internal", "Перекази між своїми рахунками")}
          className={cn(ROW, "mt-2 block py-0.5 text-[11px] leading-relaxed text-faint")}
        >
          Плюс <span className="tabular">{report.internal.count}</span>{" "}
          {pluralUk(report.internal.count, "переказ", "перекази", "переказів")} між своїми
          рахунками на <span className="tabular">{uah(report.internal.total)}</span> — це не рух
          грошей, а розподіл по сейфах.
        </button>
      )}

      {/* `key` — щоб на кожну статтю монтувався свіжий екземпляр: інакше
          довелось би скидати стан ефектом, а це зайвий каскадний рендер. */}
      {open !== null && (
        <DrilldownModal
          key={open.key}
          onClose={() => setOpen(null)}
          title={open.label}
          load={load}
        />
      )}
    </section>
  );
}
