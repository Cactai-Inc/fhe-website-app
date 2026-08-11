-- SENDGUARD §2 — the onboarding document stops churning: the BODY is regenerated
-- in place, the ROW and its id survive.
--
-- ****************************************************************************
-- *** NOT APPLIED. Dry-run only, per the APPLY MODE section of the task doc. ***
-- ****************************************************************************
--
-- THE DEFECT (F2, verified in production 2026-08-09). Every re-entry to
-- onboarding soft-deletes the pending draft and generates a replacement with a
-- NEW id. Sarah's single RELEASE_GENERAL became three documents in six minutes:
--
--   62e9c1f7  DRAFT     created 04:47:25  deleted 04:48:26   signatures ever: 0
--   352ccb89  DRAFT     created 04:48:26  deleted 04:53:52   signatures ever: 0
--   54665d4d  EXECUTED  created 04:53:52  signed  04:54:22   signatures ever: 1
--
-- No signature was lost. The harm is LINK STABILITY: a document id sent in an
-- email points at a deleted row the moment the recipient reloads the page.
--
-- WHY THE DELETE EXISTS — and why "just reuse the row" reintroduces a real bug.
-- The regeneration is deliberate. Onboarding merges profile data (names,
-- addresses, emergency contacts, date of birth) into the document BODY at
-- generation time. A draft created before the member finished step 1 has empty
-- or stale tokens baked into merged_body, and nothing later refreshes them.
-- Deleting and regenerating is how that draft gets correct data. Remove the
-- delete without replacing that mechanism and members sign documents printing an
-- old address.
--
-- THE DISTINCTION IMPLEMENTED HERE: regenerate the BODY in place, keep the ROW.
--
--   1. compose_document_body(document_id, service_type) — the composition half of
--      generate_document, lifted out VERBATIM and pointed at an existing row. It
--      reads the template, contract, horse, party roster and config exactly as
--      before and returns the merged text. It writes nothing.
--
--   2. generate_document — unchanged signature, unchanged behaviour. It still
--      inserts the row, binds the horse set and seeds the parties; it now calls
--      compose_document_body for the text instead of composing inline. Every one
--      of its ten callers is untouched.
--
--   3. regenerate_document_body(document_id, service_type) — recompose an
--      existing row. If the composed body is IDENTICAL, it writes nothing at all
--      and returns false. It REFUSES to touch an EXECUTED document, and refuses
--      to touch a document carrying a live signature (rewriting a body under a
--      signature is the void_signatures_on_edit failure in another form).
--
--   4. generate_my_onboarding_documents — the pending draft is REUSED: parties
--      re-synced, horse binding refreshed, body recomposed in place. The id is
--      stable across re-entry. The delete remains ONLY as the path for a
--      document that cannot be reused.
--
-- THE ONE CASE WHERE AN ID STILL CHANGES: none in the onboarding loop. The
-- delete-and-regenerate branch now runs only when no reusable pending document
-- exists — i.e. when there is nothing to keep an id of. A pending document that
-- carries a live signature is adopted untouched (SENDGUARD §3) and is never
-- recomposed, so a signed body is never rewritten under the signer.
--
-- WHAT THE DRY-RUN PROVES (raw output in the report):
--   a. compose_document_body reproduces generate_document's body BYTE FOR BYTE —
--      regenerate on a freshly generated document reports "no change" and writes
--      nothing.
--   b. Re-entering onboarding returns THE SAME document id.
--   c. Changing a profile field that appears in the body updates the body, and
--      the id still does not change.
--   d. THE REGRESSION THE DELETE EXISTED TO PREVENT: a draft generated before the
--      profile was completed still ends up with correct merged data.
--   e. The unsigned/no-draft path and the §3 signed-document path are unchanged.
--
-- ClauseDocument.tsx is untouched. No renderer change is involved.

BEGIN;

-- ── 1. compose_document_body — generate_document's composition half, verbatim,
--       pointed at an existing row. Reads only; returns the merged text.
CREATE OR REPLACE FUNCTION public.compose_document_body(
  p_document_id uuid, p_service_type text DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
AS $fn$
#variable_conflict use_column
DECLARE
  v_doc     documents%ROWTYPE;
  v_tmpl    contract_templates%ROWTYPE;
  v_org_id  uuid;
  v_ctr     contracts%ROWTYPE;
  v_has_ctr boolean := false;
  v_horse   horses%ROWTYPE;
  v_horse_ids uuid[];
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
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  v_doc_id := v_doc.id;
  v_doc_code := v_doc.display_code;

  SELECT * INTO v_tmpl FROM contract_templates WHERE id = v_doc.template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'document % has no template', p_document_id;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', v_tmpl.template_key;
  END IF;

  SELECT org_id INTO v_org_id FROM contacts WHERE id = v_doc.contact_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'unknown contact: %', v_doc.contact_id;
  END IF;

  IF v_doc.contract_id IS NOT NULL THEN
    SELECT * INTO v_ctr FROM contracts WHERE id = v_doc.contract_id AND deleted_at IS NULL;
    v_has_ctr := FOUND;
  END IF;

  v_svc := coalesce(p_service_type, v_ctr.segment);

  IF v_doc.horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_doc.horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
    v_home_loc := coalesce(location_full_label(v_horse.home_location_id), '');
    v_curr_loc := coalesce(location_full_label(v_horse.current_location_id), '');
  END IF;

  SELECT * INTO v_cfg FROM business_config WHERE org_id = v_org_id;
  SELECT value_text INTO v_c_phone FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'PHONE';
  SELECT value_text INTO v_c_email FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'EMAIL';
  SELECT value_text INTO v_c_url   FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'URL';

  IF v_has_ctr THEN
    SELECT COALESCE(tv.token_overrides, '{}'::jsonb) INTO v_dir
      FROM template_variants tv
      WHERE tv.template_key = v_tmpl.template_key
        AND tv.retained_by  = (v_ctr.terms ->> 'retained_by')
        AND tv.deal_side    = (v_ctr.terms ->> 'deal_side')
        AND tv.active
      LIMIT 1;
  END IF;
  v_dir := COALESCE(v_dir, '{}'::jsonb);

  v_body := v_tmpl.body;

  -- MULTI-HORSE: when this document names more than one horse, expand every
  -- contiguous run of HORSE.*-token lines into one filled copy per horse
  -- BEFORE the token loop. One horse (or none) skips this entirely, so the
  -- single-horse body is byte-for-byte what it has always been.
  v_horse_ids := document_horse_ids(v_doc_id);
  IF coalesce(array_length(v_horse_ids, 1), 0) > 1 THEN
    v_body := expand_horse_blocks(v_body, v_horse_ids);
  END IF;

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
        WHEN 'BARN_NAME'           THEN v_horse.nickname
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
        WHEN 'MARKINGS'            THEN v_horse.markings
        WHEN 'PASSPORT_NUMBER'     THEN v_horse.passport_number
        WHEN 'VET_BUSINESS'        THEN v_horse.vet_business_name
        WHEN 'VET_ADDRESS'         THEN compose_vet_address(v_horse.vet_address_line1, v_horse.vet_city, v_horse.vet_state, v_horse.vet_postal)
        WHEN 'MEDICATION_NAME'         THEN horse_medications_prose(v_horse.id, 'MEDICATION')
        WHEN 'MEDICATION_DOSAGE'       THEN horse_medication_component(v_horse.id, 'DOSAGE')
        WHEN 'MEDICATION_INSTRUCTIONS' THEN horse_medication_component(v_horse.id, 'INSTRUCTIONS')
        WHEN 'MEDICATION_ADDITIONAL'   THEN horse_medication_component(v_horse.id, 'ADDITIONAL')
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
        WHEN 'EFFECTIVE_DATE' THEN to_char(coalesce(
                                 (SELECT d2.effective_date FROM documents d2 WHERE d2.id = v_doc_id),
                                 (SELECT d2.created_at::date FROM documents d2 WHERE d2.id = v_doc_id),
                                 now()::date), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'ORD' THEN
      IF r.field = 'SERVICE_SELECTION' THEN
        SELECT pi.label INTO v_val FROM purchase_items pi
          JOIN purchases pu ON pu.id = pi.purchase_id
          WHERE pu.contract_id = v_doc.contract_id
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


  RETURN v_body;
END;
$fn$;

-- ── 2. generate_document — same signature, same behaviour. It still inserts the
--       row, binds the horse set and seeds the parties; the text now comes from
--       compose_document_body instead of being composed inline. Ten callers
--       untouched.
CREATE OR REPLACE FUNCTION public.generate_document(p_contact_id uuid, p_template_key text, p_contract_id uuid, p_horse_id uuid, p_parties jsonb, p_service_type text, p_horse_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(document_id uuid, merged_body text)
 LANGUAGE plpgsql
AS $fn$
#variable_conflict use_column
DECLARE
  v_tmpl    contract_templates%ROWTYPE;
  v_org_id  uuid;
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
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

  INSERT INTO documents (org_id, contact_id, contract_id, horse_id, template_id, title, status)
    VALUES (v_org_id, p_contact_id, p_contract_id, p_horse_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  -- MULTI-HORSE: bind the full ordered set NOW, before the body is composed,
  -- so the expander sees every horse on this one pass. One id (or none)
  -- changes nothing — the single-horse path is untouched.
  IF coalesce(array_length(p_horse_ids, 1), 0) > 1 THEN
    DELETE FROM document_horses WHERE document_id = v_doc_id;
    INSERT INTO document_horses (org_id, document_id, horse_id, position)
      SELECT v_org_id, v_doc_id, p_horse_ids[i], i
        FROM generate_subscripts(p_horse_ids, 1) AS i
      ON CONFLICT (document_id, horse_id) DO UPDATE SET position = EXCLUDED.position;
  END IF;

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

  v_body := compose_document_body(v_doc_id, p_service_type);

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$fn$;

-- ── 3. regenerate_document_body — recompose an existing row IN PLACE. Writes
--       nothing when the text is unchanged. Never touches an executed document,
--       and never rewrites a body under a live signature.
CREATE OR REPLACE FUNCTION public.regenerate_document_body(
  p_document_id uuid, p_service_type text DEFAULT NULL)
 RETURNS boolean
 LANGUAGE plpgsql
AS $fn$
DECLARE
  v_doc  documents%ROWTYPE;
  v_body text;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  IF v_doc.status = 'EXECUTED' THEN
    RAISE EXCEPTION 'document % is executed and is never rewritten', p_document_id;
  END IF;
  IF EXISTS (SELECT 1 FROM signatures s
              WHERE s.document_id = p_document_id AND s.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'document % carries a signature and is never rewritten', p_document_id;
  END IF;

  v_body := compose_document_body(p_document_id, p_service_type);

  -- Unchanged body → no write at all. Re-entering onboarding without changing
  -- anything must leave no trace.
  IF v_body IS NOT DISTINCT FROM v_doc.merged_body THEN
    RETURN false;
  END IF;

  UPDATE documents SET merged_body = v_body, updated_at = now() WHERE id = p_document_id;
  RETURN true;
END;
$fn$;

-- ── 4. generate_my_onboarding_documents — REUSE the pending draft.
--       The delete-and-regenerate branch survives only for the case where there
--       is no reusable pending document, i.e. nothing whose id could be kept.
DO $mig$
DECLARE
  v_oid oid;
  v_src text;
  v_new text;
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'generate_my_onboarding_documents';
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'SENDGUARD2: generate_my_onboarding_documents not found';
  END IF;
  v_src := pg_get_functiondef(v_oid);

  IF v_src NOT LIKE '%a pending document carrying a LIVE SIGNATURE%' THEN
    RAISE EXCEPTION 'SENDGUARD2: SENDGUARD 3 must be applied first';
  END IF;

  -- declare the one new local the reuse block needs
  v_new := replace(v_src,
    E'  v_keep_horses uuid[];   -- the member''s bound horse set for this template\n',
    E'  v_keep_horses uuid[];   -- the member''s bound horse set for this template\n'
    || E'  v_reuse   uuid;         -- the pending document being reused in place\n');
  IF v_new = v_src THEN
    RAISE EXCEPTION 'SENDGUARD2: declare block not matched; refusing to report a no-op as success';
  END IF;
  v_src := v_new;

  v_new := replace(v_src, '    IF v_doc IS NULL THEN
      -- carry the member''s multi-horse choice across regeneration
      SELECT dh.horses INTO v_keep_horses FROM (
', '    -- SENDGUARD 2: REUSE the pending draft. Regenerating the BODY is what keeps
    -- freshly-entered profile data correct; minting a new ROW is what broke the
    -- link in the email. Do the first, stop doing the second.
    IF v_doc IS NULL THEN
      SELECT d.id INTO v_reuse
        FROM documents d
        JOIN contract_templates t ON t.id = d.template_id
        WHERE d.contact_id = v_contact AND t.template_key = req.template_key
          AND d.deleted_at IS NULL AND d.status <> ''EXECUTED''
          AND NOT EXISTS (SELECT 1 FROM signatures s
                           WHERE s.document_id = d.id AND s.deleted_at IS NULL)
        ORDER BY d.created_at DESC
        LIMIT 1;

      IF v_reuse IS NOT NULL THEN
        -- the roster can have changed since the draft was made (a guardian added
        -- a minor), and the body reads from it, so re-sync BEFORE recomposing.
        INSERT INTO document_parties (document_id, contact_id, party_role, is_signer, org_id)
        SELECT v_reuse, (e ->> ''contact_id'')::uuid, e ->> ''role'',
               COALESCE((e ->> ''is_signer'')::boolean, false),
               (SELECT org_id FROM documents WHERE id = v_reuse)
          FROM jsonb_array_elements(v_parties) e
        ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;

        DELETE FROM document_parties dp
         WHERE dp.document_id = v_reuse
           AND dp.party_role IN (''CLIENT'',''PARTICIPANT'')
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(v_parties) e
              WHERE (e ->> ''contact_id'')::uuid = dp.contact_id
                AND (e ->> ''role'') = dp.party_role);

        -- the horse this paperwork is about, by the same rule as generation:
        -- the member''s bound set wins, else the horse resolved above.
        SELECT array_agg(x.horse_id ORDER BY x.position) INTO v_keep_horses
          FROM document_horses x WHERE x.document_id = v_reuse;
        UPDATE documents
           SET horse_id = coalesce(v_keep_horses[1], v_horse)
         WHERE id = v_reuse
           AND horse_id IS DISTINCT FROM coalesce(v_keep_horses[1], v_horse);

        PERFORM regenerate_document_body(v_reuse, NULL::text);
        SELECT d.id, d.status, d.title INTO v_doc, v_status, v_title
          FROM documents d WHERE d.id = v_reuse;
      END IF;
      v_reuse := NULL;
    END IF;

    IF v_doc IS NULL THEN
      -- carry the member''s multi-horse choice across regeneration
      SELECT dh.horses INTO v_keep_horses FROM (
');
  IF v_new = v_src THEN
    RAISE EXCEPTION 'SENDGUARD2: reuse block not matched; refusing to report a no-op as success';
  END IF;

  EXECUTE v_new;
  RAISE NOTICE 'SENDGUARD2: generate_my_onboarding_documents rewritten';
END
$mig$;

DO $verify$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'generate_my_onboarding_documents';
  IF v_def NOT LIKE '%regenerate_document_body%' THEN
    RAISE EXCEPTION 'SENDGUARD2: the reuse path is not live';
  END IF;
END
$verify$;

COMMIT;
