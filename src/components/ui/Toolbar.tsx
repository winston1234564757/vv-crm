"use client";

import { forwardRef, useId } from "react";
import { IconSearch, IconClose } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import { fieldClass } from "@/components/ui/Input";

export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Accessible name. Visually the placeholder carries it. */
  label?: string;
  /** Shows a clear button and fires this when pressed. */
  onClear?: () => void;
}

/**
 * Search input with the magnifier and a clear affordance.
 *
 * `type="search"` rather than `type="text"`: it gives Escape-to-clear and the
 * correct on-screen keyboard for free. The visible clear button stays because
 * the native one is absent on Firefox and unreliable on mobile.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { label = "Пошук", onClear, className, value, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasValue = typeof value === "string" && value.length > 0;

  return (
    <div className={cn("relative w-full", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <IconSearch size={15} />
      </span>
      <input
        ref={ref}
        id={inputId}
        type="search"
        value={value}
        className={cn(fieldClass, "border-border pl-9", hasValue && onClear && "pr-9")}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Очистити пошук"
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <IconClose size={13} />
        </button>
      )}
    </div>
  );
});

export interface ToolbarProps {
  /** Search field, or anything that should sit at the start of the row. */
  search?: React.ReactNode;
  /** Filters — selects and chips. Wraps onto its own line when tight. */
  children?: React.ReactNode;
  /** Trailing controls, e.g. a view toggle. Stays pinned to the end. */
  trailing?: React.ReactNode;
  className?: string;
}

/** The row above every list: search on the left, filters and view controls on the right. */
export function Toolbar({ search, children, trailing, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {search && <div className="w-full sm:max-w-xs">{search}</div>}
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {children}
        {trailing}
      </div>
    </div>
  );
}
