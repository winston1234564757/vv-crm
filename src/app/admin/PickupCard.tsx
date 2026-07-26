import { BentoCell, BentoLink, CardStat } from "@/components/ui/BentoCell";
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
    >
      <CardStat value={total} unit={pluralUk(total, "готовий", "готові", "готових")}>
        {debt > 0 && (
          <span className="text-xs text-muted">
            борг <span className="font-semibold tabular text-danger">{uah(debt)}</span>
          </span>
        )}
      </CardStat>

      {total === 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          Немає чого видавати. Щойно ремонт перейде в «Готовий», клієнт і сума боргу з&apos;являться
          тут.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-ink">{r.device}</span>
                <span className="block truncate text-[11px] text-muted">
                  {r.customer}
                  <span className="mx-1.5 text-faint">·</span>
                  <span className={cn("tabular", r.days >= 3 && "font-medium text-warning")}>
                    {r.days} {pluralUk(r.days, "день", "дні", "днів")}
                  </span>
                </span>
              </span>
              {r.debt > 0 && (
                <span className="shrink-0 text-[13px] font-semibold tabular text-danger">
                  {uah(r.debt)}
                </span>
              )}
            </li>
          ))}
          {total > rows.length && (
            <li className="pt-2 text-[11px] text-faint">і ще {total - rows.length}</li>
          )}
        </ul>
      )}
    </BentoCell>
  );
}
