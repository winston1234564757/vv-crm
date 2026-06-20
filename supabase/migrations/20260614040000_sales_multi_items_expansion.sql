-- Migration: Add unit_cost to sale_items and optimize indexes for Multi-item POS Sales
-- Date: 2026-06-14

-- 1. Add unit_cost column to sale_items if it doesn't exist
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2) DEFAULT 0.00 CHECK (unit_cost >= 0);

-- 2. Backfill accessories unit_cost
UPDATE sale_items
SET unit_cost = COALESCE((SELECT cost_price FROM accessories WHERE accessories.id = sale_items.item_id::uuid), 0.00)
WHERE item_type = 'accessory';

-- 3. Backfill devices unit_cost
UPDATE sale_items
SET unit_cost = COALESCE((SELECT cost_price FROM devices WHERE devices.id = sale_items.item_id::uuid), 0.00)
WHERE item_type = 'device';

-- 4. Create performance indexes to avoid Seq Scans during cascade deletes and sales lookups
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_device_id_idx ON sale_items(item_id) WHERE item_type = 'device';
CREATE INDEX IF NOT EXISTS sale_items_accessory_id_idx ON sale_items(item_id) WHERE item_type = 'accessory';
CREATE INDEX IF NOT EXISTS sale_items_part_id_idx ON sale_items(item_id) WHERE item_type = 'part';
