-- delete_transaction повертав кошти за витрату ДВІЧІ: спершу у власному блоці
-- expense, потім знову в загальному блоці "повернути відправнику" (from_type='safe'
-- не виключав витрату). Скасування витрати 3 400 ₴ додало в сейф 6 800 ₴.
--
-- Фікс: витрата і загальний рух коштів тепер взаємовиключні гілки (IF/ELSE),
-- тож реверс балансу відбувається рівно один раз.

CREATE OR REPLACE FUNCTION public.delete_transaction(transaction_id_to_delete uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

    -- 3. Реверс балансу. Витрата і загальний рух — ВЗАЄМОВИКЛЮЧНІ гілки.
    --    Раніше блок витрати повертав кошти джерелу, а потім загальний блок
    --    "повернути відправнику" повертав їх ЩЕ РАЗ — сейф отримував суму двічі.
    --    Тепер витрата обробляється лише у своїй гілці, реверс рівно один раз.
    IF tx_record.reference_type = 'expense' AND tx_record.reference_id IS NOT NULL THEN
        -- Витрату оплачено з джерела — повертаємо кошти назад рівно один раз.
        IF tx_record.from_type = 'cash_register' AND tx_record.from_id IS NOT NULL THEN
            UPDATE public.cash_registers
            SET balance = balance + tx_record.amount, updated_at = NOW()
            WHERE id = tx_record.from_id;
        ELSIF tx_record.from_type = 'safe' AND tx_record.from_id IS NOT NULL THEN
            UPDATE public.safes
            SET balance = balance + tx_record.amount, updated_at = NOW()
            WHERE id = tx_record.from_id;
        END IF;

        -- Видаляємо сам запис витрати
        DELETE FROM public.expenses WHERE id = tx_record.reference_id;
    ELSE
        -- Внутрішні розподіли, перекази, поповнення, коригування.
        -- Зняти з отримувача (він отримав кошти)
        IF tx_record.to_type = 'cash_register' AND tx_record.to_id IS NOT NULL THEN
            UPDATE public.cash_registers
            SET balance = balance - tx_record.amount, updated_at = NOW()
            WHERE id = tx_record.to_id;
        ELSIF tx_record.to_type = 'safe' AND tx_record.to_id IS NOT NULL THEN
            UPDATE public.safes
            SET balance = balance - tx_record.amount, updated_at = NOW()
            WHERE id = tx_record.to_id;
        END IF;

        -- Повернути відправнику (він відправив кошти)
        IF tx_record.from_type = 'cash_register' AND tx_record.from_id IS NOT NULL THEN
            UPDATE public.cash_registers
            SET balance = balance + tx_record.amount, updated_at = NOW()
            WHERE id = tx_record.from_id;
        ELSIF tx_record.from_type = 'safe' AND tx_record.from_id IS NOT NULL THEN
            UPDATE public.safes
            SET balance = balance + tx_record.amount, updated_at = NOW()
            WHERE id = tx_record.from_id;
        END IF;
    END IF;

    -- 4. Delete the transaction record itself
    DELETE FROM public.transactions WHERE id = transaction_id_to_delete;
END;
$function$;
