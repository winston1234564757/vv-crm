-- SECURITY: every SECURITY DEFINER function in `public` was executable by the
-- `anon` role, because Postgres grants EXECUTE to PUBLIC by default and anon
-- inherits it. Since these functions are SECURITY DEFINER they also bypass RLS.
--
-- The Supabase anon key is public by design (it ships in the browser bundle), so
-- anyone could call e.g. transfer_funds(), delete_sale() or refund_sale()
-- straight against the REST endpoint without logging in.
--
-- Every one of these is only ever called from Next.js server actions
-- (src/lib/actions/*.ts) under an authenticated session — no public route uses
-- them — so removing anon access does not change application behaviour.
--
-- Reversible: GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO anon;
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public', fn.sig);
    execute format('revoke execute on function %s from anon', fn.sig);
    execute format('grant  execute on function %s to authenticated', fn.sig);
    execute format('grant  execute on function %s to service_role', fn.sig);
  end loop;
end $$;
