-- TASK-LIFECYCLE — WALK 2: THE HOLD, THE THREE IDENTITIES, AND THE HORIZON.
-- BEGIN … ROLLBACK against PRODUCTION.
\set ON_ERROR_STOP on
\set QUIET on
BEGIN;
\ir ../../supabase/migrations/20260901T1530_the_booking_has_six_states_and_pending_has_one_name.sql
\ir ../../supabase/migrations/20260901T1600_the_schedule_is_one_confirmed_month_and_one_pending_month.sql
\ir ../../supabase/migrations/20260901T1620_the_calendar_shows_each_viewer_only_what_is_theirs.sql
\ir ../../supabase/migrations/20260901T1640_every_advance_is_one_button_pressed_by_one_side.sql
\set QUIET off

\set STAFF    '''{"sub":"fdbdfe89-76d7-486b-b734-8e23b09e0353","role":"authenticated"}'''
\set PARTY    '''{"sub":"a1c2305c-d9eb-4598-89b7-6d4e5795da0a","role":"authenticated"}'''
\set OUTSIDER '''{"sub":"b6969448-893a-4c26-840c-f5329ad6ee23","role":"authenticated"}'''

-- one real, live, scheduled lesson belonging to the PARTY
SELECT b.id AS bk, b.starts_at AS bk_start
  FROM bookings b
 WHERE b.client_id='4255090d-a787-4d1f-bf57-57dc53de0506'
   AND b.status='scheduled' AND b.starts_at > now()+interval '3 days'
 ORDER BY b.starts_at LIMIT 1 \gset

\echo ''
\echo '######## T7/T9 · THE HOLD — a reschedule ask makes the slot `moved` ########'
SET LOCAL request.jwt.claims = :PARTY;
SELECT request_booking_change(:'bk'::uuid, 'reschedule',
         :'bk_start'::timestamptz + interval '2 hours',
         :'bk_start'::timestamptz + interval '3 hours') ->> 'change_id' AS change_id \gset chg_
SELECT status AS booking_now, starts_at AS still_at_the_old_time FROM bookings WHERE id = :'bk'::uuid;

\echo ''
\echo '-- the same slot, read by THREE identities, through calendar_free_busy --'
\echo '-- PARTY:'
SELECT jsonb_pretty(i) FROM jsonb_array_elements(
  (calendar_free_busy(:'bk_start'::timestamptz - interval '1 minute',
                      :'bk_start'::timestamptz + interval '1 hour')->'items')) i
 WHERE i->>'id' = :'bk';
\echo '-- OUTSIDER:'
SET LOCAL request.jwt.claims = :OUTSIDER;
SELECT jsonb_pretty(i) FROM jsonb_array_elements(
  (calendar_free_busy(:'bk_start'::timestamptz - interval '1 minute',
                      :'bk_start'::timestamptz + interval '1 hour')->'items')) i
 WHERE i->>'id' = :'bk';
\echo '-- STAFF:'
SET LOCAL request.jwt.claims = :STAFF;
SELECT i->>'status' AS staff_sees, i->>'client_id' AS client_id FROM jsonb_array_elements(
  (calendar_free_busy(:'bk_start'::timestamptz - interval '1 minute',
                      :'bk_start'::timestamptz + interval '1 hour')->'items')) i
 WHERE i->>'id' = :'bk';

\echo ''
\echo '######## T9 · AN OUTSIDER CANNOT BOOK THE HELD SLOT ########'
SET LOCAL request.jwt.claims = :OUTSIDER;
SET LOCAL lc.bk = :'bk';
DO $$
BEGIN
  PERFORM book_open_slot(current_setting('lc.bk')::uuid);
  RAISE NOTICE 'T9 FAIL — the held slot was booked';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'T9 refusal: %', SQLERRM;
END $$;

\echo ''
\echo '######## T10 · ON APPROVAL THE HOLD RELEASES — the row moves, the old slot empties ########'
SET LOCAL request.jwt.claims = :STAFF;
SELECT decide_booking_change(:'chg_change_id'::uuid, true) ->> 'status' AS decision;
SELECT status AS booking_now, starts_at AS moved_to FROM bookings WHERE id = :'bk'::uuid;
\echo '-- the OLD time, read by the outsider: nothing there --'
SET LOCAL request.jwt.claims = :OUTSIDER;
SELECT count(*) AS items_at_the_old_time FROM jsonb_array_elements(
  (calendar_free_busy(:'bk_start'::timestamptz - interval '1 minute',
                      :'bk_start'::timestamptz + interval '59 minutes')->'items')) i
 WHERE i->>'id' = :'bk';

\echo ''
\echo '######## T8 · A CANCELLED BOOKING IS VISIBLE TO ITS PARTIES, ABSENT FOR EVERYONE ELSE ########'
UPDATE bookings SET status='cancelled' WHERE id = :'bk'::uuid;
SET LOCAL request.jwt.claims = :PARTY;
SELECT coalesce((SELECT i->>'status' FROM jsonb_array_elements(
  (calendar_free_busy(now(), now()+interval '40 days')->'items')) i WHERE i->>'id' = :'bk'), '(absent)') AS party_sees;
SET LOCAL request.jwt.claims = :STAFF;
SELECT coalesce((SELECT i->>'status' FROM jsonb_array_elements(
  (calendar_free_busy(now(), now()+interval '40 days')->'items')) i WHERE i->>'id' = :'bk'), '(absent)') AS staff_sees;
SET LOCAL request.jwt.claims = :OUTSIDER;
SELECT coalesce((SELECT i->>'status' FROM jsonb_array_elements(
  (calendar_free_busy(now(), now()+interval '40 days')->'items')) i WHERE i->>'id' = :'bk'), '(absent)') AS outsider_sees;

ROLLBACK;
