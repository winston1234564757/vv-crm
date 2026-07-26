"use client";

import { WithdrawShareButton } from "./finance/WithdrawShareButton";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  RANGE_PRESETS,
  RANGE_LABELS,
  CATEGORY_LABELS,
  PROFIT_CATEGORIES,
  LEDGER_MAX_DAYS,
  type RangePreset,
} from "@/lib/profit";
import type { DashboardMoney, PartnerLedger } from "@/lib/data-dashboard";
import type { SalesTargets } from "@/lib/data-settings";
import { cn } from "@/lib/utils/cn";
import { pluralUk } from "@/lib/utils/plural";
import { dayKey, addDays, dayLabel } from "@/lib/utils/day";

/** Наскільки днів назад дозволяємо гортати вкладку «Сьогодні». */
const DAY_NAV_LOOKBACK = 30;

function fmt(n: number): string {
  return `${Math.round(n).toLocaleString("uk-UA")} ₴`;
}

function TargetRow({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 0;
  const met = value >= target;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("font-medium tabular", met ? "text-success" : "text-ink")}>
          {fmt(value)} / {fmt(target)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
        <div
          className={cn("h-full rounded-full transition-all", met ? "bg-success" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The real-margin counterpart to `AttentionSection`. Preset switching writes
 * `?range=` and lets the server component re-read it (§4.7 of the handoff) —
 * no client-side profit math, `computeProfit` runs once, server-side, in
 * `getDashboardMoney`.
 *
 * `byCategory` always renders all five rows, even at zero revenue, so the
 * table doesn't reshuffle between presets — a category with zero revenue
 * shows "—" for margin instead of a 0% that would misleadingly read as
 * "sold at cost".
 */
export function MoneySection({
  preset,
  selectedDay,
  money,
  targets,
}: {
  preset: RangePreset;
  /** Обраний минулий день (`YYYY-MM-DD`) на вкладці «Сьогодні», або null. */
  selectedDay: string | null;
  money: DashboardMoney;
  targets: SalesTargets;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function selectPreset(next: RangePreset) {
    if (next === preset) return;
    startTransition(() => {
      router.replace(`${pathname}?range=${next}`);
    });
  }

  // Денна навігація на вкладці «Сьогодні». Сьогодні = чистий `?range=today`;
  // минулий день несе `&day=`. Гортати можна на 30 днів назад, не в майбутнє.
  const todayKey = dayKey(new Date());
  const activeDay = selectedDay ?? todayKey;
  const minKey = addDays(todayKey, -DAY_NAV_LOOKBACK);
  const isToday = activeDay >= todayKey;

  function goToDay(next: string) {
    const clamped = next < minKey ? minKey : next > todayKey ? todayKey : next;
    if (clamped === activeDay) return;
    const url =
      clamped === todayKey ? `${pathname}?range=today` : `${pathname}?range=today&day=${clamped}`;
    startTransition(() => {
      router.replace(url);
    });
  }

  // Футер завжди показує поточний місяць, незалежно від обраного пресету —
  // так само як `monthProfit`. Інакше перемикання вкладок міняє значення
  // "Чистими" без зміни підпису.
  const monthNet = money.monthProfit - money.monthExpenses;
  const hasTargets = targets.daily !== null || targets.monthly !== null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted">Гроші</h2>
        <div
          role="tablist"
          aria-label="Період"
          className={cn(
            "flex items-center gap-1 rounded-[var(--radius-md)] bg-hover p-1 transition-opacity",
            isPending && "opacity-60",
          )}
        >
          {RANGE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === preset}
              onClick={() => selectPreset(p)}
              className={cn(
                "rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
                p === preset ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {RANGE_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-5 p-5">
        {preset === "today" && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4 transition-opacity",
              isPending && "opacity-60",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => goToDay(addDays(activeDay, -1))}
                disabled={activeDay <= minKey}
                aria-label="Попередній день"
                className="btn-press rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-base text-muted hover:bg-hover disabled:pointer-events-none disabled:opacity-40"
              >
                ←
              </button>
              <p className="min-w-0 flex-1 truncate text-center text-xs font-medium capitalize text-ink">
                {isToday ? "Сьогодні" : dayLabel(activeDay)}
              </p>
              <button
                type="button"
                onClick={() => goToDay(addDays(activeDay, 1))}
                disabled={activeDay >= todayKey}
                aria-label="Наступний день"
                className="btn-press rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-base text-muted hover:bg-hover disabled:pointer-events-none disabled:opacity-40"
              >
                →
              </button>
            </div>
            <input
              type="date"
              value={activeDay}
              min={minKey}
              max={todayKey}
              onChange={(e) => e.target.value && goToDay(e.target.value)}
              aria-label="Обрати день"
              className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs text-ink"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-muted">Виторг</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular tracking-tight text-ink">
              {fmt(money.profit.revenue)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Валовий прибуток</p>
            <p
              className={cn(
                "mt-1 font-display text-2xl font-semibold tabular tracking-tight",
                money.profit.profit >= 0 ? "text-success" : "text-danger",
              )}
            >
              {fmt(money.profit.profit)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Маржа</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular tracking-tight text-ink">
              {money.profit.margin}%
            </p>
          </div>
        </div>

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
                const row = money.profit.byCategory.find((c) => c.category === cat);
                const revenue = row?.revenue ?? 0;
                const cost = row?.cost ?? 0;
                const profit = row?.profit ?? 0;
                return (
                  <tr key={cat}>
                    <td className="py-2.5">{CATEGORY_LABELS[cat]}</td>
                    <td className="py-2.5 text-right tabular">{fmt(revenue)}</td>
                    <td className="py-2.5 text-right tabular text-muted">{fmt(cost)}</td>
                    <td
                      className={cn(
                        "py-2.5 text-right tabular font-medium",
                        profit >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {fmt(profit)}
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

        {hasTargets && (
          <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
            {targets.daily !== null && (
              <TargetRow label="Ціль на сьогодні" value={money.todayProfit} target={targets.daily} />
            )}
            {targets.monthly !== null && (
              <TargetRow label="Ціль на місяць" value={money.monthProfit} target={targets.monthly} />
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs">
          <span className="text-muted">
            Місяць, витрати: <span className="font-medium text-ink">{fmt(money.monthExpenses)}</span>
          </span>
          <span className="text-muted">
            Чистими:{" "}
            <span className={cn("font-medium", monthNet >= 0 ? "text-success" : "text-danger")}>
              {fmt(monthNet)}
            </span>
          </span>
          <span className="text-muted">
            Каса: <span className="font-medium text-ink">{fmt(money.cashTotal)}</span>
          </span>
          <span className="text-muted">
            Запас OPEX:{" "}
            <span className="font-medium text-ink">
              {money.runwayDays} {pluralUk(money.runwayDays, "день", "дні", "днів")}
            </span>
          </span>
          <Link href="/admin/finance" className="ml-auto font-medium text-accent-ink hover:text-accent">
            Фінанси →
          </Link>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted">Моя частка · 50% чистого</p>
            {money.partnerLedger.owners.find((o) => o.isMe) && (
              <span className="text-[11px] font-medium text-accent">
                Доступно до зняття:{" "}
                <span className="font-bold">
                  {fmt(money.partnerLedger.owners.find((o) => o.isMe)!.available)}
                </span>
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-4">
            <PartnerShareCell label="Сьогодні" net={money.partnerShare.today.net} share={money.partnerShare.today.share} />
            <PartnerShareCell label="Тиждень" net={money.partnerShare.week.net} share={money.partnerShare.week.share} />
            <PartnerShareCell label="Місяць" net={money.partnerShare.month.net} share={money.partnerShare.month.share} />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            День і тиждень можуть сильно стрибати — витрати (оренда, зарплата) лягають одним днем, тож день з орендою
            виглядає глибоко мінусовим, а тихий день — навпаки високим; місяць — стабільніша цифра.
          </p>

          <OwnerLedger ledger={money.partnerLedger} sources={money.sources} />
        </div>
      </div>
    </section>
  );
}

/** Пошта як ім'я нечитабельна в таблиці — лишаємо частину до «@». */
function shortName(name: string): string {
  return name.split("@")[0];
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Скільки зняттів показуємо, перш ніж згорнути решту в підпис. */
const WITHDRAWALS_SHOWN = 5;

/**
 * Спільний рахунок обох власників: скільки кожному нараховано, скільки він
 * уже взяв і що лишилось. Обидва бачать однакову картину — з цим блоком
 * питання «а ти скільки брав» перестає бути усною домовленістю.
 *
 * Нараховано однакове для обох (50/50), тому виноситься над таблицею, а не
 * дублюється в кожному рядку.
 */
function OwnerLedger({
  ledger,
  sources,
}: {
  ledger: PartnerLedger;
  sources: DashboardMoney["sources"];
}) {
  const shown = ledger.withdrawals.slice(0, WITHDRAWALS_SHOWN);
  const hidden = ledger.withdrawals.length - shown.length;

  return (
    <div className="mt-3 space-y-3 rounded-[var(--radius-md)] bg-hover/50 p-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-muted">
          Чистими від початку обліку:{" "}
          <span className={cn("font-medium tabular", ledger.totalNet >= 0 ? "text-ink" : "text-danger")}>
            {fmt(ledger.totalNet)}
          </span>
        </span>
        <span className="text-muted">
          Нараховано кожному (50%):{" "}
          <span className="font-medium text-ink tabular">{fmt(ledger.accruedPerOwner)}</span>
        </span>
      </div>

      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border/60 text-[11px] font-medium text-muted">
            <th className="pb-1.5 font-medium">Власник</th>
            <th className="pb-1.5 text-right font-medium">Знято</th>
            <th className="pb-1.5 text-right font-medium">Залишок</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {ledger.owners.map((o) => (
            <tr key={o.id}>
              <td className="py-1.5">
                <span className={cn(o.isMe ? "font-semibold text-ink" : "text-muted")}>
                  {shortName(o.name)}
                </span>
                {o.isMe && <span className="ml-1.5 text-[10px] text-accent-ink">це ти</span>}
              </td>
              <td className="py-1.5 text-right tabular text-muted">{fmt(o.withdrawn)}</td>
              <td
                className={cn(
                  "py-1.5 text-right font-semibold tabular",
                  o.available >= 0 ? "text-success" : "text-danger",
                )}
              >
                {fmt(o.available)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {ledger.exceedsCash && (
        <p className="text-[11px] text-warning">
          У касах і сейфах разом {fmt(ledger.cashOnHand)} — менше, ніж належить обом. Зняти все
          одразу не вийде.
        </p>
      )}
      {ledger.approximate && (
        <p className="text-[11px] text-muted">
          Нарахування рахується за останні {Math.round(LEDGER_MAX_DAYS / 30)} місяців — те, що
          заробили раніше, сюди не входить.
        </p>
      )}

      {shown.length > 0 && (
        <div className="space-y-1 border-t border-border/60 pt-2">
          <p className="text-[11px] font-medium text-muted">Історія зняттів</p>
          {shown.map((w) => (
            <div key={w.id} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-muted">
                <span className="tabular">{shortDate(w.at)}</span>
                <span className="mx-1.5 text-faint">·</span>
                {shortName(w.ownerName)}
                <span className="mx-1.5 text-faint">·</span>
                {w.source}
              </span>
              <span className="shrink-0 font-medium tabular text-danger">−{fmt(w.amount)}</span>
            </div>
          ))}
          {hidden > 0 && (
            <p className="text-[11px] text-faint">
              і ще {hidden} {pluralUk(hidden, "зняття", "зняття", "зняттів")} раніше
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <WithdrawShareButton
          safes={sources.filter((s) => s.type === "safe")}
          cashRegisters={sources.filter((s) => s.type === "cash_register")}
          label="💵 Зняти свою частку"
        />
      </div>
    </div>
  );
}

function PartnerShareCell({ label, net, share }: { label: string; net: number; share: number }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-display text-lg font-semibold tabular tracking-tight",
          share >= 0 ? "text-success" : "text-danger",
        )}
      >
        {fmt(share)}
      </p>
      <p className="text-[11px] text-muted">чистий {fmt(net)}</p>
    </div>
  );
}
