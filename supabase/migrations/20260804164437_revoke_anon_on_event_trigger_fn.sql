-- `lock_down_new_functions()` повертає `event_trigger`, а не `trigger`, тож
-- цикл ревоку в `20260804162948` (він виключає лише `trigger`) її не зачепив,
-- і вона світилась у перевірочному запиті як «доступна anon».
--
-- Реальної загрози не було: Postgres не дає викликати event-trigger функцію
-- напряму, а PostgREST такі функції не публікує. Але аудит має бути чистим —
-- інакше наступного разу цей рядок сприймуть за відомий шум і пропустять
-- поруч із ним справжню дірку. Саме так і губляться регресії.

revoke execute on function public.lock_down_new_functions() from public, anon;

-- Інваріант: жодна SECURITY DEFINER функція, яку взагалі можна викликати,
-- не доступна anon. Тригерні та event-тригерні виключені — їх викликає
-- виконавець, а не клієнт.
do $$
declare
  leaked text;
begin
  select string_agg(p.proname, ', ')
    into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if leaked is not null then
    raise exception 'Досі доступні anon: %', leaked;
  end if;
end $$;
