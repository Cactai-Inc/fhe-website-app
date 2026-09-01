/*
  # Phase 6 · Slice 3 — staff/admin calendar writes

  The config panel's server side: create/edit calendar items (unavailable blocks,
  flexible-open blocks, and real offering bookings), single or recurring; delete;
  close a whole day; edit business hours; plus the two staff readouts the panel
  shows — revenue totals and the credits/plan roster.

  Conflict rule (owner): a HORSE can't be in two places — reject if a horse-bound
  item overlaps another non-cancelled booking on the same horse. Everything else
  (group lessons, same time different horse) is allowed. One staff member, so no
  instructor conflict.

  A. horse_time_conflict() helper.
  B. save_calendar_item(p jsonb) — create (single/recurring) or edit (one/future/all).
  C. delete_calendar_item(id, scope).
  D. close_day(date) / reopen_day(date).
  E. set_business_hours(jsonb).
  F. calendar_revenue(from,to) + credits_roster().
*/

-- ── A. horse conflict ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION horse_time_conflict(
  p_org uuid, p_horse uuid, p_start timestamptz, p_end timestamptz,
  p_exclude_id uuid, p_exclude_series uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.org_id = p_org
      AND b.horse_id = p_horse
      AND b.status NOT IN ('cancelled','expired','draft')
      AND b.starts_at < p_end AND b.ends_at > p_start
      AND (p_exclude_id IS NULL OR b.id <> p_exclude_id)
      AND (p_exclude_series IS NULL OR b.series_id IS DISTINCT FROM p_exclude_series)
  )
$fn$;

-- ── B. create / edit a calendar item ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION save_calendar_item(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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
        client_id = nullif(p->>'client_id','')::uuid,
        horse_id = v_horse,
        purchase_id = nullif(p->>'purchase_id','')::uuid,
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
      client_id, horse_id, purchase_id, offering_id, location_id, address,
      travel_before_minutes, travel_after_minutes, price_amount, notes,
      series_id, created_by
    ) VALUES (
      v_org, v_kind, v_status, v_s, v_e,
      coalesce((p->>'all_day')::boolean, false),
      coalesce((p->>'is_flexible')::boolean, false),
      nullif(p->>'client_id','')::uuid, v_horse,
      nullif(p->>'purchase_id','')::uuid, v_offer,
      nullif(p->>'location_id','')::uuid, nullif(p->>'address',''),
      coalesce((p->>'travel_before_minutes')::int, 0),
      coalesce((p->>'travel_after_minutes')::int, 0),
      v_price, nullif(p->>'notes',''), v_series, auth.uid()
    ) RETURNING id INTO v_new_id;
  END LOOP;

  RETURN jsonb_build_object('id', v_new_id, 'series_id', v_series);
END;
$fn$;
REVOKE ALL ON FUNCTION save_calendar_item(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION save_calendar_item(jsonb) TO authenticated, service_role;

-- ── C. delete ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_calendar_item(p_id uuid, p_scope text DEFAULT 'one')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid := current_org();
  v_row bookings%ROWTYPE;
  v_n   integer;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_row FROM bookings WHERE id = p_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found in this org'; END IF;

  IF p_scope = 'one' OR v_row.series_id IS NULL THEN
    DELETE FROM bookings WHERE id = p_id;
    v_n := 1;
  ELSIF p_scope = 'future' THEN
    DELETE FROM bookings WHERE series_id = v_row.series_id AND starts_at >= v_row.starts_at;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    DELETE FROM bookings WHERE series_id = v_row.series_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;
  RETURN v_n;
END;
$fn$;
REVOKE ALL ON FUNCTION delete_calendar_item(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION delete_calendar_item(uuid, text) TO authenticated, service_role;

-- ── D. day closure ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION close_day(p_date date, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_org uuid := current_org(); v_id uuid;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  INSERT INTO bookings (org_id, kind, status, all_day, starts_at, ends_at, notes, created_by)
    VALUES (v_org, 'block', 'unavailable', true,
            p_date::timestamptz, (p_date + 1)::timestamptz,
            coalesce(p_reason, 'Closed'), auth.uid())
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$fn$;
REVOKE ALL ON FUNCTION close_day(date, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION close_day(date, text) TO authenticated, service_role;

-- ── E. business hours ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_business_hours(p jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_org uuid := current_org(); e jsonb;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p) LOOP
    INSERT INTO business_hours (org_id, weekday, open_time, close_time, closed)
      VALUES (v_org, (e->>'weekday')::smallint,
              coalesce((e->>'open')::time, '10:00'),
              coalesce((e->>'close')::time, '18:00'),
              coalesce((e->>'closed')::boolean, false))
    ON CONFLICT (org_id, weekday) DO UPDATE
      SET open_time = excluded.open_time, close_time = excluded.close_time, closed = excluded.closed;
  END LOOP;
END;
$fn$;
REVOKE ALL ON FUNCTION set_business_hours(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION set_business_hours(jsonb) TO authenticated, service_role;

-- ── F. staff readouts ────────────────────────────────────────────────────────
-- revenue for a range: committed offering bookings that carry a price.
CREATE OR REPLACE FUNCTION calendar_revenue(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'total', coalesce(sum(price_amount), 0),
      'count', count(*))
    FROM bookings
    WHERE org_id = v_org
      AND starts_at >= p_from AND starts_at < p_to
      AND price_amount IS NOT NULL
      AND status NOT IN ('cancelled','expired','draft','unavailable','available'));
END;
$fn$;
REVOKE ALL ON FUNCTION calendar_revenue(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION calendar_revenue(timestamptz, timestamptz) TO authenticated, service_role;

-- who holds credits (qty remaining), newest grant first.
CREATE OR REPLACE FUNCTION credits_roster()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'client_id', cl.id,
        'name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
        'credits_remaining', r.rem) ORDER BY r.rem DESC), '[]'::jsonb)
    FROM (
      SELECT client_id, sum(credits_remaining)::int AS rem
      FROM lesson_credits
      WHERE org_id = v_org AND deleted_at IS NULL
      GROUP BY client_id
      HAVING sum(credits_remaining) > 0
    ) r
    JOIN clients cl ON cl.id = r.client_id
    JOIN contacts c ON c.id = cl.contact_id);
END;
$fn$;
REVOKE ALL ON FUNCTION credits_roster() FROM public, anon;
GRANT EXECUTE ON FUNCTION credits_roster() TO authenticated, service_role;
