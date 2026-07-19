-- Розділяємо людський номер ремонту і секретне публічне посилання.
--
-- Проблема: міграція 20260629200000_repairs_sequence зробила tracking_token
-- послідовним (0001, 0002…). Публічний маршрут /track/[token] шукає ремонт саме
-- за цим значенням через service-role клієнт, тож будь-хто перебором /track/0001,
-- /track/0002 бачить дані клієнтів (ім'я, IMEI, несправність, фото) — IDOR.
--
-- Рішення: tracking_token лишається ЛЮДСЬКИМ НОМЕРОМ ремонту (адмінка, шапка чека),
-- а для публічного посилання додаємо окремий неперебірний public_token.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Колонка
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS public_token TEXT;

-- 2. Backfill наявних рядків неперебірним токеном.
--    gen_random_bytes(9) = 72 біти ентропії → base64 рівно 12 символів (без padding).
--    translate робить його URL-safe; префікс 'r' гарантує, що токен ніколи не буде
--    сплутано з номером телефону у публічному роуті (там гілка розпізнавання телефону
--    приймає лише [\d\s\-\(\)], а 'r' — літера).
UPDATE public.repairs
SET public_token = 'r' || translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_')
WHERE public_token IS NULL;

-- 3. Дефолт для нових ремонтів
ALTER TABLE public.repairs
  ALTER COLUMN public_token
  SET DEFAULT ('r' || translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_'));

-- 4. Обов'язковість + унікальність (та швидкий пошук у публічному роуті)
ALTER TABLE public.repairs ALTER COLUMN public_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS repairs_public_token_key ON public.repairs(public_token);
