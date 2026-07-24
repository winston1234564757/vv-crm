"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { dayKey, addDays, dayLabel } from "@/lib/utils/day";
import type { DailyShare } from "@/lib/data-daily-share";

function fmt(n: number): string {
  return `${n.toLocaleString("uk-UA")} ₴`;
}

/**
 * Календарна навігація по чистій частці співвласника за день. Уся розбивка
 * приходить із сервера одним масивом (`getDailyShares`), тож перемикання днів
 * миттєве — без запитів. Дні без даних показують нуль. Поле дати дозволяє
 * стрибнути в будь-який день, стрілки — крок на день.
 */
export function DailyShareNavigator({ daily }: { daily: DailyShare[] }) {
  const byDate = useMemo(() => new Map(daily.map((d) => [d.date, d])), [daily]);
  const [selected, setSelected] = useState<string>(() => dayKey(new Date()));

  const row = byDate.get(selected);
  const net = row?.net ?? 0;
  const share = row?.share ?? 0;

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted">Моя частка за день · 50% чистого</p>
        <input
          type="date"
          value={selected}
          onChange={(e) => e.target.value && setSelected(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs text-ink"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSelected((s) => addDays(s, -1))}
          aria-label="Попередній день"
          className="btn-press rounded-[var(--radius-md)] border border-border px-3 py-2 text-base text-muted hover:bg-hover"
        >
          ←
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs capitalize text-muted">{dayLabel(selected)}</p>
          <p
            className={cn(
              "mt-0.5 font-display text-2xl font-semibold tabular tracking-tight",
              share >= 0 ? "text-success" : "text-danger",
            )}
          >
            {fmt(share)}
          </p>
          <p className="text-[11px] text-muted">чистий {fmt(net)}</p>
        </div>

        <button
          type="button"
          onClick={() => setSelected((s) => addDays(s, 1))}
          aria-label="Наступний день"
          className="btn-press rounded-[var(--radius-md)] border border-border px-3 py-2 text-base text-muted hover:bg-hover"
        >
          →
        </button>
      </div>
    </section>
  );
}
