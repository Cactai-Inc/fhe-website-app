/*
  # Fix — ensure_horse_documents array append bug

  `v_templates := v_templates || 'RELEASE_HORSE_CARE'` resolved as text[] || text
  and Postgres tried to parse the scalar as an array literal ("malformed array
  literal"), so the care-inclusion path (include_care=true / on-file) threw.
  Use array_append. Recreated verbatim otherwise.
*/

CREATE OR REPLACE FUNCTION ensure_horse_documents(
  p_horse_id     uuid,
  p_contract_id  uuid DEFAULT NULL,
  p_include_care boolean DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
BEGIN
  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND org_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;

  -- authorization: staff, or a party to this horse (owner/lessee ledger)
  v_may := has_staff_access()
    OR v_horse.current_owner_contact_id = v_contact
    OR v_horse.lessee_contact_id = v_contact
    OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = p_horse_id AND hr.party_contact_id = v_contact AND hr.active);
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;

  -- the OWNER authorizes horse documents (lessor for a leased horse)
  v_owner := coalesce(v_horse.current_owner_contact_id, v_contact);
  IF v_owner IS NULL THEN RAISE EXCEPTION 'horse has no owner on record to authorize'; END IF;

  -- decide whether the care release is in scope
  IF p_include_care IS TRUE
     OR (p_include_care IS NULL AND owner_has_executed_template(v_owner, 'RELEASE_HORSE_CARE')) THEN
    v_templates := array_append(v_templates, 'RELEASE_HORSE_CARE');
  END IF;

  FOREACH v_tpl IN ARRAY v_templates LOOP
    -- 1) VOID (soft-delete) the wrong copies for this owner+template:
    --    - horse_id NULL  → generated with no horse on file (blank, e.g. Sarah's)
    --    - same horse but the name token is still raw → an old-generator render
    --    A different horse's valid doc is left untouched (docs are per-horse).
    WITH tmpl AS (SELECT id FROM contract_templates WHERE template_key = v_tpl)
    UPDATE documents d
       SET deleted_at = now(), deleted_by = auth.uid()
     WHERE d.contact_id = v_owner
       AND d.template_id = (SELECT id FROM tmpl)
       AND d.deleted_at IS NULL
       AND (d.horse_id IS NULL
            OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    v_voided := v_voided + v_rc;

    -- 2) idempotent: a good (cleanly merged) doc for this exact horse stays
    IF EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_owner AND t.template_key = v_tpl
        AND d.horse_id = p_horse_id AND d.deleted_at IS NULL
        AND d.merged_body NOT LIKE '%{{HORSE.REGISTERED_NAME}}%'
    ) THEN
      CONTINUE;
    END IF;

    -- 3) generate fresh, owner as the signing CLIENT, horse data merged in
    SELECT gd.document_id INTO v_doc FROM generate_document(
      v_owner, v_tpl, p_contract_id, p_horse_id,
      jsonb_build_array(jsonb_build_object(
        'contact_id', v_owner, 'role', 'CLIENT', 'is_signer', true, 'signer_order', 1)),
      'horse'::text) gd;

    UPDATE documents SET status = 'AWAITING_SIGNATURE' WHERE id = v_doc AND status = 'DRAFT';
    v_gen := v_gen || jsonb_build_object('template_key', v_tpl, 'document_id', v_doc);
  END LOOP;

  RETURN jsonb_build_object('owner_contact_id', v_owner, 'generated', v_gen, 'voided', v_voided);
END;
$fn$;
REVOKE ALL ON FUNCTION ensure_horse_documents(uuid, uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION ensure_horse_documents(uuid, uuid, boolean) TO authenticated, service_role;
