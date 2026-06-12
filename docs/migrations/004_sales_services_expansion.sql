-- Phase 4: Sales + Services Expansion

ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'retail';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_needed boolean DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_tracking text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS warranty_start date;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS monobank_payment_id text;

ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes int;
ALTER TABLE services ADD COLUMN IF NOT EXISTS warranty_days int DEFAULT 0;
