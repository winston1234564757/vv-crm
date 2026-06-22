-- ============================================================
-- VV CRM Intelligence Schema Extensions
-- Module: AI Caching & Entity Insights
-- Date: 2026-06-23
-- ============================================================

-- 1. Add AI columns to existing tables if they do not exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ai_profile JSONB;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS ai_diagnostic JSONB;

-- 2. Create AI Entity Insights table (caching generic insights/assist comments)
CREATE TABLE IF NOT EXISTS ai_entity_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'repair', 'device', 'partner')),
  entity_id UUID NOT NULL,
  insights JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Unique Index for upsert capabilities
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_entity_insights_type_id 
  ON ai_entity_insights (entity_type, entity_id);

-- 4. Enable Row Level Security
ALTER TABLE ai_entity_insights ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_entity_insights' AND policyname = 'Enable ALL for authenticated users'
  ) THEN
    CREATE POLICY "Enable ALL for authenticated users" 
      ON ai_entity_insights FOR ALL 
      USING (auth.role() = 'authenticated');
  END IF;
END
$$;

-- 6. Trigger to update updated_at field on update
CREATE TRIGGER set_updated_at_ai_entity_insights 
  BEFORE UPDATE ON ai_entity_insights 
  FOR EACH ROW 
  EXECUTE FUNCTION trigger_set_updated_at();
