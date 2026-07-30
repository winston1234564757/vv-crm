-- Категорії на сторінці Продажів рахувались ДО знижки, а оборот — після, і два
-- грошові числа на одному екрані законно не сходились: позицій на 33 604 ₴,
-- обороту 33 460 ₴. Розбіжність — знижки.
--
-- Тепер знижка розподіляється по позиціях чека, і `itemsTotal` дорівнює
-- обороту. Плитка «Продано на суму» через це стала дублем і зі сторінки
-- прибрана; `itemsTotal` лишається знаменником для відсотків у «За категоріями».
--
-- Знижка береться як «сума позицій мінус підсумок чека», а НЕ зі стовпця
-- `sales.discount`: той зберігає відсоток, і два шляхи продажу пишуть позиції
-- по-різному (POS — до знижки, швидкий продаж — уже після). Різниця вірна в
-- обох випадках. Те саме правило, що в `allocateSaleRevenue` (lib/profit.ts).
--
-- Розподіл — метод найбільших залишків (Гамільтона), як у profit.ts: кожній
-- позиції ціла частина її частки, а нерозподілена решта по гривні тим, у кого
-- більший залишок. Порівну округляти не можна — при багатьох дрібних позиціях
-- похибка накопичується і може загнати найбільшу позицію в мінус.

-- Дефолти параметрів зберігаємо один в один: без них `create or replace`
-- відмовляється чіпати наявну функцію.
create or replace function public.sales_analytics(
  p_from   timestamptz default null,
  p_to     timestamptz default null,
  p_bucket text default 'day'
)
returns jsonb
language sql
stable
as $$
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
  -- Позиції з підсумком свого чека під рукою.
  lines as (
    select si.id, si.sale_id, si.item_type,
           si.total_price::bigint as tp,
           (sum(si.total_price) over (partition by si.sale_id))::bigint as line_total,
           s.total_amount::bigint as paid
    from sale_items si
    join scoped s on s.id = si.sale_id
  ),
  -- Знижка чека в гривнях. Притиснута до [0, сума позицій]: підсумок більший за
  -- рядки — розподіляти нічого (догори не тягнемо, невідомо якій позиції);
  -- від'ємний підсумок — найгірший випадок нульовий виторг, а не мінусовий.
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
$$;
