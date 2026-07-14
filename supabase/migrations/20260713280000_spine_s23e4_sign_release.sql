/*
  # Spine Refactor — Slice 2.3e-4: kiosk release off engagements (owner's #1 rule)

  sign_release (the whole anon kiosk mutation surface) MANUFACTURED a non-service
  engagement + engagement_parties purely to hold the release document, then
  generated via the 2-arg shim. Owner's explicit directive: kiosk documents are a
  difference of FLOW, not of machinery — they must live on the same spine as every
  other document. Rewrite it to generate a CONTACT-OWNED release doc with
  document_parties via the v11 generator directly, with NO engagement.

  Everything else is preserved verbatim: all validation, the contact
  find/create/heal (incl. the medical-auth fill-blank + placeholder-name heal),
  contact_roles, the client shell (CRM: a visitor who signs a release becomes a
  client), the signature substitution + FACILITY RULES ACKNOWLEDGMENT append, the
  sealed KIOSK_TYPED signature, esign_consents, the execution hash + EXECUTED
  flip. Minor path now sets contacts.guardian_contact_id (spine minor link) and
  carries the guardian relationship on the CLIENT document_party.
*/
CREATE OR REPLACE FUNCTION public.sign_release(
  p_template_key text, p_first_name text, p_last_name text, p_email text, p_phone text,
  p_typed_name text, p_is_minor boolean DEFAULT false, p_minor_first_name text DEFAULT NULL,
  p_minor_last_name text DEFAULT NULL, p_minor_dob date DEFAULT NULL,
  p_guardian_relationship text DEFAULT NULL, p_rules_acknowledged boolean DEFAULT false,
  p_org uuid DEFAULT NULL, p_esign_consent boolean DEFAULT false, p_dob date DEFAULT NULL,
  p_address_line1 text DEFAULT NULL, p_address_line2 text DEFAULT NULL, p_city text DEFAULT NULL,
  p_state text DEFAULT NULL, p_postal_code text DEFAULT NULL, p_ec1_name text DEFAULT NULL,
  p_ec1_relationship text DEFAULT NULL, p_ec1_phone text DEFAULT NULL, p_ec2_name text DEFAULT NULL,
  p_ec2_relationship text DEFAULT NULL, p_ec2_phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_first     text := trim(coalesce(p_first_name, ''));
  v_last      text := trim(coalesce(p_last_name, ''));
  v_name      text;
  v_typed     text := trim(coalesce(p_typed_name, ''));
  v_email     text := lower(trim(coalesce(p_email, '')));
  v_phone     text := trim(coalesce(p_phone, ''));
  v_minor_first text := trim(coalesce(p_minor_first_name, ''));
  v_minor_last  text := trim(coalesce(p_minor_last_name, ''));
  v_minor     text;
  v_rel       text := trim(coalesce(p_guardian_relationship, ''));
  v_org       uuid;
  v_contact   uuid;
  v_minor_c   uuid;
  v_client    uuid;
  v_parties   jsonb;
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
  v_is_release boolean;
BEGIN
  v_name  := trim(v_first || ' ' || v_last);
  v_minor := trim(v_minor_first || ' ' || v_minor_last);

  IF p_template_key NOT IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                            'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE',
                            'FACILITY_RULES','COMPANY_POLICIES',
                            'HUMAN_EMERGENCY_MEDICAL') THEN
    RAISE EXCEPTION 'unknown release template: %', p_template_key;
  END IF;

  v_is_release := (p_template_key LIKE 'RELEASE\_%');

  IF v_is_release AND NOT coalesce(p_rules_acknowledged, false) THEN
    RAISE EXCEPTION 'the facility rules must be acknowledged before signing';
  END IF;
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
    UPDATE contacts
       SET first_name = v_first,
           last_name  = NULLIF(v_last, ''),
           phone      = coalesce(nullif(phone, ''), v_phone)
     WHERE id = v_contact
       AND (
         NULLIF(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') IS NULL
         OR lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(coalesce(email, ''))
       );
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

  INSERT INTO contact_roles (contact_id, role_type)
    VALUES (v_contact, 'CLIENT')
    ON CONFLICT (contact_id, role_type) DO NOTHING;
  IF coalesce(p_is_minor, false) THEN
    INSERT INTO contact_roles (contact_id, role_type)
      VALUES (v_contact, 'GUARDIAN')
      ON CONFLICT (contact_id, role_type) DO NOTHING;
  END IF;

  -- ---- client shell (CRM: a visitor who signs a release becomes a client) ----
  SELECT id INTO v_client FROM clients
    WHERE contact_id = v_contact AND deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'VISITOR_RELEASE')
      RETURNING id INTO v_client;
  END IF;

  -- ---- build the spine document_parties roster (NO engagement) ----
  IF coalesce(p_is_minor, false) THEN
    -- Minor path: the minor is the PARTICIPANT party (NOT a signer) — its
    -- presence makes generate_document KEEP the MINOR_* CUT sections and resolve
    -- {{PARTICIPANT.*}} tokens. The parent/guardian signs as CLIENT.
    SELECT id INTO v_minor_c FROM contacts
      WHERE org_id = v_org
        AND lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(v_minor)
        AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    IF v_minor_c IS NULL THEN
      INSERT INTO contacts (org_id, first_name, last_name, date_of_birth, guardian_contact_id)
        VALUES (v_org, v_minor_first, NULLIF(v_minor_last, ''), p_minor_dob, v_contact)
        RETURNING id INTO v_minor_c;
    ELSE
      UPDATE contacts SET date_of_birth = coalesce(date_of_birth, p_minor_dob),
                          guardian_contact_id = coalesce(guardian_contact_id, v_contact)
        WHERE id = v_minor_c;
    END IF;
    INSERT INTO contact_roles (contact_id, role_type)
      VALUES (v_minor_c, 'PARTICIPANT')
      ON CONFLICT (contact_id, role_type) DO NOTHING;

    v_parties := jsonb_build_array(
      jsonb_build_object('contact_id', v_minor_c, 'role', 'PARTICIPANT', 'is_signer', false),
      jsonb_build_object('contact_id', v_contact, 'role', 'CLIENT', 'is_signer', true,
                         'signer_order', 1, 'relationship', v_rel));
  ELSE
    -- Adult path: the CLIENT signs for themself; no PARTICIPANT party, so
    -- generate_document strips the MINOR_* CUT sections whole.
    v_parties := jsonb_build_array(
      jsonb_build_object('contact_id', v_contact, 'role', 'CLIENT', 'is_signer', true, 'signer_order', 1));
  END IF;

  -- NO COMPANY party: releases are unilateral (owner decision 2026-07-02).

  -- ---- generate through the ONE spine generator (v11): contact-owned, no
  --      engagement, no contract, no horse; document_parties seeded from v_parties ----
  SELECT gd.document_id, gd.merged_body INTO v_doc, v_body
    FROM generate_document(v_contact, p_template_key, NULL::uuid, NULL::uuid, v_parties, NULL::text) gd;
  UPDATE documents SET org_id = v_org, status = 'AWAITING_SIGNATURE' WHERE id = v_doc;

  IF position('{{SIG.CLIENT.NAME}}' IN v_body) = 0 THEN
    RAISE EXCEPTION 'template % is missing its CLIENT signature block', p_template_key;
  END IF;
  v_body := replace(v_body, '{{SIG.CLIENT.NAME}}', v_typed);
  v_body := replace(v_body, '{{SIG.CLIENT.DATE}}', v_today);

  IF v_is_release THEN
    v_body := rtrim(v_body)
      || E'\n\nFACILITY RULES ACKNOWLEDGMENT\n\nSigner acknowledged the Facility Rules and Safety Acknowledgment on '
      || v_today || E'.\n';
  END IF;

  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_org, v_doc, v_contact, 'CLIENT', v_typed, now(), v_ip, v_ua, 'KIOSK_TYPED')
    RETURNING signed_at INTO v_signed_at;

  INSERT INTO esign_consents (org_id, contact_id, document_id, ip_address, user_agent)
    VALUES (v_org, v_contact, v_doc, v_ip, v_ua);

  -- executed once EVERY signer party has signed (single signer here) — counted
  -- off document_parties (the spine roster) instead of engagement_parties.
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM document_parties WHERE document_id = v_doc;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = v_doc AND signed_at IS NOT NULL AND deleted_at IS NULL;
  IF v_need > 0 AND v_have >= v_need THEN
    v_hash := compute_execution_hash(v_body, v_contact, v_typed, v_signed_at);
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date,
                         execution_hash = v_hash
      WHERE id = v_doc;
  END IF;

  UPDATE documents SET merged_body = v_body WHERE id = v_doc;

  SELECT status, display_code INTO v_status, v_doc_code FROM documents WHERE id = v_doc;

  RETURN jsonb_build_object(
    'document_id',   v_doc,
    'document_code', v_doc_code,
    'contact_id',    v_contact,
    'status',        v_status,
    'merged_body',   v_body
  );
END;
$function$;
