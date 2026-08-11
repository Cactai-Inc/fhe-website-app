-- TASK NOGUARD3 / PHASE B — DRY RUN ONLY. NOT APPLIED. Do not apply without review.
--
-- Remove the `auth.uid() IS NOT NULL AND NOT (…)` shape, which exempts the
-- unidentified caller BY CONSTRUCTION rather than by NULL accident:
--
--   IF auth.uid() IS NOT NULL AND NOT ( … ) THEN RAISE EXCEPTION …
--
-- For a caller with no auth.uid(), `auth.uid() IS NOT NULL` is false, the whole
-- condition is false, and the deny never runs — for exactly the caller it
-- should stop. The guard reads as present and passes review.
--
-- Swept across all 371 authenticated-callable definer functions. Exactly TWO
-- instances, both reported by NOGUARD2 and unchanged since:
--
--   remerge_contract_from_fields(uuid)              anon f  authenticated t
--   invite_contract_counterparty(uuid,uuid,text)    anon f  authenticated t
--
-- A broadened sweep for the same shape hidden behind a local variable holding
-- auth.uid()/current_contact_id() found 9 candidates; the other 7 are
-- `<identity> IS NOT NULL AND EXISTS (…)` in FILTER position, which is the
-- correct fail-closed idiom (it makes the predicate false, not NULL) and is
-- left alone: caller_is_document_party, caller_owns_document, caller_owns_horse,
-- caller_party_roles, can_void_document, client_can_read_horse,
-- contract_caller_is_originator.
--
-- NEITHER IS CURRENTLY EXPLOITABLE, and that is stated plainly rather than
-- dressed up: anon cannot execute either (revoked), and for an authenticated
-- caller `auth.uid() IS NOT NULL` is true, so the guard reduces to `NOT (…)`
-- and fires correctly. This change is defensive — it removes a guard that
-- cannot fire for the caller it names, because that shape stops anyone from
-- looking again.
--
-- WHAT THIS DOES NOT FIX. Both inner predicates contain
-- `has_staff_access() AND <row>.org_id = current_org()`, which evaluates to
-- NULL for the org-less SUPER_ADMIN (admin@cactai.io, profiles.org_id IS NULL).
-- Wrapping these in coalesce(…, false) would DENY that account. That is the
-- decision recorded in the report as B4 and it is deliberately NOT made here:
-- this migration preserves the existing NULL behaviour for the operator and
-- only removes the anon exemption. Sequencing matters — settle B4 first, then
-- coalesce this family.
--
-- No transaction control of its own. Do not add BEGIN/COMMIT.

DO $mig$
DECLARE
  r       record;
  v_src   text;
  v_new   text;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('remerge_contract_from_fields','invite_contract_counterparty')
       AND p.prorettype::regtype::text <> 'trigger'
  LOOP
    v_src := pg_get_functiondef(r.oid);
    v_new := replace(v_src, 'IF auth.uid() IS NOT NULL AND NOT', 'IF NOT');

    IF v_new = v_src THEN
      RAISE EXCEPTION
        'NOGUARD3: inverted-guard text not matched in %(); refusing to report a no-op as success',
        r.proname;
    END IF;

    EXECUTE v_new;
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'NOGUARD3: expected to rewrite 2 functions, rewrote %', v_count;
  END IF;
  RAISE NOTICE 'NOGUARD3: % inverted guards rewritten', v_count;
END
$mig$;

DO $verify$
DECLARE v_stale int;
BEGIN
  SELECT count(*) INTO v_stale
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND pg_get_functiondef(p.oid) LIKE '%auth.uid() IS NOT NULL AND NOT%';
  IF v_stale > 0 THEN
    RAISE EXCEPTION 'NOGUARD3: % function(s) still carry the inverted guard', v_stale;
  END IF;
END
$verify$;
