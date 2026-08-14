-- Дозволяє повернути клієнту надлишкові кошти (переплату / решту),
-- якщо після внесення оплати вартість ремонту було зменшено.
--
-- Списує кошти з обраної каси, фіксує від'ємну транзакцію повернення
-- та актуалізує статус оплати ремонту.

CREATE OR REPLACE FUNCTION public.refund_repair_excess(
  p_repair_id        uuid,
  p_cash_register_id uuid,
  p_amount           integer,
  p_user_id          uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_price       integer;
  v_device_name text;
  v_paid        integer;
  v_register    text;
  v_bb          integer;
  v_ba          integer;
  v_excess      integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Сума повернення має бути більше 0';
  END IF;

  SELECT price, device_name INTO v_price, v_device_name
  FROM public.repairs WHERE id = p_repair_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ремонт не знайдено';
  END IF;

  SELECT name, balance INTO v_register, v_bb
  FROM public.cash_registers WHERE id = p_cash_register_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Касу не знайдено';
  END IF;

  IF v_bb < p_amount THEN
    RAISE EXCEPTION 'У касі "%" недостатньо коштів (баланс: % ₴, потрібно: % ₴)', v_register, v_bb, p_amount;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.transactions
  WHERE reference_type = 'repair_payment' AND reference_id = p_repair_id;

  v_excess := v_paid - v_price;
  IF v_excess <= 0 THEN
    RAISE EXCEPTION 'Переплати за цим ремонтом немає (ціна % ₴, сплачено % ₴)', v_price, v_paid;
  END IF;

  IF p_amount > v_excess THEN
    RAISE EXCEPTION 'Сума повернення (% ₴) перевищує суму переплати (% ₴)', p_amount, v_excess;
  END IF;

  -- Списуємо кошти з каси
  UPDATE public.cash_registers
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_cash_register_id;
  v_ba := v_bb - p_amount;

  -- Фіксуємо транзакцію повернення грошей клієнту
  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by,
    from_balance_before, from_balance_after
  ) VALUES (
    p_amount,
    'cash_register', p_cash_register_id, 'customer', NULL,
    'repair_payment', p_repair_id,
    'Повернення переплати за ремонт: ' || COALESCE(v_device_name, '—'),
    p_user_id,
    v_bb, v_ba
  );

  -- Оновлюємо статус оплати ремонту
  UPDATE public.repairs
  SET payment_status = CASE
        WHEN (v_paid - p_amount) >= v_price THEN 'paid'::payment_status
        WHEN (v_paid - p_amount) > 0 THEN 'partial'::payment_status
        ELSE 'unpaid'::payment_status
      END,
      updated_at = NOW()
  WHERE id = p_repair_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.refund_repair_excess(uuid, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.refund_repair_excess(uuid, uuid, integer, uuid) TO authenticated, service_role;
