-- Закупівля запчастини, аксесуара чи техніки списує з тієї половини, якою
-- заплатили. Саме цим шляхом пройшли 550 грн карткою за акумулятор Samsung S22.
do $$
declare def text; patched text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'purchase_inventory_item';
  if def is null then raise exception 'purchase_inventory_item не знайдено'; end if;

  patched := def;

  patched := replace(patched,
    'public.purchase_inventory_item(item_type text, item_id uuid, safe_id uuid, amount integer, description text, user_id uuid)',
    'public.purchase_inventory_item(item_type text, item_id uuid, safe_id uuid, amount integer, description text, user_id uuid, payment_method text)');

  patched := replace(patched,
    'UPDATE public.safes SET balance = balance - amount WHERE id = safe_id;',
    'PERFORM public.safe_apply(safe_id, -amount, payment_method);');

  patched := replace(patched,
    '    description,' || chr(10) || '    created_by' || chr(10) || '  ) VALUES (',
    '    description,' || chr(10) || '    created_by,' || chr(10) || '    payment_method' || chr(10) || '  ) VALUES (');
  patched := replace(patched,
    '    description,' || chr(10) || '    user_id' || chr(10) || '  );',
    '    description,' || chr(10) || '    user_id,' || chr(10) || '    payment_method' || chr(10) || '  );');

  if patched = def then raise exception 'Патч purchase_inventory_item не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes SET balance' then
    raise exception 'У purchase_inventory_item лишився прямий UPDATE по safes';
  end if;
  if patched !~ 'safe_apply' then raise exception 'safe_apply не з''явився'; end if;

  drop function if exists public.purchase_inventory_item(text, uuid, uuid, integer, text, uuid);
  execute patched;
end $$;
