-- Ціна деталі для клієнта, окремо від собівартості.
--
-- До цього в repair_parts була тільки unit_cost — те, у скільки деталь обійшлася
-- майстерні. Гарантійний талон друкував саме її, тож клієнт бачив закупівельну
-- ціну дисплея, а решта суми виглядала як вартість робіт. repair_services уже
-- тримає price і cost окремо; деталі тепер так само.
alter table public.repair_parts
  add column if not exists unit_price integer not null default 0;

comment on column public.repair_parts.unit_price is
  'Ціна одиниці для клієнта (друкується в чеку). 0 = не вказано, тоді береться unit_cost.';

-- Backfill: чинна ціна з каталогу, інакше собівартість — щоб уже списані деталі
-- не друкувалися в чеку нулями.
update public.repair_parts rp
set unit_price = coalesce(nullif(p.price, 0), rp.unit_cost)
from public.parts p
where p.id = rp.part_id and rp.unit_price = 0;

-- Функція набуває шостого параметра, тому саме drop + create: CREATE OR REPLACE
-- зі зміненою сигнатурою залишив би поруч стару п'ятиаргументну версію, і
-- PostgREST не зміг би обрати між ними.
drop function if exists public.add_part_to_repair(uuid, uuid, integer, integer, uuid);

create function public.add_part_to_repair(
  p_repair_id uuid,
  p_part_id uuid,
  p_quantity integer,
  p_unit_cost integer,
  p_user_id uuid,
  p_unit_price integer default null
)
returns void
language plpgsql
security definer
as $function$
DECLARE
  v_part_stock INT;
  v_part_name TEXT;
  v_part_price INT;
  v_unit_price INT;
  v_repair_cost INT;
BEGIN
  -- 1. Lock and check part stock
  SELECT stock, name, price INTO v_part_stock, v_part_name, v_part_price
  FROM public.parts WHERE id = p_part_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Деталь не знайдено на складі';
  END IF;

  IF v_part_stock < p_quantity THEN
    RAISE EXCEPTION 'Недостатньо запчастин на складі (в наявності: % шт)', v_part_stock;
  END IF;

  -- Ціна клієнту: явно вказана майстром → ціна з каталогу → собівартість.
  -- Останнє лишає чек чесним навіть для деталі без проставленої ціни продажу.
  v_unit_price := COALESCE(NULLIF(p_unit_price, 0), NULLIF(v_part_price, 0), p_unit_cost);

  -- 2. Deduct stock
  UPDATE public.parts SET stock = stock - p_quantity WHERE id = p_part_id;

  -- 3. Insert into repair_parts
  INSERT INTO public.repair_parts (repair_id, part_id, quantity, unit_cost, unit_price)
  VALUES (p_repair_id, p_part_id, p_quantity, p_unit_cost, v_unit_price);

  -- 4. Update repair cost. Собівартість, не ціна клієнта: сума ремонту для
  -- клієнта (repairs.price) лишається тим, про що домовився майстер.
  SELECT cost INTO v_repair_cost FROM public.repairs WHERE id = p_repair_id FOR UPDATE;
  UPDATE public.repairs SET cost = COALESCE(v_repair_cost, 0) + (p_unit_cost * p_quantity) WHERE id = p_repair_id;

  -- 5. Add status log
  INSERT INTO public.repair_status_log (repair_id, to_status, notes)
  VALUES (
    p_repair_id,
    'in_progress',
    'Додано деталь зі складу: ' || v_part_name || ' (' || p_quantity || ' шт) на суму ' || (p_unit_cost * p_quantity) || ' грн'
  );

END;
$function$;
