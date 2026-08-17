-- TASK-LESSONREQUEST §L3 — THE MISSING PIECE: the agreed time becomes a booking,
-- inside the SAME act that confirms the order, promotes the lead and sends the
-- invitation.
--
-- The chain from inquiry to first lesson had exactly one break. Everything
-- either side of it existed:
--
--   submit → requests + draft order (CAREPATH §C5)          ✅ existed
--   ??? the agreed time → a real booking                     ❌ THE BREAK
--   confirm + promote + invite, one act (CAREPATH §C8)      ✅ existed
--   activate → onboarding → payment → app (ONBOARD)         ✅ existed
--
-- Staff COULD book a lesson from the lead drawer — but only AFTER the invitation
-- had already gone out, through a second, separate action. So the two halves of
-- one phone call ("we agreed Tuesday at 4" + "here is your link") were two acts
-- that could half-succeed, and the invitation email could never name the time,
-- because when it was written the time did not exist yet.
--
-- ⚠️ NOTHING HERE IS A NEW BOOKING WRITER. `schedule_lesson_session` is the
-- incumbent staff lesson writer and stays the only one this path uses; what it
-- gained is BOOKLINK's accounting (§2 below). `provision_client_invitation` is
-- the incumbent one act and stays the only provisioning path; what it gained is
-- one jsonb parameter (§3).
--
-- ⚠️ `requests.proposed_times` IS NEVER TOUCHED. What the visitor WANTED and
-- what was AGREED are different facts with different homes: the ranges stay on
-- the request, the agreed slot lands on the booking. Overwriting the ask with
-- the agreement would make the phone call unauditable, which is the trap this
-- task names by name.
--
-- OWNER RULING, 2026-08-17, on the status the booking lands in:
--   *"The phone call is the agreement — that's the whole design. Your own flow
--   puts payment after activation, so the booking necessarily precedes the
--   money. Unpaid-ness already lives on the order, which is exactly where §C5b
--   put it."*
-- So the booking lands `scheduled`, exactly as every other staff-made booking
-- does (REVIEWQ left staff-made bookings alone deliberately), and NO new
-- booking status becomes reachable. `pending`/`pending_payment` were considered
-- and refused: `pending` means "waiting on the company to decide", and the
-- company has already decided — it decided on the phone.

-- ── 1. the order's timeline records that a time was agreed ─────────────────
-- A SUB-status (is_true_status = false): the order's true status in this same
-- act is `submitted`, and agreeing a time does not change what the order IS.
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status)
VALUES ('order', 'time_agreed', 'Lesson time agreed on the call', false)
ON CONFLICT (entity_type, code) DO NOTHING;

-- ── 2. the incumbent lesson writer learns BOOKLINK's accounting ─────────────
--
-- `schedule_lesson_session` resolved its purchase with
-- `_unambiguous_purchase_for_client` — the pre-BOOKLINK fallback — and debited
-- NOTHING. That was survivable while it only ever ran after provisioning; it is
-- not survivable now, because confirming the enquiry order (draft →
-- awaiting_payment) is the transition `trg_mint_credits_when_order_opens`
-- watches, so the credit for that lesson EXISTS by the time this runs. Without
-- a debit the client would end up holding a booked lesson AND an unspent credit
-- for the same purchase — the double-count CREDITALIGN exists to prevent.
--
-- `_debit_or_create_for_booking` is BOOKLINK's writer, unchanged. The behaviour
-- for a caller who names NO service is byte-identical to before: that function
-- returns immediately with the purchase it was handed, and the coalesce below
-- falls through to the same `_unambiguous_purchase_for_client` call this
-- function has always made.
CREATE OR REPLACE FUNCTION public.schedule_lesson_session(p_client_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_engagement_id uuid DEFAULT NULL::uuid, p_request_id uuid DEFAULT NULL::uuid, p_location text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_horse_id uuid DEFAULT NULL::uuid, p_offering_id uuid DEFAULT NULL::uuid, p_instructor_user_id uuid DEFAULT NULL::uuid, p_purchase_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org     uuid;
  v_contact uuid;
  v_id      uuid;
  v_user    uuid;
  v_instr   uuid;
  v_pur     uuid;
  v_credit  uuid;   -- LESSONREQUEST §L3: what this booking actually drew down
BEGIN
  -- coalesce(): D1a — a caller for whom has_staff_access() is undefined must be
  -- DENIED, not admitted by a NULL falling through the IF.
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR coalesce(has_staff_access(), false)) THEN
    RAISE EXCEPTION 'not authorized to schedule lessons';
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'a lesson needs a start and an end, and the end must be after the start';
  END IF;

  SELECT cl.org_id, cl.contact_id INTO v_org, v_contact
    FROM clients cl WHERE cl.id = p_client_id AND cl.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown client: %', p_client_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'client % is not in your organization', p_client_id;
  END IF;

  -- a supplied horse must belong to the same tenant
  IF p_horse_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM horses h WHERE h.id = p_horse_id AND h.org_id = v_org AND h.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'horse % is not in your organization', p_horse_id;
  END IF;

  -- BOOKWRITE: a supplied offering must be this tenant's
  IF p_offering_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM offerings o WHERE o.id = p_offering_id AND o.org_id = v_org
  ) THEN
    RAISE EXCEPTION 'offering % is not in your organization', p_offering_id;
  END IF;

  -- BOOKWRITE: a supplied purchase must belong to this client
  IF p_purchase_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM purchases pu
     WHERE pu.id = p_purchase_id AND pu.deleted_at IS NULL
       AND pu.org_id = v_org AND pu.buyer_contact_id = v_contact
  ) THEN
    RAISE EXCEPTION 'purchase % does not belong to this client', p_purchase_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.kind = 'lesson' AND b.client_id = p_client_id AND b.org_id = v_org
      AND b.status = 'scheduled'
      AND b.starts_at < p_ends_at AND b.ends_at > p_starts_at
  ) THEN
    RAISE EXCEPTION 'this client already has a lesson scheduled that overlaps % – %',
      to_char(p_starts_at, 'FMMonth FMDD, HH12:MI AM'), to_char(p_ends_at, 'HH12:MI AM');
  END IF;

  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_contact;

  -- who is delivering it: named, else the acting staff member
  v_instr := coalesce(p_instructor_user_id, auth.uid());

  -- ── LESSONREQUEST §L3 — what paid for it, through BOOKLINK's writer ──────
  -- Debits an open credit for this service (preferring the named purchase),
  -- respects a purchase staff named outright, and only creates an order when
  -- there is a service named and nothing anywhere to draw it from. With no
  -- service named it is a no-op that hands the purchase straight back, and the
  -- coalesce below preserves this function's original behaviour exactly.
  SELECT d.purchase_id, d.credit_id INTO v_pur, v_credit
    FROM _debit_or_create_for_booking(p_client_id, p_offering_id, p_purchase_id, NULL, false) d;
  v_pur := coalesce(v_pur, p_purchase_id, _unambiguous_purchase_for_client(p_client_id));

  INSERT INTO bookings
      (org_id, kind, client_id, account_contact_id, account_user_id, request_id, horse_id,
       offering_id, instructor_user_id, purchase_id, credit_id,
       starts_at, ends_at, location, notes, status)
    VALUES
      (v_org, 'lesson', p_client_id, v_contact, v_user, p_request_id, p_horse_id,
       p_offering_id, v_instr, v_pur, v_credit,
       p_starts_at, p_ends_at,
       NULLIF(trim(coalesce(p_location, '')), ''), NULLIF(trim(coalesce(p_notes, '')), ''),
       'scheduled')
    RETURNING id INTO v_id;

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'converted' WHERE id = p_request_id;
  END IF;

  IF v_user IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, v_user, 'lesson_scheduled',
              'Your lesson is booked — ' || to_char(p_starts_at, 'FMMonth FMDD, HH12:MI AM'),
              '/app/schedule');
  END IF;

  RETURN jsonb_build_object(
    'session_id',    v_id,
    'client_id',     p_client_id,
    'starts_at',     p_starts_at,
    'ends_at',       p_ends_at,
    'status',        'SCHEDULED',
    'location',      NULLIF(trim(coalesce(p_location, '')), ''),
    'horse_id',      p_horse_id,
    'offering_id',   p_offering_id,
    'instructor_user_id', v_instr,
    'purchase_id',   v_pur,
    'credit_id',     v_credit,
    'engagement_id', p_engagement_id,
    'request_id',    p_request_id
  );
END;
$function$;

-- Hygiene, not a fix: this function carried PUBLIC and `anon` EXECUTE grants
-- (the ALTER DEFAULT PRIVILEGES that ONBOARD documented). Its own guard already
-- refuses an anonymous caller — proven, `guard_expr = t` under `SET ROLE anon` —
-- so nothing was reachable. The grant was still wrong, and `REVOKE … FROM
-- PUBLIC` alone does NOT remove the direct `anon` grant, so both are named.
REVOKE ALL ON FUNCTION public.schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text, uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- ── 3. the ONE ACT takes the agreed time ───────────────────────────────────
--
-- ⚠️ DROP + CREATE, not CREATE OR REPLACE. A new parameter makes an OVERLOAD,
-- and PostgREST resolves RPCs by argument NAME, so both signatures would be
-- ambiguous for every existing caller (ONBOARD hit this exact wall adding
-- p_phone). One jsonb parameter is used rather than seven scalars precisely so
-- this is the LAST time this signature has to change — `save_calendar_item(p
-- jsonb)` is the same decision, for the same reason.
--
-- ⚠️ AND THE TRAP THAT COMES WITH IT: a dropped function loses its grants, and
-- this database has ALTER DEFAULT PRIVILEGES granting EXECUTE on new functions
-- to `anon` as a DIRECT grant. The REVOKE below therefore names `anon`
-- explicitly; `FROM PUBLIC` would leave the provisioning spine anon-callable.
DROP FUNCTION IF EXISTS public.provision_client_invitation(text, text, text, text[], uuid[], text[], boolean, text, text, uuid, uuid, numeric, text);

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
$function$;

-- The grants the DROP threw away. `anon` is named because `REVOKE … FROM PUBLIC`
-- does not remove a direct grant, and ALTER DEFAULT PRIVILEGES hands `anon` one
-- on every new function in this database.
REVOKE ALL ON FUNCTION public.provision_client_invitation(text, text, text, text[], uuid[], text[], boolean, text, text, uuid, uuid, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provision_client_invitation(text, text, text, text[], uuid[], text[], boolean, text, text, uuid, uuid, numeric, text, jsonb) TO authenticated, service_role;
