import { BentoCell, BentoLink, CardStat } from "@/components/ui/BentoCell";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { timeHM } from "@/lib/utils/day";
import type { DashboardMoney } from "@/lib/data-dashboard";

/**
 * Усі операції за сьогодні — товарні чеки і закриті ремонти в одному списку,
 * так само як їх показує сторінка Продажів. Виторг угорі рахується за всіма
 * категоріями, тож він збігається з hero: раніше картка ремонти виключала і
 * два числа на одному екрані законно розходились.
 *
 * Ремонт стає рядком за датою закриття (оплата, а для безкоштовних — видача),
 * а не за датою прийому: саме тоді гроші зайшли.
 *
 * Суми в рядках — це збережений підсумок чека (для ремонту — його ціна), тож
 * вони можуть не скластися у виторг угорі на розмір знижки. Це навмисно:
 * рядок відповідає на «що пробили», а верхня цифра — на «скільки заробили».
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
            на <span className="font-semibold tabular text-ink">{uah(today.revenue)}</span>{" "}
            <span className="text-faint">з ремонтами</span>
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
          Сьогодні ще нічого не пробили. Кожен чек і закритий ремонт з&apos;явиться тут із часом і
          сумою — свіжий зверху.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {today.receipts.map((r) => (
            <li
              key={`${r.kind}-${r.id}`}
              className="flex items-baseline justify-between gap-3 py-2 first:pt-0"
            >
              <span className="min-w-0 truncate text-[13px] text-muted">
                <span className="tabular">{timeHM(r.at)}</span>
                {r.kind === "repair" && (
                  <span className="ml-2 text-[11px] text-accent-ink">ремонт</span>
                )}
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular text-ink">
                {uah(r.amount)}
              </span>
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
