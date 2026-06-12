-- Migration: Security and Transactions Hardening
-- 1. Hardening RLS policies for settings, safes, and transactions
-- 2. Creating transfer_funds Stored Procedure (RPC) for atomic operations

-- ============================================================
-- 1. HARDEN RLS FOR SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.settings;

-- Allow SELECT for all authenticated users
CREATE POLICY "Enable SELECT for authenticated users" 
  ON public.settings FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow INSERT/UPDATE/DELETE only for users with 'owner' role
CREATE POLICY "Enable WRITE for owners only" 
  ON public.settings FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
    )
  );


-- ============================================================
-- 2. HARDEN RLS FOR SAFES
-- ============================================================
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.safes;

-- Allow SELECT/INSERT/UPDATE/DELETE only for owners and managers
CREATE POLICY "Enable ALL for owners and managers on safes" 
  ON public.safes FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('owner', 'manager')
    )
  );


-- ============================================================
-- 3. HARDEN RLS FOR TRANSACTIONS
-- ============================================================
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.transactions;

-- Allow SELECT only for owners and managers
CREATE POLICY "Enable SELECT for owners and managers on transactions" 
  ON public.transactions FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('owner', 'manager')
    )
  );

-- Allow INSERT for all authenticated users (sales/techs create transactions during checkout)
CREATE POLICY "Enable INSERT for all authenticated users" 
  ON public.transactions FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.role() = 'authenticated');

-- Note: UPDATE and DELETE are NOT defined, preventing any modification of financial logs


-- ============================================================
-- 4. ATOMIC TRANSFER FUNDS RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.transfer_funds(
  from_id UUID,
  from_type TEXT,
  to_id UUID,
  to_type TEXT,
  amount INT,
  desc_text TEXT,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- bypasses the direct write restrictions on safes/registers
AS $$
DECLARE
  source_balance INT;
  source_name TEXT;
  dest_name TEXT;
BEGIN
  -- 1. Check parameters validation
  IF from_type NOT IN ('cash_register', 'safe') OR to_type NOT IN ('cash_register', 'safe') THEN
    RAISE EXCEPTION 'Невалідний тип джерела або одержувача';
  END IF;

  IF amount <= 0 THEN
    RAISE EXCEPTION 'Сума переказу має бути більше 0';
  END IF;

  IF from_id = to_id AND from_type = to_type THEN
    RAISE EXCEPTION 'Джерело та одержувач не можуть бути однаковими';
  END IF;

  -- 2. Verify source balance and resolve name
  IF from_type = 'cash_register' THEN
    SELECT balance, name INTO source_balance, source_name FROM public.cash_registers WHERE id = from_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Касу відправника не знайдено';
    END IF;
  ELSE
    SELECT balance, name INTO source_balance, source_name FROM public.safes WHERE id = from_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Сейф відправника не знайдено';
    END IF;
  END IF;

  IF source_balance < amount THEN
    RAISE EXCEPTION 'Недостатньо коштів. Доступно: % грн', source_balance;
  END IF;

  -- 3. Resolve destination name
  IF to_type = 'cash_register' THEN
    SELECT name INTO dest_name FROM public.cash_registers WHERE id = to_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Касу одержувача не знайдено';
    END IF;
  ELSE
    SELECT name INTO dest_name FROM public.safes WHERE id = to_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Сейф одержувача не знайдено';
    END IF;
  END IF;

  -- 4. Deduct from source
  IF from_type = 'cash_register' THEN
    UPDATE public.cash_registers SET balance = balance - amount WHERE id = from_id;
  ELSE
    UPDATE public.safes SET balance = balance - amount WHERE id = from_id;
  END IF;

  -- 5. Add to destination
  IF to_type = 'cash_register' THEN
    UPDATE public.cash_registers SET balance = balance + amount WHERE id = to_id;
  ELSE
    UPDATE public.safes SET balance = balance + amount WHERE id = to_id;
  END IF;

  -- 6. Insert transaction
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
    from_type,
    from_id,
    to_type,
    to_id,
    'distribution',
    COALESCE(desc_text, 'Внутрішній переказ: ' || source_name || ' ➔ ' || dest_name),
    user_id
  );
END;
$$;
