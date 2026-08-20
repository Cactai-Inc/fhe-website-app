-- TASK-CLOSEOUT §2.1 — proof: bookings generated == entitlement counted, on one
-- multi-day plan. Both numbers shown. EVERYTHING inside BEGIN … ROLLBACK.
--
-- Verify-before-fixing outcome: the finding ("generate_monthly_lessons has ZERO
-- references to recurring_days") was TRUE when written but was closed by the
-- CAREPLANS m3 merge — the generator now delegates to _generate_plan_month,
-- which reads config->'recurring_days' (singular fallback kept) and spends one
-- allotment credit per generated session from the plan's own line. This walk is
-- the required agreement proof, not a fix.
\set ON_ERROR_STOP off
\set ON_ERROR_ROLLBACK on
\pset pager off
\timing off

\echo '--- the generator TODAY reads the plural days (live body):'
SELECT position('recurring_days' in pg_get_functiondef(oid)) > 0 AS reads_recurring_days
  FROM pg_proc WHERE proname='_generate_plan_month';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.be(p uuid) RETURNS text LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    CASE WHEN p IS NULL THEN ''
         ELSE json_build_object('sub', p::text, 'role', 'authenticated')::text END, true) $$;

SELECT pg_temp.be('b45a5503-89bc-489a-b012-c7fbf5c09632');

-- a synthetic client with a 2x-weekly recurring plan, deliberately given THREE days
INSERT INTO contacts (org_id, first_name, last_name, email, contact_type)
VALUES ('e656f20b-ef43-4725-9029-19e7f0190d9c', 'Plan', 'Prover', 'co21-plan@example.invalid', 'CONTACT');
INSERT INTO clients (org_id, contact_id)
SELECT 'e656f20b-ef43-4725-9029-19e7f0190d9c', id FROM contacts WHERE email='co21-plan@example.invalid';

-- status 'awaiting_payment' (the live orders' own status): a DRAFT order is not
-- a purchase and deliberately mints nothing — the first run of this walk proved
-- that gate (0 credits, 0 bookings, skipped_no_entitlement=5). The real
-- checkout moves the order out of draft; so does this.
INSERT INTO purchases (org_id, buyer_contact_id, status, payment_status)
SELECT 'e656f20b-ef43-4725-9029-19e7f0190d9c', id, 'awaiting_payment', 'unpaid'
  FROM contacts WHERE email='co21-plan@example.invalid';
INSERT INTO purchase_items (purchase_id, offering_id, label, quantity)
SELECT pu.id, 'c3e43b63-31af-4f68-a1b2-d9e651cb4822', '2x Weekly Lessons', 1
  FROM purchases pu JOIN contacts c ON c.id = pu.buyer_contact_id
 WHERE c.email='co21-plan@example.invalid';

CREATE TEMP TABLE ids ON COMMIT DROP AS
SELECT cl.id AS client_id, pi.id AS item_id, pu.id AS purchase_id
  FROM contacts c
  JOIN clients cl ON cl.contact_id = c.id
  JOIN purchases pu ON pu.buyer_contact_id = c.id
  JOIN purchase_items pi ON pi.purchase_id = pu.id
 WHERE c.email='co21-plan@example.invalid';

\echo ''
\echo '=== STEP 1 — choose THREE days on a 2x SKU (surfaced, never blocked):'
SELECT set_recurring_days((SELECT item_id FROM ids), ARRAY['Tue','Thu','Sat'],
                          NULL, true) AS set_days_result;

\echo ''
\echo '=== STEP 2 — THE ENTITLEMENT: what the credits line says this month holds:'
SELECT credits_total, credits_remaining, period_start
  FROM lesson_credits WHERE purchase_item_id = (SELECT item_id FROM ids) AND deleted_at IS NULL;
\echo '--- and the independent day-count over the same window (today → month end):'
SELECT _recurring_allotment_days(ARRAY['Tue','Thu','Sat'], current_date,
         (date_trunc('month', current_date) + interval '1 month - 1 day')::date)
       AS independent_day_count;

\echo ''
\echo '=== STEP 3 — GENERATE the month:'
SELECT generate_monthly_lessons((SELECT client_id FROM ids), (SELECT item_id FROM ids),
                                '10:00', 60) AS generate_result;

\echo ''
\echo '=== STEP 4 — THE AGREEMENT, both numbers side by side:'
SELECT (SELECT credits_total FROM lesson_credits
         WHERE purchase_item_id = (SELECT item_id FROM ids) AND deleted_at IS NULL)
         AS entitlement_counted,
       (SELECT count(*) FROM bookings
         WHERE purchase_id = (SELECT purchase_id FROM ids)
           AND status NOT IN ('cancelled','expired'))
         AS bookings_generated,
       (SELECT credits_remaining FROM lesson_credits
         WHERE purchase_item_id = (SELECT item_id FROM ids) AND deleted_at IS NULL)
         AS credits_left_after;
\echo '--- the generated sessions land ONLY on the chosen days:'
SELECT to_char(starts_at, 'Dy') AS day, count(*)
  FROM bookings WHERE purchase_id = (SELECT purchase_id FROM ids)
 GROUP BY 1 ORDER BY 1;
\echo '--- every booking carries the credit it spent (one line funds it):'
SELECT count(*) AS bookings, count(credit_id) AS with_credit
  FROM bookings WHERE purchase_id = (SELECT purchase_id FROM ids);

ROLLBACK;

SELECT count(*) AS leftover_probe_rows FROM contacts WHERE email='co21-plan@example.invalid';
