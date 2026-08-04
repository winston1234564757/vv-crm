-- Add purchase tracking fields to accessories
-- purchase_ordered_at: timestamp when this accessory was added to purchase order
-- supplier_sku: SKU/article from supplier (e.g. itsellopt.ua) for import format

ALTER TABLE accessories
  ADD COLUMN IF NOT EXISTS purchase_ordered_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS supplier_sku TEXT DEFAULT NULL;
