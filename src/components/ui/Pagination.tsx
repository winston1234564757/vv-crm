"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

export const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

export interface UsePaginationOptions {
  pageSize?: number;
  /**
   * Serialized active filters/search. When it changes the user is sent back to
   * page 1 — otherwise applying a filter while on page 3 shows page 3 of the
   * new result set, which reads as "my search returned nothing".
   */
  resetKey?: string;
}

/** Client-side pagination over an already-filtered array. */
export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { pageSize: initialPageSize = DEFAULT_PAGE_SIZE, resetKey } = options;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

  // Any change to search/filters returns the user to the first page.
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    page: safePage,
    // Clamp on write so state never holds an out-of-range page.
    setPage: (n: number) => setPage(Math.max(1, Math.min(n, pageCount))),
    pageSize,
    setPageSize: (n: number) => {
      setPageSizeState(n);
      setPage(1);
    },
    pageCount,
    total,
    start,
    pageItems,
  };
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  shown: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Genitive plural noun, e.g. "продажів" */
  itemLabel?: string;
  className?: string;
}

/**
 * Table footer pagination: result range, page size, prev/next.
 * Renders nothing when everything fits on one page at the default size —
 * no chrome without purpose. Stays visible if the user chose a larger page
 * size, so they can switch back.
 */
export function Pagination({
  page,
  pageCount,
  total,
  start,
  shown,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "записів",
  className,
}: PaginationProps) {
  if (pageCount <= 1 && pageSize === DEFAULT_PAGE_SIZE) return null;

  const from = total === 0 ? 0 : start + 1;
  const to = start + shown;

  return (
    <nav
      aria-label="Пагінація"
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-3 mt-3",
        className,
      )}
    >
      <p className="text-xs text-muted tabular">
        Показано {from}–{to} з {total} {itemLabel}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <span className="hidden sm:inline">На сторінці</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent cursor-pointer"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="btn-press rounded-[var(--radius-sm)] border border-border px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          <span className="px-2 text-xs text-muted tabular whitespace-nowrap">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            className="btn-press rounded-[var(--radius-sm)] border border-border px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Далі
          </button>
        </div>
      </div>
    </nav>
  );
}
