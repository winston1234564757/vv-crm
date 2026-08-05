-- `get_model_demand_analytics` рахувала маржу по каталогу, а не по продажу.
--
-- Було: `AVG(d.price - d.cost_price)`.
-- Дві помилки в одному рядку:
--   1. `d.price` — це ЦІННИК, а не те, за скільки апарат пішов. iPhone 14 Pro
--      стояв за 20 000, продався за 17 000 — різниця 3 000 ₴ у маржу не
--      потрапляла.
--   2. `d.cost_price` — без `repair_cost`. Це рівно той баг, заради якого
--      написаний `lib/profit.ts`: вкладений у передпродажний ремонт кошт
--      зникав із собівартості.
--
-- Разом на реальних даних (усі 8 проданих апаратів із ремонтом або знижкою):
--   Redmi Note 7  показував 1 000 ₴ маржі проти справжніх   200 ₴  (у 5 разів)
--   Redmi A5      показував 1 600 ₴ проти                    650 ₴
--   iPhone 14 Pro показував 10 000 ₴ проти                 7 000 ₴
-- За цими числами вирішують, що закуповувати далі, — тобто помилка не
-- косметична, вона керує грошима.
--
-- Стало: `si.total_price − si.unit_cost * si.quantity`, тобто фактична сума
-- рядка продажу мінус фактична собівартість. `sale_items.unit_cost` тепер
-- містить `cost_price + repair_cost` (бекфіл `20260804184802` і виправлений
-- POS), тож ремонт враховується сам собою.
--
-- ЩО ТУТ ВСЕ ЩЕ НЕ ІДЕАЛЬНО, свідомо: знижка по чеку не розноситься по
-- позиціях, як це робить `allocateSaleRevenue` у рушії та `sales_analytics` у
-- SQL. Повторювати тут увесь алгоритм Гамільтона заради екрана попиту — більше
-- складності, ніж користі: знижка стоїть на одному чеку з 47, і на ранжування
-- моделей вона не впливає. Якщо знижок стане багато — переносити цей звіт на
-- `sales_analytics`, а не дописувати сюди другу копію алгоритму.
--
-- Заразом: додано межу фінансової епохи й `status = 'completed'`. Без першої
-- у попит потрапляла дозапускова торгівля «з рук», без другої — повернені
-- продажі.

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
      coalesce(d.brand, '')                                             as brand,
      coalesce(d.model, '')                                             as model,
      count(si.id)                                                      as sold_count,
      -- Фактична виручка рядка мінус фактична собівартість (з ремонтом).
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
    group by d.brand, d.model
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
