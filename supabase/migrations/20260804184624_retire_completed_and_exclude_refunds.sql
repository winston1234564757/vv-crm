-- Дві SQL-функції лишались останніми читачами грошей без двох правил, які в
-- TypeScript діють давно.
--
-- 1. ПОВЕРНЕННЯ. `refund_sale` (`20260628000004`) ставить `status='refunded'`,
--    але лишає `total_amount` і всі `sale_items` на місці. `profit-dataset.ts`,
--    `data-finance.ts` і `data-analytics.ts` уже фільтрують по `completed`
--    (коміт `0b87d00`), а `sales_analytics` і `get_revenue_heatmap` — ні.
--    Тобто перше ж повернення завищило б виторг на `/admin/sales` і в теплокарті,
--    хоча дашборд показував би правильно. Повернень зараз 0 — ставимо до першого.
--
-- 2. РЕТАЙР `completed` ДЛЯ РЕМОНТІВ. Скасовано ще `20260727140000`: ремонт
--    заробляється на видачі (`handed_over`), і це правило живе в
--    `repair-flow.ts:repairSettledAt`. Обидві функції досі приймали пару
--    `('handed_over','completed')`, тобто могли зарахувати у виторг ремонт,
--    якого клієнт ще не забрав.
--
-- ЩО НАВМИСНО НЕ ЧІПАЄМО: `devices_repair_status_check`.
-- `devices.repair_status='completed'` — це НЕ той самий статус. `repairs.status`
-- описує клієнтський ремонт, де кінцевий стан `handed_over`, бо пристрій
-- віддають клієнту. Складський апарат нікому не віддають: його лагодять і
-- ставлять у продаж, тож `handed_over` для нього беззмістовний. У базі 8 таких
-- рядків, усі зі `status='sold'`, і `actions/repairs.ts:49-51` прямо це
-- документує. Прибирання `completed` звідти зламало б refurb-потік.
--
-- ПОБІЧНИЙ ЕФЕКТ: `CREATE OR REPLACE` тригерить `lock_down_new_functions`
-- (`20260804164149`), тож обидві функції втратять `EXECUTE` для `anon`. Це
-- бажано — вони викликаються лише з `data-sales.ts` і `data-analytics.ts`,
-- обидва серверні (перевірено grep'ом).

-- Передполіт: якщо десь лишився хоч один ремонт зі старим статусом, CHECK нижче
-- впаде посеред міграції й лишить схему напівзміненою. Краще впасти тут.
do $$
declare v_repairs int;
begin
  select count(*) into v_repairs from public.repairs where status = 'completed';
  if v_repairs > 0 then
    raise exception
      'Ретайр неможливий: repairs.status=completed → % рядків. Спершу перевести їх у handed_over або cancelled.', v_repairs;
  end if;
end $$;

-- Тіло дослівно з pg_get_functiondef; змінені рядки позначені.
create or replace function public.sales_analytics(
  p_from timestamp with time zone default null::timestamp with time zone,
  p_to timestamp with time zone default null::timestamp with time zone,
  p_bucket text default 'day'::text)
 returns jsonb
 language sql
 stable
as $function$
  with scoped as (
    select s.*
    from sales s
    where (p_from is null or s.created_at >= p_from)
      and (p_to   is null or s.created_at <= p_to)
      and s.status = 'completed'                       -- ЗМІНА 1: без повернень
  ),
  scoped_repairs as (
    select r.*
    from repairs r
    where r.status = 'handed_over'                     -- ЗМІНА 2: було in (...,'completed')
      and r.inventory_device_id is null
      and r.price > 0
      and r.completed_at is not null
      and (p_from is null or r.completed_at >= p_from)
      and (p_to   is null or r.completed_at <= p_to)
  ),
  kpis as (
    select
      (select coalesce(sum(total_amount), 0) from scoped)
        + (select coalesce(sum(price), 0) from scoped_repairs) as revenue,
      (select count(*) from scoped)
        + (select count(*) from scoped_repairs)                as cnt,
      (select count(*) filter (where is_warranty) from scoped)
        + (select count(*) filter (where is_warranty) from scoped_repairs) as warranty_cnt
  ),
  lines as (
    select si.id, si.sale_id, si.item_type,
           si.total_price::bigint as tp,
           (sum(si.total_price) over (partition by si.sale_id))::bigint as line_total,
           s.total_amount::bigint as paid
    from sale_items si
    join scoped s on s.id = si.sale_id
  ),
  shares as (
    select l.*,
           least(greatest(l.line_total - greatest(l.paid, 0), 0), l.line_total) as disc
    from lines l
  ),
  floors as (
    select s.*,
           case when s.line_total = 0 or s.disc = 0 then 0
                else (s.disc * s.tp) / s.line_total end as fl,
           case when s.line_total = 0 or s.disc = 0 then 0
                else (s.disc * s.tp) % s.line_total end as rem
    from shares s
  ),
  ranked as (
    select f.item_type, f.tp, f.fl,
           f.disc - sum(f.fl) over (partition by f.sale_id) as leftover,
           row_number() over (
             partition by f.sale_id order by f.rem desc, f.tp desc, f.id
           ) as rn
    from floors f
  ),
  items as (
    select item_type,
           coalesce(sum(tp - fl - case when rn <= leftover then 1 else 0 end), 0)::bigint amt
    from ranked
    group by item_type
    union all
    select 'repair', coalesce(sum(price), 0)::bigint
    from scoped_repairs
    having coalesce(sum(price), 0) > 0
  ),
  pays as (
    select ps.method, coalesce(sum(ps.amount), 0)::bigint amt
    from payment_splits ps join scoped s on s.id = ps.sale_id
    group by ps.method
  ),
  sellers as (
    select coalesce(nullif(trim(p.full_name), ''), 'Невідомо') as seller,
           coalesce(sum(s.total_amount), 0)::bigint amt
    from scoped s left join profiles p on p.id = s.created_by
    group by 1
    union all
    select coalesce(nullif(trim(p.full_name), ''), 'Невідомо'),
           coalesce(sum(r.price), 0)::bigint
    from scoped_repairs r left join profiles p on p.id = r.assigned_to
    group by 1
  ),
  sellers_merged as (
    select seller, sum(amt)::bigint amt from sellers group by seller
  ),
  trend as (
    select bucket, sum(amt)::bigint amt
    from (
      select date_trunc(p_bucket, s.created_at) as bucket,
             coalesce(sum(s.total_amount), 0)::bigint amt
      from scoped s group by 1
      union all
      select date_trunc(p_bucket, r.completed_at),
             coalesce(sum(r.price), 0)::bigint
      from scoped_repairs r group by 1
    ) t
    group by bucket
    order by bucket
  )
  select jsonb_build_object(
    'revenue',       (select revenue from kpis),
    'count',         (select cnt from kpis),
    'warrantyCount', (select warranty_cnt from kpis),
    'avgCheck',      (select case when cnt > 0 then round(revenue::numeric / cnt) else 0 end from kpis),
    'itemsTotal',    coalesce((select sum(amt) from items), 0),
    'byCategory',    coalesce((select jsonb_agg(jsonb_build_object('key', item_type, 'value', amt) order by amt desc) from items), '[]'::jsonb),
    'byPayment',     coalesce((select jsonb_agg(jsonb_build_object('key', method,    'value', amt) order by amt desc) from pays),  '[]'::jsonb),
    'bySeller',      coalesce((select jsonb_agg(jsonb_build_object('key', seller,    'value', amt) order by amt desc) from sellers_merged), '[]'::jsonb),
    'trend',         coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'value', amt) order by bucket) from trend), '[]'::jsonb)
  );
$function$;

create or replace function public.get_revenue_heatmap(days_back integer default 60)
 returns table(dow integer, hour_of_day integer, total_revenue bigint, tx_count bigint, avg_check numeric)
 language sql
 stable
as $function$
  with epoch as (
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
      and s.status = 'completed'                       -- ЗМІНА 3: без повернень
    union all
    select r.completed_at, r.price
    from repairs r, epoch e
    where r.status = 'handed_over'                     -- ЗМІНА 4: було in (...,'completed')
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
$function$;

-- CHECK лише для ремонтів. Значення, яке фільтри більше не приймають, не має
-- лишатись дозволеним: інакше його можна проставити руками, і рядок мовчки
-- випаде з усіх звітів.
alter table public.repairs drop constraint repairs_status_check;
alter table public.repairs add constraint repairs_status_check
  check (status = any (array['received'::text, 'diagnostics'::text, 'in_progress'::text,
                             'awaiting_parts'::text, 'ready'::text, 'handed_over'::text,
                             'cancelled'::text]));

do $$
begin
  if exists (select 1 from pg_constraint
             where conname = 'repairs_status_check'
               and pg_get_constraintdef(oid) like '%completed%') then
    raise exception 'repairs_status_check досі дозволяє completed';
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'devices_repair_status_check'
                   and pg_get_constraintdef(oid) like '%completed%') then
    raise exception 'devices_repair_status_check втратив completed — це зламає refurb-потік';
  end if;
end $$;
