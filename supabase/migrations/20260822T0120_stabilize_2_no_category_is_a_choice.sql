-- TASK-STABILIZE ITEM 2 — a party whose only relationship is the contract.
--
-- The task brief said a fourth account category does not exist. It does:
-- 'Deal client' has been on the staff provisioning form since CAREPATH, mapped
-- to the GUEST token, and PARTYROLE recorded the owner's ruling that it signs
-- Guest's three documents because a deal client comes to the property.
--
-- The owner's ruling for THIS task (2026-08-22) is therefore not "add a fifth":
--
--   "Do not touch 'Deal client', it keeps its PARTYROLE meaning unchanged.
--    Do not add a fifth token either. An account gets tags that ENABLE an
--    action, never OBLIGATE one on their own... For a party who signs nothing
--    but the contract: select ZERO categories, not a new one."
--
-- ZERO CATEGORIES WAS NOT ACTUALLY POSSIBLE. Two guards refused it, one in the
-- browser (ProvisionClientForm's submit button is disabled while
-- `categories.length === 0`) and one here (`RAISE EXCEPTION 'at least one
-- category is required'`). This migration removes the server half and makes the
-- empty set mean what it says: no group, no category document, no obligation.
--
-- What is NOT changed: no new token, no new table, no schema change, no change
-- to 'Deal client', and no change to what any non-empty category set assigns.

CREATE OR REPLACE FUNCTION public.provision_client_invitation(p_email text, p_first_name text, p_last_name text, p_categories text[], p_offering_ids uuid[] DEFAULT '{}'::uuid[], p_template_keys text[] DEFAULT NULL::text[], p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid, p_org_id uuid DEFAULT NULL::uuid, p_partial_amount numeric DEFAULT 0, p_phone text DEFAULT NULL::text, p_agreed_lesson jsonb DEFAULT NULL::jsonb)
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
  -- STABILIZE ITEM 2: the caller deliberately named no category (see below).
  v_no_cats  boolean := false;
  v_email    text := lower(trim(p_email));
  v_fn       text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln       text := nullif(trim(coalesce(p_last_name,  '')), '');
  v_ph       text := nullif(trim(coalesce(p_phone,      '')), '');
  v_linked   uuid;
  v_confirmed uuid[] := '{}';
  v_ord RECORD;   -- NOT `r`: `requests r` is aliased r throughout this body
  -- LESSONREQUEST §L3
  v_start    timestamptz;
  v_end      timestamptz;
  v_off      uuid;
  v_session  jsonb;
  v_agreed   jsonb := NULL;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR coalesce(has_staff_access(), false)) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  -- ⚠️ CATEGORISE §2 — the "at least one category is required" guard USED TO BE
  -- HERE. It moved below the org resolution, unchanged, because the cart-derived
  -- default needs the org and nothing between here and there reads v_cats.

  v_org := p_org_id;
  IF v_org IS NULL AND v_has_off THEN
    SELECT o.org_id INTO v_org FROM offerings o WHERE o.id = p_offering_ids[1];
  END IF;
  IF v_org IS NULL AND p_request_id IS NOT NULL THEN
    SELECT r.org_id INTO v_org FROM requests r WHERE r.id = p_request_id;
  END IF;
  v_org := coalesce(v_org, current_org());
  IF v_org IS NULL THEN RAISE EXCEPTION 'could not resolve org for this invitation'; END IF;

  -- ── CATEGORISE §2 — WHEN NO CATEGORY WAS CHOSEN, THE CART DECIDES ────────
  --
  -- Until now the only categories this function ever saw were the ones a staff
  -- member ticked, and the screen's suggestion came from the FUNNEL the visitor
  -- happened to be standing in — so a cart holding a riding lesson and a horse
  -- clipping was filed under one of them and the person signed one of the two
  -- document sets. The cart is the fact; the funnel is an accident of navigation.
  --
  -- ⚠️ THE DERIVATION IS A DEFAULT, NOT A CAGE (§2). It runs ONLY when the caller
  -- named no category at all. A staff member who ticks boxes still gets exactly
  -- what they ticked, including a deliberate narrowing — a phone call can reveal
  -- what a cart cannot, in both directions.
  --
  -- `request_onboarding_categories` returns DISPLAY categories and already
  -- unions in whatever the contact holds, so this can only ever ADD. The token
  -- translation is `segment_categories`, not a second copy of the browser's
  -- CATEGORY_TOKEN map: 'Deal client' resolves to GUEST, which is the one label
  -- whose token is not simply its own name, and getting it wrong here would
  -- assign an acquisition client NOTHING (apply_category_documents rule 1a
  -- returns early on an unmatched category rather than raising).
  IF (v_cats IS NULL OR array_length(v_cats, 1) IS NULL) AND p_request_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT x.tok) INTO v_cats
      FROM unnest(request_onboarding_categories(p_request_id)) c
      CROSS JOIN LATERAL (
        SELECT coalesce(
                 (SELECT sc.onboarding_token FROM segment_categories sc
                   WHERE sc.org_id = v_org AND sc.onboarding_category = c LIMIT 1),
                 upper(replace(btrim(c), ' ', '_'))) AS tok) x
     WHERE btrim(c) <> '';
  END IF;

  -- ── STABILIZE ITEM 2 — NO CATEGORY IS A CHOICE, NOT AN ERROR ─────────────
  --
  -- Owner, 2026-08-22: "an account gets tags that ENABLE an action, never
  -- OBLIGATE one on their own... For a party who signs nothing but the
  -- contract: select ZERO categories, not a new one."
  --
  -- This guard is what made that impossible. `RAISE EXCEPTION 'at least one
  -- category is required'` refused the very shape the owner needs — a person
  -- whose only relationship to the business is a contract, who never visits,
  -- never rides and never boards a horse, and therefore owes none of the
  -- category paperwork. It is replaced by a FLAG, not deleted: everything
  -- downstream that would otherwise DEFAULT an empty category set to GUEST
  -- reads it and assigns nothing instead.
  --
  -- ⚠️ NO NEW TOKEN AND NO SCHEMA CHANGE (owner ruling, same message).
  -- 'Deal client' keeps its PARTYROLE meaning exactly — a client who comes to
  -- the property and signs what any guest signs. Nothing about it moves here.
  v_no_cats := (v_cats IS NULL OR array_length(v_cats, 1) IS NULL);

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
      ELSIF NOT v_no_cats THEN
        PERFORM apply_category_documents(v_contact, v_cats);
      END IF;
      -- v_no_cats + no template_keys: assign nothing. Passing an empty array to
      -- apply_category_documents would NOT be a no-op here — with no categories
      -- it falls back to reading this contact's existing RIDER/HORSE_OWNER
      -- groups, which is the opposite of what "no category" was just asked for.
    END IF;
  END IF;

  -- single-sourced account creation (unchanged path when there is no link)
  IF v_contact IS NULL THEN
    -- ⚠️ `_ensure_client_account` DEFAULTS an empty p_categories to ARRAY['GUEST']
    -- and then, for a contact it just created, calls apply_category_documents
    -- with it — so passing NULL template keys alongside no categories would
    -- silently assign Company Policies, Facility Rules and the General Release
    -- to the one person who owes none of them. An EXPLICIT empty array takes the
    -- documented '{}' branch instead: nothing inserted, nothing deleted. Same
    -- call redeem_contract_invitation makes, for the same reason.
    v_acct    := _ensure_client_account(v_org, v_email, v_fn, v_ln, v_cats,
                   CASE WHEN v_no_cats THEN coalesce(p_template_keys, ARRAY[]::text[])
                        ELSE p_template_keys END);
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

  -- ── LESSONREQUEST §L3 — THE AGREED TIME, IN THIS SAME ACT ────────────────
  --
  -- Runs AFTER the order is confirmed, because that transition is what mints
  -- the credit this booking draws down, and BEFORE the request is flipped to
  -- `invited` below — `schedule_lesson_session` sets it to `converted`, and
  -- `invited` is the truer word here: they have been invited, and conversion is
  -- what happens when they activate.
  --
  -- The visitor's `proposed_times` are NOT read, NOT copied and NOT overwritten.
  -- Staff choose the slot from the phone call; the ranges are shown beside the
  -- picker in the UI so an out-of-range choice is visible, never silent.
  IF p_agreed_lesson IS NOT NULL THEN
    v_start := nullif(btrim(coalesce(p_agreed_lesson->>'starts_at', '')), '')::timestamptz;
    v_end   := nullif(btrim(coalesce(p_agreed_lesson->>'ends_at',   '')), '')::timestamptz;
  END IF;

  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    IF v_client IS NULL THEN
      RAISE EXCEPTION 'cannot book the agreed lesson: no client record was resolved for %', v_email;
    END IF;

    -- Which service the lesson is against: what staff named, else the first
    -- rider-segment line ON THE ORDER THEY JUST CONFIRMED. Read from the order
    -- rather than guessed, so the booking draws down the thing they bought.
    v_off := nullif(btrim(coalesce(p_agreed_lesson->>'offering_id', '')), '')::uuid;
    IF v_off IS NULL AND v_purchase IS NOT NULL THEN
      SELECT pi.offering_id INTO v_off
        FROM purchase_items pi
        JOIN offerings o ON o.id = pi.offering_id
       WHERE pi.purchase_id = v_purchase AND pi.voided_at IS NULL AND o.segment = 'rider'
       ORDER BY pi.created_at
       LIMIT 1;
    END IF;

    -- THE INCUMBENT WRITER. Not an INSERT here; not a second one anywhere.
    SELECT schedule_lesson_session(
             v_client, v_start, v_end,
             NULL,                                                            -- p_engagement_id
             p_request_id,
             nullif(btrim(coalesce(p_agreed_lesson->>'location', '')), ''),
             nullif(btrim(coalesce(p_agreed_lesson->>'notes',    '')), ''),
             nullif(btrim(coalesce(p_agreed_lesson->>'horse_id', '')), '')::uuid,
             v_off,
             nullif(btrim(coalesce(p_agreed_lesson->>'instructor_user_id', '')), '')::uuid,
             v_purchase)
      INTO v_session;

    v_agreed := jsonb_build_object(
      'booking_id', v_session->>'session_id',
      'starts_at',  v_start,
      'ends_at',    v_end,
      'offering_id', v_off,
      'credit_id',  v_session->>'credit_id');

    -- The agreement goes on the order's own timeline, so it is visible wherever
    -- staff open the order — not only on the lead drawer that produced it.
    --
    -- ⚠️ THE SLOT IS DELIBERATELY NOT SPELLED OUT IN THIS SENTENCE. There is no
    -- tenant timezone anywhere in this database (checked: no `timezone`-shaped
    -- column exists on any table), so a server-side `to_char` renders UTC — the
    -- first draft of this line printed a 4pm lesson as "11:00 PM". The booking
    -- row already holds the instant, and every surface that shows it renders it
    -- in the reader's own zone. One fact, one home, no invented configuration.
    -- The wider defect this exposed is reported, not silently worked around.
    IF v_purchase IS NOT NULL THEN
      PERFORM log_status_event('order', v_purchase, 'time_agreed',
        'The first lesson was booked in the same act — see the calendar entry for the slot',
        v_org);
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
    'confirmed_orders', to_jsonb(v_confirmed),
    'client_id', v_client,
    'agreed_lesson', v_agreed);
END;
$function$

;
