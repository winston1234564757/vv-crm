"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import type { ListQuery } from "@/components/list/useListQuery";

/** One column, rendered as a table cell on desktop. */
export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Drop the column below this breakpoint instead of squeezing it. */
  hideBelow?: "sm" | "md" | "lg";
  /**
   * The cell contains its own controls (a status select, a link, a button).
   * The shell isolates the click so it cannot also trigger `onRowClick` —
   * pages no longer hand-write `stopPropagation`, of which there were 33
   * across eight tables, each one a tap that could open a drawer instead of
   * doing what it said.
   */
  interactive?: boolean;
}

/**
 * The mobile card. Deliberately not derived from the columns: every hand-built
 * card in this app used the same three-zone grammar — identity, state,
 * label/value rows — which is a different shape from a row of cells, not a
 * narrower one.
 */
export interface CardSpec {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Top-right — the status pill and anything else that reads as state. */
  state?: ReactNode;
  rows?: Array<{ label: ReactNode; value: ReactNode }>;
  footer?: ReactNode;
}

export interface ListPageShellProps<T> {
  query: ListQuery;
  /**
   * Client mode: every filtered row — the shell slices the page itself.
   * Server mode: the current page's rows, with `total` supplied.
   */
  rows: T[];
  total?: number;
  getRowId: (row: T) => string;
  columns: Column<T>[];
  card: (row: T) => CardSpec;

  onRowClick?: (row: T) => void;
  /** Conditional row emphasis, e.g. finance highlighting linked transactions. */
  rowClassName?: (row: T) => string | undefined;

  selection?: {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    /** Ids the selection may legally contain. Defaults to what is on screen. */
    selectableIds?: string[];
    /** Rendered above the list while anything is selected. */
    bulkBar: ReactNode;
  };

  toolbar?: ReactNode;
  /** Shown when the list is genuinely empty. Teach the first step here. */
  empty: { title: string; description?: string; icon?: ReactNode; action?: ReactNode };
  /** Shown when filters or search hid everything. Offer a way back. */
  noResults?: { title: string; description?: string };
  itemLabel?: string;
  className?: string;
}

/**
 * The shared list page body: toolbar, bulk bar, desktop table, mobile cards,
 * empty states and pagination.
 *
 * It exists because `repairs/table.tsx` (596 lines), `devices/table.tsx` (747)
 * and `FinanceTransactionsTable.tsx` (676) each maintained a desktop table and
 * a separate mobile card list by hand, and the two had already drifted apart.
 */
export function ListPageShell<T>({
  query,
  rows,
  total,
  getRowId,
  columns,
  card,
  onRowClick,
  rowClassName,
  selection,
  toolbar,
  empty,
  noResults,
  itemLabel = "записів",
  className,
}: ListPageShellProps<T>) {
  const isServerPaged = typeof total === "number";
  const resolvedTotal = isServerPaged ? total : rows.length;

  // Client mode slices here so the page never repeats the arithmetic.
  const pageRows = useMemo(() => {
    if (isServerPaged) return rows;
    const start = (query.page - 1) * query.pageSize;
    return rows.slice(start, start + query.pageSize);
  }, [rows, isServerPaged, query.page, query.pageSize]);

  const pageCount = Math.max(1, Math.ceil(resolvedTotal / query.pageSize));
  const start = (query.page - 1) * query.pageSize;

  const pageIds = useMemo(() => pageRows.map(getRowId), [pageRows, getRowId]);
  const selectableIds = selection?.selectableIds ?? pageIds;
  const { selectedIds, onChange: onSelectionChange } = selection ?? {};

  /**
   * Keep the selection inside what the filter still shows. Previously a user
   * could select three repairs, filter to a different status, and have the
   * bulk action rewrite rows that were no longer on screen.
   */
  useEffect(() => {
    if (!selectedIds || !onSelectionChange) return;
    const allowed = new Set(selectableIds);
    const pruned = selectedIds.filter((id) => allowed.has(id));
    if (pruned.length !== selectedIds.length) onSelectionChange(pruned);
  }, [selectableIds, selectedIds, onSelectionChange]);

  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds?.includes(id));
  const someOnPageSelected =
    !allOnPageSelected && pageIds.some((id) => selectedIds?.includes(id));

  function toggleRow(id: string, checked: boolean) {
    if (!selectedIds || !onSelectionChange) return;
    onSelectionChange(
      checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id),
    );
  }

  // "Select all" stays page-scoped, so a checkbox can never reach a row the
  // user cannot see.
  function togglePage(checked: boolean) {
    if (!selectedIds || !onSelectionChange) return;
    onSelectionChange(
      checked
        ? Array.from(new Set([...selectedIds, ...pageIds]))
        : selectedIds.filter((id) => !pageIds.includes(id)),
    );
  }

  const isEmpty = pageRows.length === 0;
  const colSpan = columns.length + (selection ? 1 : 0);

  const hideClass: Record<NonNullable<Column<T>["hideBelow"]>, string> = {
    sm: "hidden sm:table-cell",
    md: "hidden md:table-cell",
    lg: "hidden lg:table-cell",
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {toolbar}

      {selection && selection.selectedIds.length > 0 && selection.bulkBar}

      <div className={cn("transition-opacity", query.isPending && "opacity-60")}>
        {isEmpty ? (
          query.isNarrowed ? (
            <EmptyState
              title={noResults?.title ?? "Нічого не знайдено"}
              description={
                noResults?.description ?? "Спробуйте змінити пошук або скинути фільтри."
              }
              action={
                <button
                  type="button"
                  onClick={query.resetFilters}
                  className="btn-press cursor-pointer text-sm font-medium text-accent-ink transition-colors hover:text-accent"
                >
                  Скинути фільтри
                </button>
              }
            />
          ) : (
            <EmptyState {...empty} />
          )
        ) : (
          <>
            {/* Mobile — cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {pageRows.map((row) => {
                const id = getRowId(row);
                const spec = card(row);
                const isSelected = selectedIds?.includes(id) ?? false;
                return (
                  <div
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "card flex flex-col gap-2.5 p-4 transition-colors",
                      onRowClick && "card-hover cursor-pointer",
                      isSelected && "border-accent",
                      rowClassName?.(row),
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        {selection && (
                          <span onClick={(e) => e.stopPropagation()} className="mt-0.5">
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => toggleRow(id, e.target.checked)}
                              aria-label="Обрати рядок"
                            />
                          </span>
                        )}
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-semibold text-ink">
                            {spec.title}
                          </h4>
                          {spec.subtitle && (
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {spec.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      {spec.state && (
                        <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                          {spec.state}
                        </span>
                      )}
                    </div>

                    {spec.rows?.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 border-t border-border pt-2.5 text-xs text-muted"
                      >
                        <span>{r.label}</span>
                        <span className="text-right font-medium text-ink">{r.value}</span>
                      </div>
                    ))}

                    {spec.footer && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="border-t border-border pt-2.5"
                      >
                        {spec.footer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop — table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted">
                    {selection && (
                      <th className="w-10 pb-2 pr-4">
                        <Checkbox
                          checked={allOnPageSelected}
                          indeterminate={someOnPageSelected}
                          onChange={(e) => togglePage(e.target.checked)}
                          aria-label="Обрати всі рядки на сторінці"
                        />
                      </th>
                    )}
                    {columns.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        className={cn(
                          "pb-2 pr-4 font-medium",
                          c.align === "right" && "text-right",
                          c.hideBelow && hideClass[c.hideBelow],
                        )}
                      >
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const id = getRowId(row);
                    const isSelected = selectedIds?.includes(id) ?? false;
                    return (
                      <tr
                        key={id}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={cn(
                          "border-b border-border text-ink transition-colors",
                          onRowClick && "cursor-pointer hover:bg-hover",
                          isSelected && "bg-accent-subtle",
                          rowClassName?.(row),
                        )}
                      >
                        {selection && (
                          <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => toggleRow(id, e.target.checked)}
                              aria-label="Обрати рядок"
                            />
                          </td>
                        )}
                        {columns.map((c) => (
                          <td
                            key={c.key}
                            onClick={c.interactive ? (e) => e.stopPropagation() : undefined}
                            className={cn(
                              "py-3 pr-4",
                              c.align === "right" && "text-right",
                              c.hideBelow && hideClass[c.hideBelow],
                            )}
                          >
                            {c.cell(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {!isEmpty && (
        <Pagination
          page={query.page}
          pageCount={pageCount}
          total={resolvedTotal}
          start={start}
          shown={pageRows.length}
          pageSize={query.pageSize}
          onPageChange={query.setPage}
          onPageSizeChange={query.setPageSize}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}
