-- BOOKWRITE — a booking records what it knows.
--
-- Measured 2026-08-12: 319 bookings, ZERO with purchase_id / credit_id /
-- contract_id / instructor_user_id / horse_id, and no fulfillment_unit carries a
-- booking_id. The obligations ledger generates at 100% coverage and has never
-- been consumed once, because nothing links a booking back to what it fulfils.
--
-- The consumption machinery already exists and is correct: trg_booking_unit_link
-- claims a unit when a booking names a purchase. Its guard is
-- `purchase_id IS NOT NULL`, and no writer has ever written one. This migration
-- makes the writers record what they know, and closes the two gaps that stop the
-- claim from firing even when they do.
--
-- CONSUMPTION RULE (confirmed, not invented — this is what the trigger already
-- encodes, stated explicitly because it is being relied on):
--   · CLAIM at scheduling  — a booking that names a purchase takes the lowest-seq
--     open session/period unit of that purchase; unit → 'scheduled'.
--   · CONSUME at completion — booking → 'completed'; unit → 'consumed'.
--   · RELEASE at cancellation — booking → 'cancelled'/'expired'; unit → 'open'.
--   · PAYMENT DOES NOT CONSUME. Service is prepaid-gated (D9), so the purchase
--     exists before the booking; a paid-but-unscheduled unit must read 'open' or
--     "what do they still have coming" stops being answerable.
--
-- AUTO-LINK RULE: a writer records the paying purchase only when it is
-- UNAMBIGUOUS — exactly one purchase of that client has an open session/period
-- unit. Zero or two-or-more candidates leave it NULL for staff to pick. Writing
-- a guessed link into an evidence spine is worse than writing nothing.
--
-- Nothing here is deleted and no existing row is repaired. The 6 orphaned
-- fulfillment units are reported in docs/reports/TASK-BOOKWRITE-REPORT.md and
-- deliberately left untouched.
--
-- No pricing behaviour changes. _provision_purchase_for_offerings is rewritten
-- but every price expression in it is byte-identical; the only delta is that the
-- lesson_credits row it already creates now records the purchase and the offering
-- it came from.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lesson_credits remembers what bought it.
--
-- Without this a credit-paid booking can never name the purchase behind it, so
-- the client self-serve path (book_open_slot) can never close the ledger. The
-- column is additive and nullable — a hand-granted credit legitimately has no
-- purchase.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lesson_credits
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lesson_credits_purchase_idx
  ON public.lesson_credits (purchase_id) WHERE purchase_id IS NOT NULL;

COMMENT ON COLUMN public.lesson_credits.purchase_id IS
  'BOOKWRITE: the purchase that granted these credits. NULL for a hand-granted '
  'credit with no order behind it. Lets a credit-paid booking name what paid for it.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The unambiguous-purchase helper.
--
-- Returns the single purchase of this client that still has an open
-- session/period unit, or NULL when there are none or more than one.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._unambiguous_purchase_for_client(p_client_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ids uuid[];
BEGIN
  IF p_client_id IS NULL THEN RETURN NULL; END IF;
  SELECT array_agg(pu.id) INTO v_ids
    FROM purchases pu
    JOIN clients cl ON cl.contact_id = pu.buyer_contact_id
   WHERE cl.id = p_client_id
     AND cl.deleted_at IS NULL
     AND pu.deleted_at IS NULL
     AND pu.org_id = cl.org_id
     AND EXISTS (
       SELECT 1 FROM fulfillment_units u
        WHERE u.purchase_id = pu.id
          AND u.deleted_at IS NULL
          AND u.current_status = 'open'
          AND u.unit_kind IN ('session','period'));
  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN RETURN NULL; END IF;
  RETURN v_ids[1];
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. The staff roster a booking can name as its instructor.
--
-- current_org() keeps the platform owner out by construction (D1a: org_id is
-- NULL by design for admin@cactai.io, and it is not a tenant).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.instructor_options()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', x.user_id,
        'name',    x.name,
        'title',   x.title) ORDER BY x.name), '[]'::jsonb)
      FROM (
        SELECT p.user_id,
               coalesce(
                 nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
                 nullif(btrim(coalesce(p.display_name,'')), ''),
                 c.email,
                 'Staff') AS name,
               p.title
          FROM profiles p
          LEFT JOIN contacts c ON c.id = p.contact_id
         WHERE p.org_id = v_org
           AND coalesce(p.staff_active, false)
           AND p.role IN ('ADMIN','MANAGER','EMPLOYEE')
      ) x);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.instructor_options() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. consume_unit_for_booking — claim the unit for the SERVICE that was booked.
--
-- It took the lowest-seq open unit of the purchase, whatever it was for. On a
-- five-line order that meant a Single Lesson booking claimed the Single Class
-- unit, and the ledger read plausibly while being wrong. The booking knows its
-- offering; the unit knows its purchase_item's offering. Match them first, and
-- only fall back to lowest-seq when the booking names no offering or no unit for
-- it is open.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_unit_for_booking(p_booking_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b bookings%ROWTYPE;
  v_u uuid;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND OR v_b.purchase_id IS NULL THEN RETURN NULL; END IF;

  SELECT u.id INTO v_u
    FROM fulfillment_units u
    JOIN purchase_items pi ON pi.id = u.purchase_item_id
   WHERE u.purchase_id = v_b.purchase_id AND u.deleted_at IS NULL
     AND u.current_status = 'open' AND u.unit_kind IN ('session','period')
   ORDER BY (v_b.offering_id IS NOT NULL AND pi.offering_id = v_b.offering_id) DESC,
            u.seq
   LIMIT 1;
  IF v_u IS NULL THEN RETURN NULL; END IF;

  UPDATE fulfillment_units SET booking_id = p_booking_id WHERE id = v_u;
  PERFORM set_unit_status(v_u, 'scheduled', 'Booking ' || p_booking_id::text);
  RETURN v_u;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. trg_booking_unit_link — claim on a purchase attached AFTER creation.
--
-- The INSERT-only claim never fired for a second reason beyond the missing
-- purchase_id: every real path links the purchase by UPDATE, not at INSERT.
-- book_open_slot turns an existing 'available' slot into a booking; the calendar
-- edit branch assigns a purchase to an item that already exists. Both were
-- invisible to this trigger.
--
-- The release path is also tightened. It used to null booking_id and then look
-- for "any unlinked scheduled unit on this purchase", which could re-open a unit
-- belonging to a different booking. It now releases exactly the units it just
-- unlinked.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_booking_unit_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_units uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.purchase_id IS NOT NULL AND NEW.status NOT IN ('cancelled','expired') THEN
      PERFORM consume_unit_for_booking(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- the purchase behind this booking changed (including NULL → a purchase)
  IF NEW.purchase_id IS DISTINCT FROM OLD.purchase_id THEN
    SELECT array_agg(id) INTO v_units FROM fulfillment_units WHERE booking_id = NEW.id;
    IF v_units IS NOT NULL THEN
      UPDATE fulfillment_units SET booking_id = NULL WHERE id = ANY(v_units);
      PERFORM set_unit_status(f.id, 'open', 'Booking relinked — unit returned')
        FROM fulfillment_units f
       WHERE f.id = ANY(v_units) AND f.current_status = 'scheduled';
    END IF;
    IF NEW.purchase_id IS NOT NULL AND NEW.status NOT IN ('cancelled','expired') THEN
      PERFORM consume_unit_for_booking(NEW.id);
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' THEN
      PERFORM set_unit_status(u.id, 'consumed', 'Booking completed')
        FROM fulfillment_units u
       WHERE u.booking_id = NEW.id AND u.current_status <> 'consumed';
    ELSIF NEW.status IN ('cancelled','expired') THEN
      SELECT array_agg(id) INTO v_units FROM fulfillment_units WHERE booking_id = NEW.id;
      IF v_units IS NOT NULL THEN
        UPDATE fulfillment_units SET booking_id = NULL WHERE id = ANY(v_units);
        PERFORM set_unit_status(f.id, 'open', 'Booking cancelled — unit returned')
          FROM fulfillment_units f
         WHERE f.id = ANY(v_units) AND f.current_status <> 'open';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. _provision_purchase_for_offerings — the credit remembers its purchase.
--
-- MONEY PATH. Every pricing expression below (v_total, v_paid, the clamp, the
-- payment_status ladder) is unchanged. The only delta is two extra columns on
-- the lesson_credits INSERT it already performed: purchase_id and offering_id.
-- offering_id was already load-bearing — book_open_slot prefers a credit tagged
-- with the slot's offering, and nothing had ever tagged one.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._provision_purchase_for_offerings(p_org_id uuid, p_contact_id uuid, p_client_id uuid, p_offering_ids uuid[], p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_partial_amount numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase uuid;
  v_total    numeric;
  v_paid     numeric;
  v_off      offerings%ROWTYPE;
  v_lessons  integer;
BEGIN
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RETURN NULL;  -- nothing to purchase
  END IF;

  SELECT coalesce(sum(o.price_amount), 0) INTO v_total
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- amount_paid: full total when marked paid; else the (clamped) partial amount.
  v_paid := CASE
    WHEN p_mark_paid THEN v_total
    ELSE least(greatest(coalesce(p_partial_amount, 0), 0), v_total)
  END;

  -- payment_status CHECK allows unpaid|pending|paid. A partial payment is
  -- 'pending' (some paid, balance owed) with the exact paid figure in amount_paid.
  INSERT INTO purchases (org_id, buyer_contact_id, status, amount, amount_paid,
                         payment_method, payment_status, payment_reference, paid_at, notes)
    VALUES (p_org_id, p_contact_id,
            CASE WHEN p_mark_paid THEN 'paid' ELSE 'awaiting_payment' END,
            v_total, v_paid, p_payment_method,
            CASE WHEN p_mark_paid THEN 'paid'
                 WHEN v_paid > 0  THEN 'pending'
                 ELSE 'unpaid' END,
            CASE WHEN p_mark_paid THEN 'Provisioned — paid in full via ' || coalesce(p_payment_method, 'offline payment')
                 WHEN v_paid > 0  THEN 'Provisioned — partial ' || v_paid::text || ' via ' || coalesce(p_payment_method, 'offline payment') END,
            CASE WHEN p_mark_paid THEN now() END,
            coalesce(p_notes, 'Provisioned invitation'))
    RETURNING id INTO v_purchase;

  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount, price_unit, quantity)
  SELECT p_org_id, v_purchase, o.id, o.name, o.price_amount, o.price_unit, 1
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- each lesson-count offering also grants its punch-card credits
  FOR v_off IN SELECT o.* FROM offerings o WHERE o.id = ANY(p_offering_ids) LOOP
    v_lessons := CASE
      WHEN v_off.name ~ '(\d+)-Lesson' THEN (regexp_match(v_off.name, '(\d+)-Lesson'))[1]::int
      WHEN v_off.price_unit = 'session' THEN 1
      ELSE NULL END;
    IF v_lessons IS NOT NULL AND v_lessons > 0 THEN
      -- BOOKWRITE: the credit records the purchase that granted it and the
      -- offering it is for. Both were knowable here and both were discarded.
      INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining,
                                  purchase_id, offering_id)
        VALUES (p_org_id, p_client_id, v_off.name, v_lessons, v_lessons,
                v_purchase, v_off.id);
    END IF;
  END LOOP;

  -- U3(a): a purchase that owes money raises the standing "payment due" pair
  -- (buyer + staff). The helper no-ops when the purchase was provisioned paid.
  PERFORM notify_purchase_unpaid(v_purchase);

  RETURN v_purchase;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. save_calendar_item — the writer that made all 39 real bookings.
--
-- It already captured client / horse / offering / purchase / location / price.
-- What it discarded:
--   · account_contact_id + account_user_id — both derivable from client_id, and
--     both are what makes a booking visible to the person it is for.
--   · instructor_user_id — not even a parameter. Defaults to the acting staff
--     member on a client-bound lesson or care item, and is overridable.
--   · the paying purchase, when the staff member did not pick one and exactly
--     one candidate exists.
-- Availability slots (no client) keep every relational field NULL — correct.
-- ─────────────────────────────────────────────────────────────────────────────
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
    -- the paying purchase, only when it is unambiguous (never guess)
    IF v_pur IS NULL AND NOT v_flex AND v_kind IN ('lesson','care') THEN
      v_pur := _unambiguous_purchase_for_client(v_client);
    END IF;
    -- who is delivering it: the acting staff member unless one was named
    IF v_instr IS NULL AND v_kind IN ('lesson','care') THEN
      v_instr := auth.uid();
    END IF;
  END IF;

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
      horse_id, purchase_id, offering_id, location_id, address,
      travel_before_minutes, travel_after_minutes, price_amount, notes,
      series_id, created_by
    ) VALUES (
      v_org, v_kind, v_status, v_s, v_e,
      coalesce((p->>'all_day')::boolean, false),
      v_flex,
      v_client, v_acct_c, v_acct_u, v_instr,
      v_horse, v_pur, v_offer,
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
-- 7. schedule_lesson_session — the lead work drawer / sessions board writer.
--
-- Gains three trailing parameters, so every existing named-argument call site
-- keeps working unchanged. It already recorded client / contact / account /
-- horse / request. It discarded the offering (what service this is), the
-- instructor, and the purchase.
--
-- The old 8-argument form is dropped because CREATE OR REPLACE cannot widen an
-- argument list. The new form is CREATE OR REPLACE rather than CREATE so that
-- replaying this file against an already-migrated database is a no-op instead of
-- a "function already exists with same argument types" failure.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.schedule_lesson_session(
  p_client_id uuid,
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone,
  p_engagement_id uuid DEFAULT NULL::uuid,
  p_request_id uuid DEFAULT NULL::uuid,
  p_location text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_horse_id uuid DEFAULT NULL::uuid,
  p_offering_id uuid DEFAULT NULL::uuid,
  p_instructor_user_id uuid DEFAULT NULL::uuid,
  p_purchase_id uuid DEFAULT NULL::uuid)
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
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
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
  -- what paid for it: named, else the single unambiguous candidate
  v_pur   := coalesce(p_purchase_id, _unambiguous_purchase_for_client(p_client_id));

  INSERT INTO bookings
      (org_id, kind, client_id, account_contact_id, account_user_id, request_id, horse_id,
       offering_id, instructor_user_id, purchase_id,
       starts_at, ends_at, location, notes, status)
    VALUES
      (v_org, 'lesson', p_client_id, v_contact, v_user, p_request_id, p_horse_id,
       p_offering_id, v_instr, v_pur,
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
    'engagement_id', p_engagement_id,
    'request_id',    p_request_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text, uuid, uuid, uuid, uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. request_open_time — a client asking for a time.
--
-- Records the contact anchor alongside the account. Purchase and credit stay
-- NULL here on purpose: this is a REQUEST, and nothing is allocated against it
-- until staff accept.
-- ─────────────────────────────────────────────────────────────────────────────
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

  PERFORM notify_staff(v_org, 'booking_time_requested',
    'A client requested ' || to_char(p_starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', v_id, 'status', 'pending');
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. book_open_slot — a client claims an open slot.
--
-- This is where the ledger closes for self-serve. It already debited the credit
-- and recorded credit_id. It threw away three things it had in hand:
--   · account_contact_id
--   · the offering the credit is for, when the slot itself was generic time
--   · the purchase behind the credit — now knowable via lesson_credits.purchase_id
-- Writing purchase_id here is what makes trg_booking_unit_link claim the unit.
-- ─────────────────────────────────────────────────────────────────────────────
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

  UPDATE bookings SET
    kind = v_kind, status = 'scheduled', is_flexible = false,
    client_id = v_client,
    account_user_id = auth.uid(),
    account_contact_id = v_contact,
    offering_id = coalesce(offering_id, v_cr_off),
    purchase_id = coalesce(purchase_id, v_cr_pur),
    horse_id = coalesce(p_horse_id, horse_id),
    credit_id = v_credit,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'scheduled', 'kind', v_kind);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. generate_lease_availability — lease-held horse time.
--
-- Two things. It resolved the executed lease document and then did not record
-- which agreement the availability came from; bookings.contract_id existed for
-- exactly this. And it looked for template_key 'HORSE_LEASE', which under D10 is
-- the ARCHIVED original — never activated, never used to generate a document. It
-- could therefore never find a lease and always raised. The live lease family is
-- HORSE_LEASE_V2 (Standard) + _SIMPLE + _FULL.
--
-- Client / purchase / credit / instructor stay NULL: this publishes horse time
-- for the lessee to claim later; the claim is a separate act.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_lease_availability(p_horse_id uuid, p_weeks integer DEFAULT 4)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_h horses%ROWTYPE; v_doc uuid; v_contract uuid;
  v_used text[]; v_unav text[];
  d date; v_dow text; v_open time; v_close time; v_closed boolean;
  v_made int := 0; v_start timestamptz; v_end timestamptz;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_h FROM horses WHERE id = p_horse_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;

  -- D10: the live lease family. 'HORSE_LEASE' is the archived original and never
  -- backs a document, so filtering on it made this function unreachable.
  SELECT dc.id, dc.contract_id INTO v_doc, v_contract
    FROM documents dc
    JOIN contract_templates t ON t.id = dc.template_id
    WHERE dc.horse_id = p_horse_id
      AND t.template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_SIMPLE','HORSE_LEASE_FULL')
      AND dc.status = 'EXECUTED' AND dc.deleted_at IS NULL
    ORDER BY dc.effective_date DESC NULLS LAST, dc.created_at DESC LIMIT 1;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'no executed lease contract for this horse'; END IF;

  -- union: the primary lessee's days + every participant's days
  SELECT array_agg(DISTINCT day) INTO v_used FROM (
    SELECT unnest(string_to_array(regexp_replace(coalesce(
             (SELECT value FROM contract_fields WHERE document_id=v_doc AND field_key='TXN.DAYS_USED'),''), '\s','','g'), ',')) AS day
    UNION
    SELECT unnest(string_to_array(regexp_replace(coalesce(days_used,''), '\s','','g'), ',')) AS day
      FROM lease_participants WHERE document_id = v_doc
  ) x WHERE day <> '';
  SELECT string_to_array(regexp_replace(coalesce(value,''), '\s','','g'), ',')
    INTO v_unav FROM contract_fields WHERE document_id = v_doc AND field_key = 'TXN.DAYS_UNAVAILABLE';
  v_used := coalesce(v_used,'{}'); v_unav := coalesce(v_unav,'{}');
  IF array_length(array_remove(v_used,''),1) IS NULL THEN
    RAISE EXCEPTION 'the lease has no "days used" set (primary or participants) — fill it first';
  END IF;

  -- compute any blank participant usage % from the day shares
  PERFORM compute_lease_usage(v_doc);

  FOR d IN SELECT generate_series(current_date, current_date + (p_weeks*7), '1 day')::date LOOP
    CONTINUE WHEN v_h.lease_start IS NOT NULL AND d < v_h.lease_start;
    CONTINUE WHEN v_h.lease_end   IS NOT NULL AND d > v_h.lease_end;
    v_dow := to_char(d, 'Dy');
    CONTINUE WHEN NOT (v_dow = ANY (v_used));
    CONTINUE WHEN v_dow = ANY (v_unav);
    SELECT open_time, close_time, closed INTO v_open, v_close, v_closed
      FROM business_hours WHERE org_id = v_org AND weekday = extract(dow FROM d)::int;
    CONTINUE WHEN coalesce(v_closed, false);
    v_open := coalesce(v_open, '10:00'); v_close := coalesce(v_close, '18:00');
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM bookings b WHERE b.horse_id = p_horse_id AND b.kind='block'
        AND b.is_flexible AND b.starts_at::date = d);
    v_start := d + v_open; v_end := d + v_close;
    INSERT INTO bookings (org_id, kind, status, is_flexible, horse_id, contract_id,
                          starts_at, ends_at, notes, created_by)
      VALUES (v_org, 'block', 'available', true, p_horse_id, v_contract,
              v_start, v_end, 'Leased-horse availability', auth.uid());
    v_made := v_made + 1;
  END LOOP;
  RETURN jsonb_build_object('created', v_made, 'contract_id', v_contract);
END;
$function$;
