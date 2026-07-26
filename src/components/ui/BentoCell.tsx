import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Клітинка бенто-сітки дашборду (DESIGN.md §4.1).
 *
 * Клітинка САМА є карткою — всередині неї картки не буває. Групувати вміст
 * усередині можна лінією `border-t` або панеллю `bg-hover`, але не другою
 * обведеною поверхнею з тінню.
 *
 * Спани — статичні класи з мапи нижче, а не інтерпольований рядок:
 * Tailwind сканує вихідний код і `col-span-${n}` для нього не існує.
 */

export type BentoSpan = 4 | 6 | 8 | 12;

const SPAN_CLASS: Record<BentoSpan, string> = {
  4: "md:col-span-3 lg:col-span-4",
  6: "md:col-span-6 lg:col-span-6",
  8: "md:col-span-6 lg:col-span-8",
  12: "md:col-span-6 lg:col-span-12",
};

interface BentoCellProps {
  children: ReactNode;
  span?: BentoSpan;
  /** `inverse` — темна плита. Рівно одна на екран (DESIGN.md §2.1). */
  tone?: "surface" | "inverse";
  title?: string;
  /** Дія праворуч від заголовка: посилання «далі» чи кнопка. */
  action?: ReactNode;
  className?: string;
}

export function BentoCell({
  children,
  span = 4,
  tone = "surface",
  title,
  action,
  className,
}: BentoCellProps) {
  const inverse = tone === "inverse";

  return (
    <section
      className={cn(
        "flex flex-col rounded-[var(--radius-lg)] border p-5",
        inverse
          ? "border-inverse-border bg-inverse-surface"
          : "card border-border bg-surface",
        SPAN_CLASS[span],
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h2
              className={cn(
                "text-xs font-semibold",
                inverse ? "text-inverse-muted" : "text-muted",
              )}
            >
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Посилання «далі» в шапці клітинки. Окремий компонент, бо в бенто їх багато
 * і кожне має однаково виглядати й однаково реагувати на наведення.
 */
export function BentoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 text-[11px] font-medium text-accent-ink transition-colors hover:text-accent"
    >
      {children} →
    </Link>
  );
}
