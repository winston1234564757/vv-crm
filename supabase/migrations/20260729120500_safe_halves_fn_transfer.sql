-- Переказ рухає ту половину, яку вказали. Каси половин не мають — там рух
-- лишається як був.
--
-- Увага: тіло цієї функції зберігається з CRLF-переносами, на відміну від
-- решти. Шаблони заміни мусять використовувати chr(13)||chr(10), інакше вони
-- мовчки не збігаються, і патч «застосується» нічого не змінивши.
do $$
declare def text; patched text; nl text := chr(13) || chr(10);
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'transfer_funds';
  if def is null then raise exception 'transfer_funds не знайдено'; end if;

  patched := def;

  patched := replace(patched,
    'public.transfer_funds(from_id uuid, from_type text, to_id uuid, to_type text, amount integer, desc_text text, user_id uuid)',
    'public.transfer_funds(from_id uuid, from_type text, to_id uuid, to_type text, amount integer, desc_text text, user_id uuid, payment_method text)');

  patched := replace(patched,
    'UPDATE public.safes SET balance = balance - amount WHERE id = from_id;',
    'PERFORM public.safe_apply(from_id, -amount, payment_method);');
  patched := replace(patched,
    'UPDATE public.safes SET balance = balance + amount WHERE id = to_id;',
    'PERFORM public.safe_apply(to_id, amount, payment_method);');

  patched := replace(patched,
    '    created_by' || nl || '  ) VALUES (',
    '    created_by,' || nl || '    payment_method' || nl || '  ) VALUES (');
  patched := replace(patched,
    '    user_id' || nl || '  );',
    '    user_id,' || nl || '    payment_method' || nl || '  );');

  if patched = def then raise exception 'Патч transfer_funds не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes SET balance' then
    raise exception 'У transfer_funds лишився прямий UPDATE по safes';
  end if;
  if patched !~ 'payment_method' then raise exception 'payment_method не з''явився'; end if;

  drop function if exists public.transfer_funds(uuid, text, uuid, text, integer, text, uuid);
  execute patched;
end $$;
