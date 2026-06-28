-- Migration: Purchase Payment Type (Deferred Payment)
-- 1. Add payment_type column to purchases
-- 2. Update pay_purchase_atomic to allow payment from 'pending' status when prepaid
-- 3. Update receive_purchase_atomic to skip payment step if already prepaid

-- ============================================================
-- 1. ADD payment_type COLUMN TO purchases
-- ============================================================
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'on_receipt'
  CHECK (payment_type IN ('prepaid', 'on_receipt', 'transit'));


-- ============================================================
-- 2. UPDATE pay_purchase_atomic: allow prepaid payment from 'pending' status
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_purchase_atomic(
  p_id UUID,
  p_safe_id UUID,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p_amount INT;
  p_status TEXT;
  p_payment_type TEXT;
  p_supplier_id UUID;
  current_balance INT;
  safe_name TEXT;
  supplier_name TEXT := 'Постачальник';
BEGIN
  -- 1. Validate inputs
  SELECT total_amount, status, supplier_id, payment_type
  INTO p_amount, p_status, p_supplier_id, p_payment_type
  FROM public.purchases
  WHERE id = p_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Закупівлю з ID % не знайдено', p_id;
  END IF;

  IF p_status = 'paid' THEN
    RAISE EXCEPTION 'Закупівлю вже оплачено';
  END IF;

  -- Allow payment from 'pending' only if payment_type = 'prepaid'
  -- For 'on_receipt'/'transit' — must be in 'received' status first
  IF p_status = 'pending' AND p_payment_type != 'prepaid' THEN
    RAISE EXCEPTION 'Спочатку підтвердіть отримання товару перед оплатою';
  END IF;

  -- 2. Check source safe balance
  SELECT balance, name INTO current_balance, safe_name 
  FROM public.safes 
  WHERE id = p_safe_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Сейф для оплати не знайдено';
  END IF;

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Недостатньо коштів на сейфі "%". Доступно: % грн, потрібно: % грн', 
      safe_name, current_balance, p_amount;
  END IF;

  -- 3. Deduct from safe balance
  UPDATE public.safes 
  SET balance = balance - p_amount, updated_at = NOW() 
  WHERE id = p_safe_id;

  -- 4. Update purchase status to 'paid'
  UPDATE public.purchases 
  SET status = 'paid', paid_at = NOW(), paid_from_safe_id = p_safe_id, updated_at = NOW() 
  WHERE id = p_id;

  -- 5. Resolve supplier name
  IF p_supplier_id IS NOT NULL THEN
    SELECT name INTO supplier_name 
    FROM public.suppliers 
    WHERE id = p_supplier_id;
  END IF;

  -- 6. Insert transaction log
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
    'safe',
    p_safe_id,
    'supplier',
    p_supplier_id,
    'purchase',
    p_id,
    CASE 
      WHEN p_payment_type = 'prepaid' THEN 'Передплата за закупівлю постачальнику "' || supplier_name || '" з сейфу ' || safe_name
      ELSE 'Оплата закупівлі постачальнику "' || supplier_name || '" з сейфу ' || safe_name
    END,
    user_id
  );
END;
$$;


-- ============================================================
-- 3. UPDATE receive_purchase_atomic: if prepaid — skip payment prompt
--    (status goes to 'received' but paid_from_safe_id is already set)
-- ============================================================
CREATE OR REPLACE FUNCTION public.receive_purchase_atomic(
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p_status TEXT;
  p_payment_type TEXT;
  item RECORD;
BEGIN
  -- 1. Get purchase status and payment_type
  SELECT status, payment_type INTO p_status, p_payment_type FROM public.purchases WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Закупівлю з ID % не знайдено', p_id;
  END IF;

  -- 2. Idempotency guard: if already received or paid, do nothing
  IF p_status = 'received' OR p_status = 'paid' THEN
    RETURN;
  END IF;

  -- 3. Update purchase status:
  --    - prepaid → stays 'paid' (already paid, just mark received)
  --    - on_receipt/transit → goes to 'received' (awaiting payment)
  UPDATE public.purchases 
  SET 
    status = CASE WHEN p_payment_type = 'prepaid' THEN 'paid' ELSE 'received' END,
    received_at = NOW(), 
    updated_at = NOW() 
  WHERE id = p_id;

  -- 4. Update transit devices to in_stock
  UPDATE public.devices 
  SET status = 'in_stock', updated_at = NOW() 
  WHERE purchase_id = p_id AND status = 'transit';

  -- 5. Loop over accessories and parts to increment stock atomically
  FOR item IN 
    SELECT item_type, item_id, quantity 
    FROM public.purchase_items 
    WHERE purchase_id = p_id
  LOOP
    IF item.item_type = 'accessory' AND item.item_id IS NOT NULL THEN
      UPDATE public.accessories 
      SET stock = stock + item.quantity, updated_at = NOW() 
      WHERE id = item.item_id;
    ELSIF item.item_type = 'part' AND item.item_id IS NOT NULL THEN
      UPDATE public.parts 
      SET stock = stock + item.quantity, updated_at = NOW() 
      WHERE id = item.item_id;
    END IF;
  END LOOP;
END;
$$;
