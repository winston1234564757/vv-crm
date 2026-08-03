-- Аванс власника — заднім числом, на дату самого вилучення.
--
-- Бекфіл 20260803120000 записав обидва рядки поточним часом (03.08), хоча вони
-- виправляють подію 01.08 — зняття 12 000 «Дисплей Денісу». Через це в дні
-- 03.08 з'являлись два розподіли, яких того дня не було, а в списку зняттів
-- корекція стояла за три дні від того, що вона коригує.
--
-- Тепер вони йдуть одразу за вилученням, яке пояснюють: +1 і +2 секунди, щоб
-- сортування за `created_at` ставило спершу саме вилучення, потім сторно, потім
-- аванс. Однаковий час дав би довільний порядок.
--
-- На гроші це не впливає взагалі. Ані `summarize` (рух грошей), ані
-- `buildLedger` (частки) не фільтрують вилучення за датою — обидва беруть усю
-- історію. Змінюється лише те, в який день ці рядки видно; сума купюр, база
-- нарахування і «знято власником» лишаються ті самі.
--
-- Прив'язка до вилучення — за сумою й типом, а не за зашитим id: id тут
-- згенерований, а такий рядок у базі рівно один.

do $$
declare
  v_src_at timestamptz;
  v_storno uuid;
  v_adv    uuid;
begin
  select t.created_at into v_src_at
    from public.transactions t
   where t.reference_type = 'distribution'
     and t.to_type = 'external'
     and t.amount = 12000
   order by t.created_at
   limit 1;

  if v_src_at is null then
    raise notice 'Вилучення на 12 000 не знайдено — переносити нема від чого.';
    return;
  end if;

  select id into v_storno from public.transactions
   where description like 'Сторно частини вилучення 01.08%' order by created_at limit 1;
  select id into v_adv from public.transactions
   where description like 'Аванс власника: % з вилучення 01.08%' order by created_at limit 1;

  if v_storno is null or v_adv is null then
    raise notice 'Записи бекфілу не знайдено — нічого переносити.';
    return;
  end if;

  update public.transactions set created_at = v_src_at + interval '1 second' where id = v_storno;
  update public.transactions set created_at = v_src_at + interval '2 seconds' where id = v_adv;

  raise notice 'Сторно й аванс перенесено на %', v_src_at;
end $$;
