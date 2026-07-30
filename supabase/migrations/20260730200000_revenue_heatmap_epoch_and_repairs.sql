-- Хітмапа виторгу рахувала лише `sales` і не знала про фінансову епоху.
--
-- Ремонти — третина виторгу магазину (9 200 ₴ із 27 460 ₴ станом на 30.07).
-- Без них хітмапа, названа «revenue», систематично занижувала вечірні години,
-- коли клієнти забирають техніку. Після правки з'явились 19:00 (1 000 ₴),
-- 20:00 (450 ₴) і 21:00 (1 530 ₴) — годин, яких вона просто не бачила.
--
-- Ремонт лягає в годину ВИДАЧІ (`completed_at`) — те саме правило, що в
-- `repairSettledAt` і в `search_transactions`, щоб одна операція не опинялась
-- на двох екранах у різні години.
--
-- Епоха читається зі `settings` усередині функції, а не приходить параметром:
-- викликачу не треба знати дату, і другого місця з нею не з'являється.
-- `settings.value` має тип jsonb, тож `#>> '{}'` дістає рядок без лапок —
-- `value::text` віддав би "2026-07-21T10:04:41Z" разом із лапками, і каст у
-- timestamptz упав би. Немає ключа — межі немає, як і всюди в системі.
--
-- Дефолт параметра збережено один в один, інакше `create or replace`
-- відмовляється чіпати наявну функцію. Тип результату не змінювався, тож
-- DROP не потрібен і `HeatmapRow` у widget-types лишається як є.
--
-- Звірено після застосування: sum(total_revenue) = 27 460 ₴ = виторг від
-- епохи; sum(tx_count) = 34 = 25 чеків + 9 виданих ремонтів. До правки
-- функція давала 32 610 ₴ — усі продажі коли-небудь, без ремонтів.

create or replace function public.get_revenue_heatmap(days_back integer default 60)
returns table(
  dow integer,
  hour_of_day integer,
  total_revenue bigint,
  tx_count bigint,
  avg_check numeric
)
language sql
stable
as $$
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
    union all
    select r.completed_at, r.price
    from repairs r, epoch e
    where r.status in ('handed_over', 'completed')
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
$$;
