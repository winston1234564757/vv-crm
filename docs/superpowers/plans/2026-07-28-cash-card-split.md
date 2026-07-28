# Розділення готівки й безготівки — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Безготівка перестає бути невідрізнимою від готівки: картка їде на окремий рахунок, а система всюди показує «готівкою / карткою / разом».

**Architecture:** Рахунок «Безготівка» — це рядок у `cash_registers` з `type = 'cashless'`. Спосіб оплати не зберігається окремою колонкою: він визначається тим, у який контейнер лягли гроші. Тому історію мігрувати не треба, а маршрутизація зводиться до однієї чистої функції `targetRegisterType(method, category)`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase Postgres + plpgsql RPC, TypeScript, Vitest.

**Спека:** `docs/superpowers/specs/2026-07-28-cash-card-split-design.md`

## Global Constraints

- Тип нового рахунку — рівно рядок `'cashless'`. Назва рядка — рівно `Безготівка`.
- Гроші руками не правимо: баланси міняють лише RPC, які пишуть рядок у `transactions`.
- `database.ts` **не регенерувати** — це ламає `@ts-expect-error` на RPC. Нові поля дописувати вручну.
- Міграції застосовувати через Supabase MCP `apply_migration`, не через CLI (він тут падає).
- Кожне завдання завершується `npx tsc --noEmit` без помилок і `npx vitest run` без падінь.
- Мова коментарів і рядків інтерфейсу — українська, як у решті проєкту.

---

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/lib/utils/finance.ts` (правка) | Чисті правила: що таке безготівка, куди йде платіж, як ділити баланси |
| `src/lib/utils/__tests__/finance.test.ts` (правка) | Тести цих правил |
| міграція `cashless_register` | Рядок «Безготівка» |
| міграція `quick_sale_per_payment_register` | `process_quick_sale` вчиться касі на кожен платіж |
| `src/lib/actions/sales.ts` (правка) | Обидва шляхи продажу маршрутизують за методом |
| `src/app/admin/repairs/RepairsClient.tsx` (правка) | Дві кнопки замість вибору каси |
| `src/lib/actions/orders.ts` (правка) | Аванс маршрутизується за методом |
| `src/lib/data-dashboard.ts`, `src/lib/data-finance.ts`, `src/app/api/ai-chat/route.ts` (правки) | Читачі переходять на `splitByKind` |
| `src/app/admin/finance/page.tsx` (правка) | Картка «Безготівка» + підсумок |
| `src/app/admin/CashCard.tsx`, `src/app/admin/TodaySalesCard.tsx` (правки) | Розбивка на дашборді |
| `src/app/admin/reports/page.tsx`, `src/app/admin/sales/` (правки) | Метод у звітах і списку |

---

### Task 1: Чисті правила розділення

**Files:**
- Modify: `src/lib/utils/finance.ts`
- Test: `src/lib/utils/__tests__/finance.test.ts`

**Interfaces:**
- Consumes: нічого
- Produces:
  - `CASHLESS_REGISTER_TYPE: "cashless"`
  - `isCashless(type: string): boolean`
  - `splitByKind<T extends { type: string; balance: number }>(registers: T[]): { cash: number; cashless: number; total: number }`
  - `targetRegisterType(method: string, category: "device" | "accessory" | "service"): string`

- [ ] **Step 1: Написати падаючий тест**

Додати в кінець `src/lib/utils/__tests__/finance.test.ts`:

```ts
import {
  CASHLESS_REGISTER_TYPE,
  isCashless,
  splitByKind,
  targetRegisterType,
} from "../finance";

describe("Розділення готівки й безготівки", () => {
  const registers = [
    { type: "tech", balance: 100 },
    { type: "accessories", balance: 250 },
    { type: "repairs", balance: 50 },
    { type: CASHLESS_REGISTER_TYPE, balance: 1300 },
  ];

  it("splitByKind рахує готівку окремо від картки", () => {
    expect(splitByKind(registers)).toEqual({ cash: 400, cashless: 1300, total: 1700 });
  });

  it("splitByKind на порожньому списку дає нулі, а не NaN", () => {
    expect(splitByKind([])).toEqual({ cash: 0, cashless: 0, total: 0 });
  });

  it("splitByKind без рахунку безготівки дає cashless = 0", () => {
    expect(splitByKind([{ type: "tech", balance: 100 }])).toEqual({
      cash: 100,
      cashless: 0,
      total: 100,
    });
  });

  it("isCashless впізнає лише рахунок безготівки", () => {
    expect(isCashless(CASHLESS_REGISTER_TYPE)).toBe(true);
    expect(isCashless("tech")).toBe(false);
    expect(isCashless("")).toBe(false);
  });

  // Головне правило: метод важливіший за категорію. Саме його бракувало,
  // коли 1300 карткою потрапили в касу аксесуарів.
  it("готівка йде в касу за категорією товару", () => {
    expect(targetRegisterType("cash", "device")).toBe("tech");
    expect(targetRegisterType("cash", "accessory")).toBe("accessories");
    expect(targetRegisterType("cash", "service")).toBe("repairs");
  });

  it("картка й переказ ідуть на безготівку з будь-якої категорії", () => {
    for (const category of ["device", "accessory", "service"] as const) {
      expect(targetRegisterType("card", category)).toBe(CASHLESS_REGISTER_TYPE);
      expect(targetRegisterType("transfer", category)).toBe(CASHLESS_REGISTER_TYPE);
    }
  });

  // Невідомий метод не має тихо стати готівкою: у шухляді його немає.
  it("невідомий метод вважається безготівковим", () => {
    expect(targetRegisterType("crypto", "device")).toBe(CASHLESS_REGISTER_TYPE);
  });
});
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `npx vitest run src/lib/utils/__tests__/finance.test.ts`
Expected: FAIL — `does not provide an export named 'splitByKind'`

- [ ] **Step 3: Реалізувати**

Додати в кінець `src/lib/utils/finance.ts`:

```ts
/**
 * Тип рядка `cash_registers`, який означає безготівковий рахунок.
 *
 * Безготівка — це не каса: фізично цих грошей у шухляді немає. Але окрема
 * таблиця коштувала б третього виду сховища в кожному шляху читання, тож
 * рахунок живе поруч із касами й відрізняється саме типом.
 */
export const CASHLESS_REGISTER_TYPE = "cashless";

export function isCashless(type: string): boolean {
  return type === CASHLESS_REGISTER_TYPE;
}

/**
 * Ділить баланси контейнерів на готівку й безготівку.
 *
 * Живе тут, а не чотирма копіями в дашборді, фінансах і AI-роуті: у цьому
 * проєкті вже є слід від скопійованого правила — `EARNED_REPAIR_STATUSES`
 * колись розійшовся по незалежних копіях і почав означати різне.
 */
export function splitByKind<T extends { type: string; balance: number }>(
  registers: T[],
): { cash: number; cashless: number; total: number } {
  let cash = 0;
  let cashless = 0;
  for (const r of registers) {
    if (isCashless(r.type)) cashless += r.balance;
    else cash += r.balance;
  }
  return { cash, cashless, total: cash + cashless };
}

/**
 * У який тип каси має лягти платіж.
 *
 * Метод важливіший за категорію: категорія обирає касу лише тоді, коли гроші
 * справді готівкові. Усе інше — картка, переказ, невідоме — їде на безготівку,
 * бо в шухляду воно не потрапляє.
 */
export function targetRegisterType(
  method: string,
  category: "device" | "accessory" | "service",
): string {
  if (method !== "cash") return CASHLESS_REGISTER_TYPE;
  if (category === "accessory") return "accessories";
  if (category === "service") return "repairs";
  return "tech";
}
```

- [ ] **Step 4: Запустити тест і переконатись, що проходить**

Run: `npx vitest run src/lib/utils/__tests__/finance.test.ts`
Expected: PASS

- [ ] **Step 5: Коміт**

```bash
git add src/lib/utils/finance.ts src/lib/utils/__tests__/finance.test.ts
git commit -m "feat(finance): правила розділення готівки й безготівки"
```

---

### Task 2: Рахунок «Безготівка» в базі

**Files:**
- Create: міграція `cashless_register` (через MCP `apply_migration`)

**Interfaces:**
- Consumes: `CASHLESS_REGISTER_TYPE` з Task 1 (як рядкове значення)
- Produces: рядок `cash_registers` з `type = 'cashless'`, на який спираються Tasks 3–11

- [ ] **Step 1: Застосувати міграцію**

Викликати MCP `mcp__supabase__apply_migration` з `name: "cashless_register"` і запитом:

```sql
-- Безготівковий рахунок живе поруч із касами, бо `transactions` уже вміє
-- `to_type = 'cash_register'`. Окрема таблиця вимагала б третього виду
-- сховища в кожному шляху читання, RPC і RLS.
insert into public.cash_registers (name, type, balance)
select 'Безготівка', 'cashless', 0
where not exists (select 1 from public.cash_registers where type = 'cashless');
```

- [ ] **Step 2: Перевірити, що рядок один і з нульовим балансом**

Викликати MCP `mcp__supabase__execute_sql`:

```sql
select id, name, type, balance from public.cash_registers where type = 'cashless';
```

Expected: рівно один рядок, `name = 'Безготівка'`, `balance = 0`.

- [ ] **Step 3: Переконатись, що наявні екрани не зламались**

Run: `npx tsc --noEmit && npx vitest run`
Expected: без помилок. Новий рядок поки що просто зʼявиться в списку кас на екрані фінансів із нульовим балансом — це очікувано.

- [ ] **Step 4: Коміт**

Міграція застосована на сервері; у репозиторії фіксуємо її копію для історії.

```bash
mkdir -p supabase/migrations
cat > supabase/migrations/20260728170000_cashless_register.sql <<'SQL'
insert into public.cash_registers (name, type, balance)
select 'Безготівка', 'cashless', 0
where not exists (select 1 from public.cash_registers where type = 'cashless');
SQL
git add supabase/migrations/20260728170000_cashless_register.sql
git commit -m "feat(finance): рахунок «Безготівка» як каса типу cashless"
```

---

### Task 3: `process_quick_sale` вчиться касі на кожен платіж

**Files:**
- Create: міграція `quick_sale_per_payment_register`

**Interfaces:**
- Consumes: рядок `cashless` з Task 2
- Produces: `process_quick_sale` читає `cash_register_id` з елемента `p_payments`, а `p_cash_register_id` лишається запасним значенням

**Чому це окреме завдання:** `process_pos_sale` уже приймає касу на кожен платіж, а `process_quick_sale` — одну на весь чек. Тому швидкий продаж зі сплітом «частина готівкою, частина карткою» фізично не може розкласти гроші по різних касах, доки функція цього не вміє.

- [ ] **Step 1: Прочитати поточне тіло функції**

Викликати MCP `mcp__supabase__execute_sql`:

```sql
select pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'process_quick_sale';
```

Зберегти вивід — його треба відтворити повністю, змінивши лише цикл по `p_payments`.

- [ ] **Step 2: Застосувати міграцію**

Викликати `apply_migration` з `name: "quick_sale_per_payment_register"`. Тіло — повний `CREATE OR REPLACE FUNCTION` зі Step 1, у якому цикл по платежах бере касу з самого платежу:

```sql
-- Було: усі платежі чека йшли в p_cash_register_id.
-- Стало: кожен платіж може мати власну касу, бо готівкова частина спліту
-- належить касі за категорією, а карткова — рахунку безготівки.
-- p_cash_register_id лишається запасним значенням для старих викликів.
v_register_id := COALESCE(
  NULLIF(v_payment->>'cash_register_id', '')::uuid,
  p_cash_register_id
);
```

Оголосити `v_register_id UUID;` у блоці `DECLARE` і замінити `p_cash_register_id` на `v_register_id` у тих місцях циклу, де створюється транзакція, оновлюється баланс каси й пишеться `payment_splits`.

- [ ] **Step 3: Перевірити, що стара форма виклику ще працює**

Викликати `execute_sql`:

```sql
select 1
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'process_quick_sale'
  and pg_get_functiondef(p.oid) ilike '%cash_register_id%';
```

Expected: один рядок. Параметр `p_cash_register_id` має лишитись у сигнатурі — інакше наявний виклик із `sales.ts:147` впаде.

- [ ] **Step 4: Коміт**

```bash
cat > supabase/migrations/20260728170100_quick_sale_per_payment_register.sql <<'SQL'
-- (повний CREATE OR REPLACE FUNCTION зі Step 2)
SQL
git add supabase/migrations/20260728170100_quick_sale_per_payment_register.sql
git commit -m "feat(sales): process_quick_sale приймає касу на кожен платіж"
```

---

### Task 4: Маршрутизація продажів за методом

**Files:**
- Modify: `src/lib/actions/sales.ts:86-95` (швидкий продаж), `src/lib/actions/sales.ts:249`, `src/lib/actions/sales.ts:299-320` (POS)

**Interfaces:**
- Consumes: `targetRegisterType` (Task 1), рядок `cashless` (Task 2), новий `process_quick_sale` (Task 3)
- Produces: жодного нового експорту

- [ ] **Step 1: Додати імпорт**

У `src/lib/actions/sales.ts` до наявних імпортів:

```ts
import { targetRegisterType } from "@/lib/utils/finance";
```

- [ ] **Step 2: Швидкий продаж — каса на кожен платіж**

Замінити блок `sales.ts:88-95`:

```ts
    let targetRegType = "tech";
    if (parsed.item_category === "accessory") targetRegType = "accessories";
    else if (parsed.item_category === "service") targetRegType = "repairs";

    const targetRegisterId = regMap[targetRegType];
    if (!targetRegisterId) {
      throw new Error(`Касу типу "${targetRegType}" не знайдено в системі.`);
    }
```

на:

```ts
    // Категорія більше не вирішує сама: карткова частина чека належить
    // рахунку безготівки, готівкова — касі за категорією товару.
    const cashRegType = targetRegisterType("cash", parsed.item_category);
    const targetRegisterId = regMap[cashRegType];
    if (!targetRegisterId) {
      throw new Error(`Касу типу "${cashRegType}" не знайдено в системі.`);
    }
```

- [ ] **Step 3: Швидкий продаж — проставити касу платежам**

Замінити оголошення `PaymentSplitData` і збірку `payments` (`sales.ts:108-122`) на:

```ts
    interface PaymentSplitData {
      amount: number;
      method: "cash" | "card" | "transfer";
      cash_register_id: string;
    }

    function registerFor(method: string): string {
      const type = targetRegisterType(method, parsed.item_category);
      const id = regMap[type];
      if (!id) throw new Error(`Касу типу "${type}" не знайдено в системі.`);
      return id;
    }

    const payments: PaymentSplitData[] = [];
    if (parsed.is_split) {
      if (parsed.cash_amount > 0) {
        payments.push({
          amount: parsed.cash_amount,
          method: "cash",
          cash_register_id: registerFor("cash"),
        });
      }
      if (parsed.card_amount > 0) {
        payments.push({
          amount: parsed.card_amount,
          method: "card",
          cash_register_id: registerFor("card"),
        });
      }

      const totalSplit = parsed.cash_amount + parsed.card_amount;
      if (Math.abs(totalSplit - parsed.amount) > 1) {
        throw new Error(`Сума частин спліту (${totalSplit} грн) не збігається з сумою до оплати (${parsed.amount} грн)`);
      }
    } else if (parsed.amount > 0) {
      payments.push({
        amount: parsed.amount,
        method: parsed.method,
        cash_register_id: registerFor(parsed.method),
      });
    }
```

- [ ] **Step 4: POS — каса за методом, категорія лишається в описі**

У `createMultiSaleAction` замінити тіло циклу `for (const dist of distribution)` (`sales.ts:306-320`) на:

```ts
      for (const dist of distribution) {
        if (!(dist.amount > 0)) continue;

        const category =
          dist.type === "tech" ? "device" : dist.type === "accessories" ? "accessory" : "service";
        const targetRegisterId = regMap[targetRegisterType(p.method, category)];
        if (!targetRegisterId) continue;

        const paymentMethodText = p.method === "cash" ? "Готівка" : p.method === "card" ? "Картка" : "Переказ";
        const catText = dist.type === "tech" ? "Техніка" : dist.type === "accessories" ? "Аксесуари" : "Послуги";

        // Рядки лишаються розбитими по категоріях навіть коли всі вони їдуть
        // на один рахунок: категорія — єдине, що потім пояснює, за що гроші.
        rpcPayments.push({
          amount: dist.amount,
          method: p.method,
          cash_register_id: targetRegisterId,
          description: `${parsed.notes || "POS Продаж"}: ${catText} [Оплата: ${paymentMethodText}]`
        });
      }
```

- [ ] **Step 5: Перевірити типи й тести**

Run: `npx tsc --noEmit && npx vitest run`
Expected: без помилок, 330+ тестів проходять.

- [ ] **Step 6: Коміт**

```bash
git add src/lib/actions/sales.ts
git commit -m "fix(sales): картка їде на рахунок безготівки, а не в касу за категорією"
```

---

### Task 5: Оплата ремонту двома кнопками

**Files:**
- Modify: `src/app/admin/repairs/RepairsClient.tsx:333-372`

**Interfaces:**
- Consumes: `CASHLESS_REGISTER_TYPE`, `isCashless` (Task 1); `payRepair(repairId, cashRegisterId, amount)` без змін
- Produces: жодного нового експорту

- [ ] **Step 1: Додати імпорт**

```ts
import { CASHLESS_REGISTER_TYPE } from "@/lib/utils/finance";
```

- [ ] **Step 2: Замінити вибір каси на дві кнопки**

Замінити `<Select label="Каса" …>` (`RepairsClient.tsx:362-371`) на:

```tsx
          {/*
            Замість списку кас — спосіб оплати. Каса виводиться з нього сама:
            готівка йде в касу ремонтів, картка — на рахунок безготівки.
            Кліків не більшає, а спосіб оплати нарешті фіксується: раніше
            `pay_repair` не знав його взагалі.
          */}
          <div>
            <p className="mb-1.5 block text-xs font-medium text-muted">Спосіб оплати</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "cash", label: "Готівкою", type: "repairs" },
                { key: "card", label: "Карткою", type: CASHLESS_REGISTER_TYPE },
              ] as const).map((opt) => {
                const target = cashRegisters.find((c) => c.type === opt.type);
                return (
                  <Button
                    key={opt.key}
                    type="button"
                    variant={payRegister === target?.id ? "primary" : "secondary"}
                    disabled={!target}
                    onClick={() => target && setPayRegister(target.id)}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>
```

- [ ] **Step 3: Стартове значення — каса ремонтів**

Знайти, де `payRegister` ініціалізується, і замінити початкове значення на id каси з `type === "repairs"`:

```tsx
  const repairsRegisterId = cashRegisters.find((c) => c.type === "repairs")?.id ?? "";
  const [payRegister, setPayRegister] = useState(repairsRegisterId);
```

- [ ] **Step 4: Перевірити типи, лінт і збірку**

Run: `npx tsc --noEmit && npx eslint src/app/admin/repairs/RepairsClient.tsx && npm run build`
Expected: без помилок.

- [ ] **Step 5: Коміт**

```bash
git add src/app/admin/repairs/RepairsClient.tsx
git commit -m "feat(repairs): оплата ремонту фіксує спосіб оплати"
```

---

### Task 6: Аванс за замовлення за методом

**Files:**
- Modify: `src/lib/actions/orders.ts:78-93`

**Interfaces:**
- Consumes: `targetRegisterType` (Task 1)
- Produces: `createOrder` приймає `payment_method` у формі (`"cash" | "card"`, за замовчуванням `"cash"`)

- [ ] **Step 1: Додати поле в схему**

У zod-схему замовлення додати:

```ts
  payment_method: z.enum(["cash", "card"]).optional().default("cash"),
```

і в збірку `data` з `formData`:

```ts
      payment_method: formData.get("payment_method") || "cash",
```

- [ ] **Step 2: Маршрутизувати касу за методом**

Замінити `orders.ts:82-92`:

```ts
      const registerType = REGISTER_TYPE_BY_ITEM[parsed.items[0].item_type];
```

на:

```ts
      // Аванс карткою не потрапляє в шухляду, тож категорія першої позиції
      // обирає касу лише для готівки.
      const registerType = targetRegisterType(
        parsed.payment_method,
        REGISTER_CATEGORY_BY_ITEM[parsed.items[0].item_type],
      );
```

Додати поруч із наявною мапою:

```ts
const REGISTER_CATEGORY_BY_ITEM: Record<string, "device" | "accessory" | "service"> = {
  device: "device",
  accessory: "accessory",
  service: "service",
  part: "service",
};
```

та імпорт `targetRegisterType` з `@/lib/utils/finance`.

- [ ] **Step 3: Додати перемикач у форму замовлення**

У формі створення замовлення, одразу під полем авансу, додати:

```tsx
      {depositNum > 0 && (
        <div>
          <p className="mb-1.5 block text-xs font-medium text-muted">Спосіб оплати авансу</p>
          <input type="hidden" name="payment_method" value={paymentMethod} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={paymentMethod === "cash" ? "primary" : "secondary"}
              onClick={() => setPaymentMethod("cash")}
            >
              Готівкою
            </Button>
            <Button
              type="button"
              variant={paymentMethod === "card" ? "primary" : "secondary"}
              onClick={() => setPaymentMethod("card")}
            >
              Карткою
            </Button>
          </div>
        </div>
      )}
```

зі станом угорі компонента:

```tsx
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
```

де `depositNum` — числове значення поля авансу. Блок показується лише коли аванс більший за нуль: без авансу питання про спосіб оплати не має сенсу.

- [ ] **Step 4: Перевірити**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: без помилок.

- [ ] **Step 5: Коміт**

```bash
git add src/lib/actions/orders.ts src/app/admin/orders
git commit -m "feat(orders): аванс карткою йде на рахунок безготівки"
```

---

### Task 7: Читачі переходять на `splitByKind`

**Files:**
- Modify: `src/lib/data-dashboard.ts:397-399`
- Modify: `src/lib/data-finance.ts` (два запити `from("cash_registers")`)
- Modify: `src/app/api/ai-chat/route.ts:93-110`
- Test: `src/lib/utils/__tests__/finance.test.ts`

**Interfaces:**
- Consumes: `splitByKind` (Task 1)
- Produces: `DashboardMoney` отримує `cashOnHand: number` і `cashless: number` поруч із наявним `cashTotal`

- [ ] **Step 1: Написати падаючий тест на регресію**

Додати в `src/lib/utils/__tests__/finance.test.ts`:

```ts
  // Регресія: до цієї зміни «готівка» дорівнювала сумі всіх кас, тож картка
  // мовчки рахувалась готівкою. Тест фіксує саме поділ, а не суму.
  it("картка не потрапляє в готівку навіть коли вона найбільша", () => {
    const { cash, cashless, total } = splitByKind([
      { type: "tech", balance: 0 },
      { type: CASHLESS_REGISTER_TYPE, balance: 5000 },
    ]);
    expect(cash).toBe(0);
    expect(cashless).toBe(5000);
    expect(total).toBe(5000);
  });
```

- [ ] **Step 2: Запустити — має пройти одразу**

Run: `npx vitest run src/lib/utils/__tests__/finance.test.ts`
Expected: PASS (правило вже реалізоване в Task 1; тест закріплює його від регресій).

- [ ] **Step 3: Дашборд**

У `src/lib/data-dashboard.ts` замінити розрахунок `cashTotal`:

```ts
  const registerKinds = splitByKind(loaded.cashRegisters);
  const safesTotal = (safesRes.data ?? []).reduce((s, sf) => s + sf.balance, 0);

  // Сейфи — спільний котел: після розподілу картка в них уже невідрізнима
  // від готівки. Тому безготівкою вважається лише нерозподілене на рахунку.
  const cashless = registerKinds.cashless;
  const cashOnHand = registerKinds.cash + safesTotal;
  const cashTotal = cashOnHand + cashless;
```

Додати `cashOnHand` і `cashless` у `DashboardMoney` (поруч із `cashTotal`) і в обʼєкт, що повертається. Імпортувати `splitByKind`. `loaded.cashRegisters` має тягнути `type` — дописати його в `select("balance, id, name")`.

- [ ] **Step 4: Фінанси**

У `src/lib/data-finance.ts` переконатись, що обидва запити тягнуть `type` (перший використовує `select("*")` — уже тягне). У `src/app/admin/finance/page.tsx` замінити `const totalCash = cashRegisters.reduce(...)` на:

```ts
  const kinds = splitByKind(cashRegisters);
```

і використати `kinds.cash`, `kinds.cashless`, `kinds.total` замість `totalCash`.

- [ ] **Step 5: AI-копілот**

У `src/app/api/ai-chat/route.ts` замінити `registers.reduce((s, r) => s + r.balance, 0)` на `splitByKind(registers).cash` і додати рядок про безготівку в системний промпт, щоб модель не називала картку готівкою.

- [ ] **Step 6: Сторожовий тест проти обходу хелпера**

Створити `src/lib/__tests__/no-raw-register-sum.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Найімовірніший спосіб зламати розділення — підсумувати каси напряму в
 * новому місці й отримати картку в складі готівки. Помилка тиха: цифра
 * виглядає правдоподібно. Тест ловить саме форму запису.
 */
const GUARDED = [
  "src/lib/data-dashboard.ts",
  "src/lib/data-finance.ts",
  "src/app/admin/finance/page.tsx",
  "src/app/api/ai-chat/route.ts",
];

describe("баланси кас підсумовуються лише через splitByKind", () => {
  for (const file of GUARDED) {
    it(`${file} не складає balance напряму`, () => {
      const src = readFileSync(file, "utf8");
      // reduce, який додає c.balance/r.balance — саме той шаблон, що рахував
      // «готівку» до цієї зміни.
      const rawSum = /cashRegisters[\s\S]{0,40}reduce\([\s\S]{0,80}\.balance/g;
      expect(src.match(rawSum)).toBeNull();
    });
  }
});
```

- [ ] **Step 7: Запустити — має пройти після Steps 3-5**

Run: `npx vitest run src/lib/__tests__/no-raw-register-sum.test.ts`
Expected: PASS. Якщо падає — лишилось місце, де каси підсумовуються повз `splitByKind`; виправити його, а не послабити тест.

- [ ] **Step 8: Перевірити все**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: без помилок.

- [ ] **Step 9: Коміт**

```bash
git add src/lib/data-dashboard.ts src/lib/data-finance.ts src/app/admin/finance/page.tsx src/app/api/ai-chat/route.ts src/lib/utils/__tests__/finance.test.ts src/lib/__tests__/no-raw-register-sum.test.ts
git commit -m "fix(finance): готівка більше не дорівнює сумі кас"
```

---

### Task 7b: Розподіл «Безготівки» не ділиться на нуль

**Files:**
- Modify: `src/app/admin/finance/AddDistributionButton.tsx`

**Interfaces:**
- Consumes: `isCashless` (Task 1)
- Produces: жодного нового експорту

**Чому окремо:** «Безготівка» зʼявиться у списку кас автоматично — вона ж рядок `cash_registers`. Але модалка підставляє відсотки з `settings.distribution_<type>`, а запису `distribution_cashless` немає. Без цього кроку вибір рахунку дасть `undefined` у розрахунку й `NaN` у полях сум.

- [ ] **Step 1: Відтворити проблему**

Відкрити Фінанси → «Розподіл» → обрати «Безготівка».
Expected: поля OPEX / Growth / Чистий прибуток показують `NaN` або порожнечу.

- [ ] **Step 2: Підставляти нулі замість відсотків**

Знайти місце, де за типом обраної каси береться розподіл із налаштувань, і додати гілку:

```tsx
  // Для безготівки відсотків у налаштуваннях немає навмисно: власник обрав
  // ручний режим — скільки саме зняти з рахунку, вирішує він щоразу.
  const split = isCashless(selectedRegister?.type ?? "")
    ? { opex: 0, growth: 0, net_profit: 0 }
    : settings[`distribution_${selectedRegister?.type}` as keyof typeof settings];
```

- [ ] **Step 3: Підказка в модалці**

Коли обрано безготівку, показати під полями:

```tsx
        {isCashless(selectedRegister?.type ?? "") && (
          <p className="text-xs text-muted">
            Для безготівки відсотки не задані — впишіть суми вручну.
          </p>
        )}
```

- [ ] **Step 4: Перевірити**

Run: `npx tsc --noEmit && npm run build`
Expected: без помилок. Вручну: вибір «Безготівки» дає нулі, а не `NaN`; сума розподілу приймається.

- [ ] **Step 5: Коміт**

```bash
git add src/app/admin/finance/AddDistributionButton.tsx
git commit -m "fix(finance): розподіл безготівки не падає без відсотків у налаштуваннях"
```

---

### Task 8: Розбивка на екрані фінансів

**Files:**
- Modify: `src/app/admin/finance/page.tsx:43-47` (кольори), `:113-130` (список кас)

**Interfaces:**
- Consumes: `kinds` з Task 7, `isCashless` (Task 1)
- Produces: жодного нового експорту

- [ ] **Step 1: Додати колір для нового типу**

У мапі `crColors` (`finance/page.tsx:43`) додати запис — інакше картка візьме запасний колір і зіллється з рештою:

```ts
  const crColors: Record<string, string> = {
    tech: "var(--color-violet)",
    accessories: "var(--color-cyan)",
    repairs: "var(--color-amber)",
    cashless: "var(--color-emerald)",
  };
```

- [ ] **Step 2: Підсумок над списком кас**

Перед `<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">` зі списком кас додати:

```tsx
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="text-xs text-text-secondary">
                Готівкою <span className="font-mono font-bold text-text-primary">{kinds.cash.toLocaleString()} ₴</span>
              </span>
              <span className="text-xs text-text-secondary">
                Карткою <span className="font-mono font-bold text-text-primary">{kinds.cashless.toLocaleString()} ₴</span>
              </span>
              <span className="text-xs text-text-secondary">
                Разом <span className="font-mono font-bold text-text-primary">{kinds.total.toLocaleString()} ₴</span>
              </span>
            </div>
```

- [ ] **Step 3: Відрізнити картку рахунку від кас**

У циклі по `cashRegisters` замінити підпис `ПОТОЧНА КАСА` на умовний, щоб рахунок не читався як каса:

```tsx
                  <span className="font-mono text-[8px] uppercase tracking-wider text-text-muted">
                    {isCashless(cr.type) ? "БЕЗГОТІВКОВИЙ РАХУНОК" : "ПОТОЧНА КАСА"}
                  </span>
```

- [ ] **Step 4: Перевірити**

Run: `npx tsc --noEmit && npm run build`
Expected: без помилок.

- [ ] **Step 5: Коміт**

```bash
git add src/app/admin/finance/page.tsx
git commit -m "feat(finance): розбивка готівка/картка/разом на екрані фінансів"
```

---

### Task 9: Розбивка на дашборді

**Files:**
- Modify: `src/app/admin/CashCard.tsx`
- Modify: `src/app/admin/DashboardClient.tsx` (передача нових полів)
- Modify: `src/lib/data-dashboard.ts` (`todaySales` отримує розбивку)
- Modify: `src/app/admin/TodaySalesCard.tsx`

**Interfaces:**
- Consumes: `cashOnHand`, `cashless` з Task 7
- Produces: `DashboardMoney["todaySales"]` отримує `cashRevenue: number` і `cardRevenue: number`

- [ ] **Step 1: `CashCard` приймає два числа**

Розширити пропси й вивести під головною цифрою:

```tsx
export function CashCard({
  cashTotal,
  cashOnHand,
  cashless,
  runwayDays,
  dailyOpex,
}: {
  cashTotal: number;
  cashOnHand: number;
  cashless: number;
  runwayDays: number;
  dailyOpex: number;
}) {
```

і після головного `<p>` із `uah(cashTotal)`:

```tsx
      <p className="mt-1 text-xs text-muted">
        готівкою <span className="tabular text-ink">{uah(cashOnHand)}</span>
        {" · "}
        на карті <span className="tabular text-ink">{uah(cashless)}</span>
      </p>
```

- [ ] **Step 2: Прокинути пропси**

У `DashboardClient.tsx` до `<CashCard …>` додати `cashOnHand={money.cashOnHand}` і `cashless={money.cashless}`.

- [ ] **Step 3: Розбити виторг дня за методом**

У `data-dashboard.ts`, там де збирається `todaySales`, додати суми за методом із `payment_splits` тих самих чеків:

```ts
  // Лише продажі. Оплати ремонтів і аванси карткою сюди не входять — вони
  // живуть в інших картках, а повна картина по карті це баланс рахунку.
  const cardRevenue = todayReceipts.reduce(
    (s, r) => s + (r.payment_splits ?? []).filter((p) => p.method !== "cash").reduce((a, p) => a + p.amount, 0),
    0,
  );
  const cashRevenue = todaySalesRevenue - cardRevenue;
```

Додати `cashRevenue` і `cardRevenue` у тип `todaySales`. Селект чеків має тягнути `payment_splits(amount, method)`.

- [ ] **Step 4: Показати в картці продажів**

У `TodaySalesCard.tsx` під сумою виторгу:

```tsx
        {today.count > 0 && (
          <span className="text-xs text-muted">
            {uah(today.cashRevenue)} готівкою · {uah(today.cardRevenue)} карткою
          </span>
        )}
```

- [ ] **Step 5: Перевірити**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: без помилок.

- [ ] **Step 6: Коміт**

```bash
git add src/app/admin/CashCard.tsx src/app/admin/TodaySalesCard.tsx src/app/admin/DashboardClient.tsx src/lib/data-dashboard.ts
git commit -m "feat(dashboard): гроші та виторг дня розбиті на готівку й картку"
```

---

### Task 10: Метод у звітах і списку продажів

**Files:**
- Modify: `src/lib/data-sales.ts:193` (мапінг платежів)
- Modify: `src/app/admin/sales/` (колонка методу)
- Modify: `src/app/admin/reports/page.tsx`

**Interfaces:**
- Consumes: `payment_splits` (уже вантажаться в `data-sales.ts:103`)
- Produces: жодного нового експорту

- [ ] **Step 1: Колонка методу в списку чеків**

Додати помічник у `src/lib/utils/finance.ts` (поруч із рештою правил) і тест до нього:

```ts
/**
 * Підпис способу оплати для чека. Чек буває зі сплітом, тож методів може
 * бути кілька — тоді підписи зводяться в один без повторів.
 */
export function paymentMethodLabel(payments: { method: string }[]): string {
  if (payments.length === 0) return "—";
  const kinds = new Set(payments.map((p) => (p.method === "cash" ? "Готівка" : "Картка")));
  return [...kinds].join(" + ");
}
```

```ts
  it("paymentMethodLabel зводить методи чека без повторів", () => {
    expect(paymentMethodLabel([])).toBe("—");
    expect(paymentMethodLabel([{ method: "cash" }])).toBe("Готівка");
    expect(paymentMethodLabel([{ method: "card" }, { method: "transfer" }])).toBe("Картка");
    expect(paymentMethodLabel([{ method: "cash" }, { method: "card" }])).toBe("Готівка + Картка");
  });
```

Далі використати його в таблиці продажів як ще одну колонку між сумою й датою.

- [ ] **Step 2: Підсумки за методами у звітах**

У `src/app/admin/reports/page.tsx` порахувати з тих самих чеків, що вже вантажаться:

```tsx
  const cardRevenue = data.sales.reduce(
    (sum, s) =>
      sum + (s.payment_splits ?? [])
        .filter((p) => p.method !== "cash")
        .reduce((a, p) => a + p.amount, 0),
    0,
  );
  const cashRevenue = data.totalRevenue - cardRevenue;
```

і показати двома картками поруч із наявною «Виручка»:

```tsx
        <StandardCard>
          <h2 className="text-sm font-semibold text-text-primary text-balance tracking-tight">Готівкою</h2>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{cashRevenue.toLocaleString()} грн</p>
          <p className="mt-1 text-xs text-text-secondary">за весь період</p>
        </StandardCard>
        <StandardCard>
          <h2 className="text-sm font-semibold text-text-primary text-balance tracking-tight">Карткою</h2>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{cardRevenue.toLocaleString()} грн</p>
          <p className="mt-1 text-xs text-text-secondary">за весь період</p>
        </StandardCard>
```

Якщо `getReportsData` ще не тягне `payment_splits`, дописати їх у селект у `src/lib/data-reports.ts`.

- [ ] **Step 3: Перевірити**

Run: `npx tsc --noEmit && npm run build`
Expected: без помилок.

- [ ] **Step 4: Коміт**

```bash
git add src/lib/data-sales.ts src/app/admin/sales src/app/admin/reports/page.tsx
git commit -m "feat(reports): спосіб оплати в списку чеків і підсумках"
```

---

### Task 11: Виправити сьогоднішні 1300

**Files:**
- Немає змін у коді — три виклики RPC через MCP

**Interfaces:**
- Consumes: рахунок `cashless` (Task 2), наявний `transfer_funds`
- Produces: нічого

**Виконувати останнім:** доки код не розгорнуто, нові продажі карткою й далі йтимуть у касу, і корекцію довелося б повторювати.

- [ ] **Step 1: Зафіксувати стан ДО**

Викликати `execute_sql`:

```sql
select name, type, balance from safes
union all select name, type, balance from cash_registers
order by 2, 1;
```

Записати числа. Очікується: OPEX 4752, Growth 2799, Чистий прибуток 2579, Безготівка 0.

- [ ] **Step 2: Три перекази**

Отримати id рахунку безготівки й сейфів, потім викликати `transfer_funds` тричі через `execute_sql`. Суми: OPEX 520, Growth 390, Чистий прибуток 390.

```sql
select public.transfer_funds(
  (select id from safes where type = 'opex'), 'safe',
  (select id from cash_registers where type = 'cashless'), 'cash_register',
  520,
  'Корекція: оплата карткою 1300 ₴ від 28.07 помилково розподілена як готівка',
  (select id from profiles where role = 'owner' limit 1)
);
```

Повторити для `growth` (390) і `net_profit` (390) з тим самим описом.

- [ ] **Step 3: Перевірити стан ПІСЛЯ**

Той самий запит зі Step 1.
Expected: OPEX 4232, Growth 2409, Чистий прибуток 2189, Безготівка 1300. Сума всіх контейнерів — 10130, як і до корекції.

- [ ] **Step 4: Перевірити, що корекція лишила слід**

```sql
select created_at, amount, description from transactions
where description ilike 'Корекція:%' order by created_at;
```

Expected: три рядки на 520, 390, 390.

- [ ] **Step 5: Коміт запису про корекцію**

```bash
cat >> docs/superpowers/specs/2026-07-28-cash-card-split-design.md <<'MD'

## Виконано

Корекція 1300 застосована: OPEX −520, Growth −390, ЧП −390, «Безготівка» +1300.
Сума контейнерів не змінилась (10130). Три рядки в `transactions` з описом
«Корекція: …».
MD
git add docs/superpowers/specs/2026-07-28-cash-card-split-design.md
git commit -m "docs: зафіксовано виконану корекцію 1300"
```

---

## Порядок і залежності

```
Task 1 (правила) ─┬─> Task 4 (продажі)
                  ├─> Task 5 (ремонти)
                  ├─> Task 6 (аванси)
                  ├─> Task 7 (читачі) ─┬─> Task 7b (розподіл)
                  │                    ├─> Task 8 (фінанси UI)
                  │                    └─> Task 9 (дашборд UI)
                  └─> Task 10 (звіти)
Task 2 (рахунок) ──> Task 3 (quick sale RPC) ──> Task 4
Task 11 (корекція) — тільки після розгортання Tasks 1–10
```

Task 2 варто робити одразу після Task 1: доки рядка «Безготівка» немає, усі
маршрутизаційні завдання не мають куди слати гроші.
