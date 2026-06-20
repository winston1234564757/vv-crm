-- Migration: Settings and Services security RLS policies configuration
-- Ensures settings updates, profiles role updates, and services management are correctly guarded.

-- ============================================================
-- 1. SETTINGS SECURITY POLICIES
-- ============================================================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.settings;
DROP POLICY IF EXISTS "Allow select settings for authenticated users" ON public.settings;

-- Allow read access to all authenticated users
CREATE POLICY "Allow select settings for authenticated users"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT, UPDATE or DELETE policies are created for public users.
-- All settings edits must go through the admin Supabase client (service_role), which bypasses RLS.

-- ============================================================
-- 2. PROFILES SECURITY POLICIES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow select profiles for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow update self basic details" ON public.profiles;
DROP POLICY IF EXISTS "Allow owners to update profiles" ON public.profiles;

-- Allow read access to profiles for all authenticated users
CREATE POLICY "Allow select profiles for authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update their own profiles (basic fields only, role column must remain unchanged)
CREATE POLICY "Allow update self basic details"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND (
      -- The new role value must match the old role value in the database, preventing self-role updates
      role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Allow owners to update any profile, including roles
CREATE POLICY "Allow owners to update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================
-- 3. SERVICES SECURITY POLICIES
-- ============================================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Allow select services for authenticated users" ON public.services;
DROP POLICY IF EXISTS "Allow owners and managers to manage services" ON public.services;

-- Allow read access to services for all authenticated users
CREATE POLICY "Allow select services for authenticated users"
  ON public.services FOR SELECT
  TO authenticated
  USING (true);

-- Allow owners and managers to perform any operation on services
CREATE POLICY "Allow owners and managers to manage services"
  ON public.services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );
