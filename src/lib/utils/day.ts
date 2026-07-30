/**
 * Локальний ключ дня `YYYY-MM-DD` та операції над ним. Той самий локальний
 * час, що й `resolveRange`/`dailySeries` (`new Date(y, m, d)`), щоб денна
 * навігація в UI збігалася з вікнами, за якими сервер рахує гроші.
 */

/**
 * Часовий пояс магазину.
 *
 * Потрібен явно, бо серверні компоненти рендеряться там, де стоїть рантайм, а
 * не там, де стоїть магазин: на Vercel це UTC, тож `toLocaleTimeString` без
 * поясу показував чек, пробитий о 12:03, як 09:03. Локально (Windows, Київ)
 * баг не видно взагалі — саме тому він і доїхав у прод.
 *
 * `dayKey`/`resolveRange` навмисно лишаються в локальному часі рантайму: вони
 * ріжуть грошові вікна, і переводити їх на пояс магазину — окрема зміна, яка
 * зсуває всі числа. Тут — лише те, що показується людині.
 */
export const SHOP_TIME_ZONE = "Europe/Kyiv";

/** `ГГ:ХХ` за часом магазину. */
export function timeHM(iso: string): string {
  return new Date(iso).toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SHOP_TIME_ZONE,
  });
}

/** `ДД.ММ, ГГ:ХХ` за часом магазину — для щільних списків. */
export function dateTimeShort(iso: string): string {
  return new Date(iso).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SHOP_TIME_ZONE,
  });
}

/** Локальний `YYYY-MM-DD` для дати. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Крок на `delta` днів від ключа, з переходом через межі місяців/років. */
export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

/** Людський підпис дня українською: «понеділок, 21 липня». */
export function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Чи є рядок валідним ключем дня `YYYY-MM-DD`. Перевіряє не лише форму, а й що
 * дата справжня (`2026-02-31` відкидається), бо ключ приходить із URL.
 */
export function isDayKey(v: string | null | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  );
}
