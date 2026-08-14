-- ============================================================
-- Balance Snapshots in Transactions Ledger
-- ============================================================
--
-- Проблема: транзакція в журналі показувала лише суму руху, але не стан
-- рахунку до та після. Неможливо було відповісти: «скільки було на OPEX
-- до цієї витрати?».
--
-- Рішення: чотири нові колонки — snapshot балансу рахунку-джерела (from)
-- і рахунку-одержувача (to) до та після кожної операції.
--
-- Стратегія мінімальної інвазії:
--   1. Модернізувати центральні диспетчери account_apply і safe_apply —
--      вони повертатимуть баланс до/після.
--   2. Кожна функція що пише транзакцію — передає ці snapshots.
--   3. Для функцій що пишуть у касу без account_apply (pay_repair,
--      process_quick_sale, etc.) — читаємо баланс вручну перед UPDATE.
--
-- Старі рядки матимуть NULL — це факт, не помилка. Backfill неможливий.
-- ============================================================

-- ── 1. Нові колонки ──────────────────────────────────────────────────────────

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS from_balance_before integer,
  ADD COLUMN IF NOT EXISTS from_balance_after  integer,
  ADD COLUMN IF NOT EXISTS to_balance_before   integer,
  ADD COLUMN IF NOT EXISTS to_balance_after    integer;

COMMENT ON COLUMN public.transactions.from_balance_before IS
  'Баланс рахунку-джерела (from) до проведення операції. NULL для рядків до 2026-08-12.';
COMMENT ON COLUMN public.transactions.from_balance_after IS
  'Баланс рахунку-джерела (from) після списання. NULL для рядків до 2026-08-12.';
COMMENT ON COLUMN public.transactions.to_balance_before IS
  'Баланс рахунку-одержувача (to) до зарахування. NULL якщо to_type=external/customer/supplier.';
COMMENT ON COLUMN public.transactions.to_balance_after IS
  'Баланс рахунку-одержувача (to) після зарахування. NULL якщо to_type=external/customer/supplier.';

-- ── 2. safe_apply — тепер повертає баланс до/після ───────────────────────────
-- RETURNS void → RETURNS record (OUT-параметри).
-- Старі PERFORM safe_apply(...) замінити на SELECT ... FROM safe_apply(...).

CREATE OR REPLACE FUNCTION public.safe_apply(
  p_safe_id uuid,
  p_amount  integer,
  p_method  text,
  OUT o_balance_before integer,
  OUT o_balance_after  integer
)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_half  integer;
  v_name  text;
  v_total integer;
BEGIN
  IF p_method NOT IN ('cash', 'cashless') THEN
    RAISE EXCEPTION 'Невідомий спосіб оплати: %', p_method;
  END IF;

  IF p_amount = 0 THEN
    SELECT balance INTO o_balance_before FROM public.safes WHERE id = p_safe_id;
    o_balance_after := o_balance_before;
    RETURN;
  END IF;

  SELECT name, balance,
         CASE WHEN p_method = 'cash' THEN balance_cash ELSE balance_cashless END
    INTO v_name, v_total, v_half
  FROM public.safes WHERE id = p_safe_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Сейф не знайдено'; END IF;

  IF p_amount < 0 AND v_half < abs(p_amount) THEN
    RAISE EXCEPTION 'У сейфі "%" лише % грн %, а списати треба % грн',
      v_name, v_half,
      CASE WHEN p_method = 'cash' THEN 'готівкою' ELSE 'безготівкою' END,
      abs(p_amount);
  END IF;

  o_balance_before := v_total;

  UPDATE public.safes
  SET balance          = balance + p_amount,
      balance_cash     = balance_cash     + CASE WHEN p_method = 'cash'     THEN p_amount ELSE 0 END,
      balance_cashless = balance_cashless + CASE WHEN p_method = 'cashless' THEN p_amount ELSE 0 END,
      updated_at       = now()
  WHERE id = p_safe_id;

  o_balance_after := v_total + p_amount;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.safe_apply(uuid, integer, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.safe_apply(uuid, integer, text) TO authenticated, service_role;

-- ── 3. account_apply — повертає баланс до/після ──────────────────────────────

CREATE OR REPLACE FUNCTION public.account_apply(
  p_type   text,
  p_id     uuid,
  p_amount integer,
  p_method text,
  OUT o_name           text,
  OUT o_method         text,
  OUT o_balance_before integer,
  OUT o_balance_after  integer
)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_kind    text;
  v_balance integer;
BEGIN
  IF p_id IS NULL THEN RAISE EXCEPTION 'Не вказано, звідки платити'; END IF;

  IF p_type = 'safe' THEN
    SELECT name INTO o_name FROM public.safes WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Сейф для списання коштів не знайдено'; END IF;
    o_method := p_method;
    SELECT sa.o_balance_before, sa.o_balance_after
      INTO o_balance_before, o_balance_after
    FROM public.safe_apply(p_id, p_amount, p_method) sa;
    RETURN;
  END IF;

  IF p_type = 'cash_register' THEN
    SELECT name, type, balance INTO o_name, v_kind, v_balance
    FROM public.cash_registers WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Касу для списання коштів не знайдено'; END IF;

    o_method         := CASE WHEN v_kind = 'cashless' THEN 'cashless' ELSE 'cash' END;
    o_balance_before := v_balance;

    IF p_amount < 0 AND v_balance < abs(p_amount) THEN
      RAISE EXCEPTION 'У касі "%" лише % грн, а списати треба % грн',
        o_name, v_balance, abs(p_amount);
    END IF;

    UPDATE public.cash_registers
    SET balance = balance + p_amount, updated_at = now()
    WHERE id = p_id;

    o_balance_after := v_balance + p_amount;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Невідоме джерело оплати: %', COALESCE(p_type, 'порожнє');
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.account_apply(text, uuid, integer, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.account_apply(text, uuid, integer, text) TO authenticated, service_role;

-- ── 4. create_expense ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_expense(
  category_id       uuid,
  amount            integer,
  paid_from_safe_id uuid,
  description       text,
  user_id           uuid,
  payment_method    text,
  p_source_type     text DEFAULT 'safe',
  p_source_id       uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_type   text := COALESCE(NULLIF(p_source_type, ''), 'safe');
  v_id     uuid := COALESCE(p_source_id, paid_from_safe_id);
  v_name   text;
  v_method text;
  v_bb     integer;
  v_ba     integer;
  v_expense_id uuid;
BEGIN
  IF amount <= 0 THEN RAISE EXCEPTION 'Сума витрати має бути більше 0'; END IF;

  SELECT o_name, o_method, o_balance_before, o_balance_after
    INTO v_name, v_method, v_bb, v_ba
  FROM public.account_apply(v_type, v_id, -amount, payment_method);

  INSERT INTO public.expenses (
    category_id, amount, paid_from_safe_id, paid_from_register_id, description, created_by
  ) VALUES (
    category_id, amount,
    CASE WHEN v_type = 'safe'          THEN v_id END,
    CASE WHEN v_type = 'cash_register' THEN v_id END,
    description, user_id
  ) RETURNING id INTO v_expense_id;

  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by, payment_method,
    from_balance_before, from_balance_after
  ) VALUES (
    amount, v_type, v_id, 'external', NULL,
    'expense', v_expense_id,
    COALESCE(description, 'Витрата з ' || v_name),
    user_id, v_method,
    v_bb, v_ba
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.create_expense(uuid, integer, uuid, text, uuid, text, text, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.create_expense(uuid, integer, uuid, text, uuid, text, text, uuid) TO authenticated, service_role;

-- ── 5. purchase_inventory_item ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purchase_inventory_item(
  item_type      text,
  item_id        uuid,
  safe_id        uuid,
  amount         integer,
  description    text,
  user_id        uuid,
  payment_method text,
  p_source_type  text DEFAULT 'safe',
  p_source_id    uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_type   text := COALESCE(NULLIF(p_source_type, ''), 'safe');
  v_id     uuid := COALESCE(p_source_id, safe_id);
  v_name   text;
  v_method text;
  v_bb     integer;
  v_ba     integer;
BEGIN
  IF item_type NOT IN ('device', 'accessory', 'part') THEN RAISE EXCEPTION 'Невалідний тип сутності'; END IF;
  IF amount <= 0 THEN RAISE EXCEPTION 'Сума закупівлі має бути більше 0'; END IF;

  SELECT o_name, o_method, o_balance_before, o_balance_after
    INTO v_name, v_method, v_bb, v_ba
  FROM public.account_apply(v_type, v_id, -amount, payment_method);

  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by, payment_method,
    from_balance_before, from_balance_after
  ) VALUES (
    amount, v_type, v_id, 'external', NULL,
    item_type, item_id, description, user_id, v_method,
    v_bb, v_ba
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.purchase_inventory_item(text, uuid, uuid, integer, text, uuid, text, text, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.purchase_inventory_item(text, uuid, uuid, integer, text, uuid, text, text, uuid) TO authenticated, service_role;

-- ── 6. pay_purchase_atomic ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pay_purchase_atomic(
  p_id             uuid,
  p_safe_id        uuid,
  user_id          uuid,
  p_payment_method text,
  p_source_type    text DEFAULT 'safe',
  p_source_id      uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_type         text := COALESCE(NULLIF(p_source_type, ''), 'safe');
  v_id           uuid := COALESCE(p_source_id, p_safe_id);
  v_name         text;
  v_method       text;
  v_bb           integer;
  v_ba           integer;
  v_amount       integer;
  v_status       text;
  v_payment_type text;
  v_supplier_id  uuid;
  v_supplier_name text := 'Постачальник';
BEGIN
  SELECT total_amount, status, supplier_id, payment_type
    INTO v_amount, v_status, v_supplier_id, v_payment_type
  FROM public.purchases WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Закупівлю з ID % не знайдено', p_id; END IF;
  IF v_status = 'paid' THEN RAISE EXCEPTION 'Закупівлю вже оплачено'; END IF;
  IF v_status = 'pending' AND v_payment_type <> 'prepaid' THEN
    RAISE EXCEPTION 'Спочатку підтвердіть отримання товару перед оплатою';
  END IF;

  SELECT o_name, o_method, o_balance_before, o_balance_after
    INTO v_name, v_method, v_bb, v_ba
  FROM public.account_apply(v_type, v_id, -v_amount, p_payment_method);

  UPDATE public.purchases
  SET status                = 'paid',
      paid_at               = now(),
      paid_from_safe_id     = CASE WHEN v_type = 'safe'          THEN v_id END,
      paid_from_register_id = CASE WHEN v_type = 'cash_register' THEN v_id END,
      updated_at            = now()
  WHERE id = p_id;

  IF v_supplier_id IS NOT NULL THEN
    SELECT name INTO v_supplier_name FROM public.suppliers WHERE id = v_supplier_id;
  END IF;

  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by, payment_method,
    from_balance_before, from_balance_after
  ) VALUES (
    v_amount, v_type, v_id, 'supplier', v_supplier_id,
    'purchase', p_id,
    CASE
      WHEN v_payment_type = 'prepaid'
        THEN 'Передплата за закупівлю постачальнику "' || v_supplier_name || '" з ' || v_name
      ELSE 'Оплата закупівлі постачальнику "' || v_supplier_name || '" з ' || v_name
    END,
    user_id, v_method,
    v_bb, v_ba
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.pay_purchase_atomic(uuid, uuid, uuid, text, text, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.pay_purchase_atomic(uuid, uuid, uuid, text, text, uuid) TO authenticated, service_role;

-- ── 7. purchase_accessory_stock ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purchase_accessory_stock(
  p_accessory_id   uuid,
  p_quantity       integer,
  p_unit_cost      integer,
  p_new_cost_price integer,
  p_safe_id        uuid,
  p_payment_method text,
  p_user_id        uuid,
  p_source_type    text DEFAULT 'safe',
  p_source_id      uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_type     text := COALESCE(NULLIF(p_source_type, ''), 'safe');
  v_id       uuid := COALESCE(p_source_id, p_safe_id);
  v_name     text;
  v_method   text;
  v_bb       integer;
  v_ba       integer;
  v_acc_name text;
  v_total    integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Кількість має бути більше 0'; END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN RAISE EXCEPTION 'Ціна закупівлі не може бути від''ємною'; END IF;
  IF p_new_cost_price IS NULL OR p_new_cost_price < 0 THEN RAISE EXCEPTION 'Собівартість не може бути від''ємною'; END IF;

  SELECT name INTO v_acc_name FROM public.accessories WHERE id = p_accessory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Аксесуар не знайдено'; END IF;

  v_total := p_quantity * p_unit_cost;

  IF v_total > 0 THEN
    IF v_id IS NULL THEN RAISE EXCEPTION 'Не вказано, звідки платити'; END IF;
    SELECT o_name, o_method, o_balance_before, o_balance_after
      INTO v_name, v_method, v_bb, v_ba
    FROM public.account_apply(v_type, v_id, -v_total, p_payment_method);

    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, reference_id, description, created_by, payment_method,
      from_balance_before, from_balance_after
    ) VALUES (
      v_total, v_type, v_id, 'external', NULL,
      'accessory', p_accessory_id,
      format('Закупівля аксесуарів: %s (%s шт × %s грн)', v_acc_name, p_quantity, p_unit_cost),
      p_user_id, v_method,
      v_bb, v_ba
    );
  END IF;

  UPDATE public.accessories
  SET stock = stock + p_quantity, cost_price = p_new_cost_price, purchase_ordered_at = NULL
  WHERE id = p_accessory_id;

  INSERT INTO public.inventory_movements (
    item_type, item_id, quantity_change, reason, unit_cost, created_by
  ) VALUES ('accessory', p_accessory_id, p_quantity, 'purchase', p_unit_cost, p_user_id);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.purchase_accessory_stock(uuid, integer, integer, integer, uuid, text, uuid, text, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.purchase_accessory_stock(uuid, integer, integer, integer, uuid, text, uuid, text, uuid) TO authenticated, service_role;

-- ── 8. transfer_funds — snapshots for BOTH accounts ──────────────────────────

CREATE OR REPLACE FUNCTION public.transfer_funds(
  from_id        uuid,
  from_type      text,
  to_id          uuid,
  to_type        text,
  amount         integer,
  desc_text      text,
  user_id        uuid,
  payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_from_name   text;
  v_from_method text;
  v_from_bb     integer;
  v_from_ba     integer;
  v_to_name     text;
  v_to_kind     text;
  v_to_bb       integer;
  v_to_ba       integer;
BEGIN
  IF from_type NOT IN ('cash_register', 'safe') OR to_type NOT IN ('cash_register', 'safe') THEN
    RAISE EXCEPTION 'Невалідний тип джерела або одержувача';
  END IF;
  IF amount <= 0 THEN RAISE EXCEPTION 'Сума переказу має бути більше 0'; END IF;
  IF from_id = to_id AND from_type = to_type THEN
    RAISE EXCEPTION 'Джерело та одержувач не можуть бути однаковими';
  END IF;

  -- Списання з джерела
  SELECT o_name, o_method, o_balance_before, o_balance_after
    INTO v_from_name, v_from_method, v_from_bb, v_from_ba
  FROM public.account_apply(from_type, from_id, -amount, payment_method);

  -- Зарахування одержувачу + snapshot
  IF to_type = 'safe' THEN
    SELECT o_name, o_balance_before, o_balance_after
      INTO v_to_name, v_to_bb, v_to_ba
    FROM public.account_apply('safe', to_id, amount, payment_method);
  ELSE
    SELECT name, type, balance INTO v_to_name, v_to_kind, v_to_bb
    FROM public.cash_registers WHERE id = to_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Касу одержувача не знайдено'; END IF;
    UPDATE public.cash_registers SET balance = balance + amount, updated_at = now() WHERE id = to_id;
    v_to_ba := v_to_bb + amount;
  END IF;

  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, description, created_by, payment_method,
    from_balance_before, from_balance_after,
    to_balance_before,   to_balance_after
  ) VALUES (
    amount, from_type, from_id, to_type, to_id,
    'distribution',
    COALESCE(desc_text, 'Внутрішній переказ: ' || v_from_name || ' → ' || v_to_name),
    user_id, v_from_method,
    v_from_bb, v_from_ba,
    v_to_bb,   v_to_ba
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.transfer_funds(uuid, text, uuid, text, integer, text, uuid, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.transfer_funds(uuid, text, uuid, text, integer, text, uuid, text) TO authenticated, service_role;

-- ── 9. top_up_safe ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.top_up_safe(
  p_safe_id        uuid,
  p_amount         integer,
  p_desc_text      text,
  p_user_id        uuid,
  p_payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_name text;
  v_bb   integer;
  v_ba   integer;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Сума поповнення має бути більше 0'; END IF;

  SELECT name, balance INTO v_name, v_bb FROM public.safes WHERE id = p_safe_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Сейф не знайдено'; END IF;

  PERFORM public.safe_apply(p_safe_id, p_amount, p_payment_method);
  v_ba := v_bb + p_amount;

  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, description, created_by, payment_method,
    to_balance_before, to_balance_after
  ) VALUES (
    p_amount, 'external', NULL, 'safe', p_safe_id,
    'top_up',
    COALESCE(p_desc_text, 'Поповнення сейфу ' || v_name),
    p_user_id, p_payment_method,
    v_bb, v_ba
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.top_up_safe(uuid, integer, text, uuid, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.top_up_safe(uuid, integer, text, uuid, text) TO authenticated, service_role;

-- ── 10. withdraw_owner_share ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.withdraw_owner_share(
  source_type    text,
  source_id      uuid,
  amount         numeric,
  desc_text      text,
  user_id        uuid,
  payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_name text;
  v_bb   integer;
  v_ba   integer;
  v_int  integer := round(amount)::integer;
BEGIN
  IF amount <= 0 THEN RAISE EXCEPTION 'Сума має бути більше 0'; END IF;

  IF source_type = 'safe' THEN
    SELECT balance, name INTO v_bb, v_name FROM public.safes WHERE id = source_id;
    PERFORM public.safe_apply(source_id, -v_int, payment_method);
    v_ba := v_bb - v_int;
  ELSIF source_type = 'cash_register' THEN
    SELECT balance, name INTO v_bb, v_name FROM public.cash_registers WHERE id = source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Касу не знайдено'; END IF;
    IF v_bb < v_int THEN
      RAISE EXCEPTION 'У касі "%" лише % грн, а вилучити треба % грн', v_name, v_bb, v_int;
    END IF;
    UPDATE public.cash_registers SET balance = balance - v_int, updated_at = now() WHERE id = source_id;
    v_ba := v_bb - v_int;
  ELSE
    RAISE EXCEPTION 'Невідомий тип джерела: %', source_type;
  END IF;

  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, description, created_by, payment_method,
    from_balance_before, from_balance_after
  ) VALUES (
    v_int, source_type, source_id, 'external', NULL,
    'distribution',
    COALESCE(desc_text, 'Вилучення частки прибутку з ' || COALESCE(v_name, source_type)),
    user_id, payment_method,
    v_bb, v_ba
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.withdraw_owner_share(text, uuid, numeric, text, uuid, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.withdraw_owner_share(text, uuid, numeric, text, uuid, text) TO authenticated, service_role;

-- ── 11. pay_repair ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pay_repair(
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
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Сума оплати має бути більше 0'; END IF;

  SELECT price, device_name INTO v_price, v_device_name FROM public.repairs WHERE id = p_repair_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ремонт не знайдено'; END IF;

  SELECT name, balance INTO v_register, v_bb
  FROM public.cash_registers WHERE id = p_cash_register_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Касу не знайдено'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.transactions
  WHERE reference_type = 'repair_payment' AND reference_id = p_repair_id;

  IF v_paid + p_amount > v_price THEN
    RAISE EXCEPTION 'Переплата: ціна %, вже сплачено %, залишок %', v_price, v_paid, v_price - v_paid;
  END IF;

  UPDATE public.cash_registers SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_cash_register_id;
  v_ba := v_bb + p_amount;

  INSERT INTO public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, reference_id, description, created_by,
    to_balance_before, to_balance_after
  ) VALUES (
    p_amount,
    'customer', NULL, 'cash_register', p_cash_register_id,
    'repair_payment', p_repair_id,
    'Оплата ремонту: ' || COALESCE(v_device_name, '—'),
    p_user_id,
    v_bb, v_ba
  );

  UPDATE public.repairs
  SET payment_status = CASE
        WHEN v_paid + p_amount >= v_price THEN 'paid'::payment_status
        ELSE 'partial'::payment_status
      END,
      updated_at = NOW()
  WHERE id = p_repair_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.pay_repair(uuid, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pay_repair(uuid, uuid, integer, uuid) TO authenticated, service_role;

-- ── 12. process_quick_sale ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.process_quick_sale(
  p_is_warranty         boolean,
  p_customer_id         uuid,
  p_amount              int,
  p_discount            int,
  p_notes               text,
  p_created_by          uuid,
  p_sale_type           text,
  p_delivery_needed     boolean,
  p_delivery_address    text,
  p_delivery_tracking   text,
  p_warranty_start      timestamp with time zone,
  p_warranty_end        timestamp with time zone,
  p_return_reason       text,
  p_monobank_payment_id text,
  p_partner_id          uuid,
  p_promo_code_used     text,
  p_item_category       text,
  p_item_id             uuid,
  p_cash_register_id    uuid,
  p_payments            jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_sale_id     uuid;
  v_dev_status  text;
  v_dev_cost    int;
  v_acc_stock   int;
  v_acc_cost    int;
  v_payment     jsonb;
  v_amount      int;
  v_method      text;
  v_method_text text;
  v_reg_balance int;
  v_bb          int;
  v_ba          int;
BEGIN
  INSERT INTO public.sales (
    is_warranty, customer_id, total_amount, discount, notes, created_by, sale_type,
    delivery_needed, delivery_address, delivery_tracking, warranty_start, warranty_end,
    return_reason, monobank_payment_id, partner_id, promo_code_used
  ) VALUES (
    p_is_warranty, p_customer_id, p_amount, p_discount, p_notes, p_created_by,
    p_sale_type::public.sale_type,
    p_delivery_needed, p_delivery_address, p_delivery_tracking, p_warranty_start, p_warranty_end,
    p_return_reason, p_monobank_payment_id, p_partner_id, p_promo_code_used
  ) RETURNING id INTO v_sale_id;

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

  -- Зчитуємо поточний баланс каси один раз (FOR UPDATE вже утримуємо від вставки device/acc)
  SELECT balance INTO v_reg_balance FROM public.cash_registers WHERE id = p_cash_register_id FOR UPDATE;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_amount := (v_payment->>'amount')::int;
    IF v_amount <= 0 THEN CONTINUE; END IF;
    v_method      := v_payment->>'method';
    v_method_text := CASE v_method WHEN 'cash' THEN 'Готівка' WHEN 'card' THEN 'Картка' ELSE 'Переказ' END;
    v_bb          := v_reg_balance;
    v_ba          := v_reg_balance + v_amount;
    v_reg_balance := v_ba;

    INSERT INTO public.payment_splits (sale_id, amount, method, cash_register_id)
    VALUES (v_sale_id, v_amount, v_method, p_cash_register_id);

    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, reference_id, description, created_by,
      to_balance_before, to_balance_after
    ) VALUES (
      v_amount,
      CASE WHEN p_customer_id IS NOT NULL THEN 'customer' ELSE 'external' END,
      p_customer_id, 'cash_register', p_cash_register_id,
      'sale', v_sale_id,
      p_notes || ' [Оплата: ' || v_method_text || ']',
      p_created_by,
      v_bb, v_ba
    );

    UPDATE public.cash_registers SET balance = balance + v_amount WHERE id = p_cash_register_id;
  END LOOP;

  RETURN v_sale_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.process_quick_sale(boolean, uuid, int, int, text, uuid, text, boolean, text, text, timestamptz, timestamptz, text, text, uuid, text, text, uuid, uuid, jsonb) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.process_quick_sale(boolean, uuid, int, int, text, uuid, text, boolean, text, text, timestamptz, timestamptz, text, text, uuid, text, text, uuid, uuid, jsonb) TO authenticated, service_role;

-- ── 13. register_device_purchase — snapshot через account_apply ───────────────

CREATE OR REPLACE FUNCTION public.register_device_purchase(
  p_type                  text,
  p_brand                 text,
  p_model                 text,
  p_imei                  text,
  p_price                 int,
  p_cost_price            int,
  p_ram                   text,
  p_storage               text,
  p_color                 text,
  p_battery_health        int,
  p_screen_size           text,
  p_cpu                   text,
  p_gpu                   text,
  p_needs_repair          boolean,
  p_repair_node           text,
  p_repair_cost           int,
  p_repair_np_ttn         text,
  p_repair_status         text,
  p_repair_parts_replaced jsonb,
  p_description           text,
  p_is_visible            boolean,
  p_source                text,
  p_source_reference      text,
  p_purchased_from        text,
  p_condition_grade       text,
  p_condition_description text,
  p_original_box          boolean,
  p_accessories_included  text,
  p_serial_number         text,
  p_warehouse_location    text,
  p_photo_urls            jsonb,
  p_safe_id               uuid,
  p_user_id               uuid,
  p_payment_method        text DEFAULT 'cash',
  p_source_type           text DEFAULT 'safe',
  p_source_id             uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_device_id   uuid;
  v_description text;
  v_src_type    text := COALESCE(NULLIF(p_source_type, ''), 'safe');
  v_src_id      uuid := COALESCE(p_source_id, p_safe_id);
  v_name        text;
  v_method      text;
  v_bb          integer;
  v_ba          integer;
BEGIN
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

  IF p_cost_price > 0 AND v_src_id IS NOT NULL THEN
    v_description := 'Закупівля техніки: ' || p_brand || ' ' || p_model;
    IF p_imei IS NOT NULL THEN
      v_description := v_description || ' (IMEI: ' || p_imei || ')';
    END IF;

    SELECT o_name, o_method, o_balance_before, o_balance_after
      INTO v_name, v_method, v_bb, v_ba
    FROM public.account_apply(v_src_type, v_src_id, -p_cost_price, p_payment_method);

    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, reference_id, description, created_by, payment_method,
      from_balance_before, from_balance_after
    ) VALUES (
      p_cost_price, v_src_type, v_src_id, 'external', NULL,
      'inventory', v_device_id, v_description, p_user_id, v_method,
      v_bb, v_ba
    );
  END IF;

  RETURN v_device_id;
END;
$fn$;

-- ── 14. convert_safe_halves — фікс бага (user_id/date → created_by) + snapshots

CREATE OR REPLACE FUNCTION public.convert_safe_halves(
  p_safe_id   uuid,
  p_amount    integer,
  p_direction text,
  p_desc_text text,
  p_user_id   uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_safe      public.safes%rowtype;
  v_from_half integer;
  v_desc      text;
  v_dir_uk    text;
  v_bb        integer;
BEGIN
  IF p_direction NOT IN ('cash_to_card', 'card_to_cash') THEN
    RAISE EXCEPTION 'Невідомий напрямок: %. Очікується cash_to_card або card_to_cash', p_direction;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Сума конвертації має бути більше 0';
  END IF;

  SELECT * INTO v_safe FROM public.safes WHERE id = p_safe_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Сейф не знайдено'; END IF;

  v_from_half := CASE WHEN p_direction = 'cash_to_card' THEN v_safe.balance_cash ELSE v_safe.balance_cashless END;
  v_dir_uk    := CASE WHEN p_direction = 'cash_to_card' THEN 'готівки' ELSE 'безготівки' END;

  IF v_from_half < p_amount THEN
    RAISE EXCEPTION 'У сейфі "%" лише % грн %. Конвертувати % грн неможливо',
      v_safe.name, v_from_half, v_dir_uk, p_amount;
  END IF;

  v_bb := v_safe.balance; -- загальний баланс не зміниться

  v_desc := COALESCE(NULLIF(p_desc_text, ''),
    CASE WHEN p_direction = 'cash_to_card'
      THEN 'Конвертація: готівка → безготівка'
      ELSE 'Конвертація: безготівка → готівка'
    END);

  UPDATE public.safes
  SET balance_cash     = balance_cash     + CASE WHEN p_direction = 'card_to_cash' THEN p_amount ELSE -p_amount END,
      balance_cashless = balance_cashless + CASE WHEN p_direction = 'cash_to_card' THEN p_amount ELSE -p_amount END,
      updated_at       = now()
  WHERE id = p_safe_id;

  -- from_id = to_id = same safe; загальний balance незмінний → before = after
  INSERT INTO public.transactions (
    from_type, from_id, to_type, to_id,
    amount, reference_type, description, payment_method, created_by,
    from_balance_before, from_balance_after,
    to_balance_before,   to_balance_after
  ) VALUES (
    'safe', p_safe_id, 'safe', p_safe_id,
    p_amount, 'convert', v_desc,
    CASE WHEN p_direction = 'cash_to_card' THEN 'cashless' ELSE 'cash' END,
    p_user_id,
    v_bb, v_bb,
    v_bb, v_bb
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.convert_safe_halves(uuid, integer, text, text, uuid) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.convert_safe_halves(uuid, integer, text, text, uuid) TO service_role;

-- ── 15. Глобальний REVOKE для нових SECURITY DEFINER функцій ─────────────────

DO $g$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public', fn.sig);
  END LOOP;
END $g$;
