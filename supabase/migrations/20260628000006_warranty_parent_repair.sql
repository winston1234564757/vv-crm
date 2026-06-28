-- Add column for linking warranty repairs to the original repair
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS warranty_for_repair_id UUID REFERENCES repairs(id) ON DELETE SET NULL;
