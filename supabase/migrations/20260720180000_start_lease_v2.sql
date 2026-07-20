/*
  # start_lease_contract_v2 — clause-model lease creation (Pass II-e / cutover)

  A clean creation function for the new clause-structured lease, seeding fields
  from contract_field_defs (with clause_key + responsibility_kind) and composing
  the body via remerge_contract_from_clauses. It reuses the SAME engine steps as
  the legacy starter — contract + contract_parties rows, generate_document for the
  document shell, attach horse, fill party fields — so the result flows through the
  retained signing/workflow/delivery engine unchanged.

  This does NOT touch the legacy start_lease_contract (still used by the live
  HORSE_LEASE). The app will point at v2 once the UI cutover lands.
*/

-- A real HORSE_LEASE_V2 template row (the clause defs reference this template_key).
INSERT INTO contract_templates (template_key, title, party_namespaces, body, version, active)
VALUES ('HORSE_LEASE_V2', 'Horse Lease Agreement', ARRAY['LESSOR','LESSEE'],
        '(composed from clauses)', 1, true)
ON CONFLICT (template_key) DO UPDATE
  SET title=excluded.title, party_namespaces=excluded.party_namespaces, active=true;


CREATE OR REPLACE FUNCTION public.start_lease_contract_v2(
  p_lessee_contact_id uuid,
  p_lessor_contact_id uuid DEFAULT NULL,
  p_horse_id uuid DEFAULT NULL,
  p_responsible_role text DEFAULT 'LESSEE')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_contract   uuid;
  v_org        uuid;
  v_doc        uuid;
  v_tmpl       uuid;
  v_originator uuid;
  v_n          int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to start a lease contract'; END IF;
  IF p_lessee_contact_id IS NULL THEN RAISE EXCEPTION 'a lessee contact is required'; END IF;

  v_originator := CASE WHEN upper(coalesce(p_responsible_role,'LESSEE')) = 'LESSOR'
                       THEN coalesce(p_lessor_contact_id, p_lessee_contact_id)
                       ELSE p_lessee_contact_id END;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_lessee_contact_id;
  SELECT id INTO v_tmpl FROM contract_templates WHERE template_key = 'HORSE_LEASE_V2';
  IF v_tmpl IS NULL THEN RAISE EXCEPTION 'HORSE_LEASE_V2 template missing'; END IF;

  -- contract + parties (spine model)
  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, v_originator, jsonb_build_object('deal_side','LEASE_IN'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_lessee_contact_id, 'LESSEE', true, 1);
  IF p_lessor_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_lessor_contact_id, 'LESSOR', true, 2);
  END IF;

  -- document shell (same generator the engine uses; body recomposed below)
  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_lessee_contact_id, 'HORSE_LEASE_V2', v_contract, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_contract),
    NULL::text) gd;

  UPDATE documents SET originator_contact_id = v_originator,
                       workflow_state = 'editable', status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  -- seed fields straight from the clause-model defs (clause_key + responsibility_kind carried)
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind)
  SELECT v_org, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on, d.guidance,
         d.required, d.is_optional, d.responsibility, d.sort_order, d.parent_field_key,
         d.responsibility_kind
    FROM contract_field_defs d
   WHERE d.template_key = 'HORSE_LEASE_V2';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- fill horse + party identity fields from records (reuse verified paths)
  IF p_horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);

  -- compose the numbered clause body
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract, 'fields_seeded', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION start_lease_contract_v2(uuid,uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION start_lease_contract_v2(uuid,uuid,uuid,text) TO authenticated, service_role;
