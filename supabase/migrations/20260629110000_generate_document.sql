/*
  # FHE CRM — generate_document RPC (migration 18)

  Phase 3, step 1. The merge engine: take an engagement + a contract template,
  resolve every {{TOKEN}} in the template body from the engagement's structured
  data, persist a documents row, and return the merged body.

  Resolution sources (mirrors the template_tokens dictionary, migration 11/16):
    - party namespaces (BUYER/SELLER/CLIENT/OWNER/PARTICIPANT/GUARDIAN/…) →
      engagement_parties.party_role → contacts (full_name/phone/email/address),
      plus engagement_parties.title / .relationship.
    - HORSE.* → engagements.primary_horse_id → horses (breed/color resolved to
      their display_name via the lookup tables).
    - ENG.* → engagements (display_code/service_type/start_date). Intake-derived
      ENG fields (INTENDED_USE/DISCIPLINE/BUDGET) have no source table yet → blank.
    - FHE.* → business_config (legal/signatory/address). brand phone/email not
      modeled yet → blank.
    - DOC.UUID/ID/GENERATED_DATE → the freshly-created documents row + now().
      DOC.EFFECTIVE_DATE is set at execution, not generation → blank.
    - TXN.COMMISSION_RATE/MIN → business_config (rate chosen by the engagement's
      service type). Other TXN.* (price/deposit/delivery) → transactions table,
      not modeled yet → blank (additive upgrade later).
    - {{SIG.*}} (kind='signature') → LEFT IN PLACE; the signing flow fills them.

  Tokens are replaced from the per-template template_tokens rows derived in
  migration 17, so the engine only touches tokens that actually appear in the body.
  A NULL underlying value renders as an empty string (a fillable blank).

  SECURITY INVOKER: the caller's RLS governs — reading the engagement/parties and
  inserting the documents row both happen as the caller (admin/assigned staff).
*/

CREATE OR REPLACE FUNCTION generate_document(
  p_engagement_id uuid,
  p_template_key  text
)
RETURNS TABLE (document_id uuid, merged_body text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_tmpl    contract_templates%ROWTYPE;
  v_eng     engagements%ROWTYPE;
  v_horse   horses%ROWTYPE;
  v_cfg     business_config%ROWTYPE;
  v_breed   text := '';
  v_color   text := '';
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
  v_val     text;
  v_rate    numeric;
  r         record;
  -- party lookup scratch
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text;
BEGIN
  -- 1. template (must exist, be active, and carry a loaded body)
  SELECT * INTO v_tmpl FROM contract_templates
    WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive contract template: %', p_template_key;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;

  -- 2. engagement
  SELECT * INTO v_eng FROM engagements
    WHERE id = p_engagement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown engagement: %', p_engagement_id;
  END IF;

  -- 3. horse (optional) + breed/color labels
  IF v_eng.primary_horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_eng.primary_horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
  END IF;

  -- 4. business config (single row; may be absent → FHE/config tokens blank)
  SELECT * INTO v_cfg FROM business_config LIMIT 1;

  -- 5. create the documents row (merged_body filled below)
  INSERT INTO documents (engagement_id, template_id, title, status)
    VALUES (p_engagement_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  -- 6. merge — replace every non-signature token this template uses
  v_body := v_tmpl.body;
  FOR r IN
    SELECT namespace, field, token
    FROM template_tokens
    WHERE template_id = v_tmpl.id AND kind <> 'signature'
  LOOP
    v_val := '';

    IF r.namespace = 'HORSE' THEN
      v_val := CASE r.field
        WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
        WHEN 'BARN_NAME'           THEN v_horse.barn_name
        WHEN 'BREED'               THEN v_breed
        WHEN 'COLOR'               THEN v_color
        WHEN 'SEX'                 THEN v_horse.sex
        WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
        WHEN 'HEIGHT'              THEN v_horse.height
        WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
        WHEN 'MICROCHIP'           THEN v_horse.microchip_id
        WHEN 'CURRENT_LOCATION'    THEN v_horse.current_location
        ELSE '' END;

    ELSIF r.namespace = 'ENG' THEN
      v_val := CASE r.field
        WHEN 'ID'           THEN v_eng.display_code
        WHEN 'SERVICE_TYPE' THEN v_eng.service_type
        WHEN 'START_DATE'   THEN to_char(v_eng.start_date, 'FMMonth FMDD, YYYY')
        ELSE '' END;  -- INTENDED_USE / DISCIPLINE / BUDGET come from intake (not modeled yet)

    ELSIF r.namespace = 'DOC' THEN
      v_val := CASE r.field
        WHEN 'UUID'           THEN v_doc_id::text
        WHEN 'ID'             THEN v_doc_code
        WHEN 'GENERATED_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        ELSE '' END;  -- EFFECTIVE_DATE set at execution

    ELSIF r.namespace = 'FHE' THEN
      v_val := CASE r.field
        WHEN 'LEGAL_NAME'      THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'  THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE' THEN v_cfg.signatory_title
        WHEN 'ADDRESS'         THEN v_cfg.business_address
        ELSE '' END;  -- brand phone/email not modeled yet

    ELSIF r.namespace = 'TXN' THEN
      -- commission rate/min are config-sourced (by transaction type); the rest
      -- (price/deposit/delivery) come from the transactions table, not modeled yet.
      IF r.field = 'COMMISSION_RATE' THEN
        v_rate := CASE
          WHEN v_eng.service_type ILIKE '%SALE%'  THEN v_cfg.commission_sale_rate
          WHEN v_eng.service_type ILIKE '%LEASE%' THEN v_cfg.commission_lease_rate
          ELSE v_cfg.commission_purchase_rate END;
        v_val := CASE WHEN v_rate IS NULL THEN ''
                      ELSE rtrim(rtrim(to_char(v_rate, 'FM999990.00'), '0'), '.') || '%' END;
      ELSIF r.field = 'COMMISSION_MIN' THEN
        v_val := CASE WHEN v_cfg.commission_min IS NULL THEN ''
                      ELSE '$' || to_char(v_cfg.commission_min, 'FM999999990') END;
      ELSE
        v_val := '';
      END IF;

    ELSE
      -- party namespace → engagement_parties.party_role → contacts
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL;
      SELECT c.full_name, c.phone, c.email, c.address_composed, ep.title, ep.relationship
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re
        FROM engagement_parties ep
        JOIN contacts c ON c.id = ep.contact_id
        WHERE ep.engagement_id = p_engagement_id AND ep.party_role = r.namespace
        ORDER BY ep.signer_order NULLS LAST
        LIMIT 1;
      v_val := CASE r.field
        WHEN 'FULL_NAME'    THEN v_fn
        WHEN 'PRINTED_NAME' THEN v_fn
        WHEN 'PHONE'        THEN v_ph
        WHEN 'EMAIL'        THEN v_em
        WHEN 'ADDRESS'      THEN v_ad
        WHEN 'TITLE'        THEN v_ti
        WHEN 'RELATIONSHIP' THEN v_re
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;

  -- 7. persist the merged body and return it
  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$fn$;

COMMENT ON FUNCTION generate_document(uuid, text) IS
  'Phase 3 merge engine: resolves a contract template''s {{tokens}} from an engagement''s data, persists a documents row, returns the merged body. {{SIG.*}} left for signing.';
