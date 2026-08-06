-- Закупівля й списання аксесуара по позиції.
--
-- Доти кількість аксесуара змінювали формою редагування: прямий UPDATE stock
-- без грошей і без сліду. Кабель у кількості 0 ставав кабелем у кількості 10,
-- сейф не худнув, у реєстрі не зʼявлялось нічого, а «Вартість бізнесу» росла
-- на товар, якого ніхто не купував.
--
-- Атомарність живе тут, а не в серверній дії. Закупівля — це чотири записи
-- (сейф, реєстр, картка товару, рух складу), і розрив між ними лишає систему в
-- стані, з якого код не вміє вийти: `createAccessory` рятується ручним відкатом
-- (видаляє щойно створений рядок), а для ОНОВЛЕННЯ такий відкат означав би
-- покласти гроші назад у сейф — шляху для цього в коді немає.

-- ── 1. Колонки руху складу ──────────────────────────────────────────────────
-- `note` — чому списали. Без неї рух каже «−2 шт» і мовчить про причину: слід
-- є, користі з нього немає.
-- `unit_cost` — почім рухалось. Не для звітності: без цього числа міст
-- «прибуток → гроші» не може порахувати вартість, що вибула зі складу, і
-- будь-яке списання запалює на сторінці фінансів фальшиву «Нев'язку».
alter table public.inventory_movements
  add column if not exists note text,
  add column if not exists unit_cost integer;

comment on column public.inventory_movements.unit_cost is
  'Собівартість однієї одиниці на момент руху. Читає звірка містка: списаний товар мусить пояснити падіння вартості складу.';
comment on column public.inventory_movements.note is
  'Що саме сталося. `reason` кодує рід події, а причину словами тримає ця колонка.';

-- ── 2. Закупівля ────────────────────────────────────────────────────────────
create or replace function public.purchase_accessory_stock(
  p_accessory_id uuid,
  p_quantity integer,
  p_unit_cost integer,
  p_new_cost_price integer,
  p_safe_id uuid,
  p_payment_method text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_name  text;
  v_total integer;
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

  -- Блокування рядка, а не оптимістичний замок як в `adjust_part_stock`: там
  -- конфлікт ловлять і просять повторити, а тут у тій самій транзакції вже
  -- пішли гроші, і «спробуйте ще раз» означало б спитати, чи списувати вдруге.
  select name into v_name
  from public.accessories
  where id = p_accessory_id
  for update;

  if not found then
    raise exception 'Аксесуар не знайдено';
  end if;

  v_total := p_quantity * p_unit_cost;

  -- Нульова закупівля проходить: постачальник дав зразок безкоштовно, товар
  -- заходить без грошей і без транзакції. Саме через це тут не викликається
  -- `purchase_inventory_item` — вона на суму 0 кидає виняток.
  if v_total > 0 then
    if p_safe_id is null then
      raise exception 'Не вказано сейф для списання коштів';
    end if;

    -- `safe_apply` сам перевіряє спосіб оплати й нестачу ПОЛОВИНИ сейфа, і сам
    -- тримає CHECK на невідʼємність обох половин.
    perform public.safe_apply(p_safe_id, -v_total, p_payment_method);

    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, reference_id, description, created_by, payment_method
    ) values (
      v_total, 'safe', p_safe_id, 'external', null,
      'accessory', p_accessory_id,
      format('Закупівля аксесуарів: %s (%s шт × %s грн)', v_name, p_quantity, p_unit_cost),
      p_user_id, p_payment_method
    );
  end if;

  -- `purchase_ordered_at` гаситься саме тут: позиція приїхала, і мітка
  -- «замовлено» в списку закупівлі більше не про неї.
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

-- ── 3. Списання ─────────────────────────────────────────────────────────────
create or replace function public.write_off_accessory_stock(
  p_accessory_id uuid,
  p_quantity integer,
  p_reason text,
  p_note text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_stock integer;
  v_cost  integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більше 0';
  end if;

  -- `write_off` — товар був і зник (брак, втрата, подарунок).
  -- `adjustment` — товару ніколи не було, число ввели неправильно.
  -- Різниця важлива для розбору; для містка вона одна, тому обидві причини
  -- звірка рахує разом.
  if p_reason is null or p_reason not in ('write_off', 'adjustment') then
    raise exception 'Невідома причина списання: %', coalesce(p_reason, 'порожня');
  end if;

  select stock, cost_price into v_stock, v_cost
  from public.accessories
  where id = p_accessory_id
  for update;

  if not found then
    raise exception 'Аксесуар не знайдено';
  end if;

  if v_stock < p_quantity then
    raise exception 'На складі лише % шт', v_stock;
  end if;

  update public.accessories
  set stock = stock - p_quantity
  where id = p_accessory_id;

  insert into public.inventory_movements (
    item_type, item_id, quantity_change, reason, unit_cost, note, created_by
  ) values (
    'accessory', p_accessory_id, -p_quantity, p_reason, v_cost,
    nullif(btrim(coalesce(p_note, '')), ''), p_user_id
  );
end;
$fn$;

-- ── 4. Права ────────────────────────────────────────────────────────────────
-- Кожен CREATE FUNCTION повертає дефолтний GRANT EXECUTE TO PUBLIC. Для
-- SECURITY DEFINER це означає, що anon (публічний ключ із браузерного бандла)
-- може спустошити сейф одним запитом до REST. Саме так дірка `20260721135206`
-- відкрилась удруге і жила до `20260804162948`. Тому ревок стоїть у тій самій
-- міграції, що й функції, а не окремою прибиральною.
revoke execute on function public.purchase_accessory_stock(uuid, integer, integer, integer, uuid, text, uuid) from public, anon;
grant  execute on function public.purchase_accessory_stock(uuid, integer, integer, integer, uuid, text, uuid) to authenticated, service_role;

revoke execute on function public.write_off_accessory_stock(uuid, integer, text, text, uuid) from public, anon;
grant  execute on function public.write_off_accessory_stock(uuid, integer, text, text, uuid) to authenticated, service_role;

-- Той самий запобіжник, що в `20260804162948`: якщо ревок не спрацював, впасти
-- тут, а не дізнатися про це з порожнього сейфа.
do $chk$
declare
  leaked text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
    into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if leaked is not null then
    raise exception 'SECURITY DEFINER функції досі доступні anon: %', leaked;
  end if;
end $chk$;
