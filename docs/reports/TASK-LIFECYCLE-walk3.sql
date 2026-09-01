-- TASK-LIFECYCLE — WALK 3: THE HORIZON. One confirmed month, one pending month,
-- and the daily cron run twice. BEGIN … ROLLBACK against PRODUCTION.
\set ON_ERROR_STOP on
\set QUIET on
BEGIN;
\ir ../../supabase/migrations/20260901T1530_the_booking_has_six_states_and_pending_has_one_name.sql
\ir ../../supabase/migrations/20260901T1600_the_schedule_is_one_confirmed_month_and_one_pending_month.sql
\ir ../../supabase/migrations/20260901T1620_the_calendar_shows_each_viewer_only_what_is_theirs.sql
\ir ../../supabase/migrations/20260901T1640_every_advance_is_one_button_pressed_by_one_side.sql
\set QUIET off
\set STAFF '''{"sub":"fdbdfe89-76d7-486b-b734-8e23b09e0353","role":"authenticated"}'''
SET LOCAL request.jwt.claims = :STAFF;

\echo '######## the plan under test ########'
SELECT pi.id AS pi, pi.purchase_id AS pu
  FROM purchase_items pi
  JOIN offerings o  ON o.id = pi.offering_id AND o.config_kind='recurring'
  JOIN purchases pu ON pu.id = pi.purchase_id AND pu.status <> 'draft' AND pu.deleted_at IS NULL
 WHERE pi.voided_at IS NULL
   AND nullif(btrim(coalesce(pi.config->>'recurring_time','')),'') IS NOT NULL
   AND (pi.plan_ends_on IS NULL OR pi.plan_ends_on >= current_date)
 ORDER BY pi.created_at DESC LIMIT 1 \gset

SELECT to_char(date_trunc('month', starts_at),'YYYY-MM') AS month, status, count(*)
  FROM bookings WHERE purchase_id = :'pu'::uuid AND starts_at >= date_trunc('month', current_date)
 GROUP BY 1,2 ORDER BY 1,2;

\echo ''
\echo '######## T3 · REGENERATED FROM SCRATCH: one confirmed month, one pending month, nothing beyond ########'
-- Rehearse a plan that has not been materialised yet. TWO things must be undone
-- inside the rollback, and the second one is the reason a naive rehearsal reads
-- "created: 0" and looks like a broken generator:
--   1. the plan''s future bookings, and
--   2. THE ENTITLEMENT THEY SPENT. `_generate_plan_month` is gated on
--      `lesson_credits.credits_remaining`, and deleting a booking does not put
--      the allotment back. Every allotment on a materialised plan reads 0 —
--      which is CORRECT (CAREPLANS: the SLOT is the entitlement, and an
--      orchestrator has already been corrected for reporting remaining=0 as a
--      defect). Restoring it here reproduces a fresh month, nothing more.
DELETE FROM bookings WHERE purchase_id = :'pu'::uuid AND starts_at >= date_trunc('month', current_date);
UPDATE lesson_credits SET credits_remaining = 5
 WHERE purchase_id = :'pu'::uuid
   AND expires_at >= date_trunc('month', current_date) + interval '1 month'
   AND expires_at <= date_trunc('month', current_date) + interval '2 months';
UPDATE purchase_items SET config = config - 'horizon_through' WHERE id = :'pi'::uuid;
SELECT _ensure_plan_horizon(:'pi'::uuid) AS horizon_says;
SELECT to_char(date_trunc('month', starts_at),'YYYY-MM') AS month, status, count(*)
  FROM bookings WHERE purchase_id = :'pu'::uuid AND starts_at >= date_trunc('month', current_date)
 GROUP BY 1,2 ORDER BY 1,2;

\echo ''
\echo '######## T4 · THE DAILY CRON, RUN TWICE, DOES NOT EXTEND PAST THE PENDING MONTH ########'
SELECT mint_recurring_allotments() - 'credits_minted' AS first_run;
SELECT max(starts_at)::date AS furthest_booking_after_run_1
  FROM bookings WHERE status IN ('scheduled','pending') ;
SELECT mint_recurring_allotments() - 'credits_minted' AS second_run;
SELECT max(starts_at)::date AS furthest_booking_after_run_2
  FROM bookings WHERE status IN ('scheduled','pending');
\echo '-- nothing this org generated sits beyond the horizon (the 43 pre-existing rows are NOT ours) --'
SELECT count(*) AS generated_beyond_the_horizon
  FROM bookings WHERE created_at > now() - interval '2 minutes'
   AND starts_at::date > plan_horizon_through();

\echo ''
\echo '######## T5 · CONFIRMING PAYMENT FLIPS *THAT* MONTH AND NO OTHER ########'
SELECT to_char(date_trunc('month', starts_at),'YYYY-MM') AS month, status, count(*)
  FROM bookings WHERE purchase_id = :'pu'::uuid AND starts_at >= date_trunc('month', current_date)
 GROUP BY 1,2 ORDER BY 1,2;
UPDATE purchases SET payment_status='unpaid' WHERE id = :'pu'::uuid;
UPDATE purchases SET payment_status='paid'   WHERE id = :'pu'::uuid;   -- the trigger fires here
\echo '-- after the flip --'
SELECT to_char(date_trunc('month', starts_at),'YYYY-MM') AS month, status, count(*)
  FROM bookings WHERE purchase_id = :'pu'::uuid AND starts_at >= date_trunc('month', current_date)
 GROUP BY 1,2 ORDER BY 1,2;

ROLLBACK;
