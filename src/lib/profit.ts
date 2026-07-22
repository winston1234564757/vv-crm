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
  discount: number | null;
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
}

export interface ProfitResult {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
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
  const qty = item.quantity == null ? 1 : num(item.quantity);
  if (item.item_type === "device" && item.item_id) {
    const dev = devices.get(item.item_id);
    if (dev) return (num(dev.cost_price) + num(dev.repair_cost)) * qty;
  }
  return num(item.unit_cost) * qty;
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
 * гривень на кожен елемент, сума яких точно дорівнює `lineTotal - discount`.
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
function allocateSaleRevenue(items: ProfitSaleItem[], discount: number | null): number[] {
  const lineTotal = items.reduce((s, it) => s + num(it.total_price), 0);
  // У БД немає CHECK (discount >= 0) — від'ємне значення обрізаємо до нуля,
  // інакше воно роздує виторг замість того, щоб його зменшити.
  const rawDiscount = Math.max(0, num(discount));

  if (!rawDiscount || lineTotal === 0) {
    return items.map((it) => num(it.total_price));
  }

  // Знижка більша за суму позицій чека — це або помилка каси, або
  // акційний чек, продубльований на нуль. Виторг у мінус не йде: урізаємо
  // знижку до суми позицій, найгірший випадок — нульовий виторг з чека.
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
  const acc = new Map<ProfitCategory, { revenue: number; cost: number }>(
    PROFIT_CATEGORIES.map((c) => [c, { revenue: 0, cost: 0 }]),
  );

  for (const sale of sales) {
    const revenues = allocateSaleRevenue(sale.items, sale.discount);
    sale.items.forEach((item, i) => {
      const cat = toCategory(item.item_type);
      if (!cat) return;
      const bucket = acc.get(cat)!;
      bucket.revenue += revenues[i];
      bucket.cost += itemCost(item, devices);
    });
  }

  const repairBucket = acc.get("repair")!;
  for (const r of repairs) {
    repairBucket.revenue += num(r.price);
    repairBucket.cost += num(r.cost) + num(r.external_sc_cost);
  }

  const byCategory: CategoryProfit[] = PROFIT_CATEGORIES.map((category) => {
    const { revenue, cost } = acc.get(category)!;
    const profit = revenue - cost;
    return { category, revenue, cost, profit, margin: margin(revenue, profit) };
  });

  const revenue = byCategory.reduce((s, c) => s + c.revenue, 0);
  const cost = byCategory.reduce((s, c) => s + c.cost, 0);
  const profit = revenue - cost;

  return { revenue, cost, profit, margin: margin(revenue, profit), byCategory };
}

// ─── Діапазони ──────────────────────────────────────────────────────────────

export type RangePreset = "today" | "7d" | "30d" | "month" | "prev";

export const RANGE_PRESETS: RangePreset[] = ["today", "7d", "30d", "month", "prev"];

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Сьогодні",
  "7d": "7 днів",
  "30d": "30 днів",
  month: "Цей місяць",
  prev: "Минулий місяць",
};

export function isRangePreset(v: string | null | undefined): v is RangePreset {
  return !!v && (RANGE_PRESETS as string[]).includes(v);
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
  }
}
