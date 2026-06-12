-- Phase 5: Customers Expansion

ALTER TABLE customers ADD COLUMN IF NOT EXISTS vip_status text DEFAULT 'regular';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_contact text DEFAULT 'phone';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source text DEFAULT 'walk_in';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS social_links jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS orders_total int DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS orders_completed int DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visit timestamptz;
