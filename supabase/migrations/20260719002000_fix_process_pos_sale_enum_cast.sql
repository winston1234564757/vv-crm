-- КРИТИЧНО: POS-мультипродаж (process_pos_sale) був повністю зламаний.
--
-- Причина — дрейф схеми: колонку sales.sale_type у живій БД конвертували в enum
-- public.sale_type ВРУЧНУ, поза системою міграцій (у файлах міграцій вона досі TEXT,
-- див. 20260608190000_vv_crm_expansions.sql). Функція process_pos_sale вставляла
-- p_sale_type (text-змінну) без каста → PostgreSQL не робить неявного text→enum для
-- змінної (лише для рядкового літерала) → помилка 42804 на першому ж INSERT.
-- Будь-яка спроба оформити продаж через POS-кошик падала.
--
-- Фікс: явний каст p_sale_type::public.sale_type (єдина зміна відносно оригіналу
-- в 20260630120000_atomic_business_logic.sql).
--
-- Примітка про дрейф: цей файл використовує ::public.sale_type, що вимагає існування
-- enum-типу. У живій БД він є. Для чистого розгортання з нуля потрібно окремо
-- узгодити схему (формалізувати enum sale_type міграцією) — див. звіт.

CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_customer_id uuid, p_total_amount integer, p_discount integer, p_notes text,
  p_sale_type text, p_delivery_needed boolean, p_delivery_address text, p_delivery_tracking text,
  p_warranty_start timestamp with time zone, p_warranty_end timestamp with time zone,
  p_partner_id uuid, p_promo_code_used text, p_user_id uuid, p_items jsonb, p_payments jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    p_customer_id, p_total_amount, p_discount, p_notes, p_user_id,
    p_sale_type::public.sale_type,
    p_delivery_needed, p_delivery_address, p_delivery_tracking,
    p_warranty_start, p_warranty_end, p_partner_id, p_promo_code_used
  ) RETURNING id INTO v_sale_id;

  -- 2. Process Items (Deduct Stock & Insert sale_items)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item->>'item_type' = 'device' THEN
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

    INSERT INTO public.sale_items (
      sale_id, item_type, item_id, quantity, unit_price, total_price, unit_cost
    ) VALUES (
      v_sale_id, v_item->>'item_type', (v_item->>'item_id')::UUID,
      (v_item->>'quantity')::INT, (v_item->>'unit_price')::INT,
      (v_item->>'quantity')::INT * (v_item->>'unit_price')::INT, (v_item->>'unit_cost')::INT
    );
  END LOOP;

  -- 3. Process Payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_cr_id := (v_payment->>'cash_register_id')::UUID;
    INSERT INTO public.payment_splits (sale_id, amount, method, cash_register_id)
    VALUES (v_sale_id, (v_payment->>'amount')::INT, v_payment->>'method', v_cr_id);
    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id, reference_type, reference_id, description, created_by
    ) VALUES (
      (v_payment->>'amount')::INT,
      CASE WHEN p_customer_id IS NOT NULL THEN 'customer' ELSE 'external' END,
      p_customer_id, 'cash_register', v_cr_id, 'sale', v_sale_id,
      v_payment->>'description', p_user_id
    );
    UPDATE public.cash_registers SET balance = balance + (v_payment->>'amount')::INT WHERE id = v_cr_id;
  END LOOP;

  RETURN v_sale_id;
END;
$function$;
