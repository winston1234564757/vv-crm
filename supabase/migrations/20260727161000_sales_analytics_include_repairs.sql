-- Виторг, кількість операцій, середній чек і графік тепер враховують ремонти.
--
-- Правило відбору ремонтів те саме, що в search_transactions: закритий, не
-- складський, ціна > 0, дата — completed_at.
--
-- Дві навмисні асиметрії, які краще назвати, ніж приховати:
--   * byPayment ремонтів не містить. Оплата ремонту пишеться в transactions як
--     рух у конкретну касу, без поділу на готівку/картку — розкласти її по
--     методах нема з чого, а вигадати означало б збрехати в розрізі, який
--     виглядає точним.
--   * bySeller бере assigned_to, тобто майстра. У ремонті заробляє той, хто його
--     зробив; поля created_by в repairs немає.
create or replace function public.sales_analytics(
  p_from timestamp with time zone default null,
  p_to timestamp with time zone default null,
  p_bucket text default 'day'
)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with scoped as (
    select s.*
    from sales s
    where (p_from is null or s.created_at >= p_from)
      and (p_to   is null or s.created_at <= p_to)
  ),
  scoped_repairs as (
    select r.*
    from repairs r
    where r.status in ('handed_over', 'completed')
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
  items as (
    select si.item_type, coalesce(sum(si.total_price), 0)::bigint amt
    from sale_items si join scoped s on s.id = si.sale_id
    group by si.item_type
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
