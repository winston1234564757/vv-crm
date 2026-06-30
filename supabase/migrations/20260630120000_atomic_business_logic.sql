-- Migration: Atomic Business Logic (Sales & Purchases)
-- Adds robust PL/pgSQL RPCs to replace multi-step client-side transactions, guaranteeing data consistency.

-- ============================================================
-- 1. ATOMIC DEVICE PURCHASE
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_device_purchase(
  p_type TEXT,
  p_brand TEXT,
  p_model TEXT,
  p_imei TEXT,
  p_price INT,
  p_cost_price INT,
  p_ram TEXT,
  p_storage TEXT,
  p_color TEXT,
  p_battery_health INT,
  p_screen_size TEXT,
  p_cpu TEXT,
  p_gpu TEXT,
  p_needs_repair BOOLEAN,
  p_repair_node TEXT,
  p_repair_cost INT,
  p_repair_np_ttn TEXT,
  p_repair_status TEXT,
  p_repair_parts_replaced JSONB,
  p_description TEXT,
  p_is_visible BOOLEAN,
  p_source TEXT,
  p_source_reference TEXT,
  p_purchased_from TEXT,
  p_condition_grade TEXT,
  p_condition_description TEXT,
  p_original_box BOOLEAN,
  p_accessories_included TEXT,
  p_serial_number TEXT,
  p_warehouse_location TEXT,
  p_photo_urls JSONB,
  p_safe_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_device_id UUID;
  v_safe_balance INT;
  v_safe_name TEXT;
  v_description TEXT;
BEGIN
  -- 1. Check safe balance BEFORE inserting
  IF p_cost_price > 0 AND p_safe_id IS NOT NULL THEN
    SELECT balance, name INTO v_safe_balance, v_safe_name FROM public.safes WHERE id = p_safe_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Сейф для списання коштів не знайдено';
    END IF;
    IF v_safe_balance < p_cost_price THEN
      RAISE EXCEPTION 'Недостатньо коштів на сейфі "%". Доступно: % грн', v_safe_name, v_safe_balance;
    END IF;
  END IF;

  -- 2. Insert Device
  INSERT INTO public.devices (
    type, brand, model, imei, price, cost_price, ram, storage, color, battery_health,
    screen_size, cpu, gpu, needs_repair, repair_node, repair_cost, repair_np_ttn,
    repair_status, repair_parts_replaced, description, is_visible, source, source_reference,
    purchased_from, condition_grade, condition_description, original_box, accessories_included,
    serial_number, warehouse_location, photo_urls, status
  ) VALUES (
    p_type, p_brand, p_model, p_imei, p_price, p_cost_price, p_ram, p_storage, p_color, p_battery_health,
    p_screen_size, p_cpu, p_gpu, p_needs_repair, p_repair_node, p_repair_cost, p_repair_np_ttn,
    p_repair_status, p_repair_parts_replaced, p_description, p_is_visible, p_source, p_source_reference,
    p_purchased_from, p_condition_grade, p_condition_description, p_original_box, p_accessories_included,
    p_serial_number, p_warehouse_location, p_photo_urls, 'in_stock'
  ) RETURNING id INTO v_device_id;

  -- 3. Deduct money and create transaction
  IF p_cost_price > 0 AND p_safe_id IS NOT NULL THEN
    v_description := 'Закупівля техніки: ' || p_brand || ' ' || p_model;
    IF p_imei IS NOT NULL THEN
      v_description := v_description || ' (IMEI: ' || p_imei || ')';
    END IF;

    UPDATE public.safes SET balance = balance - p_cost_price WHERE id = p_safe_id;
    
    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id, reference_type, reference_id, description, created_by
    ) VALUES (
      p_cost_price, 'safe', p_safe_id, 'external', NULL, 'inventory', v_device_id, v_description, p_user_id
    );
  END IF;

  RETURN v_device_id;
END;
$$;


-- ============================================================
-- 2. ATOMIC PART PURCHASE
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_part_purchase(
  p_name TEXT,
  p_part_number TEXT,
  p_type TEXT,
  p_compatible_with TEXT,
  p_cost_price INT,
  p_price INT,
  p_stock INT,
  p_min_stock INT,
  p_supplier_id UUID,
  p_np_ttn TEXT,
  p_origin_type TEXT,
  p_status TEXT,
  p_payment_status TEXT,
  p_payment_due_date TIMESTAMP WITH TIME ZONE,
  p_safe_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_part_id UUID;
  v_stock_to_insert INT;
  v_debt_amount INT;
  v_is_transit BOOLEAN;
  v_is_deferred BOOLEAN;
  v_total_cost INT;
  v_safe_balance INT;
  v_safe_name TEXT;
BEGIN
  v_is_transit := p_status = 'transit';
  v_stock_to_insert := CASE WHEN v_is_transit THEN 0 ELSE p_stock END;
  v_is_deferred := (NOT v_is_transit) AND (p_payment_status = 'deferred');
  v_debt_amount := CASE WHEN v_is_deferred THEN p_cost_price * v_stock_to_insert ELSE 0 END;
  v_total_cost := p_cost_price * v_stock_to_insert;

  -- 1. Check Safe Balance (Only if not transit and not deferred)
  IF NOT v_is_transit AND NOT v_is_deferred AND v_total_cost > 0 AND p_safe_id IS NOT NULL THEN
    SELECT balance, name INTO v_safe_balance, v_safe_name FROM public.safes WHERE id = p_safe_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Сейф для списання коштів не знайдено';
    END IF;
    IF v_safe_balance < v_total_cost THEN
      RAISE EXCEPTION 'Недостатньо коштів на сейфі "%". Доступно: % грн', v_safe_name, v_safe_balance;
    END IF;
  END IF;

  -- 2. Insert Part
  INSERT INTO public.parts (
    name, part_number, type, compatible_with, cost_price, price, stock, min_stock,
    supplier_id, np_ttn, origin_type, status, payment_status, payment_due_date, debt_amount
  ) VALUES (
    p_name, p_part_number, p_type, p_compatible_with, p_cost_price, p_price, v_stock_to_insert, p_min_stock,
    p_supplier_id, p_np_ttn, p_origin_type, p_status, 
    CASE WHEN v_is_transit THEN 'paid' ELSE p_payment_status END,
    CASE WHEN v_is_deferred THEN p_payment_due_date ELSE NULL END,
    v_debt_amount
  ) RETURNING id INTO v_part_id;

  -- 3. Deduct Safe Balance and Create Transaction
  IF NOT v_is_transit AND NOT v_is_deferred AND v_total_cost > 0 AND p_safe_id IS NOT NULL THEN
    UPDATE public.safes SET balance = balance - v_total_cost WHERE id = p_safe_id;
    
    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id, reference_type, reference_id, description, created_by
    ) VALUES (
      v_total_cost, 'safe', p_safe_id, 'supplier', p_supplier_id, 'inventory', v_part_id,
      'Закупівля деталей: ' || p_name || ' (Кількість: ' || v_stock_to_insert || ' шт.)', p_user_id
    );
  END IF;

  RETURN v_part_id;
END;
$$;


-- ============================================================
-- 3. ATOMIC POS SALE
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_customer_id UUID,
  p_total_amount INT,
  p_discount INT,
  p_notes TEXT,
  p_sale_type TEXT,
  p_delivery_needed BOOLEAN,
  p_delivery_address TEXT,
  p_delivery_tracking TEXT,
  p_warranty_start TIMESTAMP WITH TIME ZONE,
  p_warranty_end TIMESTAMP WITH TIME ZONE,
  p_partner_id UUID,
  p_promo_code_used TEXT,
  p_user_id UUID,
  p_items JSONB,    -- Array of objects: { item_type, item_id, quantity, unit_price, unit_cost }
  p_payments JSONB  -- Array of objects: { amount, method, cash_register_id, description }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_payment JSONB;
  v_dev_status TEXT;
  v_acc_stock INT;
  v_part_stock INT;
  v_cr_id UUID;
BEGIN
  -- 1. Create Sale Header
  INSERT INTO public.sales (
    customer_id, total_amount, discount, notes, created_by, sale_type, 
    delivery_needed, delivery_address, delivery_tracking, 
    warranty_start, warranty_end, partner_id, promo_code_used
  ) VALUES (
    p_customer_id, p_total_amount, p_discount, p_notes, p_user_id, p_sale_type,
    p_delivery_needed, p_delivery_address, p_delivery_tracking,
    p_warranty_start, p_warranty_end, p_partner_id, p_promo_code_used
  ) RETURNING id INTO v_sale_id;

  -- 2. Process Items (Deduct Stock & Insert sale_items)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item->>'item_type' = 'device' THEN
      -- Lock device row and check status
      SELECT status INTO v_dev_status FROM public.devices WHERE id = (v_item->>'item_id')::UUID FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Пристрій не знайдено'; END IF;
      IF v_dev_status != 'in_stock' THEN RAISE EXCEPTION 'Пристрій вже продано або заброньовано'; END IF;
      
      UPDATE public.devices SET status = 'sold' WHERE id = (v_item->>'item_id')::UUID;
      
    ELSIF v_item->>'item_type' = 'accessory' THEN
      SELECT stock INTO v_acc_stock FROM public.accessories WHERE id = (v_item->>'item_id')::UUID FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Аксесуар не знайдено'; END IF;
      IF v_acc_stock < (v_item->>'quantity')::INT THEN RAISE EXCEPTION 'Недостатньо аксесуарів на складі'; END IF;
      
      UPDATE public.accessories SET stock = stock - (v_item->>'quantity')::INT WHERE id = (v_item->>'item_id')::UUID;
      
    ELSIF v_item->>'item_type' = 'part' THEN
      SELECT stock INTO v_part_stock FROM public.parts WHERE id = (v_item->>'item_id')::UUID FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Запчастину не знайдено'; END IF;
      IF v_part_stock < (v_item->>'quantity')::INT THEN RAISE EXCEPTION 'Недостатньо запчастин на складі'; END IF;
      
      UPDATE public.parts SET stock = stock - (v_item->>'quantity')::INT WHERE id = (v_item->>'item_id')::UUID;
    END IF;

    -- Insert sale item
    INSERT INTO public.sale_items (
      sale_id, item_type, item_id, quantity, unit_price, total_price, unit_cost
    ) VALUES (
      v_sale_id, 
      v_item->>'item_type', 
      (v_item->>'item_id')::UUID, 
      (v_item->>'quantity')::INT, 
      (v_item->>'unit_price')::INT, 
      (v_item->>'quantity')::INT * (v_item->>'unit_price')::INT, 
      (v_item->>'unit_cost')::INT
    );
  END LOOP;

  -- 3. Process Payments (Update Cash Registers, Insert Splits & Transactions)
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_cr_id := (v_payment->>'cash_register_id')::UUID;
    
    -- Insert payment split
    INSERT INTO public.payment_splits (
      sale_id, amount, method, cash_register_id
    ) VALUES (
      v_sale_id, (v_payment->>'amount')::INT, v_payment->>'method', v_cr_id
    );

    -- Insert transaction
    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id, reference_type, reference_id, description, created_by
    ) VALUES (
      (v_payment->>'amount')::INT, 
      CASE WHEN p_customer_id IS NOT NULL THEN 'customer' ELSE 'external' END,
      p_customer_id, 
      'cash_register', 
      v_cr_id, 
      'sale', 
      v_sale_id, 
      v_payment->>'description', 
      p_user_id
    );

    -- Update cash register
    UPDATE public.cash_registers SET balance = balance + (v_payment->>'amount')::INT WHERE id = v_cr_id;
  END LOOP;

  RETURN v_sale_id;
END;
$$;
