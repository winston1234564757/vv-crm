-- `process_pos_sale` уже приймає касу на кожен платіж, а `process_quick_sale` —
-- одну на весь чек. Через це швидкий продаж зі сплітом «частина готівкою,
-- частина карткою» не може розкласти гроші по різних касах.
--
-- Функція патчиться з її ж живого визначення, а не переписується вручну:
-- механічна транскрипція бойової функції оплати — зайвий ризик одруківки там,
-- де вона коштує грошей.
do $$
declare
  def text;
  patched text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'process_quick_sale';

  if def is null then
    raise exception 'process_quick_sale не знайдено';
  end if;

  patched := def;

  patched := replace(patched,
    '  v_method_text TEXT;',
    '  v_method_text TEXT;' || chr(10) || '  v_register_id UUID;');

  patched := replace(patched,
    '    INSERT INTO public.payment_splits (sale_id, amount, method, cash_register_id)' || chr(10) ||
    '    VALUES (v_sale_id, v_amount, v_method, p_cash_register_id);',
    '    v_register_id := COALESCE(NULLIF(v_payment->>''cash_register_id'', '''')::uuid, p_cash_register_id);' || chr(10) || chr(10) ||
    '    INSERT INTO public.payment_splits (sale_id, amount, method, cash_register_id)' || chr(10) ||
    '    VALUES (v_sale_id, v_amount, v_method, v_register_id);');

  patched := replace(patched,
    'p_customer_id, ''cash_register'', p_cash_register_id, ''sale'', v_sale_id,',
    'p_customer_id, ''cash_register'', v_register_id, ''sale'', v_sale_id,');

  patched := replace(patched,
    'UPDATE public.cash_registers SET balance = balance + v_amount WHERE id = p_cash_register_id;',
    'UPDATE public.cash_registers SET balance = balance + v_amount WHERE id = v_register_id;');

  if patched = def then
    raise exception 'Патч process_quick_sale не застосувався';
  end if;
  if position('v_register_id' in patched) = 0 then
    raise exception 'Патч process_quick_sale неповний';
  end if;

  execute patched;
end $$;
