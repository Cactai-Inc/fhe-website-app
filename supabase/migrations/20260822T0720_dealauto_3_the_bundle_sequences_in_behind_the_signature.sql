-- DEALAUTO §2 — the bundle is sequenced right after the deciding signature.
--
-- Owner, 2026-08-22: "all of those are bundled together to be signed after the
-- contract is signed by both parties. if lessor is last to sign which is
-- typically the case, the documents are to be surfaced in sequence immediately
-- after the signature is captured on the contract."
--
-- "AFTER BOTH PARTIES HAVE SIGNED" IS ALREADY A THING THIS DATABASE KNOWS, and
-- it is not a role. `record_signature` executes the document — status EXECUTED,
-- workflow_state 'executed' — on the signature that makes signed >= signers.
-- Whoever fires that is the second and final signer, whether that is the
-- LESSOR, the LESSEE or a staff member completing the company's seat. Nothing
-- below names a role, and nothing below assumes the LESSOR is last: the seam is
-- the executed transition itself.
--
-- WHAT THE BUNDLE CONTAINS is read from `contract_role_document_requirements`
-- (ROLEBUNDLE, 2026-08-22) and is not re-derived here. That function already
-- carries the two carve-outs that matter — the company never countersigns its
-- own policies, and a template already satisfied by an executed document on
-- file is not owed again — plus `owned_by`, which names the templates that
-- already have a generator. This function generates ONLY the rows it reports as
-- `owned_by = 'unassigned'`: the horse-owner documents (HORSE_EMERGENCY_VET,
-- RELEASE_HORSE_CARE) stay with `ensure_horse_documents`, which
-- `apply_contract_execution_effects` already calls on the same event and whose
-- trigger sorts before this one ('c' < 'd'), so its sequence numbers 1-3 are
-- already assigned when this runs.
--
-- WHY THE GENERATED DOCUMENTS ARE BORN 'locked'. The three bundle templates
-- have ZERO `contract_field_defs` rows between them — they are standing forms
-- with nothing to author, and their bodies substitute from the contact record.
-- A document left 'editable' cannot be signed from ContractPage at all: the
-- whole signing section is gated on `state === 'in_review' || 'locked' ||
-- signatures.length > 0`. Born 'editable' the bundle would be generated,
-- listed, sequenced — and unsignable. `contract_lock_blockers` on a
-- field-less, wall-gating template returns `[]` (verified against the live
-- HORSE_EMERGENCY_VET document 3f52d678, which returns `[]` today), so locking
-- at birth skips no check that would otherwise have run. The guard is written
-- as "nothing to author" rather than as a template list, so a bundle template
-- that later grows fields keeps its authoring phase.

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

  -- ONE read of the bundle, up front: contract_role_document_requirements is
  -- STABLE, so re-reading it inside the loop would return the same snapshot
  -- anyway and read as though it were reacting to the inserts.
  v_req := coalesce(contract_role_document_requirements(p_document_id) -> 'requirements', '[]'::jsonb);

  SELECT coalesce(max(d.sign_sequence), 0) INTO v_seq
    FROM documents d WHERE d.contract_id = v_contract AND d.deleted_at IS NULL;

  FOR r IN SELECT e.value FROM jsonb_array_elements(v_req) e LOOP
    v_contact := nullif(r ->> 'contact_id', '')::uuid;
    v_key     := r ->> 'template_key';
    CONTINUE WHEN v_contact IS NULL OR v_key IS NULL;

    -- already on file for this person: nothing is owed (ROLEBUNDLE's own rule)
    CONTINUE WHEN coalesce((r ->> 'satisfied')::boolean, false);
    -- somebody else already owns making this one
    CONTINUE WHEN coalesce(r ->> 'owned_by', 'unassigned') <> 'unassigned';

    -- idempotency, per PERSON: `on_this_contract_document_id` is deliberately
    -- addressee-blind, so it cannot be used here — when both parties owe
    -- Company Policies, one party's copy would suppress the other's. This asks
    -- the only question that matters: does THIS person already have a live copy
    -- of THIS template on THIS contract?
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM documents d2 JOIN contract_templates t2 ON t2.id = d2.template_id
       WHERE d2.contract_id = v_contract AND d2.contact_id = v_contact
         AND t2.template_key = v_key AND d2.deleted_at IS NULL
         AND coalesce(d2.workflow_state, '') <> 'void');

    -- PARTICIPANT: FACILITY_RULES and RELEASE_GENERAL substitute
    -- PARTICIPANT.FULL_NAME / PARTICIPANT.DOB. Same resolution
    -- generate_my_onboarding_documents uses — a guardian-linked minor, else the
    -- person themselves — so the two paths cannot render the same template
    -- differently. A minor never signs.
    SELECT id INTO v_minor FROM contacts
     WHERE guardian_contact_id = v_contact AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1;

    -- horse_id is deliberately NULL: these are obligations between the person
    -- and the company, not documents about the horse. Attaching the deal's
    -- horse would make the copy horse-scoped, and supersession is horse-scoped
    -- (SUPERSEDE, 2026-08-10) — a horse-scoped Company Policies would sit
    -- alongside the person's general one instead of replacing it.
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
           -- nothing to author => ready to sign the moment it appears
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

REVOKE ALL ON FUNCTION public.ensure_contract_role_documents(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_contract_role_documents(uuid) FROM anon;
-- staff may run it by hand for a contract executed before this migration
GRANT EXECUTE ON FUNCTION public.ensure_contract_role_documents(uuid) TO authenticated;

-- ── the horse documents become signable, not just present ───────────────────
-- Same one-line reasoning as above, applied to the generator that already owns
-- them. Confirmed against production: the two live HORSE_EMERGENCY_VET /
-- RELEASE_HORSE_CARE documents on contract eee963db carry ZERO contract_fields
-- rows and `contract_lock_blockers` returns `[]` for them — yet both sit in
-- workflow_state 'editable', where ContractPage renders no signing section at
-- all. They attached to the right contract and the right party at the right
-- time and could not be signed. The guard is the same "nothing to author" test,
-- so a horse document that ever grows fields keeps its authoring phase.
CREATE OR REPLACE FUNCTION public.ensure_horse_documents(p_horse_id uuid, p_contract_id uuid DEFAULT NULL::uuid, p_include_care boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid := current_org();
  v_horse     horses%ROWTYPE;
  v_owner     uuid;
  v_contact   uuid := current_contact_id();
  v_templates text[] := ARRAY['HORSE_EMERGENCY_VET'];
  v_tpl       text;
  v_doc       uuid;
  v_voided    int := 0;
  v_rc        int := 0;
  v_gen       jsonb := '[]'::jsonb;
  v_may       boolean;
  v_seq       int;
  v_fields    int;
BEGIN
  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND org_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;

  v_may := has_staff_access()
    OR v_horse.current_owner_contact_id = v_contact
    OR v_horse.lessee_contact_id = v_contact
    OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = p_horse_id AND hr.party_contact_id = v_contact AND hr.active);
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;

  v_owner := coalesce(v_horse.current_owner_contact_id, v_contact);
  IF v_owner IS NULL THEN RAISE EXCEPTION 'horse has no owner on record to authorize'; END IF;

  IF p_include_care IS TRUE
     OR (p_include_care IS NULL AND owner_has_executed_template(v_owner, 'RELEASE_HORSE_CARE')) THEN
    v_templates := array_append(v_templates, 'RELEASE_HORSE_CARE');
  END IF;

  FOREACH v_tpl IN ARRAY v_templates LOOP
    -- HORSEDOCS: a signed document is evidence and is NEVER swept. Same guard
    -- shape as SENDGUARD §3 in generate_my_onboarding_documents: EXECUTED is
    -- protected, and so is a still-pending document that already carries a live
    -- signature. The replacement below is still generated; the existing
    -- documents_apply_supersession trigger marks this one superseded when that
    -- replacement is executed.
    WITH tmpl AS (SELECT id FROM contract_templates WHERE template_key = v_tpl)
    UPDATE documents d
       SET deleted_at = now(), deleted_by = auth.uid()
     WHERE d.contact_id = v_owner
       AND d.template_id = (SELECT id FROM tmpl)
       AND d.deleted_at IS NULL
       AND d.status <> 'EXECUTED'
       AND NOT EXISTS (SELECT 1 FROM signatures s
                        WHERE s.document_id = d.id AND s.deleted_at IS NULL)
       AND (d.horse_id IS NULL
            OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    v_voided := v_voided + v_rc;

    IF EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_owner AND t.template_key = v_tpl
        AND d.horse_id = p_horse_id AND d.deleted_at IS NULL
        AND d.merged_body NOT LIKE '%{{HORSE.REGISTERED_NAME}}%'
    ) THEN
      CONTINUE;
    END IF;

    -- OWNER is the sole party/signer; coverage of FHE + any active-term lessee is
    -- a standing clause in the body, not a named party.
    SELECT gd.document_id INTO v_doc FROM generate_document(
      v_owner, v_tpl, p_contract_id, p_horse_id,
      jsonb_build_array(jsonb_build_object(
        'contact_id', v_owner, 'role', 'CLIENT', 'is_signer', true, 'signer_order', 1)),
      'horse'::text) gd;

    v_seq := CASE WHEN p_contract_id IS NULL THEN NULL
                  WHEN v_tpl = 'HORSE_EMERGENCY_VET' THEN 2
                  WHEN v_tpl = 'RELEASE_HORSE_CARE'  THEN 3 END;
    SELECT count(*) INTO v_fields FROM contract_fields WHERE document_id = v_doc;
    -- DEALAUTO §2: a document with nothing to author is ready to sign. Left
    -- 'editable' it appears in the signing set and offers no way to sign it.
    UPDATE documents
       SET status = 'AWAITING_SIGNATURE', sign_sequence = v_seq,
           workflow_state = CASE WHEN v_fields = 0 THEN 'locked' ELSE workflow_state END
      WHERE id = v_doc AND status = 'DRAFT';
    v_gen := v_gen || jsonb_build_object('template_key', v_tpl, 'document_id', v_doc);
  END LOOP;

  IF p_contract_id IS NOT NULL THEN
    UPDATE documents d SET sign_sequence = 1
      FROM contract_templates t
     WHERE d.template_id = t.id AND is_horse_lease_template(t.template_key)
       AND d.contract_id = p_contract_id AND d.deleted_at IS NULL
       AND d.sign_sequence IS DISTINCT FROM 1;
  END IF;

  RETURN jsonb_build_object('owner_contact_id', v_owner, 'generated', v_gen, 'voided', v_voided);
END;
$function$;

-- ── the seam: deal creation AND bundle generation, on the executed event ────
-- Both additions are isolated. A deal is a byproduct and a bundle is
-- follow-on paperwork; neither may roll back an instrument that has already
-- sealed. Same isolation record_signature uses around its own notify_staff.
--
-- ⚠️ This trigger is `AFTER UPDATE OF workflow_state` (ORCHESTRATOR §3c). The
-- statement that must name that column is record_signature's
--   UPDATE documents SET status='EXECUTED', ..., workflow_state='executed'
-- which names it explicitly. Proven by probe trigger in a rolled-back
-- transaction, not by reading the row afterwards — see the report.
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

  -- CLOSEOUT §1.7: the envelope follows its governing document.
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

  -- DEALAUTO §1 (safety net). The deal is normally opened by
  -- contracts_ensure_deal_trg the moment the contract row is inserted. This
  -- catches a contract that predates that trigger and one whose deal creation
  -- was swallowed by the warning path there.
  BEGIN
    PERFORM ensure_deal_for_contract(NEW.contract_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_autocomplete_on_execution: ensure_deal_for_contract failed for contract %: %',
      NEW.contract_id, SQLERRM;
  END;

  -- DEALAUTO §2. The signature that just executed the GOVERNING document is,
  -- by definition, the last of the contract's party signatures. Everything each
  -- role still owes is generated now, sequenced behind this document, so the
  -- signer's next step is already waiting when the page reloads.
  IF v_gov THEN
    BEGIN
      PERFORM ensure_contract_role_documents(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'deal_autocomplete_on_execution: role bundle not generated for document %: %',
        NEW.id, SQLERRM;
    END;
  END IF;

  SELECT * INTO v_deal FROM deals
   WHERE contract_id = NEW.contract_id AND deleted_at IS NULL AND status = 'pending';
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- only settle when nothing at all is outstanding; otherwise leave it pending.
  -- ⚠️ deal_completion_state gates on the GOVERNING document alone — an
  -- optional agreement, and now the role bundle, never block completion. That
  -- is the owner's standing ruling, written into that function before today,
  -- and nothing here narrows it.
  IF (deal_completion_state(v_deal.id) ->> 'can_complete')::boolean THEN
    UPDATE deals SET status = 'complete', completed_at = now() WHERE id = v_deal.id;
    UPDATE contracts SET status = 'executed' WHERE id = v_deal.contract_id AND status <> 'executed';
  END IF;

  RETURN NEW;
END;
$function$;
