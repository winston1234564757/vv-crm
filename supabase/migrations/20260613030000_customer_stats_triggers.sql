-- Migration: Customer Statistics Triggers
-- Automates the updates to total_spent and total_visits for customers based on sales and completed repairs.

-- 1. Function to recalculate stats for a single customer
CREATE OR REPLACE FUNCTION public.recalculate_customer_stats(cust_id UUID)
RETURNS VOID AS $$
DECLARE
  sales_spent INT;
  sales_count INT;
  repairs_spent INT;
  repairs_count INT;
BEGIN
  IF cust_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculate totals from sales
  SELECT COALESCE(SUM(total_amount), 0), COALESCE(COUNT(*), 0)
  INTO sales_spent, sales_count
  FROM sales
  WHERE customer_id = cust_id;

  -- Calculate totals from completed or handed over repairs
  SELECT COALESCE(SUM(price), 0), COALESCE(COUNT(*), 0)
  INTO repairs_spent, repairs_count
  FROM repairs
  WHERE customer_id = cust_id AND status IN ('completed', 'handed_over');

  -- Update customer record
  UPDATE customers
  SET 
    total_spent = sales_spent + repairs_spent,
    total_visits = sales_count + repairs_count,
    updated_at = NOW()
  WHERE id = cust_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger function for sales mutations
CREATE OR REPLACE FUNCTION public.trigger_update_customer_stats_sales()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM public.recalculate_customer_stats(NEW.customer_id);
    END IF;
    -- If customer changed, update old customer as well
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS NOT NULL AND OLD.customer_id <> NEW.customer_id THEN
      PERFORM public.recalculate_customer_stats(OLD.customer_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM public.recalculate_customer_stats(OLD.customer_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger function for repairs mutations
CREATE OR REPLACE FUNCTION public.trigger_update_customer_stats_repairs()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM public.recalculate_customer_stats(NEW.customer_id);
    END IF;
    -- If customer changed, update old customer as well
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS NOT NULL AND OLD.customer_id <> NEW.customer_id THEN
      PERFORM public.recalculate_customer_stats(OLD.customer_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM public.recalculate_customer_stats(OLD.customer_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Bind triggers to tables
DROP TRIGGER IF EXISTS trigger_sales_customer_stats ON public.sales;
CREATE TRIGGER trigger_sales_customer_stats
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_customer_stats_sales();

DROP TRIGGER IF EXISTS trigger_repairs_customer_stats ON public.repairs;
CREATE TRIGGER trigger_repairs_customer_stats
AFTER INSERT OR UPDATE OR DELETE ON public.repairs
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_customer_stats_repairs();

-- 5. Perform initial sync for existing customers
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.customers LOOP
    PERFORM public.recalculate_customer_stats(r.id);
  END LOOP;
END;
$$;
