-- УЗГОДЖЕННЯ ДРЕЙФУ СХЕМИ: enum-типи та enum-колонки.
--
-- Контекст: у живій БД 5 типів (device_condition, device_source, payment_status,
-- repair_source, sale_type) створені ВРУЧНУ, поза міграціями, і 7 колонок конвертовані
-- в них із TEXT — інколи з перемапом значень/дефолтів (напр. devices.source: файли кажуть
-- DEFAULT 'purchase', але enum device_source не містить 'purchase', а живий дефолт 'supplier').
-- Через це міграційні файли НЕ відтворювали живу схему, і функції з кастом ::enum
-- (process_quick_sale, process_pos_sale) впали б при чистому розгортанні.
--
-- Ця міграція формалізує типи й конвертації, щоб чисте розгортання збігалося з живою БД.
-- Повністю ІДЕМПОТЕНТНА: на живій БД — no-op (типи вже є, колонки вже enum, кожен блок
-- пропускається), на чистій БД — створює типи й конвертує колонки з TEXT.
--
-- Порядок: timestamp 20260719000500 навмисно РАНІШЕ за 20260719001000_process_quick_sale
-- (яка кастує ::public.sale_type) — щоб enum існував до першого каста при чистому розгортанні.

-- ============================================================
-- 1. Enum-типи (CREATE TYPE не має IF NOT EXISTS → guard через duplicate_object)
-- ============================================================
DO $$ BEGIN CREATE TYPE public.device_condition AS ENUM ('perfect','good','fair','poor','damaged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.device_source AS ENUM ('trade_in','buyout','supplier','olx','marketplace','customer_return','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','partial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.repair_source AS ENUM ('walk_in','phone','online','marketplace'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sale_type AS ENUM ('retail','wholesale','online'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. Конвертація колонок. Кожен блок пропускається, якщо колонка вже потрібного enum-типу
--    (udt_name = ім'я enum). USING col::text::enum. Дефолти відтворюють живі значення.
-- ============================================================

-- sales.sale_type  (TEXT DEFAULT 'retail' → sale_type DEFAULT 'retail')
DO $$ BEGIN
  IF (SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='sale_type') <> 'sale_type' THEN
    ALTER TABLE public.sales ALTER COLUMN sale_type DROP DEFAULT;
    UPDATE public.sales SET sale_type='retail' WHERE sale_type IS NULL OR sale_type NOT IN ('retail','wholesale','online');
    ALTER TABLE public.sales ALTER COLUMN sale_type TYPE public.sale_type USING sale_type::text::public.sale_type;
    ALTER TABLE public.sales ALTER COLUMN sale_type SET DEFAULT 'retail';
  END IF;
END $$;

-- repairs.payment_status  (TEXT DEFAULT 'unpaid' → payment_status DEFAULT 'unpaid')
DO $$ BEGIN
  IF (SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='repairs' AND column_name='payment_status') <> 'payment_status' THEN
    ALTER TABLE public.repairs ALTER COLUMN payment_status DROP DEFAULT;
    UPDATE public.repairs SET payment_status='unpaid' WHERE payment_status IS NULL OR payment_status NOT IN ('unpaid','paid','partial');
    ALTER TABLE public.repairs ALTER COLUMN payment_status TYPE public.payment_status USING payment_status::text::public.payment_status;
    ALTER TABLE public.repairs ALTER COLUMN payment_status SET DEFAULT 'unpaid';
  END IF;
END $$;

-- repairs.device_condition  (TEXT, без дефолту → device_condition, без дефолту)
DO $$ BEGIN
  IF (SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='repairs' AND column_name='device_condition') <> 'device_condition' THEN
    UPDATE public.repairs SET device_condition=NULL WHERE device_condition IS NOT NULL AND device_condition NOT IN ('perfect','good','fair','poor','damaged');
    ALTER TABLE public.repairs ALTER COLUMN device_condition TYPE public.device_condition USING device_condition::text::public.device_condition;
  END IF;
END $$;

-- repairs.source  (TEXT DEFAULT 'walk_in' → repair_source DEFAULT 'walk_in')
DO $$ BEGIN
  IF (SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='repairs' AND column_name='source') <> 'repair_source' THEN
    ALTER TABLE public.repairs ALTER COLUMN source DROP DEFAULT;
    UPDATE public.repairs SET source='walk_in' WHERE source IS NULL OR source NOT IN ('walk_in','phone','online','marketplace');
    ALTER TABLE public.repairs ALTER COLUMN source TYPE public.repair_source USING source::text::public.repair_source;
    ALTER TABLE public.repairs ALTER COLUMN source SET DEFAULT 'walk_in';
  END IF;
END $$;

-- devices.condition_grade  (TEXT, без дефолту → device_condition DEFAULT 'good')
DO $$ BEGIN
  IF (SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='devices' AND column_name='condition_grade') <> 'device_condition' THEN
    UPDATE public.devices SET condition_grade='good' WHERE condition_grade IS NULL OR condition_grade NOT IN ('perfect','good','fair','poor','damaged');
    ALTER TABLE public.devices ALTER COLUMN condition_grade TYPE public.device_condition USING condition_grade::text::public.device_condition;
    ALTER TABLE public.devices ALTER COLUMN condition_grade SET DEFAULT 'good';
  END IF;
END $$;

-- devices.source  (TEXT DEFAULT 'purchase' → device_source DEFAULT 'supplier'; 'purchase' перемапити)
DO $$ BEGIN
  IF (SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='devices' AND column_name='source') <> 'device_source' THEN
    ALTER TABLE public.devices ALTER COLUMN source DROP DEFAULT;
    UPDATE public.devices SET source='supplier' WHERE source IS NULL OR source NOT IN ('trade_in','buyout','supplier','olx','marketplace','customer_return','other');
    ALTER TABLE public.devices ALTER COLUMN source TYPE public.device_source USING source::text::public.device_source;
    ALTER TABLE public.devices ALTER COLUMN source SET DEFAULT 'supplier';
  END IF;
END $$;

-- accessories.source  (TEXT DEFAULT 'purchase' → device_source DEFAULT 'supplier'; 'purchase' перемапити)
DO $$ BEGIN
  IF (SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='accessories' AND column_name='source') <> 'device_source' THEN
    ALTER TABLE public.accessories ALTER COLUMN source DROP DEFAULT;
    UPDATE public.accessories SET source='supplier' WHERE source IS NULL OR source NOT IN ('trade_in','buyout','supplier','olx','marketplace','customer_return','other');
    ALTER TABLE public.accessories ALTER COLUMN source TYPE public.device_source USING source::text::public.device_source;
    ALTER TABLE public.accessories ALTER COLUMN source SET DEFAULT 'supplier';
  END IF;
END $$;
