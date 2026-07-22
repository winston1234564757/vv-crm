"use client";

import { useState, useRef, useEffect, useId, useMemo } from "react";
import { IconSearch, IconChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import { fieldClass } from "@/components/ui/Input";

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  name: string;
  required?: boolean;
}

/**
 * Searchable single-select used for customer and item pickers.
 *
 * Rewritten from a div-based dropdown: the trigger was a `<div onClick>`, so it
 * could not be reached by keyboard at all, and the options were divs with no
 * roles. On the repair form that meant the customer field was unusable without
 * a mouse — the first field of the most-used form in the app.
 *
 * The props are unchanged, so callers keep working.
 */
export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  name,
  required = false,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();

  const selectedOption = options.find((opt) => opt.id === value);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.subLabel?.toLowerCase().includes(term),
    );
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Opening focuses the filter box; the list starts on the current selection.
  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    const current = options.findIndex((o) => o.id === value);
    setActiveIndex(current >= 0 ? current : 0);
    searchRef.current?.focus();
  }, [isOpen, options, value]);

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function commit(id: string) {
    onChange(id);
    setIsOpen(false);
    setSearch("");
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) commit(opt.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor={`${baseId}-trigger`} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>

      <button
        id={`${baseId}-trigger`}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${baseId}-list` : undefined}
        className={cn(fieldClass, "border-border flex cursor-pointer items-center justify-between gap-2 text-left")}
      >
        <span className={cn("truncate", selectedOption ? "text-ink" : "text-faint")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <IconChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      {/* The real form value. Kept outside the button so it posts with the form. */}
      <input type="hidden" name={name} value={value} required={required} />

      {isOpen && (
        <div className="animate-entry absolute left-0 right-0 z-[var(--z-dropdown)] mt-1.5 max-h-60 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface p-2 shadow-[0_4px_14px_oklch(0%_0_0/0.08)]">
          <div className="relative mb-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch size={14} />
            </span>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Пошук..."
              aria-label="Пошук у списку"
              aria-controls={`${baseId}-list`}
              aria-activedescendant={filtered[activeIndex] ? `${baseId}-opt-${activeIndex}` : undefined}
              className="w-full rounded-[var(--radius-sm)] border border-border bg-surface py-2 pl-8 pr-3 text-base text-ink outline-none transition-colors placeholder-faint focus:border-accent md:text-xs"
            />
          </div>

          <ul ref={listRef} id={`${baseId}-list`} role="listbox" className="space-y-0.5">
            {filtered.length === 0 ? (
              <li className="p-2 text-center text-xs text-muted">Нічого не знайдено</li>
            ) : (
              filtered.map((opt, index) => {
                const isSelected = value === opt.id;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={opt.id}
                    id={`${baseId}-opt-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => commit(opt.id)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex cursor-pointer flex-col rounded-[var(--radius-sm)] px-3 py-2 text-xs transition-colors",
                      isSelected
                        ? "bg-accent text-on-accent"
                        : isActive
                          ? "bg-hover text-ink"
                          : "text-ink",
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    {opt.subLabel && (
                      <span
                        className={cn(
                          "mt-0.5 text-[10px]",
                          isSelected ? "text-on-accent/80" : "text-muted",
                        )}
                      >
                        {opt.subLabel}
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
