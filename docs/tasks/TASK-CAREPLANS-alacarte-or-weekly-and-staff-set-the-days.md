# TASK CAREPLANS — à la carte or weekly, staff choose the days, quantity follows

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** This changes the catalog, staff provisioning, and
the credit-minting maths that shipped on 2026-08-16 — three things that have each broken this
project before.

✅ **FULLY UNBLOCKED (2026-08-17). Every owner question is answered.** ⚠️ **And the answer to the
pricing one is: CHANGE NO PRICES AT ALL.** Owner: *"im not supplying any price revisions."* Every
number in the catalog stays exactly as it is — this task touches structure only.

**HOW TO RUN:** everything is in this file · verify every measurement before building ·
report to `docs/reports/TASK-CAREPLANS-REPORT.md` · commit, **do not push** · no subagents ·
every DB claim is query output, render claims marked **NOT VERIFIED** with an owner checklist.

---

# THE OWNER'S RULING (2026-08-16)

> *"there should be no pricing for any of the acquisition services and the pricing for the care
> services needs to be adjusted, as does the order config for weekly services. right now it says 1x
> or 2x and it shouldnt do that, it should just offer ala carte and weekly as the two options and the
> provisioning that we do on the staff side is to select the days of the week and the quantity is
> determined from that as well as how many weeks it runs for or indefinitely until cancelled."*

**Three changes:**
1. **Acquisition services carry NO pricing** — every one is price-on-inquiry.
2. **Care service prices are adjusted** — ⚠️ **numbers pending, Owner Question 1.**
3. **Weekly care is ONE option, not 1x/2x.** The customer picks **à la carte or weekly**; **staff
   choose the days of the week**, and **the quantity follows from that**, along with **how many
   weeks — or indefinitely until cancelled.**

---

# WHAT WAS MEASURED (main, 2026-08-16 — VERIFY, then build)

**The frequency lives in the wrong place, and the day is singular.**

| piece | today |
|---|---|
| `offerings.weekly_frequency` | **on the OFFERING** — this is what encodes "1x" vs "2x" as separate SKUs |
| `offerings.config_kind` | `'scheduled'` / `'recurring'` — recurring = a real subscription |
| `offerings.unit_count` | deliverable units for a scheduled SKU |
| `purchase_items.config->>'recurring_day'` | ⚠️ **ONE day, singular**, written by `set_recurring_day` |
| `_recurring_allotment()` | `weekly_frequency × weekday-occurrences-in-window × quantity` |

**So the maths currently reads frequency from the catalog and a single weekday from the purchase.**
The owner's model inverts it: **the days chosen at provisioning ARE the frequency.**

⚠️ **`CREDITALIGN` shipped this maths on 2026-08-16** (`_recurring_allotment`, monthly allotment,
month-boundary expiry, `set_recurring_day`). **This task modifies work that is days old and was
itself the third attempt at credit minting.** Read its report at
`docs/reports/TASK-CREDITALIGN-REPORT.md` **before touching any of it.**

⚠️ **The lessons funnel deliberately keeps `1x Weekly Lesson` / `2x Weekly Lesson` as distinct
cards** — the owner designed that page on 2026-08-15/16 and approved the copy. **Owner Question 2
confirms whether lessons are in or out of scope. Assume OUT until told otherwise.**

---

# P0 — THE GOVERNING FORMULA. Everything below must satisfy this one rule.

**Owner, 2026-08-17:** *"why cant we use quantity as the multiplier… either we do everything on a
weekly basis… you compute both values and they need to match based on the calendar month, and you
use the purchase date to start the weeks for everything else."*

**He is right, and for one-time items the system already works this way.** Measured on the live
catalog: `scheduled` SKUs carry `unit_count` (Punch Cards **4** and **8**, everything else **1**);
`recurring` SKUs carry `weekly_frequency` (**1** or **2**). `lesson_credits` already has
`credits_total`, `period_start` and `expires_at`.

**ONE FORMULA, TWO CONFIGURATIONS:**

```
credits = rate × periods

ONE-TIME    rate = unit_count            periods = 1
            window = expiry days from the PURCHASE DATE      (4-pack 60d, 8-pack 120d)

RECURRING   rate = HOW MANY DAYS STAFF CHOSE   periods = occurrences of those days
            window = the CALENDAR MONTH                      in that month
```

**What changes:** for recurring, `rate` stops being `weekly_frequency` read from the catalog and
becomes **the count of days staff actually selected** (§P3). Two days chosen *is* rate 2 — which
**dissolves the 2× gap (§P2b) as a side effect rather than as a separate fix.**

### ⚠️ THE SELECTED DAYS ARE AN ENTITLEMENT BASIS, **NOT A SCHEDULE**

**Owner, 2026-08-17 — this is the ruling that shapes the whole task:**
> *"it needs to allow moving any monthly plan to any day in the month. it cannot restrict to a
> specific number of days per week and lock in on that. a person needs to be able to schedule any
> amount of days per week but not exceed their monthly total calculated based on the number of their
> selected days in the month. so if there are 5 sundays and 4 saturdays in the month and those are
> their selected days they get 9 lessons that month."*

**The chosen weekdays exist ONLY to compute a number.** Once that number is known, the client books
**freely** — any days, any distribution across the month, several in one week and none the next.

```
Saturday + Sunday selected, in a month with 5 Sundays and 4 Saturdays
        →  allowance = 9 lessons that month
        →  bookable on ANY 9 days the client likes
```

**What this means for the build:**
- **`rate × periods` computes HOW MANY BOOKINGS TO GENERATE** — sum the occurrences of *each* selected
  weekday in the month, 5 + 4 = 9. ⚠️ **It does NOT mint 9 credits; see the mechanism below.**
- **The client may then move any of those 9 to any date.** **Do not add a "days per week" check** —
  that would re-impose the very restriction the owner is removing.
- **The month's total can never grow**, however many times a lesson is moved.

⚠️ **`generate_monthly_lessons` IS THE PROBLEM, and it must change.** Measured: it reads a single
`config.recurring_day`, loops the month with `CONTINUE WHEN to_char(d,'Dy') <> v_day`, **inserts a
booking for every occurrence and debits a credit each time.** That is a schedule lock — precisely
what this ruling forbids.

### ⚠️ THE MECHANISM — OWNER-RULED 2026-08-17. **THIS IS THE FINAL SHAPE.**
> *"it needs to mint the credits based on the applied bookings that auto generate, and then the
> rescheduling adds a credit back temporarily until its rebooked."*
>
> *"so the month starts with applied bookings auto generated and NO CREDITS. if they cancel a booking
> they get a credit that expires at the end of the month. they can reschedule it at any time until
> then."*

**Read the second quote as governing.** An earlier orchestrator draft had the month opening with 9
bookings **and** 9 credits held against them; that is **wrong** and simply doubles the bookkeeping.

**THE BOOKINGS ARE THE ENTITLEMENT. A CREDIT IS ONLY EVER THE RESIDUE OF A CANCELLATION.**

```
month starts   →  9 bookings auto-generated across the selected weekdays
                  ZERO credits minted
client cancels →  ONE credit appears, expiring at the END OF THAT MONTH
client rebooks →  the credit is consumed, on ANY date they choose
month ends     →  any credit still unspent EXPIRES — that lesson is lost
```

- ⚠️ **Do NOT mint an allowance up front.** There is no "9 credits" row at provisioning. The count of
  generated bookings *is* the month's entitlement; nothing needs to state it separately.
- **A credit is created BY the cancellation**, not returned from a pool that was never filled.
- **It expires at the end of the month it was cancelled in**, in line with `CREDITALIGN`'s
  month-boundary rule — a cancelled lesson does not survive into the next month.
- **Rebooking is unconstrained by the original weekday.** The credit does not remember which Saturday
  it came from.
- **The month's total can never grow.** Cancel-then-rebook is one lesson moving. **Prove a repeated
  reschedule loop cannot manufacture a tenth lesson.**

### ⚠️ THE DOUBLE-MINT HAZARD — the single most dangerous thing in this task
`CREDITALIGN` built **`mint_recurring_allotments`**, which mints a monthly allotment for recurring
plans, **and** `generate_monthly_lessons` creates the bookings. **Under this ruling only the second
should run for these plans.**

**If both fire, the client gets 9 bookings AND 9 credits — double the entitlement they paid for.**
That is an over-mint, the exact failure direction `CAREPATH` noted the current code is safely on the
right side of.

**Establish exactly which seam mints what, before changing either.** State it in the report as a
before/after table, and **prove with query output that a freshly provisioned monthly plan has N
bookings and ZERO credit rows.**

**✅ The round trip ALREADY EXISTS — extend it, do not rebuild it.** Measured:
`_refund_booking_credit` is live and called by **`decide_booking_change`, `delete_calendar_item`,
`swap_booking_item` and `withdraw_my_pending_booking`**; `_debit_or_create_for_booking` is the
consuming half. **The gap is only that `generate_monthly_lessons` handles ONE weekday.**

⚠️ **`mint_recurring_allotments` also exists** and is the monthly minting seam. **Establish how it
and `generate_monthly_lessons` divide the work before changing either** — minting the allowance in
one and the bookings in the other is how a month ends up with 9 credits and 4 bookings, or worse,
9 bookings and 4 credits.

### ⚠️ THE ONE THING THAT CANNOT COLLAPSE TO MULTIPLICATION
**A calendar month holds FOUR OR FIVE occurrences of any given weekday.** A 1× weekly plan owes
**5 credits in a five-Tuesday month**, not 4.

**This is a written promise on the live site** — the owner's own lessons footnote: *"you can ride
every week even when there's a 5th week."* It is the entire reason `_recurring_allotment` counts
weekday occurrences instead of assuming 4. **Never replace that count with a constant 4.**

⚠️ **Note also: 2× weekly is 2 credits PER WEEK — 8–10 a month — not 2 per month.** The owner's
message contains the phrase "2 credits per month"; building to that would under-mint tenfold.

### The test this formula creates — and it is the strongest one in the task
**Prove EVERY existing package and plan computes identically under the single formula**, before and
after, as query output on both sides. That is a better regression than checking SKUs one at a time,
and it is what catches a five-week month being silently rounded down to four.

# THE BUILD

## P1 — acquisition carries no pricing ✅ **ALREADY DONE — VERIFY ONLY**

⚠️ **`CAREPATH` §C1d did this on 2026-08-17.** Verified against prod: `HORSE_EVALUATION`,
`HORSE_FINDER` and `HORSE_PURCHASE_ASSISTANCE` each have **0 priced offerings**. **Confirm it still
holds and move on — do not redo it.** The original wording follows for context.

### (original, now historical)
- **Every acquisition offering is price-on-inquiry.** Clear the price rather than setting zero, so
  the public surface renders **"Price on inquiry"** (`ServiceSelector` keys off a null price).
- Provisioning already survives null prices (`20260816T2800_provision_handles_quote_priced_offerings`
  coalesces to 0) — **verify, do not re-fix.**
- ⚠️ **A price of 0 and a price of "on inquiry" are different things.** Prove the public page shows
  the words, not `$0`.

## P2 — the catalog offers exactly two shapes per care service
- **À la carte** — a single occurrence.
- **Weekly** — a recurring plan whose frequency is **NOT baked into the SKU**.
- **Retire the 1x/2x variants** as customer-facing choices. ⚠️ **Retire, do not delete** — executed
  orders reference them. Follow the `/shop` precedent: make them unreachable and report what still
  points at them.
- **`weekly_frequency` stops being the customer's choice.** Whether the column survives as a default
  is the builder's call — **state which and why.**

## P2b — ⚠️ THIS TASK ABSORBS THE 2× WEEKLY GAP. IT IS THE SAME PROBLEM.

**`CAREPATH` left test 10 deliberately unmet (report §4, G1): a weekly ×2 item can be given only ONE
day of the week.** Do not fix that separately — **it is this task.**

**Why they are one job:** the gap exists because `offerings.weekly_frequency` says "2" while the
writer stores a single day. **P3 removes `weekly_frequency` as the input entirely** — the days staff
choose *become* the frequency. Fixing the ×2 case first would build day-plurality keyed to
`weekly_frequency`, and then P3 would tear that out. **That means crossing the entitlement
arithmetic twice, in the area `CREDITALIGN` was reverted three times.** Cross it once.

**Measured 2026-08-17: ZERO purchase lines exist against any 2× SKU.** Nobody is under-served today,
so there is no pressure to patch ahead of doing it properly. **Verify that is still true before you
start** — if someone has been sold a 2× plan since, say so, because they are being scheduled half of
what they bought.

### The shape, as `CAREPATH` recorded it
- **`config.recurring_days text[]`**, with the existing singular `config.recurring_day` kept as a
  **read fallback** so live 1× plans keep working untouched.
- **`generate_monthly_lessons` loops the array** instead of filtering `to_char(d,'Dy') <> v_day`.
- **The month's entitlement trues against `array_length(days,1) × weeks`**, not `weeks`.
- ⚠️ **The entitlement arithmetic is the dangerous half** — the scheduler is the easy part.
  `set_recurring_day`, `generate_monthly_lessons`, `client_monthly_plan` and `_recurring_allotment`
  all move together. **Regression-prove existing 1× plans compute identically (§THE TEST #6).**
- **The current failure is under-scheduling, never over-minting** — it books too little rather than
  granting credits nobody paid for. **Keep that direction if you must ship partially.**

## P3 — staff choose the DAYS, and quantity follows
At provisioning (`CAREPATH` §C7 is the surface), staff set:
1. **Which days of the week** — one or several. ⚠️ **`recurring_day` is SINGULAR today**; this needs
   a plural representation. **Do not scatter a second store** — extend the existing
   `purchase_items.config` and keep `set_recurring_day`'s single-day behaviour working for existing
   rows, or migrate them. **Prove existing plans still compute the same allotment after the change.**
2. **Duration:** **a number of weeks**, or **indefinite until cancelled.**

- **Quantity is DERIVED from the days selected — never typed by staff and never parsed from a name.**
  Names changed on 2026-08-15 and name-parsing broke credit minting three separate times.
- `_recurring_allotment` must take the frequency from **the chosen days**, not from
  `offerings.weekly_frequency`. **This is the core change; state the new formula explicitly.**

## P4 — indefinite plans
- **"Indefinitely until cancelled" is a new lifecycle.** A fixed-week plan ends on its own; an
  indefinite one runs until someone stops it.
- **Cancellation already has a meaning** (`CAREPATH` §C5b: cancelling voids the line item; voiding
  the last item voids the order). **Reuse it — do not invent a second cancellation.**
- ⚠️ **Establish what an indefinite plan does at a month boundary.** `CREDITALIGN` made monthly
  allotments expire monthly and re-mint. An indefinite plan should keep doing exactly that — **prove
  it, and prove a fixed-week plan stops minting when its weeks are up.**

## P5 — care pricing: THE MODEL IS SETTLED, THE NUMBERS ARE NOT

**Owner, 2026-08-16:**
> *"i dont have the prices yet, leave whatever we have in place for now. i can say this, ala carte is
> always more than a recurring weekly customer price and we typically dont discount if they buy 2x or
> 3x per week vs 1x — the discount comes from being weekly vs being ala carte. but we have been known
> to create a monthly plan that consists of multiple care service items and we provide a fixed
> monthly price that recurs until cancelled and its paid monthly."*

⚠️ **CHANGE NO PRICES IN THIS TASK.** Leave every existing number exactly as it is. This section
records the **shape** the structure must support so P2–P4 do not build something the real numbers
cannot fit.

### The rate model
- **The rate is PER SESSION**, and there are **two tiers**: à la carte, and weekly.
- **À la carte is always the higher per-session rate.**
- ⚠️ **There is NO volume discount.** 1×, 2× and 3× a week all use **the same weekly per-session
  rate** — *"we typically dont discount if they buy 2x or 3x per week vs 1x."*
  **The discount comes from the TIER (weekly vs à la carte), never from the quantity.**
- **This confirms P3's design:** cost = weekly per-session rate × sessions, and sessions come from
  the days chosen. **Do not build volume-break logic — there is none.**

### ⚠️ A THIRD SHAPE: the staff-built monthly plan
> *"a monthly plan that consists of multiple care service items… a fixed monthly price that recurs
> until cancelled and its paid monthly."*

| | |
|---|---|
| what | **several care items bundled into one plan** |
| price | **ONE fixed monthly price — NOT the sum of the line items** |
| cadence | **recurs until cancelled, paid monthly** |
| built by | **staff**, case by case — it is not a catalog SKU a visitor can pick |

**Measured: there is no home for this.** No `plans` / `subscriptions` / `bundles` table exists;
`config_kind` allows only `scheduled · recurring · intake_finder · intake_evaluation ·
document_transaction · inquire`. The `recurring` kind plus `CREDITALIGN`'s monthly roll already
handle *recurrence*; **what is missing is a fixed plan price that overrides the sum of its items.**

- **Report how you would express it — do NOT build it in this task** unless the structure falls out
  for free. It needs the same capability as the quoted-price gap in
  `docs/design/ACQUISITION-PRICING-AND-FULFILMENT.md` §3: **a price recorded on the order rather
  than in the catalog.** Those two should very likely be **one piece of work**; say so if you agree.
- ⚠️ **The entitlement must still be right.** A bundle's monthly price is fixed, but the client is
  owed the sessions in it — **the allotment maths (P3) must not be driven by the price.**

---

## P6 — THE BILLING RHYTHM for monthly items

**Owner, 2026-08-16:**
> *"the intention with monthly items is they are prorated or billed in full on the first purchase and
> then billed every month on the last day of the month prior."*

| moment | what happens |
|---|---|
| **first purchase** | **prorated OR billed in full** — a choice made at purchase, not a fixed rule |
| **every month after** | billed **on the last day of the PRIOR month** — i.e. paid **in advance** of the month it covers |
| **until** | cancelled |

⚠️ **This is billing in ADVANCE.** The charge for September is raised on 31 August. **A cycle that
bills on the 1st, or in arrears, is wrong.**

⚠️ **`CREDITALIGN` already mints entitlement monthly and expires it at the month boundary** — and the
lessons funnel already carries *"First month can be prorated or book all your lessons for the month
in the days remaining"* (the owner's own footnote copy, 2026-08-16). **The proration idea already
exists in the business. Find whether it exists in the code**, and reuse it rather than writing a
second one.

- **Establish and state**: does anything raise a recurring charge today, or is the money handled by
  hand while only the entitlement rolls? **Report the truth — do not assume a biller exists.**
- **The money and the sessions are separate concerns.** Entitlement re-minting is `CREDITALIGN`'s and
  must keep working regardless of what is decided about billing.
- ⚠️ **If no biller exists, DO NOT BUILD ONE HERE.** Report it as wave-2 work. Building a payment
  scheduler inside a catalog-configuration task is how this project got its three duplicate
  credit-minting paths.
- ⚠️ **The full billing design — including the owner's human-in-the-loop review — is already
  written up in `docs/design/MONTHLY-BILLING-REVIEW.md`.** Read it so your structure does not
  contradict it, and **add your findings to it** rather than restating them. **Build none of it.**

# TRAPS
- **Do not delete retired SKUs** — executed orders point at them.
- **Never parse a name** for frequency, quantity or cadence. Catalog fields only.
- **Do not touch the lessons 1x/2x cards** unless Owner Question 2 says so.
- **`CREDITALIGN` is days old and is the third attempt at this maths.** Read its report; do not
  "simplify" what it deliberately did.
- **Do not invent a second store** for days, duration or cancellation.
- **A null price ≠ a zero price.**
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback**.
- `assertWrote()` on every write; **RLS silently zeroes UPDATEs.**
- **Never symlink `node_modules` across case-variant paths.**
- **Run the PGlite suite** — **not a green baseline (~46 red files); diff against `main`**, and pay
  particular attention to `creditalign_recurring_entitlement*.test.ts`, which asserts the whole SKU
  table and **will fail loudly if this task changes it carelessly. That test is a feature.**

# THE TEST THIS MUST PASS
1. Every acquisition offering shows **"Price on inquiry"** on the public page — not `$0`.
2. Each care service offers exactly **à la carte** and **weekly**; no 1x/2x is customer-selectable.
3. Retired SKUs still resolve for existing orders — **prove an executed order referencing one still
   reads correctly.**
4. Staff can select **one, two, or more days**, plus **N weeks or indefinite**.
5. **The allowance is derived from the chosen days** — show the formula and **the owner's worked
   example: Saturday + Sunday in a month with 5 Sundays and 4 Saturdays = 9 lessons.**
5b. ⚠️ **A client can book those 9 on ANY days of the month** — three in one week, none the next,
    on weekdays that were never selected — **and is stopped only at the 10th.** Prove both halves:
    the freedom, and the cap.
5c. **Moving or cancelling a booking never changes the month's allowance** — cancel returns the
    credit, rebooking consumes it, the total is fixed at mint. ⚠️ **Run a reschedule loop several
    times over and prove the month's total never inflates.**
5c2. ⚠️ **A freshly provisioned monthly plan has N bookings and ZERO credit rows** — query both
    sides. **If `mint_recurring_allotments` also fires, the client has double the entitlement they
    paid for.** This is the over-mint hazard; prove it does not happen.
5c3. **A credit exists only after a cancellation**, expires at that month's end, and is spendable on
    any date until then — prove the expiry and prove it does not roll into the next month.
5c4. **The rebooked lesson lands on a date the original weekday pattern never included** — prove the
    freedom is real, not nominal.
5d. **No "days per week" restriction exists anywhere in the new code** — prove it by booking a
    distribution that violates the original weekday pattern and watching it succeed.
6. **Existing recurring plans compute the SAME allotment before and after** — query output both
   sides. This is the regression that matters most.
7. A **fixed-week plan stops** when its weeks elapse; an **indefinite plan keeps re-minting monthly**
   and stops on cancellation, through the existing cancellation path.
8. No offering name is parsed anywhere in the new code.
9. ⚠️ **NO price changed** — prove every care and lesson price is byte-identical to `main`
   (acquisition's clearing to null under §P1 is the sole exception).
9b. **No volume-break logic exists anywhere** — 1×, 2× and 3× weekly all use the same per-session
    rate. Prove the cost formula is `rate × sessions` with no quantity tiers.
9c. **The staff-built monthly bundle is REPORTED, not built** (§P5) — with a stated view on whether
    it is the same work as per-order-line pricing.
9d. ⚠️ **LESSONS ARE UNTOUCHED.** Prove `1x Weekly Lesson` and `2x Weekly Lesson` still exist as
    separate SKUs with unchanged prices, copy and `weekly_frequency`, **and that their allotment
    computes identically before and after** — query output both sides. **This is the regression most
    likely to be caused by the P3 maths change.**
9e. **The billing rhythm is reported** (§P6): whether any recurring charge is raised today, and — if
    one exists — that it bills **in advance, on the last day of the prior month**, with the first
    purchase prorated or billed in full. **No biller is built in this task.**
10. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

---

# OWNER QUESTIONS — answer before building

1. ~~The care prices~~ ⚠️ **CLOSED (2026-08-17). NO REVISIONS ARE COMING.** Owner: *"im not
   supplying any price revisions."* **Every existing price stays byte-identical.** The rate model
   still governs how the structure must work (per session, two tiers, **no volume discount** — §P5),
   but **not one number changes in this task.** Do not ask again.
2. ~~Are riding lessons in scope?~~ ⚠️ **ANSWERED — NO. LESSONS ARE OUT OF SCOPE ENTIRELY.**
   Owner, 2026-08-16: *"lessons are not in scope for this, we leave those exactly as designed."*
   **`/lessons` keeps `1x Weekly Lesson` and `2x Weekly Lesson` as separate cards**, keeps its copy,
   badges, gold price lines and footnote, and keeps whatever `weekly_frequency` those SKUs carry.
   **Touch no lesson offering, no lesson price, and no lesson page copy.** If a change to the
   recurring maths would alter a lesson SKU's behaviour, **that is a defect in your change** —
   §"THE TEST" requires proving lesson allotments are unchanged.
3. ~~Indefinite plans and payment~~ **ANSWERED — see §P6, the billing rhythm.**

Report to `docs/reports/TASK-CAREPLANS-REPORT.md`. Do not push; the orchestrator merges.
