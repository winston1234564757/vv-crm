-- Оплата закупівлі. Параметр названо p_payment_method, а не payment_method:
-- усередині вже є локальна p_payment_type (умови оплати постачальника).
do $$
declare def text; patched text; ident text;
begin
  select pg_get_functiondef(p.oid), pg_get_function_identity_arguments(p.oid) into def, ident
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'pay_purchase_atomic';
  if def is null then raise exception 'pay_purchase_atomic не знайдено'; end if;
  patched := def;
  patched := replace(patched,
    'public.pay_purchase_atomic(p_id uuid, p_safe_id uuid, user_id uuid)',
    'public.pay_purchase_atomic(p_id uuid, p_safe_id uuid, user_id uuid, p_payment_method text)');
  patched := replace(patched,
    'UPDATE public.safes ' || chr(10) || '  SET balance = balance - p_amount, updated_at = NOW() ' || chr(10) || '  WHERE id = p_safe_id;',
    'PERFORM public.safe_apply(p_safe_id, -p_amount, p_payment_method);');
  patched := replace(patched,
    '    description,' || chr(10) || '    created_by' || chr(10) || '  ) VALUES (',
    '    description,' || chr(10) || '    created_by,' || chr(10) || '    payment_method' || chr(10) || '  ) VALUES (');
  patched := replace(patched,
    '    END,' || chr(10) || '    user_id' || chr(10) || '  );',
    '    END,' || chr(10) || '    user_id,' || chr(10) || '    p_payment_method' || chr(10) || '  );');
  if patched = def then raise exception 'Патч pay_purchase_atomic не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes ' then raise exception 'лишився UPDATE по safes'; end if;
  execute format('drop function if exists public.pay_purchase_atomic(%s)', ident);
  execute patched;
end $$;
