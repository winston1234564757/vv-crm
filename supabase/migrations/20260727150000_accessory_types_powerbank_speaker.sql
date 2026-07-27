-- Павербанки й колонки як окремі категорії аксесуарів.
--
-- Досі вони лягали б у 'other' — разом з усім іншим, чого не встигли назвати.
-- Категорія аксесуара визначає не лише фільтри складу й POS: від неї залежить,
-- який текст гарантії надрукується в чеку.
--
-- Перелік дублюється в коді (`accessoryType` у lib/domain-labels.ts) — це
-- CHECK, а не FK на таблицю-довідник, тож синхронність тримається вручну.
-- Тому список тут виписаний у тому ж порядку, що й там.
alter table public.accessories drop constraint if exists accessories_type_check;

alter table public.accessories add constraint accessories_type_check
  check (type = any (array[
    'case'::text,
    'screen_protector'::text,
    'charger'::text,
    'powerbank'::text,
    'cable'::text,
    'headphones'::text,
    'speaker'::text,
    'other'::text
  ]));
