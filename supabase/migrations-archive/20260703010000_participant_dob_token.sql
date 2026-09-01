/*
  # {{PARTY.DOB}} token (owner 2026-07-02): the minor's birthday merges by token

  The minor's DOB previously merged via a literal text-replace on the
  'Date of Birth:' line — fragile and untokenized. Now:
  - global dictionary gains PARTY.DOB (party-scoped, contacts.date_of_birth);
  - generate_document's party arm resolves {{X.DOB}};
  - sign_release stores the submitted minor DOB on the minor's contact row
    (insert + heal), so the token resolves on the merged document.
  The legacy text-replace remains as fallback for un-migrated template text.
*/

INSERT INTO template_tokens (namespace, field, token, kind, source_table, source_column, computed, required, party_scoped, notes)
VALUES ('PARTY','DOB','{{PARTY.DOB}}','field','contacts','date_of_birth', false, false, true,
        'party date of birth — used by the minor section of the releases')
ON CONFLICT DO NOTHING;

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
  v_txn     transactions%ROWTYPE;
  v_has_txn boolean := false;
  v_breed   text := '';
  v_color   text := '';
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
  v_val     text;
  v_org     text;   -- shared {{ORG.*}}/{{FHE.*}} resolution (aliases)
  v_rate    numeric;
  v_dir     jsonb := '{}'::jsonb;  -- directional token_overrides (v6)
  r         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text; v_db text;
  v_c_phone text; v_c_email text; v_c_url text;
BEGIN
  SELECT * INTO v_tmpl FROM contract_templates
    WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive contract template: %', p_template_key;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;

  SELECT * INTO v_eng FROM engagements WHERE id = p_engagement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown engagement: %', p_engagement_id;
  END IF;

  IF v_eng.primary_horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_eng.primary_horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
  END IF;

  -- config — scope to the ENGAGEMENT'S org (v_eng already loaded above). Explicit,
  -- not RLS-accidental: correct for authenticated AND service_role/BYPASSRLS callers
  -- (current_org() would follow the session GUC, not the target engagement's tenant).
  SELECT * INTO v_cfg FROM business_config WHERE org_id = v_eng.org_id;

  -- public contact (phone/email/url) live in config_values ns CONTACT, resolved for
  -- the engagement's tenant. business_config has NO phone/email/url column.
  SELECT value_text INTO v_c_phone FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'PHONE';
  SELECT value_text INTO v_c_email FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'EMAIL';
  SELECT value_text INTO v_c_url FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'URL';

  -- the engagement's financial record (latest), if any
  SELECT * INTO v_txn FROM transactions
    WHERE engagement_id = p_engagement_id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  v_has_txn := FOUND;

  -- DIRECTIONAL TERMINOLOGY (v6, CONTRACT_MODULE_ARCHITECTURE Layer 1): the
  -- engagement's CURRENT stage (latest live engagement_stages row) carries
  -- retained_by + deal_side; template_variants maps (template_key, retained_by,
  -- deal_side) → token_overrides. No stage or no variant row → v_dir stays '{}'
  -- and every {{DIR.*}} merges blank (missing-source posture).
  SELECT COALESCE(tv.token_overrides, '{}'::jsonb) INTO v_dir
    FROM engagement_stages es
    LEFT JOIN template_variants tv
      ON tv.template_key = p_template_key
     AND tv.retained_by  = es.retained_by
     AND tv.deal_side    = es.deal_side
     AND tv.active
    WHERE es.engagement_id = p_engagement_id AND es.deleted_at IS NULL
    ORDER BY es.effective_from DESC, es.created_at DESC
    LIMIT 1;
  v_dir := COALESCE(v_dir, '{}'::jsonb);

  INSERT INTO documents (engagement_id, template_id, title, status)
    VALUES (p_engagement_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  v_body := v_tmpl.body;
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
        WHEN 'CURRENT_LOCATION'    THEN v_horse.current_location
        WHEN 'VET_NAME'            THEN v_horse.vet_name
        WHEN 'VET_PHONE'           THEN v_horse.vet_phone
        WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
        WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
        ELSE '' END;

    ELSIF r.namespace = 'ENG' THEN
      v_val := CASE r.field
        WHEN 'ID'           THEN v_eng.display_code
        WHEN 'SERVICE_TYPE' THEN v_eng.service_type
        WHEN 'START_DATE'   THEN to_char(v_eng.start_date, 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DOC' THEN
      v_val := CASE r.field
        WHEN 'UUID'           THEN v_doc_id::text
        WHEN 'ID'             THEN v_doc_code
        WHEN 'GENERATED_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DIR' THEN
      -- directional terminology from the current stage's variant (v6)
      v_val := v_dir ->> r.field;

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
      -- {{FHE.*}} is a literal alias of {{ORG.*}}: identical resolution from the
      -- SAME per-engagement v_cfg (typed) + config_values ns CONTACT for PHONE/
      -- EMAIL/URL (business_config has no such column) — section 6.2.
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
      -- GENERIC EAV FALLBACK (v5): any ORG.* field with no typed resolution reads
      -- config_values ns ORG for the ENGAGEMENT's org. Deliberately NOT config_value()
      -- — that seam is current_org()-scoped, which is the WRONG tenant for
      -- service_role/BYPASSRLS callers (value_registry.sql §config_value). This makes
      -- future ORG.* tokens (LEGAL_IDENTITY, INVOICE_DUE_DAYS, CANCELLATION_NOTICE_
      -- HOURS, TERMINATION_NOTICE_DAYS, …) seed-only: no resolver migration needed.
      IF v_org IS NULL THEN
        SELECT coalesce(cv.value_text, cv.value_num::text, cv.value_json #>> '{}')
          INTO v_org
          FROM config_values cv
          WHERE cv.org_id = v_eng.org_id AND cv.namespace = 'ORG' AND cv.key = r.field;
      END IF;
      v_val := v_org;

    ELSIF r.namespace = 'TXN' THEN
      IF r.field = 'COMMISSION_RATE' THEN
        v_rate := CASE
          WHEN v_eng.service_type ILIKE '%SALE%'  THEN v_cfg.commission_sale_rate
          WHEN v_eng.service_type ILIKE '%LEASE%' THEN v_cfg.commission_lease_rate
          ELSE v_cfg.commission_purchase_rate END;
        v_val := CASE WHEN v_rate IS NULL THEN ''
                      ELSE rtrim(rtrim(to_char(v_rate, 'FM999990.00'), '0'), '.') || '%' END;
      ELSIF r.field = 'COMMISSION_MIN' THEN
        v_val := fmt_money(v_cfg.commission_min);
      ELSIF v_has_txn THEN
        v_val := CASE r.field
          WHEN 'PURCHASE_PRICE'    THEN fmt_money(v_txn.amount)
          WHEN 'DEPOSIT_AMOUNT'    THEN fmt_money(v_txn.deposit_amount)
          WHEN 'DEPOSIT_TERMS'     THEN v_txn.deposit_terms
          WHEN 'BALANCE_DUE'       THEN CASE WHEN v_txn.amount IS NULL THEN ''
                                        ELSE fmt_money(v_txn.amount - COALESCE(v_txn.deposit_amount, 0)) END
          WHEN 'PAYMENT_TERMS'     THEN v_txn.payment_terms
          WHEN 'PAYMENT_SCHEDULE'  THEN v_txn.payment_schedule
          WHEN 'LEASE_TERM'        THEN v_txn.lease_term
          WHEN 'LEASE_FEE'         THEN fmt_money(v_txn.lease_fee)
          WHEN 'TRIAL_PERIOD'      THEN v_txn.trial_period
          WHEN 'DELIVERY_DATE'     THEN to_char(v_txn.delivery_date, 'FMMonth FMDD, YYYY')
          WHEN 'DELIVERY_LOCATION' THEN v_txn.delivery_location
          WHEN 'RETAINER_FEE'      THEN fmt_money(v_txn.retainer_fee)
          WHEN 'SERVICE_FEE'       THEN fmt_money(v_txn.service_fee)
          WHEN 'SUCCESS_FEE'       THEN fmt_money(v_txn.success_fee)
          WHEN 'EVALUATION_FEE'    THEN fmt_money(v_txn.evaluation_fee)
          WHEN 'REPRESENTATION_FEE' THEN fmt_money(v_txn.representation_fee)
          ELSE '' END;
      ELSE
        v_val := '';  -- no transaction yet → blank
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL; v_db := NULL;
      -- v7: the OFFICIAL name is first_name || ' ' || last_name (single space,
      -- trimmed when a part is missing) — contacts.full_name no longer exists.
      SELECT NULLIF(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
             c.phone, c.email, c.address_composed, ep.title, ep.relationship,
             CASE WHEN c.date_of_birth IS NULL THEN NULL
                  ELSE to_char(c.date_of_birth, 'FMMonth FMDD, YYYY') END
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re, v_db
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
        WHEN 'DOB'          THEN v_db
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$fn$;

CREATE OR REPLACE FUNCTION sign_release(
  p_template_key          text,
  p_first_name            text,
  p_last_name             text,
  p_email                 text,
  p_phone                 text,
  p_typed_name            text,
  p_is_minor              boolean DEFAULT false,
  p_minor_first_name      text    DEFAULT NULL,
  p_minor_last_name       text    DEFAULT NULL,
  p_minor_dob             date    DEFAULT NULL,
  p_guardian_relationship text    DEFAULT NULL,
  p_rules_acknowledged    boolean DEFAULT false,
  p_org                   uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_first     text := trim(coalesce(p_first_name, ''));
  v_last      text := trim(coalesce(p_last_name, ''));
  v_name      text;   -- OFFICIAL signer name: first + ' ' + last (trimmed)
  v_typed     text := trim(coalesce(p_typed_name, ''));
  v_email     text := lower(trim(coalesce(p_email, '')));
  v_phone     text := trim(coalesce(p_phone, ''));
  v_minor_first text := trim(coalesce(p_minor_first_name, ''));
  v_minor_last  text := trim(coalesce(p_minor_last_name, ''));
  v_minor     text;   -- OFFICIAL minor name: first + ' ' + last (trimmed)
  v_rel       text := trim(coalesce(p_guardian_relationship, ''));
  v_org       uuid;
  v_contact   uuid;   -- the SIGNER's contact (adult participant, or guardian)
  v_minor_c   uuid;   -- the minor's contact (minor path)
  v_client    uuid;
  v_eng       uuid;
  v_doc       uuid;
  v_doc_code  text;
  v_body      text;
  v_role      text;   -- the signing party_role: PARTICIPANT or GUARDIAN
  v_adult_pos integer;
  v_minor_pos integer;
  v_today     text := to_char(current_date, 'FMMonth DD, YYYY');
  v_need      integer;
  v_have      integer;
  v_status    text;
BEGIN
  v_name  := trim(v_first || ' ' || v_last);
  v_minor := trim(v_minor_first || ' ' || v_minor_last);

  -- ---- validation (this RPC is the whole anon mutation surface — fail loudly) ----
  IF p_template_key NOT IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                            'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE') THEN
    RAISE EXCEPTION 'unknown release template: %', p_template_key;
  END IF;
  IF NOT coalesce(p_rules_acknowledged, false) THEN
    RAISE EXCEPTION 'the facility rules must be acknowledged before signing';
  END IF;
  IF v_first = '' THEN
    RAISE EXCEPTION 'a first name is required';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'a name is required (2-200 characters)';
  END IF;
  IF v_typed = '' OR lower(v_typed) <> lower(v_name) THEN
    RAISE EXCEPTION 'typed signature must match the full name exactly';
  END IF;
  IF v_email = '' THEN v_email := NULL; END IF;
  IF v_phone = '' THEN v_phone := NULL; END IF;
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'an email address or phone number is required';
  END IF;
  IF v_email IS NOT NULL AND (
       length(v_email) > 320
       OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'invalid email address';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^[0-9+().\- ]{7,25}$' THEN
    RAISE EXCEPTION 'invalid phone number';
  END IF;
  IF coalesce(p_is_minor, false) THEN
    IF v_minor_first = '' THEN
      RAISE EXCEPTION 'the minor''s first name is required';
    END IF;
    IF length(v_minor) < 2 OR length(v_minor) > 200 THEN
      RAISE EXCEPTION 'the minor''s name is required (2-200 characters)';
    END IF;
    IF p_minor_dob IS NULL OR p_minor_dob >= current_date THEN
      RAISE EXCEPTION 'a valid date of birth for the minor is required';
    END IF;
    IF p_minor_dob + interval '18 years' <= current_date THEN
      RAISE EXCEPTION 'the named person is not a minor (18 or older); sign the adult release';
    END IF;
    IF length(v_rel) < 2 OR length(v_rel) > 100 THEN
      RAISE EXCEPTION 'the guardian''s relationship to the minor is required (2-100 characters)';
    END IF;
  END IF;

  -- ---- org resolution + transaction-local tenant pin (see 20260702020000) ----
  v_org := coalesce(p_org, current_org(), current_addressed_org(), sole_org());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization addressed (multi-tenant deployments must address a tenant)';
  END IF;
  PERFORM 1 FROM organizations WHERE id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown organization: %', v_org;
  END IF;
  PERFORM set_config('app.current_org', v_org::text, true);

  -- ---- find-or-create the SIGNER's contact (per-org email match) ----
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_contact FROM contacts
      WHERE org_id = v_org AND lower(email) = v_email AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email, phone)
      VALUES (v_org, v_first, NULLIF(v_last, ''), v_email, v_phone)
      RETURNING id INTO v_contact;
  ELSE
    -- Heal placeholder identity on the found contact: profile-triggered contacts
    -- are born with first_name = email (no legal name), which then leaked into
    -- the document's Printed Name (owner-reported). The signer's submitted
    -- legal name governs.
    UPDATE contacts
       SET first_name = v_first,
           last_name  = NULLIF(v_last, ''),
           phone      = coalesce(nullif(phone, ''), v_phone)
     WHERE id = v_contact
       AND (
         NULLIF(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') IS NULL
         OR lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(coalesce(email, ''))
       );
  END IF;
  INSERT INTO contact_roles (contact_id, role_type)
    VALUES (v_contact, CASE WHEN coalesce(p_is_minor, false) THEN 'GUARDIAN' ELSE 'PARTICIPANT' END)
    ON CONFLICT (contact_id, role_type) DO NOTHING;

  -- ---- find-or-create the client shell (engagements.client_id NOT NULL) ----
  SELECT id INTO v_client FROM clients
    WHERE contact_id = v_contact AND deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'VISITOR_RELEASE')
      RETURNING id INTO v_client;
  END IF;

  -- ---- the minimal NON-SERVICE engagement (service_type NULL, 20260702020000) ----
  INSERT INTO engagements (org_id, client_id, service_type, status, start_date, notes)
    VALUES (v_org, v_client, NULL, 'AWAITING_SIGNATURE', now()::date,
            format('%s (public release kiosk)', p_template_key))
    RETURNING id INTO v_eng;

  IF coalesce(p_is_minor, false) THEN
    -- Minor path: the minor is the PARTICIPANT party (NOT a signer); the
    -- guardian is the GUARDIAN party and signs. Minor contact find-or-create
    -- by name within the org (minors typically have no contact channel).
    SELECT id INTO v_minor_c FROM contacts
      WHERE org_id = v_org
        AND lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(v_minor)
        AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    IF v_minor_c IS NULL THEN
      INSERT INTO contacts (org_id, first_name, last_name, date_of_birth)
        VALUES (v_org, v_minor_first, NULLIF(v_minor_last, ''), p_minor_dob)
        RETURNING id INTO v_minor_c;
    END IF;
    INSERT INTO contact_roles (contact_id, role_type)
      VALUES (v_minor_c, 'PARTICIPANT')
      ON CONFLICT (contact_id, role_type) DO NOTHING;

    INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order, relationship)
      VALUES (v_org, v_eng, v_minor_c, 'PARTICIPANT', false, NULL, NULL),
             (v_org, v_eng, v_contact, 'GUARDIAN',    true,  1,    v_rel);
    v_role := 'GUARDIAN';
  ELSE
    INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_eng, v_contact, 'PARTICIPANT', true, 1);
    v_role := 'PARTICIPANT';
  END IF;

  -- NO COMPANY party: releases are unilateral (owner decision 2026-07-02).

  -- ---- generate through the REAL merge engine; pin the document's tenant ----
  SELECT gd.document_id, gd.merged_body INTO v_doc, v_body
    FROM generate_document(v_eng, p_template_key) gd;
  UPDATE documents SET org_id = v_org, status = 'AWAITING_SIGNATURE' WHERE id = v_doc;

  -- ---- strip the INAPPLICABLE signer section (adult xor minor, by marker) ----
  v_adult_pos := position('ADULT SIGNER' IN v_body);
  v_minor_pos := position('MINOR SIGNER (PARENT/GUARDIAN)' IN v_body);
  IF v_adult_pos = 0 OR v_minor_pos = 0 OR v_minor_pos <= v_adult_pos THEN
    RAISE EXCEPTION 'template % is missing its signer-section markers', p_template_key;
  END IF;
  IF coalesce(p_is_minor, false) THEN
    -- drop the adult section; keep everything before it + the minor section
    v_body := left(v_body, v_adult_pos - 1) || substring(v_body FROM v_minor_pos);
    -- merge the minor's DOB into the fill-in line (single occurrence by construction)
    v_body := replace(v_body, E'Date of Birth:\n',
                      'Date of Birth: ' || to_char(p_minor_dob, 'FMMonth DD, YYYY') || E'\n');
    -- the guardian's completed signature
    v_body := replace(v_body, '{{SIG.GUARDIAN.NAME}}', v_typed);
    v_body := replace(v_body, '{{SIG.GUARDIAN.DATE}}', v_today);
  ELSE
    -- drop the minor section (it is the last section: no COMPANY block follows)
    v_body := rtrim(left(v_body, v_minor_pos - 1)) || E'\n';
    -- the adult's completed signature
    v_body := replace(v_body, '{{SIG.PARTICIPANT.NAME}}', v_typed);
    v_body := replace(v_body, '{{SIG.PARTICIPANT.DATE}}', v_today);
  END IF;

  -- ---- record the rules acknowledgment ON the executed document ----
  v_body := rtrim(v_body)
    || E'\n\nFACILITY RULES ACKNOWLEDGMENT\n\nSigner acknowledged the Facility Rules and Safety Acknowledgment on '
    || v_today || E'.\n';

  -- ---- the sealed typed signature (signed_at set on insert) ----
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, method)
    VALUES (v_org, v_doc, v_contact, v_role, v_typed, now(), 'KIOSK_TYPED');

  -- ---- executed once EVERY signer party has signed (single signer here) ----
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM engagement_parties WHERE engagement_id = v_eng;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = v_doc AND signed_at IS NOT NULL AND deleted_at IS NULL;
  IF v_need > 0 AND v_have >= v_need THEN
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date WHERE id = v_doc;
    UPDATE engagements SET status = 'ACTIVE' WHERE id = v_eng;
  END IF;

  -- persist the FINAL body (stripped + signed + rules acknowledgment)
  UPDATE documents SET merged_body = v_body WHERE id = v_doc;

  SELECT status, display_code INTO v_status, v_doc_code FROM documents WHERE id = v_doc;

  RETURN jsonb_build_object(
    'document_id',   v_doc,
    'document_code', v_doc_code,
    'engagement_id', v_eng,
    'contact_id',    v_contact,
    'status',        v_status,
    'merged_body',   v_body
  );
END;
$fn$;
