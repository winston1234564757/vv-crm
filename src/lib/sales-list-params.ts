/**
 * Параметри списку операцій: сортування і межа вибірки.
 *
 * Живуть окремим модулем, а не в `data-sales.ts`, бо їх читають обидві
 * сторони. `data-sales` тягне серверний Supabase-клієнт (`next/headers`), тож
 * імпорт звідти в клієнтську таблицю зламав би збірку.
 *
 * Модуль чистий: жодного I/O, лише розбір рядків з URL.
 */

/** За чим упорядкований список операцій. */
export type SalesSort = "date" | "amount";
export type SalesDir = "asc" | "desc";

/**
 * Межа вибірки: `since_open` — від фінансової епохи (`finance_epoch` у
 * settings), `ever` — від початку бази.
 *
 * Епоха тут не косметика. До відкриття магазину чеки писались «з рук», і за
 * сумою вони перебивають половину справжніх: сортування за сумою без цієї межі
 * підняло б їх у топ списку. Межа одна на всю систему — та сама, що виключає
 * ті чеки з грошових розрахунків, тож другої дати ніде не з'являється.
 *
 * `ever`, а не `all`: рядок `all` на цій сторінці зарезервований як «фільтр
 * вимкнено» — `push()` у таблиці викидає з URL будь-який параметр зі значенням
 * `all`. Назви цим словом межу вибірки, і «Увесь час» тихо скидався б назад до
 * «Від відкриття», бо параметр не доїжджав би до сервера.
 */
export type SalesScope = "since_open" | "ever";

export const DEFAULT_SALES_SCOPE: SalesScope = "since_open";

export function parseSalesSort(v: string | undefined): SalesSort {
  return v === "amount" ? "amount" : "date";
}

export function parseSalesDir(v: string | undefined): SalesDir {
  return v === "asc" ? "asc" : "desc";
}

export function parseSalesScope(v: string | undefined): SalesScope {
  return v === "ever" ? "ever" : DEFAULT_SALES_SCOPE;
}
