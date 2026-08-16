-- TASK REVIEWQ M2 — R1: a client-made booking arrives PENDING, not confirmed.
--
-- book_open_slot (FLOWTRACE item 10, verified live) wrote status='scheduled'
-- literally when a client claimed an already-published open slot — the
-- primary "BOOKED, never REQUESTED" defect. It now lands 'pending' and
-- inserts the companion booking_change_requests row (request_kind='new')
-- that lets the existing queue/decide_booking_change machinery (M3) pick it
-- up, exactly like reschedule/cancel/defer already do for a live booking.
--
-- request_open_time already wrote status='pending' (verified live) — it only
-- gains the same companion-row insert, so it's covered by the same queue.
--
-- Staff-made bookings (save_calendar_item) are untouched: staff sets status
-- explicitly from the panel, and staff booking IS the confirmation per R1.
--
-- booking_status_code (FLOWTRACE item 10) collapsed pending/pending_slot/
-- pending_payment into the 'scheduled' bucket, so even a correctly-pending
-- booking was stamped and evented as scheduled. Fixed to its own bucket.
--
-- my_lesson_sessions fed the client-facing "My Lessons" page by raw
-- upper()-casing the DB status into a closed 'SCHEDULED'|'COMPLETED'|
-- 'CANCELLED'|'NO_SHOW' union with no PENDING member — a pending lesson
-- would carry a status the type didn't admit, and MyLessonsContent.tsx's
-- `s.status === 'SCHEDULED'` filter would silently drop it from "Upcoming
-- lessons" entirely. Bucketed the same way booking_status_code is, with
-- PENDING added.

-- ── book_open_slot ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.book_open_slot(p_booking_id uuid, p_horse_id uuid DEFAULT NULL::uuid)
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

  -- credit-gated: both lessons and care debit one service credit, preferring a
  -- credit tagged with this offering, falling back to any untagged balance.
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (SELECT id FROM lesson_credits
               WHERE client_id = v_client AND org_id = v_b.org_id
                 AND deleted_at IS NULL AND credits_remaining > 0
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
               ORDER BY (offering_id = v_offering) DESC NULLS LAST, purchased_at, created_at
               LIMIT 1 FOR UPDATE)
   RETURNING id INTO v_credit;
  IF v_credit IS NULL THEN RAISE EXCEPTION 'NO_CREDITS'; END IF;

  -- BOOKWRITE: what the debited credit knows — the service and the order.
  SELECT lc.offering_id, lc.purchase_id INTO v_cr_off, v_cr_pur
    FROM lesson_credits lc WHERE lc.id = v_credit;

  -- REVIEWQ R1: claiming an open slot is a REQUEST, not a confirmation —
  -- status lands 'pending' (was 'scheduled' — FLOWTRACE item 10).
  UPDATE bookings SET
    kind = v_kind, status = 'pending', is_flexible = false,
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
  -- requests / decide_booking_change, extended in M3) reads.
  INSERT INTO booking_change_requests (
    org_id, booking_id, requested_by, request_kind,
    proposed_starts_at, proposed_ends_at, status)
  VALUES (v_b.org_id, p_booking_id, auth.uid(), 'new', v_b.starts_at, v_b.ends_at, 'pending');

  PERFORM notify_staff(v_b.org_id, 'booking_time_requested',
    'A client claimed ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'pending', 'kind', v_kind);
END;
$function$;

-- ── request_open_time ─────────────────────────────────────────────────────
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
    VALUES (v_org, v_kind, 'pending', v_client, auth.uid(), v_contact,
            p_offering_id, p_horse_id, p_starts_at, p_ends_at,
            NULLIF(btrim(coalesce(p_note,'')),''))
    RETURNING id INTO v_id;

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

  RETURN jsonb_build_object('booking_id', v_id, 'status', 'pending');
END;
$function$;

-- ── booking_status_code ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_status_code(p_status text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_status IN ('completed') THEN 'completed'
    WHEN p_status IN ('cancelled','expired') THEN 'cancelled'
    WHEN p_status IN ('pending','pending_slot','pending_payment') THEN 'pending'
    WHEN p_status IN ('scheduled','confirmed') THEN 'scheduled'
    ELSE 'pending' END;
$function$;

-- ── my_lesson_sessions ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_lesson_sessions()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', CASE
        WHEN s.status IN ('pending','pending_slot','pending_payment') THEN 'PENDING'
        WHEN s.status IN ('scheduled','confirmed') THEN 'SCHEDULED'
        WHEN s.status IN ('cancelled','expired') THEN 'CANCELLED'
        WHEN s.status = 'completed' THEN 'COMPLETED'
        WHEN s.status = 'no_show' THEN 'NO_SHOW'
        ELSE upper(s.status) END,
      'location', s.location, 'notes', s.notes)
      ORDER BY s.ord), '[]'::jsonb)
  FROM (
    SELECT b.*, row_number() OVER (
        ORDER BY (b.starts_at >= now()) DESC,
                 CASE WHEN b.starts_at >= now() THEN b.starts_at END ASC,
                 CASE WHEN b.starts_at <  now() THEN b.starts_at END DESC
      ) AS ord
    FROM bookings b
    WHERE b.kind = 'lesson'
      AND b.client_id = current_client_id()
      AND has_module('mod.lessons')
    ORDER BY (b.starts_at >= now()) DESC,
             CASE WHEN b.starts_at >= now() THEN b.starts_at END ASC,
             CASE WHEN b.starts_at <  now() THEN b.starts_at END DESC
    LIMIT 50
  ) s
$function$;
