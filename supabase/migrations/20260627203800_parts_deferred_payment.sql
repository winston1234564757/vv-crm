-- Migration: Parts Deferred Payment
-- Adds columns to track payment status, due dates, and debt details for parts

-- 1. ADD COLUMNS TO parts TABLE
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'deferred')),
  ADD COLUMN IF NOT EXISTS payment_due_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS debt_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_from_safe_id UUID REFERENCES public.safes(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- 2. CREATE INDEX FOR FILTERING BY PAYMENT STATUS
CREATE INDEX IF NOT EXISTS idx_parts_payment_status ON public.parts(payment_status);
