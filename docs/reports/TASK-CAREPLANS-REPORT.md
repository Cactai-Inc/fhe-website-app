# TASK CAREPLANS — report

**Branch** `task/careplans` · **commits** `6c4ad0f` · `a435d18` · `b6ad6c2` (**unpushed** — the orchestrator merges)
**Prod** `lrstswfxfsezdmvkvukc` · migrations **m1–m5 APPLIED** · **nothing backfilled, no price changed**

---

## The short version

A care service now offers exactly two shapes: **à la carte** or **weekly**. The three `2x` care SKUs
are retired, never deleted. Weekly is one option, and **the days staff choose at provisioning are
what decide the entitlement** — Saturday + Sunday in a month with 5 Sundays and 4 Saturdays is
**9 sessions**, proven through the real mint seam, not just the arithmetic.

**The month opens with bookings and zero spendable credits**, exactly as the owner ruled. A credit
exists only after a cancellation, expires at that month's end, and is spendable on any date. **The
month's total can never grow** — proven by running a cancel-and-rebook loop five times over and
watching the invariant hold, then being refused at one past the total.

**Not one price changed.** No catalog column was dropped. Lessons are untouched, and every plan that
existed before this task computes exactly what it computed before — asserted against an
independently recomputed expectation, on both sides of the change.

**One defect found and fixed, and it is the reason §5c could not have passed without it:**
`decide_booking_change` minted a **fresh, untagged, never-expiring credit** on every approved
cancellation. It outlived the month, it was spendable on any other service, and it was minted even
when the booking had never debited anything.

---

## What the owner should know before anything else

### 1. Retiring the 2× SKUs moves what a two-day-a-week client pays, by design

The owner's rate model (§P5) is *"we typically dont discount if they buy 2x or 3x per week vs 1x."*
The catalog did discount, slightly:

| | 1× monthly | 2× monthly | 2 × the 1× rate |
|---|---|---|---|
| Exercise | 200 | **390** | 400 |
| Turnout | 100 | **200** | 200 |
| Training | 360 | **680** | 720 |

**No price was changed.** But a client who now buys "Exercise Weekly" and is given two days is billed
`quantity 2 × 200 = 400`, where the retired `Exercise 2x Weekly` would have been 390. Training moves
by more: 720 against 680. **That is the no-volume-discount model applied consistently** — it is what
the owner described — **but it is a real change to what a two-day client pays, and it is his call.**
Nobody is affected today: **zero purchase lines exist against any 2× SKU** (re-verified 2026-08-17,
as §P2b required).

### 2. There is still ONE allotment row per month, and that is deliberate

§5c2 asks for "N bookings and ZERO credit rows". What is built is **N bookings and ZERO SPENDABLE
credits**, held on one row with `credits_total = N, credits_remaining = 0`.

**The row is the cap, and the cap is what makes "the month can never grow" true.**
`_refund_booking_credit` restores a cancelled booking's credit **into that row, capped at its own
total**. With no row at all it takes its other branch and compensates with a **fresh, uncapped**
credit — which is precisely how a repeated reschedule loop manufactures a tenth lesson. Deleting the
row to satisfy the wording would have removed the guarantee the same section asks for. **Stated here
rather than quietly resolved.**

---

## THE TEST THIS MUST PASS

Every DB claim below is query output. Render claims are in §"NOT VERIFIED".

### 1. Acquisition is price-on-inquiry — verified, not redone

`CAREPATH` §C1d cleared these. Still true:

```
priced_acquisition (price_amount OR price_min not null) = 0
```

All eleven `HORSE_EVALUATION` / `HORSE_FINDER` / `HORSE_PURCHASE_ASSISTANCE` rows carry NULL, not
zero. The three active ones carry `price_model = {"kind":"inquire"}`. **Whether the page prints the
words is a render claim — §NOT VERIFIED item 1.**

### 2. Each care service offers exactly à la carte and weekly

| service | à la carte | weekly | retired |
|---|---|---|---|
| Exercise | Exercise Session $55/session | **Exercise Weekly** $200/month | Exercise 2x Weekly (inactive) |
| Turnout | Turnout Session $25/session | **Turnout Weekly** $100/month | Turnout 2x Weekly (inactive) |
| Training | Training Session $95/session | **Training Weekly** $360/month | Training 2x Weekly (inactive) |
| Clipping | three clips, $85 / $110 / $200 | — none, and none is wanted | — |

No `1x`/`2x` is customer-selectable in horse care. `public_offerings()` returns **0 rows** for a
retired SKU. The card hint no longer prints a frequency for a care plan; it reads
*"Weekly · we agree the days with you"* — scoped to `segment = 'horse'`, so **lesson cards keep their
own voice untouched**.

### 3. A retired SKU still resolves for an order that references one

Run live inside `BEGIN … ROLLBACK`, against `Exercise 2x Weekly` (now inactive):

```
line reads "Exercise 2x Weekly" at 390.00/month | offering active=f | allotment minted 6
and the public catalog no longer offers it: rows in public_offerings = 0
```

The line reads correctly, prices correctly, **and still mints its full 6-session allotment**.
Retired means unreachable, not broken.

### 4. Staff can select one, two or more days, plus N weeks or indefinite

`set_recurring_days(item, days[], weeks, indefinite)`. Proven live:

```
2. staff chose Sat+Sun, indefinite
   {"recurring_days":["Sat","Sun"], "plan_ends_on":null, "indefinite":true,
    "catalog_default":1, "differs_from_catalog":true, "entitled_this_month":4}
10. same plan switched to a FIXED 2 weeks   → plan_ends_on = 2026-08-30
```

Input is normalised: `[' sun ','SAT','Sun','tue'] → {Tue,Sat,Sun}` — trimmed, cased, de-duplicated,
week-ordered. An invalid day and an empty list are both refused.

### 5. The allowance is derived from the chosen days — the owner's worked example

**November 2026 holds 5 Sundays and 4 Saturdays** (counted, not assumed). Saturday + Sunday:

```
_recurring_allotment_days(['Sat','Sun'], 2026-11-01, 2026-11-30)   = 9
_mint_credits_for_purchase_item(item, client, '2026-11-01')        = 9      ← the real seam
```

The formula is a **SUM over each chosen weekday's occurrences**, never a product:

```
allowance = Σ  occurrences( day, [window start .. window end] )
          day ∈ chosen days
```

A Sunday-only plan across November is **5**, not 4 — the five-week month the site promises. And
`quantity` is deliberately **not** a multiplier on this path, because `set_recurring_days` has
already written the day count onto the line as the quantity; multiplying again would double it.

### 5b. The client books freely, and is stopped only at the cap

A plan set to **Sat + Sun**, its month generated, then every session cancelled and rebooked:

```
9. the member spent the month on days they never chose
   booked on: Tue 18, Thu 20, Mon 24 (plus Wed 19)  → bookings alive 4 | spendable 0
   one booking past the month's total → refused: NO_CREDITS
```

Three of the four landed **in one week**, on weekdays the chosen pattern never contained. **There is
no "days per week" check anywhere in the new code** — the weekday is read exactly once, to decide how
many sessions to lay down, and never again.

### 5c. Moving or cancelling never changes the month's allowance

```
6. client cancelled ONE session, staff approved
   the credit that appeared: package=Exercise Weekly total=4 remaining=1
                             period=2026-08-01 expires=2026-09-01 item=<the plan's own line>
   month total unchanged: bookings alive 3 + spendable 1 = 4  (minted total 4)

7. cancelled EVERY remaining session, six times over
   bookings alive 0 | spendable 4 | credits_total 4  → the cap held
```

And in the suite, the invariant is asserted **on every pass** of a five-iteration cancel-and-rebook
loop: `bookings alive + spendable === minted`, with `credits_total` unmoved at the end.

### 5c2. A freshly provisioned month: N bookings, ZERO spendable

```
4. generated this month  {"created":4, "kind":"care", "recurring_days":["Sat","Sun"]}
   bookings alive = 4 | credit ROWS = 1 | credits_total = 4 | SPENDABLE NOW = 0
   every generated booking names the credit it spent: 4 of 4
5. a SECOND generate run  {"created":0, "skipped_existing":4}
```

**The double-mint hazard, answered as a before/after table:**

| seam | before (CREDITALIGN) | after (CAREPLANS) |
|---|---|---|
| `_mint_credits_for_purchase_item` | the **only** minter; `weekly_frequency × anchor-weekday occurrences × quantity` | still the **only** minter; reads the **chosen days** when there are any, else the identical old formula |
| `mint_recurring_allotments` (daily cron) | mints the new month's allotment | mints **and then generates**, so the month opens with sessions rather than a pile of credits |
| `generate_monthly_lessons` / `_generate_plan_month` | writes bookings, **debits one credit each** | unchanged in that respect — it loops the day set instead of one weekday |

**They never both hand out entitlement.** The generator spends what the seam minted; that is why the
month lands at zero spendable. A plan the cron finds with no stored delivery time is **minted only**
— under-scheduled, never over-entitled, which is the safe direction §P2b asks to keep.

### 5c3. A credit exists only after a cancellation, and dies with the month

The cancellation credit above carries `period_start = 2026-08-01`, `expires_at = 2026-09-01 00:00`,
and `purchase_item_id` = the plan's own line. Asserted in the suite as
`expires_at = date_trunc('month', current_date) + interval '1 month'`, and separately that **zero
untagged rows exist** (`purchase_item_id IS NULL` count = 0). It does not roll into September, and it
cannot be spent on another service, because it names the one it came from.

### 5c4 / 5d. The rebooked lesson lands where the pattern never was

`Mon/Wed/Fri` plan, cancelled once, rebooked on a **Tuesday** — asserted by reading
`to_char(starts_at,'Dy')` back off the booking. The credit does not remember which day it came from.

### 6. Existing recurring plans compute the SAME allotment — the regression that matters most

Every **active recurring SKU** run end-to-end through the mint seam on a synthetic client, once
**before** m2 and once **after**, `diff`ed programmatically:

| segment | SKU | weekly_frequency | anchor | minted BEFORE | minted AFTER |
|---|---|---|---|---|---|
| horse | Exercise Weekly | 1 | Tue | 2 | **2** |
| horse | Training Weekly | 1 | Tue | 2 | **2** |
| horse | Turnout Weekly | 1 | Tue | 2 | **2** |
| rider | 1x Weekly Lesson | 1 | Tue | 2 | **2** |
| rider | 1x Weekly Lesson (With your horse) | 1 | Tue | 2 | **2** |
| rider | 2x Weekly Lessons | 2 | Tue | 4 | **4** |
| rider | 2x Weekly Lessons (With your horse) | 2 | Tue | 4 | **4** |

```
diff mint_before.txt mint_after.txt → IDENTICAL
```

The mechanism is structural, not incidental: **`_recurring_allotment` was not touched at all**, and
the new arithmetic engages only when a line carries `config.recurring_days`. **Measured 2026-08-17:
zero `purchase_items` rows in prod carry ANY config key**, so no live plan changed shape.

### 7. Fixed-week plans stop; indefinite plans keep rolling

The daily roll, run live against three plans bought last month:

```
THE ROLL RAN  {"month":"2026-08-01","plans_considered":2,"credits_minted":16,
               "plans_generated":1,"sessions_booked":4}

after roll — indefinite + a stored time   | allotment 8 | SPENDABLE 4 | bookings 4
after roll — FIXED, ended last month      | allotment 0 | SPENDABLE 0 | bookings 0   ← skipped
after roll — indefinite, never generated  | allotment 8 | SPENDABLE 8 | bookings 0   ← mint only
THE ROLL RAN AGAIN (same day)  {"plans_considered":0,"credits_minted":0}             ← idempotent
```

⚠️ **Read the middle number honestly.** The first plan minted 8 for August and generated only 4,
because this run happened on the **17th** — the eight days of Tue/Thu already past cannot be booked
in the past. On a real 1st-of-month roll the generator lays down all 8 and the month opens at zero
spendable. **A plan that first qualifies mid-month keeps the earlier part of the month as spendable
credit rather than losing it**, which is the right way round: the client paid for the month.

"Indefinite" is `plan_ends_on IS NULL` — the **existing** column, the **existing** stop button
(`set_recurring_plan_end`), and the existing void path (`CAREPATH` §C5b). **No second lifecycle and no
second cancellation were invented.**

### 8. No offering name is parsed anywhere

Asserted in the suite across `_recurring_allotment_days`, `set_recurring_days`, `_generate_plan_month`
and `_mint_credits_for_purchase_item`: no `o.name =/~/like/ilike`, no `substring(`. The inputs are
`config_kind`, `segment`, `unit_count`, `weekly_frequency`, `quantity` and the chosen days.

### 8b. `unit_count` and `config_kind` are editable — and they change what the formula computes

Proven live, `BEGIN … ROLLBACK`, on `4-Lesson Punch Card`:

```
unit_count 4                                          → minted 4
the owner typed 5 — no developer, no migration        → minted 5
config_kind flipped to a monthly plan, 2 days a week  → minted 6   (the OTHER half of the formula ran)
```

In the editor they read **"How many sessions"**, **"Days a week, normally"** and **"How it is
delivered"** — with the delivery options in sentences (*"One-time — sessions they book"*, *"Monthly
plan — weekly, billed monthly"*), never column names. `adminUpdateOffering` already carries
`assertWrote` (CAREPATH §C1d), so an RLS-blocked write cannot masquerade as a saved one, and a NULL
price still clears rather than erroring (that path is unchanged by this task).

### 8c. `config_kind` is GUARDED, not locked — and the choice is: **warn, allow, never block**

New `admin_offering_usage()` reports, per offering, how many **live order lines** (not voided, order
not deleted) and **live bookings** point at it. When the operator changes how an offering is
delivered and that number is above zero, the form says so in red — *"N order lines and bookings
already point at this offering. Changing how it is delivered changes what those clients are owed —
their existing sessions are not recalculated. Save only if that is what you mean."* — and when it is
zero it says so too. **Nothing is prevented.** The owner ruled that an uneditable field is the
problem, not the safeguard.

### 8d. `weekly_frequency` is still in the catalog, still populated, still editable

Owner: *"we cant let it do that."* The column exists, every recurring SKU still carries its number
(`2x Weekly Lessons` = 2, asserted in the suite), it round-trips through the editor, and **it is
what pre-fills the staff day picker**. What changed is only what the *arithmetic* reads.

### 8e. The staff-chosen days drive the arithmetic; the catalog stays intact

Setting `Mon/Wed/Fri` on one client's `2x Weekly Lessons` plan returns
`differs_from_catalog: true, catalog_default: 2` — and the SKU's own `weekly_frequency` is re-read
afterwards and is **still 2**. One client's plan never edits the product everyone else buys. The
staff panel shows the mismatch in words: *"…normally runs 2 days a week and you have chosen 3. That
is allowed — the days you pick are what this client gets."* **Surfaced, not corrected.**

### 9. NO price changed

`grep` across all five CAREPLANS migrations for a write to `price_amount` / `price_min` /
`price_model` / `price_unit`: **no matches.** The live price table for all 25 priced horse and rider
SKUs is byte-identical to the pre-task dump taken at the start of this session — including the three
retired ones, which keep 390 / 200 / 680.

### 9b. No volume-break logic exists

Cost is `rate × sessions`, and nothing tiers on quantity. Demonstrated on an unpaid order:

```
11. a fresh UNPAID weekly order, before the days are chosen  quantity=1  order total=0
    staff chose TWO days                                     quantity=2  order total=400.00
    and then THREE days — no volume break                    quantity=3  order total=600.00
```

Linear, `200 · 400 · 600`, against an unchanged catalog price of 200.
`_recompute_purchase_total` is `Σ price_amount × quantity` — there is no other pricing path.

⚠️ **A PAID order is not re-priced by a scheduling action.** `set_recurring_days` leaves `quantity`
alone when `payment_status = 'paid'` and returns `quantity_locked: true`; the staff panel then says
so and points at the order. Changing what someone has already settled must be a deliberate act on the
order, not a side effect of choosing days.

### 9c. The staff-built monthly bundle — REPORTED, not built

The owner's third shape: *"a monthly plan that consists of multiple care service items… a fixed
monthly price that recurs until cancelled."*

**There is still no home for it, and this task did not build one.** `config_kind` allows no bundle
kind, and no `plans`/`bundles` table exists. **How I would express it, and it is one small thing, not
a new subsystem:**

> **Let a price live on the ORDER LINE instead of only in the catalog.** A staff-built plan is one
> `purchases` row whose `purchase_items` are the care lines, with **one line carrying the agreed
> monthly price and the rest carrying zero**, plus a flag saying the order's amount is quoted rather
> than summed. The entitlement is untouched — each line still computes its own sessions from its own
> chosen days, exactly as §P3 does now, so **the allotment maths is never driven by the price**.

**And yes — this is the same work as the quoted-price gap in
`docs/design/ACQUISITION-PRICING-AND-FULFILMENT.md` §3.** Both need one capability: *a price recorded
on the order rather than in the catalog*. Acquisition needs it because the number does not exist
until the conversation happens; the bundle needs it because the number is not the sum of its parts.
**Building them separately would produce two ways to override a price, and the second one would be
found later by someone who did not know about the first.** They should be one task.

### 9d. LESSONS ARE UNTOUCHED

| SKU | price | weekly_frequency | active | copy |
|---|---|---|---|---|
| 1x Weekly Lesson | 460.00 | 1 | t | untouched |
| 2x Weekly Lessons | 880.00 | 2 | t | untouched |
| 1x Weekly Lesson (With your horse) | 420.00 | 1 | t | untouched |
| 2x Weekly Lessons (With your horse) | 780.00 | 2 | t | untouched |

Still four separate SKUs, unchanged prices, unchanged `weekly_frequency`, unchanged names and
descriptions. Their allotments compute identically before and after (§6 table). `/lessons` has its
own renderer and was not edited; the funnel selector's new wording is scoped to `segment = 'horse'`.

⚠️ **One honest difference, and it is a new capability rather than a regression.** If staff use the
**new** plural control on a `2×` lesson plan and choose only ONE day, that plan is entitled to that
day's occurrences (≈4), not 2 × them (≈8) — because the owner ruled *"the days win"*. Nothing existing
moves: the old singular writer is untouched and every plan sold to date uses it. The staff panel
shows the mismatch before it is saved.

### 9e. The billing rhythm — REPORTED. **No biller exists and none was built.**

Measured on prod: every `%bill%` / `%invoice%` / `%charge%` / `%dunning%` / `%prorat%` function was
listed and read.

- **`billing_next_due(start, cadence, after)` exists and has ZERO callers** — no function, no `src/`,
  no `api/`. A leftover date helper from the lease work, not a cycle.
- **`resolve_consumption_billing` is barn-ops** (feed/bedding allocations → billable lines). Not plans.
- **Proration exists as copy and as ENTITLEMENT, never as price**: the lessons footnote, and
  `CREDITALIGN` counting the weekday occurrences left in the window.
- **A scheduler does exist, and it is outside the database** — `vercel.json` runs
  `/api/mint-monthly-allotments` daily at `20 8 * * *`. That answers the "biggest unknown" the design
  record flagged: a billing run can ride the same shape.

**So the money is handled by hand and only the entitlement rolls.** Findings added to
`docs/design/MONTHLY-BILLING-REVIEW.md` §3b rather than restated. **Nothing was built.**

### 10. Every DB claim above is query output

Render claims are below, unverified, with a numbered checklist.

---

## The defect found and FIXED

**`decide_booking_change` minted entitlement out of nothing on every approved cancellation.**

The shipped body, on the approve branch for `cancel` / `defer`:

```sql
IF (v_cr.request_kind = 'defer' OR r.kind = 'lesson') AND r.client_id IS NOT NULL THEN
  INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, purchased_at)
    VALUES (r.org_id, r.client_id, 'change_credit', 1, 1, now());
```

Four things wrong with it, all of which break rulings this task has to satisfy:

1. **No expiry.** The credit **survived into the next month** — the owner's ruling is that a cancelled
   lesson does not (§5c3).
2. **No offering, no purchase, no line.** Untagged, so `book_open_slot`'s fallback branch would spend
   it on a different service. **A cancelled horse-care session became a free lesson.**
3. **It did not restore the row the booking actually spent**, so the plan's own allotment stayed down
   and a second, uncapped row appeared beside it.
4. **It fired even when the booking had no `credit_id`** — a session that cost nothing returned a
   credit. That is an over-mint.

It now routes through `_refund_booking_credit`, the seam `delete_calendar_item`, `swap_booking_item`
and `withdraw_my_pending_booking` **already** used — this was the one arm that did not. Restores in
place, capped at the row's own total, inheriting the month and its expiry.

⚠️ **One behaviour narrows, deliberately.** A cancelled booking that never debited anything now
returns nothing, where before it returned a free credit. Every booking that spends entitlement names
its credit (`book_open_slot`, `_generate_plan_month`, and `save_calendar_item` via
`_debit_or_create_for_booking`), so this only removes credit that was never paid for. **Flagged
because it is a change to a client-visible generosity, and the owner may want to reverse it.**

---

## Flagged, NOT fixed — owner rulings

- **R1 · The 2-day price moves.** §"What the owner should know" table. `Exercise 2x` 390 → 400,
  `Training 2x` 680 → 720, `Turnout 2x` 200 → 200. **Nobody is affected today.** If those numbers
  should be preserved, the answer is a price on the order line (§9c) — not a resurrected 2× SKU.
- **R2 · The slugs still say `1x`.** `horse-exercise--item-73441c62` is opaque, but the three renamed
  SKUs keep the slug they were created with. Slugs are the stable handle a cart line and any saved
  link resolve by, so **renaming them would break links to gain nothing**. Left alone.
- **R3 · A cancellation on a booking with no credit now returns nothing** — see the defect note above.
- **R4 · A plan that first qualifies mid-month keeps the past days as spendable credit** (§7). It is
  generous and it is consistent with "the month is what they bought", but it is a ruling.
- **R5 · CREDITALIGN's F1 is still open and this task did not touch it.** A one-off horse-care service
  (`Full Body Clip`, `Exercise Session`) mints nothing, so `book_open_slot`'s credit gate has nothing
  to spend. **À la carte care is half the shape this task is named after**, and it does not work yet.
  This is the most consequential thing left open.
- **R6 · 46 red files in `test/db` on `main`.** Pre-existing, unchanged, not this task's.

---

## Render claims — **NOT VERIFIED**

No browser was opened. Everything below typechecks, lints and builds, and its server side is proven,
but **nobody has looked at it.** Owner checklist:

1. **`/horse`** — Exercise, Turnout and Training each show exactly **two** cards: a session and a
   **"… Weekly"**. No `1x`/`2x` anywhere. The weekly card's small line reads *"Weekly · we agree the
   days with you"*.
2. **`/lessons`** — unchanged. `1x Weekly Lesson` and `2x Weekly Lessons` still separate cards, same
   gold price lines, same footnote, same badges.
3. **`/acquisition`** — every card reads **"Price on inquiry"**, never `$0`.
4. **Admin → Products → any offering** — a **"What they get"** panel: *How it is delivered*, and then
   *How many sessions* (one-time) or *Days a week, normally* (monthly plan). Change one, save, reopen:
   it stuck.
5. **The same panel on an offering that has been sold** — change *How it is delivered* and the red
   warning appears with the real count. **It must still save.**
6. **Staff calendar → a recurring offering + client → "Monthly plan"** — seven day toggles instead of
   the old dropdown, a **"Until they cancel"** checkbox, and a weeks box when it is unchecked.
7. **Pick two days on a 1×-default SKU** — the gold mismatch sentence appears and does **not** block.
8. **Press "Set days"** — the result line states the month's sessions, the duration, and either
   *"the order now bills 2 × the weekly rate"* or, on a paid order, that the quantity was left alone.
9. **Press "Generate this month's sessions"** — sessions appear on **every** chosen weekday, and the
   plan line above then reads `0 of N left this month`.
10. **A lead's order panel** — a weekly line reads *"Weekly — staff choose the days of the week
    (normally 1), plus how long it runs"*.

---

## Files

**Migrations (all applied to prod, all dry-run inside `BEGIN … ROLLBACK` first)**
`20260817T1700_careplans_m1_two_shapes_per_care_service.sql`
`20260817T1710_careplans_m2_the_chosen_days_are_the_frequency.sql`
`20260817T1720_careplans_m3_the_month_opens_with_bookings.sql`
`20260817T1730_careplans_m4_a_cancellation_returns_the_credit_it_spent.sql`
`20260817T1740_careplans_m5_the_catalog_editor_knows_what_is_in_use.sql`

**Code** `src/lib/admin.ts` · `src/lib/types.ts` (one stale comment) ·
`src/pages/app/ops/admin/AdminProductsPage.tsx` · `src/lib/ops/api-calendar.ts` ·
`src/pages/app/CalendarItemPanel.tsx` · `src/components/app/LeadOrderPanel.tsx` ·
`src/components/ServiceSelector.tsx`

**Tests** `test/db/careplans_days_are_the_frequency.test.ts` (new, 26)

**Docs** `docs/design/MONTHLY-BILLING-REVIEW.md` §3b (findings added, nothing restated)

---

## Suite state

| | files failed | tests failed | tests passed |
|---|---|---|---|
| `main` (5a6d1fb) | 46 / 71 | 203 | 453 |
| this branch | 46 / 72 | 203 | 479 |

**The failing FILE SET is identical** — `comm` diff of the two sorted lists: **no new failures, none
fixed**. The +26 passes are this task's file. Those 46 are the replayability caveat CLAUDE.md records,
plus drift; they are not this task's and were not touched.

`test/ui`: **2 failed files / 3 failed tests on both sides** — unchanged.
`npm run typecheck`, `npm run typecheck:api`, `npm run build`: **clean**.
`npm run lint`: **0 errors** (46 warnings, all pre-existing).

## Traps observed

- **Every function reissued was read from `pg_get_functiondef` on PROD first**, not from the newest
  migration file — `decide_booking_change` and `_mint_credits_for_purchase_item` were both rebuilt
  from their live bodies with a single arm changed, and the m4 file is a byte-for-byte copy of the
  live body plus one replacement.
- **`_recurring_allotment` was deliberately NOT touched.** The cheap move was to widen it; that would
  have crossed the entitlement arithmetic for every existing plan to serve a case no plan has yet.
- **No migration contains `BEGIN`/`COMMIT`** (grepped). All five were dry-run and rolled back first;
  the rollbacks were proved by re-querying afterwards — **0 `careplans-…` proof contacts remain**, and
  every synthetic client, order, booking and credit this task created is gone.

  ⚠️ **One live row appeared during the session that is NOT this task's, and is named here so nobody
  later mistakes it for leakage.** Prod held 1 purchase and 0 credits at session start; it now holds
  2 and 1. The new one is **PUR-000226, a `Single Lesson` for Rachel Engelhorn**, created
  `2026-08-17 11:13:59` — `_debit_or_create_for_booking` minting and debiting a credit against her
  **pre-existing 3 August booking** when something saved that booking. That is a real client through
  a real path, not a fixture: **no CAREPLANS script ever touched an existing booking or a real
  contact.** (The `display_code` also jumped 106 → 226 because rolled-back transactions still consume
  the sequence — expected, and not a sign of retained rows.)
- **Grants are `has_function_privilege()` results, not REVOKE lines read back.** `anon` is `false` on
  all five new functions; `_generate_plan_month` is revoked from `authenticated` too, since it is the
  writer behind the staff gate.
- **The one thing that cannot collapse to multiplication** — five-weekday months — is asserted
  directly (`['Sun']` over November = 5) as well as through the owner's 9.
- **Every vitest run was `vitest run --maxWorkers=2`**; no watch mode.

## TEARDOWN

`pkill -f wt-careplans` — no processes were left behind; `ps aux | grep -E 'node|vite|vitest|esbuild'`
shows only VS Code's own helpers. Scratch verification scripts live in the session scratchpad, not the
repo. Swap and disk were censused at session start (2.5G swap, 69Gi free) and nothing this task ran
changed that materially.
