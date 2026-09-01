-- TASK-LIFECYCLE · F — THE REST OF WHAT `pending` USED TO MEAN
--
-- ⚠️ SAME LESSON AS E, FOUND BY SWEEPING FOR IT RATHER THAN BY WAITING FOR IT.
-- Every function that read `bookings.status = 'pending'` was reading "a session
-- that is not settled yet" — a bucket that yesterday held fresh requests too.
-- Splitting `requested` out of `pending` silently emptied part of that bucket.
--
--   `booking_item_options` / `swap_booking_item` — the member choosing WHICH
--        purchased item their unanswered session spends. Both raised
--        `NOT_PENDING` on the exact booking they exist for.
--   `ops_day_sheet` — the staff day sheet. A brand-new request would have
--        vanished from it on the day this shipped.
--   `calendar_reminder_sweep` — the 1h/2h reminders.
--
-- 🔒 THESE ARE BEHAVIOUR-PRESERVING, NOT PRODUCT DECISIONS. Each list gains
-- exactly the states that used to be spelled `pending`, so every surface shows
-- and does what it did yesterday.
-- ⚠️ FLAGGED, NOT FIXED: whether an UNAPPROVED session should raise a 1-hour
-- reminder at all is a product question. It did yesterday (it was `pending`), so
-- it still does. DSGN decides if that changes.

CREATE OR REPLACE FUNCTION public.booking_item_options(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b      bookings%ROWTYPE;
  v_client uuid := current_client_id();
  v_staff  boolean := coalesce(has_staff_access(), false);
  v_mine   boolean;
  v_can    boolean := false;
  v_why    text;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  v_mine := v_client IS NOT NULL AND v_b.client_id = v_client;
  IF NOT (v_staff OR v_mine) THEN RAISE EXCEPTION 'not authorized to view this booking'; END IF;

  IF v_b.status IN ('completed','cancelled','expired','no_show') THEN
    v_why := 'This booking is ' || v_b.status || ' — there is nothing left to charge.';
  ELSIF v_staff THEN
    v_can := true;
  ELSIF v_b.status IN ('requested','pending') THEN
    v_can := true;
  ELSE
    v_why := 'We have already confirmed this booking — ask us and we will move it for you.';
  END IF;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'kind', v_b.kind,
    'status', v_b.status,
    'can_swap', v_can,
    'reason', v_why,
    'current', (SELECT jsonb_build_object(
                  'credit_id', lc.id,
                  'label', coalesce(o.name, lc.package_key, 'Lesson credit'),
                  'offering_id', lc.offering_id,
                  'purchase_id', lc.purchase_id,
                  'expires_at', lc.expires_at,
                  'remaining', lc.credits_remaining)
                  FROM lesson_credits lc
                  LEFT JOIN offerings o ON o.id = lc.offering_id
                 WHERE lc.id = v_b.credit_id),
    'options', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'credit_id', lc.id,
                  'label', coalesce(o.name, lc.package_key, 'Lesson credit'),
                  'offering_id', lc.offering_id,
                  'purchase_id', lc.purchase_id,
                  'segment', o.segment,
                  'remaining', lc.credits_remaining,
                  'period_start', lc.period_start,
                  'expires_at', lc.expires_at)
                  ORDER BY lc.expires_at ASC NULLS LAST, lc.purchased_at), '[]'::jsonb)
                  FROM lesson_credits lc
                  LEFT JOIN offerings o ON o.id = lc.offering_id
                 WHERE lc.client_id = v_b.client_id
                   AND lc.deleted_at IS NULL
                   AND lc.credits_remaining > 0
                   AND (lc.expires_at IS NULL OR lc.expires_at > now())
                   AND lc.id IS DISTINCT FROM v_b.credit_id
                   -- same segment rule book_open_slot enforces: care is funded by
                   -- horse-segment entitlement, lessons by everything else.
                   AND (v_b.kind <> 'care' OR o.segment = 'horse')
                   AND (v_b.kind <> 'lesson' OR coalesce(o.segment, '') <> 'horse'))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.swap_booking_item(p_booking_id uuid, p_credit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b        bookings%ROWTYPE;
  v_client   uuid := current_client_id();
  v_staff    boolean := coalesce(has_staff_access(), false);
  v_mine     boolean;
  v_role     text;
  v_to       lesson_credits%ROWTYPE;
  v_to_seg   text;
  v_to_label text;
  v_from     lesson_credits%ROWTYPE;
  v_from_lbl text;
  v_debited  uuid;
  v_refunded boolean := false;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;

  v_mine := v_client IS NOT NULL AND v_b.client_id = v_client;
  IF v_staff THEN
    v_role := 'staff';
    IF v_b.org_id IS DISTINCT FROM current_org() THEN
      RAISE EXCEPTION 'that booking is not in your organization';
    END IF;
  ELSIF v_mine THEN
    v_role := 'client';
    -- ONBOARD §7's boundary, reused: a request is still yours; a confirmation is ours.
    IF v_b.status NOT IN ('requested','pending') THEN
      RAISE EXCEPTION 'NOT_PENDING: we have already confirmed this booking — ask us and we will move it for you';
    END IF;
  ELSE
    RAISE EXCEPTION 'not authorized to change this booking';
  END IF;

  IF v_b.status IN ('completed','cancelled','expired','no_show') THEN
    RAISE EXCEPTION 'BOOKING_CLOSED: this booking is % — there is nothing left to charge', v_b.status;
  END IF;
  IF v_b.client_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_UNASSIGNED: this booking has no client to charge';
  END IF;

  -- ── the target has to be real, theirs, live, unexpired, and have something left ──
  SELECT * INTO v_to FROM lesson_credits
   WHERE id = p_credit_id AND client_id = v_b.client_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_SUCH_ITEM: that purchased item does not belong to this client';
  END IF;
  IF v_to.id = v_b.credit_id THEN
    RAISE EXCEPTION 'ALREADY_ON_THAT_ITEM: this booking is already charged against that item';
  END IF;
  IF v_to.expires_at IS NOT NULL AND v_to.expires_at <= now() THEN
    RAISE EXCEPTION 'ITEM_EXPIRED: that allotment ran out on % and does not carry over',
      to_char(v_to.expires_at - interval '1 day', 'FMMon FMDD, YYYY');
  END IF;

  SELECT o.segment, coalesce(o.name, v_to.package_key, 'Lesson credit')
    INTO v_to_seg, v_to_label
    FROM offerings o WHERE o.id = v_to.offering_id;
  v_to_label := coalesce(v_to_label, v_to.package_key, 'Lesson credit');

  -- same segment rule book_open_slot enforces at booking time.
  IF v_b.kind = 'care' AND coalesce(v_to_seg, '') <> 'horse' THEN
    RAISE EXCEPTION 'WRONG_SERVICE: "%" is not a horse-care item, so it cannot pay for a care booking', v_to_label;
  END IF;
  IF v_b.kind = 'lesson' AND coalesce(v_to_seg, '') = 'horse' THEN
    RAISE EXCEPTION 'WRONG_SERVICE: "%" is a horse-care item, so it cannot pay for a lesson', v_to_label;
  END IF;

  -- ── DEBIT FIRST. If there is nothing to take, the booking is untouched. ──
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = v_to.id AND credits_remaining > 0
   RETURNING id INTO v_debited;
  IF v_debited IS NULL THEN
    RAISE EXCEPTION 'NO_ENTITLEMENT: "%" has nothing left to book with', v_to_label;
  END IF;

  -- ── THEN REFUND, through the one seam. Same transaction, so the pair is atomic. ──
  IF v_b.credit_id IS NOT NULL THEN
    SELECT * INTO v_from FROM lesson_credits WHERE id = v_b.credit_id;
    SELECT coalesce(o.name, v_from.package_key, 'Lesson credit') INTO v_from_lbl
      FROM offerings o WHERE o.id = v_from.offering_id;
    v_from_lbl := coalesce(v_from_lbl, v_from.package_key, 'Lesson credit');
    v_refunded := _refund_booking_credit(v_b);
  END IF;

  UPDATE bookings SET
    credit_id   = v_to.id,
    offering_id = coalesce(v_to.offering_id, offering_id),
    purchase_id = coalesce(v_to.purchase_id, purchase_id),
    updated_at  = now()
  WHERE id = p_booking_id;

  INSERT INTO booking_item_swaps (
    org_id, booking_id, swapped_by, swapped_by_role, booking_status_at,
    from_credit_id, from_offering_id, from_purchase_id, from_label,
    to_credit_id, to_offering_id, to_purchase_id, to_label)
  VALUES (v_b.org_id, p_booking_id, auth.uid(), v_role, v_b.status,
          v_b.credit_id, v_from.offering_id, v_from.purchase_id, v_from_lbl,
          v_to.id, v_to.offering_id, v_to.purchase_id, v_to_label);

  -- The company confirms bookings, so it needs to know when the thing it confirmed
  -- gets re-charged to something else.
  IF v_role = 'client' THEN
    PERFORM notify_staff(v_b.org_id, 'booking_item_swapped',
      'A client re-assigned ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM')
        || ' to ' || v_to_label, '/app/calendar');
  ELSIF v_b.account_user_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_item_swapped',
              'Your ' || to_char(v_b.starts_at, 'FMMon FMDD') || ' booking is now against ' || v_to_label,
              '/app/calendar');
  END IF;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'from_credit_id', v_b.credit_id, 'from_label', v_from_lbl,
    'to_credit_id', v_to.id, 'to_label', v_to_label,
    'refunded', v_refunded,
    'by', v_role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ops_day_sheet(p_org uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_day date;
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_org := coalesce(p_org, current_org());
  -- "Today" is the BARN's today, not the server's (D: America/Los_Angeles).
  v_day := (now() AT TIME ZONE 'America/Los_Angeles')::date;

  RETURN jsonb_build_object(
    'day', v_day,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'at',    to_char(b.starts_at AT TIME ZONE 'America/Los_Angeles', 'HH12:MI AM'),
               'what',  coalesce(nullif(btrim(o.name), ''), initcap(b.kind)),
               'who',   coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), '—'),
               'horse', coalesce(nullif(btrim(h.nickname), ''), h.registered_name),
               'status', b.status)
             ORDER BY b.starts_at)
        FROM bookings b
        LEFT JOIN contacts c ON c.id = b.account_contact_id
        LEFT JOIN offerings o ON o.id = b.offering_id
        LEFT JOIN horses   h ON h.id = b.horse_id
       WHERE b.org_id = v_org
         AND b.deleted_at IS NULL
         AND b.kind IN ('lesson','care')
         -- ⚠️ 'available' is EXCLUDED: 494 of the calendar's rows are published
         -- open slots, not sessions. A day sheet listing them would be unreadable.
         AND b.status IN ('scheduled','confirmed','requested','approved','pending')
         AND (b.starts_at AT TIME ZONE 'America/Los_Angeles')::date = v_day
    ), '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.calendar_reminder_sweep()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n1 int := 0; b bookings%ROWTYPE; v_title text;
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- ⚠️ THE 2-HOUR REMINDER IS RETIRED (owner, 2026-08-26: "we only need the daily
  -- one at the start of the day and then the one that is sent 1 hour prior").
  -- `bookings.reminder_2h_sent_at` is deliberately left in place and left alone —
  -- it records what was already sent, and clearing it would make an old reminder
  -- look like it never happened.

  FOR b IN
    SELECT * FROM bookings
    WHERE status IN ('scheduled','confirmed','requested','approved','pending') AND kind IN ('lesson','care')
      AND reminder_1h_sent_at IS NULL
      AND starts_at BETWEEN now() AND now() + interval '1 hour'
  LOOP
    v_title := 'Starting soon: session at ' || to_char(b.starts_at, 'HH12:MI AM');
    -- THE CLIENT. Their one and only calendar email.
    IF b.account_user_id IS NOT NULL THEN
      INSERT INTO notifications (org_id, user_id, kind, title, link)
        VALUES (b.org_id, b.account_user_id, 'booking_reminder_1h', v_title, '/app/calendar');
    END IF;
    -- ⚠️ NO notify_staff. It fans out to every ADMIN profile, which is how
    -- admin@fhequestrian.com came to be emailed about every session. The shared
    -- inbox is served by the endpoint's single consolidated ops copy instead.
    UPDATE bookings SET reminder_1h_sent_at = now() WHERE id = b.id;
    v_n1 := v_n1 + 1;
  END LOOP;

  RETURN jsonb_build_object('reminders_2h', 0, 'reminders_1h', v_n1);
END;
$function$;
