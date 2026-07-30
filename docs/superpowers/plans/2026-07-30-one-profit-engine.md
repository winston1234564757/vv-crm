# Один рушій прибутку — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Прибрати грошові підрахунки, зроблені повз `lib/profit.ts`, щоб жоден екран не показував виторг, який суперечить іншому екрану.

**Architecture:** Видаляється сторінка «Звіти» з власним конвеєром. `data-analytics.ts` переводиться на фінансову епоху і на розподілену знижку. RPC `get_revenue_heatmap` отримує епоху і ремонти. Guard-тест ловить повернення проблеми.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (міграції через Supabase MCP `apply_migration`), vitest, деплой `npx vercel --prod --yes`.

## Global Constraints

- Слайс 1 із трьох. Спека: `docs/superpowers/specs/2026-07-30-money-consistency-design.md`.
- Фінансова епоха читається з `settings.finance_epoch` через `getSettings()`. Значення в проді: `2026-07-21T10:04:41Z`. Ніколи не хардкодити.
- Тестуються лише чисті модулі. `data-*` не покриваються юніт-тестами — вони тягнуть серверний Supabase-клієнт.
- Мова коментарів у коді — українська, як у решті репозиторію.
- Міграції застосовуються через Supabase MCP, не через CLI (CLI у цьому середовищі падає).
- Кожна задача завершується зеленими `npx tsc --noEmit` і `npx vitest run`.
- Візуальну перевірку робить власник. Chrome-розширення в цьому середовищі не під'єднується — наприкінці прямо перелічити, чого не бачив на екрані.

## Перевірено, роботи не потребує

`src/lib/data-operations.ts` рахує **борг** за ремонти (`debt`, `outstanding`),
а не виторг, і робить це через спільні `isUnpaid`/`outstanding` з
`repair-flow.ts`. Епоха тут доречно відсутня: ремонт, прийнятий до відкриття і
досі не оплачений, — це досі неотримані гроші. Змін не потрібно.

## Структура файлів

| файл | що з ним |
|------|----------|
| `src/app/admin/reports/page.tsx` | видалити |
| `src/app/admin/reports/loading.tsx` | видалити |
| `src/lib/data-reports.ts` | видалити |
| `src/lib/data.ts` | прибрати ре-експорт `getReportsData` |
| `src/lib/nav-config.ts` | прибрати пункт «Звіти» з групи `finance` |
| `src/lib/profit.ts` | експортувати `allocateSaleRevenue` |
| `src/lib/data-analytics.ts` | епоха + розподілена знижка |
| `src/lib/__tests__/no-raw-revenue-sum.test.ts` | створити |
| `supabase/migrations/20260730200000_revenue_heatmap_epoch_and_repairs.sql` | створити |

---

### Task 1: Видалити «Звіти»

**Files:**
- Delete: `src/app/admin/reports/page.tsx`
- Delete: `src/app/admin/reports/loading.tsx`
- Delete: `src/lib/data-reports.ts`
- Modify: `src/lib/data.ts:8`
- Modify: `src/lib/nav-config.ts:106-109`

**Interfaces:**
- Consumes: нічого.
- Produces: група `finance` у `NAV_GROUPS` містить рівно один пункт — `/admin/finance`. Слайс 2 додасть туди «Дні».

Сторінка показувала «Виручка за весь період» 32 610 ₴ проти правдивих 27 460 ₴:
`data-reports.ts` не знає про `finance_epoch` (+14 350 ₴ дотестових продажів
«з рук») і не бачить ремонтів (−9 200 ₴). Помилки частково гасять одна одну,
тому число виглядало правдоподібно.

- [ ] **Step 1: Переконатись, що інших споживачів немає**

Run:
```bash
grep -rn "getReportsData\|data-reports\|admin/reports" src/ --include=*.ts --include=*.tsx
```

Expected: рівно три рядки — `src/app/admin/reports/page.tsx:6`,
`src/app/admin/reports/page.tsx:15`, `src/lib/data.ts:8`. Якщо є інші —
зупинитись і повідомити, план цього не передбачав.

- [ ] **Step 2: Видалити файли**

```bash
git rm -r src/app/admin/reports src/lib/data-reports.ts
```

- [ ] **Step 3: Прибрати ре-експорт**

У `src/lib/data.ts` видалити рядок:

```ts
export { getReportsData } from "./data-reports";
```

- [ ] **Step 4: Прибрати пункт із навігації**

У `src/lib/nav-config.ts` замінити блок групи `finance`:

```ts
  {
    id: "finance",
    label: "Фінанси",
    icon: IconFinance,
    roles: MONEY_ROLES,
    items: [
      { href: "/admin/finance", label: "Фінанси", icon: IconFinance },
      { href: "/admin/reports", label: "Звіти", icon: IconReport },
    ],
  },
```

на:

```ts
  {
    // «Звіти» видалено 30.07.2026: сторінка мала власний грошовий конвеєр повз
    // profit.ts — без епохи і без ремонтів — і показувала виручку на 5 150 ₴
    // більшу за правдиву. Те, що вона намагалась показати, дають Продажі
    // (оборот, середній чек, категорії, методи оплати) і сторінка Днів.
    id: "finance",
    label: "Фінанси",
    icon: IconFinance,
    roles: MONEY_ROLES,
    items: [{ href: "/admin/finance", label: "Фінанси", icon: IconFinance }],
  },
```

- [ ] **Step 5: Прибрати імпорт `IconReport`, якщо він більше не потрібен**

`IconReport` використовується ще й групою `analytics` (рядок ~120). Перевірити:

```bash
grep -n "IconReport" src/lib/nav-config.ts
```

Expected: два входження (імпорт + група `analytics`). Імпорт лишити.

- [ ] **Step 6: Перевірити типи й тести**

```bash
npx tsc --noEmit && npx vitest run --silent
```

Expected: `tsc` без виводу; `Tests 348 passed`.

`nav-config.test.ts` перевіряє лише видимість групи `finance` за ролями, не її
пункти — тест лишається зеленим, бо група не спорожніла.

- [ ] **Step 7: Зібрати**

```bash
npx next build --webpack 2>&1 | tail -5
```

Expected: збірка проходить, у списку маршрутів немає `/admin/reports`.

- [ ] **Step 8: Коміт**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(reports): видалити сторінку «Звіти» разом із її конвеєром

Показувала «Виручка за весь період» 32 610 ₴ проти правдивих 27 460 ₴.
data-reports.ts не знав про finance_epoch (+14 350 ₴ дотестових продажів
«з рук») і не бачив ремонтів (−9 200 ₴); помилки частково гасили одна одну,
тому число виглядало правдоподібно.

Сторінка ще й лишалась у токенах до редизайну (text-text-primary,
var(--color-violet), bg-iris/10), які DESIGN.md v3 забороняє.

Її зміст покривають Продажі й майбутня сторінка Днів.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 2: Аналітика — епоха і розподілена знижка

**Files:**
- Modify: `src/lib/profit.ts` (експорт `allocateSaleRevenue`)
- Modify: `src/lib/data-analytics.ts`
- Test: `src/lib/__tests__/profit.test.ts` (додати describe для експортованої функції)

**Interfaces:**
- Consumes: `getSettings()` з `./data-settings` → `{ finance_epoch: string | null }`.
- Produces: `allocateSaleRevenue(items: ProfitSaleItem[], totalAmount: number): number[]` — публічна з `lib/profit.ts`. Сума результату дорівнює `totalAmount`, порядок паралельний `items`.

Три проблеми в `data-analytics.ts`:

1. Вікна `nDaysAgo(30)` / `nDaysAgo(90)` не притиснуті до епохи. Епоха 21.07,
   сьогодні 30.07 — тридцять днів назад це 30.06, тобто дотестові продажі
   «з рук» лежать усередині вікна.
2. `salesVelocity` і `crossSellRevenue30Days` підсумовують `sale_items.total_price` —
   це ціна ДО знижки. Той самий клас помилки, що виправлено в `profit.ts` 30.07.
3. `partnerRepairsRes` фільтрує ремонти за `created_at`, хоча заробленими вони
   стають на видачі. Ремонт, прийнятий 40 днів тому й виданий учора, у вікно
   не потрапляє.

- [ ] **Step 1: Написати падаючий тест на експорт `allocateSaleRevenue`**

Додати в кінець `src/lib/__tests__/profit.test.ts`:

```ts
describe("allocateSaleRevenue (публічний)", () => {
  it("розподіляє знижку і сходиться рівно в підсумок чека", () => {
    const items = [
      item({ item_type: "accessory", total_price: 1100, unit_cost: 644 }),
      item({ item_type: "accessory", total_price: 344, unit_cost: 160 }),
    ];
    const out = allocateSaleRevenue(items, 1300);
    expect(out.reduce((s, v) => s + v, 0)).toBe(1300);
    expect(out).toEqual([990, 310]);
  });

  it("без знижки віддає позиції як є", () => {
    const items = [item({ total_price: 100 }), item({ total_price: 250 })];
    expect(allocateSaleRevenue(items, 350)).toEqual([100, 250]);
  });
});
```

Додати `allocateSaleRevenue` до списку імпортів з `"../profit"` на початку файлу.

- [ ] **Step 2: Запустити — має впасти**

```bash
npx vitest run src/lib/__tests__/profit.test.ts 2>&1 | tail -20
```

Expected: FAIL — `allocateSaleRevenue is not exported` / `is not a function`.

- [ ] **Step 3: Експортувати функцію**

У `src/lib/profit.ts` знайти рядок:

```ts
function allocateSaleRevenue(items: ProfitSaleItem[], totalAmount: number): number[] {
```

замінити на:

```ts
export function allocateSaleRevenue(items: ProfitSaleItem[], totalAmount: number): number[] {
```

- [ ] **Step 4: Запустити — має пройти**

```bash
npx vitest run src/lib/__tests__/profit.test.ts 2>&1 | tail -10
```

Expected: PASS. Якщо `[990, 310]` не збігається — звірити з реальним чеком
`d4aee307` (позиції 1100 + 344, підсумок 1300) і виправити очікування в тесті,
а не функцію: метод найбільших залишків уже покритий тестами вище.

- [ ] **Step 5: Додати епоху в `data-analytics.ts`**

На початку `getAnalyticsData` замінити:

```ts
export async function getAnalyticsData(): Promise<AnalyticsData> {
  const supabase = await createClient();
  const { start, end } = todayRange();
  const thirtyDaysAgo = nDaysAgo(30);
  const ninetyDaysAgo = nDaysAgo(90);
```

на:

```ts
export async function getAnalyticsData(): Promise<AnalyticsData> {
  const supabase = await createClient();
  const { start, end } = todayRange();

  /* Вікна притиснуті до фінансової епохи. До відкриття магазину чеки писались
     «з рук»: епоха 21.07, а тридцять днів назад — це 30.06, тож без цієї межі
     дотестова торгівля лежить усередині кожного вікна і роздуває і виторг, і
     частку партнерів, і швидкість продажів. Межа одна на всю систему. */
  const epoch = (await getSettings()).finance_epoch;
  const floorIso = (iso: string) => (epoch && epoch > iso ? epoch : iso);
  const thirtyDaysAgo = floorIso(nDaysAgo(30));
  const ninetyDaysAgo = floorIso(nDaysAgo(90));
```

Додати імпорт угорі файлу:

```ts
import { getSettings } from "./data-settings";
import { allocateSaleRevenue, type ProfitSaleItem } from "./profit";
```

- [ ] **Step 6: Тягнути підсумок чека разом із позиціями**

Знайти запит:

```ts
    supabase.from("sale_items").select("item_id, item_type, total_price, sales!inner(created_at, id)").gte("sales.created_at", thirtyDaysAgo),
```

замінити на:

```ts
    /* `total_amount` чека потрібен, щоб рознести знижку по позиціях: у
       `sale_items.total_price` лежить ціна ДО знижки, і підсумовувати її як
       виторг означає завищувати його на всю знижку. */
    supabase
      .from("sale_items")
      .select("item_id, item_type, total_price, unit_cost, quantity, sales!inner(created_at, id, total_amount)")
      .gte("sales.created_at", thirtyDaysAgo),
```

- [ ] **Step 7: Рахувати `salesVelocity` і крос-сейл із розподіленої знижки**

Замінити блок `// Sales velocity` разом із блоком `// Cross-sell` (від рядка
з `const salesVelocity = { device: 0, ...` до рядка
`const crossSellDealsCount = crossSalesCount;`) на:

```ts
  /* Позиції групуються по чеках, і знижка кожного чека розноситься по його
     позиціях тим самим `allocateSaleRevenue`, що рахує P&L. Інакше «швидкість
     продажів» і «виторг з допродажів» називались би виторгом, а показували б
     суму цінників. */
  interface AnalyticsLine {
    item_type: string;
    revenue: number;
  }
  const linesBySale = new Map<string, AnalyticsLine[]>();
  {
    const raw = new Map<string, { total_amount: number; items: ProfitSaleItem[]; types: string[] }>();
    for (const row of (saleItems30DaysRes.data ?? []) as any[]) {
      const sale = row.sales;
      if (!sale?.id) continue;
      const bucket = raw.get(sale.id) ?? {
        total_amount: sale.total_amount ?? 0,
        items: [],
        types: [],
      };
      bucket.items.push({
        item_type: row.item_type,
        item_id: row.item_id,
        quantity: row.quantity ?? 1,
        total_price: row.total_price ?? 0,
        unit_cost: row.unit_cost ?? 0,
      });
      bucket.types.push(row.item_type);
      raw.set(sale.id, bucket);
    }
    for (const [saleId, b] of raw) {
      const revenues = allocateSaleRevenue(b.items, b.total_amount);
      linesBySale.set(
        saleId,
        b.types.map((item_type, i) => ({ item_type, revenue: revenues[i] })),
      );
    }
  }

  const salesVelocity = { device: 0, accessory: 0, part: 0, service: 0 };
  for (const lines of linesBySale.values()) {
    for (const l of lines) {
      if (l.item_type in salesVelocity) {
        salesVelocity[l.item_type as keyof typeof salesVelocity] += l.revenue;
      }
    }
  }

  let totalCoreSales = 0; // чеки, де є техніка або послуга
  let crossSalesCount = 0; // з них ті, де є ще й аксесуар
  let crossSellRevenue30Days = 0; // виторг аксесуарів у таких чеках

  for (const lines of linesBySale.values()) {
    const hasDeviceOrService = lines.some(
      (l) => l.item_type === "device" || l.item_type === "service",
    );
    if (!hasDeviceOrService) continue;
    totalCoreSales++;
    const hasAccessory = lines.some((l) => l.item_type === "accessory");
    if (!hasAccessory) continue;
    crossSalesCount++;
    for (const l of lines) {
      if (l.item_type === "accessory") crossSellRevenue30Days += l.revenue;
    }
  }

  const crossSellConversionRate =
    totalCoreSales > 0 ? Math.round((crossSalesCount / totalCoreSales) * 100) : 0;
  const crossSellDealsCount = crossSalesCount;
```

- [ ] **Step 8: Фільтрувати ремонти партнерів за датою видачі**

Знайти запит:

```ts
    supabase
      .from("repairs")
      .select("price, partner_id, status, completed_at")
      .gte("created_at", thirtyDaysAgo),
```

замінити на:

```ts
    /* Ремонт заробляється на видачі (`repairSettledAt`), тож і вікно по ній.
       За `created_at` ремонт, прийнятий сорок днів тому й виданий учора, у
       тридцятиденне вікно не потрапляв би — хоча гроші зайшли всередині нього. */
    supabase
      .from("repairs")
      .select("price, partner_id, status, completed_at")
      .is("inventory_device_id", null)
      .gte("completed_at", thirtyDaysAgo),
```

- [ ] **Step 9: Перевірити типи й тести**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -6
```

Expected: `tsc` без виводу; всі тести зелені (349+ після нових).

- [ ] **Step 10: Звірити числа з базою**

Через Supabase MCP `execute_sql`:

```sql
select
  (select coalesce(sum(total_amount),0) from sales
     where created_at >= '2026-07-21T10:04:41Z') as sales_since_epoch,
  (select coalesce(sum(si.total_price),0) from sale_items si
     join sales s on s.id = si.sale_id
     where s.created_at >= '2026-07-21T10:04:41Z') as line_total_before_discount;
```

Expected: друге число більше за перше рівно на суму знижок (на 30.07 — 144 ₴).
Сума `salesVelocity` після правки має дорівнювати `sales_since_epoch`, а не
`line_total_before_discount`.

- [ ] **Step 11: Коміт**

```bash
git add src/lib/profit.ts src/lib/data-analytics.ts src/lib/__tests__/profit.test.ts
git commit -m "$(cat <<'EOF'
fix(analytics): епоха і розподілена знижка в аналітиці

Три помилки одного класу:

- вікна 30/90 днів не знали про finance_epoch, а епоха 21.07 лежить усередині
  тридцятиденного вікна — дотестова торгівля «з рук» роздувала і виторг, і
  частку партнерів;
- salesVelocity і crossSellRevenue30Days підсумовували sale_items.total_price,
  тобто ціну ДО знижки, і називали це виторгом;
- ремонти партнерів фільтрувались за created_at, хоча заробленими стають на
  видачі: ремонт, прийнятий сорок днів тому й виданий учора, у вікно не
  потрапляв.

allocateSaleRevenue експортовано з profit.ts — щоб розподіл знижки не завівся
тут другою копією.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 3: Хітмапа — епоха і ремонти

**Files:**
- Create: `supabase/migrations/20260730200000_revenue_heatmap_epoch_and_repairs.sql`

**Interfaces:**
- Consumes: нічого з попередніх задач.
- Produces: `get_revenue_heatmap(days_back integer)` з тією самою сигнатурою й тими самими стовпцями (`dow`, `hour_of_day`, `total_revenue`, `tx_count`, `avg_check`). `HeatmapRow` у `widget-types` не змінюється.

Поточна функція рахує по `sales` за `NOW() − N днів`, без епохи і без ремонтів.
Ремонти — 9 200 ₴ із 27 460 ₴ виторгу, тобто третина: хітмапа, названа
«revenue», без них систематично занижує вечірні години, коли віддають техніку.

Епоха читається з `settings` усередині функції, а не приходить параметром:
викликачу не треба знати дату, а другого місця з нею не з'являється.

- [ ] **Step 1: Підтвердити тип `finance_epoch` у `settings`**

Через Supabase MCP `execute_sql`:

```sql
select key, value, pg_typeof(value) as t from settings where key = 'finance_epoch';
```

Expected: `finance_epoch | "2026-07-21T10:04:41Z" | jsonb`.

Тип **jsonb**, не text — перевірено під час планування. Тому в міграції нижче
стоїть `value #>> '{}'`, а не `value::text`: другий варіант віддав би рядок
разом із лапками, і каст у `timestamptz` упав би. Якщо тип раптом інший —
зупинитись, вираз розрахований саме на jsonb.

- [ ] **Step 2: Написати міграцію**

Створити `supabase/migrations/20260730200000_revenue_heatmap_epoch_and_repairs.sql`:

```sql
-- Хітмапа виторгу рахувала лише `sales` і не знала про фінансову епоху.
--
-- Ремонти — третина виторгу магазину (9 200 ₴ із 27 460 ₴ станом на 30.07).
-- Без них хітмапа, названа «revenue», систематично занижувала вечірні години,
-- коли клієнти забирають техніку. Ремонт лягає в годину видачі — те саме
-- правило, що в `repairSettledAt` і в `search_transactions`.
--
-- Епоха читається зі `settings` усередині функції, а не приходить параметром:
-- викликачу не треба знати дату, і другого місця з нею не з'являється.
--
-- Дефолт параметра зберігаємо один в один — без нього `create or replace`
-- відмовляється чіпати наявну функцію.

create or replace function public.get_revenue_heatmap(days_back integer default 60)
returns table(
  dow integer,
  hour_of_day integer,
  total_revenue bigint,
  tx_count bigint,
  avg_check numeric
)
language sql
stable
as $$
  with epoch as (
    -- `settings.value` — jsonb, тож `#>> '{}'` дістає рядок без лапок.
    -- `value::text` віддав би "2026-07-21T10:04:41Z" разом із лапками і каст
    -- у timestamptz упав би. Немає ключа — межі немає, як і всюди в системі.
    select coalesce(
      (select value #>> '{}' from settings where key = 'finance_epoch'),
      '-infinity'
    )::timestamptz as at
  ),
  ops as (
    select s.created_at as at, s.total_amount as amount
    from sales s, epoch e
    where s.created_at > now() - (days_back || ' days')::interval
      and s.created_at >= e.at
      and s.total_amount > 0
    union all
    select r.completed_at, r.price
    from repairs r, epoch e
    where r.status in ('handed_over', 'completed')
      and r.inventory_device_id is null
      and r.price > 0
      and r.completed_at is not null
      and r.completed_at > now() - (days_back || ' days')::interval
      and r.completed_at >= e.at
  )
  select
    extract(dow  from at at time zone 'Europe/Kyiv')::int as dow,
    extract(hour from at at time zone 'Europe/Kyiv')::int as hour_of_day,
    sum(amount)::bigint                                   as total_revenue,
    count(*)::bigint                                      as tx_count,
    round(avg(amount)::numeric, 0)                        as avg_check
  from ops
  group by 1, 2
  order by 1, 2;
$$;
```

- [ ] **Step 3: Застосувати через Supabase MCP**

Викликати `mcp__supabase__apply_migration` з `name: "revenue_heatmap_epoch_and_repairs"`
і тілом міграції без коментарів-заголовків.

Expected: `{"success": true}`. Якщо помилка `cannot change return type of
existing function` — спершу `drop function if exists public.get_revenue_heatmap(integer);`
окремим викликом, потім створити наново, і **дописати цей DROP у файл міграції**,
щоб файл і база не розійшлись.

- [ ] **Step 4: Звірити результат**

```sql
select sum(total_revenue) as heatmap_total from get_revenue_heatmap(60);
```

Expected: дорівнює виторгу від епохи — на 30.07 це 27 460 ₴
(18 260 товарів + 9 200 ремонтів). До правки було б 32 610 ₴ без ремонтів.
Число живе, тож звіряти з поточним станом бази цим запитом:

```sql
select
  (select coalesce(sum(total_amount),0) from sales
     where created_at >= '2026-07-21T10:04:41Z' and total_amount > 0)
+ (select coalesce(sum(price),0) from repairs
     where status in ('handed_over','completed') and inventory_device_id is null
       and price > 0 and completed_at >= '2026-07-21T10:04:41Z') as expected;
```

- [ ] **Step 5: Перевірити типи, тести, збірку**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -5 && npx next build --webpack 2>&1 | tail -5
```

Expected: усе зелене. `HeatmapRow` не змінювався, тож клієнтський код не чіпається.

- [ ] **Step 6: Коміт**

```bash
git add supabase/migrations/20260730200000_revenue_heatmap_epoch_and_repairs.sql
git commit -m "$(cat <<'EOF'
fix(analytics): хітмапа виторгу знає епоху і бачить ремонти

Рахувала лише sales і не знала про finance_epoch. Ремонти — третина виторгу
(9 200 ₴ із 27 460 ₴ на 30.07), тож хітмапа систематично занижувала вечірні
години, коли клієнти забирають техніку.

Ремонт лягає в годину видачі — те саме правило, що в repairSettledAt.
Епоха читається зі settings усередині функції, щоб другого місця з датою не
з'явилось.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 4: Guard-тест проти повернення проблеми

**Files:**
- Create: `src/lib/__tests__/no-raw-revenue-sum.test.ts`

**Interfaces:**
- Consumes: нічого. Тест читає файли з диска, як наявний `no-raw-register-sum.test.ts`.
- Produces: нічого.

Найімовірніший спосіб зламати консистентність — підсумувати `total_amount` або
`price` у новому місці й отримати виторг повз `profit.ts`. Помилка тиха: число
виглядає правдоподібно. Тест ловить саме форму запису, як це вже робить
`no-raw-register-sum.test.ts` для балансів кас.

- [ ] **Step 1: Написати тест**

Створити `src/lib/__tests__/no-raw-revenue-sum.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Виторг рахує рівно один модуль — `lib/profit.ts`. Найімовірніший спосіб це
 * зламати — підсумувати `total_amount` чи `price` reduce-ом у новому місці:
 * число вийде правдоподібне, а від дашборду розійдеться мовчки. Саме так
 * жили «Звіти» (32 610 ₴ проти 27 460 ₴) і аналітика до 30.07.
 *
 * Тест ловить форму запису, а не наслідок. `data-analytics.ts` тут навмисно:
 * він рахує партнерські суми напряму, але тільки над рядками, які вже
 * відфільтровані епохою, і жоден із них не називається виторгом магазину.
 * Якщо колись назветься — тест має впасти, і це правильно.
 *
 * `data-day.ts` у списку немає свідомо: файл з'явиться у слайсі 2, і додати
 * його має той слайс. Рядок із `try/catch` на неіснуючий файл був би тестом,
 * який нічого не стверджує, — гірше за відсутній.
 */
const GUARDED = ["src/lib/data-dashboard.ts", "src/lib/data-sales.ts"];

const RAW_SUM = /reduce\([\s\S]{0,120}\.(total_amount|total_price)\b/g;

describe("виторг рахується лише через profit.ts", () => {
  for (const file of GUARDED) {
    it(`${file} не підсумовує total_amount/total_price напряму`, () => {
      expect(readFileSync(file, "utf8").match(RAW_SUM)).toBeNull();
    });
  }
});
```

- [ ] **Step 2: Запустити**

```bash
npx vitest run src/lib/__tests__/no-raw-revenue-sum.test.ts 2>&1 | tail -20
```

Expected: PASS для обох. Якщо `data-dashboard.ts` або `data-sales.ts` падає —
це справжня знахідка: у плані її не було, зупинитись і повідомити з показом
рядка, що спрацював.

- [ ] **Step 3: Довести, що тест ловить регресію**

Тимчасово додати в кінець `src/lib/data-sales.ts`:

```ts
const _probe = ([] as { total_amount: number }[]).reduce((s, r) => s + r.total_amount, 0);
```

Run:
```bash
npx vitest run src/lib/__tests__/no-raw-revenue-sum.test.ts 2>&1 | tail -10
```

Expected: FAIL на `src/lib/data-sales.ts`. Прибрати рядок, перезапустити —
знову PASS. Без цього кроку тест міг би бути зеленим через помилку в регексі.

- [ ] **Step 4: Повний прогін**

```bash
npx tsc --noEmit && npx vitest run --silent 2>&1 | tail -6
```

Expected: `tsc` без виводу, усі тести зелені.

- [ ] **Step 5: Коміт**

```bash
git add src/lib/__tests__/no-raw-revenue-sum.test.ts
git commit -m "$(cat <<'EOF'
test(profit): guard проти підрахунку виторгу повз profit.ts

Найімовірніший спосіб зламати консистентність — reduce по total_amount у
новому місці. Помилка тиха: число правдоподібне, а від дашборду розходиться
мовчки. Саме так жили «Звіти» і аналітика.

Той самий прийом, що в no-raw-register-sum.test.ts для балансів кас: тест
ловить форму запису, а не наслідок. data-day.ts у списку наперед — файл
з'явиться у слайсі 2, і правило його дочекається.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SbCJ1NWyTw8vjP46XzdsXd
EOF
)"
```

---

### Task 5: Деплой і передача на візуальну перевірку

**Files:** немає змін.

- [ ] **Step 1: Пуш**

```bash
git push origin master
```

- [ ] **Step 2: Деплой**

```bash
npx vercel --prod --yes 2>&1 | grep -E '"(readyState|target|url)"' | head -5
```

Expected: `"readyState": "READY"`, `"target": "production"`.

- [ ] **Step 3: Перевірити, що прод-аліас переїхав**

```bash
npx vercel inspect <url з попереднього кроку> 2>&1 | grep -A4 -i alias
```

Expected: серед аліасів `nextjs-boilerplate-two-orpin-hk16khlxnc.vercel.app`.

- [ ] **Step 4: Скласти список того, чого не бачив на екрані**

Обов'язково перелічити власнику:

- сайдбар і вкладки «Фінанси» після зникнення пункту «Звіти» — група лишилась
  з одним пунктом, і `SectionTabs` малює одну вкладку;
- сторінку «Аналітика» з переліченими віджетами: швидкість продажів, крос-сейл,
  частка партнерів, хітмапа — усі чотири числа змінились;
- що `/admin/reports` тепер віддає 404.

---

## Самоперевірка плану

**Покриття спеки.** Слайс 1 має п'ять пунктів. Видалення «Звітів» — Task 1.
Аналітика на `profit.ts` + епоха — Task 2. Хітмапа — Task 3. Guard-тест —
Task 4. `data-operations.ts` — перевірено під час планування, змін не потребує:
рахує борг через спільні `isUnpaid`/`outstanding`, а не виторг; зафіксовано в
розділі «Перевірено, роботи не потребує».

**Плейсхолдери.** Немає: кожен крок містить або точну команду з очікуваним
виводом, або повний код заміни.

**Узгодженість типів.** `allocateSaleRevenue(items: ProfitSaleItem[],
totalAmount: number): number[]` — та сама сигнатура в Task 2 Step 3 (експорт),
у тесті Step 1 і у виклику Step 7. `ProfitSaleItem` імпортується в
`data-analytics.ts` у Step 5 і використовується в Step 7. `get_revenue_heatmap`
у Task 3 зберігає стовпці, на які розрахований `HeatmapRow`.

**Ризик, який план не знімає.** `data-analytics.ts` містить `any` у кількох
місцях (успадковані, `eslint` на них уже свариться до цих змін). План їх не
чіпає, щоб не змішувати два різні наміри в одному коміті.
