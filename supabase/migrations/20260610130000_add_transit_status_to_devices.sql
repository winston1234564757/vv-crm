-- 1. Видаляємо старий constraint статусів пристрою
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_status_check;

-- 2. Створюємо новий constraint з додаванням статусу 'transit'
ALTER TABLE devices ADD CONSTRAINT devices_status_check CHECK (
  status IN ('in_stock', 'transit', 'sold', 'returned', 'service', 'archived')
);
