-- Migration to fix sales warranty fields and partner trigger
-- 1. Add warranty_end column if it does not exist
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS warranty_end DATE;

-- 2. Correct the trigger function to use 'total_amount' instead of 'amount'
CREATE OR REPLACE FUNCTION update_partner_balance_on_sale() RETURNS TRIGGER AS $$
DECLARE
    v_reward_percent INTEGER;
    v_reward_amount NUMERIC;
BEGIN
    IF NEW.partner_id IS NOT NULL THEN
        SELECT reward_percent INTO v_reward_percent FROM public.partners WHERE id = NEW.partner_id;
        IF v_reward_percent > 0 THEN
            v_reward_amount := (NEW.total_amount * v_reward_percent) / 100.0;
            UPDATE public.partners SET balance = balance + v_reward_amount WHERE id = NEW.partner_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
