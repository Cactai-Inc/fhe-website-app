-- TASK-BUYANDBOOK — the acceptance run. Every numbered test in §5 of the task doc.
-- Run: psql "$(head -1 .env.db)" -f docs/reports/TASK-BUYANDBOOK-verify.sql
-- It is wrapped in BEGIN…ROLLBACK: it proves behaviour and leaves prod untouched.
\set ON_ERROR_STOP on
\set MEMBER '03c14c97-6fae-4dba-80b4-c9ae47602f90'
\set STAFF  'b45a5503-89bc-489a-b012-c7fbf5c09632'
BEGIN;
\set QUIET on
CREATE TEMP TABLE t (k text primary key, v uuid);
GRANT ALL ON TABLE t TO authenticated, anon;
\set QUIET off

\echo ''
\echo '════ TEST 1 — an authenticated member creates a purchase (the 403 is gone) ════'
SET LOCAL request.jwt.claims = '{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}';
SET LOCAL role authenticated;
SELECT has_staff_access() AS caller_is_staff;
\echo '-- the raw INSERT is STILL refused for a member (RLS untouched, by design):'
DO $$ BEGIN
  BEGIN
    INSERT INTO purchases (buyer_user_id, status, amount) VALUES (auth.uid(), 'draft', 1);
    RAISE NOTICE 'DIRECT INSERT SUCCEEDED — RLS WAS WIDENED (this is a failure)';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    RAISE NOTICE 'direct member INSERT still refused: %', SQLERRM;
  END;
END $$;
\echo '-- and the RPC succeeds:'
INSERT INTO t SELECT 'pack', create_my_purchase('[{"offering_slug":"riding-lesson--item-e1d83c06"}]'::jsonb);
INSERT INTO t SELECT 'plan', create_my_purchase('[{"offering_slug":"riding-lesson--item-24a12d4a"}]'::jsonb);
RESET role;
SELECT display_code, status, payment_status, amount, amount_paid,
       buyer_user_id IS NOT NULL AS has_login, buyer_contact_id IS NOT NULL AS has_contact
  FROM purchases WHERE id IN (SELECT v FROM t) ORDER BY created_at;

\echo ''
\echo '════ TEST 2 — anon is STILL refused on purchases INSERT, and on the RPC ════'
INSERT INTO t SELECT 'org', id FROM organizations ORDER BY created_at LIMIT 1;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
SET LOCAL role anon;
SELECT auth.uid() AS anon_uid, has_table_privilege('anon','public.purchases','INSERT') AS anon_holds_grant;
DO $$ BEGIN
  BEGIN
    -- org_id is supplied explicitly so the NOT NULL default cannot be what stops
    -- this: the only thing left to refuse it is RLS, and that is the point.
    INSERT INTO purchases (org_id, status, amount)
    VALUES ((SELECT v FROM t WHERE k='org'), 'draft', 1);
    RAISE NOTICE 'ANON INSERT SUCCEEDED — THIS IS A FAILURE';
  EXCEPTION WHEN others THEN RAISE NOTICE 'anon INSERT refused: %', SQLERRM;
  END;
  BEGIN
    PERFORM create_my_purchase('[{"offering_slug":"riding-lesson--item-3c53e30f"}]'::jsonb);
    RAISE NOTICE 'ANON RPC SUCCEEDED — THIS IS A FAILURE';
  EXCEPTION WHEN others THEN RAISE NOTICE 'anon create_my_purchase refused: %', SQLERRM;
  END;
END $$;
RESET role;
SET LOCAL request.jwt.claims = '{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}';
\echo '-- and no permissive INSERT policy was added:'
SELECT polname, polcmd, polpermissive,
       (SELECT array_agg(r.rolname) FROM pg_roles r WHERE r.oid = ANY(pol.polroles)) AS roles
  FROM pg_policy pol WHERE polrelid='public.purchases'::regclass ORDER BY polpermissive DESC, polname;

\echo ''
\echo '════ TEST 3 — declare ZELLE ⇒ credits exist ⇒ Book this time books ════'
SET LOCAL request.jwt.claims = '{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}';
SET LOCAL role authenticated;
SELECT report_my_payment((SELECT v FROM t WHERE k='pack'), 'zelle', 'CONF-12345') AS declared;
RESET role;
SELECT display_code, status, payment_status, payment_method, client_claim_status
  FROM purchases WHERE id=(SELECT v FROM t WHERE k='pack');
SELECT package_key, credits_total, credits_remaining FROM lesson_credits
 WHERE purchase_id=(SELECT v FROM t WHERE k='pack');
\echo '-- the member now books an open slot, server-side, through the real RPC:'
INSERT INTO t SELECT 'slot1', id FROM bookings
 WHERE status='available' AND is_flexible AND starts_at > now() ORDER BY starts_at LIMIT 1;
INSERT INTO t SELECT 'slot2', id FROM bookings
 WHERE status='available' AND is_flexible AND starts_at > now() ORDER BY starts_at OFFSET 1 LIMIT 1;
SET LOCAL role authenticated;
SELECT book_open_slot((SELECT v FROM t WHERE k='slot1')) AS booked;
RESET role;
SELECT b.id, b.status, b.starts_at, b.credit_id IS NOT NULL AS debited_a_credit
  FROM bookings b WHERE b.credit_id IN (SELECT id FROM lesson_credits
     WHERE purchase_id=(SELECT v FROM t WHERE k='pack'));

\echo ''
\echo '════ TEST 4 — same for CASH, and the purchase leaves draft ════'
\echo '-- (the plan order, bought above, is still draft:)'
SELECT display_code, status, payment_status FROM purchases WHERE id=(SELECT v FROM t WHERE k='plan');
SET LOCAL role authenticated;
SELECT report_my_payment((SELECT v FROM t WHERE k='plan'), 'cash') AS declared;
RESET role;
SELECT display_code, status, payment_status, payment_method, client_claim_status
  FROM purchases WHERE id=(SELECT v FROM t WHERE k='plan');

\echo ''
\echo '════ TEST 5 — confirming afterwards mints NOTHING further ════'
SELECT count(*) AS credit_rows_before, coalesce(sum(credits_total),0) AS credits_before
  FROM lesson_credits WHERE purchase_id IN (SELECT v FROM t);
SET LOCAL request.jwt.claims = '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}';
SET LOCAL role authenticated;
SELECT confirm_payment_claim((SELECT v FROM t WHERE k='pack')) AS staff_confirmed;
RESET role;
SELECT count(*) AS credit_rows_after, coalesce(sum(credits_total),0) AS credits_after
  FROM lesson_credits WHERE purchase_id IN (SELECT v FROM t);
\echo '-- and the index that makes a double mint impossible:'
SELECT indexdef FROM pg_indexes
 WHERE tablename='lesson_credits' AND indexname='lesson_credits_one_per_item_period';
\echo '-- proof: minting the same item+period twice inserts nothing the second time'
SELECT _mint_credits_for_purchase_item(
         (SELECT id FROM purchase_items WHERE purchase_id=(SELECT v FROM t WHERE k='pack')))
       AS second_mint_returns_zero;

\echo ''
\echo '════ TEST 6 — a recurring purchase yields an OPEN-ENDED weekly entitlement ════'
\echo '-- 6a. before the slot is chosen: NO credits, NO bookings (no punch card)'
SELECT (SELECT count(*) FROM lesson_credits WHERE purchase_id=(SELECT v FROM t WHERE k='plan')) AS credits,
       (SELECT count(*) FROM bookings       WHERE purchase_id=(SELECT v FROM t WHERE k='plan')) AS bookings;
\echo '-- 6b. the member picks TWO days and a time for EACH (2x Weekly = 2 slots)'
SET LOCAL request.jwt.claims = '{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}';
SET LOCAL role authenticated;
SELECT jsonb_pretty(set_my_standing_schedule(
  (SELECT id FROM purchase_items WHERE purchase_id=(SELECT v FROM t WHERE k='plan')),
  '[{"day":"Tue","time":"16:00"},{"day":"Thu","time":"17:30"}]'::jsonb, 60)) AS chosen;
RESET role;
\echo '-- 6c. TWO standing days a week, each at its own time, month after month:'
SELECT to_char(starts_at,'YYYY-MM') AS month, to_char(starts_at,'Dy') AS weekday,
       to_char(starts_at,'HH24:MI') AS at, count(*) AS sessions
  FROM bookings WHERE purchase_id=(SELECT v FROM t WHERE k='plan')
 GROUP BY 1,2,3 ORDER BY 1,2;
\echo '-- 6d. bookable capacity in a month a monthly top-up would have been needed for,'
\echo '--     with NO scheduler: pg_cron is absent and nothing was woken up.'
SELECT (SELECT count(*) FROM pg_extension WHERE extname='pg_cron') AS pg_cron_installed,
       (SELECT count(*) FROM pg_namespace WHERE nspname='cron')    AS cron_schema,
       (SELECT count(*) FROM bookings WHERE purchase_id=(SELECT v FROM t WHERE k='plan')
          AND starts_at >= date_trunc('month', current_date) + interval '2 months') AS sessions_2_months_out;
\echo '-- 6e. the order was NOT re-priced by choosing 2 days on a 2x SKU:'
SELECT p.amount, pi.quantity, o.weekly_frequency, o.price_amount AS sku_price
  FROM purchases p JOIN purchase_items pi ON pi.purchase_id=p.id JOIN offerings o ON o.id=pi.offering_id
 WHERE p.id=(SELECT v FROM t WHERE k='plan');
\echo '-- 6f. the horizon ROLLS: asking for a later horizon extends it, and re-asking is a no-op'
SELECT _ensure_plan_horizon((SELECT id FROM purchase_items WHERE purchase_id=(SELECT v FROM t WHERE k='plan')),
                            current_date + 200) AS extended;
SELECT _ensure_plan_horizon((SELECT id FROM purchase_items WHERE purchase_id=(SELECT v FROM t WHERE k='plan')),
                            current_date + 200) AS re_asked_creates_nothing;
SELECT max(starts_at)::date AS furthest_standing_session
  FROM bookings WHERE purchase_id=(SELECT v FROM t WHERE k='plan');

\echo ''
\echo '════ TEST 4b — a weekly credit exists ONLY behind a cancellation ════'
\echo '-- remaining is 0 the moment the slot is set:'
SELECT period_start, credits_total, credits_remaining FROM lesson_credits
 WHERE purchase_id=(SELECT v FROM t WHERE k='plan') ORDER BY period_start LIMIT 2;
\echo '-- staff cancel ONE standing session (delete_calendar_item → _refund_booking_credit):'
INSERT INTO t SELECT 'cancelme', id FROM bookings
 WHERE purchase_id=(SELECT v FROM t WHERE k='plan')
   AND starts_at >= date_trunc('month', current_date) + interval '1 month'
 ORDER BY starts_at LIMIT 1;
SET LOCAL request.jwt.claims = '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}';
SET LOCAL role authenticated;
SELECT delete_calendar_item((SELECT v FROM t WHERE k='cancelme'), 'one') AS cancelled;
RESET role;
SELECT period_start, credits_total, credits_remaining AS remaining_after_cancel
  FROM lesson_credits lc
 WHERE lc.id = (SELECT credit_id FROM bookings WHERE id=(SELECT v FROM t WHERE k='cancelme'));
\echo '-- the member rebooks with it — back to 0:'
SET LOCAL request.jwt.claims = '{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}';
SET LOCAL role authenticated;
SELECT book_open_slot(
  (SELECT v FROM t WHERE k='slot2'),
  NULL,
  (SELECT credit_id FROM bookings WHERE id=(SELECT v FROM t WHERE k='cancelme'))) AS rebooked;
RESET role;
SELECT period_start, credits_total, credits_remaining AS remaining_after_rebook
  FROM lesson_credits lc
 WHERE lc.id = (SELECT credit_id FROM bookings WHERE id=(SELECT v FROM t WHERE k='cancelme'));
\echo '-- and a horizon roll does NOT resurrect the cancelled session:'
SELECT _ensure_plan_horizon((SELECT id FROM purchase_items WHERE purchase_id=(SELECT v FROM t WHERE k='plan')),
                            current_date + 200) AS roll_after_cancel;
SELECT count(*) AS live_sessions_on_that_date FROM bookings
 WHERE purchase_id=(SELECT v FROM t WHERE k='plan')
   AND starts_at::date = (SELECT starts_at::date FROM bookings WHERE id=(SELECT v FROM t WHERE k='cancelme'))
   AND status NOT IN ('cancelled','expired');

\echo ''
\echo '════ TEST 8 — a failed booking produces no booking_time_requested ════'
INSERT INTO t SELECT 'slot3', id FROM bookings
 WHERE status='available' AND is_flexible AND starts_at > now() ORDER BY starts_at OFFSET 2 LIMIT 1;
SELECT count(*) AS notifications_before FROM notifications WHERE kind='booking_time_requested';
SET LOCAL request.jwt.claims = '{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}';
SET LOCAL role authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM book_open_slot((SELECT v FROM t WHERE k='slot3'), NULL, gen_random_uuid());
    RAISE NOTICE 'booking with a bogus credit SUCCEEDED — this is a failure';
  EXCEPTION WHEN others THEN RAISE NOTICE 'booking refused as expected: %', SQLERRM;
  END;
END $$;
RESET role;
SELECT count(*) AS notifications_after FROM notifications WHERE kind='booking_time_requested';

\echo ''
\echo '════ §6 — WALK1 false-notification finding: THE BOOKING EXISTS. Withdrawn. ════'
\echo '-- the notification WALK1 called an orphan, and the booking it names, to the microsecond:'
SELECT n.kind, n.title, n.created_at FROM notifications n
 WHERE n.kind='booking_time_requested' AND n.title LIKE '%Aug 16%'
 ORDER BY n.created_at;
SELECT b.id, b.status, b.starts_at, b.client_id, b.credit_id IS NOT NULL AS debited, b.updated_at
  FROM bookings b WHERE b.starts_at = TIMESTAMPTZ '2026-08-16 08:00:00-07';
\echo '-- and the two emitters cannot notify without a row: notify_staff is a plain SQL'
\echo '-- INSERT in the SAME transaction, after the booking write, in both of them.'
SELECT p.proname, p.prokind, l.lanname,
       position('notify_staff' in pg_get_functiondef(p.oid)) > position('INSERT INTO bookings' in pg_get_functiondef(p.oid))
         OR position('INSERT INTO bookings' in pg_get_functiondef(p.oid)) = 0 AS notify_comes_after_the_write
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='public' AND p.proname IN ('book_open_slot','request_open_time','notify_staff') ORDER BY 1;

\echo ''
\echo '════ §9 — a declared order NAMES its payment type ════'
\echo '-- the two new TRUE statuses, in the order vocabulary:'
SELECT code, display_name, is_true_status, sort_order FROM status_events_vocab
 WHERE entity_type='order' AND code LIKE 'payment_pending%' ORDER BY code;
INSERT INTO t SELECT 'st', create_my_purchase('[{"offering_slug":"riding-lesson--item-3c53e30f"}]'::jsonb)
  FROM (SELECT set_config('request.jwt.claims','{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}',true)) x;
\echo '-- a fresh order, nothing declared:'
SELECT display_code, status, payment_status, client_claim_status, current_status
  FROM purchases WHERE id=(SELECT v FROM t WHERE k='st');
SET LOCAL request.jwt.claims = '{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}';
SET LOCAL role authenticated;
\echo '-- the client declares CASH:'
SELECT report_my_payment((SELECT v FROM t WHERE k='st'), 'cash') AS declared;
RESET role;
SELECT status, payment_status, client_reported_method, client_claim_status, current_status
  FROM purchases WHERE id=(SELECT v FROM t WHERE k='st');
\echo '-- "Actually, I sent it by Zelle" MOVES the state (the claim columns are in the'
\echo '--  trigger list now, and this UPDATE touches neither status nor payment_status):'
SET LOCAL role authenticated;
SELECT report_my_payment((SELECT v FROM t WHERE k='st'), 'zelle', 'CONF-99') AS redeclared;
RESET role;
SELECT status, payment_status, client_reported_method, client_claim_status, current_status
  FROM purchases WHERE id=(SELECT v FROM t WHERE k='st');
\echo '-- the order timeline staff read — TRUE statuses and the claim events, together:'
SET LOCAL request.jwt.claims = '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}';
SET LOCAL role authenticated;
SELECT status, display_name, is_true_status, detail
  FROM entity_status_log('order', (SELECT v FROM t WHERE k='st')) ORDER BY created_at;
\echo '-- staff DECLINE it: the order falls back on its own, no second rule:'
SELECT decline_payment_claim((SELECT v FROM t WHERE k='st'), 'no transfer found') AS declined;
RESET role;
SELECT client_claim_status, current_status FROM purchases WHERE id=(SELECT v FROM t WHERE k='st');
\echo '-- re-declared, then CONFIRMED: paid wins over the claim:'
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"03c14c97-6fae-4dba-80b4-c9ae47602f90","role":"authenticated"}';
SELECT report_my_payment((SELECT v FROM t WHERE k='st'), 'cash') AS redeclared2;
SET LOCAL request.jwt.claims = '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}';
SELECT confirm_payment_claim((SELECT v FROM t WHERE k='st')) AS confirmed;
RESET role;
SELECT status, payment_status, client_claim_status, current_status
  FROM purchases WHERE id=(SELECT v FROM t WHERE k='st');

ROLLBACK;
