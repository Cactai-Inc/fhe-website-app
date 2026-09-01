\set ON_ERROR_STOP on
\timing off
BEGIN;

\ir ../../supabase/migrations/20260901T1530_the_booking_has_six_states_and_pending_has_one_name.sql
\ir ../../supabase/migrations/20260901T1600_the_schedule_is_one_confirmed_month_and_one_pending_month.sql
\ir ../../supabase/migrations/20260901T1620_the_calendar_shows_each_viewer_only_what_is_theirs.sql
\ir ../../supabase/migrations/20260901T1640_every_advance_is_one_button_pressed_by_one_side.sql

\echo '===== T1 · the CHECK permits the six, and still refuses a typo ====='
SELECT pg_get_constraintdef(oid) AS constraint_now FROM pg_constraint WHERE conname='bookings_status_check';
DO $$
DECLARE v_id uuid; v_org uuid;
BEGIN
  SELECT id, org_id INTO v_id, v_org FROM bookings WHERE status='scheduled' LIMIT 1;
  BEGIN
    UPDATE bookings SET status='aproved' WHERE id=v_id;
    RAISE NOTICE 'T1 FAIL — the typo was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'T1 typo refused: %', SQLERRM;
  END;
END $$;

\echo '===== T11 · booking_status_code + one status_events row per new state ====='
SELECT s AS status, booking_status_code(s) AS code
  FROM unnest(ARRAY['requested','approved','pending','moved','scheduled','confirmed','cancelled','completed']) s;

\echo '===== T2 · every current_date + 90 site is gone ====='
SELECT coalesce(string_agg(proname, ', '), '(none — empty result)') AS ninety_day_sites
  FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosrc ~ 'current_date\s*\+\s*90';
SELECT plan_horizon_through() AS horizon_now;

\echo '===== T13 · sessions still beyond 30+30 (NOT changed by this task) ====='
SELECT count(*) FILTER (WHERE starts_at < now()+interval '30 days')  AS within_30,
       count(*) FILTER (WHERE starts_at >= now()+interval '30 days'
                          AND starts_at <  now()+interval '60 days')  AS days_30_60,
       count(*) FILTER (WHERE starts_at >= now()+interval '60 days')  AS beyond_60,
       max(starts_at)::date AS latest
  FROM bookings WHERE status='scheduled' AND starts_at > now();
