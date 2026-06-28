-- Додавання прапорця гарантії до таблиць ремонтів та продажів

ALTER TABLE repairs ADD COLUMN IF NOT EXISTS is_warranty BOOLEAN DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_warranty BOOLEAN DEFAULT false;
