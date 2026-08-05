/**
 * Режим подання — тип і чисті хелпери, БЕЗ `"use client"`.
 *
 * Живе окремо від `ViewToggle.tsx` навмисно, і не заради охайності: сам
 * перемикач мусить бути клієнтським (він слухає кліки й пише в URL), а
 * `resolveViewMode` кличе СЕРВЕРНА сторінка, читаючи `searchParams`. Викликати
 * функцію з модуля, позначеного `"use client"`, із сервера не можна — Next
 * кидає «Attempted to call resolveViewMode() from the server», і сторінка
 * падає в error boundary цілком.
 *
 * Той самий поділ уже є в проєкті: `lib/roles.ts` існує окремо від
 * `lib/rbac.ts` рівно з цієї причини.
 */

export type ViewMode = "chart" | "table";

export const VIEW_MODES: ViewMode[] = ["chart", "table"];

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  chart: "Графіки",
  table: "Таблиця",
};

export function isViewMode(v: string | null | undefined): v is ViewMode {
  return v === "chart" || v === "table";
}

/** Читає режим із `searchParams` серверної сторінки. За замовчуванням — графіки. */
export function resolveViewMode(v: string | string[] | undefined): ViewMode {
  const raw = Array.isArray(v) ? v[0] : v;
  return isViewMode(raw) ? raw : "chart";
}
