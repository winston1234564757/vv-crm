-- Поповнення сейфа і вилучення частки. Обидві дрібні й однотипні, тож ідуть
-- однією міграцією.
do $$
declare def text; patched text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'top_up_safe';
  if def is null then raise exception 'top_up_safe не знайдено'; end if;
  patched := def;
  patched := replace(patched,
    'public.top_up_safe(p_safe_id uuid, p_amount integer, p_desc_text text, p_user_id uuid)',
    'public.top_up_safe(p_safe_id uuid, p_amount integer, p_desc_text text, p_user_id uuid, p_payment_method text)');
  -- UPDATE тут розбитий на три рядки й має пробіли в кінці двох із них.
  patched := replace(patched,
    'UPDATE public.safes ' || chr(10) || '  SET balance = balance + p_amount ' || chr(10) || '  WHERE id = p_safe_id;',
    'PERFORM public.safe_apply(p_safe_id, p_amount, p_payment_method);');
  patched := replace(patched,
    '    description,' || chr(10) || '    created_by' || chr(10) || '  ) VALUES (',
    '    description,' || chr(10) || '    created_by,' || chr(10) || '    payment_method' || chr(10) || '  ) VALUES (');
  patched := replace(patched,
    '    p_user_id' || chr(10) || '  );',
    '    p_user_id,' || chr(10) || '    p_payment_method' || chr(10) || '  );');
  if patched = def then raise exception 'Патч top_up_safe не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes' then raise exception 'У top_up_safe лишився UPDATE по safes'; end if;
  drop function if exists public.top_up_safe(uuid, integer, text, uuid);
  execute patched;

  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'withdraw_owner_share';
  if def is null then raise exception 'withdraw_owner_share не знайдено'; end if;
  patched := def;
  patched := replace(patched,
    'public.withdraw_owner_share(source_type text, source_id uuid, amount numeric, desc_text text, user_id uuid)',
    'public.withdraw_owner_share(source_type text, source_id uuid, amount numeric, desc_text text, user_id uuid, payment_method text)');
  -- `amount` тут numeric, а safe_apply приймає integer — округлюємо явно.
  patched := replace(patched,
    'UPDATE public.safes SET balance = balance - amount WHERE id = source_id;',
    'PERFORM public.safe_apply(source_id, -round(amount)::integer, payment_method);');
  patched := replace(patched,
    '    description,' || chr(10) || '    created_by' || chr(10) || '  ) VALUES (',
    '    description,' || chr(10) || '    created_by,' || chr(10) || '    payment_method' || chr(10) || '  ) VALUES (');
  patched := replace(patched,
    '    user_id' || chr(10) || '  );',
    '    user_id,' || chr(10) || '    payment_method' || chr(10) || '  );');
  if patched = def then raise exception 'Патч withdraw_owner_share не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes SET balance' then raise exception 'У withdraw_owner_share лишився UPDATE по safes'; end if;
  drop function if exists public.withdraw_owner_share(text, uuid, numeric, text, uuid);
  execute patched;
end $$;
