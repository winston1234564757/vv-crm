-- Migration: Add top_up_safe RPC function for external safe deposits
CREATE OR REPLACE FUNCTION public.top_up_safe(
  p_safe_id UUID,
  p_amount INT,
  p_desc_text TEXT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges to bypass standard RLS write restrictions on safes/transactions
AS $$
DECLARE
  v_safe_name TEXT;
BEGIN
  -- 1. Validation
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Сума поповнення має бути більше 0';
  END IF;

  SELECT name INTO v_safe_name FROM public.safes WHERE id = p_safe_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Сейф для поповнення не знайдено';
  END IF;

  -- 2. Update Safe Balance
  UPDATE public.safes 
  SET balance = balance + p_amount 
  WHERE id = p_safe_id;

  -- 3. Write Ledger Transaction Log
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
    p_amount,
    'external', -- Money source is external (personal wallet)
    NULL,
    'safe',     -- Target is a safe
    p_safe_id,
    'top_up',   -- Transaction reference type is top_up
    NULL,
    COALESCE(p_desc_text, 'Поповнення сейфу з особистого гаманця'),
    p_user_id
  );
END;
$$;
