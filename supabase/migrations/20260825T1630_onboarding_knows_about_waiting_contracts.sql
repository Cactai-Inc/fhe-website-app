-- P1 ITEM 2 — THE ONBOARDING DEAD END LEARNS ABOUT WAITING CONTRACTS.
--
-- Unchanged from the live definition except for `contracts_waiting`, marked
-- "P1 ITEM 2". Full CREATE OR REPLACE rather than an in-place body rewrite, so
-- this migration is replayable on a fresh database.

BEGIN;

CREATE OR REPLACE FUNCTION public.my_onboarding_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact  uuid;
  v_c        contacts%ROWTYPE;
  v_docs     jsonb := '[]'::jsonb;
  v_purchase jsonb;
  v_minor    jsonb;
  v_prefill  jsonb;
  v_needed   boolean := false;
  v_profile  boolean := false;
  v_pid      uuid;
  v_phorse   uuid;
  v_horse_needed boolean := false;
  req        record;
  v_doc      uuid;
  v_status   text;
  v_title    text;
  v_ok       boolean;
  v_contracts jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  PERFORM ensure_my_membership();
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('needed', false, 'profile_complete', false,
                              'documents', '[]'::jsonb, 'purchase', NULL, 'minor', NULL,
                              'horse_needed', false, 'prefill', NULL,
                              'contracts_waiting', '[]'::jsonb);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = v_contact;
  v_profile := contact_profile_complete(v_contact);

  -- Everything the contact record already knows about the person, so the
  -- details form prefills instead of asking again (re-invited members).
  v_prefill := jsonb_build_object(
    'first_name', v_c.first_name, 'last_name', v_c.last_name,
    'phone', v_c.phone,
    'date_of_birth', to_char(v_c.date_of_birth, 'YYYY-MM-DD'),
    'address_street', v_c.address_line1, 'address_city', v_c.city,
    'address_state', v_c.state, 'address_zip', v_c.postal_code,
    'emergency_contact_1_name', v_c.emergency_contact_1_name,
    'emergency_contact_1_relationship', v_c.emergency_contact_1_relationship,
    'emergency_contact_1_phone', v_c.emergency_contact_1_phone,
    'emergency_contact_2_name', v_c.emergency_contact_2_name,
    'emergency_contact_2_relationship', v_c.emergency_contact_2_relationship,
    'emergency_contact_2_phone', v_c.emergency_contact_2_phone,
    'riding_experience_years', v_c.riding_experience_years,
    'jump_experience', v_c.jump_experience,
    'riding_background', v_c.riding_background);

  -- the contact's latest purchase (spine)
  SELECT pu.id, pu.horse_id INTO v_pid, v_phorse
    FROM purchases pu
    WHERE pu.buyer_contact_id = v_contact AND pu.deleted_at IS NULL
    ORDER BY pu.created_at DESC LIMIT 1;
  IF v_pid IS NOT NULL THEN
    SELECT jsonb_build_object(
        'purchase_id', pu.id, 'horse_id', pu.horse_id,
        'tier_label', (SELECT pi.label FROM purchase_items pi WHERE pi.purchase_id = pu.id ORDER BY pi.created_at DESC LIMIT 1),
        'amount', pu.amount, 'lessons_included', NULL, 'cadence', NULL,
        'paid', (pu.payment_status = 'paid'), 'payment_method', pu.payment_method)
      INTO v_purchase
      FROM purchases pu WHERE pu.id = v_pid;

    -- horse intake is needed when this purchase uses the rider's OWN horse and
    -- none is attached yet: any segment='horse' item, or a "(With your horse)"
    -- rider lesson (horse_included = false).
    v_horse_needed := v_phorse IS NULL AND EXISTS (
      SELECT 1 FROM purchase_items pi
      JOIN offerings o ON o.id = pi.offering_id
      WHERE pi.purchase_id = v_pid
        AND (o.segment = 'horse' OR (o.segment = 'rider' AND o.horse_included = false))
    );
  END IF;

  -- The horse step ALSO runs as a review whenever a horse document is required
  -- and not yet satisfied — the member confirms/completes the horse record the
  -- paperwork merges from before signing (staff re-assign, no purchase needed).
  -- Same shared predicate: this used to carry its own inline copy of the rule.
  IF NOT v_horse_needed THEN
    v_horse_needed := EXISTS (
      SELECT 1 FROM contact_required_documents crd
      WHERE crd.contact_id = v_contact
        AND crd.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
        AND crd.skipped_at IS NULL   -- CLOSEOUT §1.6
        AND NOT contact_document_satisfied(v_contact, crd.template_key)
    );
  END IF;

  -- a guardian-linked minor, if any
  SELECT jsonb_build_object('first_name', mc.first_name, 'last_name', mc.last_name,
      'dob', to_char(mc.date_of_birth, 'YYYY-MM-DD'))
    INTO v_minor
    FROM contacts mc
    WHERE mc.guardian_contact_id = v_contact AND mc.deleted_at IS NULL
    ORDER BY mc.created_at LIMIT 1;

  FOR req IN
    SELECT ct.template_key FROM required_templates_for_contact(v_contact) ct
    ORDER BY coalesce((SELECT max(x.onboarding_order) FROM contract_templates x
                       WHERE x.template_key = ct.template_key), 99), ct.template_key
  LOOP
    -- Satisfaction is decided by the shared predicate, NOT by reading a status off
    -- whichever row sorts first. The row lookup below only chooses what to DISPLAY.
    v_ok := contact_document_satisfied(v_contact, req.template_key);

    SELECT d.id, d.status, coalesce(d.title, t.title) INTO v_doc, v_status, v_title
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_contact AND t.template_key = req.template_key
        AND d.deleted_at IS NULL
        -- a superseded executed copy no longer satisfies (staff re-assign):
        -- prefer a live pending/current doc over superseded evidence.
      ORDER BY (d.status = 'EXECUTED' AND coalesce(d.current_status,'') <> 'superseded') DESC,
               (d.status <> 'EXECUTED') DESC,
               d.created_at DESC
      LIMIT 1;

    IF v_ok THEN
      v_status := 'EXECUTED';
    ELSIF v_doc IS NULL THEN
      SELECT title INTO v_title FROM contract_templates WHERE template_key = req.template_key;
      v_status := 'MISSING';
    ELSIF v_status = 'EXECUTED' THEN
      -- executed but not satisfying: superseded evidence, or (once the resign-floor
      -- migration lands) an explicit staff demand for a newer version. Either way
      -- the member must act, so it must NOT read as 'EXECUTED'. The UI treats every
      -- non-EXECUTED status as actionable.
      v_status := 'RESIGN_REQUIRED';
    END IF;

    IF NOT v_ok THEN v_needed := true; END IF;
    v_docs := v_docs || jsonb_build_object(
      'document_id', v_doc, 'template_key', req.template_key,
      'title', v_title, 'status', coalesce(v_status, 'MISSING'));
    v_doc := NULL; v_status := NULL; v_title := NULL; v_ok := NULL;
  END LOOP;

  -- INTAKE 2026-08-24 — AN INCOMPLETE PROFILE IS ITSELF A REASON TO BE HERE.
  -- v_needed was only ever set by the document loop above, so a member with
  -- nothing to sign never saw the intake form and we never learned their mobile
  -- number, date of birth or emergency contact. Since OFFERINGDOCS, having no
  -- documents is the normal state for anyone who has not bought anything.
  IF NOT v_profile THEN v_needed := true; END IF;

  -- ── P1 ITEM 2 — A WAITING CONTRACT IS SOMETHING TO DO ────────────────────
  --
  -- The onboarding surface asked three questions — documents, purchase, standing
  -- slot — and if all three were no, told the member "Nothing to do here." It
  -- never asked whether a CONTRACT was waiting, so a counterparty invited to a
  -- lease and nothing else was told she had nothing to do while her lease sat
  -- unsigned. (CR-64. Same shape as SLOTREACH's fix to the same condition.)
  --
  -- A contract is WAITING when she is a party to a live contract-engine document
  -- she has not signed and has not hidden. Executed, void and terminated
  -- documents are records of something finished and are never waiting.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'document_id', x.id, 'title', x.title,
           'workflow_state', x.workflow_state) ORDER BY x.created_at), '[]'::jsonb)
    INTO v_contracts
    FROM (
      SELECT DISTINCT d.id, d.title, d.workflow_state, d.created_at
        FROM documents d
        JOIN document_parties dp ON dp.document_id = d.id AND dp.contact_id = v_contact
       WHERE d.deleted_at IS NULL
         AND d.contract_id IS NOT NULL
         AND coalesce(d.workflow_state, '') NOT IN ('executed', 'void', 'terminated')
         AND d.voided_at IS NULL
         AND d.terminated_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM signatures s
            WHERE s.document_id = d.id AND s.deleted_at IS NULL
              AND s.signed_at IS NOT NULL AND s.signer_contact_id = v_contact)
         AND NOT EXISTS (
           SELECT 1 FROM document_party_hidden h
            WHERE h.document_id = d.id AND h.contact_id = v_contact)
    ) x;

  RETURN jsonb_build_object('needed', v_needed, 'profile_complete', v_profile,
                            'documents', v_docs, 'purchase', v_purchase, 'minor', v_minor,
                            'horse_needed', v_horse_needed, 'prefill', v_prefill,
                            'contracts_waiting', v_contracts);
END;
$function$

;

COMMIT;
