"use client";

import { useState } from "react";
import { BentoCell } from "@/components/ui/BentoCell";
import { WithdrawShareButton } from "./finance/WithdrawShareButton";
import { WithdrawalsHistoryDrawer } from "@/components/WithdrawalsHistoryDrawer";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { LEDGER_MAX_DAYS } from "@/lib/profit";
import { dateTimeShort } from "@/lib/utils/day";
import type { DashboardMoney } from "@/lib/data-dashboard";

/** Пошта як ім'я нечитабельна в таблиці — лишаємо частину до «@». */
function shortName(name: string): string {
  return name.split("@")[0];
}

/** Скільки зняттів показуємо, перш ніж згорнути решту в підпис. */
const WITHDRAWALS_SHOWN = 4;

/**
 * Спільний рахунок обох власників: скільки кожному нараховано, скільки він
 * уже взяв і що лишилось. Обидва бачать однакову картину — з цим блоком
 * питання «а ти скільки брав» перестає бути усною домовленістю.
 *
 * Нараховано однакове для обох (50/50), тому стоїть над таблицею, а не
 * дублюється в кожному рядку.
 *
 * Усі числа над таблицею — з сейфа ЧП, крім «за цей місяць»: це темп
 * заробітку, а не гроші, які можна взяти. Тому воно і підписане окремо.
 */
export function ShareCard({
  ledger,
  withdrawSafes,
  monthShare,
}: {
  ledger: DashboardMoney["partnerLedger"];
  /**
   * Усі сейфи з половинами балансу. Джерело частки — тільки ЧП, але решта
   * потрібна формі під аванс, коли в ЧП не вистачило; розкладає їх сама кнопка.
   */
  withdrawSafes: DashboardMoney["withdrawSafes"];
  /** Зароблено кожному за поточний місяць — темп, а не залишок. */
  monthShare: number;
}) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const shown = ledger.withdrawals.slice(0, WITHDRAWALS_SHOWN);
  const hidden = ledger.withdrawals.length - shown.length;
  const mine = ledger.owners.find((o) => o.isMe);

  return (
    <>
      <BentoCell
        span={4}
        title="Частки власників · 50/50"
        action={
          mine && (
            <span className="shrink-0 text-[11px] text-muted">
              тобі{" "}
              <span
                className={cn(
                  "font-semibold tabular",
                  mine.available >= 0 ? "text-success" : "text-danger",
                )}
              >
                {uah(mine.available)}
              </span>
            </span>
          )
        }
        className="gap-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
          <span className="text-muted">
            У сейфі ЧП:{" "}
            <span className="font-medium tabular text-ink">{uah(ledger.accrualBase)}</span>
          </span>
          <span className="text-muted">
            кожному <span className="font-medium tabular text-ink">{uah(ledger.accruedPerOwner)}</span>
          </span>
          <span className="text-muted">
            зароблено за місяць{" "}
            <span className={cn("font-medium tabular", monthShare >= 0 ? "text-ink" : "text-danger")}>
              {uah(monthShare)}
            </span>
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium text-muted">
              <th className="pb-1.5 font-medium">Власник</th>
              <th className="pb-1.5 text-right font-medium">Знято</th>
              <th className="pb-1.5 text-right font-medium">Залишок</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ledger.owners.map((o) => (
              <tr key={o.id}>
                <td className="py-1.5">
                  <span className={cn("truncate", o.isMe ? "font-semibold text-ink" : "text-muted")}>
                    {shortName(o.name)}
                  </span>
                  {o.isMe && <span className="ml-1.5 text-[10px] text-accent-ink">це ти</span>}
                </td>
                <td className="py-1.5 text-right tabular text-muted">{uah(o.withdrawn)}</td>
                <td
                  className={cn(
                    "py-1.5 text-right font-semibold tabular",
                    o.available >= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {uah(o.available)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[11px] text-muted">
          Зароблено чистими{" "}
          <span className={cn("tabular", ledger.totalNet >= 0 ? "" : "text-danger")}>
            {uah(ledger.totalNet)}
          </span>
          , у сейф заведено <span className="tabular">{uah(ledger.totalDistributed)}</span>. Частка
          рахується лише з сейфа — решта ще працює в обороті.
          {ledger.approximate && ` Зароблене — за останні ${Math.round(LEDGER_MAX_DAYS / 30)} місяців.`}
        </p>

        {ledger.withdrawals.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-muted">Хто скільки знімав</p>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="text-[11px] font-medium text-accent-ink hover:underline transition-colors"
              >
                Вся історія ({ledger.withdrawals.length}) →
              </button>
            </div>

            <div className="space-y-1">
              {shown.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex w-full items-baseline justify-between gap-2 text-[11px] text-left hover:bg-surface-hover/80 rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer"
                >
                  <span className="min-w-0 truncate text-muted">
                    <span className="tabular">{dateTimeShort(w.at)}</span>
                    <span className="mx-1.5 text-faint">·</span>
                    {shortName(w.ownerName)}
                    {w.isAdvance && <span className="ml-1.5 text-warning font-medium">аванс</span>}
                    {w.paymentMethod && (
                      <span className="ml-1.5 text-faint">
                        ({w.paymentMethod === "cash" ? "готівка" : "картка"})
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-medium tabular",
                      w.amount < 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {w.amount < 0 ? "+" : "−"}
                    {uah(Math.abs(w.amount))}
                  </span>
                </button>
              ))}
            </div>

            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="text-[11px] text-accent-ink hover:underline pt-0.5 text-left block"
              >
                і ще {hidden} {pluralUk(hidden, "зняття", "зняття", "зняттів")} раніше · переглянути всі →
              </button>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          {ledger.withdrawals.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1"
            >
              📋 Історія знять
            </button>
          ) : <div />}
          <WithdrawShareButton safes={withdrawSafes} label="Зняти свою частку" />
        </div>
      </BentoCell>

      {/* Модальне вікно з повною історією та фільтрами */}
      <WithdrawalsHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        withdrawals={ledger.withdrawals}
        owners={ledger.owners}
      />
    </>
  );
}
