"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { dayLabel } from "@/lib/utils/day";
import { pluralUk } from "@/lib/utils/plural";
import type { DayRow } from "@/lib/data-day";

/**
 * Список днів. Порожні дні не ховаються: день без продажів справді дав нуль, а
 * дірка в списку читалась би як втрата даних. Але нульовий рядок блідий, щоб
 * око чіплялось за робочі дні.
 *
 * Перехід у день — справжній `<Link>` у першій клітинці, а не кнопка з
 * `router.push`: посилання нативно дає ctrl/cmd-клік «відкрити в новій
 * вкладці», ПКМ «копіювати адресу» і роботу без JS. Кнопка все це відбирає, а
 * повертає лише те, що й так є в посилання.
 *
 * `onClick` на всьому `<tr>` — зручність для миші поверх посилання, а не
 * заміна йому: клікабельним виглядає весь рядок, тож нехай весь рядок і
 * працює. Клік по самому посиланню гасить спливання, інакше `router.push`
 * спрацював би двічі.
 */
export function DaysTable({ rows }: { rows: DayRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Ще жодного дня від відкриття магазину.
      </p>
    );
  }

  return (
    <div className={cn("-mx-1 overflow-x-auto transition-opacity", isPending && "opacity-60")}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted">
            <th className="py-2 font-medium">День</th>
            <th className="py-2 text-right font-medium">Виторг</th>
            <th className="py-2 text-right font-medium">Прибуток</th>
            <th className="py-2 text-right font-medium">Маржа</th>
            <th className="py-2 text-right font-medium">Витрати</th>
            <th className="py-2 text-right font-medium">Чистими</th>
            <th className="py-2 text-right font-medium">Операцій</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const quiet = r.operations === 0;
            return (
              <tr
                key={r.day}
                className="cursor-pointer transition-colors hover:bg-hover"
                onClick={() => startTransition(() => router.push(`/admin/days/${r.day}`))}
              >
                <td className="py-2.5">
                  <Link
                    href={`/admin/days/${r.day}`}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "capitalize outline-none focus-visible:underline",
                      quiet ? "text-muted" : "text-ink",
                    )}
                  >
                    {dayLabel(r.day)}
                  </Link>
                </td>
                <td className={cn("py-2.5 text-right tabular", quiet ? "text-faint" : "text-ink")}>
                  {uah(r.revenue)}
                </td>
                <td
                  className={cn(
                    "py-2.5 text-right font-medium tabular",
                    quiet ? "text-faint" : r.profit >= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {uah(r.profit)}
                </td>
                <td className="py-2.5 text-right tabular text-muted">
                  {r.revenue === 0 ? "—" : `${r.margin}%`}
                </td>
                <td className="py-2.5 text-right tabular text-muted">{uah(r.expenses)}</td>
                <td
                  className={cn(
                    "py-2.5 text-right tabular",
                    quiet ? "text-faint" : r.net >= 0 ? "text-ink" : "text-danger",
                  )}
                >
                  {uah(r.net)}
                </td>
                <td className={cn("py-2.5 text-right tabular", quiet ? "text-faint" : "text-muted")}>
                  {r.operations} {pluralUk(r.operations, "операція", "операції", "операцій")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
