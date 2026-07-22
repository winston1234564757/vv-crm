import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  /** What is not here — stated plainly, not apologetically. */
  title: string;
  /** What to do about it. This is the part that earns the space. */
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * The one empty state. Replaces a dozen bare "Нічого не знайдено" lines that
 * told the user nothing about what to do next.
 *
 * Distinguish the two cases at the call site: an empty *table* ("ще немає
 * ремонтів" — teach the next step) is not an empty *filter result* ("нічого не
 * знайдено" — suggest clearing the filter). Passing the same copy for both is
 * how a new user ends up thinking the app is broken.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-hover text-faint">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
