-- Migration: Phase 3 Features
-- Add columns for device specifications, repair requirements, third-party service center, and customer discount percent

-- 1. Updates to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ram TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS screen_size TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS cpu TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS gpu TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS needs_repair BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS repair_node TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS repair_cost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS repair_np_ttn TEXT;

-- 2. Updates to repairs table
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS np_ttn TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS is_external_sc BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS external_sc_cost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS markup_amount INTEGER NOT NULL DEFAULT 0;

-- 3. Updates to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;
