-- Продовження `20260805103608`: там почищено дані, тут прибрано причину.
--
-- `sales_stats` групувала по сирих `d.brand` / `d.model`, тобто один пробіл,
-- набраний руками в довіднику, розколював модель на два рядки. Дані почищено
-- один раз, а форму заповнюють люди — тож `trim()` має стояти в самому
-- групуванні, інакше наступний пробіл зробить те саме.

create or replace function public.get_model_demand_analytics(days_back integer default 90)
returns table(
  brand text,
  model text,
  repair_count bigint,
  sold_count bigint,
  avg_margin numeric,
  avg_days_to_sell numeric,
  demand_score numeric
)
language sql
stable
security definer
as $function$
  with epoch as (
    select coalesce(
      (select value #>> '{}' from settings where key = 'finance_epoch'),
      '-infinity'
    )::timestamptz as at
  ),
  repair_stats as (
    select
      trim(split_part(device_name, ' ', 1))                             as brand,
      trim(substring(device_name from position(' ' in device_name) + 1)) as model,
      count(*)                                                          as repair_count
    from repairs, epoch e
    where created_at > now() - (days_back || ' days')::interval
      and created_at >= e.at
      and device_name is not null
      and position(' ' in device_name) > 0
    group by 1, 2
    having count(*) >= 1
  ),
  sales_stats as (
    select
      -- `trim` і тут: довідник заповнюють руками, і один пробіл у кінці
      -- розколював модель на два рядки з різною маржею.
      trim(coalesce(d.brand, ''))                                       as brand,
      trim(coalesce(d.model, ''))                                       as model,
      count(si.id)                                                      as sold_count,
      avg((si.total_price - si.unit_cost * si.quantity)::numeric)       as avg_margin,
      avg(extract(epoch from (s.created_at - d.created_at)) / 86400.0)  as avg_days_to_sell
    from devices d
    join sale_items si on si.item_id = d.id and si.item_type = 'device'
    join sales s on s.id = si.sale_id
    cross join epoch e
    where s.created_at > now() - (days_back || ' days')::interval
      and s.created_at >= e.at
      and s.status = 'completed'
      and d.model is not null
    group by 1, 2
  )
  select
    coalesce(s.brand, r.brand)                                          as brand,
    coalesce(s.model, r.model)                                          as model,
    coalesce(r.repair_count, 0)                                         as repair_count,
    coalesce(s.sold_count, 0)                                           as sold_count,
    round(coalesce(s.avg_margin, 0), 0)                                 as avg_margin,
    round(coalesce(s.avg_days_to_sell, 0), 1)                           as avg_days_to_sell,
    round(
      (coalesce(r.repair_count, 0) * 0.35 + coalesce(s.sold_count, 0) * 0.65)::numeric,
      1
    )                                                                   as demand_score
  from sales_stats s
  full outer join repair_stats r
    on lower(s.brand) = lower(r.brand) and lower(s.model) = lower(r.model)
  where coalesce(s.brand, r.brand) is not null
    and coalesce(s.model, r.model) is not null
    and trim(coalesce(s.model, r.model)) <> ''
  order by demand_score desc
  limit 15;
$function$;
