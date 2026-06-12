-- Phase 7: Nova Post + Monobank

ALTER TABLE payment_splits ADD COLUMN IF NOT EXISTS monobank_payment_id text;
