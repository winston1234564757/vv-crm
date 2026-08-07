-- Продаж із замовлення: аванс зараховується в чек, а не збирається вдруге.
--
-- Проблема, яку це закриває. Аванс за замовлення вже лежить у касі
-- (`transactions.reference_type = 'client_order'`, міграція 20260724112925), але
-- POS про нього не знав: продаж пробивали на повну суму, і каса отримувала
-- гроші двічі. Живий слід — замовлення 0006: аванс 100 ₴ 28.07, потім чек на
-- повну 1000 ₴ 30.07; у касі 1100 ₴ при виторгу 1000 ₴.
--
-- Рішення: аванс стає рядком оплати чека, який НЕ рухає касу — грошей у
-- шухляді від нього не додається, вони там уже з дня замовлення. Чек при цьому
-- пробивається на повну суму, тож виторг і прибуток лишаються правдивими.

-- 1. Оплата, яка вже в касі. Без цього прапорця `delete_sale` і будь-який
--    майбутній читач сплітів вважав би аванс новими грошима.
ALTER TABLE public.payment_splits
  ADD COLUMN IF NOT EXISTS is_prepaid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payment_splits.is_prepaid IS
  'Аванс замовлення: гроші вже в касі з дня замовлення, цей рядок каси НЕ рухає. Метод і каса — ті, якими аванс приймали.';

-- 2. Зв''язок замовлення з чеком. Він же — ознака «продаж уже проведено»:
--    захищає від другого чека і знімає аванс із відкладеного виторгу в містку.
ALTER TABLE public.client_orders
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_orders_sale ON public.client_orders(sale_id);

COMMENT ON COLUMN public.client_orders.sale_id IS
  'Чек, яким замовлення видали. NULL — товар ще не проданий, аванс висить зобов''язанням.';

-- 3. process_pos_sale: чотири нові аргументи з дефолтами. Стару 15-аргументну
--    версію треба саме DROP, а не CREATE OR REPLACE: дві перевантажені функції,
--    де одна має дефолти, роблять виклик на 15 іменованих аргументів
--    неоднозначним, і звичайний POS упав би з «function is not unique».
DROP FUNCTION IF EXISTS public.process_pos_sale(uuid,integer,integer,text,text,boolean,text,text,timestamptz,timestamptz,uuid,text,uuid,jsonb,jsonb);

CREATE FUNCTION public.process_pos_sale(
  p_customer_id uuid,
  p_total_amount integer,
  p_discount integer,
  p_notes text,
  p_sale_type text,
  p_delivery_needed boolean,
  p_delivery_address text,
  p_delivery_tracking text,
  p_warranty_start timestamptz,
  p_warranty_end timestamptz,
  p_partner_id uuid,
  p_promo_code_used text,
  p_user_id uuid,
  p_items jsonb,
  p_payments jsonb,
  -- Продаж із замовлення. NULL — звичайний чек, поведінка не змінюється.
  p_order_id uuid DEFAULT NULL,
  p_deposit integer DEFAULT 0,
  p_deposit_method text DEFAULT NULL,
  p_deposit_register_id uuid DEFAULT NULL
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
  v_order public.client_orders%ROWTYPE;
  v_paid INT;
BEGIN
  -- 0. Замовлення блокуємо ДО створення чека: два касири на одному замовленні
  --    інакше пробили б два чеки, і аванс зарахувався б двічі.
  IF p_order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM public.client_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Замовлення не знайдено';
    END IF;
    IF v_order.sale_id IS NOT NULL THEN
      RAISE EXCEPTION 'За цим замовленням продаж уже проведено';
    END IF;
    IF v_order.status = 'cancelled' THEN
      RAISE EXCEPTION 'Замовлення скасоване';
    END IF;
    IF COALESCE(p_deposit, 0) > v_order.deposit THEN
      RAISE EXCEPTION 'Зараховано більше, ніж внесений аванс: % ₴ проти % ₴', p_deposit, v_order.deposit;
    END IF;
    IF COALESCE(p_deposit, 0) > 0 AND p_deposit_register_id IS NULL THEN
      RAISE EXCEPTION 'Не вказано касу, в якій лежить аванс';
    END IF;

    -- Оплати плюс аварс мусять покрити чек рівно. Перевірка стоїть тільки на
    -- гілці замовлення: звичайний POS цим шляхом ходить щодня, і нова сувора
    -- умова на ньому — ризик покласти касу без потреби.
    SELECT COALESCE(SUM((p->>'amount')::INT), 0) INTO v_paid
    FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb)) p;

    IF ABS(v_paid + COALESCE(p_deposit, 0) - p_total_amount) > 1 THEN
      RAISE EXCEPTION 'Оплати (% ₴) плюс аванс (% ₴) не дорівнюють сумі чека (% ₴)',
        v_paid, COALESCE(p_deposit, 0), p_total_amount;
    END IF;
  END IF;

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

  -- 4. Аванс замовлення: рядок оплати без руху грошей.
  --    Ні транзакції, ні зміни балансу — і те, й інше вже сталося в день
  --    замовлення. Рядок потрібен, щоб оплати чека сходились із його сумою:
  --    інакше аналітика показала б чек на 350 ₴ з оплатами на 249 ₴.
  IF p_order_id IS NOT NULL THEN
    IF COALESCE(p_deposit, 0) > 0 THEN
      INSERT INTO public.payment_splits (sale_id, amount, method, cash_register_id, is_prepaid)
      VALUES (v_sale_id, p_deposit, COALESCE(p_deposit_method, 'cash'), p_deposit_register_id, true);
    END IF;

    UPDATE public.client_orders
       SET sale_id = v_sale_id, status = 'completed'
     WHERE id = p_order_id;
  END IF;

  RETURN v_sale_id;
END;
$function$;

-- 4. delete_sale: аванс не повертати в нікуди.
--    Функція знімає з кас суму кожного спліту. Для авансу це було б знято
--    101 ₴, яких цей чек у касу не клав, — реєстр лишився б із транзакцією
--    авансу, а каса без грошей. Замовлення при цьому відв''язується назад у
--    «Готове до видачі»: товар знову на складі, аванс знову зобов''язання.
--
--    `refund_sale` навмисно НЕ чіпаємо: повернення віддає клієнту всі його
--    гроші, включно з авансом, і рядок авансу там має зніматися з каси —
--    рівно те, що функція вже робить.
CREATE OR REPLACE FUNCTION public.delete_sale(sale_id_to_delete uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    item_record RECORD;
    payment_record RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE id = sale_id_to_delete) THEN
        RAISE EXCEPTION 'Продаж із вказаним ID не знайдено';
    END IF;

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

    -- Аванс (`is_prepaid`) пропускаємо: цей чек його в касу не клав.
    FOR payment_record IN
        SELECT cash_register_id, amount
        FROM public.payment_splits
        WHERE sale_id = sale_id_to_delete AND NOT is_prepaid
    LOOP
        UPDATE public.cash_registers
        SET balance = balance - payment_record.amount, updated_at = NOW()
        WHERE id = payment_record.cash_register_id;
    END LOOP;

    DELETE FROM public.transactions
    WHERE reference_type = 'sale' AND reference_id = sale_id_to_delete;

    -- Замовлення повертається у видачу. Робимо це явно, а не покладаємось на
    -- ON DELETE SET NULL: статус теж треба відкотити, інакше замовлення
    -- лишилось би «виконаним» без жодного чека.
    UPDATE public.client_orders
       SET sale_id = NULL, status = 'ready'
     WHERE sale_id = sale_id_to_delete;

    DELETE FROM public.sales
    WHERE id = sale_id_to_delete;
END;
$function$;
