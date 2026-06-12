-- Migration: Phase 4 Features
-- Services entity, photo/description/visibility, repair issue nodes

-- 1. Services table (like products but no cost_price)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  photo_urls TEXT[] DEFAULT '{}',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage services"
  ON services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Add photos, description, visibility to devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT false;

-- 3. Add photos, description, visibility to accessories
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT false;

-- 4. Add photos, description to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- 5. Add photos, issue_nodes, issue_diagnostics to repairs
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS issue_nodes TEXT[] DEFAULT '{}';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS issue_diagnostics TEXT[] DEFAULT '{}';
