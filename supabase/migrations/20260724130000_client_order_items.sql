-- Мультитоварні замовлення: позиції переїжджають у дочірню таблицю
-- (дзеркало sale_items). Заголовок client_orders тепер тримає лише підсумок.
-- Реальних замовлень ще 0, тож перебудова безпечна.
--
-- Застосовано в живій БД через MCP apply_migration. Файл — та сама DDL для репо.

CREATE TABLE IF NOT EXISTS public.client_order_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.client_orders(id) ON DELETE CASCADE,
  item_type  text NOT NULL CHECK (item_type = ANY (ARRAY['device','accessory','part','service'])),
  item_name  text NOT NULL,
  item_url   text,
  unit_price integer NOT NULL DEFAULT 0,
  quantity   integer NOT NULL DEFAULT 1 CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_client_order_items_order ON public.client_order_items(order_id);

ALTER TABLE public.client_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_order_items_select_all ON public.client_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY client_order_items_insert_all ON public.client_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY client_order_items_update_all ON public.client_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY client_order_items_delete_all ON public.client_order_items FOR DELETE TO authenticated USING (true);

-- Заголовок більше не тримає одну позицію. agreed_price = узгоджений ПІДСУМОК.
ALTER TABLE public.client_orders DROP COLUMN IF EXISTS item_type;
ALTER TABLE public.client_orders DROP COLUMN IF EXISTS item_name;
ALTER TABLE public.client_orders DROP COLUMN IF EXISTS item_url;

-- Перебудова RPC під масив позицій.
DROP FUNCTION IF EXISTS public.create_client_order(uuid,text,text,text,integer,integer,date,text,uuid,uuid);

CREATE OR REPLACE FUNCTION public.create_client_order(
  p_customer_id uuid,
  p_total       integer,
  p_deposit     integer,
  p_deadline    date,
  p_notes       text,
  p_user_id     uuid,
  p_register_id uuid,
  p_items       jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid; v_no text; v_token text; v_item jsonb;
BEGIN
  INSERT INTO public.client_orders (customer_id, agreed_price, deposit, deadline, notes, created_by)
  VALUES (p_customer_id, COALESCE(p_total, 0), COALESCE(p_deposit, 0), p_deadline, p_notes, p_user_id)
  RETURNING id, order_no, public_token INTO v_id, v_no, v_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.client_order_items (order_id, item_type, item_name, item_url, unit_price, quantity)
    VALUES (
      v_id,
      v_item->>'item_type',
      v_item->>'item_name',
      NULLIF(v_item->>'item_url', ''),
      COALESCE((v_item->>'unit_price')::int, 0),
      COALESCE((v_item->>'quantity')::int, 1)
    );
  END LOOP;

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

GRANT EXECUTE ON FUNCTION public.create_client_order(uuid,integer,integer,date,text,uuid,uuid,jsonb) TO authenticated;
