import { BentoCell } from "@/components/ui/BentoCell";
import { uah } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { CATEGORY_LABELS } from "@/lib/profit";
import type { ViewMode } from "@/components/ui/ViewToggle";
import type { SkuReport } from "@/lib/data-sku";

/**
 * Що продається — у штуках.
 *
 * Раніше `quantity` жила в базі лише як множник собівартості, тож питання
 * «який товар найкраще йде» не мало відповіді. Виторг сам по собі відповідає
 * неправильно: один апарат за 17 000 ₴ важить більше за сотню скл, хоча возити
 * треба скло.
 *
 * Сортування за штуками навмисно: за гривнями список завжди очолює техніка, і
 * дрібний товар, який робить обіг, у нього не потрапляє.
 */

const TOP_N = 8;

export function SkuPanel({ report, mode }: { report: SkuReport; mode: ViewMode }) {
  const lines = report.lines.slice(0, TOP_N);
  const maxUnits = Math.max(...lines.map((l) => l.units), 1);

  return (
    <BentoCell span={12} title="Що продається — у штуках">
      {report.empty || lines.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          За цей період продажів немає.
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs leading-relaxed text-muted">
            За 30 днів продано <span className="tabular text-ink">{report.unitsTotal}</span> шт на{" "}
            <span className="tabular text-ink">{uah(report.revenueTotal)}</span>. Ремонти сюди не
            входять — у них немає позиції каталогу.
          </p>

          {mode === "chart" ? (
            <ul className="space-y-2.5">
              {lines.map((l) => (
                <li
                  key={l.key}
                  className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3"
                >
                  <span className="truncate text-xs text-ink" title={l.name ?? undefined}>
                    {l.name ?? <span className="text-faint">Товар видалено</span>}
                    <span className="ml-1.5 text-[11px] text-faint">
                      {CATEGORY_LABELS[l.itemType]}
                    </span>
                  </span>
                  <span className="flex h-2 items-center overflow-hidden rounded-full bg-hover">
                    <span
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max((l.units / maxUnits) * 100, 2)}%` }}
                    />
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3 text-xs">
                    <span className="w-12 text-right font-semibold tabular text-ink">
                      {l.units} шт
                    </span>
                    <span className="w-20 text-right tabular text-muted">{uah(l.revenue)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-faint">
                    <th scope="col" className="py-1.5 pr-3 text-left font-medium">
                      Позиція
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-left font-medium">
                      Тип
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                      Штук
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                      Чеків
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                      Виторг
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                      Прибуток
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Маржа
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key} className="border-b border-border/60">
                      <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                        {l.name ?? <span className="text-faint">Товар видалено</span>}
                      </th>
                      <td className="py-2 pr-3 text-muted">{CATEGORY_LABELS[l.itemType]}</td>
                      <td className="py-2 pr-3 text-right font-semibold tabular text-ink">
                        {l.units}
                      </td>
                      <td className="py-2 pr-3 text-right tabular text-muted">{l.receipts}</td>
                      <td className="py-2 pr-3 text-right tabular text-ink">{uah(l.revenue)}</td>
                      <td
                        className={cn(
                          "py-2 pr-3 text-right tabular",
                          l.profit < 0 ? "text-danger" : "text-ink",
                        )}
                      >
                        {uah(l.profit)}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right tabular",
                          l.margin < 0 ? "text-danger" : "text-muted",
                        )}
                      >
                        {l.margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.lines.length > TOP_N && (
            <p className="mt-3 text-[11px] text-faint">
              Показано {TOP_N} з {report.lines.length} позицій.
            </p>
          )}
        </>
      )}
    </BentoCell>
  );
}
