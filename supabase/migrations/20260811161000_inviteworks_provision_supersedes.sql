-- TASK INVITEWORKS — one live invitation per person, whichever path created it.
--
-- admin-send-invitation's PLAIN path calls supersede_invitations() right after
-- its insert, so a resend leaves exactly one live link and a lifecycle trail
-- (status='superseded', superseded_by/resend_of). The PROVISIONED path goes
-- through provision_client_invitation, which inserts its invitation and never
-- supersedes anything — so every re-provision and every /sign self-onboarding
-- repeat ("the resume path") stacked another simultaneously-valid token.
--
-- Live evidence before this migration:
--     hello@fhequestrian.com      6 rows status='sent'
--     cjzigs@icloud.com           3
--     cjzigs+averify2@icloud.com  2
--
-- The consequence is not cosmetic: "this link isn't valid anymore — check your
-- inbox for the most recent email" (Register.tsx) is a promise the invite page
-- makes and the provisioned path cannot keep, and the staff invitation trail
-- shows several live links with nothing marking which one is current.
--
-- Only the supersede call is added; the rest of the body is byte-identical to
-- what is live. No self-contained COMMIT — dry-run wrapper first, then apply.

CREATE OR REPLACE FUNCTION public.provision_client_invitation(
  p_email text, p_first_name text, p_last_name text, p_categories text[],
  p_offering_ids uuid[] DEFAULT '{}'::uuid[], p_template_keys text[] DEFAULT NULL::text[],
  p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid,
  p_org_id uuid DEFAULT NULL::uuid, p_partial_amount numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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

  -- INVITEWORKS: the new link is live, so any older live link for this person is
  -- not. Same call the plain path makes, so a resend behaves identically however
  -- the invitation was created: one live token, the prior one kept as trail.
  PERFORM supersede_invitations(v_org, v_email, v_inv_id);

  -- The invitation now EXISTS, so it is evidence. Recompute through the sole
  -- writer: the contact record shows the chosen category immediately, and it is
  -- the same computation activation will run, so the two cannot disagree.
  PERFORM apply_affiliations(v_contact);

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
$fn$;
