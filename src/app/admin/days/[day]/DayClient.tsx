"use client";

import Link from "next/link";
import { useState } from "react";
import { BentoCell, CardStat } from "@/components/ui/BentoCell";
import { BarSeries, BarAxisTicks } from "@/components/charts/BarSeries";
import Drawer from "@/components/ui/Drawer";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { dayLabel, timeHM } from "@/lib/utils/day";
import { pluralUk } from "@/lib/utils/plural";
import { CATEGORY_LABELS, PROFIT_CATEGORIES } from "@/lib/profit";
import type { DayReport, DayOperationRow, DayExpenseRow, DayMoveRow } from "@/lib/data-day";

type Selected =
  | { kind: "operation"; row: DayOperationRow }
  | { kind: "expense"; row: DayExpenseRow }
  | { kind: "move"; row: DayMoveRow }
  | null;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-ink">{value}</p>
    </div>
  );
}

/**
 * Повний зріз одного дня.
 *
 * Ряди бенто складаються по 12 і сітка сама дірку не закриє (DESIGN.md §4.1):
 * hero 8 + гроші 4 · категорії 8 + погодинно 4 · операції 12 · витрати 6 +
 * рухи 6. Будь-яка зміна набору вимагає перерахувати ряд руками.
 *
 * Інверсна плита рівно одна — hero (§2.1).
 *
 * Кожен рядок клікабельний і відкриває драєр із повними полями. Рядки —
 * `<button>`, а не `<div>` з `onClick`: інакше сторінка мертва з клавіатури.
 */
export function DayClient({ report }: { report: DayReport }) {
  const [selected, setSelected] = useState<Selected>(null);
  const { profit, split, neighbours, previousDay } = report;

  const delta = previousDay ? profit.profit - previousDay.profit : null;
  const expensesTotal = report.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold capitalize tracking-tight text-ink">
            {dayLabel(report.day)}
          </h1>
          <Link
            href="/admin/days"
            className="mt-0.5 inline-block text-xs font-medium text-accent-ink transition-colors hover:text-accent"
          >
            ← усі дні
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {neighbours.prev ? (
            <Link
              href={`/admin/days/${neighbours.prev}`}
              className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-hover"
            >
              ‹ попередній
            </Link>
          ) : (
            <span className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-faint">
              ‹ попередній
            </span>
          )}
          {neighbours.next ? (
            <Link
              href={`/admin/days/${neighbours.next}`}
              className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-hover"
            >
              наступний ›
            </Link>
          ) : (
            <span className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-faint">
              наступний ›
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        <BentoCell span={8} tone="inverse" title="Прибуток дня">
          <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="font-display text-[2.75rem] font-semibold leading-none tabular tracking-tight text-inverse-ink">
              {uah(profit.profit)}
            </span>
            <span className="text-sm text-inverse-muted">
              виторг <span className="tabular text-inverse-ink">{uah(profit.revenue)}</span>
            </span>
            <span className="text-sm text-inverse-muted">
              маржа <span className="tabular text-inverse-ink">{profit.revenue === 0 ? "—" : `${profit.margin}%`}</span>
            </span>
          </p>
          {delta !== null && previousDay && (
            <p className="mt-3 text-xs text-inverse-muted">
              {delta >= 0 ? "+" : "−"}
              <span className="tabular text-accent-on-inverse">{uah(Math.abs(delta))}</span> до{" "}
              <span className="capitalize">{dayLabel(previousDay.day)}</span>
            </p>
          )}
        </BentoCell>

        <BentoCell span={4} title="Гроші дня">
          <CardStat value={uah(split.cashRevenue)} unit="готівкою">
            <span className="text-xs text-muted">
              <span className="tabular">{uah(split.cardRevenue)}</span> карткою
              {split.debt > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold tabular text-danger">{uah(split.debt)}</span> у борг
                </>
              )}
            </span>
          </CardStat>
          <div className="mt-auto space-y-1 border-t border-border pt-3 text-xs">
            <p className="flex justify-between text-muted">
              <span>Витрати</span>
              <span className="tabular text-ink">{uah(expensesTotal)}</span>
            </p>
            <p className="flex justify-between text-muted">
              <span>Чистими</span>
              <span
                className={cn(
                  "font-medium tabular",
                  profit.profit - expensesTotal >= 0 ? "text-success" : "text-danger",
                )}
              >
                {uah(profit.profit - expensesTotal)}
              </span>
            </p>
          </div>

          {report.otherExpenses.length > 0 && (
            <div className="space-y-1 border-t border-border pt-3 text-xs">
              <p className="text-muted">
                Не операційні — капітальні закупи й вилучення частки власником,
                у «Чистими» не входять
              </p>
              <ul className="divide-y divide-border">
                {report.otherExpenses.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelected({ kind: "expense", row: e })}
                      className="flex w-full items-baseline justify-between gap-3 py-1.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink">{e.title}</span>
                      <span className="shrink-0 font-medium tabular text-muted">
                        −{uah(e.amount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </BentoCell>

        <BentoCell span={8} title="Звідки прибуток">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm text-ink">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-muted">
                  <th className="py-2 font-medium">Категорія</th>
                  <th className="py-2 text-right font-medium">Виторг</th>
                  <th className="py-2 text-right font-medium">Собівартість</th>
                  <th className="py-2 text-right font-medium">Прибуток</th>
                  <th className="py-2 text-right font-medium">Маржа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PROFIT_CATEGORIES.map((cat) => {
                  const row = profit.byCategory.find((c) => c.category === cat);
                  const revenue = row?.revenue ?? 0;
                  return (
                    <tr key={cat}>
                      <td className="py-2.5">{CATEGORY_LABELS[cat]}</td>
                      <td className="py-2.5 text-right tabular">{uah(revenue)}</td>
                      <td className="py-2.5 text-right tabular text-muted">{uah(row?.cost ?? 0)}</td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-medium tabular",
                          (row?.profit ?? 0) >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {uah(row?.profit ?? 0)}
                      </td>
                      <td className="py-2.5 text-right tabular text-muted">
                        {revenue === 0 ? "—" : `${row!.margin}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </BentoCell>

        <BentoCell span={4} title="Погодинно">
          {profit.revenue === 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              Того дня нічого не пробили, тож розкладати по годинах нічого.
            </p>
          ) : (
            <>
              <BarSeries
                className="h-32"
                data={report.hourly.map((h) => ({
                  key: String(h.hour),
                  value: h.revenue,
                  tooltip:
                    h.revenue > 0
                      ? `${String(h.hour).padStart(2, "0")}:00 — ${uah(h.revenue)}`
                      : "",
                }))}
              />
              {/* Засічки, а не підпис на кожен стовпчик: доба це 24 стовпчики,
                  а орієнтирів окові треба чотири-п'ять. */}
              <BarAxisTicks ticks={["00", "06", "12", "18", "23"]} />
            </>
          )}
        </BentoCell>

        <BentoCell span={12} title={`Операції дня · ${report.operations.length}`}>
          {report.operations.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              Того дня не пробили жодного чека і не видали жодного ремонту.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {report.operations.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "operation", row: r })}
                    className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{r.title}</span>
                      <span className="block truncate text-[11px] text-muted">
                        <span className="tabular">{timeHM(r.at)}</span>
                        <span className="mx-1.5 text-faint">·</span>
                        {r.customer}
                        {r.kind === "repair" && (
                          <span className="ml-2 text-accent-ink">ремонт</span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular text-ink">
                      {uah(r.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </BentoCell>

        <BentoCell span={6} title={`Витрати · ${uah(expensesTotal)}`}>
          {report.expenses.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted">Того дня нічого не платили.</p>
          ) : (
            <ul className="divide-y divide-border">
              {report.expenses.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "expense", row: e })}
                    className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{e.title}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {e.category}
                        <span className="mx-1.5 text-faint">·</span>
                        {e.safe}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular text-danger">
                      −{uah(e.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </BentoCell>

        <BentoCell span={6} title="Рух по касах">
          {report.moves.length === 0 && report.distributions.count === 0 ? (
            <p className="text-xs leading-relaxed text-muted">Того дня гроші не рухались.</p>
          ) : (
            <ul className="divide-y divide-border">
              {report.moves.map((m) => {
                const moveTitle =
                  m.items && m.items.length > 0
                    ? m.items.length === 1
                      ? `${m.items[0].name} (${m.items[0].quantity} шт)`
                      : `${m.items[0].name} + ще ${m.items.length - 1}`
                    : m.kind;

                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelected({ kind: "move", row: m })}
                      className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{moveTitle}</span>
                        <span className="block truncate text-[11px] text-muted">
                          <span className="tabular">{timeHM(m.at)}</span>
                          <span className="mx-1.5 text-faint">·</span>
                          {m.from} → {m.to}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold tabular text-ink">
                        {uah(m.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {report.distributions.count > 0 && (
                <li className="py-2.5 text-[11px] text-faint">
                  Розподілено по сейфах — <span className="tabular">{uah(report.distributions.total)}</span>,{" "}
                  <span className="tabular">{report.distributions.count}</span>{" "}
                  {pluralUk(report.distributions.count, "переказ", "перекази", "переказів")}.
                  Це автоматика після продажів вище, не окремі події.
                </li>
              )}
            </ul>
          )}
        </BentoCell>
      </div>

      <Drawer
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected?.kind === "operation"
            ? "Операція"
            : selected?.kind === "expense"
              ? "Витрата"
              : "Рух грошей"
        }
        size="half"
      >
        {selected?.kind === "operation" && (
          <div className="space-y-5">
            <div>
              <p className="tabular text-xs text-muted">#{selected.row.id.substring(0, 8)}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{selected.row.title}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Сума" value={<span className="tabular">{uah(selected.row.amount)}</span>} />
              <Field label="Час" value={<span className="tabular">{timeHM(selected.row.at)}</span>} />
              <Field label="Клієнт" value={selected.row.customer} />
              <Field label="Оплата" value={selected.row.payment} />
            </div>

            {selected.row.items && selected.row.items.length > 0 && (
              <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-3.5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Товари та послуги
                </p>
                <ul className="divide-y divide-border/60">
                  {selected.row.items.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-medium text-ink">
                        {it.name} <span className="text-muted">× {it.quantity}</span>
                      </span>
                      <span className="tabular font-semibold text-ink">
                        {uah(it.price * it.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Обидва види операцій — на Продажі: search_transactions матчить
                ремонти по r.id::text так само, як чеки, а /admin/repairs
                узагалі не читає ?q=. */}
            <Link
              href={`/admin/sales?q=${selected.row.id}`}
              className="inline-block text-sm font-medium text-accent-ink transition-colors hover:text-accent"
            >
              Відкрити повністю →
            </Link>
          </div>
        )}

        {selected?.kind === "expense" && (
          <div className="space-y-4">
            <div>
              <p className="tabular text-xs text-muted">#{selected.row.id.substring(0, 8)}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{selected.row.title}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Сума" value={<span className="tabular">{uah(selected.row.amount)}</span>} />
              <Field label="Час" value={<span className="tabular">{timeHM(selected.row.at)}</span>} />
              <Field label="Категорія" value={selected.row.category} />
              <Field label="З якого сейфа" value={selected.row.safe} />
            </div>
          </div>
        )}

        {selected?.kind === "move" && (
          <div className="space-y-5">
            <div>
              <p className="tabular text-xs text-muted">#{selected.row.id.substring(0, 8)}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{selected.row.kind}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Сума" value={<span className="tabular">{uah(selected.row.amount)}</span>} />
              <Field label="Час" value={<span className="tabular">{timeHM(selected.row.at)}</span>} />
              <Field label="Звідки" value={selected.row.from} />
              <Field label="Куди" value={selected.row.to} />
              {selected.row.by && <Field label="Хто провів" value={selected.row.by} />}
            </div>

            {/* Стан рахунків До ➔ Після */}
            {(selected.row.fromBalanceBefore != null || selected.row.toBalanceBefore != null) && (
              <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-3.5 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Стан рахунків (ДО ➔ ПІСЛЯ)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selected.row.fromBalanceBefore != null && selected.row.fromType !== "customer" && selected.row.fromType !== "external" && (
                    <div className="rounded-lg bg-danger/5 border border-danger/15 p-3 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-danger/70">
                        Рахунок-джерело
                      </p>
                      <p className="text-xs font-semibold text-ink truncate">
                        {selected.row.from}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted tabular">{uah(selected.row.fromBalanceBefore)}</span>
                        <span className="text-muted">→</span>
                        <span className="font-bold tabular text-ink">
                          {uah(selected.row.fromBalanceAfter ?? (selected.row.fromBalanceBefore - selected.row.amount))}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-danger tabular">
                        ▼ −{uah(selected.row.amount)}
                      </p>
                    </div>
                  )}

                  {selected.row.toBalanceBefore != null && selected.row.toType !== "external" && selected.row.toType !== "supplier" && (
                    <div className="rounded-lg bg-success/5 border border-success/15 p-3 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-success/70">
                        Рахунок-одержувач
                      </p>
                      <p className="text-xs font-semibold text-ink truncate">
                        {selected.row.to}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted tabular">{uah(selected.row.toBalanceBefore)}</span>
                        <span className="text-muted">→</span>
                        <span className="font-bold tabular text-ink">
                          {uah(selected.row.toBalanceAfter ?? (selected.row.toBalanceBefore + selected.row.amount))}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-success tabular">
                        ▲ +{uah(selected.row.amount)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selected.row.items && selected.row.items.length > 0 && (
              <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-3.5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Товари та послуги
                </p>
                <ul className="divide-y divide-border/60">
                  {selected.row.items.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-medium text-ink">
                        {it.name} <span className="text-muted">× {it.quantity}</span>
                      </span>
                      <span className="tabular font-semibold text-ink">
                        {uah(it.price * it.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.row.description && (
              <Field label="Опис" value={selected.row.description} />
            )}
            {selected.row.href && (
              <Link
                href={selected.row.href}
                className="inline-block text-sm font-medium text-accent-ink transition-colors hover:text-accent"
              >
                Знайти цю операцію →
              </Link>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
