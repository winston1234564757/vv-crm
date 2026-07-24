/**
 * Гарантійний термін, що обирається в POS-чекауті. Один термін на весь чек —
 * `sales.warranty_end` зберігає одну дату на продаж, не по позиціях. Обчислене
 * тут вікно йде в `createMultiSaleAction` (→ RPC `process_pos_sale`) і в чек,
 * де `composeWarrantyText` друкує «Гарантія дійсна до: …».
 */

export type WarrantyTerm = "none" | "14d" | "1m" | "3m" | "6m" | "12m";

export const WARRANTY_TERMS: { value: WarrantyTerm; label: string }[] = [
  { value: "none", label: "Без гарантії" },
  { value: "14d", label: "14 днів" },
  { value: "1m", label: "1 місяць" },
  { value: "3m", label: "3 місяці" },
  { value: "6m", label: "6 місяців" },
  { value: "12m", label: "12 місяців" },
];

/** Дефолт магазину — обрано власником. */
export const DEFAULT_WARRANTY_TERM: WarrantyTerm = "6m";

/** Локальна дата `YYYY-MM-DD` для колонок `sales.warranty_start/end`. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Вікно гарантії від сьогодні за обраним терміном. `none` → без гарантії
 * (обидва null, у чеку блоку терміну не буде). Місячні терміни рахуються через
 * `setMonth`, тож 31-ше число може з'їхати на кілька днів — прийнятно для строку
 * гарантії.
 */
export function warrantyWindow(
  term: WarrantyTerm,
  now: Date = new Date(),
): { start: string | null; end: string | null } {
  if (term === "none") return { start: null, end: null };

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  switch (term) {
    case "14d":
      end.setDate(end.getDate() + 14);
      break;
    case "1m":
      end.setMonth(end.getMonth() + 1);
      break;
    case "3m":
      end.setMonth(end.getMonth() + 3);
      break;
    case "6m":
      end.setMonth(end.getMonth() + 6);
      break;
    case "12m":
      end.setMonth(end.getMonth() + 12);
      break;
  }
  return { start: ymd(start), end: ymd(end) };
}
