-- TASK-LIFECYCLE — THE WALK. Rehearsed inside BEGIN … ROLLBACK against PRODUCTION.
-- Three identities, impersonated through the same GUC PostgREST sets:
--   STAFF    hello@fhequestrian.com   fdbdfe89-76d7-486b-b734-8e23b09e0353  (ADMIN, org e656f20b…)
--   PARTY    client 4255090d…         a1c2305c-d9eb-4598-89b7-6d4e5795da0a
--   OUTSIDER client 5082a384…         b6969448-893a-4c26-840c-f5329ad6ee23
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

CREATE TEMP TABLE lc_walk(k text primary key, v text);

\echo ''
\echo '######## T12a · A CLIENT ASKS FOR A TIME — the state is `requested` ########'
SET LOCAL request.jwt.claims = :PARTY;
SELECT has_staff_access() AS is_staff, current_client_id() AS me;
SELECT request_open_time(
         date_trunc('hour', now()) + interval '3 days',
         date_trunc('hour', now()) + interval '3 days 1 hour',
         NULL, NULL, 'LIFECYCLE walk') AS request_open_time_says \gset
SELECT :'request_open_time_says'::jsonb ->> 'status' AS status_returned;
INSERT INTO lc_walk VALUES ('booking', (:'request_open_time_says'::jsonb ->> 'booking_id'));
SELECT b.status AS status_in_the_row, b.starts_at
  FROM bookings b WHERE b.id = (SELECT v FROM lc_walk WHERE k='booking')::uuid;

\echo ''
\echo '-- the status_events row the trigger wrote for `requested` (Trap 2: not the ELSE) --'
SELECT se.status AS code_written, se.entity_type
  FROM status_events se
 WHERE se.entity_id = (SELECT v FROM lc_walk WHERE k='booking')::uuid
 ORDER BY se.created_at DESC LIMIT 1;

\echo ''
\echo '######## T12b · STAFF APPROVE AN UNPAID ORDER → `approved`, and the ask goes out ########'
-- attach the booking to a real UNPAID order (ee332402…, $170, awaiting_payment)
UPDATE bookings SET purchase_id = 'ee332402-189f-4edd-b624-e59fd7b3e58b', credit_id = NULL
 WHERE id = (SELECT v FROM lc_walk WHERE k='booking')::uuid;
SET LOCAL request.jwt.claims = :STAFF;
SELECT p.payment_status, p.amount, p.amount_paid FROM purchases p WHERE p.id='ee332402-189f-4edd-b624-e59fd7b3e58b';
SELECT decide_booking_change(
         (SELECT cr.id FROM booking_change_requests cr
           WHERE cr.booking_id = (SELECT v FROM lc_walk WHERE k='booking')::uuid
             AND cr.status='pending' ORDER BY cr.created_at DESC LIMIT 1),
         true) AS decide_says;
SELECT status AS booking_now FROM bookings WHERE id = (SELECT v FROM lc_walk WHERE k='booking')::uuid;
\echo '-- the TELL: request_purchase_payment wrote the order timeline, and the buyer was notified --'
SELECT status AS event, left(detail, 60) AS detail FROM status_events
 WHERE entity_type='order' AND entity_id='ee332402-189f-4edd-b624-e59fd7b3e58b'
 ORDER BY created_at DESC LIMIT 2;
SELECT kind, left(title, 55) AS title FROM notifications
 WHERE user_id='a1c2305c-d9eb-4598-89b7-6d4e5795da0a' ORDER BY created_at DESC LIMIT 2;

\echo ''
\echo '######## T3-cash · THE CLIENT DECLARES A METHOD → `pending` ########'
SET LOCAL request.jwt.claims = :PARTY;
SELECT report_my_payment('ee332402-189f-4edd-b624-e59fd7b3e58b','cash') -> 'recorded' AS recorded;
SELECT status AS booking_now FROM bookings WHERE id = (SELECT v FROM lc_walk WHERE k='booking')::uuid;

\echo ''
\echo '######## T6 · A `pending` BOOKING DOES NOT BLOCK BOOKING (D23/D24) ########'
SELECT request_open_time(
         date_trunc('hour', now()) + interval '4 days',
         date_trunc('hour', now()) + interval '4 days 1 hour',
         NULL, NULL, 'booked while pending') ->> 'status' AS second_request_status;

\echo ''
\echo '######## T3/T5 · STAFF CONFIRM THE MONEY → the month flips to `scheduled` ########'
SET LOCAL request.jwt.claims = :STAFF;
SELECT confirm_payment_claim('ee332402-189f-4edd-b624-e59fd7b3e58b') ->> 'confirmed' AS claim_confirmed;
SELECT status AS booking_now, purchase_id FROM bookings WHERE id = (SELECT v FROM lc_walk WHERE k='booking')::uuid;
\echo '-- and it touched no other order''s bookings --'
SELECT count(*) AS other_orders_bookings_moved FROM bookings
 WHERE purchase_id <> 'ee332402-189f-4edd-b624-e59fd7b3e58b'
   AND updated_at > now() - interval '5 seconds';

\echo ''
\echo '######## T12c · APPROVING A *PAID* ORDER DOES NOT ASK FOR MONEY ########'
SET LOCAL request.jwt.claims = :PARTY;
SELECT request_open_time(
         date_trunc('hour', now()) + interval '5 days',
         date_trunc('hour', now()) + interval '5 days 1 hour',
         NULL, NULL, 'paid order walk') ->> 'booking_id' AS paid_booking \gset
INSERT INTO lc_walk VALUES ('paid_booking', :'paid_booking');
UPDATE bookings SET purchase_id='ee332402-189f-4edd-b624-e59fd7b3e58b' WHERE id = :'paid_booking'::uuid;
SET LOCAL request.jwt.claims = :STAFF;
SELECT decide_booking_change(
         (SELECT cr.id FROM booking_change_requests cr
           WHERE cr.booking_id = :'paid_booking'::uuid AND cr.status='pending'
           ORDER BY cr.created_at DESC LIMIT 1), true) -> 'payment_requested' AS payment_requested;
SELECT status AS booking_now FROM bookings WHERE id = :'paid_booking'::uuid;

ROLLBACK;
