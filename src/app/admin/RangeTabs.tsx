"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_PRESETS, RANGE_LABELS, type RangePreset } from "@/lib/profit";
import { cn } from "@/lib/utils/cn";

/**
 * Єдиний перемикач періоду на сторінці.
 *
 * Раніше їх було три: цей таблист, стрілки «← день →» усередині грошового
 * блоку і власний датапікер у навігаторі часток. Лишився один; конкретний
 * день дивимось кліком по точці графіка.
 *
 * Керує ЛИШЕ грошовими клітинками. Черга ремонтів, готові до видачі й
 * замовлення — це поточний стан, а не період, і на пресет не реагують.
 *
 * Оновлення ручне: дашборд рендериться `force-dynamic`, тож дані свіжі на
 * кожну навігацію, але вкладка може провисіти відкритою півдня. Фонового
 * полінгу немає навмисно — він коштував би повного перезапиту щохвилини
 * заради екрана, на який ніхто не дивиться.
 */
export function RangeTabs({ preset }: { preset: RangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  function select(next: RangePreset) {
    if (next === preset && !params.get("date")) return;
    const q = new URLSearchParams(params.toString());
    q.set("range", next);
    if (next !== "today") {
      q.delete("date");
    }
    startTransition(() => router.replace(`${pathname}?${q.toString()}`));
  }

  function refresh() {
    startTransition(() => {
      router.refresh();
      setRefreshedAt(new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }));
    });
  }

  return (
    <div className={cn("flex items-center gap-2", isPending && "opacity-60")}>
      {/*
        Горизонтальний скрол, а не перенос: на 390px «Цей місяць» і «Минулий
        місяць» ламались кожен на два рядки, і смуга з п'яти вкладок займала
        три поверхи. `whitespace-nowrap` + `shrink-0` тримають один рядок,
        решта від'їжджає пальцем.
      */}
      <div
        role="tablist"
        aria-label="Період"
        className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-[var(--radius-md)] bg-hover p-1 [scrollbar-width:none] md:flex-none [&::-webkit-scrollbar]:hidden"
      >
        {RANGE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === preset}
            onClick={() => select(p)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
              p === preset ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {RANGE_LABELS[p]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        className="btn-press shrink-0 whitespace-nowrap rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-ink disabled:pointer-events-none"
      >
        {isPending ? "Оновлюю…" : "Оновити"}
      </button>

      {refreshedAt && !isPending && (
        <span className="hidden shrink-0 text-[11px] tabular text-faint sm:inline">
          о {refreshedAt}
        </span>
      )}
    </div>
  );
}
