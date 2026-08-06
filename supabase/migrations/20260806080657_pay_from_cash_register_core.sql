-- Платити напряму з рахунку, без переказу в сейф.
--
-- Кожна функція, що витрачає гроші, приймала лише `p_safe_id`. На рахунку
-- «Безготівка» лежали гроші, які не можна було витратити: спершу переказ у
-- сейф, потім оплата з його безготівкової половини. Два записи в реєстрі там,
-- де подія одна.
--
-- Джерелом стає пара (тип, id), а всю перевірку бере на себе `account_apply`.
-- Перевірка сейфа була в кожній функції своя, з власним текстом помилки —
-- п'ять копій одного правила, які вже почали розходитись.

-- ── 1. Каса не може піти в мінус ────────────────────────────────────────────
-- Сейфи отримали цей CHECK 03.08, каси — ні: з них ніхто не платив, і питання
-- не стояло. Тепер стоїть. Без гарду списання 10 000 з каси на 5 250 лишило б
-- −4 750 і жодної помилки.
--
-- НАСЛІДОК, про який треба знати: повернення продажу, оплаченого карткою, тепер
-- впаде, якщо рахунок уже вичищено в сейфи. Раніше воно мовчки заганяло касу в
-- мінус. Гучна відмова краща за тихий мінус, але поведінка змінилась.
alter table public.cash_registers
  drop constraint if exists cash_registers_balance_non_negative;
alter table public.cash_registers
  add constraint cash_registers_balance_non_negative check (balance >= 0);

-- ── 2. Витрату є куди записати ──────────────────────────────────────────────
-- `expenses.paid_from_safe_id` був NOT NULL із FK на `safes`: витрату з каси
-- фізично нікуди було покласти.
alter table public.expenses
  add column if not exists paid_from_register_id uuid references public.cash_registers(id) on delete restrict;
alter table public.expenses
  alter column paid_from_safe_id drop not null;
alter table public.expenses
  drop constraint if exists expenses_one_payment_source;
alter table public.expenses
  add constraint expenses_one_payment_source
  check (num_nonnulls(paid_from_safe_id, paid_from_register_id) = 1);

-- Закупівлі: `paid_from_safe_id` уже nullable (неоплачені закупівлі його не
-- мають), тож XOR тут поставити не можна — він забракував би саме їх.
alter table public.purchases
  add column if not exists paid_from_register_id uuid references public.cash_registers(id) on delete restrict;

-- ── 3. Диспетчер ────────────────────────────────────────────────────────────
create or replace function public.account_apply(
  p_type text,
  p_id uuid,
  p_amount integer,
  p_method text,
  out o_name text,
  out o_method text
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_kind text;
  v_balance integer;
begin
  if p_id is null then
    raise exception 'Не вказано, звідки платити';
  end if;

  if p_type = 'safe' then
    select name into o_name from public.safes where id = p_id;
    if not found then
      raise exception 'Сейф для списання коштів не знайдено';
    end if;
    -- Сейф має дві половини, і яку саме чіпати — знає лише викликач.
    o_method := p_method;
    perform public.safe_apply(p_id, p_amount, p_method);
    return;
  end if;

  if p_type = 'cash_register' then
    select name, type, balance into o_name, v_kind, v_balance
    from public.cash_registers
    where id = p_id
    for update;

    if not found then
      raise exception 'Касу для списання коштів не знайдено';
    end if;

    -- У каси половин немає: її природа і Є спосіб оплати. Питати про це
    -- окремо означало б дозволити відповідь «готівкою» для банківського
    -- рахунку — і записати в реєстр те, чого не було.
    o_method := case when v_kind = 'cashless' then 'cashless' else 'cash' end;

    if p_amount < 0 and v_balance < abs(p_amount) then
      raise exception 'У касі «%» лише % грн, а списати треба % грн',
        o_name, v_balance, abs(p_amount);
    end if;

    update public.cash_registers
    set balance = balance + p_amount, updated_at = now()
    where id = p_id;
    return;
  end if;

  raise exception 'Невідоме джерело оплати: %', coalesce(p_type, 'порожнє');
end;
$fn$;

-- ── 4. Витрата ──────────────────────────────────────────────────────────────
drop function if exists public.create_expense(uuid, integer, uuid, text, uuid, text);

create function public.create_expense(
  category_id uuid,
  amount integer,
  paid_from_safe_id uuid,
  description text,
  user_id uuid,
  payment_method text,
  p_source_type text default 'safe',
  p_source_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_type   text := coalesce(nullif(p_source_type, ''), 'safe');
  v_id     uuid := coalesce(p_source_id, paid_from_safe_id);
  v_name   text;
  v_method text;
  v_expense_id uuid;
begin
  if amount <= 0 then
    raise exception 'Сума витрати має бути більше 0';
  end if;

  select o_name, o_method into v_name, v_method
  from public.account_apply(v_type, v_id, -amount, payment_method);

  insert into public.expenses (
    category_id, amount, paid_from_safe_id, paid_from_register_id, description, created_by
  ) values (
    category_id, amount,
    case when v_type = 'safe' then v_id end,
    case when v_type = 'cash_register' then v_id end,
    description, user_id
  ) returning id into v_expense_id;

  insert into public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by, payment_method
  ) values (
    amount, v_type, v_id, 'external', null,
    'expense', v_expense_id,
    coalesce(description, 'Витрата з ' || v_name),
    user_id, v_method
  );
end;
$fn$;

-- ── 5. Закупівля товару ─────────────────────────────────────────────────────
drop function if exists public.purchase_inventory_item(text, uuid, uuid, integer, text, uuid, text);

create function public.purchase_inventory_item(
  item_type text,
  item_id uuid,
  safe_id uuid,
  amount integer,
  description text,
  user_id uuid,
  payment_method text,
  p_source_type text default 'safe',
  p_source_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_type   text := coalesce(nullif(p_source_type, ''), 'safe');
  v_id     uuid := coalesce(p_source_id, safe_id);
  v_name   text;
  v_method text;
begin
  if item_type not in ('device', 'accessory', 'part') then
    raise exception 'Невалідний тип сутності';
  end if;

  if amount <= 0 then
    raise exception 'Сума закупівлі має бути більше 0';
  end if;

  select o_name, o_method into v_name, v_method
  from public.account_apply(v_type, v_id, -amount, payment_method);

  insert into public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by, payment_method
  ) values (
    amount, v_type, v_id, 'external', null,
    item_type, item_id, description, user_id, v_method
  );
end;
$fn$;

-- ── 6. Оплата закупівлі постачальнику ───────────────────────────────────────
drop function if exists public.pay_purchase_atomic(uuid, uuid, uuid, text);

create function public.pay_purchase_atomic(
  p_id uuid,
  p_safe_id uuid,
  user_id uuid,
  p_payment_method text,
  p_source_type text default 'safe',
  p_source_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_type   text := coalesce(nullif(p_source_type, ''), 'safe');
  v_id     uuid := coalesce(p_source_id, p_safe_id);
  v_name   text;
  v_method text;
  v_amount integer;
  v_status text;
  v_payment_type text;
  v_supplier_id uuid;
  v_supplier_name text := 'Постачальник';
begin
  select total_amount, status, supplier_id, payment_type
  into v_amount, v_status, v_supplier_id, v_payment_type
  from public.purchases
  where id = p_id;

  if not found then
    raise exception 'Закупівлю з ID % не знайдено', p_id;
  end if;

  if v_status = 'paid' then
    raise exception 'Закупівлю вже оплачено';
  end if;

  if v_status = 'pending' and v_payment_type <> 'prepaid' then
    raise exception 'Спочатку підтвердіть отримання товару перед оплатою';
  end if;

  select o_name, o_method into v_name, v_method
  from public.account_apply(v_type, v_id, -v_amount, p_payment_method);

  update public.purchases
  set status = 'paid',
      paid_at = now(),
      paid_from_safe_id     = case when v_type = 'safe' then v_id end,
      paid_from_register_id = case when v_type = 'cash_register' then v_id end,
      updated_at = now()
  where id = p_id;

  if v_supplier_id is not null then
    select name into v_supplier_name from public.suppliers where id = v_supplier_id;
  end if;

  insert into public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by, payment_method
  ) values (
    v_amount, v_type, v_id, 'supplier', v_supplier_id,
    'purchase', p_id,
    case
      when v_payment_type = 'prepaid'
        then 'Передплата за закупівлю постачальнику "' || v_supplier_name || '" з ' || v_name
      else 'Оплата закупівлі постачальнику "' || v_supplier_name || '" з ' || v_name
    end,
    user_id, v_method
  );
end;
$fn$;

-- ── 7. Закупівля аксесуара по позиції ───────────────────────────────────────
drop function if exists public.purchase_accessory_stock(uuid, integer, integer, integer, uuid, text, uuid);

create function public.purchase_accessory_stock(
  p_accessory_id uuid,
  p_quantity integer,
  p_unit_cost integer,
  p_new_cost_price integer,
  p_safe_id uuid,
  p_payment_method text,
  p_user_id uuid,
  p_source_type text default 'safe',
  p_source_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_type   text := coalesce(nullif(p_source_type, ''), 'safe');
  v_id     uuid := coalesce(p_source_id, p_safe_id);
  v_name   text;
  v_method text;
  v_acc_name text;
  v_total  integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більше 0';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Ціна закупівлі не може бути відʼємною';
  end if;
  if p_new_cost_price is null or p_new_cost_price < 0 then
    raise exception 'Собівартість не може бути відʼємною';
  end if;

  select name into v_acc_name
  from public.accessories
  where id = p_accessory_id
  for update;

  if not found then
    raise exception 'Аксесуар не знайдено';
  end if;

  v_total := p_quantity * p_unit_cost;

  if v_total > 0 then
    if v_id is null then
      raise exception 'Не вказано, звідки платити';
    end if;

    select o_name, o_method into v_name, v_method
    from public.account_apply(v_type, v_id, -v_total, p_payment_method);

    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, reference_id, description, created_by, payment_method
    ) values (
      v_total, v_type, v_id, 'external', null,
      'accessory', p_accessory_id,
      format('Закупівля аксесуарів: %s (%s шт × %s грн)', v_acc_name, p_quantity, p_unit_cost),
      p_user_id, v_method
    );
  end if;

  update public.accessories
  set stock               = stock + p_quantity,
      cost_price          = p_new_cost_price,
      purchase_ordered_at = null
  where id = p_accessory_id;

  insert into public.inventory_movements (
    item_type, item_id, quantity_change, reason, unit_cost, created_by
  ) values (
    'accessory', p_accessory_id, p_quantity, 'purchase', p_unit_cost, p_user_id
  );
end;
$fn$;

-- ── 8. Права ────────────────────────────────────────────────────────────────
-- Кожен CREATE FUNCTION повертає дефолтний GRANT EXECUTE TO PUBLIC. Для
-- SECURITY DEFINER це відкриває сейф і касу публічному ключу з браузерного
-- бандла — саме так дірка `20260721135206` відкривалась двічі.
do $g$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public', fn.sig);
    execute format('revoke execute on function %s from anon', fn.sig);
    execute format('grant  execute on function %s to authenticated', fn.sig);
    execute format('grant  execute on function %s to service_role', fn.sig);
  end loop;
end $g$;

do $chk$
declare leaked text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into leaked
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if leaked is not null then
    raise exception 'SECURITY DEFINER функції досі доступні anon: %', leaked;
  end if;
end $chk$;
