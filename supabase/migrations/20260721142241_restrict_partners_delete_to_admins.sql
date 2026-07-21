-- The partners DELETE policy used USING (true), letting any authenticated user
-- (including role 'sales') delete partner records straight through PostgREST.
-- Every other business table (customers, devices, repairs, sales) already gates
-- DELETE to owner/manager, and the deletePartner server action already calls
-- requireRole(['owner','manager']) -- so this only closes the direct-API path.

drop policy if exists "Enable delete for authenticated users on partners" on public.partners;

create policy "partners_delete_admins"
  on public.partners
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['owner'::text, 'manager'::text])
    )
  );
