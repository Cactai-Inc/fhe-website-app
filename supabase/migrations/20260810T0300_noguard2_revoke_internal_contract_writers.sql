-- NOGUARD2 item 2 (part 1) — PHASE B, NOT APPLIED IN-THREAD. Review first.
--
-- Remove anon / authenticated / PUBLIC EXECUTE from seven contract_fields
-- writers that are internal by construction: nothing outside the database calls
-- them, and everything inside the database that does is a postgres-owned
-- SECURITY DEFINER function, which reaches them regardless of the invoker's
-- grants.
--
-- ===========================================================================
-- WHY REVOKE AND NOT GUARD — the task doc's premise, tested rather than taken
-- ===========================================================================
--
-- The task doc says four of these "must be GUARDED, not revoked — revoking
-- breaks the caller". That is not true here, and it was worth proving rather
-- than arguing. Run against production inside BEGIN..ROLLBACK on 2026-08-10:
--
--   -- revoke all three grants on apply_field_formats
--   REVOKE EXECUTE ... FROM PUBLIC;  FROM anon;  FROM authenticated;
--   proacl now: {postgres=X/postgres,service_role=X/postgres}
--
--   -- (a) anon calling it DIRECTLY:
--   SET LOCAL ROLE anon; SELECT apply_field_formats('...');
--   ERROR:  permission denied for function apply_field_formats
--
--   -- (b) anon calling it THROUGH a postgres-owned SECURITY DEFINER wrapper,
--   --     which is exactly the shape of every real in-database caller:
--   SET LOCAL ROLE anon; SELECT noguard2_probe_wrapper('...');
--   result: "inner function was reached"
--
-- A SECURITY DEFINER function executes as its owner, so the privilege check on
-- the inner call is made against postgres, which keeps EXECUTE. Every in-database
-- caller of all seven is postgres-owned and SECURITY DEFINER (verified via
-- pg_get_userbyid(proowner) and prosecdef). The revoke closes the HTTP surface
-- and leaves the internal call graph untouched.
--
-- This is NOGUARD1's own category-5 argument ("a SECURITY DEFINER caller reaches
-- them regardless of the invoker's rights"), which the audit and the task doc
-- both contradicted. NOGUARD1 was right.
--
-- ===========================================================================
-- THE SEVEN, WITH THE CALLER LIST EACH DECISION RESTS ON
-- ===========================================================================
--
-- Callers counted three ways: pg_proc.prosrc, grep over src/, grep over api/.
-- api/ was ALSO checked transitively: a 6-deep call-graph closure from all 25
-- RPC names invoked anywhere under api/ reaches NONE of these. So there is no
-- service_role path to preserve, and the session_user/auth.role() trap that the
-- task warns about does not arise for this group.
--
--   function                        db callers                             src  api
--   ------------------------------  -------------------------------------  ---  ---
--   apply_field_formats             (none)                                  0    0
--   regroup_contract_subjects       (none)                                  0    0
--   seed_cascade_fields             (none)                                  0    0
--   bos_generate_document           start_bill_of_sale,                     0    0
--                                   start_bill_of_sale_standalone
--   recompose_document_fields       remerge_contract_from_clauses,          0    0
--                                   remerge_contract_from_fields,
--                                   set_field_structured
--   sync_contract_fields_from_defs  capture_horse_record_info               0    0
--   remove_document_co_buyer        set_contract_field                      0    0
--
-- fill_party_fields_from_contacts is deliberately NOT in this migration: it is
-- called from the browser (src/lib/contracts.ts captureContactInfo), so it keeps
-- its `authenticated` grant and gets a guard instead. See 20260810T0400.
--
-- ===========================================================================
-- TWO CORRECTIONS TO THE INPUT DOCUMENTS, VERIFIED AGAINST PRODUCTION
-- ===========================================================================
--
-- 1. The "nine anon-reachable contract_fields writers" are SEVEN.
--    contract_split_deductible_sync and sync_horse_fields_to_documents are
--    RETURNS trigger, backing the triggers contract_fields_split_sync and
--    horses_sync_contract_fields. PostgreSQL refuses to call them directly —
--    proven as anon in production:
--      ERROR: trigger functions can only be called as triggers
--    They are not an anon-reachable surface and nothing here touches them.
--    (NOGUARD1's population query excluded RETURNS trigger; the audit's
--    contract_fields query did not, which is how they entered the list.)
--
-- 2. remove_document_co_buyer IS anon-reachable, and IS unguarded.
--    The audit states that the three functions carrying assert_not_signature_locked
--    are "all anon = false". Production disagrees:
--      set_contract_field         anon f   <- audit correct
--      set_document_co_buyer      anon t   <- audit incorrect
--      remove_document_co_buyer   anon t   <- audit incorrect
--      set_field_structured       anon t   <- a fourth lock-caller the audit omits
--    Of those, set_document_co_buyer and set_field_structured carry their own
--    identity guards (NOGUARD1 classes both as ENFORCES). remove_document_co_buyer
--    carries NO identity check — it deletes BUYER document_parties and
--    contract_parties rows and clears every COBUYER.* value given only a document
--    id. That makes it an EIGHTH unguarded anon-reachable contract_fields writer
--    that the audit's list of nine omitted while including two trigger functions.
--    It is included here.
--
-- Separately flagged, NOT fixed here: remove_document_co_buyer calls
-- assert_not_signature_locked AFTER its deletes rather than before. A raise still
-- rolls the statement back, so it is not currently exploitable, but any caller
-- that wraps it in an EXCEPTION handler would keep the deletes and swallow the
-- lock. NOGUARD1 reported this ordering; the audit dismissed it. Reordering is a
-- body rewrite and belongs in its own reviewed change.
--
-- ===========================================================================
-- THE REVOKE TRAP
-- ===========================================================================
--
-- All seven carry BOTH trap grants simultaneously — PUBLIC (=X/postgres) and a
-- role-held anon=X/postgres. Revoking either alone reports success and changes
-- nothing. PUBLIC, anon and authenticated are therefore named separately below,
-- and the verify block re-reads has_function_privilege() rather than trusting the
-- REVOKE output.
--
-- service_role and postgres keep EXECUTE deliberately: no api/ path reaches these
-- today, but leaving the server-side role intact costs nothing and keeps a
-- server-side escape hatch if one is ever wired.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.apply_field_formats(uuid)                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_field_formats(uuid)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_field_formats(uuid)                          FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.regroup_contract_subjects(uuid)                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regroup_contract_subjects(uuid)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.regroup_contract_subjects(uuid)                    FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.seed_cascade_fields(uuid)                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_cascade_fields(uuid)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_cascade_fields(uuid)                          FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.bos_generate_document(uuid,uuid,uuid,jsonb)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bos_generate_document(uuid,uuid,uuid,jsonb)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.bos_generate_document(uuid,uuid,uuid,jsonb)        FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.recompose_document_fields(uuid)                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompose_document_fields(uuid)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.recompose_document_fields(uuid)                    FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_contract_fields_from_defs(uuid)               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_contract_fields_from_defs(uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_contract_fields_from_defs(uuid)               FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_document_co_buyer(uuid)                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_document_co_buyer(uuid)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_document_co_buyer(uuid)                     FROM authenticated;

-- Never trust the REVOKE output: re-read the privilege, and the raw ACL.
DO $verify$
DECLARE r record; v_bad int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure::text AS sig,
           has_function_privilege('anon', p.oid,'EXECUTE') AS anon_x,
           has_function_privilege('authenticated', p.oid,'EXECUTE') AS auth_x,
           has_function_privilege('service_role', p.oid,'EXECUTE') AS svc_x,
           EXISTS(SELECT 1 FROM unnest(p.proacl) a WHERE a::text LIKE '=%') AS pub_x,
           p.proacl::text AS acl
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('apply_field_formats','regroup_contract_subjects','seed_cascade_fields',
                         'bos_generate_document','recompose_document_fields',
                         'sync_contract_fields_from_defs','remove_document_co_buyer')
  LOOP
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

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'NOGUARD2: % function(s) still reachable after revoke — a revoke reported success and did nothing', v_bad;
  END IF;
END
$verify$;

COMMIT;
