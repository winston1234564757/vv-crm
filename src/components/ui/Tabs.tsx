"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Optional count badge shown after the label */
  count?: number;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/**
 * Accessible, state-based tabs (role=tablist). Underline style, keyboard
 * arrow navigation. For route-based section navigation use SectionTabs instead.
 */
export function Tabs<T extends string = string>({
  tabs,
  value,
  onValueChange,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = tabs.findIndex((t) => t.value === value);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    onValueChange(tabs[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("flex items-center gap-1 border-b border-border overflow-x-auto", className)}
    >
      {tabs.map((tab, i) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "relative flex items-center gap-2 whitespace-nowrap border-b-2 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
              size === "sm" ? "px-3 py-2 text-xs" : "px-3.5 py-2.5 text-sm",
              active
                ? "border-accent text-accent-ink"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular",
                  active ? "bg-accent-subtle text-accent-ink" : "bg-hover text-faint",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
