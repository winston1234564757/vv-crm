-- Зняти обмеження NOT NULL з customer_id, щоб підтримувати ремонти без клієнта (внутрішні ремонти)
ALTER TABLE repairs ALTER COLUMN customer_id DROP NOT NULL;

-- Додати посилання на пристрій на складі (inventory_device_id)
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS inventory_device_id UUID REFERENCES devices(id) ON DELETE SET NULL;
