import { uah } from "@/lib/utils/money";
import { Meter } from "@/components/charts/Meter";
import { CATEGORY_LABELS, type AveragesTotals, type ProfitCategory } from "@/lib/profit";

/** «Середній Х» з правильним родом — узгодження на regex ламало «аксесуара». */
const AVG_LABEL: Record<ProfitCategory, string> = {
  device: "середній телефон",
  accessory: "середній аксесуар",
  part: "середня запчастина",
  service: "середня послуга",
  repair: "середній ремонт",
};

/** `19,2` — уk-UA кома замість крапки, як і скрізь у грошових числах. */
function num(n: number, digits: number): string {
  return n.toLocaleString("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Скільки магазин у середньому робить на день і на тиждень — від фінансової
 * епохи до зараз.
 *
 * «Тиждень» тут не сім реальних тижнів історії, а той самий день × 7:
 * `averages.days` рідко ділиться на сім націло, і показувати як факт число,
 * якого магазин ще не прожив, було б тим самим вигаданим показником, від
 * якого відмовились у «Гроші в наявності» ({@link CashCard}). Підпис знизу
 * каже це прямо.
 *
 * Без кольорових крапок і смуг за категоріями — DESIGN.md §7 забороняє
 * акценти, які лише розфарбовують рядки й не несуть стану; те саме рішення,
 * що вже прибрало кольорові індикатори з «Статусу активів» і смуги з кас.
 * Частка категорії — той самий сірий `Meter`, що й у «Витратах за
 * категоріями» на Фінансах.
 */
export function AveragesPanel({ averages }: { averages: AveragesTotals }) {
  const perDay = (total: number) => total / averages.days;
  const perWeek = (total: number) => (total / averages.days) * 7;

  const maxRevenue = Math.max(...averages.byCategory.map((c) => c.revenue), 1);
  const avgReceipt = averages.receipts > 0 ? averages.revenue / averages.receipts : null;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted">
        Від фінансової епохи до зараз — <span className="tabular text-ink">{num(averages.days, 1)}</span>{" "}
        {averages.days < 2 ? "день" : "дні"} історії.
      </p>

      {/* Гроші: день і тиждень поруч, тиждень — довідково дрібнішим кеглем. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {[
          { label: "Виторг", day: perDay(averages.revenue), week: perWeek(averages.revenue) },
          { label: "Валовий прибуток", day: perDay(averages.grossProfit), week: perWeek(averages.grossProfit) },
          { label: "Опер. витрати", day: perDay(averages.opex), week: perWeek(averages.opex) },
          { label: "Чистими", day: perDay(averages.netProfit), week: perWeek(averages.netProfit) },
        ].map((row) => (
          <div key={row.label}>
            <p className="text-[11px] text-muted">{row.label}</p>
            <p className="font-display text-lg font-semibold tabular tracking-tight text-ink">
              {uah(row.day)}
              <span className="ml-1 text-xs font-normal text-faint">/день</span>
            </p>
            <p className="text-[11px] tabular text-faint">{uah(row.week)}/тиждень</p>
          </div>
        ))}
      </div>

      {/* Одиниці: скільки штук у середньому проходить через каси. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
        {averages.byCategory.map((c) => (
          <div key={c.category}>
            <p className="text-[11px] text-muted">{CATEGORY_LABELS[c.category]}</p>
            <p className="font-display text-lg font-semibold tabular tracking-tight text-ink">
              {num(perDay(c.units), 2)}
              <span className="ml-1 text-xs font-normal text-faint">/день</span>
            </p>
            <p className="text-[11px] tabular text-faint">≈ {num(perWeek(c.units), 1)}/тиждень</p>
          </div>
        ))}
      </div>

      {/* Розклад по категоріях: частка у виторзі — сірий Meter, без кольору
          за типом, і маржа поруч — той самий рядок, що каже і скільки, і
          наскільки вигідно. */}
      <div className="space-y-3 border-t border-border pt-4">
        {averages.byCategory
          .filter((c) => c.revenue > 0 || c.units > 0)
          .map((c) => (
            <div key={c.category} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium text-ink">{CATEGORY_LABELS[c.category]}</span>
                <span className="text-faint">
                  {c.units} шт · <span className="tabular text-muted">{uah(c.revenue)}</span> ·{" "}
                  <span className="tabular text-muted">{c.margin}% маржа</span>
                </span>
              </div>
              <Meter value={Math.round((c.revenue / maxRevenue) * 100)} />
            </div>
          ))}
      </div>

      {/* Середній чек. */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-xs">
        {avgReceipt !== null && (
          <span className="text-muted">
            середній чек <span className="font-medium tabular text-ink">{uah(avgReceipt)}</span>
          </span>
        )}
        {averages.byCategory
          .filter((c) => c.units > 0)
          .map((c) => (
            <span key={c.category} className="text-muted">
              {AVG_LABEL[c.category]}{" "}
              <span className="font-medium tabular text-ink">{uah(c.revenue / c.units)}</span>
            </span>
          ))}
      </div>

      <p className="text-[11px] leading-relaxed text-faint">
        «На тиждень» — не сім прожитих тижнів, а день × 7: реальної історії поки{" "}
        {num(averages.days, 1)} дні. Раннє число, не стала норма.
      </p>
    </div>
  );
}
