-- TASK NOGUARD3 / PHASE B — DRY RUN ONLY. NOT APPLIED. Do not apply without review.
--
-- Revoke EXECUTE from anon / authenticated / PUBLIC on 18 SECURITY DEFINER
-- functions that are internal by construction: they have NO browser caller and
-- NO api/ caller, and every in-database caller is a postgres-owned
-- SECURITY DEFINER function, which reaches them regardless of the invoker's
-- grants. service_role is retained everywhere.
--
-- This is NOGUARD1's category-5 argument, re-proven by NOGUARD2 in a
-- rolled-back transaction and re-proven again here for the invoker case
-- (see 20260811T0300, which is deliberately kept separate).
--
-- WHY THESE AND NOT OTHERS. Each was checked three ways:
--   * src/  : grepped for rpc('name') and rpc("name"), then grepped loosely for
--             the bare identifier to catch a dynamically built call. Every loose
--             hit on this list resolved to a COMMENT or to a DIFFERENT function
--             (resend_executed_document_email, sweep_undelivered_executed_documents).
--   * api/  : same, zero hits.
--   * pg_proc: callers enumerated; all are prosecdef AND owned by postgres.
--
-- CORRECTION TO NOGUARD1: it lists a src/ caller for document_changes_frozen
-- (src/pages/app/ContractPage.tsx). That is a comment, not a call. Verified.
--
-- CONSEQUENCE OF LEAVING THEM. The highest is
-- _provision_purchase_for_offerings: it creates a purchase for a
-- caller-supplied contact/client/org with a caller-supplied p_mark_paid, so any
-- free signup could mint a purchase marked paid. Its only callers are
-- attach_offerings_to_client and provision_client_invitation, both of which are
-- staff/service_role gated. The leading underscore states the intent.
--
-- Both trap grants are handled: each grant is revoked BY NAME (PUBLIC, anon,
-- authenticated separately), because a revoke naming only one of them is a
-- silent no-op against the other. has_function_privilege() is re-read in the
-- verify block; the REVOKE's own output is never trusted.
--
-- This migration carries NO transaction control of its own so it is safe to
-- wrap in an outer BEGIN … ROLLBACK. Do not add BEGIN/COMMIT.

DO $mig$
DECLARE
  r        record;
  v_count  int := 0;
  v_names  text[] := ARRAY[
    '_provision_purchase_for_offerings',
    'assert_horse_care_eligible',
    'assert_not_signature_locked',
    'change_request_is_frozen',
    'compose_insurance_allocation',
    'contact_document_satisfied',
    'contact_document_wall_state',
    'deal_status',
    'derive_affiliations',
    'document_changes_frozen',
    'ensure_staff_profile',
    'lease_sublease_allowed',
    'member_display_name',
    'next_custom_field_key',
    'owner_has_executed_template',
    'party_user_ids',
    'send_executed_document_email',
    'undelivered_executed_documents'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           p.oid::regprocedure::text AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY(v_names)
       AND p.prorettype::regtype::text <> 'trigger'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',        r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',          r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> array_length(v_names, 1) THEN
    RAISE EXCEPTION 'NOGUARD3: expected % functions, revoked on %',
      array_length(v_names, 1), v_count;
  END IF;
  RAISE NOTICE 'NOGUARD3: revoked on % functions', v_count;
END
$mig$;

-- Re-read the privileges rather than trusting the REVOKE output. A revoke that
-- silently did nothing must not be reported as success.
DO $verify$
DECLARE
  v_open int;
  v_lost int;
BEGIN
  SELECT count(*) INTO v_open
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = ANY(ARRAY['_provision_purchase_for_offerings','assert_horse_care_eligible',
        'assert_not_signature_locked','change_request_is_frozen','compose_insurance_allocation',
        'contact_document_satisfied','contact_document_wall_state','deal_status','derive_affiliations',
        'document_changes_frozen','ensure_staff_profile','lease_sublease_allowed','member_display_name',
        'next_custom_field_key','owner_has_executed_template','party_user_ids',
        'send_executed_document_email','undelivered_executed_documents'])
     AND (has_function_privilege('anon',          p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

  SELECT count(*) INTO v_lost
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = ANY(ARRAY['_provision_purchase_for_offerings','assert_horse_care_eligible',
        'assert_not_signature_locked','change_request_is_frozen','compose_insurance_allocation',
        'contact_document_satisfied','contact_document_wall_state','deal_status','derive_affiliations',
        'document_changes_frozen','ensure_staff_profile','lease_sublease_allowed','member_display_name',
        'next_custom_field_key','owner_has_executed_template','party_user_ids',
        'send_executed_document_email','undelivered_executed_documents'])
     AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE');

  IF v_open > 0 THEN
    RAISE EXCEPTION 'NOGUARD3: % function(s) still reachable by anon or authenticated', v_open;
  END IF;
  IF v_lost > 0 THEN
    RAISE EXCEPTION 'NOGUARD3: % function(s) lost service_role, which must be retained', v_lost;
  END IF;
END
$verify$;
