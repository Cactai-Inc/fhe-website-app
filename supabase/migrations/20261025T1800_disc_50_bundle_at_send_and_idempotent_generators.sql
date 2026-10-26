-- disc_50 (fix round 5b ruling): generate the role bundle when the contract is
-- SENT, not at execution; make the person-document generators idempotent against
-- orphan drafts by matching on the party rows, not only documents.contact_id; and
-- delete the six orphaned Sundance duplicate drafts. Single transaction.
--
--  1. send_contract_to_party → after validating, PERFORM ensure_contract_role_documents
--     so the bundle exists behind the contract the moment it is sent.
--  2. deal_autocomplete_on_execution → the DEALAUTO §2 block that generated the
--     bundle at execution is REMOVED. Execution generates nothing.
--  3. ensure_contract_role_documents → the existence guard matches a live copy of
--     THIS template for THIS person on THIS contract by EITHER documents.contact_id
--     OR a document_parties CLIENT row — so an orphan draft is found and reused.
--  4. generate_my_onboarding_documents → the reuse checks also match via the CLIENT
--     party row, so an unsigned draft is found and reused instead of a 2nd/3rd copy.
--  5. DELETE the six Sundance drafts (dumped first to
--     ~/fhe-backups/fix-round-2026-10-25/item5b_sundance_duplicate_drafts.sql).
--
-- apply_category_documents is unchanged: it writes contact_required_documents with
-- ON CONFLICT DO NOTHING and calls no document generator, so it is already idempotent.

BEGIN;

-- ── 1. bundle generation moves to SEND ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_contract_to_party(p_document_id uuid, p_party_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_title text; v_target uuid; v_me uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state, title INTO v_org, v_state, v_title FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;

  IF NOT ((coalesce(has_staff_access() AND v_org = current_org(), false))) THEN
    RAISE EXCEPTION 'not authorized to send this document';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(contract_lock_blockers(p_document_id)) b
              WHERE b->>'code' = 'horse_missing') THEN
    RAISE EXCEPTION 'Attach the horse to this contract before sending it.';
  END IF;

  SELECT contact_id INTO v_target FROM document_parties
   WHERE document_id = p_document_id AND party_role = p_party_role AND contact_id IS NOT NULL LIMIT 1;
  IF v_target IS NULL THEN RAISE EXCEPTION 'that party has no contact to send to'; END IF;

  UPDATE documents SET sent_at = coalesce(sent_at, now()), updated_at = now() WHERE id = p_document_id;

  -- ⚠️ FIX ROUND 5b — the role bundle each party owes is generated HERE, at send,
  -- sequenced behind this contract. ensure_contract_role_documents is idempotent,
  -- so a second send, a resend, or execution never creates another copy. Hold and
  -- delivery are unchanged: nothing delivers until every sequenced document on the
  -- contract executes.
  BEGIN
    PERFORM ensure_contract_role_documents(p_document_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'send_contract_to_party: role bundle not generated for document %: %',
      p_document_id, SQLERRM;
  END;

  INSERT INTO notifications (org_id, user_id, kind, title, body, link)
  SELECT v_org, p.user_id, 'contract_sent',
         coalesce(v_title, 'A document') || ' is ready for you',
         'You have a document to review'
           || CASE WHEN v_state IN ('locked') THEN ' and sign.' ELSE ' and complete.' END,
         '/app/contracts/' || p_document_id::text
    FROM profiles p
   WHERE p.user_id IN (SELECT user_id FROM party_user_ids(p_document_id, p_party_role));
END;
$function$;

-- ── 2. execution no longer generates the bundle ─────────────────────────────
CREATE OR REPLACE FUNCTION public.deal_autocomplete_on_execution()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal deals%ROWTYPE;
  v_key  text;
  v_kind text;
  v_gov  boolean;
BEGIN
  IF NOT coalesce(NEW.workflow_state = 'executed' AND OLD.workflow_state IS DISTINCT FROM 'executed', false) THEN
    RETURN NEW;
  END IF;
  IF NEW.contract_id IS NULL THEN RETURN NEW; END IF;

  SELECT template_key, contract_kind INTO v_key, v_kind
    FROM contract_templates WHERE id = NEW.template_id;
  v_gov := is_horse_lease_template(v_key)
        OR v_key = 'HORSE_PURCHASE_SALE'
        OR coalesce(v_kind, '') IN ('HORSE_SALE', 'HORSE_BILL_OF_SALE');
  IF v_gov THEN
    UPDATE contracts
       SET status = 'executed', signed_at = coalesce(signed_at, now())
     WHERE id = NEW.contract_id AND status <> 'executed';
  END IF;

  BEGIN
    PERFORM ensure_deal_for_contract(NEW.contract_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_autocomplete_on_execution: ensure_deal_for_contract failed for contract %: %',
      NEW.contract_id, SQLERRM;
  END;

  -- ⚠️ FIX ROUND 5b — the role bundle is NO LONGER generated at execution. It is
  -- generated at SEND (send_contract_to_party), so by the time the governing
  -- document executes the bundle already exists and is sequenced behind it.
  -- Generating here raced the delivery evaluation on the same transition and was
  -- the likely source of duplicate drafts.

  SELECT * INTO v_deal FROM deals
   WHERE contract_id = NEW.contract_id AND deleted_at IS NULL AND status = 'pending';
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF (deal_completion_state(v_deal.id) ->> 'can_complete')::boolean THEN
    UPDATE deals SET status = 'complete', completed_at = now() WHERE id = v_deal.id;
    UPDATE contracts SET status = 'executed' WHERE id = v_deal.contract_id AND status <> 'executed';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 3. idempotent contract-bundle generator (party-row aware) ───────────────
CREATE OR REPLACE FUNCTION public.ensure_contract_role_documents(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req      jsonb;
  v_contract uuid;
  v_org      uuid;
  v_seq      int;
  v_out      jsonb := '[]'::jsonb;
  v_doc      uuid;
  v_minor    uuid;
  v_fields   int;
  r          jsonb;
  v_contact  uuid;
  v_key      text;
BEGIN
  SELECT d.contract_id, d.org_id INTO v_contract, v_org
    FROM documents d WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_contract IS NULL THEN
    RETURN jsonb_build_object('generated', v_out, 'reason', 'no contract');
  END IF;

  UPDATE documents SET sign_sequence = 1
   WHERE id = p_document_id AND sign_sequence IS NULL;

  v_req := coalesce(contract_role_document_requirements(p_document_id) -> 'requirements', '[]'::jsonb);

  SELECT coalesce(max(d.sign_sequence), 0) INTO v_seq
    FROM documents d WHERE d.contract_id = v_contract AND d.deleted_at IS NULL;

  FOR r IN SELECT e.value FROM jsonb_array_elements(v_req) e LOOP
    v_contact := nullif(r ->> 'contact_id', '')::uuid;
    v_key     := r ->> 'template_key';
    CONTINUE WHEN v_contact IS NULL OR v_key IS NULL;
    CONTINUE WHEN coalesce((r ->> 'satisfied')::boolean, false);
    CONTINUE WHEN coalesce(r ->> 'owned_by', 'unassigned') <> 'unassigned';

    -- ⚠️ FIX ROUND 5b — idempotency, per PERSON, orphan-proof. A live (non-void)
    -- copy of THIS template for THIS person on THIS contract is detected whether
    -- the copy is tied to the person by documents.contact_id OR by a CLIENT
    -- document_parties row. The old guard matched contact_id only, so a draft
    -- whose contact_id did not line up was invisible and got duplicated.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM documents d2 JOIN contract_templates t2 ON t2.id = d2.template_id
       WHERE d2.contract_id = v_contract
         AND t2.template_key = v_key AND d2.deleted_at IS NULL
         AND coalesce(d2.workflow_state, '') <> 'void'
         AND (d2.contact_id = v_contact
           OR EXISTS (SELECT 1 FROM document_parties dp
                       WHERE dp.document_id = d2.id AND dp.contact_id = v_contact
                         AND dp.party_role = 'CLIENT')));

    SELECT id INTO v_minor FROM contacts
     WHERE guardian_contact_id = v_contact AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1;

    SELECT gd.document_id INTO v_doc FROM generate_document(
      v_contact, v_key, v_contract, NULL::uuid,
      jsonb_build_array(
        jsonb_build_object('contact_id', v_contact, 'role', 'CLIENT',
                           'is_signer', true, 'signer_order', 1),
        jsonb_build_object('contact_id', coalesce(v_minor, v_contact),
                           'role', 'PARTICIPANT', 'is_signer', false)),
      NULL::text) gd;
    CONTINUE WHEN v_doc IS NULL;

    v_seq := v_seq + 1;
    SELECT count(*) INTO v_fields FROM contract_fields WHERE document_id = v_doc;

    UPDATE documents
       SET status         = 'AWAITING_SIGNATURE',
           sign_sequence  = v_seq,
           workflow_state = CASE WHEN v_fields = 0 THEN 'locked' ELSE workflow_state END
     WHERE id = v_doc;

    v_out := v_out || jsonb_build_object(
      'document_id', v_doc, 'template_key', v_key,
      'contact_id', v_contact, 'party_role', r ->> 'party_role',
      'sign_sequence', v_seq);
    v_doc := NULL; v_minor := NULL;
  END LOOP;

  RETURN jsonb_build_object('contract_id', v_contract, 'generated', v_out);
END;
$function$;

-- ── 4. onboarding generator: reuse checks match the CLIENT party row too ────
--     In-place rewrite — every `d.contact_id = v_contact` (two reuse lookups and
--     the sweep) and the `d2.contact_id = v_contact` horse-carry lookup now also
--     match an unsigned draft tied to the person by a CLIENT document_parties row,
--     so an orphan draft is reused/swept instead of a second copy being generated.
DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.generate_my_onboarding_documents()'::regprocedure);
  v_d   text := 'd.contact_id = v_contact';
  v_d2  text := 'd2.contact_id = v_contact';
  v_dnew  text := '(d.contact_id = v_contact OR EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = d.id AND dp.contact_id = v_contact AND dp.party_role = ''CLIENT''))';
  v_d2new text := '(d2.contact_id = v_contact OR EXISTS (SELECT 1 FROM document_parties dp2 WHERE dp2.document_id = d2.id AND dp2.contact_id = v_contact AND dp2.party_role = ''CLIENT''))';
BEGIN
  IF position(v_d in v_src) = 0 OR position(v_d2 in v_src) = 0 THEN
    RAISE EXCEPTION 'generate_my_onboarding_documents contact_id predicate not found — body drifted';
  END IF;
  v_src := replace(v_src, v_d2, v_d2new);  -- do the d2 form FIRST (it contains "d.contact_id"? no — distinct token)
  v_src := replace(v_src, v_d, v_dnew);
  EXECUTE v_src;
END $mig$;

-- ── 5. delete the six orphaned Sundance duplicate drafts ────────────────────
--     (dumped first; cascade removes their parties + document_horses; no
--      signatures exist on them.)
DELETE FROM documents
 WHERE id IN ('9f6a5bf1-1c51-42db-9bdc-08cefd07deba',
              'c5be7e66-e94a-4c76-81d8-74e2a0055efc',
              '803048b5-660c-496e-8765-6a4cf529358b',
              '13fa4187-9d57-48a8-b108-c6be0631c0b7',
              '6f43d0be-cc35-4506-9f0e-eb76679f2a05',
              'd4d2ceee-94fa-4f40-8230-1ea5c0427a27');

COMMIT;
