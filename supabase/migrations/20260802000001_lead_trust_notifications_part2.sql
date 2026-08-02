-- U1 — LEAD TRUST + NOTIFICATION INTEGRITY (part 2)
-- Items 2 (link-follow + backfill), 4 (fail-clean redemption), 5b/5c/5d
-- (notification lifecycle). Same verify-first protocol: every body below was
-- rebuilt from the LIVE pg_get_functiondef captured 2026-08-01.

BEGIN;

-- ============================================================================
-- ITEM 2 (cont.) — provisioning follows the real link, email only as fallback
-- ============================================================================
-- ITEM 5b (cont.) — after status flips to 'invited', the request_new alert for
-- that request resolves (kind-scoped, so nothing else on the link is touched).
CREATE OR REPLACE FUNCTION public.provision_client_invitation(p_email text, p_first_name text, p_last_name text, p_categories text[], p_offering_ids uuid[] DEFAULT '{}'::uuid[], p_template_keys text[] DEFAULT NULL::text[], p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid, p_org_id uuid DEFAULT NULL::uuid, p_partial_amount numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contact  uuid;
  v_client   uuid;
  v_acct     jsonb;
  v_purchase uuid;
  v_inv_id   uuid;
  v_token    text;
  v_total    numeric := 0;
  v_labels   text[];
  v_has_off  boolean := (array_length(p_offering_ids, 1) IS NOT NULL);
  v_dup_purchase uuid;
  v_cats     text[];
  v_email    text := lower(trim(p_email));
  v_fn       text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln       text := nullif(trim(coalesce(p_last_name,  '')), '');
  v_linked   uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  IF v_cats IS NULL OR array_length(v_cats, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one category is required';
  END IF;

  v_org := p_org_id;
  IF v_org IS NULL AND v_has_off THEN
    SELECT o.org_id INTO v_org FROM offerings o WHERE o.id = p_offering_ids[1];
  END IF;
  v_org := coalesce(v_org, current_org());
  IF v_org IS NULL THEN RAISE EXCEPTION 'could not resolve org for this invitation'; END IF;

  -- ITEM 2: when a request is named, its FK link is the truth. The email match
  -- inside _ensure_client_account remains the fallback for the null-link case.
  IF p_request_id IS NOT NULL THEN
    SELECT r.contact_id INTO v_linked
      FROM requests r WHERE r.id = p_request_id;
    IF v_linked IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM contacts c WHERE c.id = v_linked AND c.deleted_at IS NOT NULL) THEN
      v_contact := v_linked;
      -- ITEM 3: a linked LEAD becomes a real CONTACT at conversion.
      UPDATE contacts
         SET contact_type = CASE WHEN contact_type = 'LEAD' THEN 'CONTACT' ELSE contact_type END,
             first_name = CASE WHEN v_fn IS NOT NULL AND NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                               THEN v_fn ELSE first_name END,
             last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                               THEN v_ln ELSE last_name END
       WHERE id = v_contact;
      SELECT cl.id INTO v_client FROM clients cl
       WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
      IF v_client IS NULL THEN
        INSERT INTO clients (org_id, contact_id, source, client_since)
          VALUES (v_org, v_contact, 'provisioned invitation', now())
          RETURNING id INTO v_client;
      END IF;
      IF p_template_keys IS NOT NULL THEN
        INSERT INTO contact_required_documents (contact_id, template_key, org_id)
        SELECT v_contact, k, v_org FROM unnest(p_template_keys) k WHERE btrim(k) <> ''
        ON CONFLICT DO NOTHING;
      ELSE
        PERFORM apply_category_documents(v_contact, v_cats);
      END IF;
    END IF;
  END IF;

  -- single-sourced account creation (unchanged path when there is no link)
  IF v_contact IS NULL THEN
    v_acct    := _ensure_client_account(v_org, v_email, v_fn, v_ln, v_cats, p_template_keys);
    v_contact := (v_acct->>'contact_id')::uuid;
    v_client  := (v_acct->>'client_id')::uuid;
  END IF;

  IF v_has_off THEN
    SELECT p.id INTO v_dup_purchase
      FROM purchases p
     WHERE p.buyer_contact_id = v_contact AND coalesce(p.status,'') <> 'void' AND p.deleted_at IS NULL
       AND (SELECT array_agg(DISTINCT pi.offering_id ORDER BY pi.offering_id)
              FROM purchase_items pi WHERE pi.purchase_id = p.id)
           = (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_offering_ids) x)
     ORDER BY p.created_at DESC LIMIT 1;
    IF v_dup_purchase IS NOT NULL THEN
      v_purchase := v_dup_purchase;
    ELSE
      v_purchase := _provision_purchase_for_offerings(
        v_org, v_contact, v_client, p_offering_ids,
        p_mark_paid, p_payment_method, p_notes, p_partial_amount);
    END IF;
    SELECT coalesce(sum(o.price_amount), 0), array_agg(o.name) INTO v_total, v_labels
      FROM offerings o WHERE o.id = ANY(p_offering_ids);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (org_id, request_id, email, token, expires_at, status,
                           first_name, last_name, contact_id, categories, offering_ids, template_keys)
    VALUES (v_org, p_request_id, v_email, v_token,
            now() + (invitation_expiry_days(v_org) || ' days')::interval, 'sent',
            v_fn, v_ln, v_contact, v_cats, nullif(p_offering_ids, '{}'), p_template_keys)
    RETURNING id INTO v_inv_id;

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'invited' WHERE id = p_request_id;
    -- ITEM 5b: the request has been acted on; its inbound alert is done.
    PERFORM resolve_notifications_for_link(
      '/app/ops/intake?request=' || p_request_id::text, auth.uid(), 'request_new');
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id, 'token', v_token, 'contact_id', v_contact,
    'purchase_id', v_purchase, 'categories', v_cats, 'amount', coalesce(v_total, 0),
    'labels', coalesce(v_labels, ARRAY[]::text[]), 'request_id', p_request_id);
END;
$function$;

-- ============================================================================
-- ITEM 4 — redemption must fail clean, never half-linked
-- ============================================================================
-- The FK-reference scan depends on v_dissolved, which is only determined after
-- the survivor decision. It is therefore moved to the EARLIEST correct point:
-- immediately after v_dissolved is computed and BEFORE the first mutation
-- (previously it ran after every UPDATE, leaving a half-merged contact behind
-- when it raised).
CREATE OR REPLACE FUNCTION public.promote_contact_to_account(p_user_id uuid, p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

    -- ITEM 4: FAIL FAST. This scan used to run after the merge UPDATEs below,
    -- so a collision left the data half-moved and the account half-linked.
    -- Now it runs before any mutation: the function either merges completely
    -- or changes nothing at all.
    --
    -- Running it FIRST changes what it must exclude. Previously the migrated
    -- rows were already re-pointed by the time it ran, so they self-excluded.
    -- Now they are still present, so the scan must skip exactly the
    -- (table, column) pairs the merge block below handles — COLUMN-level, not
    -- table-level: documents.archived_by / voided_by / originator_contact_id
    -- and document_shares.granted_by_contact_id are NOT migrated and must
    -- still block a merge, even though sibling columns on those tables are.
    SELECT string_agg(t, ', ') INTO v_refs FROM (
      SELECT format('%s.%s', c.conrelid::regclass, a.attname) AS t
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype = 'f' AND c.confrelid = 'contacts'::regclass
         AND c.conrelid NOT IN ('clients'::regclass, 'profiles'::regclass)
         AND a.attname <> 'deleted_by'
         AND (c.conrelid::regclass::text || '.' || a.attname) NOT IN (
               'documents.contact_id',
               'document_parties.contact_id',
               'signatures.signer_contact_id',
               'contract_parties.contact_id',
               'document_shares.shared_with_contact_id',
               'contact_required_documents.contact_id',
               'invitations.contact_id',
               'groups.contact_id')
         AND EXISTS (SELECT 1 FROM query_to_xml(
               format('SELECT 1 FROM %s WHERE %I = %L LIMIT 1', c.conrelid::regclass, a.attname, v_dissolved),
               false, true, '') x WHERE x IS DOCUMENT)
    ) refs;
    IF v_refs IS NOT NULL THEN
      RAISE EXCEPTION 'promote_contact_to_account: contact % still referenced by % — merge those first', v_dissolved, v_refs;
    END IF;

    UPDATE documents         SET contact_id        = v_survivor WHERE contact_id        = v_dissolved;
    UPDATE document_parties  SET contact_id        = v_survivor WHERE contact_id        = v_dissolved;
    PERFORM set_config('app.allow_signature_rekey', '1', true);
    UPDATE signatures        SET signer_contact_id = v_survivor WHERE signer_contact_id = v_dissolved;
    PERFORM set_config('app.allow_signature_rekey', '0', true);
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

-- ITEM 4 (cont.) — redemption surfaces the conflict instead of half-linking.
-- ITEM 3 (cont.) — LEAD upgrades to CONTACT at redemption.
CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_fn      text;
  v_ln      text;
  v_title   text;
  v_contact uuid;
  v_err     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in before redeeming an invitation';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND status = 'sent' AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  v_fn    := nullif(btrim(coalesce(v_inv.first_name, '')), '');
  v_ln    := nullif(btrim(coalesce(v_inv.last_name,  '')), '');
  v_title := nullif(btrim(coalesce(v_inv.title,      '')), '');

  PERFORM set_config('app.allow_profile_link', '1', true);

  INSERT INTO profiles (user_id, org_id, first_name, last_name, email)
  VALUES (auth.uid(), v_inv.org_id, v_fn, v_ln, v_email)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE profiles
     SET role       = CASE WHEN v_inv.invited_role <> 'USER' THEN v_inv.invited_role ELSE role END,
         is_admin   = CASE WHEN v_inv.invited_role = 'ADMIN' THEN true ELSE is_admin END,
         org_id     = coalesce(org_id, v_inv.org_id),
         first_name = coalesce(nullif(btrim(coalesce(first_name, '')), ''), v_fn),
         last_name  = coalesce(nullif(btrim(coalesce(last_name,  '')), ''), v_ln)
   WHERE user_id = auth.uid();

  -- Resolve the person contact this invitation belongs to: the invitation's
  -- own contact, else the same by-email resolution the provisioning spine
  -- uses (never a company contact, never email-matching the shared pair —
  -- is_company is excluded structurally).
  v_contact := v_inv.contact_id;
  IF v_contact IS NULL THEN
    SELECT c.id INTO v_contact FROM contacts c
     WHERE lower(c.email) = v_email AND c.deleted_at IS NULL AND NOT c.is_company
       AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND p.user_id <> auth.uid())
     ORDER BY c.created_at LIMIT 1;
  END IF;

  IF v_contact IS NOT NULL THEN
    -- ITEM 3: redemption converts a LEAD into a real CONTACT.
    UPDATE contacts SET contact_type = 'CONTACT'
     WHERE id = v_contact AND contact_type = 'LEAD';

    -- THE SPINE: link/merge, signature account-stamp, members, derive groups.
    -- ITEM 4: a merge collision must not dead-end the invitation. The scan in
    -- promote_contact_to_account now runs before any mutation, so catching
    -- here leaves the database untouched; we surface the conflict to staff and
    -- re-raise so the transaction rolls back with the invitation still 'sent'.
    BEGIN
      PERFORM promote_contact_to_account(auth.uid(), v_contact);
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      -- staff-visible record of the collision, outside the doomed transaction
      PERFORM pg_notify('redemption_conflict',
        json_build_object('contact_id', v_contact, 'user_id', auth.uid(),
                          'invitation_id', v_inv.id, 'error', v_err)::text);
      INSERT INTO notifications (org_id, user_id, kind, title, body, link)
      SELECT v_inv.org_id, pr.user_id, 'redemption_conflict',
             'Account linking hit a data conflict',
             'A member could not be linked to their contact record during redemption: '
               || v_err || ' Their invitation remains valid until this is resolved.',
             '/app/ops/contacts/' || v_contact::text
        FROM profiles pr
       WHERE pr.org_id = v_inv.org_id AND coalesce(pr.staff_active, false) = true;
      RAISE EXCEPTION 'account linking hit a data conflict — staff have been notified; your invitation remains valid, try again after it is resolved';
    END;
  ELSE
    -- No person contact exists yet (bare account) — community still follows
    -- the account (D8).
    INSERT INTO members (user_id, status, org_id)
    VALUES (auth.uid(), 'active', v_inv.org_id)
    ON CONFLICT (user_id) DO UPDATE SET status = 'active';
  END IF;

  IF v_inv.invited_role IN ('MANAGER','ADMIN','EMPLOYEE') AND v_title IS NOT NULL THEN
    UPDATE profiles SET title = v_title, staff_active = true WHERE user_id = auth.uid();
  END IF;

  -- Success: 'redeemed' is the new terminal success marker (accepted stays as
  -- the legacy value on historical rows).
  UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;
  RETURN true;
END;
$function$;

-- ============================================================================
-- ITEM 5c — document_executed residue
-- ============================================================================
-- The live body inserted a document_executed alert for v_signer — the person
-- whose own click completed execution — in the same breath as resolving the
-- ready-to-sign alerts. Recipients become the OTHER parties plus staff.
CREATE OR REPLACE FUNCTION public.record_signature(p_document_id uuid, p_party_role text, p_typed_name text, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_esign_consent boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_org uuid; v_signer uuid; v_need int; v_have int; v_status text;
  v_body text; v_hash text; v_sig record; v_user uuid; v_title text;
  v_ip text; v_ua text; r record;
BEGIN
  SELECT org_id INTO v_doc_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_doc_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  v_signer := current_contact_id();
  IF v_signer IS NULL THEN RAISE EXCEPTION 'no contact for the signing account'; END IF;

  IF NOT EXISTS (SELECT 1 FROM document_parties
                  WHERE document_id = p_document_id AND contact_id = v_signer
                    AND party_role = p_party_role AND is_signer) THEN
    RAISE EXCEPTION 'not a signer on this document in role %', p_party_role;
  END IF;

  IF nullif(btrim(coalesce(p_typed_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a typed name is required to sign';
  END IF;

  v_ip := coalesce(nullif(trim(coalesce(p_ip, '')), ''), v_ip);
  v_ua := coalesce(nullif(trim(coalesce(p_user_agent, '')), ''), v_ua);

  INSERT INTO signatures (org_id, document_id, signer_contact_id, signer_user_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_doc_org, p_document_id, v_signer, (SELECT pr.user_id FROM profiles pr WHERE pr.contact_id = v_signer LIMIT 1), p_party_role, p_typed_name, now(), v_ip, v_ua, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO UPDATE
      SET typed_name = EXCLUDED.typed_name,
          signed_at  = EXCLUDED.signed_at,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          method     = EXCLUDED.method
      WHERE signatures.signed_at IS NULL;  -- never overwrite an already-sealed signature

  IF coalesce(p_esign_consent, false) THEN
    INSERT INTO esign_consents (org_id, contact_id, document_id, ip_address, user_agent)
      VALUES (v_doc_org, v_signer, p_document_id, v_ip, v_ua);
  END IF;

  UPDATE documents SET merged_body =
      replace(replace(merged_body,
        '{{SIG.' || p_party_role || '.NAME}}', p_typed_name),
        '{{SIG.' || p_party_role || '.DATE}}', to_char(now(), 'FMMonth FMDD, YYYY'))
    WHERE id = p_document_id AND merged_body IS NOT NULL;

  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM document_parties WHERE document_id = p_document_id;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = p_document_id AND signed_at IS NOT NULL AND deleted_at IS NULL;

  IF v_need > 0 AND v_have >= v_need THEN
    SELECT merged_body INTO v_body FROM documents WHERE id = p_document_id;
    SELECT signer_contact_id, typed_name, signed_at INTO v_sig
      FROM signatures
      WHERE document_id = p_document_id AND signer_contact_id = v_signer
        AND party_role = p_party_role AND deleted_at IS NULL;
    IF FOUND THEN
      v_hash := compute_execution_hash(v_body, v_sig.signer_contact_id, v_sig.typed_name, v_sig.signed_at);
    END IF;

    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date,
                         execution_hash = v_hash, workflow_state = 'executed'
      WHERE id = p_document_id AND status <> 'EXECUTED';

    IF FOUND THEN
      -- the contract is signed: its per-party "ready to sign / in review" alerts
      -- (link /app/contracts/<id>) are no longer valid for anyone — clear all.
      PERFORM resolve_notifications_for_link('/app/contracts/' || p_document_id::text, auth.uid());

      SELECT coalesce(d.title, 'Your document') INTO v_title
        FROM documents d WHERE d.id = p_document_id;

      -- ITEM 5c: notify the OTHER parties, never the signer whose own action
      -- completed execution. Telling someone their own click succeeded is
      -- residue, and it arrived in the same breath as the resolve above.
      FOR r IN
        SELECT DISTINCT pr.user_id
          FROM document_parties dp
          JOIN profiles pr ON pr.contact_id = dp.contact_id
         WHERE dp.document_id = p_document_id
           AND dp.contact_id <> v_signer
           AND pr.user_id IS NOT NULL
      LOOP
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_doc_org, r.user_id, 'document_executed', v_title || ' is signed', '/app/documents');
      END LOOP;

      PERFORM notify_staff(v_doc_org, 'document_executed',
        v_title || ' is signed', '/app/ops/documents');
    END IF;
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$function$;

-- ============================================================================
-- ITEM 5d — termination flow resolves instead of stacking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_contract_termination(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_title text; v_me uuid := current_contact_id(); v_requester uuid; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, title, termination_requested_by INTO v_org, v_title, v_requester
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL
      AND termination_requested_at IS NOT NULL AND workflow_state = 'executed';
  IF v_org IS NULL THEN RAISE EXCEPTION 'no pending termination request'; END IF;
  IF NOT caller_is_document_party_or_staff(p_document_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  UPDATE documents SET workflow_state = 'terminated', terminated_at = now(), terminated_by = v_me,
         updated_at = now()
   WHERE id = p_document_id;

  -- ITEM 5d: the pending request is answered — resolve it rather than leaving
  -- it stacked beside the outcome. Kind-scoped so other contract alerts on the
  -- same link survive.
  PERFORM resolve_notifications_for_link(
    '/app/contracts/' || p_document_id::text, auth.uid(), 'contract_termination_requested');

  FOR r IN
    SELECT DISTINCT pr.user_id FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
     WHERE dp.document_id = p_document_id AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (v_org, r.user_id, 'contract_terminated',
            coalesce(v_title,'A contract') || ' was terminated',
            'The contract has been terminated by mutual agreement and is kept on file as a record.',
            '/app/contracts/' || p_document_id::text);
  END LOOP;
  PERFORM notify_staff(v_org, 'contract_terminated',
    coalesce(v_title,'A contract') || ' was terminated', '/app/ops/documents');
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_contract_termination(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_title text; v_requester uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, title, termination_requested_by INTO v_org, v_title, v_requester
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL
      AND termination_requested_at IS NOT NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'no pending termination request'; END IF;
  IF NOT caller_is_document_party_or_staff(p_document_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  UPDATE documents SET termination_requested_at = NULL, termination_requested_by = NULL,
         termination_request_reason = NULL, updated_at = now()
   WHERE id = p_document_id;

  -- ITEM 5d: same as approve — the request is answered, so it resolves.
  PERFORM resolve_notifications_for_link(
    '/app/contracts/' || p_document_id::text, auth.uid(), 'contract_termination_requested');

  -- tell the requester it was declined
  IF v_requester IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    SELECT v_org, pr.user_id, 'contract_termination_declined',
           coalesce(v_title,'A contract') || ' — termination declined',
           'The other party declined the request to terminate. The contract remains in force.',
           '/app/contracts/' || p_document_id::text
      FROM profiles pr WHERE pr.contact_id = v_requester AND pr.user_id IS NOT NULL;
  END IF;
END;
$function$;

COMMIT;
