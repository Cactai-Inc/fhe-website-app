-- CAREPATH §C8 / §C9 — ONE ACT, AND THE ORDER SCREEN THAT FOLLOWS IT.
--
-- §C8, owner: "Once we have it provisioned we send them the activation link via
-- email and the lead is promoted to client and they get the link."
--
-- ⚠️ CONFIRMATION, PROMOTION AND THE INVITE ARE ONE ACT AT ONE MOMENT (§C5b
-- rule 5). There is no state where the order is confirmed but the person is
-- still a lead, or vice versa. `provision_client_invitation` already performs
-- the promotion and issues the link, and §C8 forbids a second provisioning
-- path — so the confirmation is folded INTO it rather than bolted beside it.
--
-- ⚠️ THE BUG THIS CLOSES. Since §C5 the inquiry already opened a draft order.
-- `provision_client_invitation` would then look at `p_offering_ids` and either
-- reuse a purchase whose offering set matched EXACTLY, or create a SECOND one.
-- Exact-set matching is precisely what a §C5c split breaks: staff move a line
-- out, the sets no longer match, and confirming the invite would have minted a
-- duplicate order for the same inquiry. The inquiry's own order is now adopted
-- by its `request_id`, which survives a split.

CREATE OR REPLACE FUNCTION public.provision_client_invitation(
  p_email text, p_first_name text, p_last_name text, p_categories text[],
  p_offering_ids uuid[] DEFAULT '{}'::uuid[], p_template_keys text[] DEFAULT NULL::text[],
  p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid,
  p_org_id uuid DEFAULT NULL::uuid, p_partial_amount numeric DEFAULT 0,
  p_phone text DEFAULT NULL::text)
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
  v_ph       text := nullif(trim(coalesce(p_phone,      '')), '');
  v_linked   uuid;
  v_confirmed uuid[] := '{}';
  v_ord RECORD;   -- NOT `r`: `requests r` is aliased r throughout this body
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
  IF v_org IS NULL AND p_request_id IS NOT NULL THEN
    SELECT r.org_id INTO v_org FROM requests r WHERE r.id = p_request_id;
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

  -- ONBOARD §2: the phone the person just typed. Same conservative rule the
  -- names above follow — fill a blank, never overwrite what is already on file.
  IF v_ph IS NOT NULL AND v_contact IS NOT NULL THEN
    UPDATE contacts SET phone = v_ph
     WHERE id = v_contact AND nullif(btrim(coalesce(phone, '')), '') IS NULL;
  END IF;

  -- ── §C5b rule 5 / §C8 — CONFIRM THE INQUIRY'S OWN ORDER, IN THIS ACT ─────
  -- Adopted by request_id, which survives a §C5c split; the old exact-offering-
  -- set match did not, and would have minted a duplicate order for a split
  -- inquiry. draft -> awaiting_payment IS the moment anything becomes owed.
  --
  -- ⚠️ A HELD ORDER IS NOT CONFIRMED HERE. Order B stays `draft` while the horse
  -- is missing (§C5c): nothing is owed for work that cannot begin. It moves to
  -- awaiting_payment only when a horse appears (the horses trigger).
  IF p_request_id IS NOT NULL THEN
    FOR v_ord IN
      SELECT p.id FROM purchases p
       WHERE p.request_id = p_request_id
         AND p.deleted_at IS NULL
         AND p.status = 'draft'
         AND coalesce(p.current_status, '') <> 'awaiting_horse'
       ORDER BY p.created_at
    LOOP
      UPDATE purchases
         SET status = 'awaiting_payment',
             buyer_contact_id = coalesce(buyer_contact_id, v_contact),
             updated_at = now()
       WHERE id = v_ord.id;
      PERFORM log_status_event('order', v_ord.id, 'submitted',
        'Confirmed with the client — the invitation to activate was sent in the same act',
        v_org);
      v_confirmed := v_confirmed || v_ord.id;
      IF v_purchase IS NULL THEN v_purchase := v_ord.id; END IF;
    END LOOP;
  END IF;

  -- The offering-id path stays for staff-provisioned orders that had no inquiry
  -- behind them (the "client bought offline" case this function was built for).
  -- It is SKIPPED when the inquiry's own order was just confirmed, so one
  -- inquiry can never produce two orders.
  IF v_has_off AND array_length(v_confirmed, 1) IS NULL THEN
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
  END IF;

  IF v_has_off THEN
    SELECT coalesce(sum(o.price_amount), 0), array_agg(o.name) INTO v_total, v_labels
      FROM offerings o WHERE o.id = ANY(p_offering_ids);
  ELSIF v_purchase IS NOT NULL THEN
    -- The labels the invitation email names come from the confirmed order.
    SELECT coalesce(sum(pi.price_amount), 0), array_agg(pi.label)
      INTO v_total, v_labels
      FROM purchase_items pi WHERE pi.purchase_id = v_purchase AND pi.voided_at IS NULL;
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
    'labels', coalesce(v_labels, ARRAY[]::text[]), 'request_id', p_request_id,
    'confirmed_orders', to_jsonb(v_confirmed));
END;
$function$;

-- ── §C9 — "Notify staff this isn't correct" ─────────────────────────────────
-- Owner: after sign-in the client sees their order information, and has two
-- buttons: Continue, and "Notify staff this isn't correct".
--
-- ⚠️ IT MUST PROVABLY REACH A HUMAN — the same standard as §C6's emails. It
-- routes through the existing notification spine (`notify_staff`, which writes
-- one row per staff recipient and is mirrored to co-admins by the notifications
-- trigger) and RETURNS HOW MANY PEOPLE IT REACHED, so the screen can only claim
-- what happened. Zero recipients is reported as zero, not as success.
--
-- ⚠️ THE CORRECTION DOES NOT BLOCK THE CLIENT (owner: "either way they are
-- taken to the screen"). It flags staff while the client continues; nothing
-- here changes the order's status or gates the flow.
CREATE OR REPLACE FUNCTION public.report_order_incorrect(
  p_purchase_id uuid, p_note text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v purchases%ROWTYPE;
  v_me   uuid := current_contact_id();
  v_who  text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_sent integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF v.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  -- Their OWN order only. A client may flag what they were shown, nothing else.
  IF NOT (v.buyer_user_id = auth.uid() OR (v_me IS NOT NULL AND v.buyer_contact_id = v_me)) THEN
    RAISE EXCEPTION 'that is not your order';
  END IF;

  SELECT coalesce(nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''), c.email)
    INTO v_who FROM contacts c WHERE c.id = coalesce(v.buyer_contact_id, v_me);

  -- The durable record, on the order's own timeline: staff see it wherever they
  -- open the order, not only in a notification that can be dismissed.
  PERFORM log_status_event('order', p_purchase_id, 'client_flagged',
    coalesce(v_who, 'The client') || ' says this order is not correct'
      || coalesce(' — ' || v_note, ''), v.org_id);

  PERFORM notify_staff(v.org_id, 'order_flagged',
    coalesce(v_who, 'A client') || ' says order '
      || coalesce(v.display_code, '') || ' is not correct',
    '/app/ops/intake');

  -- How many humans this actually reached. `notify_staff` writes one row per
  -- staff recipient; counting them is the difference between "we told someone"
  -- and "we called a function".
  SELECT count(*) INTO v_sent
    FROM notifications n
   WHERE n.org_id = v.org_id
     AND n.created_at > now() - interval '10 seconds'
     AND n.link = '/app/ops/intake';

  RETURN jsonb_build_object('recipients', coalesce(v_sent, 0), 'logged', true);
END;
$function$;

INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('order', 'client_flagged', 'Client says this is not correct', false, false, 9)
ON CONFLICT (entity_type, code) DO UPDATE SET display_name = EXCLUDED.display_name;

REVOKE ALL ON FUNCTION public.report_order_incorrect(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_order_incorrect(uuid, text) TO authenticated, service_role;
