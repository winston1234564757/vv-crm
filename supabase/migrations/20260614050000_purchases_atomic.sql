-- Migration: Stored Procedures for Atomic Purchase Actions
-- 1. public.receive_purchase_atomic: atomically updates devices, accessories, parts stock and updates status to received
-- 2. public.pay_purchase_atomic: atomically checks safe balance, deducts money, registers transactions and updates status to paid

-- ============================================================
-- 1. ATOMIC RECEIVE PURCHASE
-- ============================================================
CREATE OR REPLACE FUNCTION public.receive_purchase_atomic(
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- bypasses direct RLS restrictions for updates
AS $$
DECLARE
  p_status TEXT;
  item RECORD;
BEGIN
  -- 1. Get purchase status
  SELECT status INTO p_status FROM public.purchases WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Закупівлю з ID % не знайдено', p_id;
  END IF;

  -- 2. Idempotency guard: if already received or paid, do nothing
  IF p_status = 'received' OR p_status = 'paid' THEN
    RETURN;
  END IF;

  -- 3. Update purchase status
  UPDATE public.purchases 
  SET status = 'received', received_at = NOW(), updated_at = NOW() 
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


-- ============================================================
-- 2. ATOMIC PAY PURCHASE
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_purchase_atomic(
  p_id UUID,
  p_safe_id UUID,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- bypasses direct RLS restrictions for safes and purchases update
AS $$
DECLARE
  p_amount INT;
  p_status TEXT;
  p_supplier_id UUID;
  current_balance INT;
  safe_name TEXT;
  supplier_name TEXT := 'Постачальник';
BEGIN
  -- 1. Validate inputs
  SELECT total_amount, status, supplier_id INTO p_amount, p_status, p_supplier_id 
  FROM public.purchases 
  WHERE id = p_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Закупівлю з ID % не знайдено', p_id;
  END IF;

  IF p_status = 'paid' THEN
    RAISE EXCEPTION 'Закупівлю вже оплачено';
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

  -- 4. Update purchase status
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
    'Оплата закупівлі постачальнику "' || supplier_name || '" з сейфу ' || safe_name,
    user_id
  );
END;
$$;
