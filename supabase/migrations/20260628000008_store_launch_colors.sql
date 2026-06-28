-- Add color column to store_launch_categories
ALTER TABLE public.store_launch_categories 
ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'slate';
