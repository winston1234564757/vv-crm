# Статистика по днях — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дві сторінки — список днів із цифрами і повний зріз одного дня, — щоб власник міг відкрити конкретний день і побачити кожну операцію, витрату й рух грошей.

**Architecture:** Дані беруться наявним рушієм `lib/profit.ts`, тож денна цифра фізично не може розійтися з дашбордом. `loadDataset` виїжджає з `data-dashboard.ts` у спільний модуль; чиста логіка дня живе в `lib/day-report.ts` і тестується без бази.

**Tech Stack:** Next.js 16 (App Router, серверні компоненти), TypeScript, Supabase, vitest, recharts, деплой `npx vercel --prod --yes`.

## Global Constraints

- Слайс 2 із трьох. Спека: `docs/superpowers/specs/2026-07-30-daily-stats-design.md`. Порядок слайсів — у `docs/superpowers/specs/2026-07-30-money-consistency-design.md`.
- Виторг рахує **лише** `lib/profit.ts`. Жодних `reduce` по `total_amount`/`total_price` — це ловить `src/lib/__tests__/no-raw-revenue-sum.test.ts`.
- Фінансова епоха — `settings.finance_epoch` через `getSettings()`. У проді `2026-07-21T10:04:41Z`. **Ніколи не хардкодити дату.**
- Ремонт заробляється на видачі: `repairSettledAt`, статус `handed_over`/`completed` + `completed_at`. Внутрішні ремонти (`inventory_device_id is not null`) — собівартість, не виторг.
- День = доба за Києвом (`dayRange` з `profit.ts`, локальна північ; рантайм примусово в Europe/Kyiv).
- `DESIGN.md`: рівно одна інверсна плита на екран (§2.1); бенто-комірка САМА є карткою, картка в картці заборонена (§4.1); спани — статичні класи, ряди складаються по 12; сяйво лінії дозволене лише на інверсній плиті.
- Мова коментарів у коді — українська.
- Тестуються лише чисті модулі. `data-*` і компоненти юніт-тестами не покриваються.
- **Ніколи `git add -A` / `git add .`** — у корені лежить сторонній `gemini-code-1785245388482.json`.
- Збірка: `npx next build --webpack`. Якщо падає з «previous build that didn't exit cleanly» — `rm -rf .next` і повторити.
- Кожна задача завершується зеленими `npx tsc --noEmit` і `npx vitest run`.
- Візуальну перевірку робить власник; Chrome-розширення в цьому середовищі не працює.

## Успадковано зі слайса 1

Фінальне рев'ю слайса 1 залишило два пункти, що прямо стосуються цієї роботи:

1. `data-day.ts` треба додати в `GUARDED` у `no-raw-revenue-sum.test.ts` — це Task 8.
2. Чек без позицій дає нуль у `computeProfit`, але свою суму в `sales.total_amount`. Сьогодні таких рядків **немає** (перевірено SQL), але `process_quick_sale` для категорії `service` їх не створює. Сторінка дня успадковує цю різницю: рядок операції показує `total_amount`, а KPI над ним — розподілений виторг. Це задокументовано в Task 4 і **не** виправляється тут — рішення про такі чеки належить слайсу 3.

## Структура файлів

| файл | відповідальність |
|------|------------------|
| `src/lib/profit-dataset.ts` | новий: `loadDataset` + її тип, винесені з `data-dashboard.ts` |
| `src/lib/day-report.ts` | новий, чистий: `hourlyBuckets`, `dayNeighbours`, `previousWorkingDay`, `countOperations` |
| `src/lib/__tests__/day-report.test.ts` | новий: тести чистих функцій |
| `src/lib/data-day.ts` | новий: `getDayList`, `getDayReport` |
| `src/app/admin/days/page.tsx` | новий: список днів |
| `src/app/admin/days/DaysTable.tsx` | новий: клієнтська таблиця днів |
| `src/app/admin/days/[day]/page.tsx` | новий: сторінка дня |
| `src/app/admin/days/[day]/DayClient.tsx` | новий: бенто дня + драєри |
| `src/lib/data-dashboard.ts` | `loadDataset` виїжджає; `day` і розбивка виносяться |
| `src/app/admin/page.tsx`, `DashboardClient.tsx`, `ProfitChart.tsx` | `?day=` зникає, клік веде на `/admin/days/<day>` |
| `src/lib/nav-config.ts` | пункт «Дні» в групі `finance` |

---

### Task 1: Винести `loadDataset` у спільний модуль

**Files:**
- Create: `src/lib/profit-dataset.ts`
- Modify: `src/lib/data-dashboard.ts`

**Interfaces:**
- Produces: `loadDataset(supabase, start, end): Promise<LoadedDataset>` і `interface LoadedDataset { dataset: ProfitDataset; cashRegisters: {id,name,balance,type}[]; paymentSplitsBySale: Map<string, {amount,method}[]> }` — обидва експортовані з `src/lib/profit-dataset.ts`.
- Consumes: нічого.

Чистий перенос без зміни поведінки. `data-dashboard.ts` уже 723 рядки і робить забагато; `data-day.ts` потребує тієї самої вибірки.

- [ ] **Step 1: Зафіксувати еталон перед переносом**

```bash
npx vitest run --silent 2>&1 | tail -4
```

Expected: `Tests 353 passed (353)`. Запиши число — після переносу воно має не змінитись.

- [ ] **Step 2: Створити модуль**

Створи `src/lib/profit-dataset.ts`. Перенеси в нього **дослівно** з `src/lib/data-dashboard.ts`: функцію `loadDataset` (рядок ~192 до кінця її тіла) разом із її докблоком, і всі імпорти, які вона використовує (`createClient`, `supabaseCast`, `toDatedRepairs`, `REPAIR_PNL_COLUMNS`, типи `ProfitDataset`, `DatedSale`, `DatedRepair`, `DatedExpense`, `ProfitSaleItem`, `RepairPnlRow`). Тип повернення оголоси окремим експортованим інтерфейсом:

```ts
export interface LoadedDataset {
  dataset: ProfitDataset;
  cashRegisters: { id: string; name: string; balance: number; type: string }[];
  /**
   * Спліт-оплати продажів, ключ — `sales.id`. Живе окремо від `DatedSale`
   * (тип спільний з `lib/profit`, який про оплати нічого не знає) — потрібні
   * лише для розбивки готівка/картка.
   */
  paymentSplitsBySale: Map<string, { amount: number; method: string }[]>;
}
```

і зроби `loadDataset` експортованою з поверненням `Promise<LoadedDataset>`.

На початок файлу постав докблок:

```ts
/**
 * Одна вибірка даних для рушія прибутку: продажі з позиціями, закриті ремонти,
 * витрати, собівартості проданих пристроїв, каси й спліт-оплати.
 *
 * Живе окремо від `data-dashboard.ts`, бо ту саму вибірку тепер потребує і
 * сторінка Днів, а тримати її приватною в модулі дашборду означало б або
 * дублювати запити, або експортувати внутрішню деталь модуля, який і без того
 * робить забагато.
 */
```

- [ ] **Step 3: Прибрати оригінал і підключити імпорт**

У `src/lib/data-dashboard.ts` видали тіло `loadDataset` цілком і додай до імпортів:

```ts
import { loadDataset } from "./profit-dataset";
```

Прибери імпорти, які стали невживаними в `data-dashboard.ts` (`tsc` і `eslint` покажуть, які саме). Виклик `loadDataset(supabase, window.start, window.end)` лишається без змін.

- [ ] **Step 4: Перевірити, що нічого не зрушило**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -4
```

Expected: `tsc` без виводу, `Tests 353 passed (353)` — те саме число, що в кроці 1.

- [ ] **Step 5: Коміт**

```bash
git add src/lib/profit-dataset.ts src/lib/data-dashboard.ts
git commit -m "$(cat <<'EOF'
refactor(profit): винести loadDataset у власний модуль

Ту саму вибірку тепер потребує сторінка Днів. Тримати її приватною в
data-dashboard.ts (723 рядки) означало б або дублювати запити, або
експортувати внутрішню деталь модуля, який і без того робить забагато.

Перенос дослівний, поведінка не змінюється: 353 тести до і після.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 2: Винести розбивку готівка/картка/борг у функцію з вікном

**Files:**
- Modify: `src/lib/data-dashboard.ts`

**Interfaces:**
- Produces: експортована з `src/lib/data-dashboard.ts`

```ts
export interface RevenueSplit {
  cashRevenue: number;
  cardRevenue: number;
  debt: number;
}

export async function revenueSplit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loaded: LoadedDataset,
  saleRows: DatedSale[],
  repairRows: DatedRepair[],
  totalRevenue: number,
  repairRevenue: number,
): Promise<RevenueSplit>
```

- Consumes: `LoadedDataset` із Task 1.

Зараз розрахунок зашитий усередині `getDashboardMoney` і прив'язаний до `todayRange`. Сторінці дня потрібен той самий для довільної доби. Без винесення правило «борг не є готівкою» існуватиме у двох копіях і розійдеться — рівно та помилка, від якої лікували `sales_analytics` і `profit.ts`.

- [ ] **Step 1: Створити функцію**

У `src/lib/data-dashboard.ts` перед `getDashboardMoney` додай:

```ts
export interface RevenueSplit {
  cashRevenue: number;
  cardRevenue: number;
  /**
   * Виторг, за який гроші ще не прийшли: ремонт видали в борг. Нуль у
   * звичайний день. Не можна складати в готівку — каси за ним порожні.
   */
  debt: number;
}

/**
 * Розбивка виторгу вікна: готівка, безготівка, борг.
 *
 * Джерел два, бо їх у базі два: у продажів це `payment_splits` чека, у
 * ремонтів — каса, в яку лягла оплата (`transactions.reference_type =
 * 'repair_payment'`), бо методу платежу в ремонті немає взагалі. Без другого
 * джерела ремонт, оплачений карткою, тихо їхав би в готівку.
 *
 * Платежі ремонтів НЕ фільтруються по вікну навмисно. Ремонт визнається
 * виторгом на видачі, а передоплата могла зайти раніше — розбивка відповідає
 * на «чим за це заплатили», а не «скільки фізично впало в касу того дня». На
 * друге питання відповідає «Гроші в наявності», і воно рахується з кас.
 *
 * Готівка продажів — залишком, щоб поглинути розподілену знижку, якої в
 * спліт-оплатах немає. Готівка ремонтів — прямою сумою платежів.
 */
export async function revenueSplit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loaded: LoadedDataset,
  saleRows: DatedSale[],
  repairRows: DatedRepair[],
  totalRevenue: number,
  repairRevenue: number,
): Promise<RevenueSplit> {
  const salesCardRevenue = saleRows.reduce(
    (s, r) =>
      s +
      (loaded.paymentSplitsBySale.get(r.id) ?? [])
        .filter((p) => p.method !== "cash")
        .reduce((a, p) => a + p.amount, 0),
    0,
  );

  const cashlessRegisterIds = new Set(
    loaded.cashRegisters.filter((c) => isCashless(c.type)).map((c) => c.id),
  );
  let repairCardRevenue = 0;
  let repairCashRevenue = 0;
  if (repairRows.length > 0) {
    const { data: repairPayments } = await supabase
      .from("transactions")
      .select("amount, to_id")
      .eq("reference_type", "repair_payment")
      .in(
        "reference_id",
        repairRows.map((r) => r.id),
      );
    for (const p of repairPayments ?? []) {
      if (p.to_id && cashlessRegisterIds.has(p.to_id)) repairCardRevenue += p.amount;
      else repairCashRevenue += p.amount;
    }
  }

  const salesCashRevenue = Math.max(0, totalRevenue - repairRevenue - salesCardRevenue);
  const cardRevenue = salesCardRevenue + repairCardRevenue;
  const cashRevenue = salesCashRevenue + repairCashRevenue;

  return {
    cardRevenue,
    cashRevenue,
    debt: Math.max(0, totalRevenue - cardRevenue - cashRevenue),
  };
}
```

- [ ] **Step 2: Замінити вбудований розрахунок викликом**

У `getDashboardMoney` видали блок від коментаря `// Безготівка продажів — зі спліт-оплат чека.` до рядка з `const todayDebt = ...` включно, і постав замість нього:

```ts
  const todayRevenue = today.profit.revenue;
  const repairRevenue =
    today.profit.byCategory.find((c) => c.category === "repair")?.revenue ?? 0;
  const split = await revenueSplit(
    supabase,
    loaded,
    todaySaleRows,
    todayRepairRows,
    todayRevenue,
    repairRevenue,
  );
```

У поверненні `todaySales` заміни три поля на:

```ts
      cardRevenue: split.cardRevenue,
      cashRevenue: split.cashRevenue,
      debt: split.debt,
```

- [ ] **Step 3: Перевірити, що числа дня не зрушили**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -4
```

Expected: `tsc` чисто, 353 тести.

Це рефактор без зміни поведінки: та сама арифметика над тими самими рядками.

- [ ] **Step 4: Коміт**

```bash
git add src/lib/data-dashboard.ts
git commit -m "$(cat <<'EOF'
refactor(dashboard): розбивка готівка/картка/борг приймає вікно

Розрахунок був зашитий у getDashboardMoney і прив'язаний до сьогодні.
Сторінці дня потрібен той самий для довільної доби, а друга копія правила
«борг не є готівкою» неминуче розійшлася б із першою.

Арифметика не змінена, тести ті самі.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 3: Чисті функції дня + тести

**Files:**
- Create: `src/lib/day-report.ts`
- Test: `src/lib/__tests__/day-report.test.ts`

**Interfaces:**
- Produces:
```ts
export interface DayOperation { at: string; amount: number; kind: "sale" | "repair" }
export function hourlyBuckets(ops: DayOperation[]): { hour: number; revenue: number; count: number }[]
export function dayNeighbours(day: string, epochDay: string | null, todayDay: string): { prev: string | null; next: string | null }
export function previousWorkingDay(day: string, series: { day: string; revenue: number }[]): string | null
export function countOperations(sales: { id: string }[], repairs: { price: number }[]): number
```
- Consumes: `addDays` з `src/lib/utils/day.ts`.

Логіка виноситься з `data-day.ts` сюди, бо `data-*` тягнуть серверний Supabase і юніт-тестами не покриваються — це правило репозиторію.

- [ ] **Step 1: Написати падаючі тести**

Створи `src/lib/__tests__/day-report.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  hourlyBuckets,
  dayNeighbours,
  previousWorkingDay,
  countOperations,
  type DayOperation,
} from "../day-report";

function op(at: string, amount = 100, kind: "sale" | "repair" = "sale"): DayOperation {
  return { at, amount, kind };
}

describe("hourlyBuckets", () => {
  it("віддає всі 24 години, порожні — нулями", () => {
    const out = hourlyBuckets([op("2026-07-25T14:30:00")]);
    expect(out).toHaveLength(24);
    expect(out[0]).toEqual({ hour: 0, revenue: 0, count: 0 });
    expect(out[14]).toEqual({ hour: 14, revenue: 100, count: 1 });
  });

  it("не з'їдає межі доби", () => {
    const out = hourlyBuckets([op("2026-07-25T00:00:00", 50), op("2026-07-25T23:59:59", 70)]);
    expect(out[0].revenue).toBe(50);
    expect(out[23].revenue).toBe(70);
  });

  it("складає кілька операцій в одну годину", () => {
    const out = hourlyBuckets([op("2026-07-25T12:05:00", 300), op("2026-07-25T12:55:00", 200)]);
    expect(out[12]).toEqual({ hour: 12, revenue: 500, count: 2 });
  });

  it("порожній день — 24 нулі, а не порожній масив", () => {
    const out = hourlyBuckets([]);
    expect(out).toHaveLength(24);
    expect(out.every((b) => b.revenue === 0 && b.count === 0)).toBe(true);
  });
});

describe("dayNeighbours", () => {
  it("віддає сусідні календарні дні", () => {
    expect(dayNeighbours("2026-07-25", "2026-07-21", "2026-07-30")).toEqual({
      prev: "2026-07-24",
      next: "2026-07-26",
    });
  });

  it("упирається в епоху зліва", () => {
    expect(dayNeighbours("2026-07-21", "2026-07-21", "2026-07-30").prev).toBeNull();
  });

  it("упирається в сьогодні справа", () => {
    expect(dayNeighbours("2026-07-30", "2026-07-21", "2026-07-30").next).toBeNull();
  });

  // Порожній день пропускати не можна: це приховало б, що магазин був зачинений.
  it("не перестрибує порожні дні", () => {
    expect(dayNeighbours("2026-07-27", "2026-07-21", "2026-07-30").prev).toBe("2026-07-26");
  });

  it("без епохи ліва межа не ставиться", () => {
    expect(dayNeighbours("2026-07-21", null, "2026-07-30").prev).toBe("2026-07-20");
  });
});

describe("previousWorkingDay", () => {
  const series = [
    { day: "2026-07-24", revenue: 500 },
    { day: "2026-07-25", revenue: 0 },
    { day: "2026-07-26", revenue: 0 },
    { day: "2026-07-27", revenue: 900 },
  ];

  it("пропускає дні без виторгу", () => {
    expect(previousWorkingDay("2026-07-27", series)).toBe("2026-07-24");
  });

  it("повертає null, коли попереднього робочого дня немає", () => {
    expect(previousWorkingDay("2026-07-24", series)).toBeNull();
  });

  it("не бере сам день за базу", () => {
    expect(previousWorkingDay("2026-07-25", series)).toBe("2026-07-24");
  });
});

describe("countOperations", () => {
  // Гарантійна переробка не чек: у виторг додає нуль, а лічильник роздуває.
  it("не рахує ремонт із ціною 0", () => {
    expect(countOperations([{ id: "s1" }], [{ price: 0 }, { price: 1200 }])).toBe(2);
  });

  it("порожній день дає нуль", () => {
    expect(countOperations([], [])).toBe(0);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

```bash
npx vitest run src/lib/__tests__/day-report.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../day-report'`.

- [ ] **Step 3: Написати модуль**

Створи `src/lib/day-report.ts`:

```ts
import { addDays } from "./utils/day";

/**
 * Чиста логіка сторінки дня: без Supabase і без React, тому тестується
 * без бази. `data-day.ts` тримає лише запити й склейку.
 */

export interface DayOperation {
  /** ISO-мітка часу операції: чек — `created_at`, ремонт — дата видачі. */
  at: string;
  amount: number;
  kind: "sale" | "repair";
}

export interface HourBucket {
  hour: number;
  revenue: number;
  count: number;
}

/**
 * Виторг по годинах доби. Усі 24 години присутні, порожні — нулями: провал о
 * 15:00 має читатись як провал, а не як розрив у даних.
 *
 * Година береться локальна (`getHours`) — рантайм примусово в Europe/Kyiv,
 * тією самою міркою живуть `dayRange` і денна навігація.
 */
export function hourlyBuckets(ops: DayOperation[]): HourBucket[] {
  const out: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    revenue: 0,
    count: 0,
  }));
  for (const o of ops) {
    const h = new Date(o.at).getHours();
    if (h < 0 || h > 23 || Number.isNaN(h)) continue;
    out[h].revenue += o.amount;
    out[h].count += 1;
  }
  return out;
}

/**
 * Сусідні КАЛЕНДАРНІ дні для стрілок ‹ ›. Порожні дні не пропускаються
 * навмисно: перестрибнути день означало б приховати, що магазин був зачинений.
 *
 * Ліва межа — епоха, права — сьогодні: далі даних немає за визначенням.
 */
export function dayNeighbours(
  day: string,
  epochDay: string | null,
  todayDay: string,
): { prev: string | null; next: string | null } {
  const prevKey = addDays(day, -1);
  const nextKey = addDays(day, 1);
  return {
    prev: epochDay && prevKey < epochDay ? null : prevKey,
    next: nextKey > todayDay ? null : nextKey,
  };
}

/**
 * Останній день ДО заданого, у якому був виторг — база для дельти в hero.
 *
 * Це навмисно не `dayNeighbours`: порівняння понеділка з порожньою неділею
 * дало б «+∞» і не означало б нічого. `null` — коли попереднього робочого дня
 * немає (перший день роботи); тоді дельта не малюється взагалі, так само як
 * `comparisonFor` віддає `null` на дашборді.
 */
export function previousWorkingDay(
  day: string,
  series: { day: string; revenue: number }[],
): string | null {
  let best: string | null = null;
  for (const p of series) {
    if (p.day >= day || p.revenue <= 0) continue;
    if (!best || p.day > best) best = p.day;
  }
  return best;
}

/**
 * Скільки операцій було в дні. Ремонт із ціною 0 (гарантійна переробка,
 * безкоштовна діагностика) не чек: у виторг він додає нуль, а лічильник
 * роздував би. У P&L він лишається — там від нього є собівартість.
 */
export function countOperations(
  sales: { id: string }[],
  repairs: { price: number }[],
): number {
  return sales.length + repairs.filter((r) => r.price > 0).length;
}
```

- [ ] **Step 4: Запустити — має пройти**

```bash
npx vitest run src/lib/__tests__/day-report.test.ts 2>&1 | tail -6
```

Expected: усі 13 тестів зелені.

- [ ] **Step 5: Повний прогін і коміт**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -4
```

Expected: 367 тестів (353 + 14).

```bash
git add src/lib/day-report.ts src/lib/__tests__/day-report.test.ts
git commit -m "$(cat <<'EOF'
feat(days): чиста логіка сторінки дня

hourlyBuckets, dayNeighbours, previousWorkingDay, countOperations — без
Supabase і React, тож тестуються без бази, як вимагає правило репозиторію.

Стрілки між днями ходять календарем, а дельта в hero порівнює з попереднім
робочим днем — дві різні функції навмисно: пропустити порожній день у
навігації означало б приховати, що магазин був зачинений, а порівнювати
понеділок із порожньою неділею не означає нічого.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 4: `data-day.ts` — список днів і зріз дня

**Files:**
- Create: `src/lib/data-day.ts`

**Interfaces:**
- Consumes: `loadDataset`, `LoadedDataset` (Task 1); `revenueSplit`, `RevenueSplit` (Task 2); `hourlyBuckets`, `dayNeighbours`, `previousWorkingDay`, `countOperations`, `DayOperation` (Task 3).
- Produces:

```ts
export interface DayRow extends DayPoint { operations: number }
export interface DayOperationRow {
  id: string; at: string; amount: number; kind: "sale" | "repair";
  title: string; customer: string; payment: string;
}
export interface DayExpenseRow { id: string; at: string; amount: number; title: string; category: string; safe: string }
export interface DayMoveRow {
  id: string; at: string; amount: number; from: string; to: string;
  kind: string; description: string;
}
export interface DayReport {
  day: string;
  profit: ProfitResult;
  split: RevenueSplit;
  operations: DayOperationRow[];
  expenses: DayExpenseRow[];
  moves: DayMoveRow[];
  distributions: { count: number; total: number };
  hourly: { hour: number; revenue: number; count: number }[];
  neighbours: { prev: string | null; next: string | null };
  previousDay: { day: string; profit: number } | null;
}
export async function getDayList(): Promise<DayRow[]>
export async function getDayReport(day: string): Promise<DayReport | null>
```

- [ ] **Step 1: Написати модуль**

Створи `src/lib/data-day.ts`. Повний код:

```ts
import { createClient } from "./supabase/server";
import { supabaseCast } from "./utils/supabase";
import { getSettings } from "./data-settings";
import { loadDataset } from "./profit-dataset";
import { revenueSplit, type RevenueSplit } from "./data-dashboard";
import { dayKey } from "./utils/day";
import {
  computeProfit,
  dailySeries,
  dayRange,
  floorAtEpoch,
  resolveRange,
  LEDGER_MAX_DAYS,
  type DayPoint,
  type ProfitResult,
} from "./profit";
import {
  countOperations,
  dayNeighbours,
  hourlyBuckets,
  previousWorkingDay,
  type DayOperation,
} from "./day-report";

/**
 * Дані сторінок «Дні».
 *
 * Прибуток рахує рушій `lib/profit.ts` — той самий виклик, що годує дашборд і
 * Фінанси. Тому денна цифра тут не може розійтися з ними за побудовою, а не за
 * домовленістю. Жодних власних підсумків виторгу в цьому файлі бути не
 * повинно — це стереже `__tests__/no-raw-revenue-sum.test.ts`.
 */

export interface DayRow extends DayPoint {
  /** Чеки плюс видані платні ремонти. Ремонт із ціною 0 не рахується. */
  operations: number;
}

export interface DayOperationRow {
  id: string;
  at: string;
  /**
   * Сума операції так, як вона збережена: підсумок чека або ціна ремонту.
   * Може не скластися у виторг угорі на розмір знижки — рядок відповідає на
   * «що пробили», а верхня цифра на «скільки заробили».
   */
  amount: number;
  kind: "sale" | "repair";
  title: string;
  customer: string;
  payment: string;
}

export interface DayExpenseRow {
  id: string;
  at: string;
  amount: number;
  title: string;
  category: string;
  safe: string;
}

export interface DayMoveRow {
  id: string;
  at: string;
  amount: number;
  from: string;
  to: string;
  kind: string;
  description: string;
}

export interface DayReport {
  day: string;
  profit: ProfitResult;
  split: RevenueSplit;
  operations: DayOperationRow[];
  expenses: DayExpenseRow[];
  /** Реальні рухи; автоматичні розподіли по сейфах лежать окремо. */
  moves: DayMoveRow[];
  distributions: { count: number; total: number };
  hourly: { hour: number; revenue: number; count: number }[];
  neighbours: { prev: string | null; next: string | null };
  previousDay: { day: string; profit: number } | null;
}

/** Скільки днів назад тягнемо датасет заради дельти в hero. */
const DELTA_LOOKBACK_DAYS = 30;

/**
 * Id сейфа чистого прибутку. Потрібен `dailySeries`, щоб не порахувати
 * вилучення частки власником як операційну витрату: воно вже є частиною
 * розподіленого прибутку, і другий раз у P&L — подвійний рахунок.
 *
 * Дашборд передає його в ту саму функцію. Передати сюди `null` означало б, що
 * «чистими» за день на цій сторінці і на дашборді рахуються по-різному — рівно
 * та розбіжність, від якої лікували решту системи.
 */
async function netProfitSafe(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.from("safes").select("id, type");
  return (data ?? []).find((s) => s.type === "net_profit")?.id ?? null;
}

const MOVE_LABELS: Record<string, string> = {
  sale: "Продаж",
  repair_payment: "Оплата ремонту",
  expense: "Витрата",
  inventory: "Закупівля",
  top_up: "Поповнення",
  client_order: "Замовлення",
  accessory: "Аксесуар",
  distribution: "Розподіл",
};

/**
 * Список днів від епохи, найновіші зверху.
 *
 * Це та сама пачка запитів, яку дашборд і так робить при кожному відкритті —
 * нової вартості не з'являється. Стеля `LEDGER_MAX_DAYS` спрацює раніше, ніж
 * таблиця стане завеликою.
 */
export async function getDayList(): Promise<DayRow[]> {
  const supabase = await createClient();
  const settings = await getSettings();
  const now = new Date();

  const todayRange = resolveRange("today", now);
  const start = new Date(todayRange.start);
  start.setDate(start.getDate() - LEDGER_MAX_DAYS);
  const window = floorAtEpoch(start, todayRange.end, settings.finance_epoch);
  if (window.empty) return [];

  const [loaded, netProfitSafeId] = await Promise.all([
    loadDataset(supabase, window.start, window.end),
    netProfitSafe(supabase),
  ]);
  const series = dailySeries(loaded.dataset, window.start, window.end, {
    capitalCategoryId: settings.capital_category_id,
    netProfitSafeId,
  });

  const salesByDay = new Map<string, { id: string }[]>();
  for (const s of loaded.dataset.sales) {
    const k = dayKey(new Date(s.created_at));
    const arr = salesByDay.get(k);
    if (arr) arr.push({ id: s.id });
    else salesByDay.set(k, [{ id: s.id }]);
  }
  const repairsByDay = new Map<string, { price: number }[]>();
  for (const r of loaded.dataset.repairs) {
    const k = dayKey(new Date(r.settled_at));
    const arr = repairsByDay.get(k);
    if (arr) arr.push({ price: r.price });
    else repairsByDay.set(k, [{ price: r.price }]);
  }

  return series
    .map((p) => ({
      ...p,
      operations: countOperations(salesByDay.get(p.day) ?? [], repairsByDay.get(p.day) ?? []),
    }))
    .reverse();
}

/**
 * Повний зріз одного дня.
 *
 * Вікно — `[день − 30, кінець дня)`. Відступ назад потрібен лише для дельти в
 * hero: порахувати прибуток попереднього робочого дня з одноденного вікна
 * неможливо. Тридцять днів — та сама вага, яку дашборд носить у пресеті
 * «30 днів». Від епохи не вантажимо навмисно: сторінка одного дня не має
 * тягнути весь датасет магазину заради одного числа.
 *
 * `null` — день до епохи або в майбутньому. День у межах, але порожній,
 * повертає звіт із нулями: «нуль» і «немає такого дня» — різні відповіді.
 */
export async function getDayReport(day: string): Promise<DayReport | null> {
  const supabase = await createClient();
  const settings = await getSettings();
  const now = new Date();
  const todayKey = dayKey(now);

  if (day > todayKey) return null;

  const epochDay = settings.finance_epoch ? dayKey(new Date(settings.finance_epoch)) : null;
  if (epochDay && day < epochDay) return null;

  const target = dayRange(day);
  const lookbackStart = new Date(target.start);
  lookbackStart.setDate(lookbackStart.getDate() - DELTA_LOOKBACK_DAYS);
  const window = floorAtEpoch(lookbackStart, target.end, settings.finance_epoch);
  if (window.empty) return null;

  const loaded = await loadDataset(supabase, window.start, window.end);

  const inDay = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= target.start.getTime() && t < target.end.getTime();
  };

  const daySales = loaded.dataset.sales.filter((s) => inDay(s.created_at));
  const dayRepairs = loaded.dataset.repairs.filter((r) => inDay(r.settled_at));

  const profit = computeProfit(daySales, loaded.dataset.devices, dayRepairs);
  const repairRevenue = profit.byCategory.find((c) => c.category === "repair")?.revenue ?? 0;
  const split = await revenueSplit(
    supabase,
    loaded,
    daySales,
    dayRepairs,
    profit.revenue,
    repairRevenue,
  );

  const series = dailySeries(loaded.dataset, window.start, window.end, {
    capitalCategoryId: settings.capital_category_id,
    netProfitSafeId: await netProfitSafe(supabase),
  });
  const prevKey = previousWorkingDay(day, series);
  const prevPoint = prevKey ? series.find((p) => p.day === prevKey) : undefined;

  const ops: DayOperation[] = [
    ...daySales.map((s) => ({ at: s.created_at, amount: s.total_amount, kind: "sale" as const })),
    ...dayRepairs
      .filter((r) => r.price > 0)
      .map((r) => ({ at: r.settled_at, amount: r.price, kind: "repair" as const })),
  ];

  const startStr = target.start.toISOString();
  const endStr = target.end.toISOString();

  const [saleDetailRes, repairDetailRes, expensesRes, catRes, txRes, safesRes] = await Promise.all([
    daySales.length > 0
      ? supabase
          .from("sales")
          .select("id, notes, customers(name), payment_splits(method)")
          .in("id", daySales.map((s) => s.id))
      : Promise.resolve({ data: [] }),
    dayRepairs.length > 0
      ? supabase
          .from("repairs")
          .select("id, device_name, issue, payment_status, customers(name)")
          .in("id", dayRepairs.map((r) => r.id))
      : Promise.resolve({ data: [] }),
    supabase
      .from("expenses")
      .select("id, amount, description, category_id, paid_from_safe_id, created_at")
      .gte("created_at", startStr)
      .lt("created_at", endStr),
    supabase.from("expense_categories").select("id, name"),
    supabase
      .from("transactions")
      .select("id, amount, from_type, from_id, to_type, to_id, reference_type, description, created_at")
      .gte("created_at", startStr)
      .lt("created_at", endStr)
      .order("created_at", { ascending: false }),
    supabase.from("safes").select("id, name"),
  ]);

  const saleMeta = new Map(
    supabaseCast<
      { id: string; notes: string | null; customers: { name: string } | null; payment_splits: { method: string }[] | null }[]
    >(saleDetailRes.data ?? []).map((s) => [s.id, s]),
  );
  const repairMeta = new Map(
    supabaseCast<
      { id: string; device_name: string; issue: string | null; payment_status: string | null; customers: { name: string } | null }[]
    >(repairDetailRes.data ?? []).map((r) => [r.id, r]),
  );

  const operations: DayOperationRow[] = [
    ...daySales.map((s) => {
      const m = saleMeta.get(s.id);
      const methods = [...new Set((m?.payment_splits ?? []).map((p) => p.method))];
      return {
        id: s.id,
        at: s.created_at,
        amount: s.total_amount,
        kind: "sale" as const,
        title: m?.notes?.split("\n")[0] || "Продаж",
        customer: m?.customers?.name ?? "Роздрібний клієнт",
        payment: methods.length > 0 ? methods.join(" + ") : "—",
      };
    }),
    ...dayRepairs
      .filter((r) => r.price > 0)
      .map((r) => {
        const m = repairMeta.get(r.id);
        return {
          id: r.id,
          at: r.settled_at,
          amount: r.price,
          kind: "repair" as const,
          title: m?.device_name ?? "Ремонт",
          customer: m?.customers?.name ?? "Роздрібний клієнт",
          payment: m?.payment_status === "paid" ? "оплачено" : "борг",
        };
      }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const catNames = new Map((catRes.data ?? []).map((c) => [c.id, c.name]));
  const safeNames = new Map((safesRes.data ?? []).map((s) => [s.id, s.name]));
  const registerNames = new Map(loaded.cashRegisters.map((c) => [c.id, c.name]));

  const expenses: DayExpenseRow[] = (expensesRes.data ?? []).map((e) => ({
    id: e.id,
    at: e.created_at,
    amount: e.amount,
    title: e.description || "Витрата",
    category: (e.category_id && catNames.get(e.category_id)) || "Без категорії",
    safe: (e.paid_from_safe_id && safeNames.get(e.paid_from_safe_id)) || "—",
  }));

  const sideName = (type: string, id: string | null) => {
    if (type === "cash_register") return (id && registerNames.get(id)) || "Каса";
    if (type === "safe") return (id && safeNames.get(id)) || "Сейф";
    if (type === "customer") return "Клієнт";
    if (type === "supplier") return "Постачальник";
    return "Зовні";
  };

  const allMoves = txRes.data ?? [];
  const distributionRows = allMoves.filter((t) => t.reference_type === "distribution");
  const moves: DayMoveRow[] = allMoves
    .filter((t) => t.reference_type !== "distribution")
    .map((t) => ({
      id: t.id,
      at: t.created_at,
      amount: t.amount,
      from: sideName(t.from_type, t.from_id),
      to: sideName(t.to_type, t.to_id),
      kind: MOVE_LABELS[t.reference_type ?? ""] ?? t.reference_type ?? "Рух",
      description: t.description ?? "",
    }));

  return {
    day,
    profit,
    split,
    operations,
    expenses,
    moves,
    distributions: {
      count: distributionRows.length,
      total: distributionRows.reduce((s, t) => s + t.amount, 0),
    },
    hourly: hourlyBuckets(ops),
    neighbours: dayNeighbours(day, epochDay, todayKey),
    previousDay: prevPoint ? { day: prevPoint.day, profit: prevPoint.profit } : null,
  };
}
```

- [ ] **Step 2: Перевірити типи**

```bash
npx tsc --noEmit
```

Expected: без виводу. Якщо Supabase-типи скаржаться на вкладені `customers(name)` — обгорни результат у `supabaseCast<...>`, як це вже зроблено для `saleMeta`/`repairMeta`, а не додавай `any`.

- [ ] **Step 3: Прогін тестів**

```bash
npx vitest run --silent 2>&1 | tail -4
```

Expected: 367 тестів зелені. Guard-тест виторгу поки не охоплює `data-day.ts` — це Task 8.

- [ ] **Step 4: Коміт**

```bash
git add src/lib/data-day.ts
git commit -m "$(cat <<'EOF'
feat(days): дані для списку днів і зрізу дня

Прибуток рахує наявний computeProfit — той самий виклик, що годує дашборд і
Фінанси, тож денна цифра не може розійтися з ними за побудовою.

getDayReport бере вікно [день − 30]: дельту в hero не було б із чого рахувати
з одноденного. Від епохи не вантажимо — сторінка одного дня не має тягнути
весь датасет заради одного числа.

Автоматичні розподіли по сейфах відокремлені від реальних рухів: вони
становлять більшість транзакцій і є наслідком продажів, які й так у списку
операцій вище.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 5: Сторінка списку днів

**Files:**
- Create: `src/app/admin/days/page.tsx`
- Create: `src/app/admin/days/DaysTable.tsx`
- Modify: `src/lib/nav-config.ts`

**Interfaces:**
- Consumes: `getDayList(): Promise<DayRow[]>` (Task 4).
- Produces: маршрут `/admin/days`; пункт «Дні» в групі `finance`.

- [ ] **Step 1: Додати пункт навігації**

У `src/lib/nav-config.ts` у групі `finance` заміни масив `items` на:

```ts
    items: [
      { href: "/admin/finance", label: "Фінанси", icon: IconFinance },
      { href: "/admin/days", label: "Дні", icon: IconReport },
    ],
```

`isItemActive` використовує `startsWith(href + "/")`, тож `/admin/days/2026-07-25` тримає вкладку активною без додаткових правок.

- [ ] **Step 2: Серверна сторінка**

Створи `src/app/admin/days/page.tsx`:

```tsx
import { requirePageRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { getDayList } from "@/lib/data-day";
import { PageHeader } from "@/components/layout/PageHeader";
import StandardCard from "@/components/ui/StandardCard";
import { DaysTable } from "./DaysTable";

export const dynamic = "force-dynamic";

export default async function DaysPage() {
  await requirePageRole(MONEY_ROLES);
  const rows = await getDayList();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Дні"
        subtitle="Кожен день від відкриття магазину. Клік по рядку відкриє його цілком."
      />
      <StandardCard>
        <DaysTable rows={rows} />
      </StandardCard>
    </div>
  );
}
```

- [ ] **Step 3: Клієнтська таблиця**

Створи `src/app/admin/days/DaysTable.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { dayLabel } from "@/lib/utils/day";
import { pluralUk } from "@/lib/utils/plural";
import type { DayRow } from "@/lib/data-day";

/**
 * Список днів. Порожні дні не ховаються: день без продажів справді дав нуль, а
 * дірка в списку читалась би як втрата даних. Але нульовий рядок блідий, щоб
 * око чіплялось за робочі дні.
 *
 * Рядок — `<button>`, а не `<div>` з `onClick`: інакше сторінка мертва з
 * клавіатури.
 */
export function DaysTable({ rows }: { rows: DayRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Ще жодного дня від відкриття магазину.
      </p>
    );
  }

  return (
    <div className={cn("-mx-1 overflow-x-auto transition-opacity", isPending && "opacity-60")}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted">
            <th className="py-2 font-medium">День</th>
            <th className="py-2 text-right font-medium">Виторг</th>
            <th className="py-2 text-right font-medium">Прибуток</th>
            <th className="py-2 text-right font-medium">Маржа</th>
            <th className="py-2 text-right font-medium">Витрати</th>
            <th className="py-2 text-right font-medium">Чистими</th>
            <th className="py-2 text-right font-medium">Операцій</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const quiet = r.operations === 0;
            return (
              <tr
                key={r.day}
                className="cursor-pointer transition-colors hover:bg-hover"
                onClick={() => startTransition(() => router.push(`/admin/days/${r.day}`))}
              >
                <td className="py-2.5">
                  <button
                    type="button"
                    className="text-left capitalize outline-none focus-visible:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTransition(() => router.push(`/admin/days/${r.day}`));
                    }}
                  >
                    <span className={quiet ? "text-muted" : "text-ink"}>{dayLabel(r.day)}</span>
                  </button>
                </td>
                <td className={cn("py-2.5 text-right tabular", quiet ? "text-faint" : "text-ink")}>
                  {uah(r.revenue)}
                </td>
                <td
                  className={cn(
                    "py-2.5 text-right font-medium tabular",
                    quiet ? "text-faint" : r.profit >= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {uah(r.profit)}
                </td>
                <td className="py-2.5 text-right tabular text-muted">
                  {r.revenue === 0 ? "—" : `${r.margin}%`}
                </td>
                <td className="py-2.5 text-right tabular text-muted">{uah(r.expenses)}</td>
                <td
                  className={cn(
                    "py-2.5 text-right tabular",
                    quiet ? "text-faint" : r.net >= 0 ? "text-ink" : "text-danger",
                  )}
                >
                  {uah(r.net)}
                </td>
                <td className={cn("py-2.5 text-right tabular", quiet ? "text-faint" : "text-muted")}>
                  {r.operations} {pluralUk(r.operations, "операція", "операції", "операцій")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Перевірити**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -4 && npx next build --webpack 2>&1 | grep -E "admin/days|Compiled|error" | head -5
```

Expected: `tsc` чисто, 367 тестів, у маршрутах з'явився `/admin/days`.

- [ ] **Step 5: Коміт**

```bash
git add src/app/admin/days/page.tsx src/app/admin/days/DaysTable.tsx src/lib/nav-config.ts
git commit -m "$(cat <<'EOF'
feat(days): сторінка списку днів

Вкладка «Дні» в групі Фінанси. Рядок = день: виторг, прибуток, маржа, витрати,
чистими, кількість операцій. Клік відкриває день цілком.

Порожні дні не ховаються — день без продажів справді дав нуль, а дірка в
списку читалась би як втрата даних; натомість такий рядок блідий.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 6: Сторінка дня

**Files:**
- Create: `src/app/admin/days/[day]/page.tsx`
- Create: `src/app/admin/days/[day]/DayClient.tsx`

**Interfaces:**
- Consumes: `getDayReport(day): Promise<DayReport | null>` (Task 4); `isDayKey`, `dayLabel` з `utils/day`; `BentoCell`, `CardStat`, `BentoLink` з `components/ui/BentoCell`; `Drawer` з `components/ui/Drawer`.
- Produces: маршрут `/admin/days/[day]`.

Ряди бенто складаються по 12 і сітка сама дірку не закриє: hero **8** + гроші **4** · категорії **8** + погодинно **4** · операції **12** · витрати **6** + рухи **6**.

- [ ] **Step 1: Серверна сторінка**

Створи `src/app/admin/days/[day]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { getDayReport } from "@/lib/data-day";
import { isDayKey } from "@/lib/utils/day";
import { DayClient } from "./DayClient";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ day: string }> }) {
  await requirePageRole(MONEY_ROLES);
  const { day } = await params;

  // Невалідний ключ, день до епохи або в майбутньому — 404. День у межах, але
  // порожній, сюди не потрапляє: він повертає звіт із нулями, бо «нуль» і
  // «немає такого дня» — різні відповіді.
  if (!isDayKey(day)) notFound();
  const report = await getDayReport(day);
  if (!report) notFound();

  return <DayClient report={report} />;
}
```

- [ ] **Step 2: Клієнтський бенто**

Створи `src/app/admin/days/[day]/DayClient.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { BentoCell, CardStat } from "@/components/ui/BentoCell";
import Drawer from "@/components/ui/Drawer";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { dayLabel, timeHM } from "@/lib/utils/day";
import { pluralUk } from "@/lib/utils/plural";
import { CATEGORY_LABELS, PROFIT_CATEGORIES } from "@/lib/profit";
import type { DayReport, DayOperationRow, DayExpenseRow, DayMoveRow } from "@/lib/data-day";

type Selected =
  | { kind: "operation"; row: DayOperationRow }
  | { kind: "expense"; row: DayExpenseRow }
  | { kind: "move"; row: DayMoveRow }
  | null;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-ink">{value}</p>
    </div>
  );
}

/**
 * Повний зріз одного дня.
 *
 * Ряди бенто складаються по 12 і сітка сама дірку не закриє (DESIGN.md §4.1):
 * hero 8 + гроші 4 · категорії 8 + погодинно 4 · операції 12 · витрати 6 +
 * рухи 6. Будь-яка зміна набору вимагає перерахувати ряд руками.
 *
 * Інверсна плита рівно одна — hero (§2.1).
 *
 * Кожен рядок клікабельний і відкриває драєр із повними полями. Рядки —
 * `<button>`, а не `<div>` з `onClick`: інакше сторінка мертва з клавіатури.
 */
export function DayClient({ report }: { report: DayReport }) {
  const [selected, setSelected] = useState<Selected>(null);
  const { profit, split, neighbours, previousDay } = report;

  const delta = previousDay ? profit.profit - previousDay.profit : null;
  const maxHour = Math.max(...report.hourly.map((h) => h.revenue), 1);
  const expensesTotal = report.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold capitalize tracking-tight text-ink">
            {dayLabel(report.day)}
          </h1>
          <Link
            href="/admin/days"
            className="mt-0.5 inline-block text-xs font-medium text-accent-ink transition-colors hover:text-accent"
          >
            ← усі дні
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {neighbours.prev ? (
            <Link
              href={`/admin/days/${neighbours.prev}`}
              className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-hover"
            >
              ‹ попередній
            </Link>
          ) : (
            <span className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-faint">
              ‹ попередній
            </span>
          )}
          {neighbours.next ? (
            <Link
              href={`/admin/days/${neighbours.next}`}
              className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-hover"
            >
              наступний ›
            </Link>
          ) : (
            <span className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-faint">
              наступний ›
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        <BentoCell span={8} tone="inverse" title="Прибуток дня">
          <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="font-display text-[2.75rem] font-semibold leading-none tabular tracking-tight text-inverse-ink">
              {uah(profit.profit)}
            </span>
            <span className="text-sm text-inverse-muted">
              виторг <span className="tabular text-inverse-ink">{uah(profit.revenue)}</span>
            </span>
            <span className="text-sm text-inverse-muted">
              маржа <span className="tabular text-inverse-ink">{profit.revenue === 0 ? "—" : `${profit.margin}%`}</span>
            </span>
          </p>
          {delta !== null && previousDay && (
            <p className="mt-3 text-xs text-inverse-muted">
              {delta >= 0 ? "+" : "−"}
              <span className="tabular text-accent-on-inverse">{uah(Math.abs(delta))}</span> до{" "}
              <span className="capitalize">{dayLabel(previousDay.day)}</span>
            </p>
          )}
        </BentoCell>

        <BentoCell span={4} title="Гроші дня">
          <CardStat value={uah(split.cashRevenue)} unit="готівкою">
            <span className="text-xs text-muted">
              {uah(split.cardRevenue)} карткою
              {split.debt > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold tabular text-danger">{uah(split.debt)}</span> у борг
                </>
              )}
            </span>
          </CardStat>
          <div className="mt-auto space-y-1 border-t border-border pt-3 text-xs">
            <p className="flex justify-between text-muted">
              <span>Витрати</span>
              <span className="tabular text-ink">{uah(expensesTotal)}</span>
            </p>
            <p className="flex justify-between text-muted">
              <span>Чистими</span>
              <span
                className={cn(
                  "font-medium tabular",
                  profit.profit - expensesTotal >= 0 ? "text-success" : "text-danger",
                )}
              >
                {uah(profit.profit - expensesTotal)}
              </span>
            </p>
          </div>
        </BentoCell>

        <BentoCell span={8} title="Звідки прибуток">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm text-ink">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-muted">
                  <th className="py-2 font-medium">Категорія</th>
                  <th className="py-2 text-right font-medium">Виторг</th>
                  <th className="py-2 text-right font-medium">Собівартість</th>
                  <th className="py-2 text-right font-medium">Прибуток</th>
                  <th className="py-2 text-right font-medium">Маржа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PROFIT_CATEGORIES.map((cat) => {
                  const row = profit.byCategory.find((c) => c.category === cat);
                  const revenue = row?.revenue ?? 0;
                  return (
                    <tr key={cat}>
                      <td className="py-2.5">{CATEGORY_LABELS[cat]}</td>
                      <td className="py-2.5 text-right tabular">{uah(revenue)}</td>
                      <td className="py-2.5 text-right tabular text-muted">{uah(row?.cost ?? 0)}</td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-medium tabular",
                          (row?.profit ?? 0) >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {uah(row?.profit ?? 0)}
                      </td>
                      <td className="py-2.5 text-right tabular text-muted">
                        {revenue === 0 ? "—" : `${row!.margin}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </BentoCell>

        <BentoCell span={4} title="Погодинно">
          {profit.revenue === 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              Того дня нічого не пробили, тож розкладати по годинах нічого.
            </p>
          ) : (
            <>
              <div className="flex h-32 items-end gap-[2px]">
                {report.hourly.map((h) => (
                  <div key={h.hour} className="group relative flex-1">
                    <div
                      className={cn(
                        "w-full rounded-t-[2px] transition-all",
                        h.revenue > 0 ? "bg-accent" : "bg-hover",
                      )}
                      style={{
                        height: `${Math.max(Math.round((h.revenue / maxHour) * 100), h.revenue > 0 ? 3 : 1)}%`,
                      }}
                    />
                    {h.revenue > 0 && (
                      <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-ink px-2 py-1 text-xs tabular text-surface group-hover:block">
                        {String(h.hour).padStart(2, "0")}:00 — {uah(h.revenue)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[9px] tabular text-faint">
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
                <span>23</span>
              </div>
            </>
          )}
        </BentoCell>

        <BentoCell span={12} title={`Операції дня · ${report.operations.length}`}>
          {report.operations.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              Того дня не пробили жодного чека і не видали жодного ремонту.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {report.operations.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "operation", row: r })}
                    className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{r.title}</span>
                      <span className="block truncate text-[11px] text-muted">
                        <span className="tabular">{timeHM(r.at)}</span>
                        <span className="mx-1.5 text-faint">·</span>
                        {r.customer}
                        {r.kind === "repair" && (
                          <span className="ml-2 text-accent-ink">ремонт</span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular text-ink">
                      {uah(r.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </BentoCell>

        <BentoCell span={6} title={`Витрати · ${uah(expensesTotal)}`}>
          {report.expenses.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted">Того дня нічого не платили.</p>
          ) : (
            <ul className="divide-y divide-border">
              {report.expenses.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "expense", row: e })}
                    className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{e.title}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {e.category}
                        <span className="mx-1.5 text-faint">·</span>
                        {e.safe}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular text-danger">
                      −{uah(e.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </BentoCell>

        <BentoCell span={6} title="Рух по касах">
          {report.moves.length === 0 && report.distributions.count === 0 ? (
            <p className="text-xs leading-relaxed text-muted">Того дня гроші не рухались.</p>
          ) : (
            <ul className="divide-y divide-border">
              {report.moves.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "move", row: m })}
                    className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{m.kind}</span>
                      <span className="block truncate text-[11px] text-muted">
                        <span className="tabular">{timeHM(m.at)}</span>
                        <span className="mx-1.5 text-faint">·</span>
                        {m.from} → {m.to}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular text-ink">
                      {uah(m.amount)}
                    </span>
                  </button>
                </li>
              ))}
              {report.distributions.count > 0 && (
                <li className="py-2.5 text-[11px] text-faint">
                  Розподілено по сейфах — <span className="tabular">{uah(report.distributions.total)}</span>,{" "}
                  {report.distributions.count}{" "}
                  {pluralUk(report.distributions.count, "переказ", "перекази", "переказів")}.
                  Це автоматика після продажів вище, не окремі події.
                </li>
              )}
            </ul>
          )}
        </BentoCell>
      </div>

      <Drawer
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected?.kind === "operation"
            ? "Операція"
            : selected?.kind === "expense"
              ? "Витрата"
              : "Рух грошей"
        }
        size="half"
      >
        {selected?.kind === "operation" && (
          <div className="space-y-4">
            <div>
              <p className="tabular text-xs text-muted">#{selected.row.id.substring(0, 8)}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{selected.row.title}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Сума" value={<span className="tabular">{uah(selected.row.amount)}</span>} />
              <Field label="Час" value={<span className="tabular">{timeHM(selected.row.at)}</span>} />
              <Field label="Клієнт" value={selected.row.customer} />
              <Field label="Оплата" value={selected.row.payment} />
            </div>
            <Link
              href={
                selected.row.kind === "sale"
                  ? `/admin/sales?q=${selected.row.id}`
                  : `/admin/repairs?q=${selected.row.id}`
              }
              className="inline-block text-sm font-medium text-accent-ink transition-colors hover:text-accent"
            >
              Відкрити повністю →
            </Link>
          </div>
        )}

        {selected?.kind === "expense" && (
          <div className="space-y-4">
            <div>
              <p className="tabular text-xs text-muted">#{selected.row.id.substring(0, 8)}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{selected.row.title}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Сума" value={<span className="tabular">{uah(selected.row.amount)}</span>} />
              <Field label="Час" value={<span className="tabular">{timeHM(selected.row.at)}</span>} />
              <Field label="Категорія" value={selected.row.category} />
              <Field label="З якого сейфа" value={selected.row.safe} />
            </div>
          </div>
        )}

        {selected?.kind === "move" && (
          <div className="space-y-4">
            <div>
              <p className="tabular text-xs text-muted">#{selected.row.id.substring(0, 8)}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{selected.row.kind}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Сума" value={<span className="tabular">{uah(selected.row.amount)}</span>} />
              <Field label="Час" value={<span className="tabular">{timeHM(selected.row.at)}</span>} />
              <Field label="Звідки" value={selected.row.from} />
              <Field label="Куди" value={selected.row.to} />
            </div>
            {selected.row.description && (
              <Field label="Опис" value={selected.row.description} />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 3: Перевірити**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -4 && npx next build --webpack 2>&1 | grep -E "admin/days|error" | head -5
```

Expected: `tsc` чисто, 367 тестів, у маршрутах `/admin/days/[day]`.

- [ ] **Step 4: Коміт**

```bash
git add src/app/admin/days/\[day\]/page.tsx src/app/admin/days/\[day\]/DayClient.tsx
git commit -m "$(cat <<'EOF'
feat(days): сторінка одного дня

Бенто на 12 колонок: hero прибутку на інверсній плиті + гроші дня · категорії
+ погодинно · операції · витрати + рух по касах. Кожен рядок клікабельний і
відкриває драєр із повними полями; рядки — button, не div з onClick.

Автоматичні розподіли по сейфах згорнуті в один підсумковий рядок: вони
наслідок продажів, які вже стоять вище, і рівноправними рядками стверджували б,
що грошей того дня рухалось удвічі більше.

День у межах, але порожній, рендериться з нулями — «нуль» і «немає такого дня»
різні відповіді.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 7: Прибрати `?day=` з дашборду

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/DashboardClient.tsx`
- Modify: `src/app/admin/ProfitChart.tsx`
- Modify: `src/lib/data-dashboard.ts`

**Interfaces:**
- Consumes: маршрут `/admin/days/[day]` (Task 6).
- Produces: `getDashboardMoney(preset, userId)` — параметр `day` зникає.

Режим був напів-зламаний: `?day=` застосовувався лише до hero й таблиці категорій, а картка «Продажі сьогодні» лишалась на сьогоднішньому вікні. Полагодити на місці не можна — половина дашборду це жива операційна картина (черга, до видачі, замовлення), для минулого дня вона не існує.

- [ ] **Step 1: Прибрати параметр із даних**

У `src/lib/data-dashboard.ts`:
- у сигнатурі `getDashboardMoney` видали третій параметр `day?: string | null`;
- заміни `const mainRange = day ? dayRange(day) : resolveRange(preset, now);` на `const mainRange = resolveRange(preset, now);`;
- заміни `comparison: day ? null : comparisonFor(ds, preset, now, epoch),` на `comparison: comparisonFor(ds, preset, now, epoch),`;
- у виклику `datasetWindowStart(preset, now, day)` прибери третій аргумент, у `chartWindow(preset, now, day)` — теж;
- прибери імпорт `dayRange`, якщо він більше не вживається.

- [ ] **Step 2: Прибрати параметр зі сторінки**

У `src/app/admin/page.tsx`: тип `searchParams` стає `Promise<{ range?: string }>`; рядки з `day`, `todayKey`, `selectedDay` видаляються; імпорт `isDayKey, dayKey` прибирається; виклик стає `getDashboardMoney(preset, user.id)`; проп `selectedDay` більше не передається.

- [ ] **Step 3: Прибрати проп із компонента**

У `src/app/admin/DashboardClient.tsx`: з `DashboardClientProps` видали `selectedDay: string | null`; з деструктуризації — теж; у `HeroToday` заміни `dayLabel={selectedDay ? dayLabel(selectedDay) : "Сьогодні"}` на `dayLabel="Сьогодні"`; прибери імпорт `dayLabel`.

- [ ] **Step 4: Перенаправити клік по графіку**

У `src/app/admin/ProfitChart.tsx` заміни функцію `openDay` і супутнє:

```tsx
  function openDay(day: string | undefined) {
    if (!day) return;
    startTransition(() => router.push(`/admin/days/${day}`));
  }
```

Змінну `todayKey` видали — вона більше не потрібна. У докблоці компонента заміни абзац про клік на:

```
 * Клік по точці відкриває сторінку того дня (`/admin/days/<день>`) — повний
 * зріз із операціями, витратами й рухом грошей. Раніше клік вмикав режим
 * `?day=` на самому дашборді, але той застосовувався лише до hero й таблиці
 * категорій, а операційні картки лишались на сьогодні.
```

- [ ] **Step 5: Перевірити, що параметра ніде не лишилось**

```bash
grep -rn "selectedDay\|?day=\|range=today&day" src/ || echo "чисто"
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -4
```

Expected: греп порожній, `tsc` чисто, 367 тестів.

- [ ] **Step 6: Коміт**

```bash
git add src/app/admin/page.tsx src/app/admin/DashboardClient.tsx src/app/admin/ProfitChart.tsx src/lib/data-dashboard.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): клік по графіку веде на сторінку дня

Режим ?day= був напів-зламаний: обраний день застосовувався до hero й таблиці
категорій, а картка «Продажі сьогодні» лишалась на сьогоднішньому вікні, і
заголовок таблиці теж казав «сьогодні».

Полагодити на місці не можна — половина дашборду це жива операційна картина
(черга ремонтів, до видачі, замовлення), і для минулого дня вона не існує.
День отримав власну сторінку, а дашборд лишається про сьогодні.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 8: Поставити `data-day.ts` під охорону

**Files:**
- Modify: `src/lib/__tests__/no-raw-revenue-sum.test.ts`

**Interfaces:**
- Consumes: `src/lib/data-day.ts` (Task 4).

Слайс 1 залишив цей пункт наперед: файл тоді ще не існував, а `try/catch` на неіснуючий файл був би тестом, який нічого не стверджує.

- [ ] **Step 1: Додати файл у список**

У `src/lib/__tests__/no-raw-revenue-sum.test.ts` заміни:

```ts
const GUARDED = ["src/lib/data-dashboard.ts", "src/lib/data-sales.ts", "src/lib/data-finance.ts"];
```

на:

```ts
const GUARDED = [
  "src/lib/data-dashboard.ts",
  "src/lib/data-sales.ts",
  "src/lib/data-finance.ts",
  "src/lib/data-day.ts",
];
```

І прибери з докблоку абзац, який пояснює, чому `data-day.ts` у списку немає — файл тепер існує і під охороною.

- [ ] **Step 2: Запустити**

```bash
npx vitest run src/lib/__tests__/no-raw-revenue-sum.test.ts 2>&1 | tail -8
```

Expected: 4 тести зелені.

Якщо `data-day.ts` падає — це справжня знахідка: десь у ньому виторг рахується сирою сумою. Не підганяй регекс і не виключай файл; знайди рядок і заміни підрахунок на `computeProfit`.

- [ ] **Step 3: Повний прогін і коміт**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -4
```

Expected: 368 тестів.

```bash
git add src/lib/__tests__/no-raw-revenue-sum.test.ts
git commit -m "$(cat <<'EOF'
test(days): поставити data-day.ts під охорону guard-тесту

Слайс 1 залишив цей пункт наперед: файл тоді не існував, а try/catch на
неіснуючий файл був би тестом, який нічого не стверджує. Тепер файл є.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 9: Деплой і передача на візуальну перевірку

**Files:** немає змін.

- [ ] **Step 1: Фінальна перевірка**

```bash
rm -rf .next && npx next build --webpack 2>&1 | tail -4
npx vitest run --silent 2>&1 | tail -4
```

Expected: збірка проходить, 368 тестів.

- [ ] **Step 2: Пуш і деплой**

```bash
git push origin master
npx vercel --prod --yes 2>&1 | grep -E '"(readyState|target|url)"' | head -3
```

Expected: `"readyState": "READY"`, `"target": "production"`.

- [ ] **Step 3: Перевірити аліас**

```bash
npx vercel inspect <url з попереднього кроку> 2>&1 | grep -A4 -i alias
```

Expected: серед аліасів `nextjs-boilerplate-two-orpin-hk16khlxnc.vercel.app`.

- [ ] **Step 4: Перелічити власнику, чого не бачив на екрані**

Обов'язково назвати:

- список днів `/admin/days` — ширину колонок і те, як читаються бліді порожні дні;
- сторінку дня — усі чотири ряди бенто, і чи не завузька комірка «Погодинно» на 4 колонки з 24 стовпчиками;
- драєри операції, витрати й руху грошей;
- стрілки ‹ › на першому дні від епохи (ліва має бути неактивна) і на сьогодні (права неактивна);
- дашборд після зникнення `?day=` — клік по графіку тепер веде на іншу сторінку;
- вкладку «Дні» поруч із «Фінанси».

---

## Самоперевірка плану

**Покриття спеки.** Модулі `profit-dataset` / `day-report` / `data-day` — Tasks 1, 3, 4. Винесення розбивки готівка/картка/борг, яке спека вимагала окремо, — Task 2. Список днів із графіком — Task 5. Сторінка дня з чотирма рядами бенто, погодинним блоком і драєрами — Task 6. Прибирання `?day=` і перенаправлення кліку — Task 7. Пункт навігації — Task 5 Step 1. Guard — Task 8.

**Розбіжність зі спекою, свідома.** Спека описувала над таблицею днів графік `ProfitChart`. У плані його немає: `ProfitChart` малює на інверсній плиті (сяйво, `--color-accent-on-inverse`, `--color-inverse-*`), а сторінка списку — світла, і за `DESIGN.md` §4.1 сяйво там заборонене. Ставити його означало б або порушити правило, або писати другий варіант компонента. Список днів і так дає ті самі числа рядками. Якщо графік потрібен — це окрема задача з власним світлим компонентом.

**Плейсхолдери.** Немає: кожен крок містить або точну команду з очікуваним виводом, або повний код.

**Узгодженість типів.** `LoadedDataset` визначено в Task 1, спожито в Tasks 2 і 4. `RevenueSplit` і `revenueSplit(...)` визначено в Task 2, спожито в Task 4 із тими самими шістьма аргументами. `DayOperation`, `hourlyBuckets`, `dayNeighbours`, `previousWorkingDay`, `countOperations` визначено в Task 3, спожито в Task 4. `DayRow` спожито в Task 5, `DayReport`/`DayOperationRow`/`DayExpenseRow`/`DayMoveRow` — у Task 6; усі чотири оголошені в Task 4.

**Дефект, знайдений самоперевіркою і виправлений у плані.** У першій редакції `dailySeries` викликалась із `netProfitSafeId: null`, тоді як дашборд передає справжній id. Вилучення частки власником рахувалось би операційною витратою лише на сторінці Днів, і «чистими» за день розійшлося б із дашбордом — рівно та розбіжність, від якої лікували решту системи. Додано `netProfitSafe()`, обидва виклики беруть справжній id.

**Ризик, який план не знімає.** Чек без позицій (`process_quick_sale` для категорії `service`) дає нуль у `computeProfit`, але свою суму в рядку операції, бо рядок показує `total_amount`. Сьогодні таких рядків немає; рішення належить слайсу 3.
