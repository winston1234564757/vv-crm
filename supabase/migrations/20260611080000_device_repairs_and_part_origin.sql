-- Migration: Device Repairs and Part Origin Type
-- 1. Add repair_status and repair_parts_replaced columns to devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS repair_status TEXT NOT NULL DEFAULT 'pending' CHECK (repair_status IN ('pending', 'waiting_parts', 'in_progress', 'completed'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS repair_parts_replaced JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Add origin_type column to parts
ALTER TABLE parts ADD COLUMN IF NOT EXISTS origin_type TEXT CHECK (origin_type IN ('Copy', 'HC', 'Brand Copy', 'OEM'));
