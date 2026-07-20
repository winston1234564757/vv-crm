"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { IconSpinner } from "@/components/icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
  /** Optional leading icon element */
  leadingIcon?: React.ReactNode;
}

const base =
  "btn-press inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active",
  secondary:
    "bg-surface text-ink border border-border-strong hover:bg-hover active:bg-hover",
  ghost: "bg-transparent text-muted hover:bg-hover hover:text-ink",
  danger: "bg-danger text-on-accent hover:brightness-95 active:brightness-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

/**
 * The single button primitive for the app. Replaces the ~20 copy-pasted
 * violet CTA blocks. Every button gets default/hover/active/focus/disabled/loading.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    fullWidth = false,
    leadingIcon,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {isLoading ? (
        <IconSpinner size={16} className="animate-spin" />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  );
});
