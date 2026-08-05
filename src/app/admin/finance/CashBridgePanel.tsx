import { BentoCell } from "@/components/ui/BentoCell";
import { ViewToggle, type ViewMode } from "@/components/ui/ViewToggle";
import { uah } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import type { CashBridge } from "@/lib/bridge";

/**
 * Міст «прибуток → гроші».
 *
 * Питання, на яке жоден екран не відповідав: заробили 25 385 ₴, а грошей
 * додалось 13 300 ₴ — де решта. Відповідь не одна цифра, а ланцюг: частина
 * осіла в товарі, частина пішла на обладнання, частину власники забрали.
 *
 * Обидва подання читають ОДИН об'єкт `CashBridge`, порахований на сервері.
 * Тут немає жодного обчислення, крім ширини смужки у відсотках — саме тому
 * таблиця й графік не можуть показати різні числа.
 */

/** Найбільше абсолютне значення в ланцюгу — масштаб для смужок. */
function scaleOf(bridge: CashBridge): number {
  return Math.max(
    Math.abs(bridge.netProfit),
    Math.abs(bridge.actual),
    ...bridge.lines.map((l) => Math.abs(l.amount)),
    1,
  );
}

export function CashBridgePanel({ bridge, mode }: { bridge: CashBridge; mode: ViewMode }) {
  const scale = scaleOf(bridge);

  return (
    <BentoCell
      span={8}
      title="Куди поділись зароблені гроші"
      action={<ViewToggle mode={mode} />}
    >
      <p className="mb-4 text-xs leading-relaxed text-muted">
        Прибуток — це не гроші в касі. Ланцюг показує, де вони осіли.
      </p>

      {mode === "chart" ? (
        <BridgeChart bridge={bridge} scale={scale} />
      ) : (
        <BridgeTable bridge={bridge} />
      )}

      {!bridge.balanced && (
        <p className="mt-3 rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 px-3 py-2 text-[11px] leading-relaxed text-danger">
          Нев&apos;язка {uah(bridge.unexplained)}. Модель не пояснює всю різницю між
          прибутком і касою — десь є рух, який не потрапив у жоден рядок. Це
          помилка обліку, і її треба знайти, а не округлити.
        </p>
      )}
    </BentoCell>
  );
}

/* ── Графіки: водоспад ──────────────────────────────────────────────────── */

function Bar({
  label,
  amount,
  scale,
  tone,
  hint,
}: {
  label: string;
  amount: number;
  scale: number;
  tone: "base" | "plus" | "minus" | "total";
  hint?: string;
}) {
  const width = `${Math.max((Math.abs(amount) / scale) * 100, amount === 0 ? 0 : 1.5)}%`;

  return (
    <li className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
      <span className="truncate text-xs text-muted" title={hint}>
        {label}
      </span>
      {/* Смужки ростуть від спільної лівої межі, а не від нуля посередині:
          при восьми рядках центрована вісь дає дві розріджені половини й
          читається гірше, ніж напрям, заданий кольором і знаком. */}
      <span className="flex h-2 items-center overflow-hidden rounded-full bg-hover">
        <span
          className={cn(
            "h-full rounded-full",
            tone === "base" && "bg-ink/70",
            tone === "total" && "bg-accent",
            tone === "plus" && "bg-success",
            tone === "minus" && "bg-danger",
          )}
          style={{ width }}
        />
      </span>
      <span
        className={cn(
          "w-24 shrink-0 text-right text-xs tabular",
          tone === "minus" ? "text-danger" : tone === "plus" ? "text-success" : "font-semibold text-ink",
        )}
      >
        {amount > 0 && (tone === "plus" || tone === "minus") ? "+" : ""}
        {uah(amount)}
      </span>
    </li>
  );
}

function BridgeChart({ bridge, scale }: { bridge: CashBridge; scale: number }) {
  return (
    <ul className="space-y-2">
      <Bar label="Прибуток" amount={bridge.netProfit} scale={scale} tone="base" />

      <li aria-hidden className="!mt-3 border-t border-border" />

      {bridge.lines.map((l) => (
        <Bar
          key={l.key}
          label={l.label}
          amount={l.amount}
          scale={scale}
          tone={l.amount < 0 ? "minus" : "plus"}
          hint={l.hint}
        />
      ))}

      <li aria-hidden className="!mt-3 border-t border-border" />

      <Bar label="Приріст грошей" amount={bridge.actual} scale={scale} tone="total" />
    </ul>
  );
}

/* ── Таблиця ────────────────────────────────────────────────────────────── */

function BridgeTable({ bridge }: { bridge: CashBridge }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Стаття
            </th>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Чому
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Сума
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">
              Прибуток
            </th>
            <td className="py-2 pr-3 leading-relaxed text-faint">
              Заробили за період після операційних витрат.
            </td>
            <td className="py-2 text-right font-semibold tabular text-ink">
              {uah(bridge.netProfit)}
            </td>
          </tr>

          {bridge.lines.map((l) => (
            <tr key={l.key} className="border-b border-border/60">
              <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                {l.label}
              </th>
              <td className="py-2 pr-3 leading-relaxed text-faint">{l.hint}</td>
              <td
                className={cn(
                  "py-2 text-right tabular",
                  l.amount < 0 ? "text-danger" : l.amount > 0 ? "text-success" : "text-muted",
                )}
              >
                {l.amount > 0 ? "+" : ""}
                {uah(l.amount)}
              </td>
            </tr>
          ))}

          <tr>
            <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">
              Приріст грошей
            </th>
            <td className="py-2 pr-3 leading-relaxed text-faint">
              Скільки насправді додалось у касах і сейфах.
            </td>
            <td className="py-2 text-right font-semibold tabular text-accent-ink">
              {uah(bridge.actual)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
