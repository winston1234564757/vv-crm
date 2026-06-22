-- Migration: Atomic Transaction and Transfer Deletion
-- 1. Create public.delete_transaction stored procedure (RPC) for atomic cash adjustments and deletions.

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

    -- 2. Enforce system references constraint (prevent raw deletion of sales, repairs, purchases payments)
    IF tx_record.reference_type IN ('sale', 'repair_payment', 'purchase') THEN
        RAISE EXCEPTION 'Транзакції продажів, ремонтів та закупівель не можна видалити напряму. Будь ласка, видаліть первинну сутність (продаж/ремонт/закупівлю).';
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
