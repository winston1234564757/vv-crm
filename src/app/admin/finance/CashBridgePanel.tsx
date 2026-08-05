"use client";

import { useCallback, useState } from "react";
import { BentoCell } from "@/components/ui/BentoCell";
import { ViewToggle } from "@/components/ui/ViewToggle";
import type { ViewMode } from "@/components/ui/view-mode";
import { Meter } from "@/components/charts/Meter";
import { DrilldownModal } from "@/components/finance/DrilldownModal";
import { getBridgeLineRows } from "@/lib/data-drilldown";
import { uah } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import type { CashBridge } from "@/lib/bridge";

/**
 * Міст «прибуток → гроші».
 *
 * Заробили 25 385 ₴, а грошей додалось 13 300 ₴ — питання не в одній цифрі, а
 * в ланцюгу: частина осіла в товарі, частина пішла на обладнання, частину
 * власники забрали.
 *
 * ПОЯСНЕННЯ СТАТЕЙ ТУТ БІЛЬШЕ НЕМАЄ. Вони стояли окремою колонкою «ЧОМУ» просто
 * в таблиці й займали більше місця, ніж самі суми — колонка з грошима навіть
 * не вміщалась на екран. Таблицю відкривають по числа; пояснення потрібне рівно
 * тоді, коли стаття незрозуміла, тобто в момент кліку. Там воно й лежить.
 *
 * Кожен рядок відкриває список операцій, з яких склалось число. Доти кожна
 * стаття була кінцевою точкою: цифру видно, перевірити нічим.
 *
 * Обидва подання читають ОДИН об'єкт `CashBridge`. Тут немає жодного
 * обчислення, крім ширини смужки у відсотках — саме тому таблиця й графік не
 * можуть показати різні числа.
 */

function scaleOf(bridge: CashBridge): number {
  return Math.max(
    Math.abs(bridge.netProfit),
    Math.abs(bridge.actual),
    ...bridge.lines.map((l) => Math.abs(l.amount)),
    1,
  );
}

/** Опорні рядки ланцюга не мають своїх операцій — вони підсумки, а не стаття. */
const TERMINAL_KEYS = new Set(["__profit", "__actual"]);

export function CashBridgePanel({ bridge, mode }: { bridge: CashBridge; mode: ViewMode }) {
  const scale = scaleOf(bridge);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openLabel, setOpenLabel] = useState("");

  const open = (key: string, label: string) => {
    if (TERMINAL_KEYS.has(key)) return;
    setOpenKey(key);
    setOpenLabel(label);
  };

  // `useCallback` не косметика: `DrilldownModal` тягне дані в ефекті з `load`
  // у залежностях, і нова функція на кожен рендер зациклила б запит.
  const load = useCallback(() => getBridgeLineRows(openKey ?? ""), [openKey]);

  return (
    <BentoCell
      span={8}
      title="Куди поділись зароблені гроші"
      action={<ViewToggle mode={mode} />}
    >
      <p className="mb-4 text-xs leading-relaxed text-muted">
        Прибуток — це не гроші в касі.{" "}
        <span className="text-faint">
          Від початку обліку, не за обраний період. Клік по рядку — усі операції.
        </span>
      </p>

      {mode === "chart" ? (
        <BridgeChart bridge={bridge} scale={scale} onOpen={open} />
      ) : (
        <BridgeTable bridge={bridge} onOpen={open} />
      )}

      {!bridge.balanced && (
        <p className="mt-3 rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 px-3 py-2 text-[11px] leading-relaxed text-danger">
          Нев&apos;язка {uah(bridge.unexplained)}. Модель не пояснює всю різницю між
          прибутком і касою — десь є рух, який не потрапив у жоден рядок.
        </p>
      )}

      {/* `key` — щоб на кожну статтю монтувався свіжий екземпляр: інакше
          довелось би скидати стан ефектом, а це зайвий каскадний рендер. */}
      {openKey !== null && (
        <DrilldownModal
          key={openKey}
          onClose={() => setOpenKey(null)}
          title={openLabel}
          load={load}
        />
      )}
    </BentoCell>
  );
}

/* ── Графіки: водоспад ──────────────────────────────────────────────────── */

const METER_TONE = {
  base: "neutral",
  total: "accent",
  plus: "success",
  minus: "danger",
} as const;

function Bar({
  itemKey,
  label,
  amount,
  scale,
  tone,
  onOpen,
}: {
  itemKey: string;
  label: string;
  amount: number;
  scale: number;
  tone: "base" | "plus" | "minus" | "total";
  onOpen: (key: string, label: string) => void;
}) {
  const pct = amount === 0 ? 0 : (Math.abs(amount) / scale) * 100;
  const clickable = !TERMINAL_KEYS.has(itemKey);

  const content = (
    <>
      <span className="truncate text-left text-xs text-muted">{label}</span>
      <Meter size="md" value={pct} tone={METER_TONE[tone]} />
      <span
        className={cn(
          "w-24 shrink-0 text-right text-xs tabular",
          tone === "minus" ? "text-danger" : tone === "plus" ? "text-success" : "font-semibold text-ink",
        )}
      >
        {amount > 0 && (tone === "plus" || tone === "minus") ? "+" : ""}
        {uah(amount)}
      </span>
    </>
  );

  const grid = "grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3";

  return (
    <li>
      {clickable ? (
        <button
          type="button"
          onClick={() => onOpen(itemKey, label)}
          className={cn(
            grid,
            "-mx-2 cursor-pointer rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-hover",
          )}
        >
          {content}
        </button>
      ) : (
        <div className={grid}>{content}</div>
      )}
    </li>
  );
}

function BridgeChart({
  bridge,
  scale,
  onOpen,
}: {
  bridge: CashBridge;
  scale: number;
  onOpen: (key: string, label: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      <Bar
        itemKey="__profit"
        label="Прибуток"
        amount={bridge.netProfit}
        scale={scale}
        tone="base"
        onOpen={onOpen}
      />

      <li aria-hidden className="!mt-3 border-t border-border" />

      {bridge.lines.map((l) => (
        <Bar
          key={l.key}
          itemKey={l.key}
          label={l.label}
          amount={l.amount}
          scale={scale}
          tone={l.amount < 0 ? "minus" : "plus"}
          onOpen={onOpen}
        />
      ))}

      <li aria-hidden className="!mt-3 border-t border-border" />

      <Bar
        itemKey="__actual"
        label="Приріст грошей"
        amount={bridge.actual}
        scale={scale}
        tone="total"
        onOpen={onOpen}
      />
    </ul>
  );
}

/* ── Таблиця ────────────────────────────────────────────────────────────── */

function BridgeTable({
  bridge,
  onOpen,
}: {
  bridge: CashBridge;
  onOpen: (key: string, label: string) => void;
}) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-border text-[11px] uppercase tracking-wide text-faint">
          <th scope="col" className="py-1.5 pr-3 text-left font-medium">
            Стаття
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
          <td className="py-2 text-right font-semibold tabular text-ink">{uah(bridge.netProfit)}</td>
        </tr>

        {bridge.lines.map((l) => (
          <tr
            key={l.key}
            onClick={() => onOpen(l.key, l.label)}
            className="cursor-pointer border-b border-border/60 transition-colors hover:bg-hover"
          >
            <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
              {l.label}
            </th>
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
          <td className="py-2 text-right font-semibold tabular text-accent-ink">
            {uah(bridge.actual)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
