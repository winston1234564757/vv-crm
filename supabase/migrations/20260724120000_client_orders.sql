-- Клієнтські замовлення "під клієнта": товар, якого ще немає на складі.
-- Окрема сутність від sales (продажі списують склад) і purchases (закупівлі).
-- status та item_type — text + CHECK, а НЕ enum: свідомо уникаємо повторення
-- історії з sale_type::enum, що клала POS (див. 20260719072946).
--
-- Застосовано в живій БД через MCP apply_migration (версія 20260724112925).
-- Цей файл — та сама DDL, збережена в репозиторії для узгодженості.

-- Людський номер замовлення (#0001), як repairs.tracking_token.
CREATE SEQUENCE IF NOT EXISTS public.client_orders_no_seq;

CREATE TABLE IF NOT EXISTS public.client_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no     text UNIQUE NOT NULL DEFAULT to_char(nextval('public.client_orders_no_seq'::regclass), 'FM0000'),
  -- Незгадуваний токен для QR/публічного трекера (префікс 'o' = order), як repairs.public_token.
  public_token text UNIQUE NOT NULL DEFAULT ('o' || translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_')),
  customer_id  uuid NOT NULL REFERENCES public.customers(id),
  item_type    text NOT NULL CHECK (item_type = ANY (ARRAY['device','accessory','part','service'])),
  item_name    text NOT NULL,
  item_url     text,
  agreed_price integer NOT NULL DEFAULT 0,
  deposit      integer NOT NULL DEFAULT 0,
  deadline     date,
  status       text NOT NULL DEFAULT 'new'
                 CHECK (status = ANY (ARRAY['new','ordered','arrived','ready','completed','cancelled'])),
  notes        text,
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_orders_customer ON public.client_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_orders_status   ON public.client_orders(status);
CREATE INDEX IF NOT EXISTS idx_client_orders_created  ON public.client_orders(created_at DESC);

-- updated_at — той самий спільний тригер, що й у customers/repairs.
DROP TRIGGER IF EXISTS set_updated_at_client_orders ON public.client_orders;
CREATE TRIGGER set_updated_at_client_orders
  BEFORE UPDATE ON public.client_orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Історія статусів для публічного трекера (дзеркало repair_status_log).
CREATE TABLE IF NOT EXISTS public.client_order_status_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES public.client_orders(id) ON DELETE CASCADE,
  from_status         text,
  to_status           text NOT NULL,
  changed_by          uuid REFERENCES public.profiles(id),
  notes               text,
  is_customer_visible boolean DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_order_status_log_order ON public.client_order_status_log(order_id);

-- Автологування: створення (null -> new) і кожна зміна статусу.
CREATE OR REPLACE FUNCTION public.log_client_order_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_order_status_log (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.client_order_status_log (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_client_order_status_trg ON public.client_orders;
CREATE TRIGGER log_client_order_status_trg
  AFTER INSERT OR UPDATE ON public.client_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_client_order_status();

-- transactions.reference_type ще не знав про замовлення — додаємо 'client_order',
-- щоб аванс мав коректне посилання (аудит каси), не змішуючись з продажами.
ALTER TABLE public.transactions DROP CONSTRAINT transactions_reference_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_reference_type_check
  CHECK (reference_type = ANY (ARRAY['sale','repair_payment','purchase','expense','distribution','top_up','adjustment','device','accessory','part','inventory','client_order']));

-- RLS — той самий патерн, що й у customers.
ALTER TABLE public.client_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_orders_select_all ON public.client_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY client_orders_insert_all ON public.client_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY client_orders_update_all ON public.client_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY client_orders_delete_admins ON public.client_orders FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['owner','manager'])));

ALTER TABLE public.client_order_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_order_status_log_select_all ON public.client_order_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY client_order_status_log_insert_all ON public.client_order_status_log FOR INSERT TO authenticated WITH CHECK (true);

-- Атомарне створення замовлення (+ аванс у касу, якщо deposit > 0).
-- Дзеркало платіжного циклу process_pos_sale.
CREATE OR REPLACE FUNCTION public.create_client_order(
  p_customer_id  uuid,
  p_item_type    text,
  p_item_name    text,
  p_item_url     text,
  p_agreed_price integer,
  p_deposit      integer,
  p_deadline     date,
  p_notes        text,
  p_user_id      uuid,
  p_register_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id    uuid;
  v_no    text;
  v_token text;
BEGIN
  INSERT INTO public.client_orders (
    customer_id, item_type, item_name, item_url,
    agreed_price, deposit, deadline, notes, created_by
  ) VALUES (
    p_customer_id, p_item_type, p_item_name, p_item_url,
    COALESCE(p_agreed_price, 0), COALESCE(p_deposit, 0), p_deadline, p_notes, p_user_id
  )
  RETURNING id, order_no, public_token INTO v_id, v_no, v_token;

  IF COALESCE(p_deposit, 0) > 0 THEN
    IF p_register_id IS NULL THEN
      RAISE EXCEPTION 'Каса не вказана для авансу';
    END IF;
    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, reference_id, description, created_by
    ) VALUES (
      p_deposit, 'customer', p_customer_id, 'cash_register', p_register_id,
      'client_order', v_id, 'Аванс за замовлення ' || v_no, p_user_id
    );
    UPDATE public.cash_registers SET balance = balance + p_deposit WHERE id = p_register_id;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'order_no', v_no, 'public_token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client_order(uuid,text,text,text,integer,integer,date,text,uuid,uuid) TO authenticated;
