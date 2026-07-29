-- Скасування повертає гроші в ту половину, з якої їх узяли. Параметра не
-- додаємо: обидві функції скасовують УЖЕ ЗАПИСАНУ операцію, тож спосіб читають
-- із самої транзакції. NULL — історія до 29.07, і вона справді готівкова.
do $$
declare def text; patched text; ind text := repeat(' ', 12);
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'delete_transaction';
  if def is null then raise exception 'delete_transaction не знайдено'; end if;
  patched := def;
  patched := replace(patched, 'DECLARE' || chr(10) || '    tx_record RECORD;',
    'DECLARE' || chr(10) || '    tx_record RECORD;' || chr(10) || '    v_method TEXT;');
  patched := replace(patched,
    '        RAISE EXCEPTION ''Транзакцію з вказаним ID не знайдено'';' || chr(10) || '    END IF;',
    '        RAISE EXCEPTION ''Транзакцію з вказаним ID не знайдено'';' || chr(10) || '    END IF;' || chr(10) || chr(10) ||
    '    v_method := COALESCE(tx_record.payment_method, ''cash'');');
  patched := replace(patched,
    ind || 'UPDATE public.safes' || chr(10) || ind || 'SET balance = balance + tx_record.amount, updated_at = NOW()' || chr(10) || ind || 'WHERE id = tx_record.from_id;',
    ind || 'PERFORM public.safe_apply(tx_record.from_id, tx_record.amount, v_method);');
  patched := replace(patched,
    ind || 'UPDATE public.safes' || chr(10) || ind || 'SET balance = balance - tx_record.amount, updated_at = NOW()' || chr(10) || ind || 'WHERE id = tx_record.to_id;',
    ind || 'PERFORM public.safe_apply(tx_record.to_id, -tx_record.amount, v_method);');
  if patched = def then raise exception 'Патч delete_transaction не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes' then raise exception 'лишився UPDATE по safes'; end if;
  execute patched;

  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'handle_inventory_item_deletion';
  if def is null then raise exception 'handle_inventory_item_deletion не знайдено'; end if;
  patched := def;
  patched := replace(patched,
    '      UPDATE public.safes ' || chr(10) || '      SET balance = balance + tx.amount, updated_at = NOW() ' || chr(10) || '      WHERE id = tx.from_id;',
    '      PERFORM public.safe_apply(tx.from_id, tx.amount, COALESCE(tx.payment_method, ''cash''));');
  if patched = def then raise exception 'Патч handle_inventory_item_deletion не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes' then raise exception 'лишився UPDATE по safes'; end if;
  execute patched;
end $$;
