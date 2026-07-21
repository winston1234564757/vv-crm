-- Server-side aggregates for the sales analytics panel, so the page no longer
-- has to load every sale just to draw KPIs, breakdowns and the trend chart.
-- SECURITY INVOKER (default) is deliberate so the caller's RLS still applies.
create or replace function public.sales_analytics(
  p_from   timestamptz default null,
  p_to     timestamptz default null,
  p_bucket text default 'day'   -- 'hour' | 'day' | 'month'
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select s.*
    from sales s
    where (p_from is null or s.created_at >= p_from)
      and (p_to   is null or s.created_at <= p_to)
  ),
  kpis as (
    select
      coalesce(sum(total_amount), 0)::bigint as revenue,
      count(*)::bigint                       as cnt,
      count(*) filter (where is_warranty)::bigint as warranty_cnt
    from scoped
  ),
  items as (
    select si.item_type, coalesce(sum(si.total_price), 0)::bigint amt
    from sale_items si join scoped s on s.id = si.sale_id
    group by si.item_type
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
  ),
  trend as (
    select date_trunc(p_bucket, s.created_at) as bucket,
           coalesce(sum(s.total_amount), 0)::bigint amt
    from scoped s
    group by 1 order by 1
  )
  select jsonb_build_object(
    'revenue',       (select revenue from kpis),
    'count',         (select cnt from kpis),
    'warrantyCount', (select warranty_cnt from kpis),
    'avgCheck',      (select case when cnt > 0 then round(revenue::numeric / cnt) else 0 end from kpis),
    'itemsTotal',    coalesce((select sum(amt) from items), 0),
    'byCategory',    coalesce((select jsonb_agg(jsonb_build_object('key', item_type, 'value', amt) order by amt desc) from items), '[]'::jsonb),
    'byPayment',     coalesce((select jsonb_agg(jsonb_build_object('key', method,    'value', amt) order by amt desc) from pays),  '[]'::jsonb),
    'bySeller',      coalesce((select jsonb_agg(jsonb_build_object('key', seller,    'value', amt) order by amt desc) from sellers), '[]'::jsonb),
    'trend',         coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'value', amt) order by bucket) from trend), '[]'::jsonb)
  );
$$;

comment on function public.sales_analytics is
  'Aggregated sales KPIs, breakdowns and trend for a period. SECURITY INVOKER so RLS applies.';
