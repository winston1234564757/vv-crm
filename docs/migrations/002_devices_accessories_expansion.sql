-- Devices: new columns
ALTER TABLE devices ADD COLUMN IF NOT EXISTS source text DEFAULT 'supplier';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS source_reference text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS purchased_from text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS condition_grade text DEFAULT 'good';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS condition_description text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS original_box boolean DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS accessories_included text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS warehouse_location text;

-- Accessories: new columns
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS source text DEFAULT 'supplier';
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS warehouse_location text;
