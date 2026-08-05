-- Один апарат був заведений як «Redmi » з пробілом у кінці, і звіт попиту
-- рахував його окремим брендом: у списку стояли «Redmi A5» і «Redmi  A5»
-- двома рядками з різною маржею. Для звіту, за яким вирішують, що
-- закуповувати, це гірше за відсутність рядка — модель виглядає вдвічі менш
-- ходовою, ніж вона є. Після зачистки Redmi A5 показує 2 продажі одним рядком.
--
-- Дві дії: почистити наявні дані тут і прибрати причину в самій групувалці
-- (`20260805103624`). `repair_stats` уже тримала `trim()`, бо парсить вільний
-- текст; `sales_stats` покладалась на охайність довідника й не тримала.

update public.devices set brand = trim(brand) where brand is not null and brand <> trim(brand);
update public.devices set model = trim(model) where model is not null and model <> trim(model);
update public.accessories set name = trim(name) where name <> trim(name);
update public.parts set name = trim(name) where name <> trim(name);

do $$
declare
  dirty integer;
begin
  select count(*) into dirty from public.devices
  where (brand is not null and brand <> trim(brand))
     or (model is not null and model <> trim(model));
  if dirty > 0 then
    raise exception 'Лишились незачищені назви: % рядків', dirty;
  end if;
end $$;
