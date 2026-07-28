import { BentoCell, BentoLink, CardStat } from "@/components/ui/BentoCell";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import type { DashboardMoney } from "@/lib/data-dashboard";

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Продажі за сьогодні. За назвою картки — ЛИШЕ продажі: `today.revenue`
 * рахується з `byCategory` без категорії `repair`, на відміну від hero, де
 * виторг за сьогодні включає й ремонти. Знижка так само вже розкидана по
 * позиціях (`allocateSaleRevenue`), а не сума `sales.total_amount`.
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
      <CardStat value={today.count} unit={pluralUk(today.count, "чек", "чеки", "чеків")}>
        {today.count > 0 && (
          <span className="text-xs text-muted">
            на <span className="font-semibold tabular text-ink">{uah(today.revenue)}</span>
          </span>
        )}
        {today.count > 0 && (
          <span className="text-xs text-muted">
            {uah(today.cashRevenue)} готівкою · {uah(today.cardRevenue)} карткою
          </span>
        )}
      </CardStat>

      {today.count === 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          Сьогодні ще нічого не пробили. Кожен чек з&apos;явиться тут із часом і сумою — свіжий
          зверху.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {today.receipts.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
              <span className="text-[13px] tabular text-muted">{time(r.at)}</span>
              <span className="text-[13px] font-semibold tabular text-ink">{uah(r.amount)}</span>
            </li>
          ))}
          {today.count > today.receipts.length && (
            <li className="pt-2 text-[11px] text-faint">
              і ще {today.count - today.receipts.length}
            </li>
          )}
        </ul>
      )}
    </BentoCell>
  );
}
