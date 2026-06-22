-- Migration: Extend sale_items item_type check constraint to support services and parts
-- Date: 2026-06-21

-- 1. Drop the old strict check constraint
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_item_type_check;

-- 2. Add the new expanded check constraint supporting services and parts
ALTER TABLE sale_items ADD CONSTRAINT sale_items_item_type_check CHECK (item_type IN ('device', 'accessory', 'service', 'part'));
