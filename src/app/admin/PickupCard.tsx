import { BentoCell, BentoLink } from "@/components/ui/BentoCell";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import type { PickupRow } from "@/lib/data-operations";

/**
 * Готові до видачі — робота, яку вже зробили, але грошей за неї ще не взяли.
 * Тому борг стоїть поруч із кількістю: це не два різні факти, а один.
 *
 * Сортування — за днями очікування, найдовші вгору. Апарат, що лежить тиждень,
 * це не «готово», а клієнт, якому ніхто не подзвонив.
 */
export function PickupCard({
  rows,
  total,
  debt,
}: {
  rows: PickupRow[];
  total: number;
  debt: number;
}) {
  return (
    <BentoCell
      span={4}
      title="Видати клієнту"
      action={<BentoLink href="/admin/repairs?seg=ready">до видачі</BentoLink>}
      className="justify-between"
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-3xl font-semibold tabular tracking-tight text-ink">
          {total}
        </span>
        <span className="text-xs text-muted">
          {pluralUk(total, "готовий", "готові", "готових")}
        </span>
        {debt > 0 && (
          <span className="text-xs text-muted">
            борг <span className="font-semibold tabular text-danger">{uah(debt)}</span>
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted">Немає чого видавати — усі готові апарати забрали.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0">
                <span className="block truncate text-ink">{r.device}</span>
                <span className="block truncate text-[11px] text-muted">
                  {r.customer}
                  <span className="mx-1.5 text-faint">·</span>
                  <span className={cn("tabular", r.days >= 3 && "text-warning")}>
                    {r.days} {pluralUk(r.days, "день", "дні", "днів")}
                  </span>
                </span>
              </span>
              {r.debt > 0 && (
                <span className="shrink-0 font-medium tabular text-danger">{uah(r.debt)}</span>
              )}
            </li>
          ))}
          {total > rows.length && (
            <li className="text-[11px] text-faint">і ще {total - rows.length}</li>
          )}
        </ul>
      )}
    </BentoCell>
  );
}
