-- Server-side search / filter / pagination for the sales list.
-- Returns one page of sale ids plus the total match count, so the application
-- can then fetch those rows with its existing nested select (which resolves
-- item names, payments and seller) without duplicating that logic in SQL.
--
-- SECURITY INVOKER (the default) is deliberate: the caller's RLS policies must
-- still apply. Do not switch this to SECURITY DEFINER.
create or replace function public.search_sales_ids(
  p_query    text default null,
  p_category text default null,
  p_payment  text default null,
  p_limit    integer default 25,
  p_offset   integer default 0
)
returns table (sale_id uuid, total_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with matched as (
    select s.id, s.created_at
    from sales s
    left join customers c on c.id = s.customer_id
    where
      (
        p_query is null or p_query = ''
        or c.name ilike '%' || p_query || '%'
        or coalesce(s.notes, '') ilike '%' || p_query || '%'
        or s.id::text ilike '%' || p_query || '%'
        or exists (
          select 1
          from sale_items si
          left join devices     d  on si.item_type = 'device'    and d.id  = si.item_id
          left join accessories a  on si.item_type = 'accessory' and a.id  = si.item_id
          left join services    sv on si.item_type = 'service'   and sv.id = si.item_id
          left join parts       pt on si.item_type = 'part'      and pt.id = si.item_id
          where si.sale_id = s.id
            and (
              (coalesce(d.brand, '') || ' ' || coalesce(d.model, '')) ilike '%' || p_query || '%'
              or a.name  ilike '%' || p_query || '%'
              or sv.name ilike '%' || p_query || '%'
              or pt.name ilike '%' || p_query || '%'
            )
        )
      )
      and (
        p_category is null or p_category = 'all'
        or exists (
          select 1 from sale_items si2
          where si2.sale_id = s.id and si2.item_type = p_category
        )
      )
      and (
        p_payment is null or p_payment = 'all'
        or exists (
          select 1 from payment_splits ps
          where ps.sale_id = s.id and ps.method = p_payment
        )
      )
  )
  select id, count(*) over () as total_count
  from matched
  order by created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

comment on function public.search_sales_ids is
  'Paginated sales search. Returns a page of sale ids and the total match count. SECURITY INVOKER so RLS applies.';
