-- Атомарний одинарний продаж (quick sale).
--
-- Проблема: createQuickSale у src/lib/actions/sales.ts робив 6+ послідовних записів
-- звичайним клієнтом без транзакції (sale → sale_item → device 'sold' →
-- payment_splits → transactions → read-modify-write балансу каси). Збій на будь-якому
-- кроці лишав напів-створений продаж: "проданий" пристрій без оплати, каса неоновлена,
-- гонки на балансі/стоку. createMultiSaleAction уже атомарний через process_pos_sale —
-- quick sale лишили старим.
--
-- Рішення: єдина PL/pgSQL-функція (усе тіло — одна транзакція), що дзеркалить патерн
-- process_pos_sale: SELECT ... FOR UPDATE на товар, і всі записи разом. Обробляє
-- device / accessory / service (без стоку та sale_item — як у старій логіці) і
-- гарантію (сума 0 → без оплат). Собівартість (unit_cost) береться з БД, а не з клієнта.

CREATE OR REPLACE FUNCTION public.process_quick_sale(
  p_is_warranty BOOLEAN,
  p_customer_id UUID,
  p_amount INT,
  p_discount INT,
  p_notes TEXT,
  p_created_by UUID,
  p_sale_type TEXT,
  p_delivery_needed BOOLEAN,
  p_delivery_address TEXT,
  p_delivery_tracking TEXT,
  p_warranty_start TIMESTAMP WITH TIME ZONE,
  p_warranty_end TIMESTAMP WITH TIME ZONE,
  p_return_reason TEXT,
  p_monobank_payment_id TEXT,
  p_partner_id UUID,
  p_promo_code_used TEXT,
  p_item_category TEXT,   -- 'device' | 'accessory' | 'service'
  p_item_id UUID,
  p_cash_register_id UUID,
  p_payments JSONB        -- Array of { amount, method }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_dev_status TEXT;
  v_dev_cost INT;
  v_acc_stock INT;
  v_acc_cost INT;
  v_payment JSONB;
  v_amount INT;
  v_method TEXT;
  v_method_text TEXT;
BEGIN
  -- 1. Заголовок продажу
  INSERT INTO public.sales (
    is_warranty, customer_id, total_amount, discount, notes, created_by, sale_type,
    delivery_needed, delivery_address, delivery_tracking, warranty_start, warranty_end,
    return_reason, monobank_payment_id, partner_id, promo_code_used
  ) VALUES (
    p_is_warranty, p_customer_id, p_amount, p_discount, p_notes, p_created_by,
    p_sale_type::public.sale_type,  -- text→enum explicit cast (implicit cast не існує)
    p_delivery_needed, p_delivery_address, p_delivery_tracking, p_warranty_start, p_warranty_end,
    p_return_reason, p_monobank_payment_id, p_partner_id, p_promo_code_used
  ) RETURNING id INTO v_sale_id;

  -- 2. Товар (лок рядка + перевірка + списання + sale_item)
  IF p_item_category = 'device' AND p_item_id IS NOT NULL THEN
    SELECT status, COALESCE(cost_price, 0) INTO v_dev_status, v_dev_cost
      FROM public.devices WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Пристрій не знайдено'; END IF;
    IF v_dev_status <> 'in_stock' THEN RAISE EXCEPTION 'Пристрій вже продано або заброньовано'; END IF;

    UPDATE public.devices SET status = 'sold' WHERE id = p_item_id;

    INSERT INTO public.sale_items (sale_id, item_type, item_id, quantity, unit_price, total_price, unit_cost)
    VALUES (v_sale_id, 'device', p_item_id, 1, p_amount, p_amount, v_dev_cost);

  ELSIF p_item_category = 'accessory' AND p_item_id IS NOT NULL THEN
    SELECT stock, COALESCE(cost_price, 0) INTO v_acc_stock, v_acc_cost
      FROM public.accessories WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Аксесуар не знайдено'; END IF;
    IF v_acc_stock < 1 THEN RAISE EXCEPTION 'Аксесуар закінчився на складі'; END IF;

    UPDATE public.accessories SET stock = stock - 1 WHERE id = p_item_id;

    INSERT INTO public.sale_items (sale_id, item_type, item_id, quantity, unit_price, total_price, unit_cost)
    VALUES (v_sale_id, 'accessory', p_item_id, 1, p_amount, p_amount, v_acc_cost);
  END IF;
  -- 'service': без стоку та без sale_item (паритет зі старою поведінкою)

  -- 3. Оплати (для гарантії/нульової суми масив порожній або суми 0 → пропускаємо)
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_amount := (v_payment->>'amount')::INT;
    IF v_amount <= 0 THEN CONTINUE; END IF;
    v_method := v_payment->>'method';
    v_method_text := CASE v_method WHEN 'cash' THEN 'Готівка' WHEN 'card' THEN 'Картка' ELSE 'Переказ' END;

    INSERT INTO public.payment_splits (sale_id, amount, method, cash_register_id)
    VALUES (v_sale_id, v_amount, v_method, p_cash_register_id);

    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id, reference_type, reference_id, description, created_by
    ) VALUES (
      v_amount,
      CASE WHEN p_customer_id IS NOT NULL THEN 'customer' ELSE 'external' END,
      p_customer_id, 'cash_register', p_cash_register_id, 'sale', v_sale_id,
      p_notes || ' [Оплата: ' || v_method_text || ']', p_created_by
    );

    UPDATE public.cash_registers SET balance = balance + v_amount WHERE id = p_cash_register_id;
  END LOOP;

  RETURN v_sale_id;
END;
$$;
