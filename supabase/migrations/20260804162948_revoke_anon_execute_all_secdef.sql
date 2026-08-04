-- SECURITY (регресія (20260721135206) — та сама дірка, вдруге).
--
-- `20260721135206` відібрала EXECUTE у PUBLIC/anon на всіх SECURITY DEFINER
-- функціях. Далі серія `20260729120x` перестворювала функції, щоб додати
-- аргумент `payment_method`, і робила це через `pg_get_functiondef()` +
-- `CREATE OR REPLACE`. Кожен такий `CREATE` повертає дефолтний грант
-- `EXECUTE TO PUBLIC` — тобто мовчки відкриває функцію назад.
--
-- `20260803130000` помітила це для `withdraw_owner_share` і зревокала його
-- окремо. Решту не перевіряли. На момент цієї міграції anon (публічний ключ
-- із браузерного бандла) міг виконувати:
--
--   safe_apply, create_expense, transfer_funds, top_up_safe,
--   purchase_inventory_item, register_device_purchase, register_part_purchase,
--   pay_purchase_atomic, create_client_order, add_part_to_repair,
--   get_safes_with_cash_split
--
-- Усі вони SECURITY DEFINER, тобто RLS їх не зупиняє. Сейф спустошується одним
-- запитом до REST-ендпоінта без жодного логіну.
--
-- Тригерні функції виключені: PostgREST не публікує функції, що повертають
-- `trigger`, тож викликати їх по API неможливо. Тригери виконуються від імені
-- власника і в гранті не потребують.
--
-- Головна відмінність від `20260721135206` — блок ASSERT наприкінці. Ревок сам
-- по собі вже робився і протух; перевірка робить наступне протухання гучним:
-- міграція, що перестворить функцію без ревоку, впаде замість того, щоб тихо
-- відкрити гроші.
--
-- Ідемпотентна: можна ганяти скільки завгодно разів.
-- Зворотно: GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO anon;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public', fn.sig);
    execute format('revoke execute on function %s from anon', fn.sig);
    execute format('grant  execute on function %s to authenticated', fn.sig);
    execute format('grant  execute on function %s to service_role', fn.sig);
  end loop;
end $$;

-- Запобіжник. Якщо колись знову зʼявиться SECURITY DEFINER функція, доступна
-- anon, — впасти тут, а не дізнатися про це з порожнього сейфа.
do $$
declare
  leaked text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
    into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if leaked is not null then
    raise exception
      'SECURITY DEFINER функції досі доступні anon: %', leaked;
  end if;
end $$;
