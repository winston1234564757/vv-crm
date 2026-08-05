import { cn } from "@/lib/utils/cn";

/**
 * Стовпчики однієї серії: погодинний виторг, динаміка обороту, будь-яка
 * величина в часі.
 *
 * Був написаний двічі — у `days/[day]/DayClient.tsx` і `sales/SalesAnalytics.tsx` —
 * і копії встигли розійтись у дрібницях: радіус 2px проти 3px, проміжок 2px
 * проти 4px, мінімальна висота ненульового стовпчика 3% проти 2%. Жодна з
 * різниць не була рішенням; просто друга копія писалась окремо. Один графік у
 * застосунку не має виглядати інакше за інший без причини.
 *
 * ЧОМУ НЕ RECHARTS. `ProfitChart` бере його заслужено: там дві серії, плавна
 * інтерполяція, градієнтна заливка й курсор-перехрестя. Тут — прямокутники
 * фіксованої ширини й підказка на наведення; recharts на це витратив би
 * ~40 КБ і власну систему координат заради того, що робить `flex` і відсоток
 * висоти. Спільним лишається СЛОВНИК: один акцентний колір на серію, приглушений
 * фон для нуля, підказка тим самим тоном.
 *
 * Легенди немає навмисно: серія одна, і її називає заголовок картки. Легенда
 * потрібна від двох серій — тоді це вже інший компонент.
 */

export interface BarDatum {
  /** Стабільний ключ для React. */
  key: string;
  value: number;
  /** Текст підказки на наведення. Порожній — підказки не буде. */
  tooltip: string;
}

/**
 * Ненульове значення мусить лишатись видимим, навіть якщо воно мізерне поруч
 * із піком: стовпчик у 0.4 px читається як «нічого не було», а це неправда.
 */
const MIN_VISIBLE_PCT = 3;
/** Нульовий стовпчик — тонка риска основи, щоб було видно, що година існувала. */
const ZERO_PCT = 1;

export function BarSeries({
  data,
  /** Висота поля стовпчиків. Підписи осі йдуть окремо під ним. */
  className,
}: {
  data: BarDatum[];
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("flex items-end gap-[2px]", className)}>
      {data.map((d) => {
        const pct =
          d.value > 0
            ? Math.max(Math.round((d.value / max) * 100), MIN_VISIBLE_PCT)
            : ZERO_PCT;

        return (
          <div key={d.key} className="group relative flex-1">
            <div
              className={cn(
                "w-full rounded-t-[4px] transition-all",
                d.value > 0 ? "bg-accent" : "bg-hover",
              )}
              style={{ height: `${pct}%` }}
            />
            {d.tooltip && (
              /* Підказка живе в потоці стовпчика, а не в порталі: картки бенто
                 не мають `overflow: hidden`, тож вона нікуди не ріжеться, а
                 портал додав би позиціювання й стан заради того самого. */
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-ink px-2 py-1 text-xs tabular text-surface group-hover:block">
                {d.tooltip}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Підписи під стовпчиками, по одному на стовпчик.
 *
 * Коли їх стає забагато, показує кожен `nth` — решта лишаються порожніми
 * комірками, щоб сітка не поїхала. Ховати підпис, а не звужувати шрифт:
 * дрібніше за 9px читає лише той, хто вже знає, що там написано.
 */
export function BarAxis({
  labels,
  maxLabels = 16,
}: {
  labels: string[];
  maxLabels?: number;
}) {
  const nth = labels.length > maxLabels ? Math.ceil(labels.length / maxLabels) : 1;

  return (
    <div className="mt-2 flex gap-[2px]">
      {labels.map((label, i) => (
        <span
          key={i}
          className="flex-1 truncate text-center text-[9px] tabular text-faint"
        >
          {i % nth === 0 ? label : ""}
        </span>
      ))}
    </div>
  );
}

/**
 * Осьові засічки з рівними проміжками — для серій, де підписувати кожен
 * стовпчик безглуздо (доба: 24 стовпчики, а орієнтирів треба п'ять).
 */
export function BarAxisTicks({ ticks }: { ticks: string[] }) {
  return (
    <div className="mt-1 flex justify-between text-[9px] tabular text-faint">
      {ticks.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
