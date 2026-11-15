"use client";

import { useState } from "react";
import { BentoCell } from "@/components/ui/BentoCell";
import { WithdrawShareButton, type CashRegisterSummary } from "./finance/WithdrawShareButton";
import { WithdrawalsHistoryDrawer } from "@/components/WithdrawalsHistoryDrawer";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { LEDGER_MAX_DAYS } from "@/lib/profit";
import { dateTimeShort } from "@/lib/utils/day";
import type { DashboardMoney } from "@/lib/data-dashboard";

function shortName(name: string): string {
  return name.split("@")[0];
}

const WITHDRAWALS_SHOWN = 4;

export function ShareCard({
  ledger,
  withdrawSafes,
  monthShare,
  profitFund = 0,
  cashRegisters = [],
  span = 5,
}: {
  ledger: DashboardMoney["partnerLedger"];
  withdrawSafes: DashboardMoney["withdrawSafes"];
  monthShare: number;
  profitFund?: number;
  cashRegisters?: CashRegisterSummary[];
  span?: 4 | 5 | 6 | 12;
}) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const shown = ledger.withdrawals.slice(0, WITHDRAWALS_SHOWN);
  const hidden = ledger.withdrawals.length - shown.length;
  const mine = ledger.owners.find((o) => o.isMe);

  return (
    <>
      <BentoCell span={span} className="justify-between gap-3.5">
        <div className="space-y-3">
          {/* Шапка картки */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Частки власників · 50/50
              </p>
              <p className="mt-1 text-xs text-muted">
                Доступний пул ЧП:{" "}
                <strong className="font-semibold tabular text-ink">{uah(profitFund)}</strong>
              </p>
            </div>

            {mine && (
              <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated px-2.5 py-1 text-right">
                <span className="block text-[10px] uppercase tracking-wider text-muted">
                  Твій баланс
                </span>
                <span
                  className={cn(
                    "font-display text-sm font-semibold tabular",
                    mine.available >= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {uah(mine.available)}
                </span>
              </div>
            )}
          </div>

          {/* 3-колонкова стрічка бази нарахування */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs">
            <div className="min-w-0">
              <span className="block truncate text-[10px] sm:text-[11px] text-muted">Пул загалом</span>
              <span className="mt-0.5 block font-semibold tabular text-ink">
                {uah(ledger.accrualBase)}
              </span>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[10px] sm:text-[11px] text-muted">Кожному (50%)</span>
              <span className="mt-0.5 block font-semibold tabular text-ink">
                {uah(ledger.accruedPerOwner)}
              </span>
            </div>
            <div className="min-w-0 text-right">
              <span className="block truncate text-[10px] sm:text-[11px] text-muted">За цей місяць</span>
              <span
                className={cn(
                  "mt-0.5 block font-semibold tabular",
                  monthShare >= 0 ? "text-ink" : "text-danger",
                )}
              >
                {uah(monthShare)}
              </span>
            </div>
          </div>

          {/* Таблиця власників */}
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] font-medium text-muted">
                <th className="pb-1.5 font-medium">Власник</th>
                <th className="pb-1.5 text-right font-medium">Знято</th>
                <th className="pb-1.5 text-right font-medium">Доступно</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {ledger.owners.map((o) => (
                <tr key={o.id}>
                  <td className="py-2">
                    <span className={cn("truncate", o.isMe ? "font-semibold text-ink" : "text-muted")}>
                      {shortName(o.name)}
                    </span>
                    {o.isMe && (
                      <span className="ml-1.5 rounded bg-surface-elevated border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink">
                        ти
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular text-muted">{uah(o.withdrawn)}</td>
                  <td
                    className={cn(
                      "py-2 text-right font-semibold tabular",
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
            Зароблено чистими від початку:{" "}
            <span className={cn("tabular font-medium text-ink", ledger.totalNet < 0 && "text-danger")}>
              {uah(ledger.totalNet)}
            </span>
            {ledger.approximate && ` (за останні ${Math.round(LEDGER_MAX_DAYS / 30)} міс.)`}
          </p>

          {ledger.withdrawals.length > 0 && (
            <div className="space-y-1.5 border-t border-border-subtle pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-muted">Останні вилучення</p>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="text-[11px] font-medium text-ink hover:underline transition-colors cursor-pointer"
                >
                  Усі ({ledger.withdrawals.length}) →
                </button>
              </div>

              <div className="space-y-0.5">
                {shown.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="flex w-full items-baseline justify-between gap-2 text-[11px] text-left hover:bg-hover rounded px-1.5 -mx-1.5 py-1 transition-colors cursor-pointer"
                  >
                    <span className="min-w-0 truncate text-muted">
                      <span className="tabular">{dateTimeShort(w.at)}</span>
                      <span className="mx-1.5 text-subtle">·</span>
                      <span className="text-ink">{shortName(w.ownerName)}</span>
                      {w.isAdvance && <span className="ml-1.5 text-warning font-medium">аванс</span>}
                      {w.paymentMethod && (
                        <span className="ml-1.5 text-muted">
                          ({w.paymentMethod === "cash" ? "готівка" : "картка"})
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular",
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
                  className="text-[11px] text-muted hover:text-ink pt-0.5 text-left block cursor-pointer"
                >
                  і ще {hidden} {pluralUk(hidden, "зняття", "зняття", "зняттів")} раніше →
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 border-t border-border-subtle">
          {ledger.withdrawals.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors cursor-pointer"
            >
              Історія знять →
            </button>
          ) : (
            <div />
          )}
          <WithdrawShareButton
            profitFund={profitFund}
            cashRegisters={cashRegisters}
            safes={withdrawSafes}
            label="Зняти частку"
          />
        </div>
      </BentoCell>

      <WithdrawalsHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        withdrawals={ledger.withdrawals}
        owners={ledger.owners}
      />
    </>
  );
}
