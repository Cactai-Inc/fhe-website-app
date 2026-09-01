-- generate_document now fills HORSE.HOME_LOCATION and resolves CURRENT_LOCATION
-- from the locations entity (home_location_id / current_location_id), falling back
-- to the legacy current_location text.

CREATE OR REPLACE FUNCTION public.generate_document(p_contact_id uuid, p_template_key text, p_contract_id uuid, p_horse_id uuid, p_parties jsonb, p_service_type text)
 RETURNS TABLE(document_id uuid, merged_body text)
 LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
DECLARE
  v_tmpl    contract_templates%ROWTYPE;
  v_org_id  uuid;
  v_ctr     contracts%ROWTYPE;
  v_has_ctr boolean := false;
  v_horse   horses%ROWTYPE;
  v_cfg     business_config%ROWTYPE;
  v_breed   text := '';
  v_color   text := '';
  v_home_loc text := '';
  v_curr_loc text := '';
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
  v_val     text;
  v_org     text;
  v_rate    numeric;
  v_dir     jsonb := '{}'::jsonb;
  r         record;
  m         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text; v_db text;
  v_ec1n text; v_ec1r text; v_ec1p text; v_ec2n text; v_ec2r text; v_ec2p text;
  v_ry text; v_jx text; v_rb text; v_jl text;
  v_c_phone text; v_c_email text; v_c_url text;
  v_has_minor boolean := false;
  v_is_jumper boolean := false;
  v_svc text;
BEGIN
  SELECT * INTO v_tmpl FROM contract_templates
    WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive contract template: %', p_template_key;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;

  -- org from the CONTACT (was: the engagement). Explicit, not RLS-accidental.
  SELECT org_id INTO v_org_id FROM contacts WHERE id = p_contact_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'unknown contact: %', p_contact_id;
  END IF;

  IF p_contract_id IS NOT NULL THEN
    SELECT * INTO v_ctr FROM contracts WHERE id = p_contract_id AND deleted_at IS NULL;
    v_has_ctr := FOUND;
  END IF;

  v_svc := coalesce(p_service_type, v_ctr.segment);

  IF p_horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = p_horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
    v_home_loc := coalesce((SELECT name FROM locations WHERE id = v_horse.home_location_id), '');
    v_curr_loc := coalesce((SELECT name FROM locations WHERE id = v_horse.current_location_id), '');
  END IF;

  SELECT * INTO v_cfg FROM business_config WHERE org_id = v_org_id;
  SELECT value_text INTO v_c_phone FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'PHONE';
  SELECT value_text INTO v_c_email FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'EMAIL';
  SELECT value_text INTO v_c_url   FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'URL';

  -- DIRECTIONAL TERMINOLOGY â from the contract now (deal_side/retained_by in
  -- contract.terms), was engagement_stages. No contract â no overrides.
  IF v_has_ctr THEN
    SELECT COALESCE(tv.token_overrides, '{}'::jsonb) INTO v_dir
      FROM template_variants tv
      WHERE tv.template_key = p_template_key
        AND tv.retained_by  = (v_ctr.terms ->> 'retained_by')
        AND tv.deal_side    = (v_ctr.terms ->> 'deal_side')
        AND tv.active
      LIMIT 1;
  END IF;
  v_dir := COALESCE(v_dir, '{}'::jsonb);

  INSERT INTO documents (org_id, contact_id, contract_id, horse_id, template_id, title, status)
    VALUES (v_org_id, p_contact_id, p_contract_id, p_horse_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  -- seed the document's parties (was engagement_parties). Person + SIG tokens and
  -- signing authz all resolve from document_parties keyed by this document.
  IF p_parties IS NOT NULL THEN
    INSERT INTO document_parties (document_id, contact_id, party_role, relationship, title, is_signer, signer_order, org_id)
    SELECT v_doc_id,
           (e ->> 'contact_id')::uuid,
           e ->> 'role',
           e ->> 'relationship',
           e ->> 'title',
           COALESCE((e ->> 'is_signer')::boolean, false),
           (e ->> 'signer_order')::int,
           v_org_id
      FROM jsonb_array_elements(p_parties) e
    ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;
  END IF;

  v_body := v_tmpl.body;

  v_has_minor := EXISTS (
    SELECT 1 FROM document_parties WHERE document_id = v_doc_id AND party_role = 'PARTICIPANT');
  v_is_jumper := v_svc = 'JUMPER_TRAINING';
  FOR m IN
    SELECT DISTINCT (regexp_matches(v_body, '<!-- CUT-START: ([A-Z_]+)', 'g'))[1] AS name
  LOOP
    IF m.name IN ('EVALUATION_PERIOD','PARTIAL_LEASE','INSURANCE',
                  'MORTALITY_INSURANCE','MAJOR_MEDICAL_INSURANCE',
                  'LOSS_OF_USE_INSURANCE','COMPETITION') THEN
      CONTINUE;
    END IF;
    IF (m.name LIKE 'MINOR%' AND v_has_minor)
       OR (m.name LIKE 'JUMPER%' AND v_is_jumper) THEN
      v_body := regexp_replace(
        v_body, '[ \t]*<!-- CUT-(START|END): ' || m.name || '[^>]*-->\n?', '', 'g');
    ELSE
      v_body := regexp_replace(
        v_body,
        '\n?[ \t]*<!-- CUT-START: ' || m.name || '[^>]*-->.*<!-- CUT-END: ' || m.name || ' -->\n?',
        E'\n', 'g');
    END IF;
  END LOOP;

  FOR r IN
    SELECT namespace, field, token FROM template_tokens
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
        WHEN 'CURRENT_LOCATION'    THEN coalesce(nullif(v_curr_loc,''), v_horse.current_location)
        WHEN 'HOME_LOCATION'       THEN v_home_loc
        WHEN 'VET_NAME'            THEN v_horse.vet_name
        WHEN 'VET_PHONE'           THEN v_horse.vet_phone
        WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
        WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
        WHEN 'FAIR_MARKET_VALUE'   THEN fmt_money(v_horse.fair_market_value)
        WHEN 'MEDICATION_NAME'         THEN v_horse.medication_name
        WHEN 'MEDICATION_DOSAGE'       THEN v_horse.medication_dosage
        WHEN 'MEDICATION_INSTRUCTIONS' THEN v_horse.medication_instructions
        WHEN 'MEDICATION_ADDITIONAL'   THEN v_horse.medication_additional
        WHEN 'KNOWN_CONDITIONS'        THEN v_horse.known_conditions
        WHEN 'EUTHANASIA_A' THEN CASE WHEN v_horse.euthanasia_authorization = 'A' THEN 'X' ELSE ' ' END
        WHEN 'EUTHANASIA_B' THEN CASE WHEN v_horse.euthanasia_authorization = 'B' THEN 'X' ELSE ' ' END
        ELSE '' END;

    ELSIF r.namespace = 'ENG' THEN
      -- ENG.ID/SERVICE_TYPE/START_DATE are used by ZERO live templates; map what
      -- exists onto the contract, blank otherwise.
      v_val := CASE r.field
        WHEN 'ID'           THEN v_ctr.display_code
        WHEN 'SERVICE_TYPE' THEN v_svc
        WHEN 'START_DATE'   THEN to_char(v_ctr.effective_date, 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DOC' THEN
      v_val := CASE r.field
        WHEN 'UUID'           THEN v_doc_id::text
        WHEN 'ID'             THEN v_doc_code
        WHEN 'GENERATED_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        WHEN 'EFFECTIVE_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'ORD' THEN
      IF r.field = 'SERVICE_SELECTION' THEN
        SELECT pi.label INTO v_val FROM purchase_items pi
          JOIN purchases pu ON pu.id = pi.purchase_id
          WHERE pu.contract_id = p_contract_id
          ORDER BY pi.created_at DESC LIMIT 1;
      ELSE
        v_val := CASE r.field
          WHEN 'UUID' THEN v_doc_id::text
          WHEN 'ID'   THEN v_doc_code
          ELSE '' END;
      END IF;

    ELSIF r.namespace = 'REQ' THEN
      v_val := '';

    ELSIF r.namespace = 'DIR' THEN
      v_val := v_dir ->> r.field;

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
      v_org := CASE r.field
        WHEN 'LEGAL_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'   THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE'  THEN v_cfg.signatory_title
        WHEN 'ADDRESS'          THEN v_cfg.business_address
        WHEN 'BRAND_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'ENTITY_FORMATION' THEN v_cfg.entity_formation
        WHEN 'REGISTERED_AGENT' THEN v_cfg.registered_agent
        WHEN 'CANCELLATION_FEE' THEN fmt_money(v_cfg.cancellation_fee)
        WHEN 'LATE_FEE'         THEN fmt_money(v_cfg.late_fee)
        WHEN 'NO_SHOW_FEE'      THEN fmt_money(v_cfg.no_show_fee)
        WHEN 'PHONE'            THEN v_c_phone
        WHEN 'EMAIL'            THEN v_c_email
        WHEN 'URL'              THEN v_c_url
        ELSE NULL END;
      IF v_org IS NULL THEN
        SELECT coalesce(cv.value_text, cv.value_num::text, cv.value_json #>> '{}')
          INTO v_org FROM config_values cv
          WHERE cv.org_id = v_org_id AND cv.namespace = 'ORG' AND cv.key = r.field;
      END IF;
      v_val := v_org;

    ELSIF r.namespace = 'TXN' THEN
      -- commission from config; deal money is filled by remerge from contract_fields.
      IF r.field = 'COMMISSION_RATE' THEN
        v_rate := CASE
          WHEN v_svc ILIKE '%SALE%'  THEN v_cfg.commission_sale_rate
          WHEN v_svc ILIKE '%LEASE%' THEN v_cfg.commission_lease_rate
          ELSE v_cfg.commission_purchase_rate END;
        v_val := CASE WHEN v_rate IS NULL THEN ''
                      ELSE rtrim(rtrim(to_char(v_rate, 'FM999990.00'), '0'), '.') || '%' END;
      ELSIF r.field = 'COMMISSION_MIN' THEN
        v_val := fmt_money(v_cfg.commission_min);
      ELSE
        v_val := '';
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL; v_db := NULL;
      v_ec1n := NULL; v_ec1r := NULL; v_ec1p := NULL; v_ec2n := NULL; v_ec2r := NULL; v_ec2p := NULL;
      v_ry := NULL; v_jx := NULL; v_rb := NULL; v_jl := NULL;
      SELECT NULLIF(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
             c.phone, c.email, c.address_composed, dp.title, dp.relationship,
             CASE WHEN c.date_of_birth IS NULL THEN NULL
                  ELSE to_char(c.date_of_birth, 'FMMonth FMDD, YYYY') END,
             c.emergency_contact_1_name, c.emergency_contact_1_relationship, c.emergency_contact_1_phone,
             c.emergency_contact_2_name, c.emergency_contact_2_relationship, c.emergency_contact_2_phone,
             c.riding_experience_years, c.jump_experience, c.riding_background, c.jump_limitations
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re, v_db,
             v_ec1n, v_ec1r, v_ec1p, v_ec2n, v_ec2r, v_ec2p,
             v_ry, v_jx, v_rb, v_jl
        FROM document_parties dp
        JOIN contacts c ON c.id = dp.contact_id
        WHERE dp.document_id = v_doc_id AND dp.party_role = r.namespace
        ORDER BY dp.signer_order NULLS LAST
        LIMIT 1;
      v_val := CASE r.field
        WHEN 'FULL_NAME'    THEN v_fn
        WHEN 'PRINTED_NAME' THEN v_fn
        WHEN 'PHONE'        THEN v_ph
        WHEN 'EMAIL'        THEN v_em
        WHEN 'ADDRESS'      THEN v_ad
        WHEN 'TITLE'        THEN v_ti
        WHEN 'RELATIONSHIP' THEN v_re
        WHEN 'DOB'          THEN v_db
        WHEN 'EMERGENCY_CONTACT_1_NAME'         THEN v_ec1n
        WHEN 'EMERGENCY_CONTACT_1_RELATIONSHIP' THEN v_ec1r
        WHEN 'EMERGENCY_CONTACT_1_PHONE'        THEN v_ec1p
        WHEN 'EMERGENCY_CONTACT_2_NAME'         THEN v_ec2n
        WHEN 'EMERGENCY_CONTACT_2_RELATIONSHIP' THEN v_ec2r
        WHEN 'EMERGENCY_CONTACT_2_PHONE'        THEN v_ec2p
        WHEN 'RIDING_EXPERIENCE_YEARS'          THEN v_ry
        WHEN 'JUMP_EXPERIENCE'                  THEN v_jx
        WHEN 'RIDING_BACKGROUND'                THEN v_rb
        WHEN 'JUMP_LIMITATIONS'                 THEN v_jl
        WHEN 'HORSE_CAPACITY' THEN CASE
          WHEN v_horse.current_owner_contact_id IS NULL THEN 'owns, leases, manages, or otherwise has authority over'
          WHEN (SELECT dp2.contact_id FROM document_parties dp2 WHERE dp2.document_id = v_doc_id AND dp2.party_role = r.namespace ORDER BY dp2.signer_order NULLS LAST LIMIT 1) = v_horse.current_owner_contact_id THEN 'owns'
          WHEN (SELECT dp2.contact_id FROM document_parties dp2 WHERE dp2.document_id = v_doc_id AND dp2.party_role = r.namespace ORDER BY dp2.signer_order NULLS LAST LIMIT 1) = v_horse.lessee_contact_id THEN 'leases'
          ELSE 'is an authorized agent of' END
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$function$;
