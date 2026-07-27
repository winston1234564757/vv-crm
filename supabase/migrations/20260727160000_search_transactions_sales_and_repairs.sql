-- Сторінка «Продажі» показує лише таблицю sales, тож зароблене на ремонтах у ній
-- не існувало. Ця функція повертає спільну хронологію обох джерел.
--
-- Ремонт потрапляє в продажі за тими самими правилами, за якими він потрапляє в
-- гроші (див. EARNED_REPAIR_STATUSES у lib/repair-flow.ts): закритий, не
-- складський і з ненульовою ціною. Датою вважається completed_at — момент
-- видачі, той самий, за яким прибуток розкладає дашборд, а не дата приймання.
--
-- Гарантійний ремонт за 0 ₴ сюди не входить: він стався, але нічого не продано,
-- і в середньому чеку створював би порожній рядок. Його місце — сторінка
-- Ремонтів.
--
-- Замінює search_sales_ids, яка вміла тільки sales.
create or replace function public.search_transactions(
  p_query text default null,
  p_category text default null,
  p_payment text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table(kind text, row_id uuid, occurred_at timestamptz, total_count bigint)
language sql
stable
set search_path to 'public'
as $function$
  with sale_rows as (
    select 'sale'::text as kind, s.id as row_id, s.created_at as occurred_at
    from sales s
    left join customers c on c.id = s.customer_id
    where
      -- Фільтр «Ремонти» ховає товарні продажі цілком.
      coalesce(p_category, 'all') <> 'repair'
      and (
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
  ),
  repair_rows as (
    select 'repair'::text as kind, r.id as row_id, r.completed_at as occurred_at
    from repairs r
    left join customers c on c.id = r.customer_id
    where r.status in ('handed_over', 'completed')
      and r.inventory_device_id is null
      and r.price > 0
      and r.completed_at is not null
      and (p_category is null or p_category in ('all', 'repair'))
      -- Оплата ремонту лягає в transactions як рух у касу, без розділення на
      -- готівку/картку. Тому будь-який фільтр методу оплати ремонти ховає:
      -- показати їх означало б вигадати метод, якого в даних немає.
      and (p_payment is null or p_payment = 'all')
      and (
        p_query is null or p_query = ''
        or c.name ilike '%' || p_query || '%'
        or r.device_name ilike '%' || p_query || '%'
        or coalesce(r.issue, '') ilike '%' || p_query || '%'
        or r.id::text ilike '%' || p_query || '%'
      )
  ),
  matched as (
    select * from sale_rows
    union all
    select * from repair_rows
  )
  select kind, row_id, occurred_at, count(*) over () as total_count
  from matched
  order by occurred_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$;
