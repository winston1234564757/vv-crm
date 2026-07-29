# Розділення готівки й безготівки в сейфах — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кожен сейф знає, скільки в ньому готівки й скільки безготівки, і не дає списати те, чого немає.

**Architecture:** Два лічильники на `safes` плюс одна SQL-функція `safe_apply`, яка тримає все правило: яку половину чіпати і коли відмовити. Одинадцять функцій, що рухають гроші, викликають її замість того, щоб самим чіпати `balance` — так правило живе в одному місці, а не в одинадцяти копіях. `CHECK` вмикається останнім кроком.

**Tech Stack:** Supabase Postgres (plpgsql), Next.js 16 Server Actions, TypeScript, Vitest.

**Спека:** `docs/superpowers/specs/2026-07-29-safe-cash-cashless-split-design.md`

## Global Constraints

- Значення способу оплати — рівно `'cash'` або `'cashless'`. Ніяких `card`, `готівка`, `NULL` у нових записах.
- **`CHECK (balance = balance_cash + balance_cashless)` додається ЛИШЕ в Task 12.** Раніше — заборонено: він вб'є кожну ще не оновлену функцію й зупинить прийом грошей.
- Функції патчаться з їхнього ж живого визначення (`pg_get_functiondef` + точкові `replace` + перевірка, що заміна спрацювала), а не переписуються вручну.
- **Додавання параметра створює перевантаження, а не заміну.** Кожна така міграція мусить спершу `drop function if exists public.<name>(<стара сигнатура>)`, інакше старі виклики стануть неоднозначними й упадуть із `function is not unique`.
- Міграції — через Supabase MCP `apply_migration`; копія кожної кладеться в `supabase/migrations/`.
- `src/types/database.ts` **не регенерувати** — це ламає `@ts-expect-error` на RPC. Нові поля дописувати вручну.
- Мова коментарів і повідомлень — українська.
- Кожне завдання завершується `npx tsc --noEmit` без помилок і `npx vitest run` без падінь.

---

## Структура файлів

| Файл | Відповідальність |
|---|---|
| міграція `safe_halves_columns` | Дві колонки + засипка, без CHECK |
| міграція `safe_apply_helper` | Єдине правило: яка половина, і коли відмовити |
| міграції `safe_halves_fn_*` | Одинадцять функцій переводяться на хелпер |
| міграція `safe_halves_check` | CHECK + звірка, останнім кроком |
| `src/lib/actions/finance.ts` | Спосіб оплати у витраті, поповненні, вилученні частки |
| `src/lib/actions/parts.ts`, `accessories.ts`, `devices.ts`, `purchases.ts` | Спосіб оплати в закупівлях |
| `src/components/ui/PaymentMethodPicker.tsx` | Спільний вибір «Готівкою / Карткою» для шести форм |
| `ExpenseForm`, `TopUpForm`, `WithdrawShareForm`, `TransferForm`, `AccessoryForm`, `PartForm`, форма оплати закупівлі | Вставляють цей компонент |

---

## Два розходження зі спекою — свідомі

**Форм не чотири, а сім.** Спека називала витрату, закупівлю інвентаря,
поповнення сейфа й вилучення частки. Але параметр способу оплати додається ще
до `transfer_funds`, `register_device_purchase`, `register_part_purchase` і
`pay_purchase_atomic` — отже їхні форми теж мусять його передавати, інакше
виклик впаде. Перелік у спеці був неповний; правильний — сім форм, усі через
спільний `PaymentMethodPicker`.

**Перевірки ручні, а не автоматичні.** У спеці є розділ «Тести», але в проєкті
немає жодного способуганяти plpgsql із Vitest — тести там покривають лише
TypeScript. Тому кожне завдання перевіряється SQL-запитом на живій базі, і в
кроках це записано явно. Видавати ручну звірку за автотест було б брехнею; тут
вона чесно ручна, зате виконується на тих самих даних, якими користується
магазин.

Наслідок для виконавця: `npx vitest run` тут нічого не доводить про гроші. Він
лише підтверджує, що TypeScript не зламався. Докази правильності — у SQL-кроках.

---

### Task 1: Дві половини на сейфі, без перевірки

**Files:**
- Create: міграція `safe_halves_columns`, копія в `supabase/migrations/20260729120000_safe_halves_columns.sql`

**Interfaces:**
- Consumes: нічого
- Produces: `safes.balance_cash`, `safes.balance_cashless` (обидва `integer not null default 0`)

- [ ] **Step 1: Зафіксувати стан ДО**

Викликати `mcp__supabase__execute_sql`:

```sql
select name, balance from safes order by name;
```

Записати числа у звіт. Очікується приблизно: Growth 509, OPEX 4232, Чистий прибуток 2110 (могло зрушити — важливий сам факт, що записали).

- [ ] **Step 2: Колонки й засипка**

`apply_migration`, name `safe_halves_columns`:

```sql
-- Дві половини балансу сейфа. `balance` лишається сумою і НЕ стає
-- обчислюваною колонкою: усі одинадцять функцій пишуть у нього напряму, і
-- генерована колонка зламала б їх усі одночасно.
alter table public.safes
  add column if not exists balance_cash integer not null default 0,
  add column if not exists balance_cashless integer not null default 0;

comment on column public.safes.balance_cash is 'Готівкова частина балансу.';
comment on column public.safes.balance_cashless is 'Безготівкова частина балансу (картка, переказ).';

-- Засипка перевірена по реєстру, а не вгадана: за весь час у сейфи зайшло
-- рівно одне безготівкове надходження — 550 грн у Growth, і рівно ці 550
-- пішли карткою на акумулятор Samsung S22. Тобто вся поточна сума в сейфах
-- готівкова.
update public.safes set balance_cash = balance, balance_cashless = 0;
```

**CHECK тут НЕ додавати.** Він у Task 12.

- [ ] **Step 3: Перевірити засипку**

```sql
select name, balance, balance_cash, balance_cashless,
       balance - balance_cash - balance_cashless as diff
from safes order by name;
```

Expected: `diff = 0` у всіх рядках, `balance_cashless = 0` у всіх.

- [ ] **Step 4: Переконатись, що нічого не зламалось**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: без помилок. Стара логіка працює як раніше — лічильники просто не рухаються.

- [ ] **Step 5: Коміт**

```bash
cat > supabase/migrations/20260729120000_safe_halves_columns.sql <<'SQL'
alter table public.safes
  add column if not exists balance_cash integer not null default 0,
  add column if not exists balance_cashless integer not null default 0;

update public.safes set balance_cash = balance, balance_cashless = 0;
SQL
git add supabase/migrations/20260729120000_safe_halves_columns.sql
git commit -m "feat(finance): дві половини балансу на сейфі, поки без перевірки"
```

---

### Task 2: `safe_apply` — єдине правило

**Files:**
- Create: міграція `safe_apply_helper`, копія в `supabase/migrations/20260729120100_safe_apply_helper.sql`

**Interfaces:**
- Consumes: колонки з Task 1
- Produces: `public.safe_apply(p_safe_id uuid, p_amount integer, p_method text) returns void`
  - `p_amount > 0` — покласти, `< 0` — зняти
  - `p_method` — `'cash'` або `'cashless'`
  - кидає виняток, якщо потрібної половини бракує

**Чому окремою функцією:** одинадцять функцій мали б інакше одинадцять копій правила «яка половина і коли відмовити». Саме так у цьому проєкті колись розійшовся `EARNED_REPAIR_STATUSES`. Одне місце — одна поведінка, і повідомлення про нестачу теж одне.

- [ ] **Step 1: Створити хелпер**

`apply_migration`, name `safe_apply_helper`:

```sql
create or replace function public.safe_apply(
  p_safe_id uuid,
  p_amount integer,
  p_method text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_half integer;
  v_name text;
begin
  if p_method not in ('cash', 'cashless') then
    raise exception 'Невідомий спосіб оплати: %', p_method;
  end if;

  if p_amount = 0 then
    return;
  end if;

  select name, case when p_method = 'cash' then balance_cash else balance_cashless end
    into v_name, v_half
  from public.safes where id = p_safe_id for update;

  if not found then
    raise exception 'Сейф не знайдено';
  end if;

  -- Нестачі не буває мовчки. Повідомлення називає обидва числа, бо власнику
  -- треба знати не лише що бракує, а скільки саме перекласти.
  if p_amount < 0 and v_half < abs(p_amount) then
    raise exception 'У сейфі «%» лише % грн %, а списати треба % грн',
      v_name, v_half,
      case when p_method = 'cash' then 'готівкою' else 'безготівкою' end,
      abs(p_amount);
  end if;

  update public.safes
  set balance = balance + p_amount,
      balance_cash = balance_cash + case when p_method = 'cash' then p_amount else 0 end,
      balance_cashless = balance_cashless + case when p_method = 'cashless' then p_amount else 0 end,
      updated_at = now()
  where id = p_safe_id;
end;
$function$;

revoke execute on function public.safe_apply(uuid, integer, text) from anon;
```

- [ ] **Step 2: Перевірити на живому сейфі — покласти й одразу зняти**

```sql
select public.safe_apply((select id from safes where type='opex'), 100, 'cashless');
select name, balance, balance_cash, balance_cashless from safes where type='opex';
select public.safe_apply((select id from safes where type='opex'), -100, 'cashless');
select name, balance, balance_cash, balance_cashless from safes where type='opex';
```

Expected: після першого — `balance_cashless = 100`, `balance` більший на 100. Після другого — обидва повернулись до вихідних.

- [ ] **Step 3: Перевірити відмову**

```sql
select public.safe_apply((select id from safes where type='opex'), -999999, 'cashless');
```

Expected: помилка з текстом «У сейфі «OPEX» лише 0 грн безготівкою, а списати треба 999999 грн». Баланси не змінились — перевірити тим самим select.

- [ ] **Step 4: Коміт**

```bash
cat > supabase/migrations/20260729120100_safe_apply_helper.sql <<'SQL'
-- (повний текст функції зі Step 1)
SQL
git add supabase/migrations/20260729120100_safe_apply_helper.sql
git commit -m "feat(finance): safe_apply — одне правило половин і відмови"
```

---

### Task 3: Розподіл виводить половину з типу каси

**Files:**
- Create: міграція `safe_halves_fn_distribute`

**Interfaces:**
- Consumes: `safe_apply` (Task 2)
- Produces: `distribute_register_funds` із **незмінною** сигнатурою

**Параметра не додаємо:** половину визначає тип каси-джерела. `cashless` → безготівкова, будь-яка інша → готівкова. Сигнатура лишається, тож TS-виклик не чіпаємо.

- [ ] **Step 1: Прочитати живе визначення**

```sql
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='distribute_register_funds';
```

- [ ] **Step 2: Патч**

`apply_migration`, name `safe_halves_fn_distribute`. Тіло — `do $$ ... $$` блок, який бере визначення, робить точкові заміни й перевіряє, що вони спрацювали:

```sql
do $$
declare def text; patched text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='distribute_register_funds';
  if def is null then raise exception 'distribute_register_funds не знайдено'; end if;

  patched := def;

  -- Оголосити змінну під спосіб, виведений із типу каси.
  patched := replace(patched, 'DECLARE', 'DECLARE' || chr(10) || '  v_method text;');

  -- Кожен UPDATE safes ... balance = balance + N замінюємо викликом хелпера.
  -- Точні рядки взяти з визначення зі Step 1 — вони різні для трьох сейфів.
  if patched = def then
    raise exception 'Патч distribute_register_funds не застосувався';
  end if;

  execute patched;
end $$;
```

Конкретні заміни залежать від тексту функції. Правило: перед першим рухом грошей вставити

```sql
  select case when type = 'cashless' then 'cashless' else 'cash' end into v_method
  from public.cash_registers where id = cash_register_id;
```

а кожен `UPDATE public.safes SET balance = balance + X WHERE id = Y` замінити на
`PERFORM public.safe_apply(Y, X, v_method);`

- [ ] **Step 3: Перевірити на живих даних**

```sql
select id, name, balance, balance_cash, balance_cashless from cash_registers, safes limit 0;
select name, balance, balance_cash, balance_cashless from safes order by name;
```

Записати стан. Потім через інтерфейс зробити розподіл із «Безготівки» на 100 грн і повторити select.
Expected: `balance_cashless` цільового сейфа виріс на 100, `balance_cash` не змінився.

- [ ] **Step 4: Коміт**

```bash
git add supabase/migrations/20260729120200_safe_halves_fn_distribute.sql
git commit -m "feat(finance): розподіл кладе в ту половину, з якої взяв"
```

---

### Task 4: Спосіб оплати у витраті

**Files:**
- Create: міграція `safe_halves_fn_expense`
- Modify: `src/lib/actions/finance.ts` (`createExpenseAction`), `src/components/forms/ExpenseForm.tsx`

**Interfaces:**
- Consumes: `safe_apply` (Task 2)
- Produces:
  - `create_expense(category_id uuid, amount integer, paid_from_safe_id uuid, description text, user_id uuid, payment_method text)` — параметр доданий **останнім**
  - `PaymentMethodPicker` із `src/components/ui/PaymentMethodPicker.tsx` — приймає `name`, `label`, `defaultValue`, шле приховане поле `payment_method` зі значенням `cash` або `cashless`. Наступні завдання використовують саме його, а не пишуть кнопки заново.

- [ ] **Step 1: Замінити функцію, знявши стару сигнатуру**

`apply_migration`, name `safe_halves_fn_expense`:

```sql
-- Спершу знімаємо стару сигнатуру. Без цього CREATE з новим параметром
-- створить ПЕРЕВАНТАЖЕННЯ, і наявний виклик із п'ятьма аргументами стане
-- неоднозначним: «function public.create_expense(...) is not unique».
drop function if exists public.create_expense(uuid, integer, uuid, text, uuid);
```

далі — `create or replace function public.create_expense(category_id uuid, amount integer, paid_from_safe_id uuid, description text, user_id uuid, payment_method text)` з тілом старої функції, у якому:

- `UPDATE public.safes SET balance = balance - amount WHERE id = paid_from_safe_id;` замінено на `PERFORM public.safe_apply(paid_from_safe_id, -amount, payment_method);`
- у `INSERT INTO public.transactions (...)` додано колонку `payment_method` зі значенням параметра.

- [ ] **Step 2: Оновити виклик і схему в дії**

У `src/lib/actions/finance.ts`, у схемі витрати:

```ts
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
```

у збірці `data` з `formData`:

```ts
      payment_method: formData.get("payment_method") || "cash",
```

і в виклику RPC додати `payment_method: parsed.payment_method`.

- [ ] **Step 3: Спільний вибір способу оплати**

Створити `src/components/ui/PaymentMethodPicker.tsx`. Компонент спільний, бо
той самий вибір потрібен у шести формах — шість копій розійшлися б у підписах
і в тому, яке значення шлють на сервер.

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Вибір способу оплати для операцій, що рухають гроші сейфа.
 *
 * Значення шлеться прихованим полем, а не станом форми: усі ці форми —
 * серверні дії з `FormData`, і поле має приїхати разом із рештою.
 */
export function PaymentMethodPicker({
  name = "payment_method",
  label = "Чим заплачено",
  defaultValue = "cash",
}: {
  name?: string;
  label?: string;
  defaultValue?: "cash" | "cashless";
}) {
  const [method, setMethod] = useState<"cash" | "cashless">(defaultValue);

  return (
    <div>
      <p className="mb-1.5 block text-xs font-medium text-muted">{label}</p>
      <input type="hidden" name={name} value={method} />
      <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
        {([
          { key: "cash", label: "Готівкою" },
          { key: "cashless", label: "Карткою" },
        ] as const).map((o) => (
          <Button
            key={o.key}
            type="button"
            variant={method === o.key ? "primary" : "secondary"}
            aria-pressed={method === o.key}
            onClick={() => setMethod(o.key)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

Далі в `src/components/forms/ExpenseForm.tsx`, під полем суми:

```tsx
      <PaymentMethodPicker />
```

з імпортом `import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";`

- [ ] **Step 4: Перевірити відмову наскрізь**

Через інтерфейс створити витрату карткою на суму, більшу за безготівкову половину обраного сейфа.
Expected: у формі зʼявляється повідомлення «У сейфі «…» лише X грн безготівкою, а списати треба Y грн». Баланси не змінились — перевірити `select name, balance, balance_cash, balance_cashless from safes`.

- [ ] **Step 5: Перевірити код і зібрати**

Run: `npx tsc --noEmit && npx vitest run && npm run build`

- [ ] **Step 6: Коміт**

```bash
git add supabase/migrations/20260729120300_safe_halves_fn_expense.sql src/lib/actions/finance.ts src/components/forms/ExpenseForm.tsx
git commit -m "feat(finance): витрата фіксує, чим заплачено, і списує з тієї половини"
```

---

### Task 5: Закупівля запчастини й аксесуара

**Files:**
- Create: міграція `safe_halves_fn_purchase_inventory`
- Modify: `src/lib/actions/parts.ts`, `src/lib/actions/accessories.ts`, і форми, звідки вони викликаються

**Interfaces:**
- Consumes: `safe_apply` (Task 2)
- Produces: `purchase_inventory_item(item_type text, item_id uuid, safe_id uuid, amount integer, description text, user_id uuid, payment_method text)`

Це шлях, яким пройшла закупівля акумулятора Samsung S22 на 550 грн карткою — `reference_type = 'inventory'`.

- [ ] **Step 1: Замінити функцію**

```sql
drop function if exists public.purchase_inventory_item(text, uuid, uuid, integer, text, uuid);
```

далі `create or replace` з новим параметром `payment_method text` останнім, у тілі:
`UPDATE public.safes SET balance = balance - amount ...` → `PERFORM public.safe_apply(safe_id, -amount, payment_method);`, і `payment_method` дописаний у `INSERT INTO public.transactions`.

- [ ] **Step 2: Оновити обидва виклики**

У `src/lib/actions/accessories.ts` (`createAccessory`, ~рядок 120) і в `src/lib/actions/parts.ts` додати до `supabase.rpc("purchase_inventory_item", {...})` поле `payment_method: parsed.payment_method`, а до схем — те саме поле, що в Task 4:

```ts
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
```

- [ ] **Step 3: Вибір способу у формах**

У `src/components/forms/AccessoryForm.tsx` і `src/components/forms/PartForm.tsx`, поруч із вибором сейфа:

```tsx
      <PaymentMethodPicker />
```

з імпортом `import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";`
Компонент створено в Task 4; він сам тримає стан і шле приховане поле `payment_method`.

- [ ] **Step 4: Перевірити**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Через інтерфейс завести аксесуар із собівартістю, оплативши карткою, і перевірити, що впала саме безготівкова половина.

- [ ] **Step 5: Коміт**

```bash
git add supabase/migrations/20260729120400_safe_halves_fn_purchase_inventory.sql src/lib/actions/accessories.ts src/lib/actions/parts.ts src/components/forms/AccessoryForm.tsx src/components/forms/PartForm.tsx
git commit -m "feat(finance): закупівля запчастин і аксесуарів фіксує спосіб оплати"
```

---

### Task 6: Переказ між сейфами

**Files:**
- Create: міграція `safe_halves_fn_transfer`
- Modify: `src/lib/actions/finance.ts` (`createTransfer`), `src/components/forms/TransferForm.tsx`

**Interfaces:**
- Consumes: `safe_apply` (Task 2)
- Produces: `transfer_funds(from_id uuid, from_type text, to_id uuid, to_type text, amount integer, desc_text text, user_id uuid, payment_method text)`

- [ ] **Step 1: Замінити функцію**

```sql
drop function if exists public.transfer_funds(uuid, text, uuid, text, integer, text, uuid);
```

далі `create or replace` з `payment_method text` останнім. У тілі кожен рух по сейфу (і на боці джерела, і на боці одержувача) замінюється на `PERFORM public.safe_apply(<id>, <±amount>, payment_method);`. Рухи по касах лишаються як були — у кас половин немає.

- [ ] **Step 2: Оновити дію і форму**

У `src/lib/actions/finance.ts` до `transferSchema` додати `payment_method: z.enum(["cash", "cashless"]).optional().default("cash")`, прочитати з `formData`, передати в RPC. У `TransferForm.tsx` вставити `<PaymentMethodPicker />` (імпорт із `@/components/ui/PaymentMethodPicker`), показаний лише коли джерело або одержувач є сейфом — у кас половин немає.

- [ ] **Step 3: Перевірити**

Run: `npx tsc --noEmit && npx vitest run && npm run build`

- [ ] **Step 4: Коміт**

```bash
git add supabase/migrations/20260729120500_safe_halves_fn_transfer.sql src/lib/actions/finance.ts src/components/forms/TransferForm.tsx
git commit -m "feat(finance): переказ рухає ту половину, яку вказали"
```

---

### Task 7: Поповнення сейфа

**Files:**
- Create: міграція `safe_halves_fn_topup`
- Modify: `src/lib/actions/finance.ts`, `src/components/forms/TopUpForm.tsx`

**Interfaces:**
- Consumes: `safe_apply` (Task 2)
- Produces: `top_up_safe(p_safe_id uuid, p_amount integer, p_desc_text text, p_user_id uuid, p_payment_method text)`

- [ ] **Step 1: Замінити функцію**

```sql
drop function if exists public.top_up_safe(uuid, integer, text, uuid);
```

далі `create or replace` з `p_payment_method text` останнім; рух по сейфу → `PERFORM public.safe_apply(p_safe_id, p_amount, p_payment_method);`, `payment_method` дописаний у транзакцію.

- [ ] **Step 2: Дія і форма**

Те саме поле в схемі й те саме читання з `formData`, що у витраті. У `TopUpForm.tsx` вставити `<PaymentMethodPicker label="Чим поповнено" />` з імпортом із `@/components/ui/PaymentMethodPicker`.

- [ ] **Step 3: Перевірити**

Run: `npx tsc --noEmit && npx vitest run && npm run build`

- [ ] **Step 4: Коміт**

```bash
git add supabase/migrations/20260729120600_safe_halves_fn_topup.sql src/lib/actions/finance.ts src/components/forms/TopUpForm.tsx
git commit -m "feat(finance): поповнення сейфа фіксує, чим саме поповнили"
```

---

### Task 8: Вилучення частки власника

**Files:**
- Create: міграція `safe_halves_fn_withdraw`
- Modify: `src/lib/actions/finance.ts`, `src/components/forms/WithdrawShareForm.tsx`

**Interfaces:**
- Consumes: `safe_apply` (Task 2)
- Produces: `withdraw_owner_share(source_type text, source_id uuid, amount numeric, desc_text text, user_id uuid, payment_method text)`

Увага: `amount` тут `numeric`, а `safe_apply` приймає `integer` — при виклику округлити: `public.safe_apply(source_id, -round(amount)::integer, payment_method)`.

- [ ] **Step 1: Замінити функцію**

```sql
drop function if exists public.withdraw_owner_share(text, uuid, numeric, text, uuid);
```

далі `create or replace` з `payment_method text` останнім; рух по сейфу → `PERFORM public.safe_apply(source_id, -round(amount)::integer, payment_method);`.

- [ ] **Step 2: Дія і форма**

Те саме поле й те саме читання, що у витраті. У `WithdrawShareForm.tsx` вставити `<PaymentMethodPicker label="Чим забрано" />` з імпортом із `@/components/ui/PaymentMethodPicker`.

- [ ] **Step 3: Перевірити**

Run: `npx tsc --noEmit && npx vitest run && npm run build`

- [ ] **Step 4: Коміт**

```bash
git add supabase/migrations/20260729120700_safe_halves_fn_withdraw.sql src/lib/actions/finance.ts src/components/forms/WithdrawShareForm.tsx
git commit -m "feat(finance): вилучення частки фіксує, чим саме забрали"
```

---

### Task 9: Закупівля техніки й запчастини через реєстрацію

**Files:**
- Create: міграція `safe_halves_fn_register_purchases`
- Modify: `src/lib/actions/devices.ts`, `src/lib/actions/parts.ts`, `src/components/forms/device/DeviceFormMain.tsx`, `src/components/forms/PartForm.tsx`

**Interfaces:**
- Consumes: `safe_apply` (Task 2)
- Produces: `register_device_purchase(... p_safe_id uuid, p_user_id uuid, p_payment_method text)` і `register_part_purchase(... p_safe_id uuid, p_user_id uuid, p_payment_method text)` — параметр доданий останнім у обох

Обидві функції мають довгі сигнатури (33 і 16 параметрів). Повний перелік типів для `drop function` брати з:

```sql
select pg_get_function_identity_arguments(p.oid) from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('register_device_purchase','register_part_purchase');
```

- [ ] **Step 1: Зняти старі сигнатури й замінити обидві функції**

`drop function if exists public.register_device_purchase(<точний перелік зі select вище>);` — те саме для `register_part_purchase`. Далі `create or replace` з доданим `p_payment_method text`, рух по сейфу → `PERFORM public.safe_apply(p_safe_id, -<сума>, p_payment_method);`.

- [ ] **Step 2: Оновити виклики й форми**

У `src/lib/actions/devices.ts` і `src/lib/actions/parts.ts` додати поле до схеми й до виклику RPC. У формах поруч із вибором сейфа вставити `<PaymentMethodPicker />` з імпортом із `@/components/ui/PaymentMethodPicker`.

- [ ] **Step 3: Перевірити**

Run: `npx tsc --noEmit && npx vitest run && npm run build`

- [ ] **Step 4: Коміт**

```bash
git add supabase/migrations/20260729120800_safe_halves_fn_register_purchases.sql src/lib/actions/devices.ts src/lib/actions/parts.ts src/components/forms/device/DeviceFormMain.tsx src/components/forms/PartForm.tsx
git commit -m "feat(finance): реєстрація закупівлі техніки й запчастин фіксує спосіб оплати"
```

---

### Task 10: Оплата закупівлі

**Files:**
- Create: міграція `safe_halves_fn_pay_purchase`
- Modify: `src/lib/actions/purchases.ts`, форма оплати закупівлі

**Interfaces:**
- Consumes: `safe_apply` (Task 2)
- Produces: `pay_purchase_atomic(p_id uuid, p_safe_id uuid, user_id uuid, p_payment_method text)`

Таблиця `purchases` має власне поле `payment_type`, але воно порожнє (рядків немає) і означає інше — умови оплати, не спосіб. Не використовувати його; спосіб іде окремим параметром і в `transactions.payment_method`.

- [ ] **Step 1: Замінити функцію**

```sql
drop function if exists public.pay_purchase_atomic(uuid, uuid, uuid);
```

далі `create or replace` з `p_payment_method text` останнім; рух по сейфу → `PERFORM public.safe_apply(p_safe_id, -<сума>, p_payment_method);`.

- [ ] **Step 2: Оновити виклик і форму**

Те саме поле в схемі `src/lib/actions/purchases.ts`. У формі оплати закупівлі вставити `<PaymentMethodPicker />` з імпортом із `@/components/ui/PaymentMethodPicker`.

- [ ] **Step 3: Перевірити**

Run: `npx tsc --noEmit && npx vitest run && npm run build`

- [ ] **Step 4: Коміт**

```bash
git add supabase/migrations/20260729120900_safe_halves_fn_pay_purchase.sql src/lib/actions/purchases.ts
git commit -m "feat(finance): оплата закупівлі фіксує спосіб оплати"
```

---

### Task 11: Скасування повертає ту саму половину

**Files:**
- Create: міграція `safe_halves_fn_reversals`

**Interfaces:**
- Consumes: `safe_apply` (Task 2), `transactions.payment_method`
- Produces: `delete_transaction` і `handle_inventory_item_deletion` із **незмінними** сигнатурами

**Параметра не додаємо:** обидві функції скасовують уже записану операцію, тож спосіб читають із самої транзакції. `NULL` (історія до 29.07) трактуємо як `'cash'` — уся вона справді готівкова, це перевірено по реєстру в спеці.

- [ ] **Step 1: Замінити обидві функції**

`apply_migration`, name `safe_halves_fn_reversals`. У `delete_transaction` перед рухом по сейфу додати:

```sql
  v_method := coalesce(v_tx.payment_method, 'cash');
```

і кожен `UPDATE public.safes SET balance = balance ± ...` замінити на `PERFORM public.safe_apply(<id>, <±сума>, v_method);`.

У `handle_inventory_item_deletion` (тригер без аргументів) спосіб брати з транзакції, що скасовується:

```sql
  select coalesce(payment_method, 'cash') into v_method
  from public.transactions
  where reference_type = 'inventory' and reference_id = old.id
  order by created_at desc limit 1;
```

- [ ] **Step 2: Перевірити на живих даних**

Створити витрату карткою на 100 грн, записати баланси, видалити транзакцію, порівняти.
Expected: `balance_cashless` повернувся до вихідного, `balance_cash` не змінювався.

- [ ] **Step 3: Коміт**

```bash
git add supabase/migrations/20260729121000_safe_halves_fn_reversals.sql
git commit -m "feat(finance): скасування повертає гроші в ту половину, з якої брали"
```

---

### Task 12: Вмикаємо перевірку

**Files:**
- Create: міграція `safe_halves_check`

**Interfaces:**
- Consumes: усі попередні завдання
- Produces: `CHECK (balance = balance_cash + balance_cashless)` на `safes`

**Тільки після Tasks 1–11.** Раніше перевірка вб'є кожну ще не оновлену функцію.

- [ ] **Step 1: Звірити ПЕРЕД вмиканням**

```sql
select name, balance, balance_cash, balance_cashless,
       balance - balance_cash - balance_cashless as diff
from safes order by name;
```

Expected: `diff = 0` у всіх рядках. **Якщо ні — зупинитись.** Ненульова різниця означає, що якась функція лишилась стара; знайти її й доробити, а не вмикати перевірку.

- [ ] **Step 2: Знайти функції, які досі пишуть у `balance` напряму**

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f'
  and pg_get_functiondef(p.oid) ~* 'update\s+(public\.)?safes'
  and pg_get_functiondef(p.oid) !~* 'safe_apply'
order by 1;
```

Expected: порожньо. Кожен рядок тут — функція, яка впаде одразу після Step 3.

- [ ] **Step 3: Увімкнути перевірку**

```sql
alter table public.safes drop constraint if exists safes_balance_halves_check;
alter table public.safes add constraint safes_balance_halves_check
  check (balance = balance_cash + balance_cashless);
```

- [ ] **Step 4: Прогнати наскрізний сценарій**

Через інтерфейс по черзі: розподіл із каси, розподіл із «Безготівки», витрата готівкою, витрата карткою, поповнення сейфа, переказ між сейфами, вилучення частки.
Expected: жодна операція не падає; після кожної `diff = 0`.

- [ ] **Step 5: Коміт**

```bash
git add supabase/migrations/20260729121100_safe_halves_check.sql
git commit -m "feat(finance): інваріант половин під захистом перевірки"
```

---

## Порядок і залежності

```
Task 1 (колонки, БЕЗ check)
   └─> Task 2 (safe_apply) ─┬─> Task 3  розподіл
                            ├─> Task 4  витрата
                            ├─> Task 5  закупівля інвентаря
                            ├─> Task 6  переказ
                            ├─> Task 7  поповнення
                            ├─> Task 8  вилучення частки
                            ├─> Task 9  реєстрація закупівель
                            ├─> Task 10 оплата закупівлі
                            └─> Task 11 скасування
                                          └─> Task 12 (CHECK) ← лише після ВСІХ
```

Tasks 3–11 незалежні між собою й можуть іти в будь-якому порядку. Task 12 —
тільки коли жодної старої функції не лишилось, і це перевіряється запитом у
його Step 2, а не памʼяттю.
