-- Migration: Store Launch Dashboard
-- Independent tables for tracking physical store launch progress and expenses.

CREATE TABLE store_launch_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  budget_limit INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE store_launch_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  category_id UUID REFERENCES store_launch_categories(id) ON DELETE SET NULL,
  assignee TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE store_launch_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES store_launch_categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'fee' CHECK (type IN ('purchase', 'fee')),
  url TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'paid', 'received')),
  paid_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE store_launch_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  target_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_store_launch_categories BEFORE UPDATE ON store_launch_categories FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_store_launch_tasks BEFORE UPDATE ON store_launch_tasks FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_store_launch_expenses BEFORE UPDATE ON store_launch_expenses FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_store_launch_milestones BEFORE UPDATE ON store_launch_milestones FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- RLS
ALTER TABLE store_launch_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_launch_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_launch_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_launch_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for authenticated users" ON store_launch_categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON store_launch_tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON store_launch_expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON store_launch_milestones FOR ALL USING (auth.role() = 'authenticated');
