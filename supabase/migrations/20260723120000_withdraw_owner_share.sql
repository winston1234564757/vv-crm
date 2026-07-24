-- Migration: Withdraw Owner Share Procedure
-- Atomically deducts funds from safe or cash register for owner profit withdrawal and logs transaction without affecting OPEX/expenses.

CREATE OR REPLACE FUNCTION public.withdraw_owner_share(
  source_type TEXT,
  source_id UUID,
  amount INT,
  desc_text TEXT,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INT;
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
