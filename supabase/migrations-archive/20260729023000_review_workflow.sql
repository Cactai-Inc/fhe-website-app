-- ─────────────────────────────────────────────────────────────────────────────
-- H2–H5 — REVIEW WORKFLOW (owner-approved design).
--
--  • contract_lock_blockers(document): THE single source for lock preconditions
--    (open change requests, empty required VISIBLE fields — clause AND field
--    gates, party-type consistency, horse confirmation). Used by BOTH
--    advance_document_workflow (raises) and approve_contract_review (returns
--    named blockers) so the checks can never drift apart.
--  • advance_document_workflow: rewritten on top of the helper; the last
--    originator-authority use (the editing-branch v_is_orig) is collapsed (H1).
--  • approve_contract_review(document): any NON-staff signing party records a
--    "Reviewed and accepted by {role — name}" status_event. When ALL non-staff
--    signing parties have approved AND the lock preconditions pass, the document
--    auto-advances to locked (seeding signature rows via the existing engine
--    path). Otherwise the approval still stands and the named blockers return.
--  • confirm_horse_section: now also allowed while in_review (the UI offers the
--    control there; the RPC used to reject it).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- review-approval vocabulary (non-true-status document event)
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('document', 'review_approved', 'Reviewed and accepted', false, false, 33)
ON CONFLICT (entity_type, code) DO NOTHING;

-- ── the single lock-precondition evaluator ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_lock_blockers(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blockers jsonb := '[]'::jsonb;
  v_open int;
  v_vals jsonb := '{}'::jsonb;
  r record;
  v_missing text[];
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
BEGIN
  SELECT horse_section_confirmed_at INTO v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  SELECT count(*) INTO v_open FROM document_change_requests
   WHERE document_id = p_document_id AND status = 'open';
  IF v_open > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'open_change_requests',
      'message', v_open || ' open change request(s) must be resolved'));
  END IF;

  -- required + VISIBLE (clause gate AND the field's own gate met, included, not
  -- N/A) fields that are still empty — named by label so the caller can act.
  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_vals := v_vals || jsonb_build_object(r.field_key, r.val);
  END LOOP;
  SELECT array_agg(coalesce(cf.label, cf.field_key) ORDER BY cf.sort_order, cf.field_key)
    INTO v_missing
    FROM contract_fields cf
    LEFT JOIN contract_clause_defs cd
      ON cd.template_key = (SELECT ct.template_key FROM documents d
                             JOIN contract_templates ct ON ct.id = d.template_id
                            WHERE d.id = p_document_id)
     AND cd.clause_key = cf.clause_key
   WHERE cf.document_id = p_document_id AND cf.required
     AND coalesce(cf.included, true) AND NOT coalesce(cf.is_na, false)
     AND nullif(trim(coalesce(cf.value, '')), '') IS NULL
     AND clause_condition_met(cd.conditional_on, v_vals)
     AND clause_condition_met(cf.conditional_on, v_vals);
  IF v_missing IS NOT NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'required_fields',
      'message', 'Required field(s) still empty: ' || array_to_string(v_missing, ', ')));
  END IF;

  IF EXISTS (
    SELECT 1 FROM contract_fields cf
      JOIN documents d2 ON d2.id = cf.document_id
      JOIN contract_parties cp2 ON cp2.contract_id = d2.contract_id AND cp2.party_role = 'LESSEE'
      JOIN contacts c2 ON c2.id = cp2.contact_id
     WHERE cf.document_id = p_document_id AND cf.field_key = 'LESSEE.PARTY_TYPE'
       AND ((cf.value = 'INDIVIDUAL' AND coalesce(c2.is_company,false))
         OR (cf.value = 'ENTITY' AND NOT coalesce(c2.is_company,false)))
  ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'party_type_mismatch',
      'message', 'LESSEE.PARTY_TYPE contradicts the Lessee party record (person vs company) — correct the field or the contact record'));
  END IF;

  v_needs_horse := EXISTS (
    SELECT 1 FROM contract_fields
    WHERE document_id = p_document_id
      AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
  IF v_needs_horse AND v_horse_confirmed IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'horse_unconfirmed',
      'message', 'The horse information has not been confirmed by the Lessor'));
  END IF;

  RETURN v_blockers;
END;
$function$;

-- ── advance_document_workflow: rewritten on the helper (+ H1 collapse) ───────
CREATE OR REPLACE FUNCTION public.advance_document_workflow(p_document_id uuid, p_to text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid;
  v_from      text;
  v_recip     boolean;
  v_is_staff  boolean;
  v_is_party  boolean;
  v_blockers  jsonb;
  v_title     text;
  v_horse_confirmed timestamptz;
  v_signed    boolean;
  v_hz        uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing,
         coalesce(title, 'A contract'), horse_section_confirmed_at
    INTO v_org, v_from, v_recip, v_title, v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF p_to = 'executed' THEN
    RAISE EXCEPTION 'workflow_state ''executed'' is reached only by signing (record_signature), not manually';
  END IF;
  IF p_to NOT IN ('editable','editing','in_review','locked','void') THEN
    RAISE EXCEPTION 'unknown target workflow_state: %', p_to;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_party := caller_is_document_party(p_document_id);

  IF NOT (v_is_staff OR v_is_party) THEN
    RAISE EXCEPTION 'not authorized to advance document %', p_document_id;
  END IF;

  IF v_from = p_to THEN
    RETURN v_from;
  END IF;

  IF v_from = 'executed' THEN
    RAISE EXCEPTION 'document is executed and cannot change workflow_state';
  END IF;

  IF p_to = 'void' THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'only staff may void a document';
    END IF;

  ELSIF p_to = 'editing' THEN
    IF v_from NOT IN ('editable') THEN
      RAISE EXCEPTION 'illegal transition %→editing', v_from;
    END IF;
    -- H1: originator authority collapsed — the company (staff) authors; a
    -- counterparty opens editing only when recipient editing is enabled.
    IF NOT v_is_staff AND NOT v_recip THEN
      RAISE EXCEPTION 'the counterparty may open editing only when recipient editing is enabled';
    END IF;

  ELSIF p_to = 'editable' THEN
    IF v_from NOT IN ('editing','in_review') THEN
      RAISE EXCEPTION 'illegal transition %→editable', v_from;
    END IF;

  ELSIF p_to = 'in_review' THEN
    IF v_from NOT IN ('editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→in_review', v_from;
    END IF;

  ELSIF p_to = 'locked' THEN
    IF v_from NOT IN ('in_review','editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→locked', v_from;
    END IF;
    -- ALL lock preconditions live in contract_lock_blockers (shared with
    -- approve_contract_review) — never re-implement them here.
    v_blockers := contract_lock_blockers(p_document_id);
    IF jsonb_array_length(v_blockers) > 0 THEN
      RAISE EXCEPTION 'cannot lock: %',
        (SELECT string_agg(b->>'message', '; ') FROM jsonb_array_elements(v_blockers) b);
    END IF;
  END IF;

  UPDATE documents SET workflow_state = p_to WHERE id = p_document_id;

  IF p_to = 'locked' THEN
    -- Seed a PENDING signature row for every signer party so the signing surface
    -- has something to render. Idempotent (unique key), leaves sealed rows alone.
    INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, method)
      SELECT v_org, p_document_id, dp.contact_id, dp.party_role, 'TYPED'
        FROM document_parties dp
       WHERE dp.document_id = p_document_id
         AND dp.is_signer = true
         AND dp.contact_id IS NOT NULL
         AND dp.party_role = ANY (ARRAY['CLIENT','BUYER','SELLER','LESSOR','LESSEE',
              'OWNER','RIDER','PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
              'CONTRACTOR','FACILITY_CONTACT','COMPANY'])
      ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      IF EXISTS (SELECT 1 FROM contract_clause_defs cdf JOIN documents d2 ON true JOIN contract_templates ct2 ON ct2.id=d2.template_id AND ct2.template_key=cdf.template_key WHERE d2.id=p_document_id) THEN
       PERFORM remerge_contract_from_clauses(p_document_id);
     ELSE
       PERFORM remerge_contract_from_fields(p_document_id);
     END IF;
    END IF;
    -- HORSE_LEASE: at lock, prepare the horse's vet + care docs so they're signed
    -- alongside the contract. Guarded on a horse being on record; a lease with no
    -- horse_id yet simply locks (never blocks). Idempotent.
    IF (SELECT ct.template_key FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
         WHERE d.id = p_document_id) = 'HORSE_LEASE' THEN
      SELECT horse_id INTO v_hz FROM documents WHERE id = p_document_id;
      IF v_hz IS NOT NULL THEN
        PERFORM ensure_horse_documents(
          v_hz, (SELECT contract_id FROM documents WHERE id = p_document_id), true);
      END IF;
    END IF;
  END IF;

  IF p_to IN ('in_review','locked') THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      SELECT DISTINCT v_org, pr.user_id,
        CASE p_to WHEN 'in_review' THEN 'contract_in_review' ELSE 'contract_locked' END,
        v_title || (CASE p_to WHEN 'in_review' THEN ' is ready for your review'
                              ELSE ' is ready to sign' END),
        '/app/contracts/' || p_document_id::text
      FROM document_parties dp
      JOIN contacts pc ON pc.id = dp.contact_id
      JOIN profiles pr ON (pr.contact_id = dp.contact_id
                           OR (pc.email IS NOT NULL AND lower(pr.email) = lower(pc.email)))
      WHERE dp.document_id = p_document_id
        AND pr.user_id IS NOT NULL
        AND pr.user_id <> auth.uid();
  END IF;

  RETURN p_to;
END;
$function$;

-- ── approve_contract_review ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_contract_review(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me       uuid := current_contact_id();
  v_doc      documents%ROWTYPE;
  v_my_role  text;
  v_my_name  text;
  v_blockers jsonb;
  v_pending  text[];
  v_locked   boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  -- staff/author path is Lock for signing; review approval is the PARTY act.
  IF has_staff_access() AND v_doc.org_id = current_org() THEN
    RAISE EXCEPTION 'staff do not approve as reviewers — use Lock for signing';
  END IF;
  IF v_doc.workflow_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'document is % — review approval applies before locking', v_doc.workflow_state;
  END IF;

  SELECT dp.party_role INTO v_my_role
    FROM document_parties dp
   WHERE dp.document_id = p_document_id AND dp.contact_id = v_me AND dp.is_signer
   ORDER BY dp.party_role LIMIT 1;
  IF v_my_role IS NULL THEN
    RAISE EXCEPTION 'only a signing party may approve this document';
  END IF;

  SELECT coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email, 'party')
    INTO v_my_name FROM contacts c WHERE c.id = v_me;

  -- the approval is RECORDED regardless of blockers
  INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor_user_id)
  VALUES (v_doc.org_id, 'document', p_document_id, 'review_approved',
          'Reviewed and accepted by ' || initcap(lower(v_my_role)) || ' — ' || v_my_name,
          auth.uid());

  v_blockers := contract_lock_blockers(p_document_id);

  -- multi-party: EVERY non-staff signing party must have approved before locking
  SELECT array_agg(initcap(lower(x.party_role)) ORDER BY x.party_role) INTO v_pending
  FROM (
    SELECT dp.party_role, dp.contact_id
      FROM document_parties dp
      JOIN contacts c ON c.id = dp.contact_id
     WHERE dp.document_id = p_document_id AND dp.is_signer AND dp.contact_id IS NOT NULL
       AND dp.party_role NOT IN ('FHE','COMPANY')
       AND NOT coalesce(c.is_company, false)
       AND NOT EXISTS (SELECT 1 FROM profiles pr
                        WHERE pr.contact_id = dp.contact_id AND pr.is_admin)
  ) x
  WHERE NOT EXISTS (
    SELECT 1 FROM status_events se
      JOIN profiles pr ON pr.user_id = se.actor_user_id
     WHERE se.entity_type = 'document' AND se.entity_id = p_document_id
       AND se.status = 'review_approved' AND pr.contact_id = x.contact_id);
  IF v_pending IS NOT NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'awaiting_approvals',
      'message', 'Awaiting review approval from: ' || array_to_string(v_pending, ', ')));
  END IF;

  IF jsonb_array_length(v_blockers) = 0 THEN
    PERFORM advance_document_workflow(p_document_id, 'locked');
    v_locked := true;
  END IF;

  RETURN jsonb_build_object('approved', true, 'locked', v_locked, 'blockers', v_blockers);
END;
$function$;

-- ── confirm_horse_section: allow in_review (H5) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_horse_section(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc documents%ROWTYPE;
  v_is_staff boolean;
  v_is_lessor boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  IF v_doc.workflow_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'document is % — the horse section can only be confirmed before locking', v_doc.workflow_state;
  END IF;

  v_is_staff  := has_staff_access() AND v_doc.org_id = current_org();
  v_is_lessor := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = 'LESSOR');
  IF NOT (v_is_staff OR v_is_lessor) THEN
    RAISE EXCEPTION 'only the Lessor (or staff) may confirm the horse information';
  END IF;

  UPDATE documents
     SET horse_section_confirmed_at = now(),
         horse_section_confirmed_by = current_contact_id()
   WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'document_id', p_document_id,
    'horse_section_confirmed_at', now(),
    'horse_section_confirmed_by', current_contact_id());
END;
$function$;

COMMIT;
