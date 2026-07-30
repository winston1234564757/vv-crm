/**
 * Параметри списку операцій: сортування, межа вибірки, поріг суми.
 *
 * Живуть окремим модулем, а не в `data-sales.ts`, бо їх читають обидві
 * сторони. `data-sales` тягне серверний Supabase-клієнт (`next/headers`), тож
 * імпорт звідти в клієнтську таблицю зламав би збірку — а таблиця мусить
 * розбирати поріг тим самим правилом, що й сервер, інакше дебаунс порівнював
 * би чернетку з інакше нормалізованим значенням і смикав запит по колу.
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
 * підняло б їх у топ. Межа одна на всю систему — та сама, що виключає ті чеки
 * з грошових розрахунків, тож другої дати ніде не з'являється.
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

/**
 * Нижній поріг суми операції з URL. `null` — порогу немає.
 *
 * Нуль теж означає «немає»: інакше `?min=0` було б окремим станом, який
 * фільтрує рівно те саме, що й його відсутність, і очищення поля лишало б
 * параметр у посиланні. Дробові й від'ємні відкидаються — поріг у гривнях.
 */
export function parseMinAmount(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}
