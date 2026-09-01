/*
  # Release kiosk v2 — rules-preview marker + signer identity heal

  1. FACILITY_RULES restructure (owner 2026-07-02): release-family sections
     stripped to the incorporation clause, identity = trade name only, and the
     counterparty identification block moved into the CLIENT signer area — so
     release_preview's truncation marker moves with it (previews show pure
     rules, no fill-in blanks).
  2. sign_release: a found contact whose full_name is a placeholder (equal to
     its email — the profile-trigger default) is healed with the submitted
     legal name before the merge, so Printed Name renders the person, not the
     email address.
  Both functions re-issued in full (shipped migrations untouched).
*/

CREATE OR REPLACE FUNCTION release_preview(p_template_key text, p_org uuid DEFAULT NULL)
RETURNS TABLE (title text, body text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_org    uuid;
  v_tmpl   record;
  v_cfg    business_config%ROWTYPE;
  v_body   text;
  v_ident  text;
  v_phone  text;
  v_email  text;
  v_url    text;
  v_marker text;
  v_cut    integer;
BEGIN
  -- The kiosk's readable surface: the four releases + the rules-gate document.
  IF p_template_key NOT IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                            'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE',
                            'FACILITY_RULES') THEN
    RAISE EXCEPTION 'unknown release template: %', p_template_key;
  END IF;

  v_org := coalesce(p_org, current_org(), current_addressed_org(), sole_org());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization resolvable for release preview';
  END IF;

  SELECT t.title, t.body INTO v_tmpl
    FROM contract_templates t
   WHERE t.template_key = p_template_key AND t.active AND t.body IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'release template unavailable: %', p_template_key;
  END IF;

  SELECT * INTO v_cfg FROM business_config bc WHERE bc.org_id = v_org;
  SELECT cv.value_text INTO v_ident FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'ORG' AND cv.key = 'LEGAL_IDENTITY';
  SELECT cv.value_text INTO v_phone FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'CONTACT' AND cv.key = 'PHONE';
  SELECT cv.value_text INTO v_email FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'CONTACT' AND cv.key = 'EMAIL';
  SELECT cv.value_text INTO v_url FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'CONTACT' AND cv.key = 'URL';

  v_body := v_tmpl.body;
  -- Truncate BEFORE merging: nothing signature-ish reaches a preview.
  -- Releases share the ADULT SIGNER marker; FACILITY_RULES keeps its own
  -- CLIENT signature block.
  -- FACILITY_RULES' signer area now begins with the counterparty identification
  -- block (moved below the fold so previews show pure rules — owner 2026-07-02).
  v_marker := CASE WHEN p_template_key = 'FACILITY_RULES'
                   THEN E'CLIENT\n\nClient / Participant Name:'
                   ELSE 'ADULT SIGNER' END;
  v_cut := position(v_marker IN v_body);
  IF v_cut > 0 THEN
    v_body := rtrim(left(v_body, v_cut - 1));
  END IF;

  -- Releases identify the business by trade name only (owner 2026-07-02); the
  -- LEGAL_IDENTITY arm stays for non-release documents (FACILITY_RULES).
  v_body := replace(v_body, '{{ORG.LEGAL_IDENTITY}}',  coalesce(v_ident, v_cfg.legal_entity_name, ''));
  v_body := replace(v_body, '{{ORG.LEGAL_NAME}}',      coalesce(v_cfg.legal_entity_name, ''));
  v_body := replace(v_body, '{{ORG.SIGNATORY_NAME}}',  coalesce(v_cfg.signatory_name, ''));
  v_body := replace(v_body, '{{ORG.SIGNATORY_TITLE}}', coalesce(v_cfg.signatory_title, ''));
  v_body := replace(v_body, '{{ORG.ADDRESS}}',         coalesce(v_cfg.business_address, ''));
  v_body := replace(v_body, '{{ORG.PHONE}}',           coalesce(v_phone, ''));
  v_body := replace(v_body, '{{ORG.EMAIL}}',           coalesce(v_email, ''));
  v_body := replace(v_body, '{{ORG.URL}}',             coalesce(v_url, ''));
  v_body := replace(v_body, '{{DOC.EFFECTIVE_DATE}}',  to_char(current_date, 'FMMonth DD, YYYY'));
  v_body := replace(v_body, '{{DOC.GENERATED_DATE}}',  to_char(current_date, 'FMMonth DD, YYYY'));
  -- Any remaining token (HORSE.*, person tokens above the cut, …) becomes a
  -- fill-in line: the signer's details land on the SIGNED document only.
  v_body := regexp_replace(v_body, '\{\{[A-Z0-9_.]+\}\}', '__________', 'g');

  RETURN QUERY SELECT v_tmpl.title, v_body;
END;
$$;

REVOKE ALL ON FUNCTION release_preview(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_preview(text, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION release_preview(text, uuid) IS
  'Public kiosk preview: merges org identity + dates for one of the four RELEASE_* templates (or FACILITY_RULES for the rules gate) and truncates the body before the signature area. Org: p_org -> current_org() -> addressed org -> sole_org().';

-- Back-compat: the original single-release preview delegates to the new fn.
CREATE OR REPLACE FUNCTION general_release_preview(p_org uuid DEFAULT NULL)
RETURNS TABLE (title text, body text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$ SELECT * FROM release_preview('RELEASE_GENERAL', p_org) $$;

REVOKE ALL ON FUNCTION general_release_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION general_release_preview(uuid) TO anon, authenticated;

-- ============================================================
-- 2. sign_release — the kiosk signing RPC for all four releases, adult or
--    minor/guardian path. Generalizes 20260702020000_sign_general_release.
-- ============================================================
CREATE OR REPLACE FUNCTION sign_release(
  p_template_key          text,
  p_full_name             text,
  p_email                 text,
  p_phone                 text,
  p_typed_name            text,
  p_is_minor              boolean DEFAULT false,
  p_minor_name            text    DEFAULT NULL,
  p_minor_dob             date    DEFAULT NULL,
  p_guardian_relationship text    DEFAULT NULL,
  p_rules_acknowledged    boolean DEFAULT false,
  p_org                   uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_name      text := trim(coalesce(p_full_name, ''));
  v_typed     text := trim(coalesce(p_typed_name, ''));
  v_email     text := lower(trim(coalesce(p_email, '')));
  v_phone     text := trim(coalesce(p_phone, ''));
  v_minor     text := trim(coalesce(p_minor_name, ''));
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
  -- ---- validation (this RPC is the whole anon mutation surface — fail loudly) ----
  IF p_template_key NOT IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                            'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE') THEN
    RAISE EXCEPTION 'unknown release template: %', p_template_key;
  END IF;
  IF NOT coalesce(p_rules_acknowledged, false) THEN
    RAISE EXCEPTION 'the facility rules must be acknowledged before signing';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'full name is required (2-200 characters)';
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
    IF length(v_minor) < 2 OR length(v_minor) > 200 THEN
      RAISE EXCEPTION 'the minor''s full name is required (2-200 characters)';
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
    INSERT INTO contacts (org_id, full_name, email, phone)
      VALUES (v_org, v_name, v_email, v_phone)
      RETURNING id INTO v_contact;
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
      WHERE org_id = v_org AND lower(full_name) = lower(v_minor) AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    IF v_minor_c IS NULL THEN
      INSERT INTO contacts (org_id, full_name)
        VALUES (v_org, v_minor)
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

CREATE OR REPLACE FUNCTION sign_release(
  p_template_key          text,
  p_full_name             text,
  p_email                 text,
  p_phone                 text,
  p_typed_name            text,
  p_is_minor              boolean DEFAULT false,
  p_minor_name            text    DEFAULT NULL,
  p_minor_dob             date    DEFAULT NULL,
  p_guardian_relationship text    DEFAULT NULL,
  p_rules_acknowledged    boolean DEFAULT false,
  p_org                   uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_name      text := trim(coalesce(p_full_name, ''));
  v_typed     text := trim(coalesce(p_typed_name, ''));
  v_email     text := lower(trim(coalesce(p_email, '')));
  v_phone     text := trim(coalesce(p_phone, ''));
  v_minor     text := trim(coalesce(p_minor_name, ''));
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
  -- ---- validation (this RPC is the whole anon mutation surface — fail loudly) ----
  IF p_template_key NOT IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                            'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE') THEN
    RAISE EXCEPTION 'unknown release template: %', p_template_key;
  END IF;
  IF NOT coalesce(p_rules_acknowledged, false) THEN
    RAISE EXCEPTION 'the facility rules must be acknowledged before signing';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'full name is required (2-200 characters)';
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
    IF length(v_minor) < 2 OR length(v_minor) > 200 THEN
      RAISE EXCEPTION 'the minor''s full name is required (2-200 characters)';
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
    INSERT INTO contacts (org_id, full_name, email, phone)
      VALUES (v_org, v_name, v_email, v_phone)
      RETURNING id INTO v_contact;
  ELSE
    -- Heal placeholder identity on the found contact: profile-triggered contacts
    -- are born with full_name = email, which then leaked into the document's
    -- Printed Name (owner-reported). The signer's submitted legal name governs.
    UPDATE contacts
       SET full_name = v_name,
           phone     = coalesce(nullif(phone, ''), v_phone)
     WHERE id = v_contact
       AND (full_name IS NULL OR full_name = '' OR lower(full_name) = lower(coalesce(email, '')));
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
      WHERE org_id = v_org AND lower(full_name) = lower(v_minor) AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    IF v_minor_c IS NULL THEN
      INSERT INTO contacts (org_id, full_name)
        VALUES (v_org, v_minor)
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
