-- SECURITY: зробити ревок самолікувальним.
--
-- Дірку з anon-доступом до грошових RPC закривали вже двічі:
--   `20260721135206` — ревокнула все,
--   `20260803130000` — залатала `withdraw_owner_share` руками, бо серія
--                      `20260729120x` перестворила функції й повернула
--                      дефолтний `GRANT EXECUTE TO PUBLIC`.
-- `20260804162948` закрила решту (ще девʼять функцій, серед них `safe_apply`,
-- `create_expense` і `transfer_funds`).
--
-- Спільне в усіх трьох: ревок — це разова дія, а `CREATE OR REPLACE FUNCTION`
-- виконується щоразу, коли комусь треба додати аргумент. Поки ревок робиться
-- руками, він програватиме — питання лише коли. Тому тут не ще один ревок, а
-- тригер на подію: кожна нова чи змінена функція в `public` закривається сама,
-- у тій самій транзакції, що її створила.
--
-- ОБЕРЕЖНО: помилка в event trigger ламає ВСІ DDL у базі. Тому тіло цілком
-- загорнуте в `exception when others then null` — якщо тригер колись спіткнеться
-- (несподіваний тип обʼєкта, гонка з DROP), він мовчки пропустить операцію,
-- а не заблокує міграції. Це свідомий компроміс: тригер тут — підстраховка,
-- а не єдиний рубіж. Основний контроль лишається в явному ревоку міграцій, і
-- перевірочний запит нижче має ганятись при кожному аудиті.
--
-- Тригерні функції (`returns trigger`) пропускаємо: PostgREST їх не публікує,
-- викликати по API неможливо, а виконуються вони від імені власника таблиці.

create or replace function public.lock_down_new_functions()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE FUNCTION', 'ALTER FUNCTION')
  loop
    begin
      if obj.schema_name = 'public'
         and obj.object_identity is not null
         and not exists (
           select 1 from pg_proc p
           where p.oid = obj.objid and p.prorettype = 'pg_catalog.trigger'::regtype
         )
      then
        execute format('revoke execute on function %s from public', obj.object_identity);
        execute format('revoke execute on function %s from anon', obj.object_identity);
        execute format('grant  execute on function %s to authenticated', obj.object_identity);
        execute format('grant  execute on function %s to service_role', obj.object_identity);
      end if;
    exception when others then
      -- Ніколи не блокуємо DDL через цю підстраховку.
      null;
    end;
  end loop;
end $$;

drop event trigger if exists lock_down_new_functions;

create event trigger lock_down_new_functions
  on ddl_command_end
  when tag in ('CREATE FUNCTION', 'ALTER FUNCTION')
  execute function public.lock_down_new_functions();

-- Перевірка, що тригер справді працює: створюємо функцію, яка за замовчуванням
-- була б доступна anon, і переконуємось, що вона такою не лишилась.
do $$
declare
  leaked boolean;
begin
  execute 'create or replace function public.__lockdown_selftest() returns int
           language sql as $fn$ select 1 $fn$';

  select has_function_privilege('anon', 'public.__lockdown_selftest()', 'EXECUTE')
    into leaked;

  execute 'drop function public.__lockdown_selftest()';

  if leaked then
    raise exception 'lock_down_new_functions не спрацював: нова функція лишилась доступною anon';
  end if;
end $$;
