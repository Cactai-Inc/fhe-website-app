-- TASK-LIFECYCLE · T11 — a deliberate code for every new state, and the
-- status_events row each one writes. BEGIN … ROLLBACK against PRODUCTION,
-- AFTER the migrations were applied.
\set ON_ERROR_STOP on
BEGIN;
\echo '===== the arms, in the function itself — `requested`/`approved`/`moved` are NAMED ====='
SELECT prosrc AS booking_status_code_body FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname='booking_status_code';

\echo ''
\echo '===== one status_events row per new state ====='
SELECT b.id AS bk FROM bookings b WHERE b.status='scheduled' AND b.starts_at > now() ORDER BY b.starts_at LIMIT 1 \gset
UPDATE bookings SET status='requested' WHERE id = :'bk'::uuid;
UPDATE bookings SET status='approved'  WHERE id = :'bk'::uuid;
UPDATE bookings SET status='moved'     WHERE id = :'bk'::uuid;
UPDATE bookings SET status='scheduled' WHERE id = :'bk'::uuid;
SELECT se.status AS code_written, se.created_at
  FROM status_events se WHERE se.entity_id = :'bk'::uuid
   AND se.created_at > now() - interval '1 minute'
 ORDER BY se.created_at;
\echo '-- ⚠️ the four writes collapse to TWO events on purpose: the trigger only'
\echo '-- writes when the CODE changes, and requested/approved/moved are all'
\echo '-- `pending`. current_status carries the code; the row below is the truth. --'
SELECT status, current_status FROM bookings WHERE id = :'bk'::uuid;

\echo ''
\echo '===== T13 · sessions still beyond 30+30, AFTER the change (not touched) ====='
SELECT count(*) FILTER (WHERE starts_at >= now()+interval '30 days'
                          AND starts_at <  now()+interval '60 days') AS days_30_60,
       count(*) FILTER (WHERE starts_at >= now()+interval '60 days') AS beyond_60,
       max(starts_at)::date AS latest
  FROM bookings WHERE status='scheduled' AND starts_at > now();
ROLLBACK;
