-- POS писав у `sale_items.unit_cost` лише `cost_price`, губляючи вкладений
-- ремонт. На шести проданих девайсах це 3 200 ₴ незаписаної собівартості
-- (з них 1 150 ₴ після епохи).
--
-- На екранах цього не було видно: `profit.ts:itemCost` (рядки 116-126) бере
-- собівартість девайса з таблиці `devices`, а не з рядка продажу, саме тому що
-- колонці не можна довіряти. Але SQL-функції (`sales_analytics`,
-- `get_model_demand_analytics`) читають саме колонку — тож TypeScript і SQL
-- рахували різну собівартість на тих самих даних.
--
-- ЯК ПЕРЕВІРЯТИ: після цієї міграції НЕ МАЄ зрушити жодне число на дашборді,
-- `/admin/finance` чи `/admin/days` — вони колонку не читають. Якщо зрушило,
-- значить хтось її таки читає сирою, і це знахідка, а не регрес.
--
-- Причину полагоджено окремо, в `usePOSCart.ts`: для девайса кошик тепер кладе
-- `cost_price + repair_cost`. Без цього бекфіл протух би з наступним продажем.
--
-- Ідемпотентна: умова `<>` не дає переписати вже правильні рядки.

do $$
declare
  v_before int;
  v_after  int;
begin
  select count(*) into v_before
  from public.sale_items si
  join public.devices d on d.id = si.item_id
  where si.item_type = 'device'
    and si.unit_cost <> d.cost_price + coalesce(d.repair_cost, 0);

  update public.sale_items si
     set unit_cost = d.cost_price + coalesce(d.repair_cost, 0)
    from public.devices d
   where d.id = si.item_id
     and si.item_type = 'device'
     and si.unit_cost <> d.cost_price + coalesce(d.repair_cost, 0);

  select count(*) into v_after
  from public.sale_items si
  join public.devices d on d.id = si.item_id
  where si.item_type = 'device'
    and si.unit_cost <> d.cost_price + coalesce(d.repair_cost, 0);

  raise notice 'Вирівняно рядків: %, лишилось розбіжних: %', v_before, v_after;

  if v_after <> 0 then
    raise exception 'Після бекфілу лишилось % розбіжних рядків', v_after;
  end if;
end $$;
