-- NOGUARD2 item 5 (the remainder, part 1) — PHASE B, NOT APPLIED IN-THREAD.
--
-- NOGUARD1's category 5: "internal helpers that were never meant to be endpoints
-- ... These are called from triggers and other functions and do not need any
-- grant to anon or authenticated — a SECURITY DEFINER caller reaches them
-- regardless of the invoker's rights. This is the cheapest large win in the set."
--
-- That claim was TESTED against production before relying on it, inside
-- BEGIN..ROLLBACK (full transcript in 20260810T0300's header): after revoking
-- PUBLIC + anon + authenticated, a direct anon call gives
--   ERROR: permission denied for function ...
-- while the same call through a postgres-owned SECURITY DEFINER wrapper returns
-- normally. Every in-database caller of every function below is postgres-owned
-- and SECURITY DEFINER, so the internal call graph is untouched.
--
-- ===========================================================================
-- THE FIFTEEN, AND THE CALLER LIST EACH DECISION RESTS ON
-- ===========================================================================
--
-- src/ and api/ were grepped twice per function: once for the quoted RPC form
-- ('name'), once loosely for the bare identifier to catch a dynamically built
-- call. Comment-only matches are noted as such and are not callers.
--
--  function                          db  src  api   what it does unguarded today
--  --------------------------------  --  ---  ----  -------------------------------
--  _publish_open_slots_for_org        2   0    0    inserts availability bookings for an org
--  _resolve_location                  1   0    0    inserts/updates locations rows
--  apply_affiliations                 5   0    0    rewrites a contact's group rows
--  apply_category_documents           3   0    0    rewrites which docs a person must sign
--  consume_unit_for_booking           1   0    0    consumes a paid entitlement
--  contract_lock_blockers             2   0    0*   leaks contract internals + party names
--  contract_notify                    5   0    0*   arbitrary attacker-authored notification text
--  ensure_contact_for_profile         4   0    0    creates identity records
--  generate_fulfillment_units         1   0    0    mints entitlement units
--  log_status_event                   5   0    0    rewrites status shown across the app
--  notify_purchase_unpaid             1   0    0    notification injection on a real purchase
--  redline_notify                     2   0    0    notification spam, attacker-controlled prefix
--  resolve_notifications_for_link     6   0    0    DELETEs notifications, forges the audit actor
--  set_unit_status                    3   0    0    marks paid entitlements consumed
--  publish_open_slots_all             0   0    1    floods every tenant's calendar
--
--  * contract_lock_blockers and contract_notify appear in api/ only inside
--    explanatory comments (api/contract-change-requests-submitted.ts:5,
--    api/contract-voided.ts:4, and two src/ comments). Neither is invoked.
--
-- The two leading underscores (_publish_open_slots_for_org, _resolve_location)
-- state the intent in the name.
--
-- publish_open_slots_all IS invoked from api/calendar-reminders.ts:57 via
-- db.rpc, which arrives as service_role. service_role is retained for it (and,
-- harmlessly, for all fifteen), so that endpoint keeps working. As in
-- 20260810T0500, the server path is distinguished by ROLE, never by
-- session_user — service_role and an unidentified caller both report
-- session_user = 'authenticator', which is the trap the task warns about.
--
-- ===========================================================================
-- THE REVOKE TRAP — measured per function, not assumed
-- ===========================================================================
--
-- Thirteen of the fifteen carry BOTH trap grants (PUBLIC =X/postgres AND a
-- role-held anon=X/postgres). TWO carry only the role grants and no PUBLIC entry:
--
--   _publish_open_slots_for_org   PUBLIC=f
--   publish_open_slots_all        PUBLIC=f
--
-- which is precisely why PUBLIC, anon and authenticated are each named for every
-- function and the result is re-read from has_function_privilege() rather than
-- inferred. A REVOKE ... FROM PUBLIC against a role-held grant is a silent no-op,
-- and so is the reverse; this repo has hit both.
--
-- NOTE ON authenticated. Revoking `authenticated` here is not an excursion into
-- NOGUARD3. These fifteen have no browser caller at all, so the authenticated
-- grant is not serving anyone; leaving it would leave the whole finding open to
-- anyone who signs up, and signing up is free. The separate NOGUARD3 question —
-- the 396 definer functions authenticated can call that DO have browser callers —
-- is untouched here.

BEGIN;

REVOKE EXECUTE ON FUNCTION public._publish_open_slots_for_org(uuid,integer,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._publish_open_slots_for_org(uuid,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public._publish_open_slots_for_org(uuid,integer,integer) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public._resolve_location(uuid,uuid,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._resolve_location(uuid,uuid,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public._resolve_location(uuid,uuid,jsonb) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_affiliations(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_affiliations(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_affiliations(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_category_documents(uuid,text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_category_documents(uuid,text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_category_documents(uuid,text[]) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.consume_unit_for_booking(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_unit_for_booking(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_unit_for_booking(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.contract_lock_blockers(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contract_lock_blockers(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.contract_lock_blockers(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.contract_notify(uuid,uuid,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.contract_notify(uuid,uuid,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.contract_notify(uuid,uuid,text,text,text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.ensure_contact_for_profile(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_contact_for_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_contact_for_profile(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_fulfillment_units(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_fulfillment_units(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_fulfillment_units(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.log_status_event(text,uuid,text,text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_status_event(text,uuid,text,text,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_status_event(text,uuid,text,text,uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_purchase_unpaid(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_purchase_unpaid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_purchase_unpaid(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.redline_notify(uuid,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redline_notify(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redline_notify(uuid,text,text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.resolve_notifications_for_link(text,uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_notifications_for_link(text,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_notifications_for_link(text,uuid,text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.set_unit_status(uuid,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_unit_status(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_unit_status(uuid,text,text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.publish_open_slots_all(integer,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.publish_open_slots_all(integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.publish_open_slots_all(integer,integer) FROM authenticated;

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
       AND p.proname IN ('_publish_open_slots_for_org','_resolve_location','apply_affiliations',
                         'apply_category_documents','consume_unit_for_booking','contract_lock_blockers',
                         'contract_notify','ensure_contact_for_profile','generate_fulfillment_units',
                         'log_status_event','notify_purchase_unpaid','redline_notify',
                         'resolve_notifications_for_link','set_unit_status','publish_open_slots_all')
     ORDER BY 1
  LOOP
    v_n := v_n + 1;
    RAISE NOTICE 'NOGUARD2 % -> anon=% authenticated=% service_role=% PUBLIC=% acl=%',
                 r.sig, r.anon_x, r.auth_x, r.svc_x, r.pub_x, r.acl;
    IF r.anon_x OR r.auth_x OR r.pub_x THEN
      v_bad := v_bad + 1;
      RAISE WARNING 'NOGUARD2: % is STILL reachable', r.sig;
    END IF;
    IF NOT r.svc_x THEN
      RAISE EXCEPTION 'NOGUARD2: % lost service_role, which was not intended', r.sig;
    END IF;
  END LOOP;

  IF v_n <> 15 THEN
    RAISE EXCEPTION 'NOGUARD2: expected 15 functions in the verify set, saw %', v_n;
  END IF;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'NOGUARD2: % function(s) still reachable after revoke', v_bad;
  END IF;
END
$verify$;

COMMIT;
