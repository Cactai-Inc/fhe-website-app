-- Open-slot inventory fix (2026-08-03): business_hours never became
-- member-bookable slots, and generic slots rejected offering-tagged credits.
-- book_open_slot carried forward from live otherwise unchanged.
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

  UPDATE bookings SET
    kind = v_kind, status = 'scheduled', is_flexible = false,
    client_id = v_client,
    account_user_id = auth.uid(),
    horse_id = coalesce(p_horse_id, horse_id),
    credit_id = v_credit,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'scheduled', 'kind', v_kind);
END;
$function$

;

-- Publish bookable one-hour open slots from business_hours (owner fix
-- 2026-08-03): business hours painted the staff calendar but never became
-- member-bookable inventory — customers would have found zero open slots.
-- Idempotent: skips any window overlapping an existing non-cancelled booking
-- (Claire's scheduled sessions, close_day blocks, already-published slots).
-- Staff-gated; horizon defaults to 4 weeks of org-local (America/Los_Angeles)
-- business days.
CREATE OR REPLACE FUNCTION public.publish_open_slots(p_weeks integer DEFAULT 4, p_slot_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_day date;
  v_bh  record;
  v_t   timestamptz;
  v_end timestamptz;
  v_n   integer := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'no organization in session'; END IF;
  IF p_slot_minutes NOT BETWEEN 15 AND 240 THEN RAISE EXCEPTION 'slot length out of range'; END IF;

  FOR v_day IN SELECT d::date FROM generate_series(current_date, current_date + (p_weeks * 7 - 1), interval '1 day') d LOOP
    SELECT * INTO v_bh FROM business_hours
     WHERE org_id = v_org AND weekday = extract(dow FROM v_day)::int AND NOT closed;
    CONTINUE WHEN NOT FOUND;

    v_t   := (v_day::text || ' ' || v_bh.open_time::text)::timestamp AT TIME ZONE 'America/Los_Angeles';
    v_end := (v_day::text || ' ' || v_bh.close_time::text)::timestamp AT TIME ZONE 'America/Los_Angeles';

    WHILE v_t + make_interval(mins => p_slot_minutes) <= v_end LOOP
      IF v_t > now() AND NOT EXISTS (
           SELECT 1 FROM bookings b
            WHERE b.org_id = v_org
              AND coalesce(b.status,'') NOT IN ('cancelled','expired')
              AND b.starts_at < v_t + make_interval(mins => p_slot_minutes)
              AND b.ends_at   > v_t)
      THEN
        INSERT INTO bookings (org_id, kind, status, is_flexible, starts_at, ends_at)
        VALUES (v_org, 'lesson', 'available', true, v_t, v_t + make_interval(mins => p_slot_minutes));
        v_n := v_n + 1;
      END IF;
      v_t := v_t + make_interval(mins => p_slot_minutes);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('published', v_n, 'weeks', p_weeks, 'slot_minutes', p_slot_minutes);
END;
$function$;
REVOKE ALL ON FUNCTION public.publish_open_slots(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_open_slots(integer, integer) TO authenticated, service_role;
