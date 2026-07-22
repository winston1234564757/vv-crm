import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Single source of truth for every domain status / category label in the app.
 *
 * Before this module the same status was defined in 13 files and rendered three
 * different ways (<Badge>, an inline `color-mix()` style, and a raw
 * `bg-rose/10 text-rose` span), so one repair could be violet in the list and
 * grey in the drawer. Worse, several of those copies were keyed on vocabularies
 * the database never emits — see the notes on each map.
 *
 * The vocabularies below were verified against the live database (enum
 * definitions in `pg_enum` plus the distinct values actually stored), not
 * copied from the previous maps. Where a map disagreed with the database, the
 * database won.
 *
 * A tone is a `BadgeTone`, never a CSS variable and never a class string. That
 * is what keeps rendering identical everywhere: callers pass the spec to
 * <StatusPill> and have no colour decision left to make.
 */
export interface LabelSpec {
  label: string;
  tone: BadgeTone;
}

export type LabelMap = Record<string, LabelSpec>;

/**
 * Resolves a raw database value to its spec. Unknown values fall back to the
 * raw string with a neutral tone rather than rendering blank — an unmapped
 * status should look plain, not invisible.
 */
export function labelOf(map: LabelMap, value: string | null | undefined): LabelSpec {
  if (!value) return { label: "—", tone: "neutral" };
  return map[value] ?? { label: value, tone: "neutral" };
}

/* ------------------------------------------------------------------ repairs */

/**
 * `repairs.status` is a plain text column, not an enum. The vocabulary below is
 * what the data actually contains (`repairs.status` and `repair_status_log.
 * to_status`) plus `diagnostics`, which the status dropdown can write.
 *
 * NOTE: `src/app/track/[token]/page.tsx` and `src/lib/services/telegram.ts`
 * were keyed on a completely different set — `pending` / `diagnosing` /
 * `waiting_parts` / `repairing` — which the database has never produced. Those
 * four keys silently fell through to the raw string, so a customer whose repair
 * moved to `in_progress` received a Telegram message reading
 * "Новий статус: in_progress". Both now read from this map.
 */
export const repairStatus: LabelMap = {
  received: { label: "Прийнято", tone: "info" },
  diagnostics: { label: "Діагностика", tone: "warning" },
  in_progress: { label: "В роботі", tone: "accent" },
  awaiting_parts: { label: "Чекає деталі", tone: "danger" },
  ready: { label: "Готовий", tone: "success" },
  completed: { label: "Виконано", tone: "success" },
  handed_over: { label: "Видано", tone: "neutral" },
  cancelled: { label: "Скасовано", tone: "danger" },
};

/** Customer-facing wording for the public tracker and Telegram. Same keys. */
export const repairStatusPublic: LabelMap = {
  received: { label: "Прийнято в ремонт", tone: "info" },
  diagnostics: { label: "Діагностика", tone: "warning" },
  in_progress: { label: "Ремонтується", tone: "accent" },
  awaiting_parts: { label: "Очікування запчастин", tone: "danger" },
  ready: { label: "Готовий до видачі", tone: "success" },
  completed: { label: "Виконано", tone: "success" },
  handed_over: { label: "Видано клієнту", tone: "neutral" },
  cancelled: { label: "Скасовано", tone: "danger" },
};

/** `repairs.source` — enum `repair_source`. */
export const repairSource: LabelMap = {
  walk_in: { label: "Візит", tone: "neutral" },
  phone: { label: "Телефон", tone: "neutral" },
  online: { label: "Онлайн", tone: "neutral" },
  marketplace: { label: "Маркетплейс", tone: "neutral" },
};

/** `repairs.payment_status` — enum `payment_status`. */
export const paymentStatus: LabelMap = {
  unpaid: { label: "Не оплачено", tone: "danger" },
  paid: { label: "Оплачено", tone: "success" },
  partial: { label: "Частково", tone: "warning" },
};

/* ------------------------------------------------------------------ devices */

/** `devices.status` — plain text column. */
export const deviceStatus: LabelMap = {
  in_stock: { label: "В наявності", tone: "success" },
  transit: { label: "В дорозі", tone: "warning" },
  sold: { label: "Продано", tone: "neutral" },
  service: { label: "В ремонті", tone: "accent" },
  returned: { label: "Повернення", tone: "danger" },
  archived: { label: "Архів", tone: "neutral" },
};

/**
 * `devices.condition_grade` AND `repairs.device_condition` — both are the enum
 * `device_condition` = perfect | good | fair | poor | damaged.
 *
 * NOTE: `DeviceDetailView.tsx` and `repairs/table.tsx` were keyed on
 * `new` / `like_new` / `good` / `fair` / `poor`. Three keys happened to
 * overlap, so the bug was partly hidden: `good`/`fair`/`poor` rendered, while
 * `perfect` and `damaged` fell through and displayed the raw enum value.
 */
export const deviceCondition: LabelMap = {
  perfect: { label: "Grade A (Ідеальний)", tone: "success" },
  good: { label: "Grade B (Хороший)", tone: "accent" },
  fair: { label: "Grade C (Середній)", tone: "warning" },
  poor: { label: "Поганий", tone: "danger" },
  damaged: { label: "Під ремонт / Пошкоджений", tone: "danger" },
};

/**
 * `devices.type` — plain text. Two maps disagreed on the tail of this list
 * (`watch` vs `smartwatch` + `audio`); the union is kept so neither renders
 * raw. Only `phone` appears in the data today.
 */
export const deviceType: LabelMap = {
  phone: { label: "Телефон", tone: "neutral" },
  tablet: { label: "Планшет", tone: "neutral" },
  laptop: { label: "Ноутбук", tone: "neutral" },
  watch: { label: "Годинник", tone: "neutral" },
  smartwatch: { label: "Смарт-годинник", tone: "neutral" },
  audio: { label: "Аудіо", tone: "neutral" },
  other: { label: "Інше", tone: "neutral" },
};

/** `devices.source` / `accessories.source` — enum `device_source`. */
export const deviceSource: LabelMap = {
  trade_in: { label: "Trade-In", tone: "neutral" },
  buyout: { label: "Викуп", tone: "neutral" },
  supplier: { label: "Постачальник", tone: "neutral" },
  olx: { label: "OLX", tone: "neutral" },
  marketplace: { label: "Маркетплейс", tone: "neutral" },
  customer_return: { label: "Повернення", tone: "neutral" },
  other: { label: "Інше", tone: "neutral" },
};

/* ---------------------------------------------------------------- purchases */

/** `purchases.status` — plain text. */
export const purchaseStatus: LabelMap = {
  pending: { label: "Очікується", tone: "warning" },
  received: { label: "Отримано", tone: "info" },
  paid: { label: "Оплачено", tone: "success" },
  cancelled: { label: "Скасовано", tone: "danger" },
};

/** Longer wording for the purchase drawer, where there is room for it. */
export const purchaseStatusLong: LabelMap = {
  pending: { label: "Очікується", tone: "warning" },
  received: { label: "Отримано на склад", tone: "info" },
  paid: { label: "Оплачено постачальнику", tone: "success" },
  cancelled: { label: "Скасовано", tone: "danger" },
};

/**
 * `purchases.payment_type` — plain text. The previous map carried emoji inside
 * the label ("🚚 В дорозі"); the icon belongs to the component, not the string.
 */
export const purchasePaymentType: LabelMap = {
  transit: { label: "В дорозі", tone: "info" },
  on_receipt: { label: "При отриманні", tone: "warning" },
  prepaid: { label: "Передплата", tone: "success" },
};

/** Line-item kinds inside a purchase. */
export const itemType: LabelMap = {
  device: { label: "Техніка", tone: "neutral" },
  accessory: { label: "Аксесуар", tone: "neutral" },
  part: { label: "Запчастина", tone: "neutral" },
  service: { label: "Послуга", tone: "neutral" },
};

/* -------------------------------------------------------------------- parts */

/** `parts.type` — plain text. */
export const partType: LabelMap = {
  screen: { label: "Екран", tone: "neutral" },
  battery: { label: "АКБ", tone: "neutral" },
  charging_port: { label: "Порт", tone: "neutral" },
  cable: { label: "Шлейф", tone: "neutral" },
  button: { label: "Кнопка", tone: "neutral" },
  camera: { label: "Камера", tone: "neutral" },
  speaker: { label: "Динамік", tone: "neutral" },
  other: { label: "Інше", tone: "neutral" },
};

/* ---------------------------------------------------------------- customers */

/** `customers.vip_status` — plain text. */
export const vipStatus: LabelMap = {
  regular: { label: "Звичайний", tone: "neutral" },
  silver: { label: "Срібний", tone: "neutral" },
  gold: { label: "Золотий", tone: "warning" },
  platinum: { label: "Платінум", tone: "info" },
};

/* -------------------------------------------------------------------- sales */

/** `sales.sale_type` — enum `sale_type`. */
export const saleType: LabelMap = {
  retail: { label: "Роздріб", tone: "neutral" },
  wholesale: { label: "Опт", tone: "info" },
  online: { label: "Онлайн", tone: "accent" },
};

/** Payment methods on a sale. */
export const paymentMethod: LabelMap = {
  cash: { label: "Готівка", tone: "neutral" },
  card: { label: "Картка", tone: "neutral" },
  transfer: { label: "Переказ", tone: "neutral" },
};

/**
 * Convenience for <select> population: the options of a map in insertion
 * order, which is the order the maps above are written in (workflow order for
 * statuses, not alphabetical).
 */
export function optionsOf(map: LabelMap): Array<{ value: string; label: string }> {
  return Object.entries(map).map(([value, spec]) => ({ value, label: spec.label }));
}
