import { cn } from "@/lib/utils/cn";

export interface PageHeaderProps {
  title: string;
  /** One line of orientation: counts, scope, period. Not a tagline. */
  subtitle?: React.ReactNode;
  /** Primary page action(s), right-aligned on desktop. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The single page header.
 *
 * Every admin page had grown its own: `sales/page.tsx` used a plain h1 on the
 * new tokens, `RepairsClient.tsx` an icon chip in a legacy violet tint with the
 * subtitle indented 46px to clear it. Same rank in the hierarchy, two different
 * shapes — so moving between pages read as moving between apps.
 *
 * No icon chip on purpose: the sidebar already says which section this is, and
 * repeating it as decoration pushes the actual content down the page.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-balance">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
