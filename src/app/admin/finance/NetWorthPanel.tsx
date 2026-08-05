import { BentoCell, CardStat } from "@/components/ui/BentoCell";
import { uah } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import type { ViewMode } from "@/components/ui/ViewToggle";
import type { NetWorth } from "@/lib/bridge";

/**
 * Скільки коштує бізнес просто зараз.
 *
 * Каси, сейфи, склад і борги все лежало в базі, але ніде не зводилось — на
 * пряме питання «скільки в нас усього» жоден екран не відповідав.
 *
 * Склад рахується за СОБІВАРТІСТЮ. Порахувати його по цінниках означало б
 * показати прибуток, якого ще не заробили: роздрібна ціна — це надія, а не
 * актив. Різниця тут не косметична — товару на складі більше, ніж грошей у касі.
 */
export function NetWorthPanel({ worth, mode }: { worth: NetWorth; mode: ViewMode }) {
  const assets = worth.parts.filter((p) => p.kind === "asset" && p.amount !== 0);
  const liabilities = worth.parts.filter((p) => p.kind === "liability" && p.amount !== 0);
  const scale = Math.max(...worth.parts.map((p) => Math.abs(p.amount)), 1);

  return (
    <BentoCell span={4} title="Скільки коштує бізнес">
      <CardStat value={uah(worth.total)} unit="усього">
        <span className="text-xs text-muted">
          по {uah(worth.perOwner)} на власника
        </span>
      </CardStat>

      {mode === "chart" ? (
        <ul className="space-y-2">
          {assets.map((p) => (
            <li key={p.key} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-2">
              <span className="truncate text-xs text-muted">{p.label}</span>
              <span className="flex items-center gap-2">
                <span className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-hover">
                  <span
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max((p.amount / scale) * 100, 1.5)}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-xs tabular text-ink">
                  {uah(p.amount)}
                </span>
              </span>
            </li>
          ))}
          {liabilities.map((p) => (
            <li key={p.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-muted">{p.label}</span>
              <span className="tabular text-danger">−{uah(p.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse text-xs">
          <tbody>
            {worth.parts
              .filter((p) => p.amount !== 0)
              .map((p) => (
                <tr key={p.key} className="border-b border-border/60">
                  <th scope="row" className="py-1.5 text-left font-normal text-muted">
                    {p.label}
                  </th>
                  <td
                    className={cn(
                      "py-1.5 text-right tabular",
                      p.kind === "liability" ? "text-danger" : "text-ink",
                    )}
                  >
                    {p.kind === "liability" ? "−" : ""}
                    {uah(p.amount)}
                  </td>
                </tr>
              ))}
            <tr>
              <th scope="row" className="py-2 text-left font-semibold text-ink">
                Разом
              </th>
              <td className="py-2 text-right font-semibold tabular text-ink">{uah(worth.total)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Поділ на «зараз» і «в товарі» — головне, що тут треба знати: перше
          можна витратити сьогодні, друге спершу треба продати. Без цього рядка
          загальна сума виглядає доступнішою, ніж вона є. */}
      <p className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-faint">
        Живими грошима <span className="tabular text-muted">{uah(worth.liquid)}</span>, у товарі за
        собівартістю <span className="tabular text-muted">{uah(worth.inventory)}</span>. Товар стане
        грошима лише після продажу, тож на витрати сьогодні є тільки перша сума.
      </p>
    </BentoCell>
  );
}
