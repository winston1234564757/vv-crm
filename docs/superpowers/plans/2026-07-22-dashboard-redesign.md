# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перебудувати `/admin` навколо двох питань — що потребує дії і скільки
насправді зароблено — виправивши по дорозі два грошові баги, через які прибуток
завищується, а неіснуючий борг показується як справжній.

**Architecture:** Уся арифметика прибутку переїжджає в чистий модуль
`lib/profit.ts`, який стає єдиним джерелом і для дашборда, і для Фінансів —
інакше дві сторінки розійдуться на 3 650 ₴. Перевірки «потребує уваги» — другий
чистий модуль `lib/attention.ts`. Обидва тестуються без бази. Сторінка стає
тонким рендером над ними. Вісім аналітичних віджетів переїжджають на
`/admin/analytics` без змін.

**Tech Stack:** Next.js 16.2.7 (App Router, webpack), React 19, TypeScript,
Supabase (Postgres), Tailwind v4, Vitest.

## Global Constraints

- **Спека:** `docs/superpowers/specs/2026-07-22-dashboard-design.md`. Хендоф:
  `docs/HANDOFF-2026-07-22.md`. Читати обидва перед першою задачею.
- **Магазин відкривається 24.07.2026.** Усі дані в базі — продажі з рук.
  Не робити висновків із поточної статистики й не «оптимізувати» під неї.
- **`src/types/database.ts` — UTF-16LE.** Правити тільки скриптом:
  `readFileSync().toString("utf16le")`, повертати BOM. Не редагувати вручну.
- **Міграції — і в базу, і у файл.** MCP `apply_migration` локальний файл не
  створює. Писати обидва: `supabase/migrations/<timestamp>_<name>.sql`.
- **Грошові функції перевіряти з відкотом:** `begin; … rollback;`. `DO`-блок
  без зовнішньої транзакції нічого не відкочує.
- **Нові SECURITY DEFINER функції:** `REVOKE EXECUTE … FROM PUBLIC, anon;`
  потім `GRANT EXECUTE … TO authenticated, service_role;`
- **`cn` тепер справді перебиває класи** (`tailwind-merge`). Де розмір
  критичний, використовувати проп `inline` у `Select`, не оверрайд.
- **Українська** в усьому UI-тексті. Гривня — `₴` після числа з нерозривним
  пробілом там, де верстка це дозволяє.
- **Команди:** `npm test` (vitest run), `npx tsc --noEmit`, `npm run build`.
- **Гроші — цілі числа гривень.** Ніяких `toFixed(2)` у нових розрахунках:
  наявні дані цілі, а плаваюча кома в підсумках дає копійчані розбіжності зі
  звіркою §8 спеки.

---

## File Structure

**Створюємо:**

| Файл | Відповідальність |
|---|---|
| `src/lib/profit.ts` | Уся арифметика прибутку й маржі. Чистий, без Supabase. |
| `src/lib/__tests__/profit.test.ts` | Тести до нього, включно з регресією Tecno 8P. |
| `src/lib/attention.ts` | Перевірки «потребує уваги». Чистий, без Supabase. |
| `src/lib/__tests__/attention.test.ts` | Тести, включно з формулою «статус не рухався». |
| `src/lib/data-attention.ts` | Читання з бази для `attention.ts`. |
| `src/app/admin/analytics/page.tsx` | Нова сторінка для восьми віджетів. |
| `src/app/admin/analytics/AnalyticsClient.tsx` | Їх рендер, перенесений як є. |
| `src/app/admin/AttentionSection.tsx` | Блок «Потребує уваги». |
| `src/app/admin/MoneySection.tsx` | Блок «Гроші» з пресетами діапазону. |
| `supabase/migrations/*_internal_repairs_unpaid.sql` | §3.1 спеки. |
| `supabase/migrations/*_stale_needs_repair.sql` | §3.2 спеки. |

**Змінюємо:**

| Файл | Що саме |
|---|---|
| `src/lib/data-finance.ts:79-170` | `getFinanceReport` переходить на `profit.ts`. |
| `src/lib/actions/repairs.ts:785-805` | `recalcRepairPaymentStatus` — виняток для складських. |
| `src/lib/data-settings.ts` | Ключ `sales_targets`. |
| `src/lib/data-dashboard.ts` | З 26 запитів до ~6; аналітика переїжджає. |
| `src/app/admin/page.tsx` | `force-dynamic`, без ролей, ліниві лукапи. |
| `src/app/admin/DashboardClient.tsx` | Переписується (337 → ~120 р.). |
| `src/components/RepairDetailView.tsx:333` | `payment_status = null` більше не «Не оплачено». |
| `src/app/admin/repairs/repair-columns.tsx:101,142` | Те саме. |
| `src/lib/ai-prompts/index.ts:113-141` | `buildInsightsPrompt` на реальні числа. |
| `src/app/api/ai-chat/route.ts` | Нові аргументи промпту. |

**Видаляємо:** `src/app/api/ai-insights/route.ts` (нуль викликів).

---

## Task 1: `lib/profit.ts` — арифметика прибутку

Найважливіша задача плану. Усе інше залежить від неї.

**Files:**
- Create: `src/lib/profit.ts`
- Test: `src/lib/__tests__/profit.test.ts`

**Interfaces:**
- Consumes: нічого.
- Produces:
  - `type ProfitCategory = "device" | "accessory" | "service" | "repair"`
  - `type RangePreset = "today" | "7d" | "30d" | "month" | "prev"`
  - `interface ProfitSaleItem { item_type: string; item_id: string | null; quantity: number; total_price: number; unit_cost: number }`
  - `interface ProfitDeviceCost { cost_price: number; repair_cost: number | null }`
  - `interface ProfitRepair { price: number; cost: number | null; external_sc_cost: number | null }`
  - `interface CategoryProfit { category: ProfitCategory; revenue: number; cost: number; profit: number; margin: number }`
  - `interface ProfitResult { revenue: number; cost: number; profit: number; margin: number; byCategory: CategoryProfit[] }`
  - `function itemCost(item: ProfitSaleItem, devices: Map<string, ProfitDeviceCost>): number`
  - `function computeProfit(items: ProfitSaleItem[], devices: Map<string, ProfitDeviceCost>, repairs: ProfitRepair[]): ProfitResult`
  - `function resolveRange(preset: RangePreset, now: Date): { start: Date; end: Date }`
  - `const RANGE_LABELS: Record<RangePreset, string>`

- [ ] **Step 1: Написати падаючий тест**

Створити `src/lib/__tests__/profit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  itemCost,
  computeProfit,
  resolveRange,
  type ProfitSaleItem,
  type ProfitDeviceCost,
} from "../profit";

const DEV = new Map<string, ProfitDeviceCost>([
  ["tecno-8p", { cost_price: 600, repair_cost: 950 }],
  ["redmi-a5", { cost_price: 1000, repair_cost: 0 }],
  ["no-repair", { cost_price: 700, repair_cost: null }],
]);

function item(over: Partial<ProfitSaleItem> = {}): ProfitSaleItem {
  return {
    item_type: "accessory",
    item_id: "acc-1",
    quantity: 1,
    total_price: 100,
    unit_cost: 30,
    ...over,
  };
}

describe("itemCost", () => {
  it("adds the invested repair to a device cost", () => {
    // Регресія: sale_items.unit_cost дорівнює cost_price і ремонт губиться.
    const it_ = item({ item_type: "device", item_id: "tecno-8p", unit_cost: 600 });
    expect(itemCost(it_, DEV)).toBe(1550);
  });

  it("treats a null repair_cost as zero, not NaN", () => {
    const it_ = item({ item_type: "device", item_id: "no-repair", unit_cost: 700 });
    expect(itemCost(it_, DEV)).toBe(700);
  });

  it("falls back to the stored unit_cost when the device is unknown", () => {
    // Пристрій видалили — краще занижена собівартість, ніж нуль.
    const it_ = item({ item_type: "device", item_id: "ghost", unit_cost: 800 });
    expect(itemCost(it_, DEV)).toBe(800);
  });

  it("multiplies a non-device cost by quantity", () => {
    expect(itemCost(item({ quantity: 3, unit_cost: 30 }), DEV)).toBe(90);
  });

  it("multiplies a device cost by quantity too", () => {
    const it_ = item({ item_type: "device", item_id: "tecno-8p", quantity: 2, unit_cost: 600 });
    expect(itemCost(it_, DEV)).toBe(3100);
  });
});

describe("computeProfit", () => {
  it("reports the real margin on the Tecno 8P, not the inflated one", () => {
    // Купівля 600 + ремонт 950, продаж 2000. Зламаний unit_cost дав би 70%.
    const res = computeProfit(
      [item({ item_type: "device", item_id: "tecno-8p", total_price: 2000, unit_cost: 600 })],
      DEV,
      [],
    );
    expect(res.revenue).toBe(2000);
    expect(res.cost).toBe(1550);
    expect(res.profit).toBe(450);
    expect(res.margin).toBe(23);
  });

  it("splits revenue and profit by category", () => {
    const res = computeProfit(
      [
        item({ item_type: "device", item_id: "redmi-a5", total_price: 2000, unit_cost: 1000 }),
        item({ item_type: "accessory", total_price: 700, unit_cost: 223 }),
        item({ item_type: "service", total_price: 100, unit_cost: 0 }),
      ],
      DEV,
      [],
    );
    const by = Object.fromEntries(res.byCategory.map((c) => [c.category, c]));
    expect(by.device.profit).toBe(1000);
    expect(by.accessory.profit).toBe(477);
    expect(by.service.margin).toBe(100);
    expect(res.profit).toBe(1577);
  });

  it("counts the external service-centre cost against a repair", () => {
    const res = computeProfit([], DEV, [{ price: 1800, cost: 400, external_sc_cost: 300 }]);
    const repair = res.byCategory.find((c) => c.category === "repair")!;
    expect(repair.cost).toBe(700);
    expect(repair.profit).toBe(1100);
  });

  it("returns a zero margin instead of dividing by zero", () => {
    const res = computeProfit([], DEV, []);
    expect(res.margin).toBe(0);
    expect(res.profit).toBe(0);
  });

  it("always lists all four categories so the table keeps its shape", () => {
    const res = computeProfit([], DEV, []);
    expect(res.byCategory.map((c) => c.category)).toEqual([
      "device",
      "accessory",
      "service",
      "repair",
    ]);
  });

  it("does not hide a loss behind a floor of zero", () => {
    const res = computeProfit(
      [item({ item_type: "device", item_id: "tecno-8p", total_price: 1000, unit_cost: 600 })],
      DEV,
      [],
    );
    expect(res.profit).toBe(-550);
    expect(res.margin).toBe(-55);
  });
});

describe("resolveRange", () => {
  const now = new Date("2026-07-22T15:30:00");

  it("starts today at midnight and ends tomorrow at midnight", () => {
    const { start, end } = resolveRange("today", now);
    expect(start.toISOString()).toBe(new Date("2026-07-22T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-23T00:00:00").toISOString());
  });

  it("covers seven whole days including today", () => {
    const { start } = resolveRange("7d", now);
    expect(start.toISOString()).toBe(new Date("2026-07-16T00:00:00").toISOString());
  });

  it("runs the current month from the first", () => {
    const { start, end } = resolveRange("month", now);
    expect(start.toISOString()).toBe(new Date("2026-07-01T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-08-01T00:00:00").toISOString());
  });

  it("closes the previous month at the first of this one", () => {
    const { start, end } = resolveRange("prev", now);
    expect(start.toISOString()).toBe(new Date("2026-06-01T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-01T00:00:00").toISOString());
  });

  it("rolls the previous month back across a year boundary", () => {
    const { start, end } = resolveRange("prev", new Date("2026-01-09T12:00:00"));
    expect(start.toISOString()).toBe(new Date("2025-12-01T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-01-01T00:00:00").toISOString());
  });
});
```

- [ ] **Step 2: Запустити тест і переконатись, що він падає**

Run: `npx vitest run src/lib/__tests__/profit.test.ts`
Expected: FAIL — `Failed to resolve import "../profit"`.

- [ ] **Step 3: Написати модуль**

Створити `src/lib/profit.ts`:

```ts
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

export type ProfitCategory = "device" | "accessory" | "service" | "repair";

/** Порядок фіксований: таблиця не має перестрибувати між діапазонами. */
export const PROFIT_CATEGORIES: ProfitCategory[] = [
  "device",
  "accessory",
  "service",
  "repair",
];

export const CATEGORY_LABELS: Record<ProfitCategory, string> = {
  device: "Техніка",
  accessory: "Аксесуари",
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
  return Math.round((profit / revenue) * 100);
}

/**
 * Собівартість позиції чека.
 *
 * Для пристрою береться з `devices`, бо збережений `unit_cost` не знає про
 * ремонт. Якщо пристрою в мапі немає (видалили), падаємо назад на `unit_cost`:
 * занижена собівартість краща за нульову, і принаймні не мовчазна — такий
 * продаж видно в звірці §8 спеки.
 */
export function itemCost(
  item: ProfitSaleItem,
  devices: Map<string, ProfitDeviceCost>,
): number {
  const qty = num(item.quantity) || 1;
  if (item.item_type === "device" && item.item_id) {
    const dev = devices.get(item.item_id);
    if (dev) return (num(dev.cost_price) + num(dev.repair_cost)) * qty;
  }
  return num(item.unit_cost) * qty;
}

function toCategory(itemType: string): ProfitCategory | null {
  if (itemType === "device" || itemType === "accessory" || itemType === "service") {
    return itemType;
  }
  return null;
}

/**
 * @param items позиції чеків за період
 * @param devices собівартості проданих пристроїв, ключ — `devices.id`
 * @param repairs ЛИШЕ зовнішні завершені ремонти (`inventory_device_id is null`)
 */
export function computeProfit(
  items: ProfitSaleItem[],
  devices: Map<string, ProfitDeviceCost>,
  repairs: ProfitRepair[],
): ProfitResult {
  const acc = new Map<ProfitCategory, { revenue: number; cost: number }>(
    PROFIT_CATEGORIES.map((c) => [c, { revenue: 0, cost: 0 }]),
  );

  for (const item of items) {
    const cat = toCategory(item.item_type);
    if (!cat) continue;
    const bucket = acc.get(cat)!;
    bucket.revenue += num(item.total_price);
    bucket.cost += itemCost(item, devices);
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
```

- [ ] **Step 4: Запустити тести**

Run: `npx vitest run src/lib/__tests__/profit.test.ts`
Expected: PASS, 16 тестів.

Якщо `margin` на Tecno 8P дає 22 замість 23 — перевір, що ділиться `450/2000`
(= 22.5, `Math.round` → 23), а не щось інше.

- [ ] **Step 5: Тайпчек і коміт**

```bash
npx tsc --noEmit
git add src/lib/profit.ts src/lib/__tests__/profit.test.ts
git commit -m "feat(profit): one module for margin, with repair cost included"
```

---

## Task 2: Фінанси переходять на `lib/profit.ts`

Доводить, що модуль правильний: числа на Фінансах не мають змінитись **жодного**.

**Files:**
- Modify: `src/lib/data-finance.ts:79-170` (`getFinanceReport`)

**Interfaces:**
- Consumes: `computeProfit`, `itemCost`, `ProfitDeviceCost` із Task 1.
- Produces: `getFinanceReport` зберігає наявну форму повернення
  (`totalSales`, `totalPurchases`, `totalExpenses`, `salesCost`, `repairsRevenue`,
  `repairsCost`, `profit`, `categoryBreakdown`) і **додає** `byCategory:
  CategoryProfit[]`.

- [ ] **Step 1: Зафіксувати поточні числа як еталон**

```bash
npx tsx -e "import('./src/lib/data-finance').then(async m => console.log(await m.getFinanceReport(30)))" 2>/dev/null || echo "Якщо tsx немає — зняти числа з /admin/finance у браузері й записати сюди"
```

Записати `profit`, `salesCost`, `repairsRevenue` за 30 днів. Після правки вони
мають збігтися до гривні.

- [ ] **Step 2: Переписати розрахунок**

У `src/lib/data-finance.ts` замінити блоки «3. Calculate Cost of Goods Sold» і
«Calculate repair margin» (рядки ~126-150) на виклик модуля. Запит по ремонтах
у `Promise.all` (рядок ~91) змінити — додати `external_sc_cost` і фільтрувати за
завершенням:

```ts
supabase
  .from("repairs")
  .select("price, cost, external_sc_cost")
  .is("inventory_device_id", null)
  .in("status", ["completed", "handed_over"])
  .gte("completed_at", startStr),
```

**Фільтрувати саме по `completed_at`.** Не по `created_at` — ремонт, відкритий
40 днів тому й закритий сьогодні, має потрапити в звіт за поточний місяць. І не
по `updated_at` — він зіпсований груповими операціями (див. §2.1 спеки). Колонка
`completed_at` існує й заповнена на всіх 10 завершених ремонтах, покриття 100%.

Далі:

```ts
import { computeProfit, type ProfitDeviceCost, type ProfitSaleItem } from "./profit";

// …після побудови deviceCostsMap:
const allItems: ProfitSaleItem[] = salesData.flatMap((sale) =>
  supabaseCast<ProfitSaleItem[]>(sale.sale_items ?? []),
);

const report = computeProfit(allItems, deviceCostsMap, repairsRes.data ?? []);

const salesCost = report.byCategory
  .filter((c) => c.category !== "repair")
  .reduce((s, c) => s + c.cost, 0);
const repairsRevenue = report.byCategory.find((c) => c.category === "repair")!.revenue;
const repairsCost = report.byCategory.find((c) => c.category === "repair")!.cost;
const profit = report.profit - totalExpenses;
```

`deviceCostsMap` уже має тип `Map<string, { cost_price: number; repair_cost:
number }>` — привести до `Map<string, ProfitDeviceCost>`, тип сумісний.

У повернення додати `byCategory: report.byCategory`.

- [ ] **Step 3: Звірити з еталоном**

Відкрити `/admin/finance`, порівняти «Чистий операційний результат»,
«Собівартість & Витрати» і «Ремонти» з числами зі Step 1.

Expected: збіг до гривні. **Єдина дозволена розбіжність** — якщо є завершений
ремонт із ненульовим `external_sc_cost` або створений до періоду, а закритий
усередині. Тоді нове число правильніше; звірити вручну по конкретному ремонту.

- [ ] **Step 4: Тести й білд**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, 208+ тестів.

- [ ] **Step 5: Коміт**

```bash
git add src/lib/data-finance.ts
git commit -m "refactor(finance): compute the P&L through lib/profit"
```

---

## Task 3: Складські ремонти більше не винні грошей

**Files:**
- Modify: `src/lib/actions/repairs.ts:785-805`
- Modify: `src/components/RepairDetailView.tsx:333`
- Modify: `src/app/admin/repairs/repair-columns.tsx:101,142`
- Create: `supabase/migrations/20260722180000_internal_repairs_unpaid.sql`

**Interfaces:**
- Consumes: нічого.
- Produces: `repairs.payment_status = null` означає «платника немає». Усі читачі
  мають показувати «—», не «Не оплачено».

- [ ] **Step 1: Перевірити міграцію з відкотом**

Через MCP `execute_sql`:

```sql
begin;
create temp table res(step text, n int) on commit drop;
insert into res select 'before_unpaid_internal',
  count(*) from repairs where inventory_device_id is not null and payment_status = 'unpaid';
update repairs set payment_status = null where inventory_device_id is not null;
insert into res select 'after_unpaid_internal',
  count(*) from repairs where inventory_device_id is not null and payment_status is not null;
insert into res select 'external_untouched',
  count(*) from repairs where inventory_device_id is null and payment_status is not null;
select * from res;
rollback;
```

Expected: `before_unpaid_internal` = 10, `after_unpaid_internal` = 0,
`external_untouched` не змінилось.

- [ ] **Step 2: Виправити функцію, що відтворює баг**

У `src/lib/actions/repairs.ts` замінити тіло `recalcRepairPaymentStatus`:

```ts
async function recalcRepairPaymentStatus(
  supabase: SupabaseClient<Database>,
  repairId: string,
  price: number,
) {
  // Складський ремонт нікому не виставляють: його `price` — це внутрішня
  // вартість, а не дебіторка. Без цього винятку кожен такий ремонт назавжди
  // лишався `unpaid` і додавав неіснуючий борг до підсумків.
  const { data: repair } = await supabase
    .from("repairs")
    .select("inventory_device_id")
    .eq("id", repairId)
    .single();

  if (repair?.inventory_device_id) {
    await supabase.from("repairs").update({ payment_status: null }).eq("id", repairId);
    return;
  }

  const { data: payments, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("reference_type", "repair_payment")
    .eq("reference_id", repairId);

  if (error) return;

  const paid = (payments ?? []).reduce((s, p) => s + p.amount, 0);
  const status = paid <= 0 ? "unpaid" : paid >= price ? "paid" : "partial";

  await supabase.from("repairs").update({ payment_status: status }).eq("id", repairId);
}
```

- [ ] **Step 3: Навчити читачів розуміти `null`**

`src/components/RepairDetailView.tsx:333` — прибрати фолбек на `"unpaid"`:

```tsx
{repair.payment_status
  ? <StatusPill map={domainPaymentStatus} value={repair.payment_status} />
  : <span className="text-muted">—</span>}
```

`src/app/admin/repairs/repair-columns.tsx` — у рядках 101 і 142 так само:
якщо `r.payment_status` порожній, рендерити `<span className="text-muted">—</span>`
замість `<StatusPill …>`.

- [ ] **Step 4: Застосувати міграцію**

Через MCP `apply_migration`, name `internal_repairs_unpaid`:

```sql
-- Складський ремонт не має платника: NULL означає «не застосовується».
-- 'unpaid' на ньому створював 5 200 ₴ боргу, якого не існує.
update repairs set payment_status = null where inventory_device_id is not null;
```

**І створити той самий файл** `supabase/migrations/20260722180000_internal_repairs_unpaid.sql` —
`apply_migration` локальний файл не пише.

- [ ] **Step 5: Перевірити результат**

```sql
select count(*) filter (where payment_status is null) as internal_null,
       count(*) filter (where payment_status is not null) as still_set
from repairs where inventory_device_id is not null;
```

Expected: `internal_null` = 10, `still_set` = 0.

- [ ] **Step 6: Тести, білд, коміт**

```bash
npm test && npx tsc --noEmit && npm run build
git add src/lib/actions/repairs.ts src/components/RepairDetailView.tsx \
        src/app/admin/repairs/repair-columns.tsx \
        supabase/migrations/20260722180000_internal_repairs_unpaid.sql
git commit -m "fix(repairs): stop warehouse repairs inventing a customer debt"
```

---

## Task 4: Прибрати прапорці ремонту з проданих пристроїв

**Files:**
- Create: `supabase/migrations/20260722181000_stale_needs_repair.sql`

- [ ] **Step 1: Перевірити з відкотом**

```sql
begin;
create temp table res(step text, n int) on commit drop;
insert into res select 'sold_flagged', count(*) from devices where needs_repair and status = 'sold';
update devices set needs_repair = false where needs_repair and status = 'sold';
insert into res select 'left_flagged', count(*) from devices where needs_repair and status = 'sold';
insert into res select 'unsold_untouched', count(*) from devices where needs_repair;
select * from res;
rollback;
```

Expected: `sold_flagged` = 12, `left_flagged` = 0, `unsold_untouched` = 3.

- [ ] **Step 2: Застосувати**

MCP `apply_migration`, name `stale_needs_repair`:

```sql
-- Проданий пристрій не може потребувати ремонту: прапорець лишився від
-- старої моделі й засмічує сегмент «Потребує уваги» на Техніці.
update devices set needs_repair = false where needs_repair and status = 'sold';
```

Створити той самий файл у `supabase/migrations/20260722181000_stale_needs_repair.sql`.

- [ ] **Step 3: Перевірити й закомітити**

```sql
select count(*) from devices where needs_repair and status = 'sold';
```
Expected: 0.

```bash
git add supabase/migrations/20260722181000_stale_needs_repair.sql
git commit -m "fix(devices): clear repair flags left on sold devices"
```

---

## Task 5: `lib/attention.ts` — що потребує дії

**Files:**
- Create: `src/lib/attention.ts`
- Test: `src/lib/__tests__/attention.test.ts`

**Interfaces:**
- Consumes: нічого.
- Produces:
  - `type AttentionCode = "repair_stalled" | "repair_awaiting_parts" | "repair_unpaid" | "stock_low"`
  - `interface AttentionRepair { id: string; device_name: string; status: string; created_at: string; inventory_device_id: string | null; payment_status: string | null; last_log_at: string | null }`
  - `interface AttentionStockItem { id: string; name: string; stock: number; min_stock: number; kind: "accessory" | "part" }`
  - `interface AttentionRow { id: string; title: string; note: string; urgency: number }`
  - `interface AttentionGroup { code: AttentionCode; label: string; rows: AttentionRow[]; total: number }`
  - `function statusSince(r: AttentionRepair): string`
  - `function daysBetween(iso: string, now: Date): number`
  - `function findAttention(input: { repairs: AttentionRepair[]; stock: AttentionStockItem[] }, now: Date): AttentionGroup[]`
  - `const STALL_DAYS = 14`, `const TOP_ROWS = 3`

- [ ] **Step 1: Написати падаючий тест**

Створити `src/lib/__tests__/attention.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  statusSince,
  daysBetween,
  findAttention,
  type AttentionRepair,
  type AttentionStockItem,
} from "../attention";

const NOW = new Date("2026-07-22T12:00:00");

function repair(over: Partial<AttentionRepair> = {}): AttentionRepair {
  return {
    id: "r1",
    device_name: "Tecno 8P",
    status: "in_progress",
    created_at: "2026-06-26T10:00:00Z",
    inventory_device_id: null,
    payment_status: "unpaid",
    last_log_at: null,
    ...over,
  };
}

function stock(over: Partial<AttentionStockItem> = {}): AttentionStockItem {
  return { id: "a1", name: "Кабель", stock: 2, min_stock: 2, kind: "accessory", ...over };
}

describe("statusSince", () => {
  it("falls back to created_at when the repair never moved", () => {
    // Лог пише лише переходи, тому нерухомі ремонти в ньому відсутні —
    // а це рівно ті, що нас цікавлять.
    expect(statusSince(repair({ last_log_at: null }))).toBe("2026-06-26T10:00:00Z");
  });

  it("uses the last logged transition when there is one", () => {
    expect(statusSince(repair({ last_log_at: "2026-07-20T09:00:00Z" }))).toBe(
      "2026-07-20T09:00:00Z",
    );
  });

  it("ignores updated_at entirely", () => {
    // updated_at зіпсований груповими операціями: усі три застряглі ремонти
    // показують 3 дні при віці 23-26 днів.
    const r = repair() as AttentionRepair & { updated_at?: string };
    r.updated_at = "2026-07-19T00:00:00Z";
    expect(statusSince(r)).toBe("2026-06-26T10:00:00Z");
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-07-15T12:00:00Z", NOW)).toBe(7);
  });
  it("returns zero for the future rather than a negative", () => {
    expect(daysBetween("2026-08-01T00:00:00Z", NOW)).toBe(0);
  });
});

describe("findAttention", () => {
  it("flags a repair that has not moved in over two weeks", () => {
    const groups = findAttention({ repairs: [repair()], stock: [] }, NOW);
    const stalled = groups.find((g) => g.code === "repair_stalled")!;
    expect(stalled.total).toBe(1);
    expect(stalled.rows[0].title).toBe("Tecno 8P");
    expect(stalled.rows[0].note).toBe("26 днів без руху");
  });

  it("leaves a fresh repair alone", () => {
    const groups = findAttention(
      { repairs: [repair({ created_at: "2026-07-20T10:00:00Z" })], stock: [] },
      NOW,
    );
    expect(groups.find((g) => g.code === "repair_stalled")).toBeUndefined();
  });

  it("does not flag a closed repair as stalled", () => {
    const groups = findAttention({ repairs: [repair({ status: "completed" })], stock: [] }, NOW);
    expect(groups.find((g) => g.code === "repair_stalled")).toBeUndefined();
  });

  it("never calls a warehouse repair unpaid", () => {
    // Внутрішній ремонт не має платника; payment_status у нього NULL.
    const groups = findAttention(
      {
        repairs: [
          repair({ status: "handed_over", inventory_device_id: "d1", payment_status: null }),
        ],
        stock: [],
      },
      NOW,
    );
    expect(groups.find((g) => g.code === "repair_unpaid")).toBeUndefined();
  });

  it("flags a handed-over customer repair that was never paid", () => {
    const groups = findAttention(
      { repairs: [repair({ status: "handed_over", payment_status: "unpaid" })], stock: [] },
      NOW,
    );
    expect(groups.find((g) => g.code === "repair_unpaid")!.total).toBe(1);
  });

  it("puts a zero stock above a merely low one", () => {
    const groups = findAttention(
      {
        repairs: [],
        stock: [stock({ id: "a", name: "Кабель", stock: 2 }), stock({ id: "b", name: "МЗП", stock: 0 })],
      },
      NOW,
    );
    const low = groups.find((g) => g.code === "stock_low")!;
    expect(low.rows[0].title).toBe("МЗП");
    expect(low.total).toBe(2);
  });

  it("shows only the top three rows but counts them all", () => {
    // 32 рядки списком нечитабельні: число + топ, решта за кліком.
    const many = Array.from({ length: 32 }, (_, i) =>
      stock({ id: `a${i}`, name: `Товар ${i}`, stock: 2 }),
    );
    const low = findAttention({ repairs: [], stock: many }, NOW).find(
      (g) => g.code === "stock_low",
    )!;
    expect(low.rows).toHaveLength(3);
    expect(low.total).toBe(32);
  });

  it("ignores stock that is comfortably above its minimum", () => {
    const groups = findAttention(
      { repairs: [], stock: [stock({ stock: 5, min_stock: 2 })] },
      NOW,
    );
    expect(groups.find((g) => g.code === "stock_low")).toBeUndefined();
  });

  it("returns no empty groups at all", () => {
    // Порожній стан — відсутність блоку, а не картка «все добре».
    expect(findAttention({ repairs: [], stock: [] }, NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустити й переконатись, що падає**

Run: `npx vitest run src/lib/__tests__/attention.test.ts`
Expected: FAIL — `Failed to resolve import "../attention"`.

- [ ] **Step 3: Написати модуль**

Створити `src/lib/attention.ts`:

```ts
/**
 * Що на сторінці потребує дії. Перевірки іменовані й додаються по одній —
 * саме тому блок переживе відкриття магазину: сьогодні жива одна з чотирьох,
 * решта оживе, коли з'явиться потік.
 *
 * Чому не `updated_at`: він зіпсований груповими операціями. Усі три застряглі
 * ремонти показують `updated_at` три дні тому при віці 23-26 днів.
 * Чому не сам лог: `repair_status_log` пише лише переходи, тож ремонт, якого
 * ніхто не чіпав, у ньому відсутній — а це рівно той випадок, що цікавить.
 * Тому `coalesce(останній перехід, created_at)`.
 */

export type AttentionCode =
  | "repair_stalled"
  | "repair_awaiting_parts"
  | "repair_unpaid"
  | "stock_low";

/** Скільки днів без руху вважати застоєм. */
export const STALL_DAYS = 14;
/** Скільки рядків показувати в групі; решта — за кліком. */
export const TOP_ROWS = 3;

const OPEN_REPAIR_STATUSES = new Set([
  "received",
  "diagnostics",
  "in_progress",
  "awaiting_parts",
  "ready",
]);

const DELIVERED_STATUSES = new Set(["completed", "handed_over"]);

export interface AttentionRepair {
  id: string;
  device_name: string;
  status: string;
  created_at: string;
  inventory_device_id: string | null;
  payment_status: string | null;
  /** Дата останнього переходу з `repair_status_log`, або null. */
  last_log_at: string | null;
}

export interface AttentionStockItem {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  kind: "accessory" | "part";
}

export interface AttentionRow {
  id: string;
  title: string;
  note: string;
  /** Більше — терміновіше. Лише для сортування. */
  urgency: number;
}

export interface AttentionGroup {
  code: AttentionCode;
  label: string;
  rows: AttentionRow[];
  /** Скільки всього, а не скільки показано. */
  total: number;
}

const GROUP_LABELS: Record<AttentionCode, string> = {
  repair_stalled: `Ремонти без руху понад ${STALL_DAYS} днів`,
  repair_awaiting_parts: "Ремонти чекають деталей задовго",
  repair_unpaid: "Видані ремонти без оплати",
  stock_low: "Час замовляти",
};

/** Момент входу в поточний статус. */
export function statusSince(r: AttentionRepair): string {
  return r.last_log_at ?? r.created_at;
}

export function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  const diff = now.getTime() - then;
  if (diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

function pluralDays(n: number): string {
  const last2 = n % 100;
  const last = n % 10;
  if (last2 >= 11 && last2 <= 14) return "днів";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дні";
  return "днів";
}

function group(
  code: AttentionCode,
  rows: AttentionRow[],
): AttentionGroup | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.urgency - a.urgency);
  return {
    code,
    label: GROUP_LABELS[code],
    rows: sorted.slice(0, TOP_ROWS),
    total: sorted.length,
  };
}

export function findAttention(
  input: { repairs: AttentionRepair[]; stock: AttentionStockItem[] },
  now: Date,
): AttentionGroup[] {
  const stalled: AttentionRow[] = [];
  const awaiting: AttentionRow[] = [];
  const unpaid: AttentionRow[] = [];

  for (const r of input.repairs) {
    if (OPEN_REPAIR_STATUSES.has(r.status)) {
      const days = daysBetween(statusSince(r), now);
      if (days >= STALL_DAYS) {
        const row = {
          id: r.id,
          title: r.device_name,
          note: `${days} ${pluralDays(days)} без руху`,
          urgency: days,
        };
        if (r.status === "awaiting_parts") awaiting.push(row);
        else stalled.push(row);
      }
    }

    // NULL означає «платника немає» — складський ремонт. Не борг.
    if (
      DELIVERED_STATUSES.has(r.status) &&
      !r.inventory_device_id &&
      r.payment_status === "unpaid"
    ) {
      unpaid.push({
        id: r.id,
        title: r.device_name,
        note: "не оплачено",
        urgency: daysBetween(statusSince(r), now),
      });
    }
  }

  const low: AttentionRow[] = input.stock
    .filter((s) => s.stock <= s.min_stock)
    .map((s) => ({
      id: s.id,
      title: s.name,
      note: s.kind === "part" ? `${s.stock} шт · запчастина` : `${s.stock} шт`,
      // Нульові — вгору; далі за глибиною браку.
      urgency: s.stock === 0 ? 1000 : 100 - s.stock,
    }));

  return [
    group("repair_stalled", stalled),
    group("repair_awaiting_parts", awaiting),
    group("repair_unpaid", unpaid),
    group("stock_low", low),
  ].filter((g): g is AttentionGroup => g !== null);
}
```

- [ ] **Step 4: Запустити тести**

Run: `npx vitest run src/lib/__tests__/attention.test.ts`
Expected: PASS, 14 тестів.

- [ ] **Step 5: Коміт**

```bash
npx tsc --noEmit
git add src/lib/attention.ts src/lib/__tests__/attention.test.ts
git commit -m "feat(attention): named checks for what needs the owner today"
```

---

## Task 6: Цілі продажів у налаштуваннях

**Files:**
- Modify: `src/lib/data-settings.ts`
- Modify: `src/app/admin/settings/` (форма — знайти наявний блок налаштувань)

**Interfaces:**
- Consumes: нічого.
- Produces: `ParsedSettings.sales_targets: { daily: number | null; monthly: number | null }`.
  `null` означає «не задано» — рядок цілі не рендериться.

- [ ] **Step 1: Додати тип і парсер**

У `src/lib/data-settings.ts`:

```ts
export interface SalesTargets {
  /** Ціль по чистому прибутку за день. null = не задано. */
  daily: number | null;
  /** Ціль по чистому прибутку за місяць. null = не задано. */
  monthly: number | null;
}
```

Додати `sales_targets: SalesTargets;` до `ParsedSettings`.

Парсер поруч із `parseDistribution`:

```ts
/**
 * Ціль вимірюється прибутком, а не виторгом: виторг легко нагнати, продавши в
 * нуль. Дефолт — null, а не число: успадкована 15 000 ₴ була взята нізвідки, і
 * ціль, якої не ставили, краще не показувати взагалі.
 */
function parseSalesTargets(value: unknown): SalesTargets {
  const fallback: SalesTargets = { daily: null, monthly: null };
  if (typeof value !== "object" || value === null) return fallback;
  const obj = value as Record<string, unknown>;
  const one = (raw: unknown) =>
    typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  return { daily: one(obj.daily), monthly: one(obj.monthly) };
}
```

У `defaultSettings` додати `sales_targets: { daily: null, monthly: null }`.
У циклі по рядках додати гілку:

```ts
} else if (s.key === "sales_targets") {
  resolved.sales_targets = parseSalesTargets(s.value);
}
```

- [ ] **Step 2: Прибрати захардкоджені 15000**

`src/lib/data-dashboard.ts:314` — видалити `const salesTarget = 15000;` і
`salesProgress`. `src/app/admin/DashboardClient.tsx:129` зникне разом із гілкою
`sales` у Task 8.

- [ ] **Step 3: Додати поля у форму налаштувань**

Ланцюг збереження вже існує, нового винаходити не треба:
`src/app/admin/settings/page.tsx` → `src/components/SettingsClient.tsx` (212 р.,
`FormData` на рядку 71) → `updateSettingsAction` у `src/lib/actions/settings.ts:29`,
де `settingsSchema` (zod) розбирає плоскі поля FormData.

1. У `settingsSchema` додати два необов'язкові поля: `target_daily`,
   `target_monthly`. Порожній рядок має ставати `null`, не `0` — нуль означав би
   «ціль нуль», а не «не задано»:

```ts
const optionalMoney = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  });
```

2. В `updateSettingsAction` додати їх до `rawData` і зберегти одним рядком
   `settings` під ключем `sales_targets` зі значенням
   `{ daily: parsed.target_daily, monthly: parsed.target_monthly }` — тим самим
   `upsert`, що й решта ключів.
3. У `SettingsClient.tsx` додати два числові поля в наявному стилі: «Ціль
   прибутку за день, ₴» і «Ціль прибутку за місяць, ₴», обидва необов'язкові,
   з підказкою «Порожнє — ціль не показується».

Валідацію «сума 100%», як у розподілі по сейфах, сюди **не** переносити: цілі
між собою не пов'язані.

- [ ] **Step 4: Перевірити наскрізно**

Задати денну ціль 2000, місячну 40000. Перечитати:

```sql
select value from settings where key = 'sales_targets';
```
Expected: `{"daily": 2000, "monthly": 40000}`.

Очистити обидва поля, перезберегти, переконатись, що стало `null`.

- [ ] **Step 5: Коміт**

```bash
npm test && npx tsc --noEmit
git add src/lib/data-settings.ts src/app/admin/settings src/lib/data-dashboard.ts
git commit -m "feat(settings): owner-set profit targets, daily and monthly"
```

---

## Task 7: Переїзд восьми віджетів на `/admin/analytics`

Без редизайну. Компоненти й запити переносяться як є.

**Files:**
- Create: `src/app/admin/analytics/page.tsx`
- Create: `src/app/admin/analytics/AnalyticsClient.tsx`
- Modify: `src/lib/data-dashboard.ts` (винести аналітичну частину)
- Modify: навігація (знайти: `grep -rn "admin/finance" src/components/ | grep -i nav`)

**Interfaces:**
- Consumes: наявні віджети з `@/components/dashboard/Widgets`.
- Produces: `getAnalyticsData(): Promise<AnalyticsData>` у новому
  `src/lib/data-analytics.ts`.

Переїжджають вісім: `RevenueHeatmapWidget`, `PhoneModelDemandWidget`,
`StockoutIntelligenceWidget` (усі з `IntelligenceWidgets.tsx`),
`SalesVelocityMatrix`, `CrossSellWidget` (з `SalesWidgets.tsx`),
`B2BPartnerShareWidget`, `RefurbishmentWidget` (з `FinanceWidgets.tsx`), і
картка «Утримання клієнтів» (`StatCard` із `DashboardClient.tsx:141-146`).

- [ ] **Step 1: Винести читання даних**

Створити `src/lib/data-analytics.ts`. Перенести з `data-dashboard.ts` рівно ті
запити, що годують вісім віджетів: три RPC (`get_model_demand_analytics`,
`get_inventory_stockout_forecast`, `get_revenue_heatmap`), `saleItems30DaysRes`,
`sales90DaysRes`, `repairs90DaysRes`, `salesTimestampsRes`,
`repairsTimestampsRes`, `partnerSalesRes`, `partnerRepairsRes`,
`activeRefurbRes`, `completedRefurbRes`, `newCustomersRes` — разом із
розрахунками `crossSell*`, `salesVelocity`, `peakHours`, `customerReturnRate`,
`partnerVolumeShare`, `partnerRevenueTotal`, `refurbishmentCapital`,
`refurbishmentMargin`.

Тип `AnalyticsData` — ті самі поля, що зараз у `DashboardData["ownerStats"]`.

- [ ] **Step 2: Створити сторінку**

`src/app/admin/analytics/page.tsx`:

```tsx
import { getAnalyticsData } from "@/lib/data-analytics";
import { AnalyticsClient } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();
  return <AnalyticsClient data={data} />;
}
```

`AnalyticsClient.tsx` — `PageHeader` («Аналітика», підзаголовок «Дані
накопичуються з 24 липня 2026 — до того в базі лише продажі з рук») і вісім
віджетів у сітці. Розкладку взяти з наявних секцій `DashboardClient` (рядки
170-191), нічого не переробляючи.

- [ ] **Step 3: Додати пункт меню**

Додати «Аналітика» → `/admin/analytics` у навігацію, **після** Фінансів, не на
видному місці: до неї немає чого показувати щонайменше місяць.

- [ ] **Step 4: Перевірити**

```bash
npm run build
```
Expected: збірка проходить, `/admin/analytics` у списку маршрутів.

Відкрити сторінку — вісім віджетів рендеряться з тими самими числами, що були
на дашборді.

- [ ] **Step 5: Коміт**

```bash
git add src/app/admin/analytics src/lib/data-analytics.ts src/lib/data-dashboard.ts
git commit -m "refactor(analytics): move the eight premature widgets off the dashboard"
```

---

## Task 8: Дашборд

**Files:**
- Create: `src/lib/data-attention.ts`
- Create: `src/app/admin/AttentionSection.tsx`
- Create: `src/app/admin/MoneySection.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/DashboardClient.tsx` (337 → ~120 р.)
- Modify: `src/lib/data-dashboard.ts`

**Interfaces:**
- Consumes: `findAttention`, `AttentionGroup` (Task 5); `computeProfit`,
  `resolveRange`, `RANGE_LABELS`, `RANGE_PRESETS`, `isRangePreset`,
  `CATEGORY_LABELS`, `ProfitResult` (Task 1); `ParsedSettings.sales_targets`
  (Task 6).
- Produces: нічого для наступних задач.

- [ ] **Step 1: Читання для блоку уваги**

Створити `src/lib/data-attention.ts` з `getAttentionData(): Promise<{ repairs:
AttentionRepair[]; stock: AttentionStockItem[] }>`.

Ремонти — з приєднаним останнім переходом:

```ts
const { data: repairs } = await supabase
  .from("repairs")
  .select("id, device_name, status, created_at, inventory_device_id, payment_status, repair_status_log(created_at)");
```

Далі в JS звести `repair_status_log` до `last_log_at` = максимум `created_at`
або `null`. Склад — `accessories` (`status='active'`) і `parts`, обидва з
`stock`, `min_stock`, зведені в `AttentionStockItem[]` із відповідним `kind`.

- [ ] **Step 2: Прибрати ролі й зайві лукапи зі сторінки**

Переписати `src/app/admin/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data-settings";
import { getAttentionData } from "@/lib/data-attention";
import { getDashboardMoney } from "@/lib/data-dashboard";
import { isRangePreset, type RangePreset } from "@/lib/profit";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { range } = await searchParams;
  const preset: RangePreset = isRangePreset(range) ? range : "today";

  const [settings, attention, money] = await Promise.all([
    getSettings(),
    getAttentionData(),
    getDashboardMoney(preset),
  ]);

  return (
    <DashboardClient
      preset={preset}
      attention={attention}
      money={money}
      targets={settings.sales_targets}
    />
  );
}
```

**Роль більше не читається взагалі.** Фолбек `"sales"` (старий рядок 25) зникає
разом із гілками: сторінка одна, і збій читання профілю більше не може
підмінити її порожньою.

`searchParams` у Next 16 — проміс, звідси `await`.

- [ ] **Step 3: Грошові дані**

У `src/lib/data-dashboard.ts` лишити один експорт `getDashboardMoney(preset:
RangePreset)`. Він:
1. `resolveRange(preset, new Date())`
2. тягне `sale_items` із `sales` за період (фільтр по `sales.created_at`),
   собівартості пристроїв, і зовнішні завершені ремонти — **фільтр по
   `repairs.completed_at`**, той самий, що в Task 2. Різні колонки дат у двох
   місцях дали б розбіжність у звірці, а звірка — головна перевірка §8.
3. `computeProfit(...)`
4. окремо — витрати за період, баланси кас, OPEX за 30 днів для runway
5. повертає `{ profit: ProfitResult; expenses: number; cashTotal: number;
   runwayDays: number; dailyOpex: number; monthProfit: number; todayProfit: number }`

`monthProfit` і `todayProfit` рахуються завжди, незалежно від обраного
діапазону — вони годують рядки цілей.

Усе інше з `getRealtimeDashboardData` (26 запитів) видалити: аналітика вже в
`data-analytics.ts` (Task 7), гілки ролей не потрібні.

**Три місця зламаються від цього видалення — полагодити в цій же задачі,
інакше `npm run build` впаде:**

| Файл | Що робить | Дія |
|---|---|---|
| `src/lib/data.ts:7` | `export { getRealtimeDashboardData } from "./data-dashboard"` | замінити на `getDashboardMoney` |
| `src/components/dashboard/widget-types.ts:1,16` | `import type { DashboardData }`, поле `stats: DashboardData` | перевести на `AnalyticsData` з Task 7 |
| `src/app/admin/DashboardClient.tsx:19,71` | те саме | зникає при переписуванні |

Перевірити повноту: `grep -rn "getRealtimeDashboardData\|DashboardData" src/`
має не давати нічого поза `data-analytics.ts`.

- [ ] **Step 4: Блок уваги**

`src/app/admin/AttentionSection.tsx` — клієнтський компонент. Рендерить
`AttentionGroup[]`: заголовок групи, лічильник (`total`), до трьох рядків.
Рядок ремонту клікабельний і відкриває дравер із `RepairDetailView` /
`EditRepairForm` — перенести з `DashboardClient:332-334` як є.

**Дію статусу одним кліком не додавати.** Закриття ремонту тягне гроші,
Telegram-сповіщення й синхрон статусу пристрою; кнопка без перегляду картки —
рівно той механізм, що у слайсі 1 повертав продані апарати в обіг.

Якщо `groups.length === 0` — компонент повертає `null`. Порожній стан — це
відсутність блоку, а не картка «все добре».

Рядок складу веде на `/admin/accessories` (або `/admin/parts` за `kind`).

- [ ] **Step 5: Блок грошей**

`src/app/admin/MoneySection.tsx`. Пресети — `RANGE_PRESETS` із `RANGE_LABELS`,
активний підсвічений, перемикання через `router.replace` із `?range=`
(серверний режим за §4.7 хендофу — дані читає сервер).

Далі три числа (виторг / прибуток / маржа), таблиця `byCategory` з
`CATEGORY_LABELS`, два рядки цілей — **кожен рендериться лише якщо відповідна
ціль не `null`** — і підвал: витрати за місяць, чистий, каси, runway, посилання
на Фінанси.

Категорію з нульовим виторгом показувати з «—» замість маржі, але рядок не
ховати: таблиця має тримати форму між діапазонами.

- [ ] **Step 6: Зібрати клієнт**

`DashboardClient.tsx` — шапка (`PageHeader`, дата, `AddSaleButton`,
`AddRepairButton`), `<AttentionSection />`, `<MoneySection />`, дравери.
Цільовий розмір — близько 120 рядків.

Лукапи для `AddSaleButton` (`customers`, `devices`, `accessories`, `services`)
більше не вантажаться на сервері сторінки: завантажувати їх у самій кнопці при
відкритті дравера.

- [ ] **Step 7: Перевірити**

```bash
npm test && npx tsc --noEmit && npm run build
```
Expected: усе зелене.

Звірка §8 спеки: для кожного з п'яти пресетів прибуток у блоці «Гроші» має
збігатися з `getFinanceReport` за той самий період до гривні.

- [ ] **Step 8: Коміт**

```bash
git add src/app/admin src/lib/data-attention.ts src/lib/data-dashboard.ts
git commit -m "feat(dashboard): rebuild around attention and real margin"
```

---

## Task 9: AI на числах, які не брешуть

Передпольотна перевірка знайшла, що перша редакція цієї задачі була неправильна
в трьох місцях. Виправлено:

- **`ai-chat/route.ts:131` — це `timeoutMs`, не ціль.** Сигнатура —
  `fetchGemini(contents, generationConfig?, retries=3, timeoutMs=15000,
  systemInstruction?)` (`src/lib/utils/gemini.ts:92-98`). **Не чіпати.**
- **`buildInsightsPrompt` викликається лише з `/api/ai-insights/route.ts`.**
  Ендпоінт не видаляється — навпаки, оживає (рішення власника).
- **Живий копайлот фабрикованих метрик не бачить.** `ai-chat` →
  `buildFinanceCopilotSystem` бере каси, сейфи, витрати, дохід, прибуток.
  Але його `profit` рахується без собівартості взагалі — див. Step 4.

**Files:**
- Modify: `src/lib/ai-prompts/index.ts:113-141`
- Modify: `src/lib/ai-prompts/ai-prompts.test.ts:227-266`
- Modify: `src/app/api/ai-insights/route.ts`
- Modify: `src/app/api/ai-chat/route.ts:90-118`

**Interfaces:**
- Consumes: `getDashboardMoney` (Task 8), `getAttentionData` (Task 8),
  `findAttention` (Task 5), `getSettings().sales_targets` (Task 6),
  `RANGE_LABELS`, `CATEGORY_LABELS`, `isRangePreset` (Task 1).
- Produces: `POST /api/ai-insights` приймає `{ range?: RangePreset }` і повертає
  `{ insights: Array<{ type: string; title: string; description: string;
  action: string; impact: string }> }`.

- [ ] **Step 1: Оновити тест під новий вхід**

У `src/lib/ai-prompts/ai-prompts.test.ts` замінити `basePayload` і тіло
`describe("buildInsightsPrompt")` (рядки ~227-266):

```ts
const basePayload = {
  rangeLabel: "Сьогодні",
  revenue: 3800,
  profit: 1227,
  marginPercent: 32,
  byCategoryText: "Техніка 3000 ₴ / 650 ₴ / 22%; Аксесуари 700 ₴ / 477 ₴ / 68%",
  dailyTarget: 2000,
  monthlyTarget: 40000,
  monthProfit: 3975,
  monthExpenses: 5050,
  opexRunwayDays: 22,
  dailyOpexRunRate: 168,
  attentionText: "Ремонти без руху понад 14 днів: 3; Час замовляти: 32",
};

describe("buildInsightsPrompt", () => {
  it("carries the profit and margin into the prompt", () => {
    const result = buildInsightsPrompt(basePayload);
    expect(result).toContain("1227");
    expect(result).toContain("32%");
  });

  it("states the net result for the month rather than making the model derive it", () => {
    expect(buildInsightsPrompt(basePayload)).toContain("-1075");
  });

  it("says targets are unset instead of printing null", () => {
    const result = buildInsightsPrompt({
      ...basePayload,
      dailyTarget: null,
      monthlyTarget: null,
    });
    expect(result).toContain("не задані");
    expect(result).not.toContain("null");
  });

  it("warns the model off trend claims, since the shop just opened", () => {
    expect(buildInsightsPrompt(basePayload)).toContain("24.07.2026");
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `npx vitest run src/lib/ai-prompts/ai-prompts.test.ts`
Expected: FAIL — старий тип не приймає нових полів.

- [ ] **Step 3: Переписати промпт**

Замінити `buildInsightsPrompt` у `src/lib/ai-prompts/index.ts`:

```ts
export function buildInsightsPrompt(data: {
  rangeLabel: string;
  revenue: number;
  profit: number;
  marginPercent: number;
  byCategoryText: string;
  dailyTarget: number | null;
  monthlyTarget: number | null;
  monthProfit: number;
  monthExpenses: number;
  opexRunwayDays: number;
  dailyOpexRunRate: number;
  attentionText: string;
}): string {
  const targets =
    [
      data.dailyTarget ? `день ${data.dailyTarget} ₴` : null,
      data.monthlyTarget ? `місяць ${data.monthlyTarget} ₴` : null,
    ]
      .filter(Boolean)
      .join(", ") || "не задані";

  return `Бізнес-аналітик VV CRM. Дай 3-4 actionable інсайти. Тільки цифри і дії, без води.

Магазин відкрито 24.07.2026 — історії мало, не роби висновків про тренди й сезонність.

${data.rangeLabel}: виторг ${data.revenue} ₴, прибуток ${data.profit} ₴, маржа ${data.marginPercent}%.
По категоріях: ${data.byCategoryText}.
Цілі по прибутку: ${targets}.
Місяць: прибуток ${data.monthProfit} ₴, витрати ${data.monthExpenses} ₴, чистий ${data.monthProfit - data.monthExpenses} ₴.
OPEX: ${data.opexRunwayDays} днів резерву (${data.dailyOpexRunRate} ₴/день).
Потребує уваги: ${data.attentionText || "нічого"}.

Поверни ТІЛЬКИ JSON масив (без markdown):
[{"type":"opportunity|warning|achievement|info","title":"емодзі + до 6 слів","description":"1-2 речення з цифрами і конкретною дією","action":"до 4 слів","impact":"high|medium|low"}]`;
}
```

- [ ] **Step 4: Полагодити прибуток у живому копайлоті**

`src/app/api/ai-chat/route.ts`, гілка `entityType === "finance"` (рядки ~90-118).
Зараз:

```ts
profit: totalSalesRevenue + totalRepairsRevenue - totalExpenses
```

Собівартість не віднімається взагалі — копайлот вважає всі 17 350 ₴ продажів
техніки прибутком. Плюс `totalRepairsRevenue` рахує внутрішні складські ремонти
як дохід (немає фільтра `inventory_device_id`).

Замінити обидва розрахунки на `getFinanceReport(30)` із Task 2, який уже все це
робить правильно:

```ts
import { getFinanceReport } from "@/lib/data-finance";

const report = await getFinanceReport(30);

systemPrompt = buildFinanceCopilotSystem({
  totalCash: registers.reduce((s, r) => s + r.balance, 0),
  totalSafes: safes.reduce((s, r) => s + r.balance, 0),
  totalExpenses: report.totalExpenses,
  totalRevenue: report.totalSales + report.repairsRevenue,
  profit: report.profit,
  registers,
  safes,
});
```

Запити `expensesRes`, `salesRes`, `repairsRes` із `Promise.all` прибрати —
`getFinanceReport` тягне те саме. `registersRes` і `safesRes` лишити.

**`fetchGemini(..., 3, 15000, systemPrompt)` не чіпати** — це `retries` і
`timeoutMs`, а не бізнес-числа.

- [ ] **Step 5: Оживити ендпоінт інсайтів**

Переписати `src/app/api/ai-insights/route.ts`: приймає `{ range?: RangePreset }`
(дефолт `"today"`), збирає аргументи й викликає промпт:

```ts
const preset: RangePreset = isRangePreset(body.range) ? body.range : "today";
const [money, attention, settings] = await Promise.all([
  getDashboardMoney(preset),
  getAttentionData(),
  getSettings(),
]);

const groups = findAttention(attention, new Date());

const prompt = buildInsightsPrompt({
  rangeLabel: RANGE_LABELS[preset],
  revenue: money.profit.revenue,
  profit: money.profit.profit,
  marginPercent: money.profit.margin,
  byCategoryText: money.profit.byCategory
    .filter((c) => c.revenue > 0)
    .map((c) => `${CATEGORY_LABELS[c.category]} ${c.revenue} ₴ / ${c.profit} ₴ / ${c.margin}%`)
    .join("; "),
  dailyTarget: settings.sales_targets.daily,
  monthlyTarget: settings.sales_targets.monthly,
  monthProfit: money.monthProfit,
  monthExpenses: money.expenses,
  opexRunwayDays: money.runwayDays,
  dailyOpexRunRate: money.dailyOpex,
  attentionText: groups.map((g) => `${g.label}: ${g.total}`).join("; "),
});
```

Відповідь Gemini розібрати як JSON-масив. При помилці парсингу повернути
`{ insights: [] }` зі статусом 200, а не 500 — інсайти є доповненням, і збій
моделі не має валити блок грошей поруч.

- [ ] **Step 6: Тести, білд, коміт**

```bash
npm test && npx tsc --noEmit && npm run build
git add src/lib/ai-prompts src/app/api/ai-insights src/app/api/ai-chat
git commit -m "fix(ai): feed both prompts a profit that subtracts cost"
```

---

## Task 10: Блок інсайтів на дашборді

**Files:**
- Create: `src/app/admin/InsightsSection.tsx`
- Modify: `src/app/admin/DashboardClient.tsx`

**Interfaces:**
- Consumes: `POST /api/ai-insights` із Task 9, `RangePreset` із Task 1.
- Produces: нічого.

- [ ] **Step 1: Компонент**

Створити `src/app/admin/InsightsSection.tsx` — клієнтський компонент, приймає
`{ preset: RangePreset }`.

Завантаження **ліниве й на вимогу**: кнопка «Показати аналіз» під блоком
грошей, а не автозапит при відкритті сторінки. Причина — виклик Gemini коштує
секунди на кожне відкриття головної, а дашборд має відкриватись миттєво.

Стани:
- не запитано → кнопка «Показати аналіз»
- завантаження → скелетон із трьох карток
- готово → список карток
- помилка або порожній масив → «Поки нема що сказати» + кнопка «Спробувати ще»

Картка: заголовок (`title`, у ньому вже емодзі від моделі), `description`,
`action` дрібним, лівий бордер за `impact` — `high` → `border-danger`,
`medium` → `border-warning`, `low` → `border-border`. Токени брати з
дизайн-системи, кольори не хардкодити.

При зміні `preset` скидати вже завантажені інсайти в стан «не запитано»: вони
стосувались іншого періоду, і показувати їх під новими числами — брехня.

- [ ] **Step 2: Підключити**

Вставити `<InsightsSection preset={preset} />` у `DashboardClient` під
`<MoneySection />`.

- [ ] **Step 3: Перевірити**

```bash
npm test && npx tsc --noEmit && npm run build
```

Відкрити `/admin`, натиснути «Показати аналіз». Інсайти мають згадувати ту саму
маржу, що показує блок грошей поруч. Розбіжність означає, що ендпоінт і сторінка
рахують різними шляхами.

- [ ] **Step 4: Коміт**

```bash
git add src/app/admin/InsightsSection.tsx src/app/admin/DashboardClient.tsx
git commit -m "feat(dashboard): on-demand AI insights over the real numbers"
```

---

## Self-Review

**Покриття спеки:**

| Розділ спеки | Задача |
|---|---|
| §0 контекст відкриття | Global Constraints; Task 7 підзаголовок; Task 9 промпт |
| §1.1 завищений прибуток | Task 1, Task 2 |
| §2.1 формула застою | Task 5 (`statusSince`) |
| §3.1 фальшивий борг | Task 3 |
| §3.2 застарілі прапорці | Task 4 |
| §3.3 подача складу | Task 5 (`TOP_ROWS`, `urgency`) |
| §4.1 `lib/profit.ts` | Task 1 |
| §4.2 Фінанси на спільний модуль | Task 2 |
| §4.3 перевірки | Task 5 |
| §4.4 з 26 запитів до 6 | Task 7, Task 8 Step 3 |
| §4.5 цілі в `settings` | Task 6 |
| §5 сторінка | Task 8 |
| §5.1 дія через дравер | Task 8 Step 4 |
| §5.3 переїзд восьми | Task 7 |
| §6 `force-dynamic`, ліниві лукапи, роль | Task 8 Step 2, Step 6 |
| §6.1 AI | Task 9, Task 10 |

**Відхилення від спеки, свідомі:**

1. **`lib/discrepancies.ts` → `lib/attention.ts`.** `device-stage.ts` уже
   експортує тип `Discrepancy` з іншою формою (`code`/`label`/`short`/`detail`,
   на рівні пристрою). Другий модуль із тим самим словом і несумісною формою
   плутав би при читанні. Домен той самий, назва інша.
2. **`device_stuck_in_service` прибрано з типу.** `devices.status='service'`
   зараз нуль; член союзу, який ніде не створюється, — мертвий код. Додати
   перевірку, коли з'явиться перший приклад і стане видно осмислений поріг.
3. **Дата завершення ремонту — `completed_at`, а не `updated_at`.** Перша
   редакція плану пропонувала `updated_at`, тобто рівно ту колонку, яку §2.1
   спеки визнала непридатною. Колонка `completed_at` існує й заповнена на всіх
   10 завершених ремонтах — спека про неї не знала.

**Пастка для виконавця:** Task 2 і Task 8 Step 3 рахують одне й те саме число
двома окремими запитами. Вони мають фільтрувати за однаковими колонками
(`sales.created_at` і `repairs.completed_at`) і викликати той самий
`computeProfit`. Розбіжність тут не впаде на тестах — вона вилізе у звірці §8,
і виглядатиме як помилка модуля, хоча буде помилкою запиту.

4. **Task 9 переписаний після передпольотної перевірки.** Перша редакція
   веліла прибрати «захардкоджену ціль 15000» з `ai-chat/route.ts:131` — там
   `timeoutMs` виклику Gemini, і виконавець зламав би таймаут. Вона ж
   переписувала `buildInsightsPrompt`, а наступним кроком видаляла його єдиного
   споживача. Спека §6.1 при цьому перебільшила: живий копайлот фабрикованих
   метрик не бачить. Справжній баг знайдено поруч — `ai-chat` рахує прибуток без
   собівартості взагалі.
5. **Task 10 доданий** — рішення власника оживити інсайти на дашборді.

**Порядок:** 1 → 2 обов'язково послідовно. Задачі 3, 4, 5, 6 незалежні й від
них, і одна від одної. Task 7 перед Task 8 (Task 8 видаляє те, що Task 7
переносить). Task 9 після 8 (споживає `getDashboardMoney`). Task 10 останній.

**Ризик, який тримати в голові весь час:** гілка `master`, деплой одразу в прод
(рішення власника), магазин відкривається 24.07. Міграції Task 3 і 4 йдуть у
живу базу і відкату через git не мають — тільки через зворотний SQL.
