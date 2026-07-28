-- Stage 2a (REMEDIATION_PLAN + D8): the promotion spine.
--
--   promote_contact_to_account(user, contact) = the ONE path that turns a
--   person into an account-anchored identity: link profiles.contact_id (or
--   merge-and-dissolve a duplicate faceless contact), stamp the signing
--   account on the contact's signatures, grant community membership
--   (D8: community = has account), and derive groups. Structural denylist
--   inside the function: the D1 protected set (both staff accounts, the
--   company contact, admin@cactai.io) by BOTH auth id and contact id, plus
--   any is_company contact — never dissolved, never merged.
--
--   D8 also lands here:
--   - clients.customer_since / client_since = the two markers (CUSTOMER =
--     commercial purchaser incl. gift buyers; CLIENT = service engagement).
--     Existing rows backfilled client_since (all are service-era).
--     Promotion between markers = stamping the other column on the SAME row.
--   - my_standing_categories re-based: service groups only; GUEST is never
--     derived (display-only, decided by surfaces from "no service group").
--   - ensure_my_member_access re-based: membership follows the ACCOUNT
--     (org-scoped), not the clients row.
--   - The 'Guest' onboarding doc-category DISSOLVES: provisioning never
--     pre-assigns a guest doc-set (RELEASE_GENERAL attaches at first physical
--     visit via the kiosk flow; COMPANY_POLICIES attaches at first service
--     purchase — wired with Stage 4's purchase work).
--   - signatures.signer_user_id (2c): new signings by account holders record
--     the account at signing time.

-- ── A. D8 markers ───────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN customer_since timestamptz,
  ADD COLUMN client_since   timestamptz;
UPDATE clients SET client_since = created_at WHERE client_since IS NULL;

-- ── B. 2c: the signing-time account link ────────────────────────────────────
ALTER TABLE signatures ADD COLUMN signer_user_id uuid REFERENCES auth.users(id);

-- ── C. The Guest doc-category dissolves (D8 disposition 6c) ─────────────────
DELETE FROM category_document_requirements WHERE category = 'Guest';
ALTER TABLE category_document_requirements
  DROP CONSTRAINT category_document_requirements_onboarding_check;
ALTER TABLE category_document_requirements
  ADD CONSTRAINT category_document_requirements_onboarding_check
  CHECK (category IN ('Rider','Horse owner'));

-- apply_category_documents: the groups-fallback loses its clients-row GUEST
-- branch (guest = no doc pre-assignment, D8).
CREATE OR REPLACE FUNCTION public.apply_category_documents(p_contact_id uuid, p_categories text[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid;
  v_n    integer;
  v_cats text[];
BEGIN
  SELECT org_id INTO v_org FROM contacts
   WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'contact % not found', p_contact_id;
  END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  IF v_cats IS NULL THEN
    SELECT coalesce(array_agg(DISTINCT g.group_type), ARRAY[]::text[]) INTO v_cats
      FROM groups g WHERE g.contact_id = p_contact_id AND g.group_type IN ('RIDER','HORSE_OWNER');
  END IF;

  DROP TABLE IF EXISTS _wanted;
  CREATE TEMP TABLE _wanted ON COMMIT DROP AS
    SELECT DISTINCT cdr.template_key
      FROM category_document_requirements cdr
      JOIN unnest(v_cats) AS s(cat)
        ON lower(cdr.category) = lower(replace(s.cat, '_', ' '))
     WHERE cdr.org_id = v_org;

  DELETE FROM contact_required_documents crd
   WHERE crd.contact_id = p_contact_id
     AND crd.template_key NOT IN (SELECT template_key FROM _wanted);

  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  SELECT p_contact_id, w.template_key, v_org FROM _wanted w
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_n
    FROM contact_required_documents WHERE contact_id = p_contact_id;

  RETURN v_n;
END;
$function$;

-- ── D. my_standing_categories: D8 re-base (service groups only) ─────────────
-- GUEST is never derived. An account with no service group is a "guest" only
-- as display copy, decided by the surface (Stage 3 lands those changes).
CREATE OR REPLACE FUNCTION public.my_standing_categories()
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_groups  text[];
BEGIN
  IF auth.uid() IS NULL OR v_contact IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  SELECT coalesce(array_agg(DISTINCT g.group_type ORDER BY g.group_type), ARRAY[]::text[])
    INTO v_groups
    FROM groups g
   WHERE g.contact_id = v_contact AND g.group_type IN ('RIDER','HORSE_OWNER');
  RETURN v_groups;
END;
$function$;

-- ── E. ensure_my_member_access: community follows the ACCOUNT (D8) ──────────
CREATE OR REPLACE FUNCTION public.ensure_my_member_access()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org     uuid;
  v_status  text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT status INTO v_status FROM members WHERE user_id = auth.uid();
  IF v_status = 'active' THEN RETURN true; END IF;

  -- D8: any org-attached account holds community access. Resolve the org from
  -- the profile first, falling back to the contact's client record.
  SELECT p.org_id INTO v_org FROM profiles p WHERE p.user_id = auth.uid();
  IF v_org IS NULL THEN
    SELECT cl.org_id INTO v_org FROM clients cl
     WHERE cl.contact_id = current_contact_id() AND cl.deleted_at IS NULL
     ORDER BY cl.created_at DESC LIMIT 1;
  END IF;
  IF v_org IS NULL THEN RETURN false; END IF;

  IF v_status IS NULL THEN
    INSERT INTO members (user_id, status, org_id)
      VALUES (auth.uid(), 'active', v_org)
      ON CONFLICT (user_id) DO UPDATE SET status = 'active';
    RETURN true;
  ELSIF v_status = 'paused' THEN
    UPDATE members SET status = 'active' WHERE user_id = auth.uid();
    RETURN true;
  END IF;
  RETURN false;
END;
$function$;

-- ── F. THE PROMOTION SPINE (2a) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.promote_contact_to_account(p_user_id uuid, p_contact_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  -- D1 protected set — STRUCTURAL denylist, by BOTH auth id and contact id.
  c_denied_users constant uuid[] := ARRAY[
    'b45a5503-89bc-489a-b012-c7fbf5c09632',  -- admin@fhequestrian.com (CJ)
    'fdbdfe89-76d7-486b-b734-8e23b09e0353',  -- hello@fhequestrian.com (Claire)
    '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'   -- admin@cactai.io (platform owner)
  ]::uuid[];
  c_denied_contacts constant uuid[] := ARRAY[
    '75475f66-8950-4f13-832c-5471070737f8',  -- CJ's staff contact
    '862b7936-9148-465c-b0db-b83246e236a0',  -- Claire's staff contact
    '352c3898-65d0-4a90-ad59-29107b7e03fe',  -- the company contact
    'c6f7cddc-69da-4948-8e62-4a310f079100'   -- admin@cactai.io's former FHE contact
  ]::uuid[];
  v_profile   profiles%ROWTYPE;
  v_survivor  uuid;   -- the contact the account ends up anchored to
  v_dissolved uuid;   -- the duplicate faceless contact merged away (or NULL)
  v_refs      text;
  v_groups    text[];
BEGIN
  IF p_user_id IS NULL OR p_contact_id IS NULL THEN
    RAISE EXCEPTION 'promote_contact_to_account: user and contact are required';
  END IF;
  IF p_user_id = ANY(c_denied_users) OR p_contact_id = ANY(c_denied_contacts) THEN
    RAISE EXCEPTION 'promote_contact_to_account: identity is protected (D1) — refusing';
  END IF;
  IF EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND is_company) THEN
    RAISE EXCEPTION 'promote_contact_to_account: a company contact is never promoted or dissolved';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'promote_contact_to_account: no profile for user %', p_user_id;
  END IF;

  PERFORM set_config('app.allow_profile_link', '1', true);

  IF v_profile.contact_id IS NULL THEN
    -- simple attach: the account gains its identity anchor
    UPDATE profiles SET contact_id = p_contact_id,
                        org_id = coalesce(org_id, (SELECT org_id FROM contacts WHERE id = p_contact_id))
     WHERE user_id = p_user_id;
    v_survivor := p_contact_id;
    v_dissolved := NULL;
  ELSIF v_profile.contact_id = p_contact_id THEN
    v_survivor := p_contact_id;      -- idempotent re-promotion
    v_dissolved := NULL;
  ELSE
    -- MERGE: the account's existing contact survives; the duplicate faceless
    -- contact's document trail re-anchors, then the duplicate dissolves.
    IF v_profile.contact_id = ANY(c_denied_contacts) THEN
      RAISE EXCEPTION 'promote_contact_to_account: account is anchored to a protected contact — refusing';
    END IF;
    v_survivor  := v_profile.contact_id;
    v_dissolved := p_contact_id;

    UPDATE documents         SET contact_id        = v_survivor WHERE contact_id        = v_dissolved;
    UPDATE document_parties  SET contact_id        = v_survivor WHERE contact_id        = v_dissolved;
    UPDATE signatures        SET signer_contact_id = v_survivor WHERE signer_contact_id = v_dissolved;
    UPDATE contract_parties  SET contact_id        = v_survivor WHERE contact_id        = v_dissolved;
    UPDATE document_shares   SET shared_with_contact_id = v_survivor WHERE shared_with_contact_id = v_dissolved;
    UPDATE contact_required_documents SET contact_id = v_survivor WHERE contact_id = v_dissolved
      AND NOT EXISTS (SELECT 1 FROM contact_required_documents x
                       WHERE x.contact_id = v_survivor AND x.template_key = contact_required_documents.template_key);
    DELETE FROM contact_required_documents WHERE contact_id = v_dissolved;
    UPDATE invitations SET contact_id = v_survivor WHERE contact_id = v_dissolved;

    -- markers merge onto the survivor's clients row (earliest stamp wins)
    INSERT INTO clients (org_id, contact_id, source, client_since, customer_since)
    SELECT d.org_id, v_survivor, d.source, d.client_since, d.customer_since
      FROM clients d WHERE d.contact_id = v_dissolved AND d.deleted_at IS NULL
    ON CONFLICT DO NOTHING;
    UPDATE clients s SET
        client_since   = least(coalesce(s.client_since,  d.client_since),  coalesce(d.client_since,  s.client_since)),
        customer_since = least(coalesce(s.customer_since,d.customer_since),coalesce(d.customer_since,s.customer_since))
      FROM clients d
     WHERE s.contact_id = v_survivor AND s.deleted_at IS NULL
       AND d.contact_id = v_dissolved AND d.deleted_at IS NULL;
    UPDATE clients SET deleted_at = now() WHERE contact_id = v_dissolved AND deleted_at IS NULL;

    -- STRUCTURAL SAFETY: refuse to dissolve while unmigrated references remain
    -- anywhere else (no silent orphaning, no dual-association).
    SELECT string_agg(t, ', ') INTO v_refs FROM (
      SELECT format('%s.%s', c.conrelid::regclass, a.attname) AS t
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype = 'f' AND c.confrelid = 'contacts'::regclass
         AND c.conrelid NOT IN ('clients'::regclass, 'profiles'::regclass)
         AND EXISTS (SELECT 1 FROM query_to_xml(
               format('SELECT 1 FROM %s WHERE %I = %L LIMIT 1', c.conrelid::regclass, a.attname, v_dissolved),
               false, true, '') x WHERE x IS DOCUMENT)
    ) refs;
    IF v_refs IS NOT NULL THEN
      RAISE EXCEPTION 'promote_contact_to_account: contact % still referenced by % — merge those first', v_dissolved, v_refs;
    END IF;

    UPDATE contacts SET deleted_at = now(), deleted_by = v_survivor WHERE id = v_dissolved;
  END IF;

  -- the account's signatures carry the signing account from here on (2c/2d)
  UPDATE signatures SET signer_user_id = p_user_id
   WHERE signer_contact_id = v_survivor AND signer_user_id IS NULL;

  -- D8: community = has account
  INSERT INTO members (user_id, status, org_id)
  VALUES (p_user_id, 'active', (SELECT org_id FROM contacts WHERE id = v_survivor))
  ON CONFLICT (user_id) DO UPDATE SET status = 'active';

  v_groups := apply_affiliations(v_survivor);

  RETURN jsonb_build_object(
    'contact_id', v_survivor,
    'dissolved_contact_id', v_dissolved,
    'groups', to_jsonb(coalesce(v_groups, ARRAY[]::text[])));
END;
$function$;

-- Spine-internal only: no direct client grants; callers are SECURITY DEFINER
-- functions (redeem paths) and staff/service-role code.
REVOKE EXECUTE ON FUNCTION public.promote_contact_to_account(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── G. Markers stamped at the existing writers ──────────────────────────────
-- _ensure_client_account: invitation provisioning = service engagement (CLIENT
-- marker); Stage 4's gift flow will call with p_marker => 'CUSTOMER'.
CREATE OR REPLACE FUNCTION public._ensure_client_account(p_org uuid, p_email text, p_first_name text, p_last_name text, p_categories text[], p_template_keys text[] DEFAULT NULL::text[], p_marker text DEFAULT 'CLIENT')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_client  uuid;
  v_email   text := lower(trim(p_email));
  v_fn      text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln      text := nullif(trim(coalesce(p_last_name,  '')), '');
  v_cats    text[];
BEGIN
  IF p_org IS NULL THEN RAISE EXCEPTION 'org is required'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;
  IF p_marker NOT IN ('CLIENT','CUSTOMER') THEN RAISE EXCEPTION 'marker must be CLIENT or CUSTOMER'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  IF v_cats IS NULL OR array_length(v_cats, 1) IS NULL THEN
    v_cats := ARRAY['GUEST'];  -- GUEST = no service docs pre-assigned (D8)
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_cats) c WHERE c NOT IN ('GUEST','RIDER','HORSE_OWNER')) THEN
    RAISE EXCEPTION 'categories must be a subset of GUEST/RIDER/HORSE_OWNER';
  END IF;

  -- upsert contact by email (skip contacts owned by a DIFFERENT account's profile)
  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT c.is_company  -- the company contact is matched by id only, never email (D7 rule)
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (p_org, v_fn, v_ln, v_email) RETURNING id INTO v_contact;
  ELSE
    UPDATE contacts SET
        first_name = CASE WHEN v_fn IS NOT NULL AND (NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,''))) THEN v_fn ELSE first_name END,
        last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                          THEN v_ln ELSE last_name END
      WHERE id = v_contact;
  END IF;

  -- the clients row carries the D8 markers
  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source, client_since, customer_since)
      VALUES (p_org, v_contact, 'provisioned invitation',
              CASE WHEN p_marker = 'CLIENT'   THEN now() END,
              CASE WHEN p_marker = 'CUSTOMER' THEN now() END)
      RETURNING id INTO v_client;
  ELSE
    UPDATE clients SET
        client_since   = coalesce(client_since,   CASE WHEN p_marker = 'CLIENT'   THEN now() END),
        customer_since = coalesce(customer_since, CASE WHEN p_marker = 'CUSTOMER' THEN now() END)
      WHERE id = v_client;
  END IF;

  -- groups are DERIVED — provisioning writes none; categories drive the
  -- onboarding document set only (GUEST pre-assigns nothing per D8).
  IF p_template_keys IS NOT NULL THEN
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    SELECT v_contact, k, p_org FROM unnest(p_template_keys) k WHERE btrim(k) <> ''
    ON CONFLICT DO NOTHING;
  ELSE
    PERFORM apply_category_documents(v_contact, v_cats);
  END IF;

  RETURN jsonb_build_object('contact_id', v_contact, 'client_id', v_client);
END;
$function$;

-- admin_create_client stamps the service marker the same way.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='admin_create_client';
  v_src := replace(v_src,
    'INSERT INTO clients (contact_id, status, source)
    VALUES (v_contact, ''ACTIVE'', ''staff created'')',
    'INSERT INTO clients (contact_id, status, source, client_since)
    VALUES (v_contact, ''ACTIVE'', ''staff created'', now())');
  EXECUTE v_src;
END $$;

-- sign_release: the kiosk signer's client shell is a service engagement, and a
-- signer who already holds an account records it at signing time (2c).
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='sign_release';
  v_src := replace(v_src,
    'INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, ''VISITOR_RELEASE'')',
    'INSERT INTO clients (org_id, contact_id, source, client_since)
      VALUES (v_org, v_contact, ''VISITOR_RELEASE'', now())');
  v_src := replace(v_src,
    'INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_org, v_doc, v_contact, ''CLIENT'', v_typed, now(), v_ip, v_ua, ''KIOSK_TYPED'')',
    'INSERT INTO signatures (org_id, document_id, signer_contact_id, signer_user_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_org, v_doc, v_contact, (SELECT pr.user_id FROM profiles pr WHERE pr.contact_id = v_contact LIMIT 1), ''CLIENT'', v_typed, now(), v_ip, v_ua, ''KIOSK_TYPED'')');
  IF v_src NOT ILIKE '%signer_user_id%' OR v_src NOT ILIKE '%client_since%' THEN
    RAISE EXCEPTION 'sign_release rewrite incomplete';
  END IF;
  EXECUTE v_src;
END $$;

-- record_signature: stamp signer_user_id at signing time (2c).
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='record_signature';
  v_src := replace(v_src,
    'INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_doc_org, p_document_id, v_signer, p_party_role, p_typed_name, now(), v_ip, v_ua, ''TYPED'')',
    'INSERT INTO signatures (org_id, document_id, signer_contact_id, signer_user_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_doc_org, p_document_id, v_signer, (SELECT pr.user_id FROM profiles pr WHERE pr.contact_id = v_signer LIMIT 1), p_party_role, p_typed_name, now(), v_ip, v_ua, ''TYPED'')');
  IF v_src NOT ILIKE '%signer_user_id%' THEN RAISE EXCEPTION 'record_signature rewrite incomplete'; END IF;
  EXECUTE v_src;
END $$;

-- ── H. Assertions ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM category_document_requirements WHERE category = 'Guest') THEN
    RAISE EXCEPTION 'Guest doc-category rows survived the dissolve';
  END IF;
  IF (SELECT count(*) FROM clients WHERE deleted_at IS NULL AND client_since IS NULL AND customer_since IS NULL) > 0 THEN
    RAISE EXCEPTION 'unmarked clients rows remain after backfill';
  END IF;
END $$;
