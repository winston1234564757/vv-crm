-- Migration: Atomic Parts Deduction for Repairs and Devices
-- Adds robust PL/pgSQL RPCs to prevent partial failures when adding/removing parts from repairs and devices.

-- ============================================================
-- 1. ADD PART TO REPAIR (ATOMIC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_part_to_repair(
  p_repair_id UUID,
  p_part_id UUID,
  p_quantity INT,
  p_unit_cost INT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_part_stock INT;
  v_part_name TEXT;
  v_repair_cost INT;
BEGIN
  -- 1. Lock and check part stock
  SELECT stock, name INTO v_part_stock, v_part_name FROM public.parts WHERE id = p_part_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Деталь не знайдено на складі';
  END IF;

  IF v_part_stock < p_quantity THEN
    RAISE EXCEPTION 'Недостатньо запчастин на складі (в наявності: % шт)', v_part_stock;
  END IF;

  -- 2. Deduct stock
  UPDATE public.parts SET stock = stock - p_quantity WHERE id = p_part_id;

  -- 3. Insert into repair_parts
  INSERT INTO public.repair_parts (repair_id, part_id, quantity, unit_cost)
  VALUES (p_repair_id, p_part_id, p_quantity, p_unit_cost);

  -- 4. Update repair cost
  SELECT cost INTO v_repair_cost FROM public.repairs WHERE id = p_repair_id FOR UPDATE;
  UPDATE public.repairs SET cost = COALESCE(v_repair_cost, 0) + (p_unit_cost * p_quantity) WHERE id = p_repair_id;

  -- 5. Add status log
  INSERT INTO public.repair_status_log (repair_id, to_status, notes)
  VALUES (
    p_repair_id, 
    'in_progress', 
    'Додано деталь зі складу: ' || v_part_name || ' (' || p_quantity || ' шт) на суму ' || (p_unit_cost * p_quantity) || ' грн'
  );

END;
$$;


-- ============================================================
-- 2. REMOVE PART FROM REPAIR (ATOMIC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_part_from_repair(
  p_repair_part_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_repair_id UUID;
  v_part_id UUID;
  v_quantity INT;
  v_unit_cost INT;
  v_part_name TEXT;
  v_repair_cost INT;
BEGIN
  -- 1. Lock repair_part and get info
  SELECT repair_id, part_id, quantity, unit_cost 
  INTO v_repair_id, v_part_id, v_quantity, v_unit_cost 
  FROM public.repair_parts 
  WHERE id = p_repair_part_id FOR UPDATE;

  IF v_repair_id IS NULL THEN
    RAISE EXCEPTION 'Запис про списану деталь не знайдено';
  END IF;

  -- 2. Lock part to safely update stock
  SELECT name INTO v_part_name FROM public.parts WHERE id = v_part_id FOR UPDATE;

  -- 3. Restore stock
  UPDATE public.parts SET stock = stock + v_quantity WHERE id = v_part_id;

  -- 4. Reduce repair cost
  SELECT cost INTO v_repair_cost FROM public.repairs WHERE id = v_repair_id FOR UPDATE;
  
  -- Prevent negative cost
  UPDATE public.repairs 
  SET cost = GREATEST(COALESCE(v_repair_cost, 0) - (v_unit_cost * v_quantity), 0) 
  WHERE id = v_repair_id;

  -- 5. Delete repair_part
  DELETE FROM public.repair_parts WHERE id = p_repair_part_id;

  -- 6. Add status log
  INSERT INTO public.repair_status_log (repair_id, to_status, notes)
  VALUES (
    v_repair_id, 
    'in_progress', 
    'Видалено деталь зі складу: ' || COALESCE(v_part_name, 'Деталь') || ' (повернено ' || v_quantity || ' шт)'
  );

END;
$$;


-- ============================================================
-- 3. ATOMIC DEVICE PURCHASE (UPDATED WITH PARTS DEDUCTION)
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
  v_part_elem JSONB;
  v_p_id UUID;
  v_p_stock INT;
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

  -- 4. NEW: Deduct repair parts from stock (if any were replaced)
  IF p_repair_parts_replaced IS NOT NULL AND jsonb_array_length(p_repair_parts_replaced) > 0 THEN
    FOR v_part_elem IN SELECT * FROM jsonb_array_elements(p_repair_parts_replaced)
    LOOP
      IF v_part_elem->>'part_id' IS NOT NULL THEN
        v_p_id := (v_part_elem->>'part_id')::UUID;
        
        -- Lock the part
        SELECT stock INTO v_p_stock FROM public.parts WHERE id = v_p_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Деталь зі складу (ID: %) не знайдено', v_p_id;
        END IF;

        IF v_p_stock < 1 THEN
          RAISE EXCEPTION 'Недостатньо запчастин на складі для ремонту пристрою (Деталь ID: %)', v_p_id;
        END IF;

        -- Deduct
        UPDATE public.parts SET stock = stock - 1 WHERE id = v_p_id;
      END IF;
    END LOOP;
  END IF;

  RETURN v_device_id;
END;
$$;
