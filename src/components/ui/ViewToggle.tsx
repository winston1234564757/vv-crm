"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Перемикач подання: графіки чи таблиця.
 *
 * Двоє власників читають одні й ті самі гроші по-різному: один хоче щільну
 * таблицю з числами, другий — форму й пропорції. Робити для цього два звіти
 * означало б два конвеєри даних, а два конвеєри рано чи пізно розходяться —
 * рівно так згоріла сторінка «Звіти» 30.07, де виторг був завищений на 5 150 ₴
 * (причина записана в `nav-config.ts`).
 *
 * Тому перемикається САМЕ ПОДАННЯ, а не джерело. Обидві гілки рендеряться з
 * одного об'єкта, порахованого на сервері, і арифметики в них немає — лише
 * форматування. Розбіжність між виглядами фізично неможлива.
 *
 * Стан в URL, а не в localStorage: сторінка серверна, і localStorage дав би
 * спалах чужого подання на кожному завантаженні. URL ще й пересилається —
 * «глянь ось це» відкриється тим самим виглядом, яким його дивились.
 */

export type ViewMode = "chart" | "table";

export const VIEW_MODES: ViewMode[] = ["chart", "table"];

const LABELS: Record<ViewMode, string> = {
  chart: "Графіки",
  table: "Таблиця",
};

export function isViewMode(v: string | null | undefined): v is ViewMode {
  return v === "chart" || v === "table";
}

/** Читає режим із `searchParams` серверної сторінки. За замовчуванням — графіки. */
export function resolveViewMode(v: string | string[] | undefined): ViewMode {
  const raw = Array.isArray(v) ? v[0] : v;
  return isViewMode(raw) ? raw : "chart";
}

export function ViewToggle({ mode }: { mode: ViewMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(next: ViewMode) {
    if (next === mode) return;
    // Решта параметрів зберігається: перемикання вигляду не має скидати період.
    const q = new URLSearchParams(params.toString());
    q.set("view", next);
    startTransition(() => router.replace(`${pathname}?${q.toString()}`));
  }

  return (
    <div
      role="tablist"
      aria-label="Подання"
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] bg-hover p-1",
        isPending && "opacity-60",
      )}
    >
      {VIEW_MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={m === mode}
          onClick={() => select(m)}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-medium transition-colors",
            m === mode ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  );
}
