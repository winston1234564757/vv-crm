-- Migration: Align Repair Statuses in Devices
-- 1. Drop existing inline check constraint if exists
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_repair_status_check;

-- 2. Add updated constraint with all possible repair statuses
ALTER TABLE public.devices ADD CONSTRAINT devices_repair_status_check CHECK (
  repair_status IN ('pending', 'diagnostics', 'in_progress', 'waiting_parts', 'ready', 'completed', 'handed_over', 'cancelled')
);
