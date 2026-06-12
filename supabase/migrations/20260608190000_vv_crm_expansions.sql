-- VV CRM Entity Expansions (Phases 2-7)
-- Safe to run: all ADD COLUMN use IF NOT EXISTS

-- === DEVICES (Phase 2) ===
ALTER TABLE devices ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'purchase';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS source_reference TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS purchased_from TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS condition_grade TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS condition_description TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS original_box BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS accessories_included TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS warehouse_location TEXT;

-- === ACCESSORIES (Phase 2) ===
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'purchase';
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS warehouse_location TEXT;

-- === REPAIRS (Phase 3) ===
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'walk_in';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_password TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_accessories_included TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition_description TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition_photos TEXT[] DEFAULT '{}';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS estimated_completion DATE;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS diagnosis_result TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS technician_notes_internal TEXT;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS customer_communication_log JSONB DEFAULT '[]'::jsonb;

-- === SALES (Phase 4) ===
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'retail';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_needed BOOLEAN DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_tracking TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS warranty_start DATE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS return_reason TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS monobank_payment_id TEXT;

-- === SERVICES (Phase 4) ===
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 0;

-- === CUSTOMERS (Phase 5) ===
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vip_status TEXT DEFAULT 'regular';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_contact TEXT DEFAULT 'phone';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'walk_in';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS social_links JSONB;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS orders_total INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS orders_completed INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ;

-- === PAYMENT SPLITS (Phase 7) ===
ALTER TABLE payment_splits ADD COLUMN IF NOT EXISTS monobank_payment_id TEXT;

-- === PARTS (Phase 8 addition) ===
ALTER TABLE parts ADD COLUMN IF NOT EXISTS np_ttn TEXT;
