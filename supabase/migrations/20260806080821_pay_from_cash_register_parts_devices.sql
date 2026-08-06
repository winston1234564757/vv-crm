-- Продовження: заведення деталі й техніки теж платить із будь-якого рахунку.
--
-- Обидві функції мали власну копію перевірки сейфа — шосту й сьому. Тепер
-- обидві питають `account_apply`, як і решта.

-- ── Деталь ──────────────────────────────────────────────────────────────────
drop function if exists public.register_part_purchase(
  text, text, text, text, integer, integer, integer, integer, uuid, text, text,
  text, text, timestamptz, uuid, uuid, text
);

create function public.register_part_purchase(
  p_name text,
  p_part_number text,
  p_type text,
  p_compatible_with text,
  p_cost_price integer,
  p_price integer,
  p_stock integer,
  p_min_stock integer,
  p_supplier_id uuid,
  p_np_ttn text,
  p_origin_type text,
  p_status text,
  p_payment_status text,
  p_payment_due_date timestamptz,
  p_safe_id uuid,
  p_user_id uuid,
  p_payment_method text,
  p_source_type text default 'safe',
  p_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_src_type text := coalesce(nullif(p_source_type, ''), 'safe');
  v_src_id   uuid := coalesce(p_source_id, p_safe_id);
  v_name     text;
  v_method   text;
  v_part_id  uuid;
  v_stock_to_insert integer;
  v_debt_amount integer;
  v_is_transit boolean;
  v_is_deferred boolean;
  v_total_cost integer;
begin
  v_is_transit := p_status = 'transit';
  v_stock_to_insert := case when v_is_transit then 0 else p_stock end;
  v_is_deferred := (not v_is_transit) and (p_payment_status = 'deferred');
  v_debt_amount := case when v_is_deferred then p_cost_price * v_stock_to_insert else 0 end;
  v_total_cost := p_cost_price * v_stock_to_insert;

  insert into public.parts (
    name, part_number, type, compatible_with, cost_price, price, stock, min_stock,
    supplier_id, np_ttn, origin_type, status, payment_status, payment_due_date, debt_amount
  ) values (
    p_name, p_part_number, p_type, p_compatible_with, p_cost_price, p_price, v_stock_to_insert, p_min_stock,
    p_supplier_id, p_np_ttn, p_origin_type, p_status,
    case when v_is_transit then 'paid' else p_payment_status end,
    case when v_is_deferred then p_payment_due_date end,
    v_debt_amount
  ) returning id into v_part_id;

  /* У дорозі й у борг гроші не рухаються. Перевірка балансу переїхала в
     `account_apply` і робиться разом зі списанням — окремий попередній SELECT
     нічого не гарантував: між ним і списанням баланс міг змінитись. */
  if not v_is_transit and not v_is_deferred and v_total_cost > 0 and v_src_id is not null then
    select o_name, o_method into v_name, v_method
    from public.account_apply(v_src_type, v_src_id, -v_total_cost, p_payment_method);

    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, reference_id, description, created_by, payment_method
    ) values (
      v_total_cost, v_src_type, v_src_id, 'supplier', p_supplier_id,
      'inventory', v_part_id,
      'Закупівля деталей: ' || p_name || ' (Кількість: ' || v_stock_to_insert || ' шт.)',
      p_user_id, v_method
    );
  end if;

  return v_part_id;
end;
$fn$;

-- ── Техніка ─────────────────────────────────────────────────────────────────
drop function if exists public.register_device_purchase(
  text, text, text, text, integer, integer, text, text, text, integer, text, text,
  text, boolean, text, integer, text, text, jsonb, text, boolean, text, text, text,
  text, text, boolean, text, text, text, text[], uuid, uuid, text
);

create function public.register_device_purchase(
  p_type text,
  p_brand text,
  p_model text,
  p_imei text,
  p_price integer,
  p_cost_price integer,
  p_ram text,
  p_storage text,
  p_color text,
  p_battery_health integer,
  p_screen_size text,
  p_cpu text,
  p_gpu text,
  p_needs_repair boolean,
  p_repair_node text,
  p_repair_cost integer,
  p_repair_np_ttn text,
  p_repair_status text,
  p_repair_parts_replaced jsonb,
  p_description text,
  p_is_visible boolean,
  p_source text,
  p_source_reference text,
  p_purchased_from text,
  p_condition_grade text,
  p_condition_description text,
  p_original_box boolean,
  p_accessories_included text,
  p_serial_number text,
  p_warehouse_location text,
  p_photo_urls text[],
  p_safe_id uuid,
  p_user_id uuid,
  p_payment_method text,
  p_source_type text default 'safe',
  p_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_src_type text := coalesce(nullif(p_source_type, ''), 'safe');
  v_src_id   uuid := coalesce(p_source_id, p_safe_id);
  v_name     text;
  v_method   text;
  v_device_id uuid;
  v_description text;
  v_part_elem jsonb;
  v_p_id uuid;
  v_p_stock integer;
  v_part_id_str text;
begin
  insert into public.devices (
    type, brand, model, imei, price, cost_price, ram, storage, color, battery_health,
    screen_size, cpu, gpu, needs_repair, repair_node, repair_cost, repair_np_ttn,
    repair_status, repair_parts_replaced, description, is_visible,
    source, source_reference, purchased_from, condition_grade, condition_description,
    original_box, accessories_included, serial_number, warehouse_location, photo_urls, status
  ) values (
    p_type, p_brand, p_model, p_imei, p_price, p_cost_price, p_ram, p_storage, p_color, p_battery_health,
    p_screen_size, p_cpu, p_gpu, p_needs_repair, p_repair_node, p_repair_cost, p_repair_np_ttn,
    p_repair_status, p_repair_parts_replaced, p_description, p_is_visible,
    p_source::device_source, p_source_reference, p_purchased_from,
    p_condition_grade::device_condition, p_condition_description, p_original_box, p_accessories_included,
    p_serial_number, p_warehouse_location, p_photo_urls, 'in_stock'
  ) returning id into v_device_id;

  if p_cost_price > 0 and v_src_id is not null then
    v_description := 'Закупівля техніки: ' || p_brand || ' ' || p_model;
    if p_imei is not null and p_imei <> '' then
      v_description := v_description || ' (IMEI: ' || p_imei || ')';
    end if;

    select o_name, o_method into v_name, v_method
    from public.account_apply(v_src_type, v_src_id, -p_cost_price, p_payment_method);

    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, reference_id, description, created_by, payment_method
    ) values (
      p_cost_price, v_src_type, v_src_id, 'external', null,
      'inventory', v_device_id, v_description, p_user_id, v_method
    );
  end if;

  if p_repair_parts_replaced is not null
     and jsonb_typeof(p_repair_parts_replaced) = 'array'
     and jsonb_array_length(p_repair_parts_replaced) > 0 then
    for v_part_elem in select * from jsonb_array_elements(p_repair_parts_replaced) loop
      v_part_id_str := v_part_elem->>'part_id';
      if v_part_id_str is not null and v_part_id_str <> '' then
        v_p_id := v_part_id_str::uuid;
        select stock into v_p_stock from public.parts where id = v_p_id for update;
        if not found then
          raise exception 'Деталь не знайдено (ID: %)', v_p_id;
        end if;
        if v_p_stock < 1 then
          raise exception 'Недостатньо запчастин на складі (ID: %)', v_p_id;
        end if;
        update public.parts set stock = stock - 1 where id = v_p_id;
      end if;
    end loop;
  end if;

  return v_device_id;
end;
$fn$;

-- ── Права ───────────────────────────────────────────────────────────────────
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
