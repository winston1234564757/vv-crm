-- Migration: Stored Procedures for Expenses and Cash Distribution
-- 1. public.create_expense: atomically registers an expense and updates safe balance
-- 2. public.distribute_register_funds: atomically distributes register money into opex, growth, and net profit safes

-- ============================================================
-- 1. CREATE EXPENSE PROCEDURE
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_expense(
  category_id UUID,
  amount INT,
  paid_from_safe_id UUID,
  description TEXT,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- bypasses direct RLS restrictions for safes update
AS $$
DECLARE
  current_balance INT;
  safe_name TEXT;
  expense_id UUID;
BEGIN
  -- 1. Validate inputs
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Сума витрати має бути більше 0';
  END IF;

  -- 2. Check source safe balance
  SELECT balance, name INTO current_balance, safe_name FROM public.safes WHERE id = paid_from_safe_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Сейф для оплати не знайдено';
  END IF;

  IF current_balance < amount THEN
    RAISE EXCEPTION 'Недостатньо коштів на сейфі "%". Доступно: % грн', safe_name, current_balance;
  END IF;

  -- 3. Deduct from safe balance
  UPDATE public.safes SET balance = balance - amount WHERE id = paid_from_safe_id;

  -- 4. Insert expense record
  INSERT INTO public.expenses (
    category_id,
    amount,
    paid_from_safe_id,
    description,
    created_by
  ) VALUES (
    category_id,
    amount,
    paid_from_safe_id,
    description,
    user_id
  ) RETURNING id INTO expense_id;

  -- 5. Insert transaction log
  INSERT INTO public.transactions (
    amount,
    from_type,
    from_id,
    to_type,
    to_id,
    reference_type,
    reference_id,
    description,
    created_by
  ) VALUES (
    amount,
    'safe',
    paid_from_safe_id,
    'external',
    NULL,
    'expense',
    expense_id,
    COALESCE(description, 'Витрата з сейфу ' || safe_name),
    user_id
  );
END;
$$;


-- ============================================================
-- 2. DISTRIBUTE REGISTER FUNDS PROCEDURE
-- ============================================================
CREATE OR REPLACE FUNCTION public.distribute_register_funds(
  cash_register_id UUID,
  amount INT,
  opex_amount INT,
  growth_amount INT,
  net_profit_amount INT,
  desc_text TEXT,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- bypasses direct RLS restrictions for cash registers & safes update
AS $$
DECLARE
  current_balance INT;
  reg_name TEXT;
  opex_id UUID;
  growth_id UUID;
  net_profit_id UUID;
BEGIN
  -- 1. Validate inputs
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Сума розподілу має бути більше 0';
  END IF;

  IF (opex_amount + growth_amount + net_profit_amount) <> amount THEN
    RAISE EXCEPTION 'Сума частин розподілу (% + % + % = %) має дорівнювати загальній сумі (%)', 
      opex_amount, growth_amount, net_profit_amount, (opex_amount + growth_amount + net_profit_amount), amount;
  END IF;

  -- 2. Verify cash register existence and balance
  SELECT balance, name INTO current_balance, reg_name FROM public.cash_registers WHERE id = cash_register_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Касу не знайдено';
  END IF;

  IF current_balance < amount THEN
    RAISE EXCEPTION 'Недостатньо коштів у касі "%". Доступно: % грн', reg_name, current_balance;
  END IF;

  -- 3. Resolve destination safes
  SELECT id INTO opex_id FROM public.safes WHERE type = 'opex';
  SELECT id INTO growth_id FROM public.safes WHERE type = 'growth';
  SELECT id INTO net_profit_id FROM public.safes WHERE type = 'net_profit';

  IF opex_id IS NULL OR growth_id IS NULL OR net_profit_id IS NULL THEN
    RAISE EXCEPTION 'Один або кілька цільових сейфів не знайдено у базі даних';
  END IF;

  -- 4. Deduct from cash register
  UPDATE public.cash_registers SET balance = balance - amount WHERE id = cash_register_id;

  -- 5. Add to safes
  UPDATE public.safes SET balance = balance + opex_amount WHERE id = opex_id;
  UPDATE public.safes SET balance = balance + growth_amount WHERE id = growth_id;
  UPDATE public.safes SET balance = balance + net_profit_amount WHERE id = net_profit_id;

  -- 6. Insert transaction logs for each destination
  -- OPEX Transaction
  IF opex_amount > 0 THEN
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
      opex_amount,
      'cash_register',
      cash_register_id,
      'safe',
      opex_id,
      'distribution',
      COALESCE(desc_text, 'Розподіл каси: ' || reg_name || ' ➔ OPEX'),
      user_id
    );
  END IF;

  -- Growth Transaction
  IF growth_amount > 0 THEN
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
      growth_amount,
      'cash_register',
      cash_register_id,
      'safe',
      growth_id,
      'distribution',
      COALESCE(desc_text, 'Розподіл каси: ' || reg_name || ' ➔ Growth'),
      user_id
    );
  END IF;

  -- Net Profit Transaction
  IF net_profit_amount > 0 THEN
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
      net_profit_amount,
      'cash_register',
      cash_register_id,
      'safe',
      net_profit_id,
      'distribution',
      COALESCE(desc_text, 'Розподіл каси: ' || reg_name || ' ➔ Чистий прибуток'),
      user_id
    );
  END IF;
END;
$$;
