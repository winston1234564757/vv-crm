-- Migration: Sales Deletion Cycle & Partner Trigger Enhancements
-- 1. Update partner reward function to handle DELETE and UPDATE events
-- 2. Bind the trigger to INSERT OR UPDATE OR DELETE on public.sales
-- 3. Create delete_sale Stored Procedure (RPC) for atomic cascade rollback

-- ============================================================
-- 1. UPDATE PARTNER BALANCE TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_partner_balance_on_sale() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_reward_percent INTEGER;
    v_reward_amount NUMERIC;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.partner_id IS NOT NULL THEN
            SELECT reward_percent INTO v_reward_percent FROM public.partners WHERE id = NEW.partner_id;
            IF v_reward_percent > 0 THEN
                v_reward_amount := (NEW.total_amount * v_reward_percent) / 100.0;
                UPDATE public.partners SET balance = balance + v_reward_amount WHERE id = NEW.partner_id;
            END IF;
        END IF;
        
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.partner_id IS NOT NULL THEN
            SELECT reward_percent INTO v_reward_percent FROM public.partners WHERE id = OLD.partner_id;
            IF v_reward_percent > 0 THEN
                v_reward_amount := (OLD.total_amount * v_reward_percent) / 100.0;
                UPDATE public.partners SET balance = balance - v_reward_amount WHERE id = OLD.partner_id;
            END IF;
        END IF;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- If partner_id changed OR total_amount changed, update rewards accordingly
        IF COALESCE(OLD.partner_id, '00000000-0000-0000-0000-000000000000'::uuid) <> COALESCE(NEW.partner_id, '00000000-0000-0000-0000-000000000000'::uuid) 
           OR OLD.total_amount <> NEW.total_amount THEN
            
            -- Deduct old reward from the old partner
            IF OLD.partner_id IS NOT NULL THEN
                SELECT reward_percent INTO v_reward_percent FROM public.partners WHERE id = OLD.partner_id;
                IF v_reward_percent > 0 THEN
                    v_reward_amount := (OLD.total_amount * v_reward_percent) / 100.0;
                    UPDATE public.partners SET balance = balance - v_reward_amount WHERE id = OLD.partner_id;
                END IF;
            END IF;
            
            -- Add new reward to the new partner
            IF NEW.partner_id IS NOT NULL THEN
                SELECT reward_percent INTO v_reward_percent FROM public.partners WHERE id = NEW.partner_id;
                IF v_reward_percent > 0 THEN
                    v_reward_amount := (NEW.total_amount * v_reward_percent) / 100.0;
                    UPDATE public.partners SET balance = balance + v_reward_amount WHERE id = NEW.partner_id;
                END IF;
            END IF;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Recreate trigger on public.sales
DROP TRIGGER IF EXISTS on_sale_created ON public.sales;
CREATE TRIGGER on_sale_created
  AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.update_partner_balance_on_sale();


-- ============================================================
-- 2. ATOMIC DELETE SALE STORED PROCEDURE (RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_sale(sale_id_to_delete UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- runs with database owner privileges to bypass standard RLS restrictions for updates/deletes
AS $$
DECLARE
    item_record RECORD;
    payment_record RECORD;
BEGIN
    -- 1. Verify sale existence
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE id = sale_id_to_delete) THEN
        RAISE EXCEPTION 'Продаж із вказаним ID не знайдено';
    END IF;

    -- 2. Restore Inventory Stock for sold items
    FOR item_record IN 
        SELECT item_type, item_id, quantity 
        FROM public.sale_items 
        WHERE sale_id = sale_id_to_delete
    LOOP
        IF item_record.item_type = 'device' THEN
            UPDATE public.devices 
            SET status = 'in_stock', updated_at = NOW() 
            WHERE id = item_record.item_id;
            
        ELSIF item_record.item_type = 'accessory' THEN
            UPDATE public.accessories 
            SET stock = stock + item_record.quantity, updated_at = NOW() 
            WHERE id = item_record.item_id;
            
        ELSIF item_record.item_type = 'part' THEN
            UPDATE public.parts 
            SET stock = stock + item_record.quantity, updated_at = NOW() 
            WHERE id = item_record.item_id;
        END IF;
    END LOOP;

    -- 3. Restore Cash Register Balances (deduct payment splits amounts)
    FOR payment_record IN 
        SELECT cash_register_id, amount 
        FROM public.payment_splits 
        WHERE sale_id = sale_id_to_delete
    LOOP
        UPDATE public.cash_registers 
        SET balance = balance - payment_record.amount, updated_at = NOW() 
        WHERE id = payment_record.cash_register_id;
    END LOOP;

    -- 4. Delete associated transactions ledger records
    DELETE FROM public.transactions 
    WHERE reference_type = 'sale' AND reference_id = sale_id_to_delete;

    -- 5. Delete the sale header (this will automatically cascade-delete sale_items and payment_splits)
    DELETE FROM public.sales 
    WHERE id = sale_id_to_delete;
    
    -- NOTE: Customer stats total_spent and total_visits are automatically updated 
    -- by the existing trigger trigger_sales_customer_stats AFTER DELETE ON public.sales.
END;
$$;
