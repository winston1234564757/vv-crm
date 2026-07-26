/**
 * Форматування гривні. Кожна картка дашборду мала власну копію цієї функції,
 * і копії встигли розійтися в округленні.
 */

/** `12 400 ₴`. Копійок магазин не використовує — округлюємо до гривні. */
export function uah(n: number): string {
  return `${Math.round(n).toLocaleString("uk-UA")} ₴`;
}

/** `+18%` / `−7%`. Знак завжди явний, бо число читають як зміну. */
export function signedPct(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`;
}

/** `+3 п.п.` — маржа порівнюється в пунктах, не у відсотках від відсотка. */
export function signedPp(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} п.п.`;
}
