-- NOGUARD2 item 5 (the remainder, part 2) — PHASE B, NOT APPLIED IN-THREAD.
--
-- NOGUARD1 ranked priorities #4 and #6, which the earlier Phase B migrations do
-- not cover.
--
-- ===========================================================================
-- #4 — TWO UNAUTHENTICATED FULL-ROSTER DUMPS, BOTH DEAD CODE
-- ===========================================================================
--
--   affiliation_reconciliation()
--     Returns, for EVERY contact: id, display_code, full name, whether they hold
--     an account, and their group memberships. A complete customer roster to an
--     unauthenticated caller, in one call with no arguments.
--
--   wall_onboarding_invariant_violations()
--     Every contact's name plus their onboarding gating counts. The same roster
--     by a second route, with which documents each person still owes.
--
--   callers:  pg_proc 0   src/ 0   api/ 0
--
-- Neither takes an argument, so there is nothing to scope a guard to and nothing
-- to authorize against. They are staff diagnostics that were never wired to a
-- staff surface. Revoked rather than guarded: a guard would preserve a function
-- nothing calls, and if either is ever wanted it belongs behind has_staff_access()
-- on a staff page, written deliberately.
--
-- ===========================================================================
-- #6 — confirm_booking_for_purchase: the billing seam, fixed by GRANT ONLY
-- ===========================================================================
--
-- Sets bookings.status = 'confirmed' for a purchase. Unguarded and anon-reachable,
-- so an unauthenticated caller can confirm a booking WITHOUT payment, bypassing
-- the Stripe webhook path entirely.
--
--   callers:  pg_proc 0
--             src/    0
--             api/    api/stripe-webhook.ts:68   await db.rpc(...)
--                     api/_lib/reconcile.ts:123  await db.rpc(...)
--
-- This is the one function in the whole task where the billing-seam warning
-- actually bites, and it is handled the safe way: BY ROLE, NOT BY session_user.
--
-- api/_lib/supabaseAdmin.ts reaches PostgREST with the service key, so both calls
-- arrive as service_role — and service_role reports session_user = 'authenticator'
-- exactly like an unidentified caller does. Any guard written on session_user
-- would lock the webhook out and silently stop confirming paid bookings.
--
-- So no guard is written at all. service_role KEEPS EXECUTE; PUBLIC, anon and
-- authenticated lose it. The two api/ callers are unaffected, and there is no new
-- predicate that could be got wrong. NOGUARD1 proposed guarding on
-- auth.role() = 'service_role'; the grant achieves the same separation with no
-- body rewrite and no new failure mode, so it is preferred here.
--
-- Note this closes an authenticated hole as well: today any signed-up account can
-- confirm any booking by id. That is incidental to fixing the anon hole — the
-- broader authenticated audit is still NOGUARD3's.
--
-- ===========================================================================
-- GRANTS BEFORE (raw, read 2026-08-10)
-- ===========================================================================
--
--   affiliation_reconciliation()            anon t  authed t  svc t  PUBLIC t
--   wall_onboarding_invariant_violations()  anon t  authed t  svc t  PUBLIC t
--   confirm_booking_for_purchase(uuid)      anon t  authed t  svc t  PUBLIC t
--
-- All three carry both trap grants, so PUBLIC / anon / authenticated are named
-- separately and has_function_privilege() is re-read afterwards.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.affiliation_reconciliation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.affiliation_reconciliation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.affiliation_reconciliation() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.wall_onboarding_invariant_violations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wall_onboarding_invariant_violations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.wall_onboarding_invariant_violations() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_booking_for_purchase(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_booking_for_purchase(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_booking_for_purchase(uuid) FROM authenticated;
-- service_role deliberately RETAINED on confirm_booking_for_purchase:
-- api/stripe-webhook.ts and api/_lib/reconcile.ts depend on it.

DO $verify$
DECLARE r record; v_bad int := 0; v_n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig,
           has_function_privilege('anon', p.oid,'EXECUTE') AS anon_x,
           has_function_privilege('authenticated', p.oid,'EXECUTE') AS auth_x,
           has_function_privilege('service_role', p.oid,'EXECUTE') AS svc_x,
           EXISTS(SELECT 1 FROM unnest(p.proacl) a WHERE a::text LIKE '=%') AS pub_x,
           p.proacl::text AS acl
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('affiliation_reconciliation','wall_onboarding_invariant_violations',
                         'confirm_booking_for_purchase')
     ORDER BY 1
  LOOP
    v_n := v_n + 1;
    RAISE NOTICE 'NOGUARD2 % -> anon=% authenticated=% service_role=% PUBLIC=% acl=%',
                 r.sig, r.anon_x, r.auth_x, r.svc_x, r.pub_x, r.acl;
    IF r.anon_x OR r.auth_x OR r.pub_x THEN
      v_bad := v_bad + 1;
      RAISE WARNING 'NOGUARD2: % is STILL reachable', r.sig;
    END IF;
  END LOOP;

  IF v_n <> 3 THEN
    RAISE EXCEPTION 'NOGUARD2: expected 3 functions, saw %', v_n;
  END IF;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'NOGUARD2: % function(s) still reachable after revoke', v_bad;
  END IF;

  -- The billing path must survive this migration.
  IF NOT has_function_privilege('service_role','public.confirm_booking_for_purchase(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'NOGUARD2: service_role lost confirm_booking_for_purchase — this would break the Stripe webhook';
  END IF;
END
$verify$;

COMMIT;
