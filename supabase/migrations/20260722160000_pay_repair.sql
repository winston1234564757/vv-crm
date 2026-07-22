-- Repair payments: close the loop between a finished repair and the till.
--
-- Repair revenue never reached the finances. `transactions` holds no
-- `repair_payment` row, and `repairs.payment_status` was only ever a label
-- written at intake or edited by hand — no money moved behind it. A repair
-- handed to its customer for 1800 UAH read "unpaid" and that money existed
-- nowhere.
--
-- The concept was already designed and left unfinished: the finance table
-- branches on `repair_payment` in three places, `delete_transaction` already
-- protects that reference type from direct deletion, and the shop keeps a
-- dedicated «Каса ремонтів». Only the write path was missing.
--
-- The ledger is the source of truth. `payment_status` becomes a cache that
-- both functions below recompute from the sum of payments, so partial
-- payments work without adding a `paid_amount` column.

-- ---------------------------------------------------------------------------
-- Take a payment against a repair.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_repair(
  p_repair_id uuid,
  p_cash_register_id uuid,
  p_amount integer,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_price       integer;
  v_device_name text;
  v_paid        integer;
  v_register    text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Сума оплати має бути більше 0';
  END IF;

  SELECT price, device_name INTO v_price, v_device_name
  FROM public.repairs WHERE id = p_repair_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ремонт не знайдено';
  END IF;

  SELECT name INTO v_register
  FROM public.cash_registers WHERE id = p_cash_register_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Касу не знайдено';
  END IF;

  -- Already-paid total, straight from the ledger.
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.transactions
  WHERE reference_type = 'repair_payment' AND reference_id = p_repair_id;

  IF v_paid + p_amount > v_price THEN
    RAISE EXCEPTION 'Переплата: ціна %, вже сплачено %, залишок %',
      v_price, v_paid, v_price - v_paid;
  END IF;

  UPDATE public.cash_registers
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = p_cash_register_id;

  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by
  ) VALUES (
    p_amount,
    'customer', NULL,
    'cash_register', p_cash_register_id,
    'repair_payment', p_repair_id,
    'Оплата ремонту: ' || COALESCE(v_device_name, '—'),
    p_user_id
  );

  -- Recompute the cache rather than trusting the caller.
  UPDATE public.repairs
  SET payment_status = CASE
        WHEN v_paid + p_amount >= v_price THEN 'paid'::payment_status
        ELSE 'partial'::payment_status
      END,
      updated_at = NOW()
  WHERE id = p_repair_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Reverse one repair payment.
--
-- A money-in path with no money-out path is how a till ends up permanently
-- wrong: `delete_transaction` deliberately refuses `repair_payment`, so a
-- mistyped amount would otherwise only be fixable with raw SQL against
-- production.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_repair_payment(
  p_transaction_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tx      RECORD;
  v_price   integer;
  v_paid    integer;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Транзакцію не знайдено';
  END IF;

  IF v_tx.reference_type <> 'repair_payment' THEN
    RAISE EXCEPTION 'Ця транзакція не є оплатою ремонту';
  END IF;

  IF v_tx.to_type = 'cash_register' AND v_tx.to_id IS NOT NULL THEN
    UPDATE public.cash_registers
    SET balance = balance - v_tx.amount, updated_at = NOW()
    WHERE id = v_tx.to_id;
  END IF;

  DELETE FROM public.transactions WHERE id = p_transaction_id;

  SELECT price INTO v_price FROM public.repairs WHERE id = v_tx.reference_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.transactions
  WHERE reference_type = 'repair_payment' AND reference_id = v_tx.reference_id;

  UPDATE public.repairs
  SET payment_status = CASE
        WHEN v_paid = 0 THEN 'unpaid'::payment_status
        WHEN v_paid >= v_price THEN 'paid'::payment_status
        ELSE 'partial'::payment_status
      END,
      updated_at = NOW()
  WHERE id = v_tx.reference_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Grants. Postgres grants EXECUTE to PUBLIC by default and `anon` inherits it,
-- and the anon key ships inside the browser bundle — see migration
-- 20260721135206, which had to revoke exactly this from 30 functions.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.pay_repair(uuid, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pay_repair(uuid, uuid, integer, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refund_repair_payment(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.refund_repair_payment(uuid) TO authenticated, service_role;
