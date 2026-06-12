-- Enable moddatetime extension
CREATE EXTENSION IF NOT EXISTS moddatetime schema extensions;

CREATE TABLE IF NOT EXISTS public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    promo_code TEXT NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL DEFAULT 0,
    reward_percent INTEGER NOT NULL DEFAULT 0,
    balance NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Create policies for partners
CREATE POLICY "Enable read access for authenticated users on partners" 
ON public.partners FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users on partners" 
ON public.partners FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on partners" 
ON public.partners FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users on partners" 
ON public.partners FOR DELETE TO authenticated USING (true);

-- Add to repairs
ALTER TABLE public.repairs 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS promo_code_used TEXT;

-- Add to sales
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS promo_code_used TEXT;

-- Triggers for automatic balance calculation
CREATE OR REPLACE FUNCTION update_partner_balance_on_sale() RETURNS TRIGGER AS $$
DECLARE
    v_reward_percent INTEGER;
    v_reward_amount NUMERIC;
BEGIN
    IF NEW.partner_id IS NOT NULL THEN
        SELECT reward_percent INTO v_reward_percent FROM public.partners WHERE id = NEW.partner_id;
        IF v_reward_percent > 0 THEN
            v_reward_amount := (NEW.amount * v_reward_percent) / 100.0;
            UPDATE public.partners SET balance = balance + v_reward_amount WHERE id = NEW.partner_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sale_created
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION update_partner_balance_on_sale();

-- Trigger for repairs (when status becomes 'completed')
CREATE OR REPLACE FUNCTION update_partner_balance_on_repair() RETURNS TRIGGER AS $$
DECLARE
    v_reward_percent INTEGER;
    v_reward_amount NUMERIC;
BEGIN
    -- Only trigger if it wasn't completed before, and now it is completed
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed') THEN
        IF NEW.partner_id IS NOT NULL THEN
            SELECT reward_percent INTO v_reward_percent FROM public.partners WHERE id = NEW.partner_id;
            IF v_reward_percent > 0 THEN
                -- profit = price - cost
                v_reward_amount := ((NEW.price - COALESCE(NEW.cost, 0)) * v_reward_percent) / 100.0;
                v_reward_amount := GREATEST(0, v_reward_amount);
                
                UPDATE public.partners SET balance = balance + v_reward_amount WHERE id = NEW.partner_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_repair_completed
AFTER INSERT OR UPDATE ON public.repairs
FOR EACH ROW EXECUTE FUNCTION update_partner_balance_on_repair();