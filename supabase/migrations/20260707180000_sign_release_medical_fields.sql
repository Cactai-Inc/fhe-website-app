/*
  # Participant flow: add medical-auth fields to sign_release + allow HUMAN_EMERGENCY_MEDICAL

  Owner 2026-07-07: the participant kiosk flow (/docs/release-participant) signs a
  sequence ending with HUMAN_EMERGENCY_MEDICAL, which merges DOB, address, and two
  emergency contacts. The contacts columns and the generate_document resolver arms
  for all of these ALREADY EXIST (added in 20260703030000 rider_onboarding). The
  only gaps were in sign_release: it had no params to carry that data onto the
  contact, and its allow-list rejected HUMAN_EMERGENCY_MEDICAL.

  This reissues sign_release (from 20260703140000) with FOUR surgical changes:
    1. Twelve new params (DOB, address parts, two emergency contacts), all TRAILING
       with DEFAULT NULL so every existing positional caller (the frontend
       signRelease, the sign_general_release wrapper) is unaffected.
    2. HUMAN_EMERGENCY_MEDICAL added to the allow-list.
    3. New-contact INSERT also sets the optional medical columns (blank -> NULL).
    4. Found-contact path fills those columns ONLY where currently NULL/empty
       (coalesce) — never clobbering data already on file for a returning signer.

  Every other line is preserved verbatim from 20260703140000: rules-ack gate +
  appended paragraph are still RELEASE_* only (HUMAN_EMERGENCY_MEDICAL is not a
  RELEASE_, so it is not gated by nor stamped with a rules acknowledgment), e-sign
  consent gate, typed-name fence, minor path, unilateral execution, sealed
  signature + attribution, execution hash. No schema change (columns pre-exist);
  no resolver change (arms pre-exist). Forward-only.

  Note: required-vs-optional is enforced in the UI, not here — only first name,
  a name >= 2 chars, matching typed signature, and email-or-phone are hard
  server requirements (unchanged). All new fields are optional; blanks merge
  blank on the document (owner: "skip what they don't have").
*/

-- Drop the prior 14-arg overload FIRST. Adding trailing params creates a NEW
-- overload rather than replacing the old one; leaving both would make PostgREST
-- ambiguous (or silently resolve to the old signature, dropping the medical
-- fields). Dropping guarantees exactly one sign_release. sign_general_release
-- (the wrapper) calls sign_release positionally with 14 args — after this drop
-- it resolves to the new overload, whose args 15-26 default NULL, so the wrapper
-- keeps working unchanged.
DROP FUNCTION IF EXISTS sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid, boolean);

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
  p_org                   uuid    DEFAULT NULL,
  p_esign_consent         boolean DEFAULT false,
  -- 2026-07-07: optional medical-auth fields (participant flow). Trailing +
  -- DEFAULT NULL so existing positional callers are unaffected. Fill-blank on
  -- the contact; never clobber existing data.
  p_dob                   date    DEFAULT NULL,
  p_address_line1         text    DEFAULT NULL,
  p_address_line2         text    DEFAULT NULL,
  p_city                  text    DEFAULT NULL,
  p_state                 text    DEFAULT NULL,
  p_postal_code           text    DEFAULT NULL,
  p_ec1_name              text    DEFAULT NULL,
  p_ec1_relationship      text    DEFAULT NULL,
  p_ec1_phone             text    DEFAULT NULL,
  p_ec2_name              text    DEFAULT NULL,
  p_ec2_relationship      text    DEFAULT NULL,
  p_ec2_phone             text    DEFAULT NULL
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
  v_contact   uuid;   -- the SIGNER's contact (the adult, or the parent/guardian)
  v_minor_c   uuid;   -- the minor's contact (minor path)
  v_client    uuid;
  v_eng       uuid;
  v_doc       uuid;
  v_doc_code  text;
  v_body      text;
  v_today     text := to_char(current_date, 'FMMonth FMDD, YYYY');
  v_need      integer;
  v_have      integer;
  v_status    text;
  v_ip        text;
  v_ua        text;
  v_signed_at timestamptz;
  v_hash      text;
  v_is_release boolean;  -- true only for RELEASE_* templates (gates rules-ack + appended paragraph)
BEGIN
  v_name  := trim(v_first || ' ' || v_last);
  v_minor := trim(v_minor_first || ' ' || v_minor_last);

  -- ---- validation (this RPC is the whole anon mutation surface — fail loudly) ----
  -- 2026-07-07: FACILITY_RULES + COMPANY_POLICIES are now standalone-signable in
  -- the kiosk alongside the four releases.
  IF p_template_key NOT IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                            'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE',
                            'FACILITY_RULES','COMPANY_POLICIES',
                            'HUMAN_EMERGENCY_MEDICAL') THEN
    RAISE EXCEPTION 'unknown release template: %', p_template_key;
  END IF;

  -- Only RELEASE_* templates carry the facility-rules acknowledgment gate and
  -- the appended acknowledgment paragraph. Signing the rules or policies
  -- document itself must not be gated behind acknowledging the rules (circular
  -- for FACILITY_RULES, unrelated for COMPANY_POLICIES).
  v_is_release := (p_template_key LIKE 'RELEASE\_%');

  IF v_is_release AND NOT coalesce(p_rules_acknowledged, false) THEN
    RAISE EXCEPTION 'the facility rules must be acknowledged before signing';
  END IF;
  -- E-sign hardening 2026-07-03: kiosk signings REQUIRE the signer's explicit
  -- consent to transact electronically (the kiosk UI's required checkbox).
  IF NOT coalesce(p_esign_consent, false) THEN
    RAISE EXCEPTION 'electronic signing consent is required';
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

  -- ---- session attribution (e-sign hardening): PostgREST request headers ----
  SELECT a.ip, a.user_agent INTO v_ip, v_ua FROM http_request_attribution() a;

  -- ---- find-or-create the SIGNER's contact (per-org email match) ----
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_contact FROM contacts
      WHERE org_id = v_org AND lower(email) = v_email AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email, phone,
                          date_of_birth, address_line1, address_line2, city, state, postal_code,
                          emergency_contact_1_name, emergency_contact_1_relationship, emergency_contact_1_phone,
                          emergency_contact_2_name, emergency_contact_2_relationship, emergency_contact_2_phone)
      VALUES (v_org, v_first, NULLIF(v_last, ''), v_email, v_phone,
              p_dob, NULLIF(trim(coalesce(p_address_line1,'')),''), NULLIF(trim(coalesce(p_address_line2,'')),''),
              NULLIF(trim(coalesce(p_city,'')),''), NULLIF(trim(coalesce(p_state,'')),''), NULLIF(trim(coalesce(p_postal_code,'')),''),
              NULLIF(trim(coalesce(p_ec1_name,'')),''), NULLIF(trim(coalesce(p_ec1_relationship,'')),''), NULLIF(trim(coalesce(p_ec1_phone,'')),''),
              NULLIF(trim(coalesce(p_ec2_name,'')),''), NULLIF(trim(coalesce(p_ec2_relationship,'')),''), NULLIF(trim(coalesce(p_ec2_phone,'')),''))
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
    -- Fill-blank the optional medical-auth columns on the existing contact:
    -- only populate where currently NULL/empty, never overwriting data on file.
    UPDATE contacts SET
        date_of_birth = coalesce(date_of_birth, p_dob),
        address_line1 = coalesce(nullif(address_line1,''), NULLIF(trim(coalesce(p_address_line1,'')),'')),
        address_line2 = coalesce(nullif(address_line2,''), NULLIF(trim(coalesce(p_address_line2,'')),'')),
        city          = coalesce(nullif(city,''), NULLIF(trim(coalesce(p_city,'')),'')),
        state         = coalesce(nullif(state,''), NULLIF(trim(coalesce(p_state,'')),'')),
        postal_code   = coalesce(nullif(postal_code,''), NULLIF(trim(coalesce(p_postal_code,'')),'')),
        emergency_contact_1_name         = coalesce(nullif(emergency_contact_1_name,''), NULLIF(trim(coalesce(p_ec1_name,'')),'')),
        emergency_contact_1_relationship = coalesce(nullif(emergency_contact_1_relationship,''), NULLIF(trim(coalesce(p_ec1_relationship,'')),'')),
        emergency_contact_1_phone        = coalesce(nullif(emergency_contact_1_phone,''), NULLIF(trim(coalesce(p_ec1_phone,'')),'')),
        emergency_contact_2_name         = coalesce(nullif(emergency_contact_2_name,''), NULLIF(trim(coalesce(p_ec2_name,'')),'')),
        emergency_contact_2_relationship = coalesce(nullif(emergency_contact_2_relationship,''), NULLIF(trim(coalesce(p_ec2_relationship,'')),'')),
        emergency_contact_2_phone        = coalesce(nullif(emergency_contact_2_phone,''), NULLIF(trim(coalesce(p_ec2_phone,'')),''))
      WHERE id = v_contact;
  END IF;
  -- The signer is the CLIENT on the document (2026-07-03 canon); a guardian
  -- signing for a minor additionally carries the GUARDIAN domain relationship.
  INSERT INTO contact_roles (contact_id, role_type)
    VALUES (v_contact, 'CLIENT')
    ON CONFLICT (contact_id, role_type) DO NOTHING;
  IF coalesce(p_is_minor, false) THEN
    INSERT INTO contact_roles (contact_id, role_type)
      VALUES (v_contact, 'GUARDIAN')
      ON CONFLICT (contact_id, role_type) DO NOTHING;
  END IF;

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
    -- Minor path: the minor is the PARTICIPANT party (NOT a signer) — its
    -- presence makes generate_document KEEP the MINOR_* CUT sections and
    -- resolve {{PARTICIPANT.FULL_NAME}}/{{PARTICIPANT.DOB}} from this contact.
    -- The parent/guardian signs as the CLIENT party (relationship recorded).
    -- Minor contact find-or-create by name within the org (minors typically
    -- have no contact channel); the submitted DOB lands on the contact row
    -- (insert + heal) so the {{PARTICIPANT.DOB}} token resolves.
    SELECT id INTO v_minor_c FROM contacts
      WHERE org_id = v_org
        AND lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(v_minor)
        AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    IF v_minor_c IS NULL THEN
      INSERT INTO contacts (org_id, first_name, last_name, date_of_birth)
        VALUES (v_org, v_minor_first, NULLIF(v_minor_last, ''), p_minor_dob)
        RETURNING id INTO v_minor_c;
    ELSE
      UPDATE contacts SET date_of_birth = p_minor_dob
        WHERE id = v_minor_c AND date_of_birth IS NULL;
    END IF;
    INSERT INTO contact_roles (contact_id, role_type)
      VALUES (v_minor_c, 'PARTICIPANT')
      ON CONFLICT (contact_id, role_type) DO NOTHING;

    INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order, relationship)
      VALUES (v_org, v_eng, v_minor_c, 'PARTICIPANT', false, NULL, NULL),
             (v_org, v_eng, v_contact, 'CLIENT',      true,  1,    v_rel);
  ELSE
    -- Adult path: the CLIENT signs for themself; no PARTICIPANT party, so
    -- generate_document strips the MINOR_* CUT sections whole.
    INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_eng, v_contact, 'CLIENT', true, 1);
  END IF;

  -- NO COMPANY party: releases are unilateral (owner decision 2026-07-02).

  -- ---- generate through the REAL merge engine (v9: CUT processing + CLIENT.*
  --      resolution + {{DOC.EFFECTIVE_DATE}} = signing date); pin the tenant ----
  SELECT gd.document_id, gd.merged_body INTO v_doc, v_body
    FROM generate_document(v_eng, p_template_key) gd;
  UPDATE documents SET org_id = v_org, status = 'AWAITING_SIGNATURE' WHERE id = v_doc;

  -- ---- the completed CLIENT signature (validated fence: the block must exist) ----
  IF position('{{SIG.CLIENT.NAME}}' IN v_body) = 0 THEN
    RAISE EXCEPTION 'template % is missing its CLIENT signature block', p_template_key;
  END IF;
  v_body := replace(v_body, '{{SIG.CLIENT.NAME}}', v_typed);
  v_body := replace(v_body, '{{SIG.CLIENT.DATE}}', v_today);

  -- ---- record the rules acknowledgment ON the executed document (RELEASES ONLY) ----
  -- The rules/policies documents are NOT releases: appending a facility-rules
  -- acknowledgment to them is redundant (rules) or wrong (policies).
  IF v_is_release THEN
    v_body := rtrim(v_body)
      || E'\n\nFACILITY RULES ACKNOWLEDGMENT\n\nSigner acknowledged the Facility Rules and Safety Acknowledgment on '
      || v_today || E'.\n';
  END IF;

  -- ---- the sealed typed signature (signed_at set on insert) + attribution ----
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_org, v_doc, v_contact, 'CLIENT', v_typed, now(), v_ip, v_ua, 'KIOSK_TYPED')
    RETURNING signed_at INTO v_signed_at;

  -- ---- the separately-logged e-sign consent (required true above) ----
  INSERT INTO esign_consents (org_id, contact_id, document_id, ip_address, user_agent)
    VALUES (v_org, v_contact, v_doc, v_ip, v_ua);

  -- ---- executed once EVERY signer party has signed (single signer here) ----
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM engagement_parties WHERE engagement_id = v_eng;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = v_doc AND signed_at IS NOT NULL AND deleted_at IS NULL;
  IF v_need > 0 AND v_have >= v_need THEN
    -- tamper evidence: hash the FINAL body (signature substituted + rules
    -- acknowledgment appended — exactly what is persisted below).
    v_hash := compute_execution_hash(v_body, v_contact, v_typed, v_signed_at);
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date,
                         execution_hash = v_hash
      WHERE id = v_doc;
    UPDATE engagements SET status = 'ACTIVE' WHERE id = v_eng;
  END IF;

  -- persist the FINAL body (signed + rules acknowledgment)
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

-- New signature (12 added params) — re-grant EXECUTE on the new overload.
REVOKE ALL ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid, boolean, date, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid, boolean, date, text, text, text, text, text, text, text, text, text, text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid, boolean, date, text, text, text, text, text, text, text, text, text, text, text) IS
  'Public release kiosk (2026-07-07 medical-auth extension): adds HUMAN_EMERGENCY_MEDICAL to the allow-list and twelve optional trailing params (DOB, address parts, two emergency contacts) written fill-blank onto the signer contact so the medical-auth document merges them. All prior behavior preserved from 20260703140000.';


-- ============================================================
-- release_preview — extend the preview allow-list so the participant flow can
-- render COMPANY_POLICIES and HUMAN_EMERGENCY_MEDICAL previews. Body reissued
-- verbatim from 20260703050000 with only the allow-list widened; all docs share
-- the same CLIENT signer block, so the single truncation marker already works.
-- ============================================================
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
                            'FACILITY_RULES','COMPANY_POLICIES',
                            'HUMAN_EMERGENCY_MEDICAL') THEN
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
  -- Truncate BEFORE merging: nothing signature-ish reaches a preview. Owner
  -- revision 2026-07-03: every kiosk document (all four releases AND
  -- FACILITY_RULES) ends with the SAME single CLIENT signer block, and the
  -- minor CUT section sits below it — one marker truncates them all.
  v_marker := E'CLIENT\n\nDate: {{SIG.CLIENT.DATE}}';
  v_cut := position(v_marker IN v_body);
  IF v_cut > 0 THEN
    v_body := rtrim(left(v_body, v_cut - 1));
  END IF;
  -- Belt-and-braces: no CUT-marker comment may survive into a rendered preview
  -- (today they all live below the truncation point).
  v_body := regexp_replace(v_body, '[ \t]*<!-- CUT-(START|END): [A-Z_]+[^>]*-->\n?', '', 'g');

  -- Releases identify the business by trade name only (owner 2026-07-02); the
  -- LEGAL_IDENTITY arm stays for non-release documents.
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
