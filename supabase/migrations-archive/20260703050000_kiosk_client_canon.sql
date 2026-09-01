/*
  # Kiosk CLIENT canon — the /release RPCs re-issued for the owner's 2026-07-03
  # template revision (single CLIENT signer block + CUT-marker minor sections)

  The owner replaced every contract body (20260629100000 regenerated from
  supabase/contract_templates/). The releases and FACILITY_RULES no longer carry
  'ADULT SIGNER' / 'MINOR SIGNER (PARENT/GUARDIAN)' marker sections or the
  PARTICIPANT+GUARDIAN signer namespaces. The new shape (TOKEN_DICTIONARY.md):

    - ONE signer block per document, ending the body:
        CLIENT
        Date: {{SIG.CLIENT.DATE}}
        Printed Name: {{CLIENT.PRINTED_NAME}}
        Signature: {{SIG.CLIENT.NAME}}
        …(Phone/Email; the equine-services release adds Capacity + Horse Name)
    - minors ride in CUT-marker sections:
        <!-- CUT-START: MINOR_PARTICIPANT | condition: … --> … <!-- CUT-END: … -->
      kept (markers stripped, {{PARTICIPANT.*}} resolved from the minor contact)
      when a minor participates; removed whole for adult-only signings.
      generate_document v9 (20260703030000) already implements exactly this —
      the kiosk keeps routing through that REAL engine.

  Re-issued here for the new bodies (heads: release_preview 20260702060000,
  sign_release 20260703010000, sign_general_release 20260702090000):

  1. release_preview — truncation marker moves from 'ADULT SIGNER' (releases) /
     'CLIENT\n\nClient / Participant Name:' (FACILITY_RULES) to the ONE marker
     every kiosk document now shares: the CLIENT signer block. Everything else
     (org resolution, trade-name-only identity, date merge, token fill-ins,
     anon grant) is unchanged.
  2. sign_release — the signer is now the CLIENT party (party_role 'CLIENT',
     matching {{SIG.CLIENT.*}} / {{CLIENT.*}} in the bodies). Adult path: the
     CLIENT signs for themself and generate_document strips the MINOR_* CUT
     sections (no PARTICIPANT party). Minor path: the minor is attached as the
     non-signing PARTICIPANT party (name + DOB on the contact, so
     {{PARTICIPANT.FULL_NAME}}/{{PARTICIPANT.DOB}} resolve and the MINOR_* CUT
     sections are KEPT); the parent/guardian signs as CLIENT, with the
     relationship recorded on their party row. No more marker-based section
     surgery — the engine's CUT processing is the single implementation.
     PRESERVED owner directives: anon-executable; p_rules_acknowledged REQUIRED
     + dated FACILITY RULES ACKNOWLEDGMENT tail on the executed body; typed
     signature must EXACTLY match the printed name; unilateral (EXECUTES on the
     single signature — no COMPANY party); per-org find-or-create by email with
     the placeholder-name heal (first_name born as the email); org resolution
     coalesce(p_org, current_org(), current_addressed_org(), sole_org()) with
     the transaction-local pin; org stamped explicitly on every insert; method
     'KIOSK_TYPED' with signed_at set on insert (sealed).
  3. sign_general_release — legacy wrapper re-issued unchanged in behavior
     (splits its full-name argument, forwards to sign_release, adult path).

  Template metadata: the kiosk documents' signing parties are CLIENT (signer) +
  PARTICIPANT (the optional minor, never a signer) — GUARDIAN is no longer a
  party namespace on these bodies.
*/

-- ============================================================
-- 0. Template metadata — CLIENT signs; PARTICIPANT is the optional minor.
-- ============================================================
UPDATE contract_templates
   SET party_namespaces = ARRAY['CLIENT','PARTICIPANT']
 WHERE template_key IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                        'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE',
                        'FACILITY_RULES');

-- ============================================================
-- 1. release_preview — truncate at the shared CLIENT signer block.
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

COMMENT ON FUNCTION release_preview(text, uuid) IS
  'Public kiosk preview: merges org identity + dates for one of the four RELEASE_* templates (or FACILITY_RULES for the rules gate) and truncates the body before the CLIENT signer block (owner 2026-07-03 single-signer canon). Org: p_org -> current_org() -> addressed org -> sole_org().';

-- ============================================================
-- 2. sign_release — CLIENT signs; minors ride as the PARTICIPANT party and the
--    engine's CUT processing keeps/strips the MINOR_* sections.
-- ============================================================
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

  -- ---- record the rules acknowledgment ON the executed document ----
  v_body := rtrim(v_body)
    || E'\n\nFACILITY RULES ACKNOWLEDGMENT\n\nSigner acknowledged the Facility Rules and Safety Acknowledgment on '
    || v_today || E'.\n';

  -- ---- the sealed typed signature (signed_at set on insert) ----
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, method)
    VALUES (v_org, v_doc, v_contact, 'CLIENT', v_typed, now(), 'KIOSK_TYPED');

  -- ---- executed once EVERY signer party has signed (single signer here) ----
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM engagement_parties WHERE engagement_id = v_eng;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = v_doc AND signed_at IS NOT NULL AND deleted_at IS NULL;
  IF v_need > 0 AND v_have >= v_need THEN
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date WHERE id = v_doc;
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

REVOKE ALL ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid) IS
  'Public release kiosk (CLIENT canon, owner templates 2026-07-03): signs any of the four RELEASE_* templates. The signer is the CLIENT party; {{SIG.CLIENT.NAME/DATE}} complete on signing. Minor path: the minor is the non-signing PARTICIPANT party — generate_document keeps the MINOR_* CUT sections and resolves {{PARTICIPANT.*}} from the minor contact (DOB stored on the contact); adult path strips them. Typed signature must match first_name || '' '' || last_name exactly. A dated Facility Rules acknowledgment is appended to the executed body. Unilateral: EXECUTES on the single signature. Requires p_rules_acknowledged.';

-- ============================================================
-- 3. sign_general_release — legacy wrapper re-issued (behavior unchanged): the
--    single full-name argument splits on the FIRST space and forwards.
-- ============================================================
CREATE OR REPLACE FUNCTION sign_general_release(
  p_full_name  text,
  p_email      text,
  p_phone      text,
  p_typed_name text,
  p_org        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT sign_release(
    'RELEASE_GENERAL',
    NULLIF(split_part(trim(coalesce(p_full_name, '')), ' ', 1), ''),
    CASE WHEN position(' ' IN trim(coalesce(p_full_name, ''))) > 0
         THEN NULLIF(trim(substring(trim(p_full_name) FROM position(' ' IN trim(p_full_name)) + 1)), '')
         ELSE NULL END,
    p_email, p_phone, p_typed_name,
    false, NULL, NULL, NULL, NULL, true, p_org);
$fn$;

REVOKE ALL ON FUNCTION sign_general_release(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sign_general_release(text, text, text, text, uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION sign_general_release(text, text, text, text, uuid) IS
  'Legacy wrapper over sign_release(RELEASE_GENERAL, …, adult path). Splits its single full-name argument on the first space into first/last. Unilateral: EXECUTES on the visitor signature (signer = CLIENT party, 2026-07-03 canon).';
