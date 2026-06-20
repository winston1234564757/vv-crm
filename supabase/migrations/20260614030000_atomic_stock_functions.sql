-- Migration: Atomic Stock Functions (adjust_accessory_stock, adjust_part_stock, sell_accessory)
-- Prevents race conditions and negative stocks in sales, purchases, and stock adjustments

CREATE OR REPLACE FUNCTION public.adjust_accessory_stock(accessory_id UUID, qty INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_stock INT;
BEGIN
  UPDATE public.accessories
  SET stock = GREATEST(0, stock + qty)
  WHERE id = accessory_id
  RETURNING stock INTO new_stock;
  
  RETURN new_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_part_stock(part_id UUID, qty INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_stock INT;
BEGIN
  UPDATE public.parts
  SET stock = GREATEST(0, stock + qty)
  WHERE id = part_id
  RETURNING stock INTO new_stock;
  
  RETURN new_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.sell_accessory(accessory_id UUID, qty INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_rows INT;
BEGIN
  UPDATE public.accessories
  SET stock = stock - qty
  WHERE id = accessory_id AND stock >= qty;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;
