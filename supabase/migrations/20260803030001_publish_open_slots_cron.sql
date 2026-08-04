-- Rolling availability horizon (owner directive 2026-08-03): the hourly
-- calendar-reminders cron keeps 4 weeks of open slots published at all
-- times. The cron runs as the service role with no staff session, so it
-- gets its own org-looping entry point; the core is shared with the
-- staff-gated publish_open_slots.
CREATE OR REPLACE FUNCTION public._publish_open_slots_for_org(
  p_org uuid, p_weeks integer, p_slot_minutes integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_day date; v_bh record; v_t timestamptz; v_end timestamptz; v_n integer := 0;
BEGIN
  IF p_slot_minutes NOT BETWEEN 15 AND 240 THEN RAISE EXCEPTION 'slot length out of range'; END IF;
  FOR v_day IN SELECT d::date FROM generate_series(current_date, current_date + (p_weeks * 7 - 1), interval '1 day') d LOOP
    SELECT * INTO v_bh FROM business_hours
     WHERE org_id = p_org AND weekday = extract(dow FROM v_day)::int AND NOT closed;
    CONTINUE WHEN NOT FOUND;
    v_t   := (v_day::text || ' ' || v_bh.open_time::text)::timestamp AT TIME ZONE 'America/Los_Angeles';
    v_end := (v_day::text || ' ' || v_bh.close_time::text)::timestamp AT TIME ZONE 'America/Los_Angeles';
    WHILE v_t + make_interval(mins => p_slot_minutes) <= v_end LOOP
      IF v_t > now() AND NOT EXISTS (
           SELECT 1 FROM bookings b
            WHERE b.org_id = p_org
              AND coalesce(b.status,'') NOT IN ('cancelled','expired')
              AND b.starts_at < v_t + make_interval(mins => p_slot_minutes)
              AND b.ends_at   > v_t)
      THEN
        INSERT INTO bookings (org_id, kind, status, is_flexible, starts_at, ends_at)
        VALUES (p_org, 'lesson', 'available', true, v_t, v_t + make_interval(mins => p_slot_minutes));
        v_n := v_n + 1;
      END IF;
      v_t := v_t + make_interval(mins => p_slot_minutes);
    END LOOP;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public._publish_open_slots_for_org(uuid, integer, integer) FROM PUBLIC;

-- staff-gated entry point now delegates to the shared core
CREATE OR REPLACE FUNCTION public.publish_open_slots(p_weeks integer DEFAULT 4, p_slot_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org(); v_n integer;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'no organization in session'; END IF;
  v_n := _publish_open_slots_for_org(v_org, p_weeks, p_slot_minutes);
  RETURN jsonb_build_object('published', v_n, 'weeks', p_weeks, 'slot_minutes', p_slot_minutes);
END;
$function$;

-- cron entry point: service role only, loops every org with business hours
CREATE OR REPLACE FUNCTION public.publish_open_slots_all(p_weeks integer DEFAULT 4, p_slot_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r record; v_total integer := 0; v_orgs integer := 0;
BEGIN
  FOR r IN SELECT DISTINCT org_id FROM business_hours WHERE NOT closed LOOP
    v_total := v_total + _publish_open_slots_for_org(r.org_id, p_weeks, p_slot_minutes);
    v_orgs := v_orgs + 1;
  END LOOP;
  RETURN jsonb_build_object('published', v_total, 'orgs', v_orgs, 'weeks', p_weeks);
END;
$function$;
REVOKE ALL ON FUNCTION public.publish_open_slots_all(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_open_slots_all(integer, integer) TO service_role;
