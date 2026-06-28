-- Add status column to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.sales ADD CONSTRAINT sales_status_check CHECK (status IN ('completed', 'refunded'));

-- Create refund_sale RPC
CREATE OR REPLACE FUNCTION public.refund_sale(sale_id_to_refund UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item_record RECORD;
    payment_record RECORD;
BEGIN
    -- 1. Verify sale existence and not already refunded
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE id = sale_id_to_refund AND status = 'completed') THEN
        RAISE EXCEPTION 'Продаж не знайдено або він вже повернутий';
    END IF;

    -- 2. Restore Inventory Stock
    FOR item_record IN 
        SELECT item_type, item_id, quantity 
        FROM public.sale_items 
        WHERE sale_id = sale_id_to_refund
    LOOP
        IF item_record.item_type = 'device' THEN
            UPDATE public.devices SET status = 'in_stock', updated_at = NOW() WHERE id = item_record.item_id;
        ELSIF item_record.item_type = 'accessory' THEN
            UPDATE public.accessories SET stock = stock + item_record.quantity, updated_at = NOW() WHERE id = item_record.item_id;
        ELSIF item_record.item_type = 'part' THEN
            UPDATE public.parts SET stock = stock + item_record.quantity, updated_at = NOW() WHERE id = item_record.item_id;
        END IF;
    END LOOP;

    -- 3. Restore Cash Register Balances and create refund transactions
    FOR payment_record IN 
        SELECT cash_register_id, amount 
        FROM public.payment_splits 
        WHERE sale_id = sale_id_to_refund
    LOOP
        -- Deduct balance from safe
        UPDATE public.cash_registers 
        SET balance = balance - payment_record.amount, updated_at = NOW() 
        WHERE id = payment_record.cash_register_id;
        
        -- Create a refund transaction to keep the ledger history intact
        INSERT INTO public.transactions (
            amount,
            from_type,
            from_id,
            to_type,
            to_id,
            reference_type,
            reference_id,
            description
        ) VALUES (
            payment_record.amount,
            'cash_register',
            payment_record.cash_register_id,
            'external',
            NULL,
            'refund',
            sale_id_to_refund,
            'Повернення продажу #' || SUBSTRING(sale_id_to_refund::text, 1, 8)
        );
    END LOOP;

    -- 4. Mark sale as refunded
    UPDATE public.sales SET status = 'refunded' WHERE id = sale_id_to_refund;
END;
$$;
