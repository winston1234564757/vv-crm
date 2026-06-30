-- Зміна системи номерів ремонтів на послідовну (0001, 0002 і т.д.)

-- 1. Створюємо послідовність (sequence), яка починається з 1
CREATE SEQUENCE IF NOT EXISTS repairs_tracking_seq START 1;

-- 2. Встановлюємо дефолтне значення для колонки tracking_token
-- Функція nextval() бере наступне значення, а to_char з форматом 'FM0000' 
-- робить його 4-значним з провідними нулями (наприклад, 0001, 0012, 0456, 1234).
ALTER TABLE repairs ALTER COLUMN tracking_token SET DEFAULT to_char(nextval('repairs_tracking_seq'), 'FM0000');
