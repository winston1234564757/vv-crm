-- Migration: Fix withdraw_owner_share RPC signature & types
-- Accepts amount as NUMERIC to match JS/JSON float & integer payloads without schema cache mismatch.

CREATE OR REPLACE FUNCTION public.withdraw_owner_share(
  source_type TEXT,
  source_id UUID,
  amount NUMERIC,
  desc_text TEXT,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance NUMERIC;
  source_name TEXT;
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Сума вилучення має бути більше 0';
  END IF;

  IF source_type = 'safe' THEN
    SELECT balance, name INTO current_balance, source_name FROM public.safes WHERE id = source_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Сейф не знайдено';
    END IF;
    IF current_balance < amount THEN
      RAISE EXCEPTION 'Недостатньо коштів у сейфі "%". Доступно: % грн', source_name, current_balance;
    END IF;
    UPDATE public.safes SET balance = balance - amount WHERE id = source_id;
  ELSIF source_type = 'cash_register' THEN
    SELECT balance, name INTO current_balance, source_name FROM public.cash_registers WHERE id = source_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Касу не знайдено';
    END IF;
    IF current_balance < amount THEN
      RAISE EXCEPTION 'Недостатньо коштів у касі "%". Доступно: % грн', source_name, current_balance;
    END IF;
    UPDATE public.cash_registers SET balance = balance - amount WHERE id = source_id;
  ELSE
    RAISE EXCEPTION 'Невідомий тип джерела (має бути safe або cash_register)';
  END IF;

  INSERT INTO public.transactions (
    amount,
    from_type,
    from_id,
    to_type,
    to_id,
    reference_type,
    description,
    created_by
  ) VALUES (
    amount,
    source_type,
    source_id,
    'external',
    NULL,
    'distribution',
    COALESCE(NULLIF(desc_text, ''), 'Вилучення частки прибутку співвласника'),
    user_id
  );
END;
$$;

-- Also add overload for positional/named params matching amount, desc_text, source_id, source_type, user_id
CREATE OR REPLACE FUNCTION public.withdraw_owner_share(
  amount NUMERIC,
  desc_text TEXT,
  source_id UUID,
  source_type TEXT,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.withdraw_owner_share(source_type, source_id, amount, desc_text, user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_owner_share(TEXT, UUID, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_owner_share(NUMERIC, TEXT, UUID, TEXT, UUID) TO authenticated;
