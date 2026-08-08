-- NULLUID 1/4 — set_org_module must deny by default
--
-- THE HOLE (confirmed exploitable in production, reproduced 2026-08-07)
--   The guard was:
--       IF NOT is_super_admin() AND auth.uid() IS NOT NULL THEN
--         RAISE EXCEPTION 'set_org_module is restricted to SUPER_ADMIN / the billing service';
--       END IF;
--   service_role has a NULL auth.uid(), so the `AND auth.uid() IS NOT NULL` term was
--   added to let the billing webhook through. But `anon` has a NULL auth.uid() TOO. For
--   an unauthenticated caller the second term is false, the whole AND is false, the
--   exception never fires, and SECURITY DEFINER does the rest.
--
--   Reproduced against prod as `anon` over the real PostgREST endpoint (unauthenticated,
--   project anon key only), BEFORE this migration:
--     POST /rest/v1/rpc/set_org_module {"p_org":"00000000-…0000","p_key":"PROOF_OF_CONCEPT"}
--       → 400 {"code":"P0001","message":"unknown organization: 00000000-…0000"}
--     POST /rest/v1/rpc/set_org_module {"p_org":"e656f20b-…","p_key":"PROOF_OF_CONCEPT"}
--       → 400 {"code":"P0001","message":"unknown module: PROOF_OF_CONCEPT"}
--   Authorisation was passed entirely; it failed on DATA VALIDATION. With a real module
--   key an unauthenticated caller could enable or disable any tenant's modules.
--   Verification stopped there deliberately — no module was flipped.
--
-- THE FIX — deny by default, following TASK-LEASEFORK's clone_contract_template shape
--   Three positive ways to be trusted, and nothing else:
--     1. coalesce(is_super_admin(), false)  — a SUPER_ADMIN profile. The coalesce matters:
--        app_role() is NULL for a caller with no profiles row, so bare is_super_admin()
--        is NULL for anon and `NOT NULL` is NULL, which does not fire an IF. (Migration
--        2/4 makes the predicate itself fail-closed; this coalesce keeps THIS migration
--        correct on its own, so it can be reverted independently.)
--     2. auth.role() = 'service_role' — THE BILLING PATH. This is what the old NULL-uid
--        term was really reaching for, spelled so that it names service_role instead of
--        admitting everything with a NULL uid. auth.role() reads the PostgREST-verified
--        JWT claim, so it cannot be forged by an anon caller without the JWT secret.
--     3. session_user IN ('postgres','supabase_admin') AND no JWT role claim — a direct
--        psql/migration session. SECURITY DEFINER leaves session_user as the REAL session
--        role while current_user reports the function owner, so session_user is what
--        distinguishes a trusted direct session from a web caller. Verified in prod: an
--        anon web request sees session_user='authenticator', current_user='postgres',
--        auth.uid()=NULL, auth.role()='anon'. current_user is therefore useless here and
--        session_user is the correct signal.
--
--        The `coalesce(auth.role(),'') = ''` half is load-bearing, not decoration. A
--        direct psql session has no request.jwt.* GUC at all, so auth.role() is NULL;
--        anything arriving through PostgREST always carries a verified role claim. Two
--        reasons it is required:
--          * The DB test harness (test/db/harness.ts) is PGlite, whose session_user is
--            ALWAYS 'postgres' — measured, not assumed. Without this half, `session_user
--            IN ('postgres',…)` would be true for every test caller and
--            provision_tenant.test.ts's "rejects a non-super authenticated caller" would
--            stop rejecting. The claim test restores the distinction: h.asUser() sets
--            request.jwt.claim.role='authenticated', so a plain user is denied.
--          * It narrows the branch to what it is actually for — an operator at a psql
--            prompt — rather than anyone who has merely SET ROLE inside such a session.
--
--   NOTE why session_user alone is NOT enough: the api layer reaches Postgres through
--   PostgREST with the service_role key (api/_lib/supabaseAdmin.ts → createClient), so a
--   service_role caller ALSO has session_user='authenticator'. Guarding on session_user
--   alone would have denied the billing path — the outage this task warned about. Term 2
--   is what keeps it working.
--
-- Behaviour for every legitimate caller is unchanged; only the anon/NULL-uid admission
-- is removed.

CREATE OR REPLACE FUNCTION public.set_org_module(
  p_org     uuid,
  p_key     text,
  p_enabled boolean DEFAULT true,
  p_source  text    DEFAULT 'ADDON'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Deny by default. A NULL auth.uid() is NOT evidence of a trusted caller: the anon
  -- role has one too. Name the trusted callers positively instead.
  IF NOT (
       coalesce(is_super_admin(), false)
    OR coalesce(auth.role(), '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') = '')
  ) THEN
    RAISE EXCEPTION 'set_org_module is restricted to SUPER_ADMIN / the billing service'
      USING errcode = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org) THEN
    RAISE EXCEPTION 'unknown organization: %', p_org;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM modules WHERE module_key = p_key) THEN
    RAISE EXCEPTION 'unknown module: %', p_key;
  END IF;
  IF p_source NOT IN ('TIER','ADDON','GRANT','SUBSCRIPTION') THEN
    RAISE EXCEPTION 'invalid source: %', p_source;
  END IF;

  INSERT INTO org_modules (org_id, module_key, enabled, source)
  VALUES (p_org, p_key, p_enabled, p_source)
  ON CONFLICT (org_id, module_key)
    DO UPDATE SET enabled = EXCLUDED.enabled, source = EXCLUDED.source, updated_at = now();
END;
$fn$;

COMMENT ON FUNCTION public.set_org_module(uuid, text, boolean, text) IS
  'U6: SUPER_ADMIN / billing-service upsert of a single org_modules entitlement (add-on / subscription seam). §4.1. Deny-by-default: SUPER_ADMIN, service_role, or a direct postgres/supabase_admin session. A NULL auth.uid() is not trust (NULLUID).';
