"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type FilterState = Record<string, string>;

export interface UseListQueryOptions {
  /**
   * "server" — the page re-queries Postgres on every change, so a change must
   * be a real navigation (`router.replace`). Sales works this way.
   *
   * "client" — the rows are already in memory and filtering happens in the
   * browser. The URL is still updated so the view can be shared and survives a
   * refresh, but via `window.history.replaceState`, which Next documents as
   * integrating with the router *without reloading the page*. Using
   * `router.replace` here would re-run the server component and refetch every
   * row on each keystroke, to power filtering that never leaves the browser.
   */
  mode: "server" | "client";
  /** Filter keys this list understands, mapped to their "no filter" value. */
  filters?: FilterState;
  searchKey?: string;
  defaultPageSize?: number;
  debounceMs?: number;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * URL-backed state for a list page: search, independent filters, page, size.
 *
 * Filters are independent keys, not one value. The repairs page previously held
 * a single `filter` string, so "Клієнтські" and "В роботі" were mutually
 * exclusive and the most common question on that screen — which customer
 * repairs are in progress — could not be asked.
 */
export function useListQuery({
  mode,
  filters: filterDefaults = {},
  searchKey = "q",
  defaultPageSize = DEFAULT_PAGE_SIZE,
  debounceMs = 350,
}: UseListQueryOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filterKeys = useMemo(() => Object.keys(filterDefaults), [filterDefaults]);

  // Read the URL once for the initial value. In client mode this is also the
  // last time the URL drives rendering — see the note on `commit` below.
  const readFromUrl = useCallback(() => {
    const next: FilterState = {};
    for (const key of filterKeys) next[key] = searchParams.get(key) ?? filterDefaults[key];
    return {
      search: searchParams.get(searchKey) ?? "",
      filters: next,
      page: Math.max(1, Number(searchParams.get("page")) || 1),
      pageSize: Number(searchParams.get("size")) || defaultPageSize,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, searchKey, defaultPageSize, filterKeys]);

  const [state, setState] = useState(readFromUrl);

  // In server mode the server is the source of truth: a navigation re-renders
  // the page with new rows, so the URL must flow back into the control values.
  // In client mode it must not — see `commit`.
  useEffect(() => {
    if (mode !== "server") return;
    setState(readFromUrl());
  }, [mode, readFromUrl]);

  /**
   * Writes the URL. In client mode rendering deliberately reads from React
   * state, never from `useSearchParams`: `history.replaceState` is documented
   * to sync with the router, but making the visible controls depend on that
   * re-render firing would mean one quirk freezes the whole toolbar. The URL is
   * a mirror here, not the source.
   */
  const commit = useCallback(
    (next: typeof state) => {
      const p = new URLSearchParams();
      if (next.search) p.set(searchKey, next.search);
      for (const key of filterKeys) {
        if (next.filters[key] && next.filters[key] !== filterDefaults[key]) {
          p.set(key, next.filters[key]);
        }
      }
      if (next.page > 1) p.set("page", String(next.page));
      if (next.pageSize !== defaultPageSize) p.set("size", String(next.pageSize));

      const qs = p.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      if (mode === "server") {
        startTransition(() => router.replace(url, { scroll: false }));
      } else {
        window.history.replaceState(null, "", url);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, pathname, router, searchKey, defaultPageSize, filterKeys],
  );

  /** Any change other than paging returns to page 1. */
  const update = useCallback(
    (patch: Partial<typeof state>, resetPage = true) => {
      setState((prev) => {
        const next = { ...prev, ...patch, ...(resetPage ? { page: 1 } : null) };
        commit(next);
        return next;
      });
    },
    [commit],
  );

  // Local mirror so typing stays responsive while the debounce settles.
  const [draftSearch, setDraftSearch] = useState(state.search);
  useEffect(() => setDraftSearch(state.search), [state.search]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (draftSearch === state.search) return;
    const t = setTimeout(() => update({ search: draftSearch }), debounceMs);
    return () => clearTimeout(t);
  }, [draftSearch, state.search, debounceMs, update]);

  const activeFilterCount = filterKeys.filter(
    (k) => state.filters[k] !== filterDefaults[k],
  ).length;

  return {
    /** Debounced, committed search term — filter against this. */
    search: state.search,
    /** Bind the input to this so typing never lags. */
    draftSearch,
    setDraftSearch,
    clearSearch: () => {
      setDraftSearch("");
      update({ search: "" });
    },

    filters: state.filters,
    setFilter: (key: string, value: string) =>
      update({ filters: { ...state.filters, [key]: value } }),
    resetFilters: () => {
      setDraftSearch("");
      update({ search: "", filters: { ...filterDefaults } });
    },
    activeFilterCount,
    /** True when the user has narrowed the list — drives which empty state shows. */
    isNarrowed: activeFilterCount > 0 || state.search.length > 0,

    page: state.page,
    setPage: (page: number) => update({ page }, false),
    pageSize: state.pageSize,
    setPageSize: (pageSize: number) => update({ pageSize }),

    isPending,
  };
}

export type ListQuery = ReturnType<typeof useListQuery>;
