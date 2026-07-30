-- Нижній поріг суми операції: під розіграш «участь від 300 ₴».
--
-- Поріг у Postgres, а не в React, з тієї самої причини, що й сортування
-- (див. 20260730160000): пагінація серверна, тож фільтр на клієнті відкинув би
-- рядки вже після нарізки сторінки — і «21 учасник» у шапці був би неправдою,
-- бо рахувався б із 25 рядків поточної сторінки.
--
-- Межа включна (`>=`): «від 300 ₴» у розіграші означає, що чек рівно на 300 ₴
-- бере участь.
--
-- Порогом накривається і `sales.total_amount`, і `repairs.price` — учасник той,
-- хто заплатив, незалежно від того, купив він товар чи здав телефон у ремонт.
--
-- DROP потрібен, бо CREATE OR REPLACE не додає параметрів: вийшло б два
-- перевантаження з дефолтами на всі аргументи, і будь-який виклик упав би на
-- неоднозначності. Права після DROP не переживають, тому GRANT нижче.

drop function if exists public.search_transactions(text, text, text, integer, integer, timestamptz, text, text);

create function public.search_transactions(
  p_query text default null,
  p_category text default null,
  p_payment text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_from timestamptz default null,
  p_sort text default 'date',
  p_dir text default 'desc',
  p_min_amount integer default null
)
returns table(
  kind text,
  row_id uuid,
  occurred_at timestamptz,
  amount integer,
  total_count bigint
)
language sql
stable
set search_path to 'public'
as $function$
  with sale_rows as (
    select 'sale'::text as kind, s.id as row_id, s.created_at as occurred_at,
           s.total_amount as amount
    from sales s
    left join customers c on c.id = s.customer_id
    where
      -- Фільтр «Ремонти» ховає товарні продажі цілком.
      coalesce(p_category, 'all') <> 'repair'
      and (p_from is null or s.created_at >= p_from)
      and (p_min_amount is null or s.total_amount >= p_min_amount)
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
    select 'repair'::text as kind, r.id as row_id, r.completed_at as occurred_at,
           r.price as amount
    from repairs r
    left join customers c on c.id = r.customer_id
    where r.status in ('handed_over', 'completed')
      and r.inventory_device_id is null
      and r.price > 0
      and r.completed_at is not null
      and (p_from is null or r.completed_at >= p_from)
      and (p_min_amount is null or r.price >= p_min_amount)
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
  select kind, row_id, occurred_at, amount, count(*) over () as total_count
  from matched
  -- Кожна гілка вимикає решту через NULL у CASE: коли умова не збігається, весь
  -- стовпець NULL і ключ стає нейтральним. Невідоме значення p_sort/p_dir
  -- м'яко падає в «за датою, свіжі зверху» — тобто в стару поведінку.
  order by
    case when p_sort = 'amount' and p_dir = 'asc'  then amount end asc,
    case when p_sort = 'amount' and p_dir = 'desc' then amount end desc,
    case when p_sort = 'date'   and p_dir = 'asc'  then occurred_at end asc,
    occurred_at desc,
    row_id
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$;

grant execute on function public.search_transactions(
  text, text, text, integer, integer, timestamptz, text, text, integer
) to anon, authenticated, service_role;
