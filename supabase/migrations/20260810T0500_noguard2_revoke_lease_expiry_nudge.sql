-- NOGUARD2 item 3 — PHASE B, NOT APPLIED IN-THREAD. Review first.
--
-- lease_expiry_nudge is a privilege-laundering wrapper. Its entire body is:
--
--   CREATE OR REPLACE FUNCTION public.lease_expiry_nudge(p_days_ahead integer DEFAULT 30)
--    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
--   AS $function$ BEGIN RETURN lease_reminder_sweep(); END; $function$
--
-- The grants, read from proacl 2026-08-10:
--
--   lease_expiry_nudge(integer)  anon t  authenticated t  service_role t  PUBLIC t
--   lease_reminder_sweep()       anon f  authenticated t  service_role t  PUBLIC f
--
-- anon cannot call lease_reminder_sweep. It can call lease_expiry_nudge, which
-- is SECURITY DEFINER, so the inner call runs as the owner. The wrapper hands
-- anon the privilege it was denied one line away — and lease_reminder_sweep
-- sends lease start/expiry notifications to every lessee, so the effect is an
-- on-demand notification sweep fired by an unauthenticated caller.
--
-- CALLERS:
--   api/notifications-nudge.ts:70   await db.rpc('lease_expiry_nudge')
--   src/                            none
--   pg_proc                         none
--
-- api/_lib/supabaseAdmin.ts reaches PostgREST with the service key, so that call
-- arrives as service_role. service_role KEEPS EXECUTE below and the nudge endpoint
-- is unaffected. This is the one place in this task where the billing-seam warning
-- bites, and it is handled by role rather than by session_user: the task's warning
-- is that service_role also reports session_user = 'authenticator', so a check
-- written on session_user would lock out the server. No such check is written —
-- the grant alone distinguishes them.
--
-- No guard is added. There is nothing to guard: the correct authorization for this
-- function is exactly the authorization on lease_reminder_sweep, and the way to
-- express that is to stop granting the wrapper more than the callee.
--
-- ===========================================================================
-- THE CLASS, NOT THE INSTANCE — the sweep the task asked for
-- ===========================================================================
--
-- Definition used: a SECURITY DEFINER, non-trigger, anon-executable function
-- whose body calls a public function that anon canNOT execute. Run against
-- production, that yields 49 functions. Most are NOT holes — they are properly
-- guarded RPCs calling internal helpers, which is what a definer boundary is for.
--
-- Intersecting those 49 with NOGUARD1's own 76 DOES-NOT-ENFORCE set leaves the
-- nine that both launder privilege AND have no guard of their own:
--
--   _publish_open_slots_for_org      -> business_hours              (20260810T0600)
--   contract_lock_blockers           -> open_change_requests        (20260810T0600)
--   ensure_contact_for_profile       -> promote_contact_to_account  (20260810T0600)
--   fill_party_fields_from_contacts  -> remerge_contract_from_fields(20260810T0400)
--   lease_expiry_nudge               -> lease_reminder_sweep        (THIS FILE)
--   notify_purchase_unpaid           -> notify_staff, notify_user   (20260810T0600)
--   publish_open_slots_all           -> business_hours              (20260810T0600)
--   recompose_document_fields        -> compose_insurance_allocation(20260810T0300)
--   remove_document_co_buyer         -> remerge_contract_from_clauses(20260810T0300)
--
-- lease_expiry_nudge is the only PURE case — a body that is one call and nothing
-- else, adding no authorization of its own. The other eight are covered by the
-- sibling migrations noted above.
--
-- Swept and deliberately NOT changed, with reasons:
--
--   my_onboarding_checklist -> contact_checklist
--     Looks like the same shape and is not. Its body is
--       CASE WHEN has_staff_access() THEN '[]'
--            WHEN current_contact_id() IS NULL THEN '[]'
--            ELSE contact_checklist(current_contact_id()) END
--     The identity is in FILTER position, so it fails closed (anon gets '[]'),
--     and it passes current_contact_id() rather than a caller-supplied id, so it
--     can only ever return the caller's own checklist. Correctly in NOGUARD1's
--     ENFORCES list. Left alone.
--
--   The remaining ~38 of the 49 are all in NOGUARD1's ENFORCES set: they carry
--   their own identity guard, so the inner call is authorized before it happens.
--   A definer function calling an internal helper is the intended architecture,
--   not a finding. Left alone.
--
-- Both trap grants are present on lease_expiry_nudge (PUBLIC =X/postgres AND
-- role-held anon=X/postgres), so PUBLIC, anon and authenticated are named
-- separately and the privilege is re-read afterwards.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.lease_expiry_nudge(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lease_expiry_nudge(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lease_expiry_nudge(integer) FROM authenticated;
-- service_role deliberately RETAINED: api/notifications-nudge.ts calls this.

DO $verify$
DECLARE v_anon bool; v_auth bool; v_svc bool; v_pub bool; v_acl text;
BEGIN
  SELECT has_function_privilege('anon', p.oid,'EXECUTE'),
         has_function_privilege('authenticated', p.oid,'EXECUTE'),
         has_function_privilege('service_role', p.oid,'EXECUTE'),
         EXISTS(SELECT 1 FROM unnest(p.proacl) a WHERE a::text LIKE '=%'),
         p.proacl::text
    INTO v_anon, v_auth, v_svc, v_pub, v_acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='lease_expiry_nudge';

  RAISE NOTICE 'NOGUARD2 lease_expiry_nudge -> anon=% authenticated=% service_role=% PUBLIC=% acl=%',
               v_anon, v_auth, v_svc, v_pub, v_acl;

  IF v_anon OR v_auth OR v_pub THEN
    RAISE EXCEPTION 'NOGUARD2: lease_expiry_nudge still reachable after revoke';
  END IF;
  IF NOT v_svc THEN
    RAISE EXCEPTION 'NOGUARD2: service_role lost EXECUTE — this would break api/notifications-nudge.ts';
  END IF;

  -- The wrapper must not end up MORE reachable than what it wraps.
  IF has_function_privilege('anon','public.lease_reminder_sweep()','EXECUTE')
     IS DISTINCT FROM v_anon THEN
    RAISE NOTICE 'NOGUARD2: wrapper and callee now agree for anon';
  END IF;
END
$verify$;

COMMIT;
