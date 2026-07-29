-- Витрата знає, чим заплачено, і списує з відповідної половини.
-- Порядок усередині блоку важливий: спершу читаємо визначення, і лише потім
-- знімаємо стару сигнатуру. Стару треба саме ЗНЯТИ — додавання параметра
-- створює ДРУГУ функцію, і виклик із п'ятьма аргументами стає неоднозначним.
do $$
declare def text; patched text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'create_expense';
  if def is null then raise exception 'create_expense не знайдено'; end if;

  patched := def;

  patched := replace(patched,
    'public.create_expense(category_id uuid, amount integer, paid_from_safe_id uuid, description text, user_id uuid)',
    'public.create_expense(category_id uuid, amount integer, paid_from_safe_id uuid, description text, user_id uuid, payment_method text)');

  patched := replace(patched,
    'UPDATE public.safes SET balance = balance - amount WHERE id = paid_from_safe_id;',
    'PERFORM public.safe_apply(paid_from_safe_id, -amount, payment_method);');

  patched := replace(patched,
    '    description,' || chr(10) || '    created_by' || chr(10) || '  ) VALUES (' || chr(10) ||
    '    amount,' || chr(10) || '    ''safe'',',
    '    description,' || chr(10) || '    created_by,' || chr(10) || '    payment_method' || chr(10) || '  ) VALUES (' || chr(10) ||
    '    amount,' || chr(10) || '    ''safe'',');
  patched := replace(patched,
    '    COALESCE(description, ''Витрата з сейфу '' || safe_name),' || chr(10) || '    user_id' || chr(10) || '  );',
    '    COALESCE(description, ''Витрата з сейфу '' || safe_name),' || chr(10) || '    user_id,' || chr(10) || '    payment_method' || chr(10) || '  );');

  if patched = def then raise exception 'Патч create_expense не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes SET balance' then
    raise exception 'У create_expense лишився прямий UPDATE по safes';
  end if;
  if patched !~ 'safe_apply' then raise exception 'safe_apply не з''явився'; end if;

  drop function if exists public.create_expense(uuid, integer, uuid, text, uuid);
  execute patched;
end $$;
