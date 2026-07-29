-- Розподіл кладе в ту половину, з якої взяв: каса типу `cashless` — у
-- безготівкову, будь-яка інша — у готівкову. Параметра не додаємо, тож
-- сигнатура й виклик із TypeScript лишаються незмінними.
do $$
declare def text; patched text; n int;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
  where n2.nspname = 'public' and p.proname = 'distribute_register_funds';
  if def is null then raise exception 'distribute_register_funds не знайдено'; end if;

  patched := def;

  patched := replace(patched,
    'DECLARE' || chr(10) || '  current_balance INT;',
    'DECLARE' || chr(10) || '  v_method TEXT;' || chr(10) || '  current_balance INT;');

  patched := replace(patched,
    'SELECT balance, name INTO current_balance, reg_name FROM public.cash_registers WHERE id = cash_register_id;',
    'SELECT balance, name, CASE WHEN type = ''cashless'' THEN ''cashless'' ELSE ''cash'' END' || chr(10) ||
    '    INTO current_balance, reg_name, v_method' || chr(10) ||
    '  FROM public.cash_registers WHERE id = cash_register_id;');

  patched := replace(patched,
    'UPDATE public.safes SET balance = balance + opex_amount WHERE id = opex_id;',
    'PERFORM public.safe_apply(opex_id, opex_amount, v_method);');
  patched := replace(patched,
    'UPDATE public.safes SET balance = balance + growth_amount WHERE id = growth_id;',
    'PERFORM public.safe_apply(growth_id, growth_amount, v_method);');
  patched := replace(patched,
    'UPDATE public.safes SET balance = balance + net_profit_amount WHERE id = net_profit_id;',
    'PERFORM public.safe_apply(net_profit_id, net_profit_amount, v_method);');

  patched := replace(patched,
    '      created_by' || chr(10) || '    ) VALUES (',
    '      created_by,' || chr(10) || '      payment_method' || chr(10) || '    ) VALUES (');
  patched := replace(patched,
    '      user_id' || chr(10) || '    );',
    '      user_id,' || chr(10) || '      v_method' || chr(10) || '    );');

  if patched = def then raise exception 'Патч distribute_register_funds не застосувався'; end if;
  if patched ~* 'UPDATE public\.safes SET balance' then
    raise exception 'У distribute_register_funds лишився прямий UPDATE по safes';
  end if;
  select count(*) into n from regexp_matches(patched, 'safe_apply', 'g');
  if n <> 3 then raise exception 'Очікували 3 виклики safe_apply, знайшли %', n; end if;

  execute patched;
end $$;
