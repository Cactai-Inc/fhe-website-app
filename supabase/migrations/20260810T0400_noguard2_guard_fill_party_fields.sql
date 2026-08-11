-- NOGUARD2 item 2 (part 2) — PHASE B, NOT APPLIED IN-THREAD. Review first.
--
-- fill_party_fields_from_contacts(p_document_id uuid) is the ONE contract_fields
-- writer in the set that cannot simply be revoked: it is called from the browser.
--
--   src/lib/contracts.ts  captureContactInfo()
--     await supabase.from('contacts').update(patch).eq('id', contactId)
--     await supabase.rpc('fill_party_fields_from_contacts', { p_document_id })
--     await supabase.rpc('remerge_contract_from_clauses',   { p_document_id })
--
-- That is a document party correcting their own contact details from inside the
-- contract, so `authenticated` must keep EXECUTE. It gets a guard instead.
--
-- WHAT IT DOES TODAY WITH NO CHECK. Given any document id it copies contact
-- name / email / phone / address into that document's contract_fields. So it
-- writes party PII into any contract, and — because it is the reverse direction —
-- it can be used to confirm whether a given document has a given party by
-- observing which fields change. It has no identity check of any kind (verified:
-- the body references no auth.uid(), no current_contact_id(), no
-- has_staff_access(), no caller_is_document_party*).
--
-- CALLERS, listed before changing anything:
--   src/  src/lib/contracts.ts (captureContactInfo)                   <- keeps working
--   api/  none, including transitively: a 6-deep call-graph closure
--         from all 25 RPC names invoked under api/ does not reach it.
--         No service_role path to preserve.
--   db/   sync_contract_fields_from_defs, reassign_document_party,
--         start_sale_contract, start_bill_of_sale,
--         start_bill_of_sale_standalone, set_document_co_buyer,
--         add_deal_document, start_lease_contract_v2
--         (all postgres-owned SECURITY DEFINER, all unaffected by the revoke)
--
-- THE GUARD. Reused, not invented: caller_is_document_party_or_staff() is the
-- existing predicate for exactly this question and is already used by three
-- functions NOGUARD1 classes as ENFORCES. It is EXISTS-based, so it returns
-- false — never NULL — for a caller with no identity:
--
--   SELECT EXISTS (SELECT 1 FROM documents d WHERE d.id = p_document_id
--                   AND has_staff_access() AND d.org_id = current_org())
--       OR EXISTS (SELECT 1 FROM document_parties dp
--                   WHERE dp.document_id = p_document_id
--                     AND dp.contact_id = current_contact_id());
--
-- It is still wrapped in coalesce(..., false) here, to match the house shape from
-- 20260808T0300 and so the guard does not depend on that helper never changing.
--
-- WHO THIS ADMITS: org staff, and any party on the document. That is the same
-- population the eight in-database callers already serve, and the same population
-- the browser path serves. auth.uid() / current_contact_id() are read from the
-- request JWT and are NOT rewritten by SECURITY DEFINER, so a legitimate user
-- arriving through any of the eight in-database callers still evaluates the
-- predicate as themselves and still passes.
--
-- WHAT IT REFUSES: an unidentified caller, and any signed-in account with no
-- relationship to the document. Both are currently allowed.
--
-- assert_not_signature_locked is deliberately NOT added here. This function runs
-- during document CREATION (start_lease_contract_v2, start_sale_contract,
-- start_bill_of_sale*, add_deal_document all call it before any signature can
-- exist), so a signature-lock assert would be inert at best. The signature
-- question for this family is raised in the report, not guessed at here.
--
-- PUBLIC and anon are revoked as well as guarded — the guard is the fix, the
-- revoke removes the unauthenticated surface entirely. Both trap grants are
-- present (PUBLIC =X/postgres AND role-held anon=X/postgres), so both are named.
--
-- The DO block asserts the body rewrite actually matched. ~31 migrations in this
-- repo rewrite bodies by string replacement and a miss silently reports success.

BEGIN;

DO $mig$
DECLARE
  v_oid oid;
  v_src text;
  v_new text;
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fill_party_fields_from_contacts';
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'NOGUARD2: fill_party_fields_from_contacts not found';
  END IF;

  v_src := pg_get_functiondef(v_oid);

  IF v_src LIKE '%caller_is_document_party_or_staff%' THEN
    RAISE EXCEPTION 'NOGUARD2: fill_party_fields_from_contacts already carries a guard — re-read it before re-running';
  END IF;

  -- Insert the guard as the first statement of the body. The anchor is the
  -- function's own BEGIN on its own line, so it cannot hit a BEGIN that opens a
  -- nested exception block (those are indented).
  IF position(E'\nBEGIN\n' in v_src) = 0 THEN
    RAISE EXCEPTION 'NOGUARD2: could not locate the body BEGIN in fill_party_fields_from_contacts';
  END IF;

  v_new := overlay(
    v_src
    placing E'\nBEGIN\n  IF NOT coalesce(caller_is_document_party_or_staff(p_document_id), false) THEN\n    RAISE EXCEPTION ''not authorized to write party fields on document %'', p_document_id;\n  END IF;\n'
    from   position(E'\nBEGIN\n' in v_src)
    for    length(E'\nBEGIN\n'));

  IF v_new = v_src THEN
    RAISE EXCEPTION 'NOGUARD2: guard insertion did not change the body; refusing to report a no-op as success';
  END IF;

  EXECUTE v_new;
  RAISE NOTICE 'NOGUARD2: fill_party_fields_from_contacts guarded';
END
$mig$;

REVOKE EXECUTE ON FUNCTION public.fill_party_fields_from_contacts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_party_fields_from_contacts(uuid) FROM anon;
-- authenticated is deliberately RETAINED: src/lib/contracts.ts calls this.

DO $verify$
DECLARE
  v_anon bool; v_auth bool; v_pub bool; v_acl text; v_guarded bool;
BEGIN
  SELECT has_function_privilege('anon', p.oid,'EXECUTE'),
         has_function_privilege('authenticated', p.oid,'EXECUTE'),
         EXISTS(SELECT 1 FROM unnest(p.proacl) a WHERE a::text LIKE '=%'),
         p.proacl::text,
         pg_get_functiondef(p.oid) LIKE '%caller_is_document_party_or_staff%'
    INTO v_anon, v_auth, v_pub, v_acl, v_guarded
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='fill_party_fields_from_contacts';

  RAISE NOTICE 'NOGUARD2 fill_party_fields_from_contacts -> anon=% authenticated=% PUBLIC=% guarded=% acl=%',
               v_anon, v_auth, v_pub, v_guarded, v_acl;

  IF NOT v_guarded THEN
    RAISE EXCEPTION 'NOGUARD2: guard not present after rewrite';
  END IF;
  IF v_anon OR v_pub THEN
    RAISE EXCEPTION 'NOGUARD2: still anon/PUBLIC reachable after revoke — the revoke reported success and did nothing';
  END IF;
  IF NOT v_auth THEN
    RAISE EXCEPTION 'NOGUARD2: authenticated lost EXECUTE — this would break captureContactInfo in the browser';
  END IF;
END
$verify$;

COMMIT;
