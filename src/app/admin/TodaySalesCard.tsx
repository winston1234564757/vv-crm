import { BentoCell, BentoLink, CardStat } from "@/components/ui/BentoCell";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { timeHM } from "@/lib/utils/day";
import type { DashboardMoney } from "@/lib/data-dashboard";

/**
 * Усі операції за сьогодні — товарні чеки і видані ремонти в одному списку,
 * тим самим днем, що й на сторінці Продажів. Виторг угорі рахується за всіма
 * категоріями, тож він збігається з hero: раніше картка ремонти виключала і
 * два числа на одному екрані законно розходились.
 *
 * Ремонт стає рядком у день видачі клієнту, а не прийому чи оплати: робота
 * здана — виторг наш (`repairSettledAt`).
 *
 * Через це розбивка має третій доданок. Ремонт, виданий у борг, — виторг, за
 * яким каса порожня; без окремого «у борг» він сів би в готівку залишком, і
 * картка показувала б гроші, яких у касі нема.
 *
 * Суми в рядках — це збережений підсумок чека (для ремонту — його ціна), тож
 * вони можуть не скластися у виторг угорі на розмір знижки. Це навмисно:
 * рядок відповідає на «що пробили», а верхня цифра — на «скільки заробили».
 *
 * Список повний — усі операції дня, без «і ще N». У завантажений день він
 * прокручується всередині картки, щоб не розтягувати ряд бенто сусідам.
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
            {today.debt > 0 && (
              <>
                {" · "}
                <span className="font-semibold tabular text-danger">{uah(today.debt)}</span> у борг
              </>
            )}
          </span>
        )}
      </CardStat>

      {today.count === 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          Сьогодні ще нічого не пробили. Кожен чек і виданий ремонт з&apos;явиться тут із часом і
          сумою — свіжий зверху.
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto pr-1">
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
        </ul>
      )}
    </BentoCell>
  );
}
