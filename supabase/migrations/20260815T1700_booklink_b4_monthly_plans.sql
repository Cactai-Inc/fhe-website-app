-- BOOKLINK B4 — monthly plans become assignable and real.
--
-- Owner (2026-08-15, verbatim): "any one on a monthly plan needs to be
-- assigned one and marked as such so their lessons can be added to the
-- calendar and if they have a recurring day of the week for the lesson it
-- can be set and then they can request for a reschedule to another day of the
-- same week or a different week later in the month, but monthly lessons need
-- to be used in the month they dont carry over to the next month."
--
-- COORDINATE flag from the spec, answered here: "say in your report exactly
-- how monthly entitlements are represented and expired." They are NOT
-- represented by lesson_credits — 12 recurring offerings were checked live
-- this session and every one has unit_count NULL and mints zero credits
-- (F8/FLOWTRACE §8's pending fix is about that same regex-minting logic).
-- This migration never touches that minting path, so it cannot double-mint
-- or collide with whichever thread runs that fix. Instead:
--
--   "the purchase of a config_kind='recurring' offering IS the assignment —
--   surface it as a marker on the client, don't invent a parallel table"
--   (spec, B4). client_monthly_plan()/my_monthly_plan() below is a pure READ
--   over purchases/purchase_items/bookings — no new ledger row anywhere.
--
--   The recurring day lives in purchase_items.config jsonb — already the
--   "per-line intent" column (CLAUDE.md) — as {"recurring_day":"Mon"}. No
--   new table (spec's own instruction).
--
--   "N left this month" = weekly_frequency × (occurrences of recurring_day
--   in the CURRENT calendar month) − (this client's scheduled/completed
--   lesson bookings against this purchase THIS calendar month). Both halves
--   are date-scoped to the current month by construction — there is no
--   stored balance to carry forward, so "no carryover" is the query
--   boundary itself, not an expiry sweep that can be skipped or fire late.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. set_recurring_day — the marker + the day, in one write. Staff or the
--    client themself (a monthly-plan client setting their own preferred day).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_recurring_day(p_purchase_item_id uuid, p_day text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi   purchase_items%ROWTYPE;
  v_pu   purchases%ROWTYPE;
  v_off  offerings%ROWTYPE;
  v_day  text := initcap(btrim(coalesce(p_day, '')));
  v_client uuid;
BEGIN
  IF v_day NOT IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun') THEN
    RAISE EXCEPTION 'day must be one of Mon/Tue/Wed/Thu/Fri/Sat/Sun, got %', p_day;
  END IF;

  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  IF NOT FOUND OR v_off.config_kind <> 'recurring' THEN
    RAISE EXCEPTION 'purchase item % is not a monthly-plan (recurring) offering', p_purchase_item_id;
  END IF;

  SELECT id INTO v_client FROM clients WHERE contact_id = v_pu.buyer_contact_id AND deleted_at IS NULL;
  IF NOT (has_staff_access() OR (v_client IS NOT NULL AND v_client = current_client_id())) THEN
    RAISE EXCEPTION 'not authorized to set this plan''s day';
  END IF;

  UPDATE purchase_items SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object('recurring_day', v_day)
   WHERE id = p_purchase_item_id;

  RETURN jsonb_build_object('purchase_item_id', p_purchase_item_id, 'recurring_day', v_day);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_recurring_day(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_recurring_day(uuid, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. _monthly_plan_for_client — the shared read, wrapped by both the staff
--    and client-facing RPCs below (one implementation, two callers — the
--    two-implementations rule the spec names explicitly).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._monthly_plan_for_client(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi   purchase_items%ROWTYPE;
  v_pu   purchases%ROWTYPE;
  v_off  offerings%ROWTYPE;
  v_day  text;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end   date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_occurrences int := 0;
  v_entitled    int;
  v_used        int;
BEGIN
  -- the most recent recurring-offering purchase this client holds IS the
  -- assignment (spec's own words) — no separate "is this client on a plan" flag.
  SELECT pi.* INTO v_pi
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id AND pu.deleted_at IS NULL
    JOIN clients cl ON cl.contact_id = pu.buyer_contact_id
    JOIN offerings o ON o.id = pi.offering_id AND o.config_kind = 'recurring'
   WHERE cl.id = p_client_id
   ORDER BY pu.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_pu  FROM purchases WHERE id = v_pi.purchase_id;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  v_day := v_pi.config->>'recurring_day';

  IF v_day IS NOT NULL THEN
    SELECT count(*) INTO v_occurrences
      FROM generate_series(v_month_start, v_month_end, interval '1 day') d
     WHERE to_char(d, 'Dy') = v_day;
    v_entitled := coalesce(v_off.weekly_frequency, 1) * v_occurrences;
  END IF;

  SELECT count(*) INTO v_used
    FROM bookings b
   WHERE b.purchase_id = v_pu.id AND b.client_id = p_client_id
     AND b.kind = 'lesson' AND b.status IN ('scheduled','completed')
     AND b.starts_at >= v_month_start AND b.starts_at < (v_month_end + 1);

  RETURN jsonb_build_object(
    'purchase_id', v_pu.id, 'purchase_item_id', v_pi.id,
    'offering_id', v_off.id, 'offering_name', v_off.name,
    'weekly_frequency', v_off.weekly_frequency, 'recurring_day', v_day,
    'month_label', to_char(v_month_start, 'FMMonth YYYY'),
    'entitled_this_month', v_entitled, 'used_this_month', v_used,
    'remaining_this_month', CASE WHEN v_entitled IS NULL THEN NULL ELSE greatest(v_entitled - v_used, 0) END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._monthly_plan_for_client(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._monthly_plan_for_client(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.my_monthly_plan()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_client uuid := current_client_id();
BEGIN
  IF v_client IS NULL THEN RETURN NULL; END IF;
  RETURN _monthly_plan_for_client(v_client);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.my_monthly_plan() TO authenticated;

CREATE OR REPLACE FUNCTION public.client_monthly_plan(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN _monthly_plan_for_client(p_client_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.client_monthly_plan(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. generate_monthly_lessons — staff: produce the weekly series on the
--    calendar for the remainder of THIS calendar month only (no carryover —
--    the hard wall is that this function structurally cannot write a booking
--    past month end). Extends the series_id machinery save_calendar_item
--    already uses rather than duplicating it; skips any date that already
--    has a lesson booking for this client+purchase (safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_monthly_lessons(
  p_client_id uuid, p_purchase_item_id uuid,
  p_start_time text, p_duration_minutes integer DEFAULT 60,
  p_horse_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid := current_org();
  v_pi    purchase_items%ROWTYPE;
  v_pu    purchases%ROWTYPE;
  v_off   offerings%ROWTYPE;
  v_cl    clients%ROWTYPE;
  v_day   text;
  v_acct_c uuid;
  v_acct_u uuid;
  v_series uuid := gen_random_uuid();
  v_month_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  d       date;
  v_s     timestamptz;
  v_e     timestamptz;
  v_made  int := 0;
  v_skipped int := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;

  SELECT * INTO v_cl FROM clients WHERE id = p_client_id AND deleted_at IS NULL AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'client not found in this org'; END IF;

  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL AND buyer_contact_id = v_cl.contact_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item % does not belong to this client', p_purchase_item_id; END IF;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  IF NOT FOUND OR v_off.config_kind <> 'recurring' THEN
    RAISE EXCEPTION 'purchase item % is not a monthly-plan (recurring) offering', p_purchase_item_id;
  END IF;

  v_day := v_pi.config->>'recurring_day';
  IF v_day IS NULL THEN
    RAISE EXCEPTION 'set the recurring day first (set_recurring_day)';
  END IF;

  v_acct_c := v_cl.contact_id;
  SELECT pr.user_id INTO v_acct_u FROM profiles pr WHERE pr.contact_id = v_acct_c;

  FOR d IN SELECT generate_series(current_date, v_month_end, interval '1 day')::date LOOP
    CONTINUE WHEN to_char(d, 'Dy') <> v_day;
    v_s := d + p_start_time::time;
    v_e := v_s + make_interval(mins => coalesce(p_duration_minutes, 60));

    -- no carryover, structurally: the generate_series bound is v_month_end —
    -- there is no path in this loop that can ever produce a date past it.

    IF EXISTS (
      SELECT 1 FROM bookings b WHERE b.client_id = p_client_id AND b.kind = 'lesson'
        AND b.purchase_id = v_pu.id AND b.starts_at::date = d AND b.status NOT IN ('cancelled','expired')
    ) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;

    IF p_horse_id IS NOT NULL AND horse_time_conflict(v_org, p_horse_id, v_s, v_e, NULL, v_series) THEN
      RAISE EXCEPTION 'that horse is already booked in an overlapping time on %', d;
    END IF;

    INSERT INTO bookings (
      org_id, kind, status, starts_at, ends_at, is_flexible,
      client_id, account_contact_id, account_user_id, instructor_user_id,
      horse_id, purchase_id, offering_id, location_id, price_amount,
      series_id, created_by
    ) VALUES (
      v_org, 'lesson', 'scheduled', v_s, v_e, false,
      p_client_id, v_acct_c, v_acct_u, auth.uid(),
      p_horse_id, v_pu.id, v_off.id, p_location_id, v_off.price_amount,
      v_series, auth.uid()
    );
    v_made := v_made + 1;
  END LOOP;

  RETURN jsonb_build_object('series_id', v_series, 'created', v_made, 'skipped_existing', v_skipped, 'recurring_day', v_day);
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_monthly_lessons(uuid, uuid, text, integer, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_lessons(uuid, uuid, text, integer, uuid, uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. request_booking_change — the no-carryover wall on the reschedule side.
--    Byte-identical to the live prod body (re-read via pg_get_functiondef
--    this session) except the one new guard: a monthly-plan booking's
--    reschedule may move within the booking's OWN current month only — "a
--    different week later in the month", never into next month. Everything
--    else (cancel, defer, non-recurring reschedules) is untouched.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_booking_change(p_booking_id uuid, p_kind text, p_new_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_new_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_scope text DEFAULT 'one'::text, p_note text DEFAULT NULL::text)
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

  INSERT INTO booking_change_requests (
    org_id, booking_id, requested_by, request_kind,
    proposed_starts_at, proposed_ends_at, scope, status,
    fee_amount, phone_required, note)
  VALUES (
    v_b.org_id, p_booking_id, auth.uid(), p_kind,
    p_new_start, p_new_end, p_scope, 'pending',
    NULLIF(v_fee,0), v_phone, p_note)
  RETURNING id INTO v_id;

  UPDATE bookings SET status = 'pending', updated_at = now()
   WHERE id = p_booking_id AND status IN ('scheduled','confirmed');

  -- staff get an in-app heads-up (email rides the sweep)
  PERFORM notify_staff(v_b.org_id, 'booking_change_requested',
    initcap(p_kind) || ' requested — ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object(
    'change_id', v_id, 'fee_amount', NULLIF(v_fee,0), 'phone_required', v_phone, 'kind', p_kind);
END;
$function$;
