-- The reschedule fee bands, transcribed from the SIGNED Company Policies
-- document (COMPANY_POLICIES §6 "RESCHEDULING NOTICE AND FEES"), which clients
-- have executed. These are not new business terms -- the schedule shipped empty
-- because no thread would invent numbers, and the source turned out to be the
-- policy itself.
--
-- §6 verbatim: 48h or more = no fee; under 48h but more than 24h = $10; under
-- 24h but more than 8h = $20; under 8h but before the start time = $30;
-- no-call/no-show = $75.
--
-- Bands overlap and the TIGHTEST match wins, so a request 3 hours out lands on
-- the 8-hour band ($30), not the 24-hour one.
--
-- NO-SHOW ($75) IS NOT IN THIS TABLE. `booking_change_fees_hours_before_check`
-- requires hours_before > 0, and a no-show is not a reschedule request at all --
-- it is the absence of one. It joins the staff-applied fees below.
--
-- DELIBERATELY NOT LOADED -- the no-show fee ($75, §6) and §7's two late-start fees ($30 contacted before the
-- start time and no later slot was available; $40 contacted after the start
-- time and COMPANY could not accommodate). Owner ruling 2026-08-16: "for things
-- where they contact us, its not an in app request so its something the staff
-- handle on our side." Both are conditional on a staff judgement (whether the
-- schedule could accommodate a later slot), and the $40 case is keyed on
-- NEGATIVE time-remaining, which this hours_before model cannot express. Staff
-- apply those manually; the automated bands cover in-app requests only.
INSERT INTO booking_change_fees (org_id, hours_before, fee_amount, label, active)
SELECT o.id, v.hours_before, v.fee_amount, v.label, true
FROM organizations o
CROSS JOIN (VALUES
  (48, 10.00, 'Changed less than 48 hours before your lesson'),
  (24, 20.00, 'Changed less than 24 hours before your lesson'),
  (8,  30.00, 'Changed less than 8 hours before your lesson')
) AS v(hours_before, fee_amount, label)
WHERE o.slug IS NOT NULL
ON CONFLICT (org_id, hours_before) DO UPDATE
  SET fee_amount = EXCLUDED.fee_amount,
      label      = EXCLUDED.label,
      active     = true,
      updated_at = now();
