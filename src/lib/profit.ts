/**
 * Уся арифметика прибутку в одному місці — бо її вже рахували у двох, і
 * розходження між ними коштувало б довіри до обох сторінок.
 *
 * Головне тут одне: собівартість проданого пристрою — це `cost_price +
 * repair_cost`, а не `sale_items.unit_cost`. POS пише в `unit_cost` лише
 * `cost_price` (`usePOSCart.ts`), тому вкладений ремонт із нього губиться. На
 * восьми проданих апаратах це 3 650 ₴ невидимих витрат і маржа 68% замість 47%.
 * `data-finance.ts` обходив це на читанні; тепер обхід живе тут, один на всіх.
 *
 * Модуль чистий: жодного Supabase, все через аргументи. Тому він тестується
 * без бази і його можна викликати і з сервера, і з клієнта.
 */

import { addDays, dayKey } from "./utils/day";
import { repairSettledAt, type SettleableRepair } from "./repair-flow";

export type ProfitCategory = "device" | "accessory" | "part" | "service" | "repair";

/** Порядок фіксований: таблиця не має перестрибувати між діапазонами. */
export const PROFIT_CATEGORIES: ProfitCategory[] = [
  "device",
  "accessory",
  "part",
  "service",
  "repair",
];

export const CATEGORY_LABELS: Record<ProfitCategory, string> = {
  device: "Техніка",
  accessory: "Аксесуари",
  part: "Запчастини",
  service: "Послуги",
  repair: "Ремонти",
};

export interface ProfitSaleItem {
  item_type: string;
  item_id: string | null;
  quantity: number;
  total_price: number;
  /** Знімок собівартості на момент продажу. Для пристроїв ігнорується. */
  unit_cost: number;
}

/**
 * Чек цілком. Знижка лежить на рівні продажу — `sale_items` не має свого
 * поля знижки, тому реальний виторг за позицію відомий лише після того, як
 * знижку розподілили по позиціях того самого чека.
 */
export interface ProfitSale {
  /**
   * Підсумок чека — рівно стільки грошей зайшло в касу. Це і є виторг чека;
   * позиції лише кажуть, як його розкласти по категоріях.
   *
   * `discount` тут навмисно немає. Воно є в базі, але означає ВІДСОТОК, і два
   * шляхи продажу пишуть позиції по-різному: POS кладе в `total_price` ціну до
   * знижки, швидкий продаж — уже після. Одне поле, два сенси — рахувати з
   * нього виторг не можна. Різниця «позиції мінус підсумок» вірна в обох
   * випадках, тож знижка виводиться з даних, а не читається зі стовпця.
   */
  total_amount: number;
  items: ProfitSaleItem[];
}

export interface ProfitDeviceCost {
  cost_price: number;
  repair_cost: number | null;
}

export interface ProfitRepair {
  price: number;
  cost: number | null;
  /** Робота стороннього сервісу. Раніше не входила в собівартість ремонту. */
  external_sc_cost: number | null;
}

export interface CategoryProfit {
  category: ProfitCategory;
  revenue: number;
  cost: number;
  profit: number;
  /** Цілі відсотки. Від'ємні, якщо продано нижче собівартості. */
  margin: number;
  /**
   * Скільки одиниць продано. Для товарів — сума `quantity`, для ремонтів —
   * кількість зданих ремонтів.
   *
   * Досі `quantity` жило в цьому модулі лише як множник собівартості, тож на
   * питання «чого продали найбільше» відповіді не було взагалі: усі екрани
   * показували тільки гривні. Два аксесуари по 600 ₴ і двадцять по 60 ₴
   * виглядали однаково.
   */
  units: number;
}

export interface ProfitResult {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  /** Сума `units` по категоріях. */
  units: number;
  byCategory: CategoryProfit[];
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Маржа у відсотках. Нульовий виторг дає 0, а не NaN і не Infinity. */
export function margin(revenue: number, profit: number): number {
  if (revenue === 0) return 0;
  return Math.round((profit / revenue) * 100) || 0;
}

/**
 * Собівартість позиції чека.
 *
 * Для пристрою береться з `devices`, бо збережений `unit_cost` не знає про
 * ремонт. Якщо пристрою в мапі немає (видалили), падаємо назад на `unit_cost`:
 * ми вже не знаємо, у скільки обійшовся цей ремонт, тож беремо збережений
 * знімок. Це мовчазне заниження собівартості — звірка його не ловить,
 * дашборд і Finance викликають цю саму функцію й отримують той самий
 * фолбек. Але нуль тут був би гірше: він завищив би прибуток, а саме з цією
 * помилкою й боровся цей модуль.
 */
export function itemCost(
  item: ProfitSaleItem,
  devices: Map<string, ProfitDeviceCost>,
): number {
  const qty = itemUnits(item);
  if (item.item_type === "device" && item.item_id) {
    const dev = devices.get(item.item_id);
    if (dev) return (num(dev.cost_price) + num(dev.repair_cost)) * qty;
  }
  return num(item.unit_cost) * qty;
}

/**
 * Скільки одиниць у позиції чека.
 *
 * Та сама нормалізація, що в `itemCost`: `null` означає одну штуку, а не нуль.
 * Винесено в окрему функцію саме тому, що обидві мусять трактувати кількість
 * однаково — інакше собівартість рахувалась би на одну кількість, а штуки на
 * іншу, і маржа на одиницю поїхала б.
 */
export function itemUnits(item: ProfitSaleItem): number {
  return item.quantity == null ? 1 : num(item.quantity);
}

function toCategory(itemType: string): ProfitCategory | null {
  if (
    itemType === "device" ||
    itemType === "accessory" ||
    itemType === "part" ||
    itemType === "service"
  ) {
    return itemType;
  }
  return null;
}

/**
 * Розподіляє знижку чека по його позиціях пропорційно до `total_price`.
 * Повертає масив виторгу за позицію, паралельний до `items`, ціле число
 * гривень на кожен елемент, сума яких точно дорівнює `total_amount` чека.
 *
 * Знижка = «сума позицій мінус підсумок чека», а не стовпець `sales.discount`.
 * Той стовпець зберігає ВІДСОТОК (POS: `total = subtotal − round(subtotal ×
 * pct/100)`), а раніше тут він віднімався як гривні: чек зі знижкою 10% на
 * 1 444 ₴ давав 1 434 ₴ виторгу замість 1 300 ₴, які реально зайшли в касу.
 * Помилка тиха — `discount` ніколи не більший за 100, тож захист нижче не
 * спрацьовував і число виглядало правдоподібно.
 *
 * Різниця з підсумком вірна для обох шляхів продажу: у POS позиції лежать до
 * знижки (різниця = знижка), у швидкому продажі — вже після (різниця = 0, і
 * віднімати нічого не треба). Заразом вона ловить будь-який інший розрив між
 * шапкою чека і його рядками, хай звідки б він узявся.
 *
 * Метод найбільших залишків (Гамільтона): кожній позиції спершу дістається
 * ціла частина її точної частки знижки, а те, що лишилось нерозподіленим
 * (завжди менше за кількість позицій), розкидається по одній гривні тим
 * позиціям, у яких дробова частина частки найбільша. Це гарантує, що частка
 * кожної позиції лежить між підлогою і стелею її точного розрахунку — на
 * відміну від округлення кожної позиції окремо з відкиданням усієї похибки
 * на найбільшу: при багатьох дрібних позиціях, які округлюються вгору,
 * похибка накопичується і може загнати найбільшу позицію в мінус.
 *
 * Дробові частини порівнюються цілими чисельниками (`numerator - floorShare
 * * lineTotal`), тому порівняння точне і без похибок double.
 */
export function allocateSaleRevenue(items: ProfitSaleItem[], totalAmount: number): number[] {
  const lineTotal = items.reduce((s, it) => s + num(it.total_price), 0);
  // Підсумок більший за суму позицій — розподіляти нічого, і догори не
  // тягнемо: невідомо, якій позиції ту гривню віддати, а вигадати означало б
  // завищити маржу навмання. Такий чек лишається на сумі своїх рядків.
  const rawDiscount = Math.max(0, lineTotal - Math.max(0, num(totalAmount)));

  if (!rawDiscount || lineTotal === 0) {
    return items.map((it) => num(it.total_price));
  }

  // Підсумок нульовий або від'ємний — акційний чек чи помилка каси. Виторг у
  // мінус не йде: урізаємо знижку до суми позицій, найгірший випадок —
  // нульовий виторг з чека.
  const clampedDiscount = Math.min(rawDiscount, lineTotal);

  const numerators = items.map((it) => clampedDiscount * num(it.total_price));
  const floorShares = numerators.map((n) => Math.floor(n / lineTotal));
  const remainders = numerators.map((n, i) => n - floorShares[i] * lineTotal);

  let leftover = clampedDiscount - floorShares.reduce((s, v) => s + v, 0);

  const order = items.map((_, i) => i).sort((a, b) => {
    if (remainders[b] !== remainders[a]) return remainders[b] - remainders[a];
    const priceA = num(items[a].total_price);
    const priceB = num(items[b].total_price);
    if (priceB !== priceA) return priceB - priceA;
    return a - b;
  });

  const discountPerItem = [...floorShares];
  for (let k = 0; k < order.length && leftover > 0; k++) {
    discountPerItem[order[k]] += 1;
    leftover -= 1;
  }

  return items.map((it, i) => num(it.total_price) - discountPerItem[i]);
}

/**
 * @param sales чеки за період, кожен зі своїми позиціями та знижкою
 * @param devices собівартості проданих пристроїв, ключ — `devices.id`
 * @param repairs ЛИШЕ зовнішні завершені ремонти (`inventory_device_id is null`)
 */
export function computeProfit(
  sales: ProfitSale[],
  devices: Map<string, ProfitDeviceCost>,
  repairs: ProfitRepair[],
): ProfitResult {
  const acc = new Map<ProfitCategory, { revenue: number; cost: number; units: number }>(
    PROFIT_CATEGORIES.map((c) => [c, { revenue: 0, cost: 0, units: 0 }]),
  );

  for (const sale of sales) {
    const revenues = allocateSaleRevenue(sale.items, sale.total_amount);
    sale.items.forEach((item, i) => {
      const cat = toCategory(item.item_type);
      if (!cat) return;
      const bucket = acc.get(cat)!;
      bucket.revenue += revenues[i];
      bucket.cost += itemCost(item, devices);
      bucket.units += itemUnits(item);
    });
  }

  const repairBucket = acc.get("repair")!;
  for (const r of repairs) {
    repairBucket.revenue += num(r.price);
    repairBucket.cost += num(r.cost) + num(r.external_sc_cost);
    /* Ремонт — це одна одиниця, навіть безкоштовний (гарантійний). Він забрав
       час і деталі, тож у «скільки ми зробили» входить. Це навмисно не те
       саме, що `countOperations` у `day-report.ts`, яка рахує ЧЕКИ і нульові
       ремонти виключає: там питання «скільки разів пробили касу». */
    repairBucket.units += 1;
  }

  const byCategory: CategoryProfit[] = PROFIT_CATEGORIES.map((category) => {
    const { revenue, cost, units } = acc.get(category)!;
    const profit = revenue - cost;
    return { category, revenue, cost, profit, margin: margin(revenue, profit), units };
  });

  const revenue = byCategory.reduce((s, c) => s + c.revenue, 0);
  const cost = byCategory.reduce((s, c) => s + c.cost, 0);
  const units = byCategory.reduce((s, c) => s + c.units, 0);
  const profit = revenue - cost;

  return { revenue, cost, profit, margin: margin(revenue, profit), units, byCategory };
}

export interface SkuLine {
  /** `${item_type}:${item_id}` — стабільний ключ для React і для сортування. */
  key: string;
  itemType: ProfitCategory;
  itemId: string | null;
  /** Назва на момент читання; `null`, якщо товар видалено з каталогу. */
  name: string | null;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  /** У скількох чеках зустрічалась позиція. Не те саме, що `units`. */
  receipts: number;
}

export type SkuSort = "units" | "revenue" | "profit";

/**
 * Позиції за період: скільки штук, на скільки грошей, з якою маржею.
 *
 * Рахується з тих самих `allocateSaleRevenue` і `itemCost`, що й
 * `computeProfit`, а не окремою арифметикою. Це не стиль, а гарантія: сума
 * `revenue` по всіх рядках дорівнює `computeProfit(...).revenue` за побудовою,
 * тож таблиця Івана і графік Віктора не можуть показати різні числа. Тест на
 * цю тотожність обов'язковий — без нього гарантія тримається на чесному слові.
 *
 * Ремонти сюди не входять: у них немає позиції каталогу, і рядок «ремонт»
 * серед SKU був би одним величезним стовпчиком без сенсу. Вони окремою
 * категорією в `computeProfit`.
 *
 * @param names `item_id → назва`. Чого немає — лишається `null`: п'ять позицій
 *   у базі вказують на видалені аксесуари, і вигадувати їм назву гірше, ніж
 *   чесно показати «товар видалено».
 */
export function topSellers(
  sales: ProfitSale[],
  devices: Map<string, ProfitDeviceCost>,
  names?: Map<string, string>,
  sort: SkuSort = "units",
): SkuLine[] {
  const acc = new Map<
    string,
    { itemType: ProfitCategory; itemId: string | null; units: number; revenue: number; cost: number; receipts: number }
  >();

  for (const sale of sales) {
    const revenues = allocateSaleRevenue(sale.items, sale.total_amount);
    const seenInThisReceipt = new Set<string>();

    sale.items.forEach((item, i) => {
      const cat = toCategory(item.item_type);
      if (!cat) return;
      const key = `${item.item_type}:${item.item_id ?? "unknown"}`;
      const cur =
        acc.get(key) ??
        { itemType: cat, itemId: item.item_id, units: 0, revenue: 0, cost: 0, receipts: 0 };

      cur.units += itemUnits(item);
      cur.revenue += revenues[i];
      cur.cost += itemCost(item, devices);
      // Одна позиція двічі в одному чеку — це один чек, а не два.
      if (!seenInThisReceipt.has(key)) {
        cur.receipts += 1;
        seenInThisReceipt.add(key);
      }
      acc.set(key, cur);
    });
  }

  const lines: SkuLine[] = [...acc.entries()].map(([key, v]) => {
    const profit = v.revenue - v.cost;
    return {
      key,
      itemType: v.itemType,
      itemId: v.itemId,
      name: v.itemId ? names?.get(v.itemId) ?? null : null,
      units: v.units,
      revenue: v.revenue,
      cost: v.cost,
      profit,
      margin: margin(v.revenue, profit),
      receipts: v.receipts,
    };
  });

  // Тайбрейк по ключу, щоб порядок не стрибав між рендерами при рівних числах.
  return lines.sort((a, b) => (b[sort] - a[sort]) || a.key.localeCompare(b.key));
}

// ─── Діапазони ──────────────────────────────────────────────────────────────

export type RangePreset = "today" | "7d" | "30d" | "month" | "prev" | "all";

export const RANGE_PRESETS: RangePreset[] = ["today", "7d", "30d", "month", "prev", "all"];

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Сьогодні",
  "7d": "7 днів",
  "30d": "30 днів",
  month: "Цей місяць",
  prev: "Минулий місяць",
  all: "За весь час",
};

export function isRangePreset(v: string | null | undefined): v is RangePreset {
  return !!v && (RANGE_PRESETS as string[]).includes(v);
}

// ─── Фінансова епоха ────────────────────────────────────────────────────────

/**
 * Опускає нижню межу грошового вікна до фінансової епохи (`finance_epoch` із
 * settings), якщо вікно починається раніше за неї. До магазину справжнього
 * відкриття були тестові продажі "з рук" — вони лишаються в базі (нічого не
 * видаляється), але не мають враховуватись у жодному грошовому розрахунку.
 *
 * `epochIso === null` (налаштування не задане чи некоректне) — межу не
 * чіпаємо, стара поведінка зберігається без змін.
 *
 * Якщо після підняття межі вона впирається в кінець вікна (чи виходить за
 * нього), вікно вважається порожнім — виклик має пропустити запит до бази й
 * повернути нулі, а не смикати Supabase діапазоном `start >= end`.
 */
export function floorAtEpoch(
  start: Date,
  end: Date,
  epochIso: string | null,
): { start: Date; end: Date; empty: boolean } {
  if (!epochIso) return { start, end, empty: start >= end };
  const epoch = new Date(epochIso);
  if (Number.isNaN(epoch.getTime())) return { start, end, empty: start >= end };
  const effectiveStart = epoch > start ? epoch : start;
  return { start: effectiveStart, end, empty: effectiveStart >= end };
}

/**
 * Межі одного конкретного дня за ключем `YYYY-MM-DD`: `[північ, наступна
 * північ)`, локальний час — так само, як `resolveRange`. Ключ має бути вже
 * провалідований (`isDayKey`); тут ми йому довіряємо.
 */
export function dayRange(dayKey: string): { start: Date; end: Date } {
  const [y, m, d] = dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  return { start, end };
}

/**
 * Межі періоду: `start` включно, `end` виключно. Обидві — локальна північ,
 * бо магазин працює за місцевим часом, а не за UTC.
 */
export function resolveRange(
  preset: RangePreset,
  now: Date,
): { start: Date; end: Date } {
  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const today = midnight(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (preset) {
    case "today":
      return { start: today, end: tomorrow };
    case "7d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start, end: tomorrow };
    }
    case "30d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { start, end: tomorrow };
    }
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    case "prev":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    case "all":
      return {
        start: new Date(2020, 0, 1),
        end: tomorrow,
      };
  }
}

/** Скільки попередніх днів усереднюємо в базу для пресету «сьогодні». */
export const BASELINE_DAYS = 7;

/**
 * Довжина ряду під графік, коли обраний період — один день. Сам по собі день
 * це одна точка, тобто не графік; показуємо два тижні контексту навколо нього.
 */
export const TREND_DAYS = 14;

/**
 * Глибина вибірки для леджера часток. «Нараховано» — це 50% чистого прибутку
 * від фінансової епохи, тож рядки треба тягнути від неї; ця стеля не дає
 * запиту рости вічно. Коли магазин її переросте, правильна відповідь — денна
 * rollup-таблиця, а не ширше вікно; доти леджер чесно каже `approximate`.
 */
export const LEDGER_MAX_DAYS = 400;

/**
 * База порівняння для пресету.
 *
 * Для «сьогодні» це НЕ вчора: магазин робить 5–15 чеків на день, один
 * проданий апарат за 15 000 ₴ дає «+280%», а наступного дня «−70%». Така
 * дельта — шум, який швидко вчишся ігнорувати. Базою беремо сім попередніх
 * повних днів, а `comparisonFor` ділить їх на кількість днів — виходить
 * «середній день», який одна велика продажа вже не перекидає.
 *
 * Для решти пресетів — рівний попередній відрізок. `month` порівнюється не з
 * повним минулим місяцем, а з тією самою кількістю його днів: 5 липня проти
 * повного червня виглядало б катастрофою щомісяця.
 */
export function previousRange(
  preset: RangePreset,
  now: Date,
): { start: Date; end: Date } {
  const back = (from: Date, days: number) => {
    const d = new Date(from);
    d.setDate(d.getDate() - days);
    return d;
  };

  const cur = resolveRange(preset, now);

  switch (preset) {
    case "today":
      return { start: back(cur.start, BASELINE_DAYS), end: cur.start };
    case "7d":
      return { start: back(cur.start, 7), end: cur.start };
    case "30d":
      return { start: back(cur.start, 30), end: cur.start };
    case "month": {
      // Стільки ж днів минулого місяця, скільки вже минуло цього. Якщо
      // минулий місяць коротший (31 березня → лютий), упираємось у його край.
      const daysElapsed = now.getDate();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const naiveEnd = new Date(now.getFullYear(), now.getMonth() - 1, 1 + daysElapsed);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: naiveEnd < prevMonthEnd ? naiveEnd : prevMonthEnd };
    }
    case "prev":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        end: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      };
    case "all":
      return { start: cur.start, end: cur.start };
  }
}

// ─── Датасет: одна вибірка, багато зрізів ───────────────────────────────────

/**
 * Дашборду треба одне й те саме число в шести розрізах (пресет, сьогодні,
 * тиждень, місяць, база порівняння, денний ряд для графіка). Раніше кожен
 * розріз ходив у базу окремо — до чотирнадцяти роунд-тріпів на рендер, плюс
 * `getDailyShares` сканував усе від епохи без верхньої межі.
 *
 * Замість цього тягнемо рядки один раз за найширше потрібне вікно і ріжемо їх
 * у пам'яті. Рушій прибутку лишається один — усі зрізи врешті делегують у
 * `computeProfit`, тож графік не може розійтися з KPI над ним.
 */

export interface DatedSale extends ProfitSale {
  id: string;
  created_at: string;
}

export interface DatedRepair extends ProfitRepair {
  /** `repairs.id` — щоб чек ремонту можна було показати в списку операцій. */
  id: string;
  /**
   * День, яким ремонт лягає в період: дата видачі клієнту. Рахує
   * `repairSettledAt`; сюди приходить уже готове значення, бо правило одне на
   * всю систему.
   */
  settled_at: string;
}

export interface DatedExpense {
  amount: number;
  created_at: string;
  category_id: string | null;
  paid_from_safe_id: string | null;
}

export interface ProfitDataset {
  sales: DatedSale[];
  repairs: DatedRepair[];
  expenses: DatedExpense[];
  devices: Map<string, ProfitDeviceCost>;
  /**
   * Нижня межа вибірки. Зріз, що починається раніше за неї, поверне нулі —
   * і це буде мовчазна брехня, а не порожній період. Викликач зобов'язаний
   * рахувати вікно через `datasetWindowStart`, який покриває всі зрізи, що
   * дашборд збирається просити.
   */
  windowStart: Date;
}

/**
 * Найраніша дата, яку дашборд може спитати за цього пресету — нижня межа
 * всіх вікон разом: сам пресет, його база порівняння, фіксовані
 * сьогодні/тиждень/місяць та ряд під графік.
 *
 * Рахується, а не задається константою: найдальше сягає `prev` наприкінці
 * довгого місяця (31 січня → 1 листопада, 92 дні), і будь-яка кругла
 * константа тут або зайва, або тихо ріже базу порівняння раз на рік.
 */
export function datasetWindowStart(preset: RangePreset, now: Date): Date {
  const starts = [
    resolveRange(preset, now).start,
    previousRange(preset, now).start,
    resolveRange("today", now).start,
    resolveRange("7d", now).start,
    resolveRange("month", now).start,
    chartWindow(preset, now).start,
  ];

  return new Date(Math.min(...starts.map((d) => d.getTime())));
}

/**
 * Вікно графіка для обраного періоду.
 *
 * Графік має показувати те саме, що й цифри над ним: перемикаєш «Цей місяць» —
 * бачиш дні цього місяця, а не незмінні останні тридцять. Виняток один —
 * «Сьогодні»: один день це одна точка, тож замість неї малюємо `TREND_DAYS`
 * днів, що закінчуються сьогодні. Тоді графік відповідає на «як сьогодні
 * виглядає на тлі решти», а не на «скільки саме сьогодні», — це вже написано
 * великими цифрами поруч.
 */
export function chartWindow(
  preset: RangePreset,
  now: Date,
): { start: Date; end: Date } {
  const range = resolveRange(preset, now);
  if (preset !== "today") return range;

  const start = new Date(range.start);
  start.setDate(start.getDate() - (TREND_DAYS - 1));
  return { start, end: range.end };
}

/** Рядок ремонту так, як його треба вибрати з бази для P&L. */
export interface RepairPnlRow extends ProfitRepair, SettleableRepair {
  id: string;
}

/** Поля, які мусить містити SELECT ремонтів для P&L. Один рядок на всі місця. */
export const REPAIR_PNL_COLUMNS =
  "id, status, price, cost, external_sc_cost, completed_at";

/**
 * Відбирає ремонти, закриті всередині `[start, end)`, і проставляє їм день.
 *
 * Живе тут, а не трьома копіями в дашборді, фінансах і аналітиці: саме через
 * незалежні копії правила `completed` колись почав означати різне в різних
 * місцях. SQL-фільтр по датах лишається грубим — точне рішення завжди тут.
 */
export function toDatedRepairs(
  rows: RepairPnlRow[],
  start: Date,
  end: Date,
): DatedRepair[] {
  const out: DatedRepair[] = [];
  for (const r of rows) {
    const settled = repairSettledAt(r);
    if (!settled || !inWindow(settled, start, end)) continue;
    out.push({
      id: r.id,
      settled_at: settled,
      price: r.price,
      cost: r.cost,
      external_sc_cost: r.external_sc_cost,
    });
  }
  return out;
}

function inWindow(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= start.getTime() && t < end.getTime();
}

/** Прибуток за довільне вікно `[start, end)` з уже вибраного датасету. */
export function sliceProfit(ds: ProfitDataset, start: Date, end: Date): ProfitResult {
  if (start >= end) return computeProfit([], ds.devices, []);
  return computeProfit(
    ds.sales.filter((s) => inWindow(s.created_at, start, end)),
    ds.devices,
    ds.repairs.filter((r) => inWindow(r.settled_at, start, end)),
  );
}

/**
 * Операційні витрати за вікно, з двома винятками — тими самими, що були в
 * `expensesForRange`:
 *   1. капітальна категорія — разові вкладення на відкриття, не OPEX;
 *   2. сейф чистого прибутку — вилучення власників уже враховані як
 *      розподілений прибуток, вдруге вони подвоїли б витрати.
 *
 * Обидва винятки спрацьовують лише коли відповідний id справді заданий:
 * порівняння `null !== null` відсікало витрати без категорії, коли
 * `capital_category_id` у налаштуваннях не виставлений.
 */
export function sliceExpenses(
  ds: ProfitDataset,
  start: Date,
  end: Date,
  capitalCategoryId: string | null,
  netProfitSafeId: string | null,
): number {
  if (start >= end) return 0;
  return ds.expenses
    .filter((e) => inWindow(e.created_at, start, end))
    .filter((e) => !(capitalCategoryId && e.category_id === capitalCategoryId))
    .filter((e) => !(netProfitSafeId && e.paid_from_safe_id === netProfitSafeId))
    .reduce((s, e) => s + num(e.amount), 0);
}

export interface AveragesTotals {
  /**
   * Дробові дні від початку вікна до кінця — різниця часу, а не кількість
   * календарних дат. Епоха рідко стоїть опівночі, і рахувати перший день
   * цілим означало б занижувати темп на частку доби, якої не було.
   */
  days: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  /** Той самий фільтр, що й у `sliceExpenses`: без капіталу й без сейфа ЧП. */
  opex: number;
  netProfit: number;
  /** Кількість чеків (`sales`, `status = completed`) у вікні. */
  receipts: number;
  /** Ремонти вже всередині — категорія `repair`, як і в `computeProfit`. */
  byCategory: CategoryProfit[];
}

/**
 * Скільки магазин у середньому робить на день — від довільного вікна (типово
 * фінансової епохи до зараз), а не за календарний пресет.
 *
 * «На тиждень» — не окремий підрахунок, а той самий підсумок × 7 / `days`;
 * рахувати його тут означало б тримати два незалежні означення одного й
 * того самого темпу. Викликач ділить сам, коли формує підпис.
 *
 * `null`, коли вікно порожнє чи вироджене (`days <= 0`) — ділити нема на що,
 * і краще явна відсутність числа, ніж підстава нуля замість дня.
 */
export function computeAverages(
  ds: ProfitDataset,
  windowStart: Date,
  windowEnd: Date,
  capitalCategoryId: string | null,
  netProfitSafeId: string | null,
): AveragesTotals | null {
  const days = (windowEnd.getTime() - windowStart.getTime()) / 86_400_000;
  if (!(days > 0)) return null;

  const profit = sliceProfit(ds, windowStart, windowEnd);
  const opex = sliceExpenses(ds, windowStart, windowEnd, capitalCategoryId, netProfitSafeId);
  const receipts = ds.sales.filter((s) => inWindow(s.created_at, windowStart, windowEnd)).length;

  return {
    days,
    revenue: profit.revenue,
    cost: profit.cost,
    grossProfit: profit.profit,
    opex,
    netProfit: profit.profit - opex,
    receipts,
    byCategory: profit.byCategory,
  };
}

export interface DayPoint {
  /** Локальна дата, `YYYY-MM-DD`. */
  day: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  /** Операційні витрати дня. */
  expenses: number;
  /** Чистими за день: `profit − expenses`. Може бути від'ємним. */
  net: number;
}

/**
 * Денний ряд за `[from, to)` — по точці на КОЖЕН календарний день, включно з
 * тими, де нічого не продали. День без продажів справді дав нуль виторгу, і
 * графік має показати нуль, а не розрив: розрив читається як «дані загубились».
 *
 * Дні групуються тим самим локальним ключем, що й денна навігація в UI
 * (`utils/day.ts`), а кожен день рахується `computeProfit` — тому сума днів за
 * місяць збігається з місячним числом за побудовою, а не за домовленістю.
 */
export function dailySeries(
  ds: ProfitDataset,
  from: Date,
  to: Date,
  opts: { capitalCategoryId: string | null; netProfitSafeId: string | null },
): DayPoint[] {
  if (from >= to) return [];

  const salesByDay = new Map<string, DatedSale[]>();
  for (const s of ds.sales) {
    if (!inWindow(s.created_at, from, to)) continue;
    const key = dayKey(new Date(s.created_at));
    const arr = salesByDay.get(key);
    if (arr) arr.push(s);
    else salesByDay.set(key, [s]);
  }

  const repairsByDay = new Map<string, DatedRepair[]>();
  for (const r of ds.repairs) {
    if (!inWindow(r.settled_at, from, to)) continue;
    const key = dayKey(new Date(r.settled_at));
    const arr = repairsByDay.get(key);
    if (arr) arr.push(r);
    else repairsByDay.set(key, [r]);
  }

  const expensesByDay = new Map<string, number>();
  for (const e of ds.expenses) {
    if (!inWindow(e.created_at, from, to)) continue;
    if (opts.capitalCategoryId && e.category_id === opts.capitalCategoryId) continue;
    if (opts.netProfitSafeId && e.paid_from_safe_id === opts.netProfitSafeId) continue;
    const key = dayKey(new Date(e.created_at));
    expensesByDay.set(key, (expensesByDay.get(key) ?? 0) + num(e.amount));
  }

  const out: DayPoint[] = [];
  const lastKey = dayKey(new Date(to.getTime() - 1));
  for (let key = dayKey(from); key <= lastKey; key = addDays(key, 1)) {
    const p = computeProfit(
      salesByDay.get(key) ?? [],
      ds.devices,
      repairsByDay.get(key) ?? [],
    );
    const expenses = expensesByDay.get(key) ?? 0;
    out.push({
      day: key,
      revenue: p.revenue,
      cost: p.cost,
      profit: p.profit,
      margin: p.margin,
      expenses,
      net: p.profit - expenses,
    });
  }

  return out;
}

/**
 * Частка співвласника в чистому прибутку. Фіксовано 50%, не налаштовується.
 *
 * Живе тут, а не в `data-dashboard`, бо її читають і клієнтські компоненти —
 * а той модуль тягне за собою серверний Supabase-клієнт із `next/headers`.
 */
export const PARTNER_SHARE = 0.5;

export interface Comparison {
  /** Готовий підпис бази: «до середнього дня», «до минулих 7 днів». */
  label: string;
  revenue: number;
  profit: number;
  margin: number;
}

const COMPARISON_LABELS: Record<Exclude<RangePreset, "today" | "all">, string> = {
  "7d": "до минулих 7 днів",
  "30d": "до минулих 30 днів",
  month: "до того ж періоду минулого місяця",
  prev: "до позаминулого місяця",
};

/** Кількість календарних днів у `[start, end)`. */
function countDays(start: Date, end: Date): number {
  let n = 0;
  const lastKey = dayKey(new Date(end.getTime() - 1));
  for (let key = dayKey(start); key <= lastKey; key = addDays(key, 1)) n++;
  return n;
}

/**
 * База порівняння за той самий датасет. `null` означає «бази немає» — UI тоді
 * не малює дельту взагалі, замість того щоб показати «+100%» проти нуля.
 *
 * Для «сьогодні» результат ділиться на кількість днів бази і стає середнім
 * днем. Менш ніж на трьох днях історії середнє нічого не означає, тож
 * повертаємо `null`: перший тиждень роботи магазину дашборд просто мовчить
 * про тренд, а не вигадує його.
 */
export function comparisonFor(
  ds: ProfitDataset,
  preset: RangePreset,
  now: Date,
  epochIso: string | null,
): Comparison | null {
  if (preset === "all") return null;

  const prev = previousRange(preset, now);
  const { start, end, empty } = floorAtEpoch(prev.start, prev.end, epochIso);
  if (empty) return null;

  const res = sliceProfit(ds, start, end);

  if (preset !== "today") {
    if (res.revenue === 0) return null;
    return {
      label: COMPARISON_LABELS[preset],
      revenue: res.revenue,
      profit: res.profit,
      margin: res.margin,
    };
  }

  const days = countDays(start, end);
  if (days < 3 || res.revenue === 0) return null;
  return {
    label: "до середнього дня",
    revenue: Math.round(res.revenue / days),
    profit: Math.round(res.profit / days),
    margin: res.margin,
  };
}

/**
 * Відносна зміна у відсотках, або `null` коли базa нульова. Ділення на нуль
 * тут не «нескінченний ріст», а відсутність бази — саме тому не 0 і не 100.
 */
export function deltaPct(value: number, base: number): number | null {
  if (!base) return null;
  return Math.round(((value - base) / Math.abs(base)) * 100);
}

// ─── Погодинні ряди для одного дня ──────────────────────────────────────────

export interface HourlyPoint {
  hour: number;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  count: number;
}

export function hourlyProfitSeries(
  sales: DatedSale[],
  repairs: DatedRepair[],
  devices: Map<string, ProfitDeviceCost>,
  dayStart: Date,
  dayEnd: Date,
): HourlyPoint[] {
  const salesByHour = new Map<number, DatedSale[]>();
  for (const s of sales) {
    if (!inWindow(s.created_at, dayStart, dayEnd)) continue;
    const h = new Date(s.created_at).getHours();
    if (h < 0 || h > 23 || Number.isNaN(h)) continue;
    const arr = salesByHour.get(h);
    if (arr) arr.push(s);
    else salesByHour.set(h, [s]);
  }

  const repairsByHour = new Map<number, DatedRepair[]>();
  for (const r of repairs) {
    if (!inWindow(r.settled_at, dayStart, dayEnd)) continue;
    const h = new Date(r.settled_at).getHours();
    if (h < 0 || h > 23 || Number.isNaN(h)) continue;
    const arr = repairsByHour.get(h);
    if (arr) arr.push(r);
    else repairsByHour.set(h, [r]);
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const hSales = salesByHour.get(hour) ?? [];
    const hRepairs = repairsByHour.get(hour) ?? [];
    const p = computeProfit(hSales, devices, hRepairs);
    const count = hSales.length + hRepairs.filter((r) => r.price > 0).length;
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      revenue: p.revenue,
      cost: p.cost,
      profit: p.profit,
      margin: p.margin,
      count,
    };
  });
}

// ─── Агрегація рядів (день / тиждень / місяць) ───────────────────────────────

export type GroupBy = "day" | "week" | "month";

export interface AggregatedPoint {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  expenses: number;
  net: number;
}

export function aggregateSeries(
  daily: DayPoint[],
  groupBy: GroupBy,
): AggregatedPoint[] {
  if (daily.length === 0) return [];
  if (groupBy === "day") {
    return daily.map((d) => ({
      key: d.day,
      label: d.day,
      revenue: d.revenue,
      cost: d.cost,
      profit: d.profit,
      margin: d.margin,
      expenses: d.expenses,
      net: d.net,
    }));
  }

  if (groupBy === "week") {
    const groups = new Map<string, { label: string; days: DayPoint[] }>();
    for (const d of daily) {
      const [y, m, dayNum] = d.day.split("-").map(Number);
      const date = new Date(y, m - 1, dayNum);
      const dayOfWeek = (date.getDay() + 6) % 7; // 0=Mon, 6=Sun
      const mon = new Date(date);
      mon.setDate(date.getDate() - dayOfWeek);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      const monKey = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
      const weekKey = `w-${monKey}`;

      const monFmt = `${mon.getDate()} ${mon.toLocaleDateString("uk-UA", { month: "short" })}`;
      const sunFmt = `${sun.getDate()} ${sun.toLocaleDateString("uk-UA", { month: "short" })}`;
      const label = `${monFmt} – ${sunFmt}`;

      const grp = groups.get(weekKey);
      if (grp) grp.days.push(d);
      else groups.set(weekKey, { label, days: [d] });
    }

    const out: AggregatedPoint[] = [];
    for (const [key, { label, days }] of groups.entries()) {
      const revenue = days.reduce((s, d) => s + d.revenue, 0);
      const cost = days.reduce((s, d) => s + d.cost, 0);
      const profit = days.reduce((s, d) => s + d.profit, 0);
      const expenses = days.reduce((s, d) => s + d.expenses, 0);
      const net = profit - expenses;
      out.push({
        key,
        label,
        revenue,
        cost,
        profit,
        margin: margin(revenue, profit),
        expenses,
        net,
      });
    }
    return out;
  }

  // groupBy === "month"
  const groups = new Map<string, { label: string; days: DayPoint[] }>();
  for (const d of daily) {
    const monthKey = d.day.slice(0, 7); // YYYY-MM
    const [y, m] = monthKey.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    const label = date.toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
    const grp = groups.get(monthKey);
    if (grp) grp.days.push(d);
    else groups.set(monthKey, { label, days: [d] });
  }

  const out: AggregatedPoint[] = [];
  for (const [key, { label, days }] of groups.entries()) {
    const revenue = days.reduce((s, d) => s + d.revenue, 0);
    const cost = days.reduce((s, d) => s + d.cost, 0);
    const profit = days.reduce((s, d) => s + d.profit, 0);
    const expenses = days.reduce((s, d) => s + d.expenses, 0);
    const net = profit - expenses;
    out.push({
      key,
      label,
      revenue,
      cost,
      profit,
      margin: margin(revenue, profit),
      expenses,
      net,
    });
  }
  return out;
}
