import { BentoCell, BentoLink } from "@/components/ui/BentoCell";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import type { DashboardMoney } from "@/lib/data-dashboard";

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Продажі за сьогодні. Виторг тут — той самий розрахунок, що годує hero
 * (знижка вже розкидана по позиціях), а не сума `sales.total_amount`: два
 * числа з різних джерел на одному екрані рано чи пізно розійшлись би.
 *
 * Суми в рядках чеків — це вже збережений підсумок чека, тож він може не
 * збігтися з виторгом угорі на розмір знижки. Це навмисно: рядок відповідає
 * на «що пробили», а верхня цифра — на «скільки заробили».
 */
export function TodaySalesCard({ today }: { today: DashboardMoney["todaySales"] }) {
  return (
    <BentoCell
      span={4}
      title="Продажі сьогодні"
      action={<BentoLink href="/admin/sales">усі продажі</BentoLink>}
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-3xl font-semibold tabular tracking-tight text-ink">
          {today.count}
        </span>
        <span className="text-xs text-muted">{pluralUk(today.count, "чек", "чеки", "чеків")}</span>
        <span className="text-xs text-muted">
          на <span className="font-semibold tabular text-ink">{uah(today.revenue)}</span>
        </span>
      </div>

      {today.count === 0 ? (
        <p className="text-xs text-muted">Сьогодні ще нічого не пробили.</p>
      ) : (
        <ul className="space-y-2">
          {today.receipts.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="tabular text-muted">{time(r.at)}</span>
              <span className="font-medium tabular text-ink">{uah(r.amount)}</span>
            </li>
          ))}
          {today.count > today.receipts.length && (
            <li className="text-[11px] text-faint">і ще {today.count - today.receipts.length}</li>
          )}
        </ul>
      )}
    </BentoCell>
  );
}
