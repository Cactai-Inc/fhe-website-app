-- TASK-SLOTREACH — the owner can sell and schedule a recurring lesson today.
--
-- BUYANDBOOK built the standing-slot spine and it is correct: `set_my_standing_schedule`
-- → `set_recurring_days` → `_ensure_plan_horizon` → `_generate_plan_month`, materialised
-- on read out to a rolling 90-day horizon with no scheduler. WALK2 nevertheless found the
-- product unsellable, because NOTHING REACHES IT (D17, the eleventh instance).
--
-- Almost all of that is a front-end reach problem and is fixed in the app, not here.
-- This migration closes the four DATABASE-side gaps that the reach fix needs or that
-- WALK2 measured directly:
--
--   1. STAFF CANNOT READ A CLIENT'S STANDING SLOT. `my_standing_slots` is caller-scoped
--      (`buyer_user_id = auth.uid()`), so a staff member has no way to see, let alone
--      change, the weekly time of the client in front of them. `client_standing_slots`
--      is the staff-gated READ of exactly the same shape. It is NOT a second writer —
--      the writer stays `set_my_standing_schedule`, which already admits staff.
--
--   2. A STAFF RESCHEDULE ANNOUNCES NOTHING. WALK2 G-3: "Neither reschedule nor cancel
--      fires any notification, on any channel." Measured and confirmed here in the
--      journal: `save_calendar_item`'s EDIT branch moves `starts_at` and writes no
--      notification, and `delete_calendar_item` cancels a booking and writes none
--      either. `decide_booking_change` (the CLIENT-initiated path) always did — so a
--      client's own request was announced and the staff member moving them silently was
--      not. Both staff writers now announce, through the incumbent `notifications`
--      spine, with a `booking_%` kind so `api/calendar-reminders.ts` emails it on its
--      hourly sweep. No new channel, no new table.
--
--   3. THE COPY SAYS "BOOKING" TO A HUMAN. D25: "booking" is INTERNAL TAXONOMY ONLY.
--      `decide_booking_change` told a client "Your booking on Aug 24 is cancelled".
--      `booking_service_label` is the one place the barn's own word for a session is
--      decided — "Riding Lesson" for a lesson, ALWAYS at that altitude (never 1x/2x/
--      evaluation/a la carte), and the horse-care service name with its frequency
--      stripped for care.
--
--   4. NOTHING ELSE. `generate_monthly_lessons` already delegates to the multi-day
--      `_generate_plan_month` (CAREPLANS m3), so the "books one weekday while
--      set_recurring_days computes several" divergence the task names WAS ALREADY
--      CLOSED and is verified closed in the journal — there is no second generator to
--      converge, and this migration deliberately writes none.
--
-- The tenant timezone is Pacific at the DATABASE level (20260817T1600), so every
-- `to_char` below renders the barn's own wall clock, not UTC.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. D25 — what a session is CALLED to the person it belongs to.
-- ─────────────────────────────────────────────────────────────────────────────
-- Owner, 2026-08-21: riding lessons name HIGH — always "Riding Lesson", never the SKU.
-- Horse care names LOW but stops above quantity and frequency: "turnout", "hair
-- clipping" — never "2x Weekly Turnout". The frequency prefix is stripped rather than
-- curated, because the SKU names are owner-editable and a hardcoded lookup table would
-- go stale the first time he renames one (D13).
CREATE OR REPLACE FUNCTION public.booking_service_label(p_kind text, p_offering_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_kind = 'lesson' THEN 'Riding Lesson'
    WHEN p_kind = 'care' THEN coalesce(
      nullif(btrim(regexp_replace(
        (SELECT o.name FROM offerings o WHERE o.id = p_offering_id),
        '^\s*\d+\s*x?\s*(weekly|daily|monthly|per week|/week)?\s*', '', 'i')), ''),
      'horse care')
    ELSE 'appointment'
  END;
$function$;

REVOKE ALL ON FUNCTION public.booking_service_label(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_service_label(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.booking_service_label(text, uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The one place a change to somebody's time is announced.
-- ─────────────────────────────────────────────────────────────────────────────
-- `kind` deliberately starts with `booking_` — that prefix is what
-- `api/calendar-reminders.ts` selects on to email calendar notifications on its
-- hourly sweep, so writing the row IS wiring the email. The word never reaches a
-- human: the TITLE is what they read, and it names the service (D25).
CREATE OR REPLACE FUNCTION public._announce_booking_change(
  p_org uuid, p_user uuid, p_kind text, p_title text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO notifications (org_id, user_id, kind, title, link)
  SELECT p_org, p_user, p_kind, p_title, '/app/calendar'
   WHERE p_org IS NOT NULL AND p_user IS NOT NULL
     AND nullif(btrim(coalesce(p_title, '')), '') IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public._announce_booking_change(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._announce_booking_change(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public._announce_booking_change(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._announce_booking_change(uuid, uuid, text, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. §2 — staff can SEE a client's standing slot, so they can change it.
-- ─────────────────────────────────────────────────────────────────────────────
-- Identical shape to `my_standing_slots`, keyed on the CONTACT rather than on the
-- caller, and staff-gated. Deliberately a read only: the write stays the single
-- incumbent `set_my_standing_schedule`, which already authorises
-- `has_staff_access() OR the plan's own client`. D18 — one engine, two front doors.
CREATE OR REPLACE FUNCTION public.client_standing_slots(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
        'purchase_id',      pu.id,
        'purchase_item_id', pi.id,
        'offering_id',      o.id,
        'offering_name',    o.name,
        'segment',          o.segment,
        'weekly_frequency', o.weekly_frequency,
        'recurring_days',   coalesce(pi.config->'recurring_days', '[]'::jsonb),
        'recurring_times',  coalesce(pi.config->'recurring_times', '{}'::jsonb),
        'duration_minutes', coalesce((pi.config->>'duration_minutes')::int, 60),
        'chosen',           coalesce(jsonb_array_length(coalesce(pi.config->'recurring_days','[]'::jsonb)), 0) > 0
                            AND coalesce(pi.config->'recurring_times', '{}'::jsonb) <> '{}'::jsonb,
        'indefinite',       pi.plan_ends_on IS NULL,
        'plan_ends_on',     pi.plan_ends_on,
        'horizon_through',  pi.config->>'horizon_through',
        'booked_ahead',     (SELECT count(*) FROM bookings b
                              WHERE b.purchase_id = pu.id
                                AND b.offering_id = o.id
                                AND b.starts_at >= now()
                                AND b.status NOT IN ('cancelled','expired')))
      ORDER BY pu.created_at DESC, o.name)
      FROM purchase_items pi
      JOIN offerings o  ON o.id  = pi.offering_id AND o.config_kind = 'recurring'
      JOIN purchases pu ON pu.id = pi.purchase_id
     WHERE pu.deleted_at IS NULL
       AND pi.voided_at IS NULL
       AND pu.org_id = current_org()
       AND pu.buyer_contact_id = p_contact_id
       AND (pi.plan_ends_on IS NULL OR pi.plan_ends_on >= current_date)
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.client_standing_slots(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_standing_slots(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.client_standing_slots(uuid) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. §5 — a staff reschedule announces itself.
-- ─────────────────────────────────────────────────────────────────────────────
-- VERBATIM the body shipped by 20260815T1600_booklink_b2_debit_or_create.sql (the
-- current definition in the journal), plus ONE addition: when the EDIT branch actually
-- MOVES a session, the person it belongs to is told. Nothing else changed — the debit
-- resolution, the series scope arithmetic, the horse-conflict guard and the create
-- branch are untouched, deliberately, so this is a strictly additive change to a
-- function four earlier tasks have each added a clause to.
--
-- ⚠️ IT ANNOUNCES ONLY A MOVE, NOT AN EDIT. Changing a note, a location or a price is
-- not news; a session that is no longer when the client thought it was, is. And a
-- cancellation performed from this panel (status → cancelled) is announced too, because
-- the panel can cancel without going through `delete_calendar_item`.
CREATE OR REPLACE FUNCTION public.save_calendar_item(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org     uuid := current_org();
  v_id      uuid := nullif(p->>'id','')::uuid;
  v_kind    text := coalesce(p->>'kind','block');
  v_status  text := coalesce(p->>'status','draft');
  v_start   timestamptz := (p->>'starts_at')::timestamptz;
  v_end     timestamptz := (p->>'ends_at')::timestamptz;
  v_horse   uuid := nullif(p->>'horse_id','')::uuid;
  v_offer   uuid := nullif(p->>'offering_id','')::uuid;
  v_price   numeric := nullif(p->>'price_amount','')::numeric;
  v_weeks   int := coalesce(nullif(p->>'recurrence_weeks','')::int, 1);
  v_scope   text := coalesce(p->>'scope','one');
  v_client  uuid := nullif(p->>'client_id','')::uuid;
  v_pur     uuid := nullif(p->>'purchase_id','')::uuid;
  v_instr   uuid := nullif(p->>'instructor_user_id','')::uuid;
  v_flex    boolean := coalesce((p->>'is_flexible')::boolean, false);
  v_pay_method text := nullif(btrim(coalesce(p->>'payment_method','')), '');
  v_mark_paid  boolean := (p->>'payment_state') = 'paid';
  v_credit  uuid;
  v_acct_c  uuid;
  v_acct_u  uuid;
  v_series  uuid;
  v_row     bookings%ROWTYPE;
  v_delta   interval;
  v_dur     interval;
  i         int;
  v_s       timestamptz;
  v_e       timestamptz;
  v_new_id  uuid;
  -- SLOTREACH §5
  v_tell    boolean := false;
  v_label   text;
  v_to      uuid;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start THEN
    RAISE EXCEPTION 'a calendar item needs a start and a later end';
  END IF;
  IF v_price IS NULL AND v_offer IS NOT NULL THEN
    SELECT price_amount INTO v_price FROM offerings WHERE id = v_offer;
  END IF;

  -- BOOKWRITE: everything the item already knows, resolved once.
  IF v_client IS NOT NULL THEN
    SELECT cl.contact_id INTO v_acct_c FROM clients cl
     WHERE cl.id = v_client AND cl.deleted_at IS NULL;
    IF v_acct_c IS NOT NULL THEN
      SELECT pr.user_id INTO v_acct_u FROM profiles pr WHERE pr.contact_id = v_acct_c;
    END IF;
    -- BOOKLINK B2: the paying item, only on a real (non-draft) commit where
    -- nothing was already resolved for it.
    IF v_pur IS NULL AND NOT v_flex AND v_kind IN ('lesson','care') AND v_status <> 'draft' THEN
      IF v_offer IS NOT NULL THEN
        SELECT d.purchase_id, d.credit_id INTO v_pur, v_credit
          FROM _debit_or_create_for_booking(v_client, v_offer, NULL, v_pay_method, v_mark_paid) d;
      ELSE
        v_pur := _unambiguous_purchase_for_client(v_client);
      END IF;
    END IF;
    -- who is delivering it: the acting staff member unless one was named
    IF v_instr IS NULL AND v_kind IN ('lesson','care') THEN
      v_instr := auth.uid();
    END IF;
  END IF;

  -- SLOTREACH §5 — does a change to this item reach the client at all? Same rule
  -- `booking_notifies_client` has always applied (rider always; horse care only when
  -- it happens somewhere they need to be), evaluated against the item AS SAVED rather
  -- than as it was, because that is what they will find on their calendar.
  v_tell := v_status <> 'draft' AND (
       v_kind = 'lesson'
    OR (v_kind = 'care' AND (
          nullif(btrim(coalesce(p->>'address','')), '') IS NOT NULL
       OR EXISTS (SELECT 1 FROM locations l
                   WHERE l.id = nullif(p->>'location_id','')::uuid AND l.is_offsite))));
  v_label := booking_service_label(v_kind, v_offer);

  -- ── EDIT ──────────────────────────────────────────────────────────────────
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_row FROM bookings WHERE id = v_id AND org_id = v_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'item not found in this org'; END IF;

    v_delta := v_start - v_row.starts_at;
    v_dur   := v_end - v_start;

    -- which rows the edit touches (series scope)
    FOR v_row IN
      SELECT * FROM bookings
      WHERE org_id = v_org
        AND (CASE
          WHEN v_scope = 'one' OR v_row.series_id IS NULL THEN id = v_id
          WHEN v_scope = 'future' THEN series_id = v_row.series_id AND starts_at >= v_row.starts_at
          ELSE series_id = v_row.series_id  -- 'all'
        END)
    LOOP
      v_s := v_row.starts_at + v_delta;
      v_e := v_s + v_dur;
      IF v_horse IS NOT NULL AND horse_time_conflict(v_org, v_horse, v_s, v_e, v_row.id, v_row.series_id) THEN
        RAISE EXCEPTION 'that horse is already booked in an overlapping time';
      END IF;
      UPDATE bookings SET
        kind = v_kind, status = v_status, starts_at = v_s, ends_at = v_e,
        is_flexible = coalesce((p->>'is_flexible')::boolean, is_flexible),
        client_id = v_client,
        account_contact_id = v_acct_c,
        account_user_id = v_acct_u,
        instructor_user_id = v_instr,
        horse_id = v_horse,
        purchase_id = v_pur,
        credit_id = coalesce(v_credit, credit_id),
        offering_id = v_offer,
        location_id = nullif(p->>'location_id','')::uuid,
        address = nullif(p->>'address',''),
        travel_before_minutes = coalesce((p->>'travel_before_minutes')::int, 0),
        travel_after_minutes = coalesce((p->>'travel_after_minutes')::int, 0),
        price_amount = v_price,
        all_day = coalesce((p->>'all_day')::boolean, false),
        notes = nullif(p->>'notes',''),
        updated_at = now()
      WHERE id = v_row.id;

      -- SLOTREACH §5 — WALK2 G-3. This is the branch that moved a client's lesson
      -- and told nobody. The account the item now belongs to is the one told; a
      -- staff member acting on their own calendar entry is not notified about
      -- themselves.
      v_to := coalesce(v_acct_u, v_row.account_user_id);
      IF v_tell AND v_to IS NOT NULL AND v_to <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        IF v_status = 'cancelled' AND v_row.status <> 'cancelled' THEN
          PERFORM _announce_booking_change(v_org, v_to, 'booking_cancelled',
            'Your ' || v_label || ' on '
              || to_char(v_row.starts_at, 'FMDay FMMon FMDD') || ' at '
              || to_char(v_row.starts_at, 'FMHH12:MI AM') || ' is cancelled');
        ELSIF v_s <> v_row.starts_at THEN
          PERFORM _announce_booking_change(v_org, v_to, 'booking_rescheduled',
            'Your ' || v_label || ' has moved to '
              || to_char(v_s, 'FMDay FMMon FMDD') || ' at '
              || to_char(v_s, 'FMHH12:MI AM')
              || ' (was ' || to_char(v_row.starts_at, 'FMMon FMDD') || ')');
        END IF;
      END IF;
    END LOOP;
    RETURN jsonb_build_object('id', v_id, 'series_id', v_row.series_id);
  END IF;

  -- ── CREATE (single or recurring) ────────────────────────────────────────────
  v_dur := v_end - v_start;
  IF v_weeks > 1 THEN v_series := gen_random_uuid(); END IF;

  FOR i IN 0 .. (greatest(v_weeks,1) - 1) LOOP
    v_s := v_start + make_interval(weeks => i);
    v_e := v_s + v_dur;
    IF v_horse IS NOT NULL AND horse_time_conflict(v_org, v_horse, v_s, v_e, NULL, v_series) THEN
      RAISE EXCEPTION 'that horse is already booked in an overlapping time (week %)', i + 1;
    END IF;
    INSERT INTO bookings (
      org_id, kind, status, starts_at, ends_at, all_day, is_flexible,
      client_id, account_contact_id, account_user_id, instructor_user_id,
      horse_id, purchase_id, credit_id, offering_id, location_id, address,
      travel_before_minutes, travel_after_minutes, price_amount, notes,
      series_id, created_by
    ) VALUES (
      v_org, v_kind, v_status, v_s, v_e,
      coalesce((p->>'all_day')::boolean, false),
      v_flex,
      v_client, v_acct_c, v_acct_u, v_instr,
      v_horse, v_pur, v_credit, v_offer,
      nullif(p->>'location_id','')::uuid, nullif(p->>'address',''),
      coalesce((p->>'travel_before_minutes')::int, 0),
      coalesce((p->>'travel_after_minutes')::int, 0),
      v_price, nullif(p->>'notes',''), v_series, auth.uid()
    ) RETURNING id INTO v_new_id;
  END LOOP;

  RETURN jsonb_build_object('id', v_new_id, 'series_id', v_series);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. §5 — a staff cancellation announces itself, and names the credit it gave back.
-- ─────────────────────────────────────────────────────────────────────────────
-- VERBATIM the body shipped by 20260815T2500_reviewq_m4_delete_never_destroys_evidence.sql,
-- plus the announcement. The evidence rule is untouched: a booking with any history is
-- soft-cancelled and never destroyed, and the credit still comes back through the one
-- `_refund_booking_credit` seam.
--
-- D23 corollary, said out loud to the client: for a STANDING WEEKLY slot the credit that
-- appears on cancellation is not a punch-card credit, it is the session they are owed
-- back. The title says so, because a client who sees "1 credit" with no explanation
-- reasonably concludes they now have a lesson to go and spend.
CREATE OR REPLACE FUNCTION public.delete_calendar_item(p_id uuid, p_scope text DEFAULT 'one'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid := current_org();
  v_row    bookings%ROWTYPE;
  v_ids    uuid[];
  v_id     uuid;
  v_target bookings%ROWTYPE;
  v_has_history boolean;
  v_n      integer := 0;
  -- SLOTREACH §5
  v_refunded boolean;
  v_label  text;
  v_to     uuid;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_row FROM bookings WHERE id = p_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found in this org'; END IF;

  IF p_scope = 'one' OR v_row.series_id IS NULL THEN
    v_ids := ARRAY[p_id];
  ELSIF p_scope = 'future' THEN
    SELECT array_agg(id) INTO v_ids FROM bookings WHERE series_id = v_row.series_id AND starts_at >= v_row.starts_at;
  ELSE
    SELECT array_agg(id) INTO v_ids FROM bookings WHERE series_id = v_row.series_id;
  END IF;

  FOREACH v_id IN ARRAY coalesce(v_ids, ARRAY[]::uuid[]) LOOP
    SELECT * INTO v_target FROM bookings WHERE id = v_id;
    v_has_history := v_target.client_id IS NOT NULL OR v_target.purchase_id IS NOT NULL
      OR v_target.credit_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM booking_change_requests WHERE booking_id = v_target.id);
    v_refunded := false;

    IF v_has_history THEN
      IF v_target.status <> 'cancelled' AND v_target.credit_id IS NOT NULL THEN
        v_refunded := coalesce(_refund_booking_credit(v_target), false);
      END IF;
      UPDATE bookings SET deleted_at = now(), deleted_by = auth.uid(),
          status = 'cancelled', updated_at = now()
        WHERE id = v_id;
      UPDATE booking_change_requests SET status='withdrawn', decided_by=auth.uid(), decided_at=now()
        WHERE booking_id = v_id AND status='pending';
    ELSE
      DELETE FROM bookings WHERE id = v_id;
    END IF;

    -- SLOTREACH §5 — WALK2 G-3, the other half. A session vanishing from someone's
    -- calendar with no record anywhere that it happened is the defect; this is the
    -- record. Only a session that was actually LIVE is announced — re-deleting an
    -- already-cancelled row is housekeeping, not news.
    v_to := v_target.account_user_id;
    IF v_target.status NOT IN ('cancelled','expired')
       AND coalesce(booking_notifies_client(v_target), false)
       AND v_to IS NOT NULL
       AND v_to <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
      v_label := booking_service_label(v_target.kind, v_target.offering_id);
      PERFORM _announce_booking_change(v_org, v_to, 'booking_cancelled',
        'Your ' || v_label || ' on '
          || to_char(v_target.starts_at, 'FMDay FMMon FMDD') || ' at '
          || to_char(v_target.starts_at, 'FMHH12:MI AM') || ' is cancelled'
          || CASE WHEN v_refunded
                  THEN ' — that session is back on your account, so pick a new time whenever you like.'
                  ELSE '.' END);
    END IF;

    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. §4 — the client-initiated path stops saying "booking" to the client.
-- ─────────────────────────────────────────────────────────────────────────────
-- VERBATIM the body shipped by
-- 20260817T1730_careplans_m4_a_cancellation_returns_the_credit_it_spent.sql — the
-- direction-aware authorisation, the scope arithmetic and the `_refund_booking_credit`
-- seam are all untouched. ONLY THE TITLES CHANGE, to what D25 says a person is allowed
-- to read: "Your booking on Aug 24 is cancelled" becomes "Your Riding Lesson on …",
-- and every title now names the service through `booking_service_label` so a horse-care
-- client is told about turnout rather than about "a booking".
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
      RETURN jsonb_build_object('status','withdrawn', 'kind','new', 'booking_status','pending');

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
        WHERE id = v_cr.booking_id AND status='pending';
      IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b) THEN
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_b.org_id, v_b.account_user_id, 'booking_change_rejected',
                  initcap(v_cr.request_kind) || ' declined for your ' || v_label
                    || ' — please reach out', '/app/calendar');
      END IF;
      RETURN jsonb_build_object('status','rejected');
    END IF;
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
        status = CASE WHEN kind='lesson' THEN 'scheduled' ELSE 'confirmed' END,
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

  IF v_b.account_user_id IS NOT NULL AND booking_notifies_client(v_b) THEN
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

  RETURN jsonb_build_object('status','approved', 'kind', v_cr.request_kind, 'affected', coalesce(array_length(v_ids,1),1));
END;
$function$;

COMMIT;
