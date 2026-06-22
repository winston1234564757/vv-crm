-- Migration: Inventory Safes Deduction and Transaction Types Mapping
-- 1. Recreate the check constraint on transactions(reference_type) to support device, accessory, and part.
-- 2. Create purchase_inventory_item RPC for atomic deduction & transaction logging.
-- 3. Create handle_inventory_item_deletion trigger function and triggers for automated safe refund.
-- 4. Update delete_transaction RPC to block direct deletion of inventory item transactions.

-- ============================================================
-- 1. ALTER REFERENCE_TYPE CHECK CONSTRAINT ON TRANSACTIONS
-- ============================================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_reference_type_check;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_reference_type_check 
  CHECK (reference_type IN (
    'sale', 'repair_payment', 'purchase', 'expense', 
    'distribution', 'top_up', 'adjustment', 
    'device', 'accessory', 'part'
  ));


-- ============================================================
-- 2. CREATE PURCHASE INVENTORY ITEM RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.purchase_inventory_item(
  item_type TEXT,
  item_id UUID,
  safe_id UUID,
  amount INT,
  description TEXT,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges to bypass standard RLS restrictions for safes/transactions
AS $$
DECLARE
  current_balance INT;
  safe_name TEXT;
BEGIN
  -- 1. Validate inputs
  IF item_type NOT IN ('device', 'accessory', 'part') THEN
    RAISE EXCEPTION 'Невалідний тип сутності';
  END IF;

  IF amount <= 0 THEN
    RAISE EXCEPTION 'Сума закупівлі має бути більше 0';
  END IF;

  -- 2. Check safe balance
  SELECT balance, name INTO current_balance, safe_name FROM public.safes WHERE id = safe_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Сейф для списання коштів не знайдено';
  END IF;

  IF current_balance < amount THEN
    RAISE EXCEPTION 'Недостатньо коштів на сейфі "%". Доступно: % грн', safe_name, current_balance;
  END IF;

  -- 3. Deduct from safe balance
  UPDATE public.safes SET balance = balance - amount WHERE id = safe_id;

  -- 4. Insert transaction log
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
    safe_id,
    'external',
    NULL,
    item_type,
    item_id,
    description,
    user_id
  );
END;
$$;


-- ============================================================
-- 3. CREATE AUTOMATIC REFUND TRIGGER ON INVENTORY DELETION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_inventory_item_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- runs with database owner privileges to bypass RLS restrictions on updates/deletes
AS $$
DECLARE
  v_ref_type TEXT;
  tx RECORD;
BEGIN
  -- Map table name to singular reference type
  IF TG_TABLE_NAME = 'devices' THEN
    v_ref_type := 'device';
  ELSIF TG_TABLE_NAME = 'accessories' THEN
    v_ref_type := 'accessory';
  ELSIF TG_TABLE_NAME = 'parts' THEN
    v_ref_type := 'part';
  ELSE
    RETURN OLD;
  END IF;

  -- Find and process transactions linked to the deleted item
  FOR tx IN 
    SELECT * FROM public.transactions 
    WHERE reference_type = v_ref_type AND reference_id = OLD.id
  LOOP
    -- Refund the money to the safe
    IF tx.from_type = 'safe' AND tx.from_id IS NOT NULL THEN
      UPDATE public.safes 
      SET balance = balance + tx.amount, updated_at = NOW() 
      WHERE id = tx.from_id;
    END IF;
    
    -- Delete the transaction itself
    DELETE FROM public.transactions WHERE id = tx.id;
  END LOOP;
  
  RETURN OLD;
END;
$$;

-- Bind triggers (DROP first to prevent duplicate trigger errors)
DROP TRIGGER IF EXISTS on_device_deleted ON public.devices;
CREATE TRIGGER on_device_deleted
  BEFORE DELETE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.handle_inventory_item_deletion();

DROP TRIGGER IF EXISTS on_accessory_deleted ON public.accessories;
CREATE TRIGGER on_accessory_deleted
  BEFORE DELETE ON public.accessories
  FOR EACH ROW EXECUTE FUNCTION public.handle_inventory_item_deletion();

DROP TRIGGER IF EXISTS on_part_deleted ON public.parts;
CREATE TRIGGER on_part_deleted
  BEFORE DELETE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.handle_inventory_item_deletion();


-- ============================================================
-- 4. UPDATE ATOMIC DELETE TRANSACTION RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_transaction(transaction_id_to_delete UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- runs with database owner privileges to bypass standard RLS restrictions for updates/deletes
AS $$
DECLARE
    tx_record RECORD;
BEGIN
    -- 1. Fetch transaction details and verify existence
    SELECT * INTO tx_record FROM public.transactions WHERE id = transaction_id_to_delete;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Транзакцію з вказаним ID не знайдено';
    END IF;

    -- 2. Enforce system references constraint (prevent raw deletion of sales, repairs, purchases payments, and inventory items)
    IF tx_record.reference_type IN ('sale', 'repair_payment', 'purchase', 'device', 'accessory', 'part') THEN
        RAISE EXCEPTION 'Транзакції цієї сутності не можна видалити напряму. Будь ласка, видаліть первинну сутність (продаж/ремонт/закупівлю/товар).';
    END IF;

    -- 3. If transaction is linked to an expense, delete the linked expense record
    IF tx_record.reference_type = 'expense' AND tx_record.reference_id IS NOT NULL THEN
        -- Revert balance: since expense was paid out from safe, we refund it back to the safe
        IF tx_record.from_type = 'safe' AND tx_record.from_id IS NOT NULL THEN
            UPDATE public.safes 
            SET balance = balance + tx_record.amount, updated_at = NOW() 
            WHERE id = tx_record.from_id;
        END IF;

        -- Delete the expense itself
        DELETE FROM public.expenses WHERE id = tx_record.reference_id;
    END IF;

    -- 4. Revert balance adjustments for internal distributions, transfers, top-ups, and adjustments
    -- Deduct from destination (since it received the money)
    IF tx_record.to_type = 'cash_register' AND tx_record.to_id IS NOT NULL THEN
        UPDATE public.cash_registers 
        SET balance = balance - tx_record.amount, updated_at = NOW() 
        WHERE id = tx_record.to_id;
    ELSIF tx_record.to_type = 'safe' AND tx_record.to_id IS NOT NULL THEN
        UPDATE public.safes 
        SET balance = balance - tx_record.amount, updated_at = NOW() 
        WHERE id = tx_record.to_id;
    END IF;

    -- Add back to source (since it sent the money)
    IF tx_record.from_type = 'cash_register' AND tx_record.from_id IS NOT NULL THEN
        UPDATE public.cash_registers 
        SET balance = balance + tx_record.amount, updated_at = NOW() 
        WHERE id = tx_record.from_id;
    ELSIF tx_record.from_type = 'safe' AND tx_record.from_id IS NOT NULL THEN
        UPDATE public.safes 
        SET balance = balance + tx_record.amount, updated_at = NOW() 
        WHERE id = tx_record.from_id;
    END IF;

    -- 5. Delete the transaction record itself
    DELETE FROM public.transactions WHERE id = transaction_id_to_delete;
END;
$$;
