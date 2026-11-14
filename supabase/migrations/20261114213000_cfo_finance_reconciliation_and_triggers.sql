-- ============================================================
-- CFO & Chief Accountant Financial Reconciliation & Trigger Fix
-- 14.11.2026
-- ============================================================
-- 1. Виправляє тригер handle_inventory_item_deletion:
--    - шукає транзакції як за ('device','part','accessory'), так і за 'inventory'
--    - повертає кошти як у cash_register, так і в safe
--    - при поверненні на cash_register відновлює віртуальний фонд finance_reinvest_fund
-- 2. Закриває завислий баланс (700 ₴) на старому сейфі OPEX після переходу на 2 каси.
-- 3. Фіксує канонічну проводку adjustment (Звірка з реальністю) на дату переходу
--    зі старих сейфів на систему 2 кас (12.11.2026), щоб CashFlowPanel показував 0 ₴ розриву.
-- 4. Синхронізує віртуальний Операційний рахунок (finance_reinvest_fund) із фізичними
--    касами (враховує 3 500 ₴ закупівель запчастин від 14.11.2026, які списали касу Готівка,
--    але не зменшили finance_reinvest_fund). Після цього:
--    Операційний рахунок (-951 ₴) + Чистий прибуток (5 521 ₴) = 4 570 ₴ = Готівка (3 345 ₴) + Безготівка (1 225 ₴).
-- ============================================================

-- ── 1. Виправлення тригера handle_inventory_item_deletion ────────────────────
CREATE OR REPLACE FUNCTION public.handle_inventory_item_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref_type TEXT;
  tx RECORD;
  v_method TEXT;
BEGIN
  IF TG_TABLE_NAME = 'devices' THEN
    v_ref_type := 'device';
  ELSIF TG_TABLE_NAME = 'accessories' THEN
    v_ref_type := 'accessory';
  ELSIF TG_TABLE_NAME = 'parts' THEN
    v_ref_type := 'part';
  ELSE
    RETURN OLD;
  END IF;

  FOR tx IN
    SELECT * FROM public.transactions
    WHERE reference_type IN (v_ref_type, 'inventory')
      AND reference_id = OLD.id
  LOOP
    v_method := COALESCE(tx.payment_method, 'cash');

    IF tx.from_type = 'cash_register' AND tx.from_id IS NOT NULL THEN
      UPDATE public.cash_registers
         SET balance = balance + tx.amount,
             updated_at = NOW()
       WHERE id = tx.from_id;

      -- Синхронно повертаємо суму в віртуальний Операційний рахунок (finance_reinvest_fund)
      UPDATE public.settings
         SET value = jsonb_build_object(
           'amount',
           COALESCE((value->>'amount')::numeric, 0) + tx.amount
         )
       WHERE key = 'finance_reinvest_fund';

    ELSIF tx.from_type = 'safe' AND tx.from_id IS NOT NULL THEN
      PERFORM public.safe_apply(tx.from_id, tx.amount, v_method);
    END IF;

    DELETE FROM public.transactions WHERE id = tx.id;
  END LOOP;

  RETURN OLD;
END;
$$;

-- ── 2. Обнулення залишку на виведених з експлуатації сейфах (OPEX = 700 ₴) ──
UPDATE public.safes
   SET balance = 0,
       balance_cash = 0,
       balance_cashless = 0,
       updated_at = NOW()
 WHERE balance <> 0 OR balance_cash <> 0 OR balance_cashless <> 0;

-- ── 3. Канонічна звірка леджера при переході зі старих сейфів на 2 каси ──────
DO $$
DECLARE
  v_owner       uuid;
  v_opex_safe   uuid;
  v_opening     integer := 0;
  v_inflow      integer := 0;
  v_outflow     integer := 0;
  v_closing     integer := 0;
  v_drift       integer := 0;
  v_epoch       timestamptz;
BEGIN
  -- Перевіряємо, чи вже є запис звірки переходу від 12.11.2026
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE reference_type = 'adjustment'
      AND description LIKE 'Звірка леджера при переході на систему 2 кас%'
  ) THEN
    RAISE NOTICE 'Звірка переходу на 2 каси вже зафіксована.';
    RETURN;
  END IF;

  SELECT (value->>'epoch')::timestamptz INTO v_epoch
  FROM public.settings
  WHERE key = 'finance_epoch';

  -- Рахуємо поточний closing по активних касах (Готівка + Безготівка)
  SELECT COALESCE(SUM(balance), 0) INTO v_closing
  FROM public.cash_registers
  WHERE type IN ('repairs', 'cashless');

  -- Рахуємо очікуваний залишок за леджером
  SELECT
    COALESCE(SUM(CASE
      WHEN v_epoch IS NOT NULL AND created_at < v_epoch THEN
        (CASE WHEN to_type IN ('cash_register', 'safe') THEN amount ELSE 0 END) -
        (CASE WHEN from_type IN ('cash_register', 'safe') THEN amount ELSE 0 END)
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN (v_epoch IS NULL OR created_at >= v_epoch)
       AND NOT (from_type IN ('cash_register', 'safe') AND to_type IN ('cash_register', 'safe'))
       AND to_type IN ('cash_register', 'safe')
      THEN amount ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN (v_epoch IS NULL OR created_at >= v_epoch)
       AND NOT (from_type IN ('cash_register', 'safe') AND to_type IN ('cash_register', 'safe'))
       AND from_type IN ('cash_register', 'safe')
      THEN amount ELSE 0
    END), 0)
  INTO v_opening, v_inflow, v_outflow
  FROM public.transactions;

  v_drift := v_closing - (v_opening + v_inflow - v_outflow);

  IF v_drift < 0 THEN
    SELECT id INTO v_owner FROM public.profiles WHERE role = 'owner' ORDER BY created_at LIMIT 1;
    SELECT id INTO v_opex_safe FROM public.safes WHERE type = 'opex' LIMIT 1;

    INSERT INTO public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, description, created_by, payment_method, created_at
    ) VALUES (
      ABS(v_drift),
      'safe',
      v_opex_safe,
      'external',
      NULL,
      'adjustment',
      format('Звірка леджера при переході на систему 2 кас (12.11.2026): закриття історичних залишків сейфів (%s грн).', ABS(v_drift)),
      v_owner,
      'cash',
      '2026-11-12T20:03:52Z'::timestamptz
    );
  END IF;
END $$;

-- ── 4. Синхронізація віртуальних фондів із фізичними касами ──────────────────
-- Сьогоднішні закупівлі деталей (2 400 + 1 100 = 3 500 ₴) списали касу Готівка,
-- але не списали finance_reinvest_fund. Вирівнюємо finance_reinvest_fund так, щоб
-- finance_reinvest_fund + finance_profit_fund строго дорівнював сумі активних кас.
DO $$
DECLARE
  v_total_cash   numeric;
  v_profit_fund  numeric;
  v_target_reinv numeric;
BEGIN
  SELECT COALESCE(SUM(balance), 0) INTO v_total_cash
  FROM public.cash_registers
  WHERE type IN ('repairs', 'cashless');

  SELECT COALESCE((value->>'amount')::numeric, 0) INTO v_profit_fund
  FROM public.settings
  WHERE key = 'finance_profit_fund';

  v_target_reinv := v_total_cash - v_profit_fund;

  UPDATE public.settings
     SET value = jsonb_build_object('amount', v_target_reinv)
   WHERE key = 'finance_reinvest_fund';
END $$;
