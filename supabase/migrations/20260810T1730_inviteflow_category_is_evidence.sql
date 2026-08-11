-- INVITEFLOW — the category you choose at invitation survives to the account.
--
-- Owner decision 2026-08-10 (option A): the admin's choice IS evidence, and
-- apply_affiliations stays the SOLE writer of group rows.
--
-- WHAT WAS WRONG. Three rules were fighting, and the person always lost:
--   1. provision_client_invitation wrote no group at all — the chosen category
--      only drove the paperwork.
--   2. promote_buyer_from_offering (AFTER INSERT ON purchase_items) wrote one
--      DIRECTLY, from the OFFERING'S SEGMENT rather than from the admin's
--      choice. That was the only reason an invite with an order had a category.
--   3. redeem_invitation -> promote_contact_to_account -> apply_affiliations
--      recomputed from executed documents + horse ownership. At activation
--      nothing is signed yet, so it DELETED whatever step 2 had written.
-- Reproduced against production on all six invite shapes (Rider / Horse owner /
-- both, each with and without an order): every one activated into NO category.
-- Claire Bourdon's audit trail is this exact sequence — her two group rows were
-- removed at 15:56:31, the same instant her profile was created.
--
-- THE FIX. derive_affiliations gains the two evidence sources the system was
-- already acting on but never recorded:
--   * a LIVE invitation's categories (the admin's decision, revoked and
--     superseded invitations excluded — a withdrawn or replaced decision is not
--     evidence), and
--   * a real purchase, by the offering's segment — which is precisely what the
--     trigger used to write by hand.
-- The trigger stops writing and asks for a recompute; provisioning asks for one
-- too, so the record shows the category from the moment the invite goes out
-- instead of only after an order.
--
-- NO BEGIN/COMMIT IN THIS FILE. The house discipline is to dry-run a migration
-- inside `BEGIN; \i <file>; ROLLBACK;` against production first — and a COMMIT
-- inside the file ends that wrapper, so the "dry" run lands for real. That is
-- exactly what happened on the first attempt at this one.

-- ── 1. derive_affiliations: two new evidence sources ────────────────────────
CREATE OR REPLACE FUNCTION public.derive_affiliations(p_contact_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ex AS (
    SELECT bool_or(t.template_key = 'RELEASE_PARTICIPANT') AS sig_rider,
           bool_or(t.template_key = 'RELEASE_HORSE_CARE')  AS sig_care,
           bool_or(t.template_key = 'HORSE_EMERGENCY_VET') AS sig_vet,
           bool_or(t.template_key = 'RELEASE_GENERAL')     AS sig_guest
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contact_id = p_contact_id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
  ),
  -- THE ADMIN'S DECISION. Matched on invitations.contact_id only — never on
  -- email, because two staff identities share one inbox on this tenant and an
  -- email match would hand one person's category to another.
  inv AS (
    SELECT DISTINCT upper(btrim(c)) AS cat
      FROM invitations i, unnest(coalesce(i.categories, '{}'::text[])) c
     WHERE i.contact_id = p_contact_id
       AND i.deleted_at IS NULL
       AND coalesce(i.status, '') NOT IN ('revoked', 'superseded')
       AND btrim(c) <> ''
  ),
  -- THE PURCHASE. Exactly the rule promote_buyer_from_offering applied by hand:
  -- segment rider -> RIDER, segment horse -> HORSE_OWNER; inquire-only lines and
  -- voided purchases are not a purchase.
  pur AS (
    SELECT DISTINCT lower(coalesce(o.segment, '')) AS seg
      FROM purchases p
      JOIN purchase_items pi ON pi.purchase_id = p.id
      JOIN offerings o       ON o.id = pi.offering_id
     WHERE p.buyer_contact_id = p_contact_id
       AND coalesce(p.status, '') <> 'void'
       AND p.deleted_at IS NULL
       AND coalesce(o.config_kind, '') <> 'inquire'
  )
  SELECT (
    SELECT array_agg(g ORDER BY g) FROM (
      -- GUEST: the visitor release is the affiliation (2026-08-04). Without
      -- this, signing the general release granted NO affiliation at all, so a
      -- visitor had documents on file and no category to hang them on. It is
      -- additive: a guest who later signs a participant release simply gains
      -- RIDER alongside it.
      SELECT 'GUEST'::text AS g
       WHERE (SELECT sig_guest FROM ex)
          OR EXISTS (SELECT 1 FROM inv WHERE cat = 'GUEST')
      UNION
      SELECT 'RIDER'::text AS g
       WHERE (SELECT sig_rider FROM ex)
          OR EXISTS (SELECT 1 FROM inv WHERE cat = 'RIDER')
          OR EXISTS (SELECT 1 FROM pur WHERE seg = 'rider')
      UNION
      SELECT 'HORSE_OWNER'
       WHERE (SELECT (sig_care AND sig_vet) FROM ex)
          OR EXISTS (SELECT 1 FROM horses h
                      WHERE h.current_owner_contact_id = p_contact_id AND h.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM inv WHERE cat = 'HORSE_OWNER')
          OR EXISTS (SELECT 1 FROM pur WHERE seg = 'horse')
      UNION
      SELECT 'PARENT_GUARDIAN' WHERE EXISTS (
        SELECT 1 FROM document_parties dp
         WHERE dp.contact_id = p_contact_id AND dp.party_role = 'GUARDIAN')
    ) s
  );
$function$;

-- ── 2. the purchase trigger stops being a second writer ─────────────────────
CREATE OR REPLACE FUNCTION public.promote_buyer_from_offering()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_kind    text;
  v_all     text[];
BEGIN
  SELECT p.buyer_contact_id, p.org_id INTO v_contact, v_org
    FROM purchases p WHERE p.id = NEW.purchase_id;
  IF v_contact IS NULL OR v_org IS NULL THEN RETURN NEW; END IF;

  SELECT o.config_kind INTO v_kind FROM offerings o WHERE o.id = NEW.offering_id;
  IF v_kind IS NULL OR v_kind = 'inquire' THEN RETURN NEW; END IF;

  -- No INSERT INTO groups here any more. The purchase is evidence inside
  -- derive_affiliations now, so this asks apply_affiliations — the sole writer —
  -- to recompute, and uses what it returns.
  v_all := coalesce(apply_affiliations(v_contact), ARRAY[]::text[]);

  -- EVERY affiliation this person now holds, so the replace-semantics of
  -- apply_category_documents cannot strip an earlier category's documents.
  PERFORM apply_category_documents(
    v_contact,
    ARRAY(SELECT g FROM unnest(v_all) g WHERE g IN ('GUEST', 'RIDER', 'HORSE_OWNER')));
  RETURN NEW;
END;
$function$;

-- ── 3. provisioning asks for the recompute, so the record is right at once ──
-- Identical to the live definition except for the apply_affiliations call after
-- the invitation row exists (the invitation is the evidence, so it has to be
-- written first).
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
$function$;
