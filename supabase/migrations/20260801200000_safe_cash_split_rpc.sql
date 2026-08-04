-- RPC: get_safes_with_cash_split
-- Повертає кожен сейф з полями cashBalance і cardBalance.
--
-- Логіка:
--   cash_in  = SUM надходжень від готівкових кас (cash_register, type != cashless)
--   card_in  = SUM надходжень від безготівкового рахунку (cash_register, type = cashless)
--   total_in = cash_in + card_in
--   Поточний баланс (balance) = total_in - total_out (вже враховано в таблиці)
--
--   Частка готівки в надходженнях: cash_ratio = cash_in / total_in
--   cashBalance = round(balance * cash_ratio)  -- від'ємний якщо overdraft
--   cardBalance = balance - cashBalance
--
-- Якщо взагалі нічого не заходило — весь баланс вважається готівкою.

DROP FUNCTION IF EXISTS get_safes_with_cash_split();

CREATE OR REPLACE FUNCTION get_safes_with_cash_split()
RETURNS TABLE (
  id          uuid,
  name        text,
  type        text,
  balance     integer,
  created_at  timestamptz,
  updated_at  timestamptz,
  "cashBalance" integer,
  "cardBalance" integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH cashless_ids AS (
    SELECT cr.id FROM cash_registers cr WHERE cr.type = 'cashless'
  ),
  safe_inflows AS (
    SELECT
      t.to_id AS safe_id,
      SUM(t.amount) AS total_in,
      SUM(CASE
        WHEN t.from_type = 'cash_register'
         AND t.from_id NOT IN (SELECT id FROM cashless_ids)
        THEN t.amount ELSE 0
      END) AS cash_in,
      SUM(CASE
        WHEN t.from_type = 'cash_register'
         AND t.from_id IN (SELECT id FROM cashless_ids)
        THEN t.amount ELSE 0
      END) AS card_in
    FROM transactions t
    WHERE t.to_type = 'safe'
    GROUP BY t.to_id
  )
  SELECT
    s.id,
    s.name,
    s.type,
    s.balance,
    s.created_at,
    s.updated_at,
    CASE
      WHEN COALESCE(si.total_in, 0) = 0 THEN s.balance
      ELSE ROUND(s.balance::numeric * COALESCE(si.cash_in, 0) / si.total_in)::integer
    END AS "cashBalance",
    CASE
      WHEN COALESCE(si.total_in, 0) = 0 THEN 0
      ELSE s.balance - ROUND(s.balance::numeric * COALESCE(si.cash_in, 0) / si.total_in)::integer
    END AS "cardBalance"
  FROM safes s
  LEFT JOIN safe_inflows si ON si.safe_id = s.id
  ORDER BY s.name;
$$;

GRANT EXECUTE ON FUNCTION get_safes_with_cash_split() TO authenticated;
GRANT EXECUTE ON FUNCTION get_safes_with_cash_split() TO service_role;
