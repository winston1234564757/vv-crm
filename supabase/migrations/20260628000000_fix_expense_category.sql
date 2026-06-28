-- Fix Expense Category for transaction 9e2830da

DO $$
DECLARE
  v_cat_id UUID;
  v_tx_ref_id UUID;
BEGIN
  -- 1. Знаходимо або створюємо категорію
  SELECT id INTO v_cat_id FROM public.expense_categories WHERE name = 'Закупівля техніки' LIMIT 1;
  
  IF v_cat_id IS NULL THEN
    INSERT INTO public.expense_categories (name, description, safe_type) 
    VALUES ('Закупівля техніки', 'Витрати на закупівлю пристроїв', 'opex') 
    RETURNING id INTO v_cat_id;
  END IF;

  -- 2. Шукаємо транзакцію і reference_id
  SELECT reference_id INTO v_tx_ref_id FROM public.transactions WHERE id::text LIKE '9e2830da%' LIMIT 1;
  
  IF v_tx_ref_id IS NOT NULL THEN
    -- Оновлюємо витрату за reference_id
    UPDATE public.expenses SET category_id = v_cat_id WHERE id = v_tx_ref_id;
  ELSE
    -- Резервний варіант за сумою та описом
    UPDATE public.expenses SET category_id = v_cat_id WHERE amount = 3500 AND description ILIKE '%Tecno%';
  END IF;

END $$;
