import { cn } from "@/lib/utils/cn";

export type StatTone = "default" | "accent" | "success" | "warning" | "danger" | "info";

const valueTones: Record<StatTone, string> = {
  default: "text-ink",
  accent: "text-accent-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Secondary line under the value */
  sub?: React.ReactNode;
  tone?: StatTone;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Single metric card primitive. Replaces the duplicated StatCard blocks in
 * repairs / devices / sales / dashboard. Value uses the display font + tabular
 * figures; no glow orbs, no double headings, no eyebrow noise.
 */
export function StatCard({ label, value, sub, tone = "default", icon, onClick, className }: StatCardProps) {
  const interactive = typeof onClick === "function";
  const Comp = interactive ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "card p-5 text-left w-full flex flex-col gap-1",
        interactive && "card-hover btn-press cursor-pointer",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && <span className="text-faint shrink-0">{icon}</span>}
      </div>
      <p className={cn("font-display text-2xl font-semibold tabular tracking-tight mt-1", valueTones[tone])}>
        {value}
      </p>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </Comp>
  );
}
