-- Stage 2 fix (found by the exit E2E, which is what it exists for):
--
-- 1. redeem_invitation's profile INSERT never set profiles.email, so the
--    AFTER INSERT trigger (ensure_contact_for_profile) could not email-match
--    the provisioned contact and minted an 'Unnamed Contact' shell instead —
--    the five-writers junk-contact mechanism, still alive. The INSERT now
--    stamps the auth email; the trigger finds the real contact.
--
-- 2. promote_contact_to_account's merge kept "the account's current contact"
--    unconditionally — wrong when the current link is an empty shell and the
--    incoming contact carries the person's documents. The survivor is now
--    chosen by evidence: the contact with the document trail (docs + parties
--    + signatures) survives; on a tie the account's email decides; only then
--    does the current link win. Also fixes contacts.deleted_by (FKs to
--    profiles.user_id — it was being fed a contact id).

CREATE OR REPLACE FUNCTION public.promote_contact_to_account(p_user_id uuid, p_contact_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c_denied_users constant uuid[] := ARRAY[
    'b45a5503-89bc-489a-b012-c7fbf5c09632',
    'fdbdfe89-76d7-486b-b734-8e23b09e0353',
    '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'
  ]::uuid[];
  c_denied_contacts constant uuid[] := ARRAY[
    '75475f66-8950-4f13-832c-5471070737f8',
    '862b7936-9148-465c-b0db-b83246e236a0',
    '352c3898-65d0-4a90-ad59-29107b7e03fe',
    'c6f7cddc-69da-4948-8e62-4a310f079100'
  ]::uuid[];
  v_profile   profiles%ROWTYPE;
  v_email     text;
  v_survivor  uuid;
  v_dissolved uuid;
  v_trail_cur int;
  v_trail_new int;
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
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_user_id;

  PERFORM set_config('app.allow_profile_link', '1', true);

  IF v_profile.contact_id IS NULL OR v_profile.contact_id = p_contact_id THEN
    v_survivor  := p_contact_id;
    v_dissolved := NULL;
    UPDATE profiles SET contact_id = p_contact_id,
                        org_id = coalesce(org_id, (SELECT org_id FROM contacts WHERE id = p_contact_id))
     WHERE user_id = p_user_id AND contact_id IS DISTINCT FROM p_contact_id;
  ELSE
    IF v_profile.contact_id = ANY(c_denied_contacts) THEN
      RAISE EXCEPTION 'promote_contact_to_account: account is anchored to a protected contact — refusing';
    END IF;

    -- Evidence-based survivor: the contact carrying the document trail wins;
    -- tie → the contact whose email matches the account; last resort → the
    -- account's current link.
    SELECT (SELECT count(*) FROM documents        WHERE contact_id        = v_profile.contact_id AND deleted_at IS NULL)
         + (SELECT count(*) FROM document_parties WHERE contact_id        = v_profile.contact_id)
         + (SELECT count(*) FROM signatures       WHERE signer_contact_id = v_profile.contact_id AND deleted_at IS NULL)
      INTO v_trail_cur;
    SELECT (SELECT count(*) FROM documents        WHERE contact_id        = p_contact_id AND deleted_at IS NULL)
         + (SELECT count(*) FROM document_parties WHERE contact_id        = p_contact_id)
         + (SELECT count(*) FROM signatures       WHERE signer_contact_id = p_contact_id AND deleted_at IS NULL)
      INTO v_trail_new;

    IF v_trail_new > 0 AND v_trail_cur = 0 THEN
      v_survivor := p_contact_id;
    ELSIF v_trail_cur > 0 AND v_trail_new = 0 THEN
      v_survivor := v_profile.contact_id;
    ELSIF (SELECT lower(email) FROM contacts WHERE id = p_contact_id) = v_email
      AND (SELECT lower(coalesce(email,'')) FROM contacts WHERE id = v_profile.contact_id) IS DISTINCT FROM v_email THEN
      v_survivor := p_contact_id;
    ELSE
      v_survivor := v_profile.contact_id;
    END IF;
    v_dissolved := CASE WHEN v_survivor = p_contact_id THEN v_profile.contact_id ELSE p_contact_id END;

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

    INSERT INTO clients (org_id, contact_id, source, client_since, customer_since)
    SELECT d.org_id, v_survivor, d.source, d.client_since, d.customer_since
      FROM clients d WHERE d.contact_id = v_dissolved AND d.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM clients s WHERE s.contact_id = v_survivor AND s.deleted_at IS NULL)
    LIMIT 1;
    UPDATE clients s SET
        client_since   = least(coalesce(s.client_since,  d.client_since),  coalesce(d.client_since,  s.client_since)),
        customer_since = least(coalesce(s.customer_since,d.customer_since),coalesce(d.customer_since,s.customer_since))
      FROM clients d
     WHERE s.contact_id = v_survivor AND s.deleted_at IS NULL
       AND d.contact_id = v_dissolved AND d.deleted_at IS NULL;
    UPDATE clients SET deleted_at = now() WHERE contact_id = v_dissolved AND deleted_at IS NULL;
    DELETE FROM groups WHERE contact_id = v_dissolved;

    SELECT string_agg(t, ', ') INTO v_refs FROM (
      SELECT format('%s.%s', c.conrelid::regclass, a.attname) AS t
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype = 'f' AND c.confrelid = 'contacts'::regclass
         AND c.conrelid NOT IN ('clients'::regclass, 'profiles'::regclass)
         AND a.attname <> 'deleted_by'
         AND EXISTS (SELECT 1 FROM query_to_xml(
               format('SELECT 1 FROM %s WHERE %I = %L LIMIT 1', c.conrelid::regclass, a.attname, v_dissolved),
               false, true, '') x WHERE x IS DOCUMENT)
    ) refs;
    IF v_refs IS NOT NULL THEN
      RAISE EXCEPTION 'promote_contact_to_account: contact % still referenced by % — merge those first', v_dissolved, v_refs;
    END IF;

    UPDATE profiles SET contact_id = v_survivor WHERE user_id = p_user_id;
    UPDATE contacts SET deleted_at = now(), deleted_by = p_user_id WHERE id = v_dissolved;
  END IF;

  UPDATE signatures SET signer_user_id = p_user_id
   WHERE signer_contact_id = v_survivor AND signer_user_id IS NULL;

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
REVOKE EXECUTE ON FUNCTION public.promote_contact_to_account(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- redeem_invitation: stamp the auth email on the bootstrap profile so the
-- link-contact trigger resolves the REAL contact instead of minting a shell.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='redeem_invitation';
  v_src := replace(v_src,
    'INSERT INTO profiles (user_id, org_id, first_name, last_name)
  VALUES (auth.uid(), v_inv.org_id, v_fn, v_ln)
  ON CONFLICT (user_id) DO NOTHING;',
    'INSERT INTO profiles (user_id, org_id, first_name, last_name, email)
  VALUES (auth.uid(), v_inv.org_id, v_fn, v_ln, v_email)
  ON CONFLICT (user_id) DO NOTHING;');
  IF v_src NOT ILIKE '%first_name, last_name, email)%' THEN
    RAISE EXCEPTION 'redeem_invitation email-stamp rewrite incomplete';
  END IF;
  EXECUTE v_src;
END $$;

-- attach_offerings_to_client: an offering attachment is a service engagement —
-- stamp client_since like every other clients writer.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='attach_offerings_to_client';
  v_src := replace(v_src,
    'INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, p_contact_id, ''offering attachment'')',
    'INSERT INTO clients (org_id, contact_id, source, client_since)
      VALUES (v_org, p_contact_id, ''offering attachment'', now())');
  EXECUTE v_src;  -- no-op guard removed: idempotent when already stamped
END $$;
