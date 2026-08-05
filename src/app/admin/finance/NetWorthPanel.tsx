"use client";

import { useCallback, useState } from "react";
import { BentoCell, CardStat } from "@/components/ui/BentoCell";
import { Meter } from "@/components/charts/Meter";
import { DrilldownModal } from "@/components/finance/DrilldownModal";
import { getWorthPartRows } from "@/lib/data-drilldown";
import { uah } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import type { ViewMode } from "@/components/ui/view-mode";
import type { NetWorth } from "@/lib/bridge";

/**
 * Скільки коштує бізнес просто зараз.
 *
 * Каси, сейфи, склад і борги все лежало в базі, але ніде не зводилось — на
 * пряме питання «скільки в нас усього» жоден екран не відповідав.
 *
 * Склад рахується за СОБІВАРТІСТЮ. По цінниках це показувало б прибуток, якого
 * ще не заробили: роздрібна ціна — надія, а не актив.
 *
 * Кожна стаття клікабельна: за «Технікою на складі» стоїть список апаратів із
 * закупівельною ціною й вкладеним ремонтом, за «Сейфами» — самі сейфи. Число,
 * яке не можна розкрити, доводиться приймати на віру.
 */
export function NetWorthPanel({ worth, mode }: { worth: NetWorth; mode: ViewMode }) {
  const parts = worth.parts.filter((p) => p.amount !== 0);
  const assets = parts.filter((p) => p.kind === "asset");
  const liabilities = parts.filter((p) => p.kind === "liability");
  const scale = Math.max(...parts.map((p) => Math.abs(p.amount)), 1);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openLabel, setOpenLabel] = useState("");

  const open = (key: string, label: string) => {
    setOpenKey(key);
    setOpenLabel(label);
  };

  const load = useCallback(() => getWorthPartRows(openKey ?? ""), [openKey]);

  return (
    <BentoCell span={4} title="Скільки коштує бізнес">
      <CardStat value={uah(worth.total)} unit="усього">
        <span className="text-xs text-muted">по {uah(worth.perOwner)} на власника</span>
      </CardStat>

      {mode === "chart" ? (
        <ul className="space-y-1">
          {assets.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => open(p.key, p.label)}
                className="-mx-2 grid w-full grid-cols-[minmax(0,7rem)_1fr_auto] cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-hover"
              >
                <span className="truncate text-left text-xs text-muted">{p.label}</span>
                <Meter value={(p.amount / scale) * 100} className="min-w-0" />
                <span className="w-20 shrink-0 text-right text-xs tabular text-ink">
                  {uah(p.amount)}
                </span>
              </button>
            </li>
          ))}
          {liabilities.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => open(p.key, p.label)}
                className="-mx-2 flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-[var(--radius-sm)] px-2 py-1 text-xs transition-colors hover:bg-hover"
              >
                <span className="text-muted">{p.label}</span>
                <span className="tabular text-danger">−{uah(p.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse text-xs">
          <tbody>
            {parts.map((p) => (
              <tr
                key={p.key}
                onClick={() => open(p.key, p.label)}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-hover"
              >
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
          можна витратити сьогодні, друге спершу треба продати. */}
      <p className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-faint">
        Живими грошима <span className="tabular text-muted">{uah(worth.liquid)}</span>, у товарі за
        собівартістю <span className="tabular text-muted">{uah(worth.inventory)}</span>.
      </p>

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
