-- TASK CREDITALIGN m1 — the entitlement ledger learns which purchased line it came
-- from, which month it covers, and when it stops being spendable.
--
-- Owner: "when i purchased something that had a multi unit quantity, weekly or monthly
-- allotment, the system didnt recognize that properly for lessons or horse care."
--
-- WHICH STORE — the decision this task was asked to make and state.
-- `lesson_credits` IS the entitlement store. `fulfillment_units` is NOT, and no third
-- ledger is created. The reasons, in the order they decide it:
--   1. `book_open_slot` — the one path a member books through, already segment-aware
--      for lessons AND horse care — is credit-gated and reads `lesson_credits` alone.
--      The task says reuse it; reusing it means minting where it looks.
--   2. `_refund_booking_credit` is the single refund seam (REVIEWQ) and it, too, is a
--      `lesson_credits` operation. A swap must go through it, so the swap's two halves
--      must live in the same store.
--   3. `fulfillment_units` of kind `period` mean "one billing period of this service is
--      being delivered" (D6). There is exactly one per recurring line, on purpose.
--      Turning it into "four bookable sessions" would change what a period unit means,
--      break `my_fulfillment`'s totals, and give the booking path a second thing to
--      spend — which is the third ledger this task forbids.
-- So: `lesson_credits` = what you may book. `fulfillment_units.period` = the billing
-- period it belongs to. They now agree on the month boundary (see m2's rewrite of
-- generate_fulfillment_units).
--
-- WHAT A MONTH MEANS (owner, established in BOOKLINK §B4): a month's allotment expires
-- at month end and does not carry over. `expires_at` is that boundary, enforced at every
-- site that spends or counts a credit (m3). NULL means "never expires" — every credit
-- that exists today, and every session pack minted from here on, so nothing about packs
-- changes.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE THREE COLUMNS
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE lesson_credits
  ADD COLUMN IF NOT EXISTS purchase_item_id uuid REFERENCES purchase_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_start     date,
  ADD COLUMN IF NOT EXISTS expires_at       timestamptz;

COMMENT ON COLUMN lesson_credits.purchase_item_id IS
  'CREDITALIGN: the purchased LINE this entitlement was minted from. purchase_id alone '
  'is ambiguous — one order can carry two recurring lines (prod PUR-000059 holds '
  'Training 1x Weekly and Exercise 1x Weekly). Together with period_start it is the '
  'idempotency key that makes minting safe to run twice. NULL on every pre-CREDITALIGN '
  'row and on compensating refund rows, which is what keeps those out of the unique index.';

COMMENT ON COLUMN lesson_credits.period_start IS
  'CREDITALIGN: for a recurring (weekly/monthly) allotment, the FIRST DAY OF THE BILLING '
  'MONTH this allotment covers — always a month start, never the purchase date, because '
  'it doubles as the idempotency key and a mid-month purchase and the month roll must '
  'resolve to the same period. Proration lives in credits_total, not here. NULL for '
  'session packs, which have no period.';

COMMENT ON COLUMN lesson_credits.expires_at IS
  'CREDITALIGN: the instant this entitlement stops being spendable — for a monthly '
  'allotment, midnight starting the next calendar month (owner: a month does not carry '
  'over). NULL = never expires, which is every session pack and every row that predates '
  'this task. Enforced at book_open_slot, _debit_or_create_for_booking, '
  'complete_lesson_session, credits_roster, swap_booking_item and the member''s own '
  'item picker — see m3.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. IDEMPOTENT MINTING
-- ════════════════════════════════════════════════════════════════════════════
-- One allotment per purchased line per billing month, and one credit row per session
-- pack line. This index — not a caller's care — is what stops a double mint when the
-- monthly roll runs the same day a plan was bought, or when the provisioning spine's
-- belt-and-braces sweep follows its own trigger. coalesce() rather than NULLS NOT
-- DISTINCT so the index means the same thing on any server the repo is replayed on.
CREATE UNIQUE INDEX IF NOT EXISTS lesson_credits_one_per_item_period
  ON lesson_credits (purchase_item_id, (coalesce(period_start, DATE '0001-01-01')))
  WHERE purchase_item_id IS NOT NULL AND deleted_at IS NULL;

-- The member's "what can I book this month?" read, and the monthly roll's own sweep.
CREATE INDEX IF NOT EXISTS lesson_credits_live_period_idx
  ON lesson_credits (client_id, period_start)
  WHERE deleted_at IS NULL AND period_start IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. A PLAN CAN BE STOPPED WITHOUT A DEVELOPER (D13)
-- ════════════════════════════════════════════════════════════════════════════
-- A recurring purchase has no end date and this codebase has no biller, so without
-- this column the monthly roll (m4) would mint for a cancelled plan forever. It is set
-- from the staff calendar panel via set_recurring_plan_end() — never a migration.
ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS plan_ends_on date;

COMMENT ON COLUMN purchase_items.plan_ends_on IS
  'CREDITALIGN: the last day a recurring plan line is entitled. NULL = still running. '
  'The monthly roll (mint_recurring_allotments) skips a line whose plan_ends_on falls '
  'before the month it is about to mint. Set from the calendar panel via '
  'set_recurring_plan_end(); stopping a plan is never a migration (D13). Meaningless '
  'on non-recurring lines and ignored there.';
