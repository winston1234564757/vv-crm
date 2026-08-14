"use client";

import { useMemo, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";
import { SHOP_TIME_ZONE } from "@/lib/utils/day";
import { cn } from "@/lib/utils/cn";
import type { WithdrawalEntry, OwnerShare } from "@/lib/data-dashboard";

interface WithdrawalsHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  withdrawals: WithdrawalEntry[];
  owners: OwnerShare[];
}

/** Форматування повної дати з часом для журналу. */
function formatFullDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  });
  const time = d.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SHOP_TIME_ZONE,
  });
  return { date, time };
}

export function WithdrawalsHistoryDrawer({
  isOpen,
  onClose,
  withdrawals,
  owners,
}: WithdrawalsHistoryDrawerProps) {
  const [search, setSearch] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<"all" | "regular" | "advance">("all");
  const [selectedMethod, setSelectedMethod] = useState<"all" | "cash" | "cashless">("all");

  // Статистика за ВСІМА зняттями (загальна картина)
  const stats = useMemo(() => {
    let totalWithdrawn = 0;
    let totalAdvances = 0;
    let totalCash = 0;
    let totalCashless = 0;
    const perOwner: Record<string, { name: string; isMe: boolean; amount: number; count: number }> = {};

    for (const o of owners) {
      perOwner[o.id] = { name: o.name, isMe: o.isMe, amount: 0, count: 0 };
    }

    for (const w of withdrawals) {
      totalWithdrawn += w.amount;
      if (w.isAdvance) {
        totalAdvances += w.amount;
      }
      if (w.paymentMethod === "cash") {
        totalCash += w.amount;
      } else if (w.paymentMethod === "cashless") {
        totalCashless += w.amount;
      }

      if (w.ownerId && perOwner[w.ownerId]) {
        perOwner[w.ownerId].amount += w.amount;
        perOwner[w.ownerId].count += 1;
      } else {
        const key = w.ownerId || w.ownerName;
        if (!perOwner[key]) {
          perOwner[key] = { name: w.ownerName, isMe: w.isMe, amount: 0, count: 0 };
        }
        perOwner[key].amount += w.amount;
        perOwner[key].count += 1;
      }
    }

    return {
      totalWithdrawn,
      totalAdvances,
      totalRegular: totalWithdrawn - totalAdvances,
      totalCash,
      totalCashless,
      count: withdrawals.length,
      ownersBreakdown: Object.values(perOwner),
    };
  }, [withdrawals, owners]);

  // Фільтрація списку
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return withdrawals.filter((w) => {
      // Пошук
      if (q) {
        const matchName = w.ownerName.toLowerCase().includes(q);
        const matchDesc = (w.description || "").toLowerCase().includes(q);
        const matchSource = w.sourceName.toLowerCase().includes(q);
        const matchAmount = String(w.amount).includes(q);
        if (!matchName && !matchDesc && !matchSource && !matchAmount) {
          return false;
        }
      }

      // Фільтр по власнику
      if (selectedOwner !== "all") {
        if (w.ownerId !== selectedOwner && w.ownerName !== selectedOwner) {
          return false;
        }
      }

      // Фільтр по типу (з ЧП vs аванс)
      if (selectedType === "regular" && w.isAdvance) return false;
      if (selectedType === "advance" && !w.isAdvance) return false;

      // Фільтр по способу оплати
      if (selectedMethod === "cash" && w.paymentMethod !== "cash") return false;
      if (selectedMethod === "cashless" && w.paymentMethod !== "cashless") return false;

      return true;
    });
  }, [withdrawals, search, selectedOwner, selectedType, selectedMethod]);

  const totalFilteredAmount = useMemo(() => {
    return filtered.reduce((s, w) => s + w.amount, 0);
  }, [filtered]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Історія знять чистого прибутку"
      size="half"
    >
      <div className="space-y-6 p-4 sm:p-6 text-ink">
        {/* Підсумковий аналітичний блок */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Картка 1: Загальна сума */}
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-4 space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Всього виплачено
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold tabular text-ink">
                {uah(stats.totalWithdrawn)}
              </span>
              <span className="text-xs text-muted">
                {stats.count} {pluralUk(stats.count, "операція", "операції", "операцій")}
              </span>
            </div>
            <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span>
                З ЧП: <strong className="tabular text-ink">{uah(stats.totalRegular)}</strong>
              </span>
              {stats.totalAdvances > 0 && (
                <span className="text-warning">
                  Аванси: <strong className="tabular">{uah(stats.totalAdvances)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Картка 2: По кожному партнеру */}
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-4 space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Частки партнерів
            </span>
            <div className="space-y-1.5 text-xs">
              {stats.ownersBreakdown.map((ob, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted">
                    <span className={cn("font-medium", ob.isMe ? "text-ink" : "")}>
                      {ob.name.split("@")[0]}
                    </span>
                    {ob.isMe && (
                      <span className="ml-1 text-[10px] text-accent-ink">(ти)</span>
                    )}
                    <span className="ml-1.5 text-[11px] text-faint">
                      · {ob.count} {pluralUk(ob.count, "зняття", "зняття", "зняттів")}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular text-ink">
                    {uah(ob.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Фільтри та швидкий пошук */}
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-subtle/50 p-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Пошук */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Пошук за описом, сейфом або сумою..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted outline-none focus:border-iris transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Фільтр по власнику */}
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-iris"
            >
              <option value="all">Всі партнери</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name.split("@")[0]} {o.isMe ? "(ти)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Швидкі таби (Тип та Метод) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted mr-1">Джерело:</span>
              <button
                type="button"
                onClick={() => setSelectedType("all")}
                className={cn(
                  "rounded px-2 py-1 text-[11px] transition-colors",
                  selectedType === "all"
                    ? "bg-iris text-white font-medium"
                    : "bg-surface text-muted hover:text-ink hover:bg-surface-hover",
                )}
              >
                Всі
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("regular")}
                className={cn(
                  "rounded px-2 py-1 text-[11px] transition-colors",
                  selectedType === "regular"
                    ? "bg-iris text-white font-medium"
                    : "bg-surface text-muted hover:text-ink hover:bg-surface-hover",
                )}
              >
                З сейфа ЧП
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("advance")}
                className={cn(
                  "rounded px-2 py-1 text-[11px] transition-colors",
                  selectedType === "advance"
                    ? "bg-warning text-white font-medium"
                    : "bg-surface text-muted hover:text-ink hover:bg-surface-hover",
                )}
              >
                Аванси
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted mr-1">Оплата:</span>
              <button
                type="button"
                onClick={() => setSelectedMethod("all")}
                className={cn(
                  "rounded px-2 py-1 text-[11px] transition-colors",
                  selectedMethod === "all"
                    ? "bg-iris text-white font-medium"
                    : "bg-surface text-muted hover:text-ink hover:bg-surface-hover",
                )}
              >
                Всі
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod("cash")}
                className={cn(
                  "rounded px-2 py-1 text-[11px] transition-colors",
                  selectedMethod === "cash"
                    ? "bg-iris text-white font-medium"
                    : "bg-surface text-muted hover:text-ink hover:bg-surface-hover",
                )}
              >
                💵 Готівка
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod("cashless")}
                className={cn(
                  "rounded px-2 py-1 text-[11px] transition-colors",
                  selectedMethod === "cashless"
                    ? "bg-iris text-white font-medium"
                    : "bg-surface text-muted hover:text-ink hover:bg-surface-hover",
                )}
              >
                💳 Картка
              </button>
            </div>
          </div>
        </div>

        {/* Лічильник відфільтрованих результатів */}
        <div className="flex items-center justify-between text-xs text-muted px-1">
          <span>
            Знайдено: <strong className="text-ink">{filtered.length}</strong> із {withdrawals.length}
          </span>
          {filtered.length > 0 && (
            <span>
              Сума у вибірці: <strong className="tabular text-ink">{uah(totalFilteredAmount)}</strong>
            </span>
          )}
        </div>

        {/* Список записів історії */}
        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border p-8 text-center text-muted">
            <p className="text-sm font-medium text-ink">Не знайдено жодного зняття</p>
            <p className="mt-1 text-xs">
              {search || selectedOwner !== "all" || selectedType !== "all" || selectedMethod !== "all"
                ? "Спробуйте змінити фільтри або пошуковий запит"
                : "За вказаний період виплат чистого прибутку ще не було"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((w) => {
              const { date, time } = formatFullDateTime(w.at);
              const isNegative = w.amount < 0;

              return (
                <div
                  key={w.id}
                  className={cn(
                    "rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-all hover:border-iris/40 shadow-sm space-y-2.5",
                    w.isAdvance ? "border-warning/30 bg-warning-subtle/10" : "",
                  )}
                >
                  {/* Верхній рядок: Власник + Дата + Сума */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-ink truncate">
                          {w.ownerName}
                        </span>
                        {w.isMe && (
                          <Badge tone="accent">Це ти</Badge>
                        )}
                        {w.isAdvance ? (
                          <Badge tone="warning">⚠️ Аванс наперед</Badge>
                        ) : (
                          <Badge tone="success">Частка з ЧП</Badge>
                        )}
                        {w.paymentMethod && (
                          <Badge tone="neutral">
                            {w.paymentMethod === "cash" ? "💵 Готівка" : "💳 Безготівка"}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted">
                        <span className="font-medium text-ink">{date}</span> о {time}
                      </p>
                    </div>

                    {/* Сума вилучення */}
                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          "text-base font-bold tabular tracking-tight",
                          isNegative ? "text-success" : "text-danger",
                        )}
                      >
                        {isNegative ? "+" : "−"}
                        {uah(Math.abs(w.amount))}
                      </span>
                    </div>
                  </div>

                  {/* Нижній рядок: Джерело списання та детальний опис */}
                  <div className="border-t border-border/60 pt-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 text-xs">
                    <div className="text-muted flex items-center gap-1.5 truncate">
                      <span className="text-faint">Джерело:</span>
                      <span className="font-medium text-ink truncate">{w.sourceName}</span>
                    </div>

                    {w.description && (
                      <div className="text-xs text-muted italic sm:max-w-[60%] text-left sm:text-right">
                        «{w.description}»
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}
