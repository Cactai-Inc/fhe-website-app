-- TASK-LIFECYCLE · D — EVERY ADVANCE IS ONE BUTTON, PRESSED BY THE SIDE THE
-- SOFTWARE REQUIRED
--
-- Owner, 2026-09-01: *"status should set automatically for the calendar entry
-- based on the stage of approval and payment … each seqential interaction that
-- advances the order's payment status being the result of a button clicked by
-- either party as required by the software."*
--
-- The ping-pong, and who presses:
--   client asks for a time      → `requested`   (request_open_time / book_open_slot)
--   staff approve, order unpaid → `approved`    (decide_booking_change → request_purchase_payment)
--   client declares a method    → `pending`     (report_my_payment)
--   staff confirm the money     → `scheduled`   (the trigger at the foot of this file)
--   either side moves it        → `moved`       (request_booking_change — the hold)
--
-- ⚠️ NOT ONE OF THESE IS A DROPDOWN. There is no typed status anywhere in this
-- task, and no second state machine: every transition is written by the function
-- that already owned that act.
--
-- ⚠️ EVERY BODY BELOW WAS EXTRACTED FROM PRODUCTION WITH `pg_get_functiondef`
-- AND EDITED BY ANCHORED SUBSTITUTION, so nothing was retyped and nothing else
-- moved. All are `CREATE OR REPLACE` on the SAME signature — no DROP, so no ACL
-- reset (TASK-ROLE §2a).

-- ── ONE PREDICATE FOR "DOES THIS SESSION STILL OWE MONEY?" ─────────────────
-- ⚠️ TWO SURFACES APPROVE A REQUEST, AND THEY CALL DIFFERENT FUNCTIONS.
-- `CalendarPage.tsx:1320` (`confirmNew`) and `CalendarItemPanel.tsx:426` both
-- call `confirm_booking`; the queue's Decide button calls
-- `decide_booking_change`. Had the rule been written into only the one the spec
-- names, `approved` would have been unreachable from the button staff actually
-- press — TASK-ROLE §2b, a green function nothing reaches. It is written ONCE,
-- here, and both callers ask it.
CREATE OR REPLACE FUNCTION public.booking_awaiting_payment(p_booking bookings)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- Skipped exactly where the owner said `approved` is skipped: the session was
  -- bought with a credit, there is no order behind it, the order is paid, or it
  -- owes nothing.
  SELECT p_booking.credit_id IS NULL
     AND p_booking.purchase_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM purchases p
        WHERE p.id = p_booking.purchase_id
          AND p.deleted_at IS NULL
          AND p.status <> 'void'
          AND coalesce(p.payment_status,'') <> 'paid'
          AND greatest(coalesce(p.amount,0) - coalesce(p.amount_paid,0), 0) > 0);
$function$;

REVOKE EXECUTE ON FUNCTION public.booking_awaiting_payment(bookings) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.booking_awaiting_payment(bookings) FROM anon;
GRANT  EXECUTE ON FUNCTION public.booking_awaiting_payment(bookings) TO authenticated;

-- ── THE OTHER APPROVE BUTTON ───────────────────────────────────────────────
-- `confirm_booking` is what the staff queue's "Confirm" and the item panel both
-- press. Its guard is renamed to the three real pre-firm states (TASK-LIFECYCLE
-- A), and it now lands on `approved` and asks for the money on exactly the same
-- condition `decide_booking_change` does.
CREATE OR REPLACE FUNCTION public.confirm_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_b bookings%ROWTYPE; v_owes boolean;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found in this org'; END IF;
  IF v_b.status NOT IN ('requested','approved','pending') THEN
    RAISE EXCEPTION 'only a requested, approved or pending booking can be confirmed'; END IF;

  v_owes := booking_awaiting_payment(v_b);

  UPDATE bookings
     SET status = CASE WHEN v_owes THEN 'approved'
                       WHEN kind = 'lesson' THEN 'scheduled' ELSE 'confirmed' END,
         updated_at = now()
   WHERE id = p_booking_id;

  UPDATE booking_change_requests SET status='approved', decided_by=auth.uid(), decided_at=now()
   WHERE booking_id = p_booking_id AND status='pending';

  IF v_owes THEN
    -- the ask for the money raises the buyer's "payment due" notice and the
    -- staff copy through notify_purchase_unpaid, so this branch does not also
    -- send a "confirmed" notice for a session that is not confirmed yet.
    PERFORM request_purchase_payment(v_b.purchase_id, NULL);
    RETURN jsonb_build_object('status', 'approved', 'payment_requested', true);
  END IF;

  IF v_b.account_user_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_confirmed',
              'Your session on ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM') || ' is confirmed',
              '/app/calendar');
  END IF;
  RETURN jsonb_build_object('status', 'confirmed', 'payment_requested', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_open_time(p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_offering_id uuid DEFAULT NULL::uuid, p_horse_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid := current_client_id();
  v_org    uuid := current_org();
  v_contact uuid := current_contact_id();
  v_kind   text := 'lesson';
  v_id     uuid;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'pick a start and a later end';
  END IF;
  IF p_starts_at < now() THEN RAISE EXCEPTION 'pick a future time'; END IF;

  IF p_offering_id IS NOT NULL THEN
    SELECT CASE WHEN o.segment = 'horse' THEN 'care' ELSE 'lesson' END INTO v_kind
      FROM offerings o WHERE o.id = p_offering_id;
    v_kind := coalesce(v_kind, 'lesson');
  END IF;

  -- a horse can't be double-booked
  IF p_horse_id IS NOT NULL AND horse_time_conflict(v_org, p_horse_id, p_starts_at, p_ends_at, NULL, NULL) THEN
    RAISE EXCEPTION 'that horse is already booked in an overlapping time';
  END IF;

  INSERT INTO bookings (org_id, kind, status, client_id, account_user_id, account_contact_id,
      offering_id, horse_id, starts_at, ends_at, notes)
    VALUES (v_org, v_kind, 'requested', v_client, auth.uid(), v_contact,
            p_offering_id, p_horse_id, p_starts_at, p_ends_at,
            NULLIF(btrim(coalesce(p_note,'')),''))
    RETURNING id INTO v_id;

  -- ⚠️ LIFECYCLE: a credit-holder picking a time IS the owner's `requested`
  -- state — his first of six. It was 'pending', which is the state AFTER a
  -- payment method has been declared, and which is why nobody could tell an
  -- unanswered ask from an unpaid one.
  -- REVIEWQ R2: the companion request row the staff queue reads (see
  -- book_open_slot above — same shape, same reasoning).
  INSERT INTO booking_change_requests (
    org_id, booking_id, requested_by, request_kind,
    proposed_starts_at, proposed_ends_at, note, status)
  VALUES (v_org, v_id, auth.uid(), 'new', p_starts_at, p_ends_at,
          NULLIF(btrim(coalesce(p_note,'')),''), 'pending');

  PERFORM notify_staff(v_org, 'booking_time_requested',
    'A client requested ' || to_char(p_starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', v_id, 'status', 'requested');
END;
$function$;

CREATE OR REPLACE FUNCTION public.book_open_slot(p_booking_id uuid, p_horse_id uuid DEFAULT NULL::uuid, p_credit_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client  uuid := current_client_id();
  v_contact uuid := current_contact_id();
  v_b       bookings%ROWTYPE;
  v_kind    text;
  v_offering uuid;
  v_credit  uuid;
  v_gate    jsonb;
  v_cr_off  uuid;
  v_cr_pur  uuid;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR NOT v_b.is_flexible OR v_b.status <> 'available' THEN
    RAISE EXCEPTION 'that time is no longer open';
  END IF;

  SELECT CASE WHEN o.segment = 'horse' THEN 'care' ELSE 'lesson' END, o.id
    INTO v_kind, v_offering
    FROM offerings o WHERE o.id = v_b.offering_id;
  v_kind := coalesce(v_kind, 'lesson');

  IF v_kind = 'care' THEN
    IF p_horse_id IS NULL THEN RAISE EXCEPTION 'a horse is required for a care booking'; END IF;
    v_gate := assert_horse_care_eligible(v_contact, p_horse_id);
    IF NOT (v_gate->>'eligible')::boolean THEN
      RAISE EXCEPTION 'HORSE_CARE_DOCS_REQUIRED: %', v_gate->>'missing'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- lesson branch: an explicit horse must be one the caller may use (owner or
  -- active lease); NULL stays allowed (barn-supplied horse). No care-docs gate
  -- here — that's care-specific.
  IF v_kind = 'lesson' AND p_horse_id IS NOT NULL THEN
    IF NOT caller_may_use_horse(v_contact, p_horse_id) THEN
      RAISE EXCEPTION 'that horse is not yours';
    END IF;
  END IF;

  -- ── ONBOARD §7: the member NAMED which purchased item this is against ──
  -- Their choice is honoured exactly: this credit or nothing. Falling back to
  -- "some other credit" would silently spend the wrong thing, which is worse
  -- than telling them the one they picked is gone.
  -- CREDITALIGN: "gone" now also means "last month's" — an allotment past its
  -- expires_at is not spendable, because the month does not carry over.
  IF p_credit_id IS NOT NULL THEN
    UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
     WHERE id = (SELECT lc.id FROM lesson_credits lc
                  WHERE lc.id = p_credit_id
                    AND lc.client_id = v_client
                    AND lc.deleted_at IS NULL
                    AND lc.credits_remaining > 0
                    AND (lc.expires_at IS NULL OR lc.expires_at > now())
                  FOR UPDATE)
     RETURNING id INTO v_credit;
    IF v_credit IS NULL THEN RAISE EXCEPTION 'NO_CREDITS'; END IF;
  ELSE
  -- credit-gated: both lessons and care debit one service credit, preferring a
  -- credit tagged with this offering, falling back to any untagged balance.
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (SELECT id FROM lesson_credits
               WHERE client_id = v_client AND org_id = v_b.org_id
                 AND deleted_at IS NULL AND credits_remaining > 0
                 AND (expires_at IS NULL OR expires_at > now())
                 AND (
                   -- offering-tagged slot: that offering's credits, or untagged
                   (v_offering IS NOT NULL AND (offering_id = v_offering OR offering_id IS NULL))
                   -- GENERIC slot (published from business hours, no offering):
                   -- any untagged credit, or any credit whose offering is not a
                   -- horse-care SKU — the slot is generic time; the credit says
                   -- what was bought. Without this, every real purchase (always
                   -- offering-tagged) was rejected by generic open slots.
                   OR (v_offering IS NULL AND (offering_id IS NULL OR EXISTS (
                        SELECT 1 FROM offerings oc WHERE oc.id = offering_id AND oc.segment <> 'horse')))
                 )
               -- CREDITALIGN: spend the thing that expires first. Without this an
               -- expiring monthly allotment sits unused behind a never-expiring pack
               -- and is silently lost at month end.
               ORDER BY (offering_id = v_offering) DESC NULLS LAST,
                        expires_at ASC NULLS LAST,
                        purchased_at, created_at
               LIMIT 1 FOR UPDATE)
   RETURNING id INTO v_credit;
  IF v_credit IS NULL THEN RAISE EXCEPTION 'NO_CREDITS'; END IF;
  END IF;

  -- BOOKWRITE: what the debited credit knows — the service and the order.
  SELECT lc.offering_id, lc.purchase_id INTO v_cr_off, v_cr_pur
    FROM lesson_credits lc WHERE lc.id = v_credit;

  -- REVIEWQ R1: claiming an open slot is a REQUEST, not a confirmation —
  -- status lands 'requested' (was 'scheduled' — FLOWTRACE item 10; then
  -- 'pending' — TASK-LIFECYCLE, because a claim nobody has answered is not
  -- the same state as an order whose payment method has been declared).
  UPDATE bookings SET
    kind = v_kind, status = 'requested', is_flexible = false,
    client_id = v_client,
    account_user_id = auth.uid(),
    account_contact_id = v_contact,
    offering_id = coalesce(offering_id, v_cr_off),
    purchase_id = coalesce(purchase_id, v_cr_pur),
    horse_id = coalesce(p_horse_id, horse_id),
    credit_id = v_credit,
    updated_at = now()
  WHERE id = p_booking_id;

  -- REVIEWQ R2: the companion request row the staff queue (open_change_
  -- requests / decide_booking_change) reads.
  INSERT INTO booking_change_requests (
    org_id, booking_id, requested_by, request_kind,
    proposed_starts_at, proposed_ends_at, status)
  VALUES (v_b.org_id, p_booking_id, auth.uid(), 'new', v_b.starts_at, v_b.ends_at, 'pending');

  PERFORM notify_staff(v_b.org_id, 'booking_time_requested',
    'A client claimed ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'requested', 'kind', v_kind);
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_booking_change(p_booking_id uuid, p_kind text, p_new_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_new_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_scope text DEFAULT 'one'::text, p_note text DEFAULT NULL::text, p_fee_method text DEFAULT NULL::text, p_fee_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid := current_client_id();
  v_b      bookings%ROWTYPE;
  v_fee    numeric;
  v_phone  boolean;
  v_id     uuid;
  v_recurring boolean;
  v_method text := nullif(lower(btrim(coalesce(p_fee_method, ''))), '');
  v_ref    text := nullif(btrim(coalesce(p_fee_reference, '')), '');
BEGIN
  IF p_kind NOT IN ('reschedule','cancel','defer') THEN RAISE EXCEPTION 'bad change kind'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF NOT coalesce(has_staff_access() OR (v_client IS NOT NULL AND v_b.client_id = v_client), false) THEN
    RAISE EXCEPTION 'not your booking';
  END IF;
  IF p_kind = 'reschedule' AND (p_new_start IS NULL OR p_new_end IS NULL) THEN
    RAISE EXCEPTION 'a reschedule needs a new time';
  END IF;

  -- BOOKLINK B4: monthly lessons don't carry over — a reschedule request
  -- that would push the lesson into a different calendar month is refused.
  IF p_kind = 'reschedule' AND v_b.purchase_id IS NOT NULL THEN
    SELECT true INTO v_recurring
      FROM purchase_items pi JOIN offerings o ON o.id = pi.offering_id
     WHERE pi.purchase_id = v_b.purchase_id AND o.config_kind = 'recurring' LIMIT 1;
    IF coalesce(v_recurring, false)
       AND date_trunc('month', p_new_start) <> date_trunc('month', v_b.starts_at) THEN
      RAISE EXCEPTION 'monthly lessons must be used within the same month — no carryover to next month';
    END IF;
  END IF;

  v_fee   := CASE WHEN p_kind = 'reschedule' THEN reschedule_fee(v_b.org_id, v_b.starts_at) ELSE 0 END;
  v_phone := v_b.starts_at - now() < interval '24 hours';

  -- ONBOARD §7 — the fee gate. A chargeable change is not accepted until the
  -- client has said how they are settling it. Staff are exempt: they are acting
  -- on the client's behalf and can waive at decision time.
  IF coalesce(v_fee, 0) > 0 AND NOT has_staff_access() THEN
    IF v_method IS NULL OR v_method NOT IN ('zelle','cash') THEN
      RAISE EXCEPTION 'FEE_CONFIRMATION_REQUIRED: a % fee applies to this change', v_fee
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO booking_change_requests (
    org_id, booking_id, requested_by, request_kind,
    proposed_starts_at, proposed_ends_at, scope, status,
    fee_amount, phone_required, note,
    fee_reported_method, fee_reported_reference, fee_reported_at)
  VALUES (
    v_b.org_id, p_booking_id, auth.uid(), p_kind,
    p_new_start, p_new_end, p_scope, 'pending',
    NULLIF(v_fee,0), v_phone, p_note,
    CASE WHEN coalesce(v_fee,0) > 0 THEN v_method END,
    CASE WHEN coalesce(v_fee,0) > 0 THEN v_ref END,
    CASE WHEN coalesce(v_fee,0) > 0 AND v_method IS NOT NULL THEN now() END)
  RETURNING id INTO v_id;

  -- ⚠️ LIFECYCLE: A RESCHEDULE ENTERS `moved`, AND THAT IS THE HOLD.
  -- Owner: *"a held slot isnt empty and available until the new booking is
  -- approved then the hold is released."* The row stays at its OLD time in
  -- `moved`; `decide_booking_change` applies the delta to this same row on
  -- approval, which releases the old slot by construction. No second row, no
  -- hold table. A cancel/defer ask holds the slot as `pending`, as before.
  UPDATE bookings
     SET status = CASE WHEN p_kind = 'reschedule' THEN 'moved' ELSE 'pending' END,
         updated_at = now()
   WHERE id = p_booking_id AND status IN ('scheduled','confirmed');

  -- staff get an in-app heads-up (email rides the sweep)
  PERFORM notify_staff(v_b.org_id, 'booking_change_requested',
    initcap(p_kind) || ' requested — ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM')
      || CASE WHEN coalesce(v_fee,0) > 0
              THEN ' · ' || fmt_money(v_fee) || ' fee — client says '
                   || CASE WHEN v_method = 'cash' THEN 'they will pay cash'
                           ELSE 'they sent it by Zelle' || coalesce(' (ref ' || v_ref || ')', '') END
                   || ', not yet confirmed'
              ELSE '' END,
    '/app/calendar');

  RETURN jsonb_build_object(
    'change_id', v_id, 'fee_amount', NULLIF(v_fee,0), 'phone_required', v_phone,
    'kind', p_kind, 'fee_method', CASE WHEN coalesce(v_fee,0) > 0 THEN v_method END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decide_booking_change(p_change_id uuid, p_approve boolean, p_waive_fee boolean DEFAULT false, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cr     booking_change_requests%ROWTYPE;
  v_b      bookings%ROWTYPE;
  v_client uuid := current_client_id();
  v_when   text;
  v_delta  interval;
  v_scope  text;
  v_ids    uuid[];
  v_n      int;
  rid      uuid;
  r        bookings%ROWTYPE;
  v_freed  int := 0;
  v_refunded boolean := false;
  v_label  text;
  v_needs_payment boolean := false;
BEGIN
  SELECT * INTO v_cr FROM booking_change_requests WHERE id = p_change_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'change request not found'; END IF;
  IF v_cr.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = v_cr.booking_id;

  -- D25 — what this person's session is CALLED. Resolved once, used in every title.
  v_label := booking_service_label(v_b.kind, v_b.offering_id);

  -- REVIEWQ R2: direction-aware — the default (awaiting_client = false) is
  -- the incumbent shape, staff decides a client's ask; awaiting_client = true
  -- is a staff-proposed counter-time, and only the booking's own client may
  -- decide it.
  IF NOT (
    (v_cr.awaiting_client AND v_client IS NOT NULL AND v_b.client_id = v_client)
    OR (NOT v_cr.awaiting_client AND has_staff_access())
  ) THEN
    RAISE EXCEPTION 'not authorized to decide this request';
  END IF;

  v_scope := coalesce(v_cr.scope, 'one');

  IF NOT p_approve THEN
    -- Three distinct reject shapes:
    IF v_cr.request_kind = 'new' AND v_cr.awaiting_client THEN
      -- (1) the client turned down a staff-proposed counter-time. The
      -- booking was never confirmed by anyone, so it stays 'pending' — this
      -- row withdraws and a fresh 'new' row (proposed time reset to the
      -- booking's own current time) reopens the queue for staff, same
      -- invariant book_open_slot/request_open_time established: every
      -- pending booking has exactly one open companion row.
      UPDATE booking_change_requests SET status='withdrawn', decided_by=auth.uid(), decided_at=now()
        WHERE id=p_change_id;
      INSERT INTO booking_change_requests (org_id, booking_id, requested_by, request_kind,
          proposed_starts_at, proposed_ends_at, status)
        VALUES (v_b.org_id, v_b.id, v_cr.requested_by, 'new', v_b.starts_at, v_b.ends_at, 'pending');
      PERFORM notify_staff(v_b.org_id, 'booking_time_declined',
        'Client declined the proposed time for ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
        '/app/calendar');
      RETURN jsonb_build_object('status','withdrawn', 'kind','new', 'booking_status','requested');

    ELSIF v_cr.request_kind = 'new' THEN
      -- (2) a genuine company decline of a fresh request nobody countered:
      -- terminal, credit refunded if one was debited, reason recorded.
      IF v_b.status <> 'cancelled' AND v_b.credit_id IS NOT NULL THEN
        v_refunded := _refund_booking_credit(v_b);
      END IF;
      UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = v_cr.booking_id;
      UPDATE booking_change_requests SET status='rejected', staff_note = coalesce(p_reason, staff_note),
        decided_by=auth.uid(), decided_at=now() WHERE id=p_change_id;
      IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b) THEN
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_b.org_id, v_b.account_user_id, 'booking_declined',
                  'We could not hold ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM')
                    || ' for your ' || v_label
                    || CASE WHEN p_reason IS NOT NULL THEN ' — ' || p_reason ELSE '' END,
                  '/app/calendar');
      END IF;
      RETURN jsonb_build_object('status','rejected', 'kind','new', 'credit_refunded', v_refunded);

    ELSE
      -- (3) the incumbent shape, unchanged: a reschedule/cancel/defer ask
      -- against an already-live booking is refused, and the booking reverts
      -- to its prior live status.
      UPDATE booking_change_requests SET status='rejected', decided_by=auth.uid(), decided_at=now() WHERE id=p_change_id;
      UPDATE bookings SET status = CASE WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END, updated_at=now()
        WHERE id = v_cr.booking_id AND status IN ('pending','moved');
      IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b) THEN
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_b.org_id, v_b.account_user_id, 'booking_change_rejected',
                  initcap(v_cr.request_kind) || ' declined for your ' || v_label
                    || ' — please reach out', '/app/calendar');
      END IF;
      RETURN jsonb_build_object('status','rejected');
    END IF;
  END IF;

  -- ⚠️ LIFECYCLE — `approved` IS A REAL STATE AND IT MEANS "WE SAID YES, THE
  -- MONEY HAS NOT ARRIVED". Staff approving a fresh request on an order that
  -- is not paid for lands the booking on `approved` and asks for the money
  -- through the ONE function that already does that (`request_purchase_payment`
  -- → `/api/order-request-payment`). Skipped exactly where the owner said:
  -- already paid, or the session was bought with a credit, or it is a
  -- reschedule of something already settled.
  -- Staff-only, because `request_purchase_payment` is staff-only: when the
  -- CLIENT accepts a staff counter-time this behaves exactly as it did before.
  IF p_approve AND v_cr.request_kind = 'new' AND has_staff_access() THEN
    v_needs_payment := booking_awaiting_payment(v_b);
  END IF;

  -- resolve the affected occurrences by scope
  IF v_b.series_id IS NULL OR v_scope = 'one' THEN
    v_ids := ARRAY[v_b.id];
  ELSIF v_scope = 'all' THEN
    SELECT array_agg(id) INTO v_ids FROM bookings WHERE series_id = v_b.series_id;
  ELSIF v_scope = 'future' THEN
    SELECT array_agg(id) INTO v_ids FROM bookings WHERE series_id = v_b.series_id AND starts_at >= v_b.starts_at;
  ELSIF v_scope LIKE 'weeks:%' THEN
    v_n := nullif(split_part(v_scope, ':', 2), '')::int;
    SELECT array_agg(id) INTO v_ids FROM (
      SELECT id FROM bookings WHERE series_id = v_b.series_id AND starts_at >= v_b.starts_at
      ORDER BY starts_at LIMIT coalesce(v_n, 1)) x;
  ELSE
    v_ids := ARRAY[v_b.id];
  END IF;

  -- REVIEWQ: 'new' rides the same apply-delta-then-schedule branch as
  -- 'reschedule' — a fresh request's proposed_* is set to its own original
  -- time at creation (delta 0, confirm-in-place); a staff counter-offer sets
  -- proposed_* to the new time (delta shifts it), and approving here is the
  -- client's acceptance.
  IF v_cr.request_kind IN ('reschedule','new') THEN
    v_delta := coalesce(v_cr.proposed_starts_at, v_b.starts_at) - v_b.starts_at;
    FOREACH rid IN ARRAY v_ids LOOP
      SELECT * INTO r FROM bookings WHERE id = rid;
      UPDATE bookings SET starts_at = r.starts_at + v_delta, ends_at = r.ends_at + v_delta,
        status = CASE WHEN v_needs_payment THEN 'approved'
                      WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END,
        reminder_1h_sent_at = NULL, reminder_2h_sent_at = NULL, updated_at=now()
      WHERE id = rid;
    END LOOP;
    v_when := to_char(coalesce(v_cr.proposed_starts_at, v_b.starts_at), 'FMMon FMDD, HH12:MI AM');
  ELSE
    FOREACH rid IN ARRAY v_ids LOOP
      SELECT * INTO r FROM bookings WHERE id = rid;
      UPDATE bookings SET status='cancelled', updated_at=now() WHERE id = rid;
      -- CAREPLANS m4 — a cancellation returns THE CREDIT IT SPENT, through the one
      -- refund seam, capped at what the month was minted with and carrying that
      -- month's expiry. The shipped body inserted a fresh, untagged, NEVER-EXPIRING
      -- `change_credit` instead: it survived into the next month (the owner's
      -- ruling is that a cancelled lesson does not), it was spendable on any other
      -- service because it named none, and it was minted even when the booking had
      -- never debited anything — entitlement from nothing. `_refund_booking_credit`
      -- is the seam `delete_calendar_item`, `swap_booking_item` and
      -- `withdraw_my_pending_booking` already use; this arm was the one that did not.
      IF r.status <> 'cancelled' AND r.credit_id IS NOT NULL AND r.client_id IS NOT NULL THEN
        IF _refund_booking_credit(r) THEN
          v_freed := v_freed + 1;
        END IF;
      END IF;
    END LOOP;
    v_when := to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM');
  END IF;

  UPDATE booking_change_requests
    SET status='approved', fee_waived = p_waive_fee, decided_by=auth.uid(), decided_at=now()
    WHERE id=p_change_id;

  -- ⚠️ THE ASK FOR THE MONEY. `request_purchase_payment` raises the buyer's
  -- "payment due" notice and the staff copy through `notify_purchase_unpaid`,
  -- and writes the `payment_requested` line on the order's own timeline — so
  -- this branch deliberately does NOT also send the booking notification
  -- below. One approval, one notice, and it is the one about the money.
  IF v_needs_payment THEN
    PERFORM request_purchase_payment(v_b.purchase_id, NULL);
  END IF;

  IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b)
     AND NOT v_needs_payment THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id,
              CASE WHEN v_cr.request_kind = 'new' THEN 'booking_confirmed' ELSE 'booking_' || v_cr.request_kind || '_approved' END,
              CASE v_cr.request_kind
                WHEN 'reschedule' THEN 'Your ' || v_label || ' has moved to ' || v_when
                WHEN 'new' THEN 'Your ' || v_label || ' on ' || v_when || ' is confirmed'
                WHEN 'defer' THEN 'Your ' || v_label || ' is deferred — that session is back on your account'
                ELSE 'Your ' || v_label || ' on ' || v_when || ' is cancelled'
                     || CASE WHEN v_freed > 0
                             THEN ' — that session is back on your account, so pick a new time whenever you like'
                             ELSE '' END END,
              '/app/calendar');
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN v_needs_payment THEN 'approved_payment_due' ELSE 'approved' END,
                            'kind', v_cr.request_kind,
                            'payment_requested', v_needs_payment,
                            'affected', coalesce(array_length(v_ids,1),1));
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_my_payment(p_purchase_id uuid, p_method text, p_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pur     purchases%ROWTYPE;
  v_contact uuid := current_contact_id();
  v_method  text := lower(btrim(coalesce(p_method, '')));
  v_ref     text := nullif(btrim(coalesce(p_reference, '')), '');
  v_label   text;
  v_who     text;
  v_opened  boolean := false;
  v_pay     uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_method NOT IN ('zelle', 'cash') THEN
    RAISE EXCEPTION 'a payment report is zelle or cash';
  END IF;

  SELECT * INTO v_pur FROM purchases
   WHERE id = p_purchase_id AND deleted_at IS NULL
     AND (buyer_user_id = auth.uid() OR (v_contact IS NOT NULL AND buyer_contact_id = v_contact));
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;

  IF coalesce(v_pur.payment_status, '') = 'paid' THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'already paid');
  END IF;

  UPDATE purchases
     SET client_reported_method       = v_method,
         client_reported_reference    = coalesce(v_ref, client_reported_reference),
         client_reported_at           = now(),
         payment_method                = v_method,
         client_claim_status           = 'pending',
         client_claim_resolved_by      = NULL,
         client_claim_resolved_at      = NULL,
         client_claim_decline_reason   = NULL
   WHERE id = p_purchase_id;

  -- ⚠️ LIFECYCLE — `pending` IS ENTERED BY THE CLIENT, NOT BY STAFF.
  -- Owner: the booking is `pending` once *"the client declares a payment
  -- method on an unpaid order"*. This is that declaration. It moves the
  -- sessions this order pays for out of `requested`/`approved` and into
  -- `pending` — where they stay VISIBLE and BOOKABLE (D23/D24: a pending
  -- month never blocks anyone) until staff confirm the money arrived.
  UPDATE bookings SET status = 'pending', updated_at = now()
   WHERE purchase_id = p_purchase_id AND status IN ('requested','approved');

  -- CR-76b: the declaration IS the payment entry. Its number is what the client
  -- sees on My Payments, and it is minted here — at the input, not at settlement.
  v_pay := _payment_open(p_purchase_id, v_method, v_ref, auth.uid(), false);

  IF coalesce(v_pur.status, '') = 'draft' THEN
    PERFORM finalize_purchase_payment(p_purchase_id, v_method);
    v_opened := true;
  END IF;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Order');

  SELECT nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), '')
    INTO v_who FROM contacts c WHERE c.id = v_pur.buyer_contact_id;
  v_who := coalesce(v_who, 'The buyer');

  PERFORM log_status_event(
    'order', p_purchase_id, 'payment_reported',
    CASE WHEN v_method = 'cash'
         THEN 'Client says they are paying cash'
         ELSE 'Client says they sent the Zelle payment'
              || coalesce(' — confirmation ' || v_ref, ' — no confirmation number given')
    END,
    v_pur.org_id);

  PERFORM notify_staff(v_pur.org_id, 'payment_reported',
    v_who || ' says they paid ' || v_label
      || CASE WHEN v_method = 'cash' THEN ' in cash' ELSE ' by Zelle' END
      || coalesce(' (ref ' || v_ref || ')', '')
      || ' — not yet confirmed',
    '/app/ops/payments/review');

  RETURN jsonb_build_object('recorded', true, 'method', v_method, 'reference', v_ref,
                            'payment_id', v_pay,
                            'order_opened', v_opened);
END;
$function$;

-- ── THE LAST BUTTON: STAFF CONFIRM THE MONEY, AND THE MONTH FLIPS ───────────
-- Owner, 2026-08-31: *"Once they confirm their payment to us we confirm it was
-- received and the pending bookings for the month flip to booked."*
--
-- ⚠️ MEASURED 2026-09-01: `confirm_booking_for_purchase` — the function that
-- does exactly this — HAD NO CALLER IN THE DATABASE AND ONE IN THE APP
-- (`api/_lib/reconcile.ts:146`, service-role only). `mark_purchase_paid` does
-- not call it. So the staff "mark paid" button has never flipped a booking.
-- This is TASK-ROLE §2b: correct code that nothing reaches.
--
-- 🔒 IT HANGS ON THE FACT OF PAYMENT, NOT ON ONE FUNCTION. `mark_purchase_paid`
-- has been overwritten live once (BOOKS1) and reverted three times (CREDITFIX);
-- hanging this off its body would put the flip back in the blast radius, and
-- would still miss `finalize_purchase_payment` and every future writer. A
-- trigger on the COLUMN'S VALUE catches all of them.
--
-- ⚠️ AND IT CARRIES NO COLUMN LIST. `AFTER UPDATE OF payment_status` fires on
-- the columns the STATEMENT NAMES, not on the value that ends up stored — three
-- instances of that trap in two days (TASK-ROLE §2a). `AFTER UPDATE` + a `WHEN`
-- on the OLD/NEW values cannot be silenced by how a caller writes its UPDATE.
CREATE OR REPLACE FUNCTION public.trg_confirm_bookings_when_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM confirm_booking_for_purchase(NEW.id);
  RETURN NULL;
END;
$function$;

-- ⚠️ BOOKS1 TRAP: default privileges re-grant anon/authenticated on a fresh
-- function. A trigger function needs no direct EXECUTE by anyone.
REVOKE EXECUTE ON FUNCTION public.trg_confirm_bookings_when_paid() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_confirm_bookings_when_paid() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_confirm_bookings_when_paid() FROM authenticated;

DROP TRIGGER IF EXISTS purchases_confirm_bookings ON public.purchases;
CREATE TRIGGER purchases_confirm_bookings
  AFTER UPDATE ON public.purchases
  FOR EACH ROW
  WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid')
  EXECUTE FUNCTION public.trg_confirm_bookings_when_paid();
