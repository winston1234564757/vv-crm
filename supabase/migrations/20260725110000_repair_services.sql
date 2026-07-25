-- Migration: Add repair_services table for linking services/labor to repairs
CREATE TABLE IF NOT EXISTS public.repair_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id UUID NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by repair_id
CREATE INDEX IF NOT EXISTS idx_repair_services_repair_id ON public.repair_services(repair_id);

-- Enable RLS
ALTER TABLE public.repair_services ENABLE ROW LEVEL SECURITY;

-- Security Policies
DROP POLICY IF EXISTS "Allow select repair_services for authenticated users" ON public.repair_services;
CREATE POLICY "Allow select repair_services for authenticated users"
  ON public.repair_services FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert repair_services" ON public.repair_services;
CREATE POLICY "Allow authenticated users to insert repair_services"
  ON public.repair_services FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete repair_services" ON public.repair_services;
CREATE POLICY "Allow authenticated users to delete repair_services"
  ON public.repair_services FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update repair_services" ON public.repair_services;
CREATE POLICY "Allow authenticated users to update repair_services"
  ON public.repair_services FOR UPDATE
  TO authenticated
  USING (true);
