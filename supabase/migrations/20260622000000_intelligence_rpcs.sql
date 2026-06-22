-- ============================================================
-- VV CRM Intelligence RPCs
-- Module: Smart Revenue Intelligence
-- Date: 2026-06-22
-- ============================================================

-- ============================================================
-- RPC 1: Phone Model Demand Analytics
-- Combines repair intake + sales data to build demand score per model
-- ============================================================
CREATE OR REPLACE FUNCTION get_model_demand_analytics(days_back INT DEFAULT 90)
RETURNS TABLE (
  brand         TEXT,
  model         TEXT,
  repair_count  BIGINT,
  sold_count    BIGINT,
  avg_margin    NUMERIC,
  avg_days_to_sell NUMERIC,
  demand_score  NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH repair_stats AS (
    SELECT
      TRIM(SPLIT_PART(device_name, ' ', 1))                                        AS brand,
      TRIM(SUBSTRING(device_name FROM POSITION(' ' IN device_name) + 1))            AS model,
      COUNT(*)                                                                       AS repair_count
    FROM repairs
    WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
      AND device_name IS NOT NULL
      AND POSITION(' ' IN device_name) > 0
    GROUP BY 1, 2
    HAVING COUNT(*) >= 1
  ),
  sales_stats AS (
    SELECT
      COALESCE(d.brand, '')                                                          AS brand,
      COALESCE(d.model, '')                                                          AS model,
      COUNT(si.id)                                                                   AS sold_count,
      AVG((d.price - d.cost_price)::NUMERIC)                                        AS avg_margin,
      AVG(
        EXTRACT(EPOCH FROM (s.created_at - d.created_at)) / 86400.0
      )                                                                              AS avg_days_to_sell
    FROM devices d
    JOIN sale_items si ON si.item_id = d.id AND si.item_type = 'device'
    JOIN sales s ON s.id = si.sale_id
    WHERE s.created_at > NOW() - (days_back || ' days')::INTERVAL
      AND d.model IS NOT NULL
    GROUP BY d.brand, d.model
  )
  SELECT
    COALESCE(s.brand, r.brand)                                                       AS brand,
    COALESCE(s.model, r.model)                                                       AS model,
    COALESCE(r.repair_count, 0)                                                      AS repair_count,
    COALESCE(s.sold_count, 0)                                                        AS sold_count,
    ROUND(COALESCE(s.avg_margin, 0), 0)                                              AS avg_margin,
    ROUND(COALESCE(s.avg_days_to_sell, 0), 1)                                        AS avg_days_to_sell,
    ROUND(
      (COALESCE(r.repair_count, 0) * 0.35 + COALESCE(s.sold_count, 0) * 0.65)::NUMERIC,
      1
    )                                                                                AS demand_score
  FROM sales_stats s
  FULL OUTER JOIN repair_stats r
    ON LOWER(s.brand) = LOWER(r.brand) AND LOWER(s.model) = LOWER(r.model)
  WHERE COALESCE(s.brand, r.brand) IS NOT NULL
    AND COALESCE(s.model, r.model) IS NOT NULL
    AND TRIM(COALESCE(s.model, r.model)) <> ''
  ORDER BY demand_score DESC
  LIMIT 15;
$$;

-- ============================================================
-- RPC 2: Inventory Stockout Forecast
-- Computes avg daily demand and projects days until stockout
-- for all active accessories and parts
-- ============================================================
CREATE OR REPLACE FUNCTION get_inventory_stockout_forecast()
RETURNS TABLE (
  item_id           UUID,
  item_name         TEXT,
  item_type         TEXT,
  current_stock     INT,
  avg_daily_demand  NUMERIC,
  days_until_stockout NUMERIC,
  restock_urgency   TEXT,
  margin_percent    NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH acc_demand AS (
    SELECT
      a.id,
      a.name,
      'accessory'::TEXT                                          AS item_type,
      a.stock,
      COALESCE(COUNT(si.id)::NUMERIC / 30.0, 0)                 AS avg_daily,
      a.price,
      a.cost_price
    FROM accessories a
    LEFT JOIN (
      SELECT sub_si.id, sub_si.item_id
      FROM sale_items sub_si
      JOIN sales s ON s.id = sub_si.sale_id
      WHERE sub_si.item_type = 'accessory'
        AND s.created_at > NOW() - INTERVAL '30 days'
    ) si ON si.item_id = a.id
    WHERE a.status = 'active'
    GROUP BY a.id, a.name, a.stock, a.price, a.cost_price
  ),
  parts_demand AS (
    SELECT
      p.id,
      p.name,
      'part'::TEXT                                               AS item_type,
      p.stock,
      COALESCE(COUNT(rp.id)::NUMERIC / 30.0, 0)                 AS avg_daily,
      COALESCE(p.price, 0)                                       AS price,
      p.cost_price
    FROM parts p
    LEFT JOIN (
      SELECT sub_rp.id, sub_rp.part_id
      FROM repair_parts sub_rp
      JOIN repairs r ON r.id = sub_rp.repair_id
      WHERE r.created_at > NOW() - INTERVAL '30 days'
    ) rp ON rp.part_id = p.id
    GROUP BY p.id, p.name, p.stock, p.price, p.cost_price
  ),
  combined AS (
    SELECT * FROM acc_demand
    UNION ALL
    SELECT * FROM parts_demand
  )
  SELECT
    id                                                          AS item_id,
    name                                                        AS item_name,
    item_type,
    stock                                                       AS current_stock,
    ROUND(avg_daily, 2)                                         AS avg_daily_demand,
    CASE
      WHEN avg_daily > 0 THEN ROUND(stock::NUMERIC / avg_daily, 0)
      ELSE 999::NUMERIC
    END                                                         AS days_until_stockout,
    CASE
      WHEN avg_daily > 0 AND stock::NUMERIC / avg_daily < 7   THEN 'CRITICAL'
      WHEN avg_daily > 0 AND stock::NUMERIC / avg_daily < 14  THEN 'LOW'
      WHEN avg_daily = 0 AND stock > 10                        THEN 'DEAD_STOCK'
      ELSE 'OK'
    END                                                         AS restock_urgency,
    CASE
      WHEN price > 0 THEN ROUND(((price - cost_price)::NUMERIC / price) * 100, 0)
      ELSE 0::NUMERIC
    END                                                         AS margin_percent
  FROM combined
  ORDER BY
    CASE
      WHEN avg_daily > 0 AND stock::NUMERIC / avg_daily < 7   THEN 1
      WHEN avg_daily > 0 AND stock::NUMERIC / avg_daily < 14  THEN 2
      WHEN avg_daily = 0 AND stock > 10                        THEN 3
      ELSE 4
    END,
    avg_daily DESC
  LIMIT 20;
$$;

-- ============================================================
-- RPC 3: Revenue Heatmap (Day of Week × Hour)
-- Returns revenue and transaction count per (dow, hour) bucket
-- Used to identify "peak money moments"
-- ============================================================
CREATE OR REPLACE FUNCTION get_revenue_heatmap(days_back INT DEFAULT 60)
RETURNS TABLE (
  dow            INT,   -- 0=Sunday ... 6=Saturday
  hour_of_day    INT,   -- 0-23
  total_revenue  BIGINT,
  tx_count       BIGINT,
  avg_check      NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    EXTRACT(DOW  FROM created_at AT TIME ZONE 'Europe/Kyiv')::INT   AS dow,
    EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Kyiv')::INT   AS hour_of_day,
    SUM(total_amount)                                               AS total_revenue,
    COUNT(*)                                                        AS tx_count,
    ROUND(AVG(total_amount)::NUMERIC, 0)                           AS avg_check
  FROM sales
  WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
    AND total_amount > 0
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;
