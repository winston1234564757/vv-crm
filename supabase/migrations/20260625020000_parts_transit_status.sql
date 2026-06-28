-- Migration: Parts Transit Status
-- Adds status field to parts (transit / in_stock) and purchase_id link
-- Enables proper warehouse receiving flow like devices

-- ============================================================
-- 1. ADD status COLUMN TO parts
-- ============================================================
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_stock'
  CHECK (status IN ('transit', 'in_stock'));

-- ============================================================
-- 2. ADD purchase_id LINK (optional, for purchase tracking)
-- ============================================================
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL;

-- NOTE: Existing parts with stock=0 that are allocated to repairs are
-- correctly showing stock=0. We do NOT change their status — they are
-- consumed/reserved. The 'transit' status is only for NEW parts added
-- via purchases that haven't been physically received yet.

-- ============================================================
-- 3. INDEX for filtering by status
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_parts_status ON public.parts(status);

-- ============================================================
-- 4. RPC: receive_part_transit — marks a transit part as received
-- ============================================================
CREATE OR REPLACE FUNCTION public.receive_part_transit(
  p_part_id UUID,
  p_quantity INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.parts WHERE id = p_part_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Деталь з ID % не знайдено', p_part_id;
  END IF;

  IF v_status = 'in_stock' THEN
    RETURN; -- idempotent
  END IF;

  UPDATE public.parts
  SET
    status = 'in_stock',
    stock = stock + p_quantity,
    updated_at = NOW()
  WHERE id = p_part_id;
END;
$$;

-- ============================================================
-- 5. UPDATE receive_purchase_atomic: already handles parts stock increment
--    but now also needs to set parts status = 'in_stock' if transit
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
  SELECT status, payment_type INTO p_status, p_payment_type FROM public.purchases WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Закупівлю з ID % не знайдено', p_id;
  END IF;

  IF p_status = 'received' OR p_status = 'paid' THEN
    RETURN;
  END IF;

  UPDATE public.purchases 
  SET 
    status = CASE WHEN p_payment_type = 'prepaid' THEN 'paid' ELSE 'received' END,
    received_at = NOW(), 
    updated_at = NOW() 
  WHERE id = p_id;

  -- Update transit devices to in_stock
  UPDATE public.devices 
  SET status = 'in_stock', updated_at = NOW() 
  WHERE purchase_id = p_id AND status = 'transit';

  -- Loop over accessories and parts to increment stock and update status
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
      SET 
        stock = stock + item.quantity, 
        status = 'in_stock',
        updated_at = NOW() 
      WHERE id = item.item_id;
    END IF;
  END LOOP;
END;
$$;
