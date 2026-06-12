-- VV CRM Full Schema
-- Replaces the initial migration with complete business + financial entities

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (reverse dependency order) for clean rebuild
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS payment_splits CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS repair_parts CASCADE;
DROP TABLE IF EXISTS repair_status_log CASCADE;
DROP TABLE IF EXISTS repairs CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS accessories CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS cash_registers CASCADE;
DROP TABLE IF EXISTS safes CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- 1. USER PROFILES (linked to Supabase Auth)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'sales', 'technician')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. COUNTERPARTIES
-- ============================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  telegram_id TEXT,
  notes TEXT,
  total_visits INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INVENTORY — DEVICES (one row = one physical unit with IMEI)
-- ============================================================
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('phone', 'tablet', 'laptop', 'watch', 'other')),
  brand TEXT,
  model TEXT,
  storage TEXT,
  color TEXT,
  imei TEXT UNIQUE,
  battery_health INTEGER CHECK (battery_health IS NULL OR (battery_health >= 0 AND battery_health <= 100)),
  sku TEXT UNIQUE,
  price INTEGER NOT NULL DEFAULT 0,
  cost_price INTEGER NOT NULL DEFAULT 0,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_id UUID,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'sold', 'returned', 'service', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. INVENTORY — ACCESSORIES (stock-level, for retail sale)
-- ============================================================
CREATE TABLE accessories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('case', 'charger', 'cable', 'headphones', 'screen_protector', 'other')),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  price INTEGER NOT NULL DEFAULT 0,
  cost_price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 3,
  warranty_months INTEGER NOT NULL DEFAULT 6,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. INVENTORY — SERVICE PARTS (for repairs, not retail)
-- ============================================================
CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  part_number TEXT,
  type TEXT NOT NULL CHECK (type IN ('screen', 'battery', 'charging_port', 'button', 'camera', 'speaker', 'microphone', 'other')),
  compatible_with TEXT,
  cost_price INTEGER NOT NULL DEFAULT 0,
  price INTEGER DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 2,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. FINANCIAL — CASH REGISTERS & SAFES (before tables that reference them)
-- ============================================================
CREATE TABLE cash_registers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL UNIQUE CHECK (type IN ('repairs', 'accessories', 'tech')),
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cash_registers (name, type) VALUES
  ('Каса ремонтів', 'repairs'),
  ('Каса аксесуарів', 'accessories'),
  ('Каса техніки', 'tech');

CREATE TABLE safes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL UNIQUE CHECK (type IN ('opex', 'growth', 'net_profit')),
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO safes (name, type) VALUES
  ('OPEX', 'opex'),
  ('Growth', 'growth'),
  ('Чистий прибуток', 'net_profit');

-- ============================================================
-- 7. REPAIRS
-- ============================================================
CREATE TABLE repairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  device_name TEXT NOT NULL,
  device_imei TEXT,
  issue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'diagnostics', 'in_progress', 'awaiting_parts',
    'ready', 'completed', 'handed_over', 'cancelled'
  )),
  price INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  warranty_months INTEGER NOT NULL DEFAULT 3,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tracking_token TEXT UNIQUE,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE repair_status_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE repair_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 8. SALES
-- ============================================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  total_amount INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('device', 'accessory')),
  item_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL
);

CREATE TABLE payment_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'transfer')),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id)
);

-- ============================================================
-- 9. PURCHASES
-- ============================================================
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'received', 'cancelled')),
  paid_from_safe_id UUID REFERENCES safes(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('device', 'accessory', 'part')),
  item_id UUID,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL
);

-- ============================================================
-- 10. INVENTORY MOVEMENTS (audit trail)
-- ============================================================
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_type TEXT NOT NULL CHECK (item_type IN ('device', 'accessory', 'part')),
  item_id UUID NOT NULL,
  quantity_change INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'purchase', 'adjustment', 'write_off', 'repair', 'return')),
  reference_id UUID,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. FINANCIAL — TRANSACTIONS LEDGER
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount INTEGER NOT NULL,
  from_type TEXT NOT NULL CHECK (from_type IN ('cash_register', 'safe', 'customer', 'supplier', 'external')),
  from_id UUID,
  to_type TEXT NOT NULL CHECK (to_type IN ('cash_register', 'safe', 'customer', 'supplier', 'external')),
  to_id UUID,
  reference_type TEXT CHECK (reference_type IN ('sale', 'repair_payment', 'purchase', 'expense', 'distribution', 'top_up', 'adjustment')),
  reference_id UUID,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. EXPENSES
-- ============================================================
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  safe_type TEXT NOT NULL CHECK (safe_type IN ('opex', 'growth')),
  description TEXT
);

INSERT INTO expense_categories (name, safe_type) VALUES
  ('Оренда', 'opex'),
  ('Зарплата', 'opex'),
  ('Комунальні', 'opex'),
  ('Податки', 'opex'),
  ('Маркетинг', 'growth'),
  ('Обладнання', 'growth'),
  ('Інше', 'opex');

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL,
  paid_from_safe_id UUID NOT NULL REFERENCES safes(id) ON DELETE RESTRICT,
  description TEXT,
  receipt_url TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. SETTINGS
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT 'null',
  description TEXT
);

INSERT INTO settings (key, value, description) VALUES
  ('shop_name', '"VV CRM"', 'Назва магазину'),
  ('currency', '"UAH"', 'Валюта'),
  ('distribution_tech', '{"opex": 40, "growth": 30, "net_profit": 30}', 'Розподіл каси техніки'),
  ('distribution_accessories', '{"opex": 40, "growth": 30, "net_profit": 30}', 'Розподіл каси аксесуарів'),
  ('distribution_repairs', '{"opex": 40, "growth": 30, "net_profit": 30}', 'Розподіл каси ремонтів');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_devices_sku ON devices(sku);
CREATE INDEX idx_devices_brand_model ON devices(brand, model);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_accessories_sku ON accessories(sku);
CREATE INDEX idx_accessories_status ON accessories(status);
CREATE INDEX idx_parts_type ON parts(type);
CREATE INDEX idx_repairs_customer ON repairs(customer_id);
CREATE INDEX idx_repairs_tracking ON repairs(tracking_token);
CREATE INDEX idx_repairs_status ON repairs(status);
CREATE INDEX idx_repairs_assigned ON repairs(assigned_to);
CREATE INDEX idx_repair_log_repair ON repair_status_log(repair_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sale_items_item ON sale_items(item_type, item_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_payment_splits_sale ON payment_splits(sale_id);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_inventory_item ON inventory_movements(item_type, item_id);
CREATE INDEX idx_inventory_reason ON inventory_movements(reason);
CREATE INDEX idx_transactions_from ON transactions(from_type, from_id);
CREATE INDEX idx_transactions_to ON transactions(to_type, to_id);
CREATE INDEX idx_transactions_ref ON transactions(reference_type, reference_id);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_safe ON expenses(paid_from_safe_id);
CREATE INDEX idx_expenses_date ON expenses(paid_at);

-- ============================================================
-- PROFILE AUTO-CREATION ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'sales');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_suppliers BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_devices BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_accessories BEFORE UPDATE ON accessories FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_parts BEFORE UPDATE ON parts FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_repairs BEFORE UPDATE ON repairs FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_purchases BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_cash_registers BEFORE UPDATE ON cash_registers FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_safes BEFORE UPDATE ON safes FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE safes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies — all authenticated users have full access (org-level)
CREATE POLICY "Enable ALL for authenticated users" ON profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON suppliers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON devices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON accessories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON parts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON repairs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON repair_status_log FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON repair_parts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON sales FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON sale_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON payment_splits FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON purchases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON purchase_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON inventory_movements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON cash_registers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON safes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON expense_categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON settings FOR ALL USING (auth.role() = 'authenticated');
