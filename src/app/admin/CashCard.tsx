import Link from "next/link";
import { BentoCell } from "@/components/ui/BentoCell";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";

const RUNWAY_WARN_DAYS = 14;

export function CashCard({
  cashTotal,
  cashOnHand,
  cashless,
  runwayDays,
  dailyOpex,
  opexSafeBalance,
  opexWindowTotal,
  opexWindowDays,
  span = 5,
}: {
  cashTotal: number;
  cashOnHand: number;
  cashless: number;
  runwayDays: number | null;
  dailyOpex: number;
  opexSafeBalance: number;
  opexWindowTotal: number;
  opexWindowDays: number;
  span?: 4 | 5 | 6 | 12;
}) {
  const low = runwayDays !== null && runwayDays < RUNWAY_WARN_DAYS;
  const totalPos = Math.max(1, Math.max(0, cashOnHand) + Math.max(0, cashless));
  const cashPct = Math.round((Math.max(0, cashOnHand) / totalPos) * 100);
  const cardPct = Math.max(0, 100 - cashPct);

  return (
    <BentoCell span={span} className="justify-between gap-3.5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Гроші в наявності (каси + сейфи)
            </p>
            <p className="mt-1 font-display text-2xl sm:text-[2.25rem] font-semibold leading-none tabular tracking-tight text-ink">
              {uah(cashTotal)}
            </p>
          </div>

          <Link
            href="/admin/finance"
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-hover"
          >
            По касах →
          </Link>
        </div>

        {/* Готівка vs Безготівка */}
        <div className="space-y-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated px-3 py-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-full bg-success" />
                Готівка на руках
              </span>
              <p className="mt-0.5 font-display text-base font-semibold tabular text-ink">
                {uah(cashOnHand)}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center justify-end gap-1.5 text-muted">
                <span className="size-2 rounded-full bg-accent" />
                Картка та рахунки
              </span>
              <p className="mt-0.5 font-display text-base font-semibold tabular text-ink">
                {uah(cashless)}
              </p>
            </div>
          </div>

          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
            <div
              className="h-full bg-success transition-all"
              style={{ width: `${cashPct}%` }}
              title={`Готівка: ${cashPct}%`}
            />
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${cardPct}%` }}
              title={`Безготівка: ${cardPct}%`}
            />
          </div>
        </div>
      </div>

      {/* Операційний рахунок та запас міцності (OPEX Runway) */}
      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-background/60 px-3 py-2.5 space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span className={cn("size-2 rounded-full", low ? "bg-warning" : "bg-success")} />
            Операційний резерв (OPEX):
          </span>
          <span className="tabular font-semibold text-ink">{uah(opexSafeBalance)}</span>
        </div>

        <p className="text-xs text-muted">
          {runwayDays === null ? (
            <>Витрат за останні {opexWindowDays} днів не було — темп витрат 0 ₴/день.</>
          ) : (
            <>
              Запас міцності:{" "}
              <strong className={cn("font-semibold tabular", low ? "text-warning" : "text-ink")}>
                {runwayDays} {pluralUk(runwayDays, "день", "дні", "днів")}
              </strong>{" "}
              при середньому темпі <span className="tabular text-ink">{uah(dailyOpex)}/день</span>
            </>
          )}
        </p>

        {runwayDays !== null && (
          <p className="text-[11px] leading-relaxed text-muted">
            База темпу: {uah(opexWindowTotal)} регулярних витрат за {opexWindowDays} дн.
          </p>
        )}
      </div>
    </BentoCell>
  );
}
