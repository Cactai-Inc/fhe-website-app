/*
  # Kiosk: make FACILITY_RULES and COMPANY_POLICIES signable documents

  Owner request 2026-07-07: the public release kiosk must let a visitor SIGN,
  as standalone documents, not just the four RELEASE_* templates but also the
  stable rules doc (FACILITY_RULES) and the business policies doc
  (COMPANY_POLICIES). Both template bodies already carry a full CLIENT
  signature block (printed name / phone / email / typed signature / date), so
  no body edits are needed — the only blocker was the sign_release allow-list.

  This reissues sign_release (latest = 20260703110000_esign_hardening.sql) VERBATIM
  except for three surgical, release-only conditionals:

    1. Allow-list (was 4 RELEASE_* keys) → add FACILITY_RULES, COMPANY_POLICIES.

    2. Rules-acknowledgment gate. The original hard-requires p_rules_acknowledged
       before ANY signing. That is correct for a RELEASE (acknowledge the rules,
       then sign your release) but CIRCULAR when the document being signed IS the
       rules doc, and UNRELATED when it is the policies doc. So the gate now
       applies only to RELEASE_* templates. Signing FACILITY_RULES / COMPANY_POLICIES
       does not require a prior facility-rules acknowledgment.

    3. Appended "FACILITY RULES ACKNOWLEDGMENT" paragraph. The original always
       staples this onto the signed body. That is redundant on the rules doc and
       simply WRONG on the policies doc (it would attach a facility-rules
       acknowledgment to a policies document). It is now appended only for
       RELEASE_* templates.

  Everything else — e-sign consent gate, typed-name fence, per-org
  find-or-create, minor path, unilateral execution, sealed signature +
  attribution, execution hash, org pinning — is preserved byte-for-byte from
  20260703110000. Forward-only (live DB): the shipped esign_hardening migration
  is untouched.

  NOTE: the two horse releases (RELEASE_HORSE_EXERCISE / RELEASE_HORSE_CARE)
  remain in the allow-list as before; their {{HORSE.*}} fields still merge blank
  at the kiosk (no horse-binding path). That is a separate, deferred concern
  (owner 2026-07-07) and is unaffected here.

  Independence guarantee: this is the KIOSK signing path (sign_release, anon).
  Wiring these documents into the account/onboarding workflows later uses a
  DIFFERENT path (record_signature / signMyDocument) and does not touch this
  function, so the kiosk stays operable regardless.
*/

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
  p_esign_consent         boolean DEFAULT false
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
                            'FACILITY_RULES','COMPANY_POLICIES') THEN
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

COMMENT ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid, boolean) IS
  'Public release kiosk (CLIENT canon 2026-07-03 + e-sign hardening 20260703110000 + rules/policies signable 2026-07-07): allow-list now admits FACILITY_RULES and COMPANY_POLICIES as standalone-signable documents alongside the four RELEASE_* templates. The facility-rules acknowledgment gate and the appended acknowledgment paragraph apply to RELEASE_* templates only (signing the rules/policies doc itself is neither gated by nor stamped with a facility-rules acknowledgment). All else preserved verbatim from 20260703110000: e-sign consent gate, typed-name fence, per-org find-or-create, minor path, unilateral execution, sealed signature + ip/user-agent attribution, execution hash, org pinning.';
