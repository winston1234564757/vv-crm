-- Реєстрація закупівлі техніки й запчастин. Саме цей шлях пише
-- reference_type = 'inventory' — ним пройшли 550 грн карткою за акумулятор.
--
-- DROP будується з каталогу, а не з переліку типів, набраного руками:
-- у register_device_purchase тридцять три параметри, і одна одруківка не впала
-- б голосно, а лишила б у базі ДВІ функції. Наступний виклик став би
-- неоднозначним, і закупівля зламалась би не одразу, а коли нею скористаються.
do $$
declare def text; patched text; ident text;
begin
  select pg_get_functiondef(p.oid), pg_get_function_identity_arguments(p.oid)
    into def, ident
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'register_device_purchase';
  if def is null then raise exception 'register_device_purchase не знайдено'; end if;
  patched := def;
  patched := replace(patched,
    'p_photo_urls text[], p_safe_id uuid, p_user_id uuid)',
    'p_photo_urls text[], p_safe_id uuid, p_user_id uuid, p_payment_method text)');
  patched := replace(patched,
    'UPDATE public.safes SET balance = balance - p_cost_price WHERE id = p_safe_id;',
    'PERFORM public.safe_apply(p_safe_id, -p_cost_price, p_payment_method);');
  patched := replace(patched,
    'description, created_by)' || chr(10) || '    VALUES (',
    'description, created_by, payment_method)' || chr(10) || '    VALUES (');
  patched := replace(patched, 'v_description, p_user_id);', 'v_description, p_user_id, p_payment_method);');
  if patched = def then raise exception 'Патч register_device_purchase не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes SET balance' then raise exception 'лишився UPDATE по safes'; end if;
  execute format('drop function if exists public.register_device_purchase(%s)', ident);
  execute patched;

  select pg_get_functiondef(p.oid), pg_get_function_identity_arguments(p.oid)
    into def, ident
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'register_part_purchase';
  if def is null then raise exception 'register_part_purchase не знайдено'; end if;
  patched := def;
  patched := replace(patched,
    'p_safe_id uuid, p_user_id uuid)', 'p_safe_id uuid, p_user_id uuid, p_payment_method text)');
  patched := replace(patched,
    'UPDATE public.safes SET balance = balance - v_total_cost WHERE id = p_safe_id;',
    'PERFORM public.safe_apply(p_safe_id, -v_total_cost, p_payment_method);');
  patched := replace(patched,
    'reference_id, description, created_by' || chr(10) || '    ) VALUES (',
    'reference_id, description, created_by, payment_method' || chr(10) || '    ) VALUES (');
  patched := replace(patched,
    ''' шт.)'', p_user_id' || chr(10) || '    );',
    ''' шт.)'', p_user_id, p_payment_method' || chr(10) || '    );');
  if patched = def then raise exception 'Патч register_part_purchase не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes SET balance' then raise exception 'лишився UPDATE по safes'; end if;
  execute format('drop function if exists public.register_part_purchase(%s)', ident);
  execute patched;
end $$;
