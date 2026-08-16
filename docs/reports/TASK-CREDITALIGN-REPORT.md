# TASK CREDITALIGN — report

**Branch** `task/creditalign` · **commit** `4e80a29` (unpushed — the orchestrator merges)
**Prod** `lrstswfxfsezdmvkvukc` · migrations m1–m7 **APPLIED** · **nothing backfilled**

---

## The short version

All ten active recurring SKUs now mint the entitlement the catalog says they are worth,
for lessons **and** horse care. A month's allotment expires at month end and is refused
everywhere a credit is spent or counted. `generate_monthly_lessons` spends the allotment
rather than shadowing it. A booking — pending by its client, any live booking by staff —
can be re-charged to a different purchased item, atomically, through the one refund seam.

**One thing I found that the brief did not name, and it is the bigger half of the mint
problem:** `_provision_purchase_for_offerings` was not just the broken minter, it was the
**only** minter in the system. The shop checkout (`createDraftOrder`, `src/lib/api.ts:610`)
inserts `purchase_items` directly and minted nothing — no trigger on `purchase_items` or
`purchases` touched `lesson_credits`. So after CREDITFIX a member buying an 8-Lesson Punch
Card through the catalog still got **zero** credits. Fixing only the recurring gate would
have left that untouched, so minting moved onto the purchase itself.

---

## The decision the task asked me to make and state

### `lesson_credits` is the entitlement store. `fulfillment_units` is not. No third ledger.

The task asked whether the entitlement belongs in `fulfillment_units` (9 `session`,
4 `period`) instead. It does not, for three reasons in the order that decide it:

1. **`book_open_slot` is credit-gated and reads `lesson_credits` alone.** It is the one
   path a member books through and it is already segment-aware, which is exactly why the
   brief says to reuse it. Reusing it means minting where it looks.
2. **`_refund_booking_credit` is the one refund seam and it is a `lesson_credits`
   operation.** The swap must go through it (§A2), so both halves of a swap must live in
   the same store.
3. **A `period` unit means "one billing period of this service is being delivered"** (D6).
   There is exactly one per recurring line, on purpose. Turning it into "four bookable
   sessions" would change what a period unit means, break `my_fulfillment`'s totals, and
   hand the booking path a second thing to spend — which *is* the third ledger.

So: `lesson_credits` = what you may book. `fulfillment_units.period` = the billing period
it belongs to. They now agree on where the month ends — m2 changes
`generate_fulfillment_units`' recurring branch from `[today .. today+1 month)` to the
calendar month, so the two windows are the same window.

### The formula, and the partial first month

```
allotment = weekly_frequency × (occurrences of the anchor weekday in the window) × quantity
window    = [ max(purchase date, month start) .. month end ]
anchor    = purchase_items.config->>'recurring_day', else the weekday the window opens on
```

**Proration is the window, not a special case.** A plan bought on the 20th is minted over
[20th .. month end], so it gets only the weekday occurrences actually left — which is the
same "part of the month you are buying" that ONBOARD's payment flow prorates the price by.
The two agree because they are the same quantity counted the same way.

The **anchor fallback** exists because a plan is almost always bought *before* its day is
chosen (`set_recurring_day` is a later, separate action). Without it the first month would
mint nothing. When the day is later set, `set_recurring_day` **re-trues the current
month's allotment** to the chosen day — new total, remaining reduced by whatever was
already used, floored at zero. Sessions already taken are never clawed back.

### The double-spend question: `generate_monthly_lessons` CONSUMES

The two options were "it consumes the entitlement" or "it stops creating bookings". I chose
**consume**. It is not retired: it is how a barn puts a standing weekly slot on the
calendar, and the owner asked for credits to reflect what was bought, not for a working
staff feature to be deleted to fix a bookkeeping bug. Each session it writes debits one
allotment credit **from that plan's own line** (so a client with two plans can never have
one fund the other) and carries the `credit_id`. When the allotment runs out it stops and
reports `skipped_no_entitlement` rather than writing sessions nobody paid for. It is now
segment-aware too — horse-care plans generate `care` bookings; it was lesson-only.

### The month roll — and why there is a cron

A recurring purchase records **one** billing period, and this codebase has no biller
(`generate_fulfillment_units` says so in its own comment: *"later periods roll as they are
billed"*). So the first month is minted at purchase, and later months by
`mint_recurring_allotments()` — a daily, idempotent sweep — **only for a plan whose order
is `paid`** (D9's prepaid gate, enforced rather than assumed) **and whose `plan_ends_on`
has not passed**. A member's "what can I book?" is a SELECT and a SELECT cannot mint;
something has to run. Daily rather than monthly so a missed run self-heals instead of
costing a client their month.

**D13:** stopping a plan is a button in the staff calendar panel (`set_recurring_plan_end`
→ `purchase_items.plan_ends_on`), not a migration. Ending a plan never claws back the month
already bought — it only stops the roll.

---

## THE TEST THIS MUST PASS

### 1. Each of the ten recurring SKUs → correct visible entitlement

Run against **prod's live bodies** inside `BEGIN … ROLLBACK` after m1–m7 were applied. The
"expected" column is recomputed independently from the catalog, not read back from the
thing under test. Today is Sun 2026-08-16; three Sundays remain in August.

| segment | SKU | `weekly_frequency` | expected | actual | period_start | expires |
|---|---|---|---|---|---|---|
| horse | Exercise 1x Weekly | 1 | 3 | **3** | 2026-08-01 | 2026-09-01 |
| horse | Exercise 2x Weekly | 2 | 6 | **6** | 2026-08-01 | 2026-09-01 |
| horse | Training 1x Weekly | 1 | 3 | **3** | 2026-08-01 | 2026-09-01 |
| horse | Training 2x Weekly | 2 | 6 | **6** | 2026-08-01 | 2026-09-01 |
| horse | Turnout 1x Weekly | 1 | 3 | **3** | 2026-08-01 | 2026-09-01 |
| horse | Turnout 2x Weekly | 2 | 6 | **6** | 2026-08-01 | 2026-09-01 |
| rider | 1x Weekly Lesson | 1 | 3 | **3** | 2026-08-01 | 2026-09-01 |
| rider | 1x Weekly Lesson (With your horse) | 1 | 3 | **3** | 2026-08-01 | 2026-09-01 |
| rider | 2x Weekly Lessons | 2 | 6 | **6** | 2026-08-01 | 2026-09-01 |
| rider | 2x Weekly Lessons (With your horse) | 2 | 6 | **6** | 2026-08-01 | 2026-09-01 |

**Before:** every one of those was `0`.

The session packs are unchanged — CREDITFIX's table re-proven in the same run (all 23
scheduled + recurring active SKUs, `23 passing / 0 failing`):
`8-Lesson Punch Card → 8`, `4-Class Pack → 4`, `4-Lesson Punch Card → 4`,
`Single Lesson / Single Class / Single Lesson (With your horse) / Evaluation Lesson → 1`,
and all six **horse-segment scheduled** SKUs → `0` (FLOWTRACE F2's ruling, kept). Quantity
multiplies both shapes (8-pack × 3 → 24, asserted).

### 2. A month expires and does not carry over

- Every allotment carries `period_start` = the first of the month and `expires_at` =
  midnight starting the next month. Asserted; visible in the table above.
- **Last month's allotment is unusable this month.** A 4-credit August-minus-one allotment
  was inserted and named explicitly to `book_open_slot`; it raised `NO_CREDITS` and the row
  came back **untouched at 4**. It is also excluded from the member's balance, the staff
  roster and the item picker — live prod query: `spendable_now = 45`,
  `held_including_expired = 49`, the difference being exactly the expired allotment.
- The picker now orders by `expires_at ASC NULLS LAST` first, so an expiring monthly
  allotment is spent **before** a never-expiring pack. Without that, a client holding both
  would silently lose the month.

### 3. `generate_monthly_lessons` and the entitlement do not double-spend

Model stated above. Proven: `credits_remaining` fell by **exactly** `res.created`, every
booking it wrote names the credit it spent (`credit_id is null` count = 0 across the
series), and a **second run spends nothing** and writes nothing.

### 4. A pending booking's item can be swapped — client, atomic, through the one seam

Client claims a slot against a 4-credit pack (→ 3 remaining), then swaps to a 2-credit
pack. After: source **back to 4**, target **down to 1**, `bookings.credit_id` = the target.
**No `change_credit` row was created** — asserted — because `_refund_booking_credit` now
restores the source row in place. The debit happens **first**, so a target with nothing left
leaves the booking exactly as it was.

### 5. A confirmed booking can be swapped by staff, same guarantees

Same booking flipped to `scheduled`. The **client is refused** (`NOT_PENDING`, with the
sentence *"we have already confirmed this booking — ask us and we will move it for you"*).
Staff succeed: source down to 3, target back to 2, and the log row records
`booking_status_at = 'scheduled'` — a pending swap and a confirmed swap are not made to
look alike.

**Recorded** (`booking_item_swaps`): who (`swapped_by` = the acting uid), by what authority
(`swapped_by_role` = client|staff), the booking's status at the time, from/to credit,
offering, purchase and label, and when. Deliberately **not** foreign-keyed to
`lesson_credits` — a credit row can be soft-deleted and this record has to outlive it.
RLS: org boundary (restrictive) + staff-all + the booking's own client reads their own.

### 6. A swap with no entitlement is refused, with a reason

- empty target → `NO_ENTITLEMENT: "Single Lesson" has nothing left to book with`
- expired allotment → `ITEM_EXPIRED: that allotment ran out on … and does not carry over`
- horse-care credit on a lesson booking → `WRONG_SERVICE: … cannot pay for a lesson`
- not the client's credit → `NO_SUCH_ITEM` · already on it → `ALREADY_ON_THAT_ITEM`
- dead booking → `BOOKING_CLOSED: this booking is cancelled — there is nothing left to charge`

After a refusal **nothing moved**: source balance unchanged, booking still charged where it
was — asserted. `booking_item_options` offers only what is legal (nothing empty, nothing
expired, no horse-care option for a lesson booking) and returns the *reason* when the
caller may not swap at all, so the UI never has to guess.

### 7. Nothing keys on a display name anywhere in the mint path

Live prod check on `pg_proc.prosrc`:

| function | reads `unit_count` | reads `weekly_frequency` | regex match operator | keys on `name` |
|---|---|---|---|---|
| `_mint_credits_for_purchase_item` | ✅ | ✅ | ❌ | ❌ |
| `_recurring_allotment` | — | ✅ | ❌ | ❌ |

The inputs are `config_kind`, `segment`, `unit_count`, `weekly_frequency`,
`purchase_items.quantity` and `config->>'recurring_day'`. The test asserts the absence of
`~`, `substring(`, `ilike` and `o.name =/~/like` in the mint body, so **a fourth revert
fails loudly in the suite rather than in a client's empty calendar.**

### 8. Prod delta — reported, nothing backfilled

Every purchase line with a `config_kind`, entitlement **held** vs entitlement **correct for
its own month**:

| order | state | who | line | segment | kind | held | correct |
|---|---|---|---|---|---|---|---|
| PUR-000050 | awaiting_payment/unpaid | CJ Z | 1x Weekly Lesson (With your horse) | rider | recurring | 0 | **1** |
| PUR-000059 | awaiting_payment/unpaid | Claire Bourdon | Exercise 1x Weekly | horse | recurring | 0 | **4** |
| PUR-000059 | awaiting_payment/unpaid | Claire Bourdon | Training 1x Weekly | horse | recurring | 0 | **4** |
| PUR-000059 | awaiting_payment/unpaid | Claire Bourdon | Single Class | rider | scheduled | 0 | **1** |
| PUR-000059 | awaiting_payment/unpaid | Claire Bourdon | Single Lesson | rider | scheduled | 0 | **1** |
| PUR-000059 | awaiting_payment/unpaid | Claire Bourdon | Full Body Clip | horse | scheduled | 0 | 0 ✅ |
| PUR-000106 | awaiting_payment/unpaid | Gabriella Olenik | 1x Weekly Lesson | rider | recurring | 0 | **3** |

Six of seven lines are under-entitled. Two nuances the table alone would mislead on:

- **Claire's two `scheduled` lines are not really at zero.** She holds three
  pre-CREDITFIX credit rows (`Single Lesson`, `Single Class`, `Full Body Clip`) with
  `offering_id` and `purchase_id` both **NULL**, so they cannot be attributed to a line.
  Two are already spent (`remaining 0`). The `held` column counts tagged credits, which is
  the honest reading of "which purchase is this entitlement from".
- **`Full Body Clip` (1 remaining) is CREDITFIX's one known-wrong row** — a horse-segment
  scheduled SKU that minted a bookable *lesson* credit under the old regex. It is still
  there. **Owner ruling required**, same as CREDITFIX left it.
- Every one of these orders is `awaiting_payment/unpaid`, so under the prepaid model none
  of them should be bookable today anyway.

**Backfill state, verified after applying:** `3` credit rows, `0` with the new item tag,
`0` with a period, `0` with an expiry; `0` purchase lines with `plan_ends_on`. **Nothing
was written.** The owner rules on the backfill separately.

### 9. PGlite suite

**30 new tests, all green** — `test/db/creditalign_recurring_entitlement_and_swap.test.ts`.
It proves the bug on the shipped bodies first (recurring mints nothing both segments; no
`lesson_credits`-touching trigger exists on `purchase_items`/`purchases`;
`generate_monthly_lessons` contains no `lesson_credits`; `swap_booking_item` does not
exist), then applies m1–m7 **twice** to prove idempotent replay, then runs the nine cases.

**Full `test/db` suite, branch vs `main` (a6dd516), same machine, same run:**

| | files failed | tests failed | tests passed |
|---|---|---|---|
| main | 46 / 69 | 203 | 397 |
| this branch | 46 / 70 | 203 | 427 |

**The failing FILE SET is byte-identical** (diffed programmatically: `NEW failures: []`,
`FIXED: []`). The +30 passes are this task's file. **Those 46 red files are pre-existing on
main and this task neither adds to them nor fixes them** — they are the replayability
caveat CLAUDE.md records, plus drift; worth a task of their own.

`test/ui`: 2 failed files / 3 failed tests on **both** main and this branch — unchanged.
`npm run typecheck`, `typecheck:api`, `npm run build`: clean. `npm run lint`: **0 errors**
(39 warnings) — I fixed the one pre-existing lint *error*, an unused variable in
CREDITFIX's own test file, since it was the only thing between the repo and a clean lint.

---

## Defects found and FIXED along the way

1. **`complete_lesson_session` double-debited.** `book_open_slot` debits a credit and sets
   `bookings.credit_id`; `complete_lesson_session` then debited "the oldest row with a
   balance" **again** and overwrote `credit_id` — a second charge for one lesson, and
   potentially against a different purchase. It now honours a booking that already names
   its credit and only picks one when there is none. Directly on-topic: this is credits not
   matching what was bought.
2. **`_refund_booking_credit` could mint from nothing.** The shipped body always inserted a
   fresh 1-credit row, uncapped — two refunds for one booking left the client a credit up,
   and with monthly allotments it laundered an expiring credit into a never-expiring one.
   It now restores the source row in place (capped at its own `credits_total`), and only
   compensates — inheriting offering, purchase, period **and expiry** — when the source row
   has been soft-deleted.
3. **`_debit_or_create_for_booking` never debited a recurring plan** ("the purchase IS the
   assignment, never a credit debit"). It does now, and only falls back to naming the plan's
   purchase when the allotment is genuinely exhausted — it will **not** create a second
   recurring purchase, which would bill the month twice.
4. **`_monthly_plan_for_client` disagreed with reality in three ways** and was a second
   opinion about a quantity the ledger now holds: `entitled` was NULL until a recurring day
   was chosen (a paying client saw "—"); `used` counted only `scheduled`/`completed`, and
   since REVIEWQ a claimed slot lands `pending`, so a member who had just booked their whole
   month still showed the whole month remaining; and it was `LIMIT 1` + `kind='lesson'`, so a
   client with a horse-care plan saw one plan at most and never a care one. It now reads the
   allotment rows directly and returns **all** current-month plans, both segments.
5. **An anon `EXECUTE` grant m2 left open.** Caught by `has_function_privilege('anon', …)`,
   not by reading REVOKE lines — five of six new functions were correctly false and
   `_recurring_allotment` was **true**, because Supabase's default privileges grant EXECUTE
   on every new function in `public`. Closed by m7. Post-fix: anon `false` on all six.

## Flagged, NOT fixed — owner rulings

- **F1 · Horse-segment SCHEDULED SKUs still mint nothing.** CREDITFIX ruled that a
  `Full Body Clip` must not mint a lesson credit, and this task re-proves it. But
  `book_open_slot`'s care branch is credit-gated, so **a one-off grooming/clipping/exercise
  service still has nothing to spend** — only *recurring* horse care is now bookable. Fixing
  it means either a segment-scoped credit or a non-credit path for one-off care, and that is
  a ruling, not a tidy-up.
- **F2 · Claire Bourdon's `Full Body Clip` credit (1 remaining, untagged)** is CREDITFIX's
  known-wrong row. Still live. Delete, or leave as a goodwill credit?
- **F3 · Backfill.** Six prod lines are under-entitled (table above). All six sit on unpaid
  orders. Backfill, or let payment mint them going forward?
- **F4 · The roll's paid-gate.** `mint_recurring_allotments` rolls only `payment_status =
  'paid'` plans. Every recurring purchase in prod today is `unpaid`, so **nothing rolls
  until someone pays**. That is the prepaid model working as ruled — flagging it so it is
  not mistaken for the job being broken.
- **F5 · 46 red files in `test/db` on main.** Not caused here, not fixed here. Worth a task.

---

## Render claims — **NOT VERIFIED**

No browser was opened. Every UI change below typechecks, lints and builds, and its server
side is proven, but **nobody has looked at it**. Owner checklist:

1. **`/app/lessons`** — a client on a monthly plan sees a card per plan (a client with a
   lesson plan *and* a horse-care plan sees two), each showing `remaining / entitled left`,
   the recurring day (or "not set yet"), and *"This month's sessions don't roll over —
   they're yours until Aug 31."*
2. **`/app/calendar`, claiming an open slot** — the "What are you booking?" picker must
   **not** list a last-month allotment, and must show the expiry on a monthly one.
3. **`/app/calendar`, a PENDING booking of your own** — a *"Booked against …"* block with
   **Change what this is booked against**; picking another item and pressing **Move it**
   moves the charge and the credits update.
4. **The same block on a CONFIRMED booking, as a member** — no button, and the sentence
   *"We have already confirmed this booking — ask us and we will move it for you."*
5. **The same block as STAFF on that confirmed booking** — the button IS there and works.
6. **Swap to an item with nothing left** — the refusal renders as a readable sentence, not
   `NO_ENTITLEMENT: …`. (`BookingItemSwap` strips the machine prefix; check it actually does
   on a live error.)
7. **Staff calendar panel, a recurring offering + client** — "Monthly plan" shows
   `N of M left this month — the allotment expires Aug 31 and does not carry over`,
   **Set day**, **Generate this month's sessions**, and **Stop this plan after this month**
   (which then reads **Resume this plan**).
8. **Generate this month's sessions when the allotment is short** — the result line must say
   *"… N skipped — this month's allotment is used up."*
9. **`/api/mint-monthly-allotments`** — new daily Vercel cron at `20 8 * * *`. Confirm it is
   registered after deploy; a manual run needs `Authorization: Bearer $CRON_SECRET`.

---

## Files

**Migrations (all applied to prod)**
`20260816T2100_creditalign_m1_entitlement_has_an_item_a_period_and_an_expiry.sql`
`20260816T2200_creditalign_m2_one_mint_seam_reads_the_catalog.sql`
`20260816T2300_creditalign_m3_a_month_does_not_carry_over.sql`
`20260816T2400_creditalign_m4_one_allotment_spent_once_and_a_month_that_rolls.sql`
`20260816T2500_creditalign_m5_the_booked_and_pending_item_swap.sql`
`20260816T2600_creditalign_m6_the_plan_view_reads_the_ledger.sql`
`20260816T2700_creditalign_m7_close_the_anon_grant_m2_left.sql`

**Code** `src/components/app/BookingItemSwap.tsx` (new) ·
`src/lib/ops/api-calendar.ts` · `src/lib/ops/api-member.ts` ·
`src/components/app/MyLessonsContent.tsx` · `src/pages/app/CalendarPage.tsx` ·
`src/pages/app/CalendarItemPanel.tsx` · `api/mint-monthly-allotments.ts` (new) · `vercel.json`

**Tests** `test/db/creditalign_recurring_entitlement_and_swap.test.ts` (new, 30) ·
`test/db/creditfix_mint_from_unit_count.test.ts` (lint-only fix)

## Traps observed

- **`pg_proc` checked before re-declaring anything.** `book_open_slot` had exactly one
  overload before and has exactly one after — asserted in the suite as well as verified
  live, because a stray second signature lets PostgREST resolve by argument name and spend
  the wrong item.
- **No migration contains `BEGIN`/`COMMIT`** (grepped). All seven were dry-run inside
  `BEGIN … ROLLBACK` against prod, and the rollback was **proved by re-querying**: after the
  live end-to-end, `lesson_credits` was still 3 rows and 0 proof contacts remained.
- **`REVOKE … FROM PUBLIC` proved insufficient** — see fixed defect 5. Every grant claim in
  this report is a `has_function_privilege()` result.
- **`npm install` in this worktree.** No `node_modules` symlink across `/Users/Cactai` vs
  `/Users/cactai`.
- **Every vitest run was `vitest run`** with `--maxWorkers=2`; no watch mode, no orphaned
  processes left behind.
