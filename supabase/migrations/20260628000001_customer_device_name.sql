-- Migration: Add device_name to customers

ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT NULL;
