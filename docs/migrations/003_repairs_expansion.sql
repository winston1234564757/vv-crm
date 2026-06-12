ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_password text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_accessories_included text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS source text DEFAULT 'walk_in';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition_description text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition_photos text[] DEFAULT '{}';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS estimated_completion timestamptz;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS diagnosis_result text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS technician_notes_internal text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS customer_communication_log jsonb DEFAULT '[]'::jsonb;

ALTER TABLE repair_status_log ADD COLUMN IF NOT EXISTS is_customer_visible boolean DEFAULT true;
