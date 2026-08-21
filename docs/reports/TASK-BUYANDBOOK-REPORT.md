# TASK-BUYANDBOOK — REPORT

**Branch** `task/buyandbook` (worktree `~/Downloads/claude-code-repo/wt-buyandbook`), committed, **not
pushed**. Branched from `main@dc641c9`, fast-forwarded to `main@f980fd5` to pick up the two §4
rewrites and the onboarding ruling before any §4 work was written.

**Migrations** — three, each dry-run inside `BEGIN … ROLLBACK` (rollback proven: `create_my_purchase`
was absent from `pg_proc` after the first one), then applied to prod `lrstswfxfsezdmvkvukc`, then
verified. **Prod DATA is untouched** — the acceptance script runs inside its own transaction and
rolls back; `purchases`, `lesson_credits` and `bookings` are byte-for-byte what they were.

* `supabase/migrations/20260821T0100_buyandbook_1_a_member_can_create_a_purchase.sql`
* `supabase/migrations/20260821T0110_buyandbook_2_declaring_payment_opens_the_order.sql`
* `supabase/migrations/20260821T0120_buyandbook_3_a_weekly_membership_is_a_standing_slot.sql`

**Evidence** — `docs/reports/TASK-BUYANDBOOK-verify.sql` (re-runnable, self-rollbacking) and its
output `docs/reports/TASK-BUYANDBOOK-verify-output.txt`.

**⚠️ RENDER CLAIMS: NOT VERIFIED.** No browser was driven. Every UI statement below is read from the
diff; the server behaviour is measured.

---

## 1. The four decisions I made, and why

### §1 — an RPC, not a permissive INSERT policy

**RLS gates ROWS, not COLUMNS**, and that is the whole argument. `purchases` carries `status`,
`payment_status`, `amount_paid` and `paid_at`; `purchase_items` carries `price_amount`. A permissive
INSERT policy cannot say *"you may create this row, but those five columns are the server's"*. With
one, a member could insert `status='paid'` on a line priced at zero — and because
`purchase_items_mint_credits` mints for any purchase that is not `draft`, that is a self-service
credit press. It is not a theoretical hole: it is two fields in a JSON body.

`create_my_purchase(p_items jsonb)` owns every money-bearing column instead. The order opens as an
unpaid `draft`, and **each line is priced from `offerings`** — the browser names an offering, never a
price. It is `REVOKE`d from `PUBLIC` and `anon` and granted to `authenticated` only, and refuses a
null `auth.uid()` regardless.

**No policy changed, so `anon` was not widened.** Test 2 proves it the hard way: `anon` still holds
the INSERT grant (`has_table_privilege` = true), supplies a *valid* `org_id` so the NOT NULL default
cannot be what stops it — and RLS refuses it: `new row violates row-level security policy for table
"purchases"`. The RPC refuses it separately: `permission denied for function create_my_purchase`. The
restrictive org boundary is intact and unmodified.

### §3 — the declaration spine is `finalize_purchase_payment`, deliberately **not** `mark_purchase_paid`

The task named `mark_purchase_paid` as the convergence point. **It is the convergence point for
SETTLEMENT, not for declaration**, and using it here would have broken the ruling it was meant to
implement. It writes `payment_status='paid'`, `paid_at = now()` and `amount_paid = amount` — it
records money as **received**. A declaration is the client's word, not a receipt. Routing a
declaration through it would:

* put unreceived money in the books and in every revenue read;
* make `confirm_payment_claim` return `already_paid`, so **the staff confirmation D23 explicitly
  keeps would have nothing left to do.**

The measured truth is that the declared state already exists and Zelle already reached it:
`PUR-000238` sits at `awaiting_payment` / `payment_status='pending'` / `client_claim_status='pending'`
and **minted its credit at 16:58:53** — because the *"Pay with Zelle"* button calls
`finalize_purchase_payment`, which moves the order out of `draft`. Cash never touched that door.
So `report_my_payment` now routes a still-draft order through **the same incumbent function the Zelle
button calls**. Both methods reach one declared state through one door. No fourth door, no new mint
path, nothing written to `lesson_credits` outside the existing trigger spine.

**Flagged for the owner:** if he wants a declaration to read as *paid* in the books, that is a
different ruling and I have not made it.

### §4 — converged on CAREPLANS; **not** on `p_agreed_lesson`

The task asked me to converge the client-chosen standing time with `AgreedLessonPanel` /
`provision_client_invitation(p_agreed_lesson)`. **I did not, and the reason is a measured
mismatch, not a preference.** `p_agreed_lesson` books ONE session, through
`schedule_lesson_session`, from a single `starts_at`/`ends_at` — it is the first lesson agreed on a
phone call. A standing weekly slot is a different fact with a different home
(`purchase_items.config.recurring_days` + `recurring_times`) and a different writer
(`_generate_plan_month`). Routing the weekly client's choice through `p_agreed_lesson` would book
them one lesson and leave the membership **with no standing slot at all**.

The anti-duplication intent is honoured a different way: `set_my_standing_schedule` is a thin
client-authorised front door onto `set_recurring_days` — **the same function staff's
`CalendarItemPanel` already calls** — and then onto `_ensure_plan_horizon` → `_generate_plan_month`.
There is exactly one standing-slot writer and both surfaces reach it. `mint_recurring_allotments`
(the never-wired cron's entry point) was rewritten to delegate to the same horizon function, so it
cannot drift from what a calendar load does.

### §5 — the raw `NO_CREDITS` is not a second throw site

The task's hypothesis was *"a second path throws it unmapped"*. There is no second path:
`book_open_slot` is the only function in the database that raises `NO_CREDITS`, and `bookOpenSlot` is
its only caller. **The root cause is in the catch branch.**

`supabase-js` constructs a real `PostgrestError` (which extends `Error`) **only when
`.throwOnError()` was used**. Every wrapper in this codebase does `if (error) throw error`, which
throws the **plain object** PostgREST parsed out of the response body
(`PostgrestBuilder.js:127`). So `CalendarPage.tsx`'s

```
const msg = e instanceof Error ? e.message : '';
```

**always evaluated to `''`**, `msg.includes('NO_CREDITS')` never matched, `HORSE_CARE_DOCS_REQUIRED`
never matched either, and the `else` printed `toErrorMessage(e)` — which is the token itself. The
panel WALK1 was told exists does exist, and nothing could reach it. Both branches now read the
message through `toErrorMessage`. The identical trap in `BookingItemSwap.readableRefusal` (which
strips seven machine codes and could never strip any of them) is fixed with it, and the explanation
lives on `toErrorMessage`'s own doc block so the next person does not re-lay the trap.

### §6 — WALK1's finding is **WITHDRAWN**, with the row on the table

> *"That same failed click fired a staff notification anyway … `bookings` contains zero rows for this
> identity."*

**The booking exists.** `9dd08aa2-d4a1-4adc-924d-b259ea33e7b9`, `status='pending'`,
`starts_at = 2026-08-16 08:00-07`, `client_id = c5fd1335…` (the WALKTEST client), `credit_id` set —
and `updated_at = 2026-08-20 17:01:59.347793-07`, **equal to the notification's `created_at` to the
microsecond**, because they are the same statement in the same transaction.

The walk's own timeline explains it: the credit minted at 16:58:53 (the *Pay with Zelle* button), and
the booking succeeded at 17:01:59. The `NO_CREDITS` screenshots are from **before** that mint, and
from the cash/recurring order that never left draft.

Structurally it cannot happen either: `notify_staff` is a plain SQL `INSERT`, fully transactional,
and in both emitters (`book_open_slot`, `request_open_time`) it runs *after* the booking write in the
same transaction. **Nothing was built for §6.** There was nothing to fix.

---

## 2. What §4 actually is now

**A `recurring` SKU is a standing weekly slot. It mints no spendable credit.**

Four gaps stopped CAREPLANS' shipped mechanism from working for lessons. All four are closed inside
that mechanism; none of it was rebuilt.

**a. No days ⇒ no allotment.** The recurring branch of `_mint_credits_for_purchase_item` fell back to
`_recurring_allotment(weekly_frequency, …)` when no day was chosen. That fallback **is** the punch
card the owner rejected: `PUR-000230` (2x Weekly, `config = '{}'`) minted **four spendable credits and
no slot**. The fallback is gone. A recurring line with no chosen days now mints nothing at all.

**b. No retroactive allotment.** The month's budget counted chosen-day occurrences from the
*purchase* date while generation only ever writes from *today* — so a plan bought on the 1st and
scheduled on the 20th minted the difference as **spendable leftovers**. The same punch card by
another route. Both windows now start at `greatest(purchase date, month start, today)`.

**c. A time for each day.** `_generate_plan_month` took ONE `p_start_time` for every chosen day, so a
2x-weekly client could not have Tuesday at four and Thursday at five. `config.recurring_times`
(`{"Tue":"16:00","Thu":"17:30"}`) is read per weekday, falling back to the incumbent scalar so every
plan set up before this generates exactly what it generated before.

**d. A horizon instead of a scheduler.** `_generate_plan_month` covered the current month only, and
`mint_recurring_allotments` needed a cron to open the next one. `pg_cron` is not installed (0 rows in
`pg_extension`, no `cron` schema — re-measured in test 6d) and the Vercel crons were never created,
so month 2 never arrived. **The month is now a parameter**, and `_ensure_plan_horizon` rolls a
**90-day window, materialised on read**: `ensure_standing_slots()` runs once per calendar mount and
when a slot is chosen. Nothing wakes up — the next person to look is what extends it. It is
idempotent and skips a plan already covered via `config.horizon_through`, so a covered calendar load
costs one index lookup per plan.

**And the pricing bug that would have doubled the bill.** "2x Weekly Lessons" is $880 with
`weekly_frequency = 2`, i.e. 2 × the $460 1x rate — the SKU already *is* two lessons a week.
`set_recurring_days` set `quantity = array_length(days)`, so choosing the two days that SKU exists to
sell re-priced an $880 order to **$1,760**. Quantity now follows days **above the SKU's own weekly
frequency** (`ceil(days / weekly_frequency)`), which preserves the owner's no-volume-discount rule
where it applies and leaves every live horse-care recurring SKU (all `weekly_frequency = 1`)
arithmetically unchanged.

**And a hazard the horizon created, closed in the same migration.** Generation skipped a date only if
a **non-cancelled** booking sat on it. That was harmless while generation ran on a staff button; with
the horizon rolling on read it would have **silently resurrected a session the client cancelled** and
spent the credit the cancellation gave back. Any booking on the date — cancelled included — now
settles it. Coming back to a cancelled slot is a rebooking, which is the client's act.

**Where the client chooses (the owner's open question).** A new `'slots'` step in
`Onboarding.tsx`'s existing data-driven step machine, **after payment, before done**, shown only when
the order carries a `recurring` line and skipped entirely otherwise — exactly as §C10a skips the
horse step. It is placed after payment because the entitlement is written when the order leaves
draft, and under §2/§3 the *declaration* is what does that. **This is the smallest thing that works
and it is easy to move** — the step is one entry in the `Step` union and one render block.

---

## 3. The test this must pass

Full output: `docs/reports/TASK-BUYANDBOOK-verify-output.txt`.

| # | Test | Result |
|---|---|---|
| 1 | An authenticated member creates a purchase; 403 gone | **PASS** — `PUR-000250` ($500 punch card) and `PUR-000251` ($880 weekly), both `draft`/`unpaid`, both buyer keys stamped. The member's *direct* INSERT is still refused, which is the design. |
| 2 | `anon` still refused | **PASS** — holds the grant, supplies a valid `org_id`, refused by RLS. RPC refused separately. Policy list unchanged (3 policies, org boundary still RESTRICTIVE). |
| 3 | Declare Zelle ⇒ credits ⇒ *Book this time* books | **PASS** — order → `awaiting_payment`/`pending`, 4 credits minted, `book_open_slot` returned `pending` and the booking row carries the debited `credit_id`. |
| 4 | Same for cash, purchase leaves `draft` | **PASS** — `draft`/`unpaid` → `awaiting_payment`/`pending`/`cash`, claim `pending`. |
| 4b | A weekly credit exists **only** behind a cancellation | **PASS** — `remaining = 0` at every month the moment the slot is set; staff cancel one September session → `remaining = 1`; the member rebooks with it → `remaining = 0`. A horizon roll afterwards creates nothing and does **not** resurrect the cancelled date. |
| 5 | Confirming afterwards mints nothing further | **PASS** — 1 credit row / 4 credits before and after `confirm_payment_claim`. A second `_mint_credits_for_purchase_item` on the same item returns `0`, guarded by `lesson_credits_one_per_item_period`. |
| 6 | Open-ended weekly entitlement, no scheduler, 2 days/week | **PASS** — before choosing: 0 credits, 0 bookings. After choosing Tue 16:00 + Thu 17:30: **29 sessions across 4 months**, two weekdays every week, each at its own time; `pg_cron` absent; **17 sessions two months out**; order still $880 at quantity 1. Asking for a 200-day horizon extended it to **2027-03-30** and re-asking created nothing. |
| 7 | No raw `NO_CREDITS` | **PASS (code)** — one throw site, one caller, and the catch branch that could not read it is fixed. ⚠️ Render not verified. |
| 8 | A failed booking produces no `booking_time_requested` | **PASS** — notification count 6 before and 6 after a refused booking. |
| 9 | typecheck 0 · lint identical · `test/db` diffed | **PASS** — typecheck clean; lint **46 warnings, 0 errors, identical to main**; `test/db` **46 failed / 26 passed (72 files), 203 failed / 479 passed / 107 skipped** on both — the failing **file list is identical**, and after stripping timings the 203 failing **test lines are identical** too. |

---

## 4. THE REACH

**To buy from the catalog — two entry points, one writer.**

1. `/lessons` · `/horse` · `/acquisition` → cart → **`/checkout`** → *Review & Continue* →
   `handleStartPurchase` (`Checkout.tsx:184`) → `createDraftOrder` → `/order/:id`. Signed-in only;
   a signed-out visitor gets the inquiry form instead, which is the deliberate boundary.
2. `/app/calendar` → click an open slot → **Buy lessons** (`CalendarPage.tsx:756`, and a second
   button at `:298`) → `PurchaseLessonsPanel` → `createDraftOrder` → `/order/:id`.

**Both go through the same `createDraftOrder` → `create_my_purchase`.** They are the only two, and
they are now the only two that *can* work — the direct table INSERT they used to attempt is still
refused.

**To book with no credits — one path.** `/app/calendar` → open slot → `DetailPanel` → *Book this
time* → `bookOpenSlot` → `book_open_slot`. On `NO_CREDITS` the panel at `CalendarPage.tsx:754-757`
renders *"You don't have any lesson credits"* + **Buy lessons**. That is the only booking path that
consumes a credit; `request_open_time` (the *Request this time* drawer) creates a pending booking
without a credit and is a different act. **A weekly-membership client reaches neither** — their
sessions are already on the calendar.

## 5. THE TELL — both halves, at once

**What the member sees after declaring** (`OrderPayment.tsx`): the claim confirmation
(*"we've noted that you're paying cash / that you sent the payment"*) **plus a second line that is now
true**: *"Nothing is waiting on that. Your sessions are yours now — pick your times on the Calendar
whenever you like."* Plus the *"Actually, I'll pay cash / by Zelle"* switch.

⚠️ **That box was invisible before this task, and that is a defect I found and fixed.**
`report_my_payment` writes `payment_method = 'cash'`, the card initialised
`useState(order.payment_method ?? 'zelle')`, and **every panel on the card sat behind
`method === 'zelle'`** — with `STRIPE_ENABLED = false` there is no toggle to get back. So declaring
cash emptied the entire payment card: a heading and nothing else. The card's mode is now its own
state, and the order's method is read where it matters (a cash declarer is no longer shown Zelle
instructions, which they now have a `payment_reference` for).

**What staff see:** the same act files `client_claim_status = 'pending'` and calls `notify_staff`
with `'<name> says they paid <items> in cash — not yet confirmed'` linking to
`/app/ops/payments/review`, plus a `payment_reported` status event carrying the claim verbatim. The
order sits at `payment_status = 'pending'` — **not** `paid` — so the confirmation queue and the books
both still show money owed.

**Both are true simultaneously:** the client's entitlement exists, and staff are told a claim awaits
confirmation. That is D23 as written.

---

## 6. FLAGGED — NOT FIXED

1. **`mark_purchase_paid` was NOT used as the declaration spine.** Reasoned above. If the owner wants
   a declaration booked as received money, that is his call and it is one line.
2. **The D9 prepaid gate is gone from the monthly roll.** `mint_recurring_allotments` refused to open
   a new month unless `payment_status = 'paid'`. D23 is later and specific: the standing slot exists
   regardless and *"did they pay"* is answered by staff at fulfilment. **This is a deliberate
   override of D9 for `recurring` plans only** and should be ratified or reversed.
3. **The horizon is materialised on read, and that is a real property, not a hedge.** If nobody opens
   a calendar for four months, the fifth month is not written until someone looks. Nobody is looking
   in that scenario, which is why it is sound — but it means **the slots are not queryable by a
   process that never calls `ensure_standing_slots`** (a report, an export, an email job). The staff
   calendar rolls the whole org, so in practice one staff login covers everyone.
4. **`PUR-000245` is still `draft` in prod.** The fix is forward-looking; it does not retro-open
   orders. The member can re-declare through the *"Actually, I'll pay cash"* link, which now works.
   It is WALKTEST data — say the word and I will re-declare it, or leave it for WALK2.
5. **`PUR-000230` keeps the 4 spendable credits the old fallback minted** (3 already spent on
   bookings). Nothing retroactive was done to existing entitlements.
6. **Staff have no per-day time UI.** `CalendarItemPanel`'s *"generate this month"* still sends ONE
   start time. It now defers to `recurring_times` for any day the client set, so the two cannot
   fight — but staff cannot yet *set* two different times themselves. Small, and not in this task.
7. **`p_agreed_lesson` / `AgreedLessonPanel` untouched** — reasoned in §1. The phone-agreed *first
   lesson* and the *standing weekly slot* remain two different facts. If the owner wants the
   provisioning form to also set a standing slot, that is a new panel on the staff side calling the
   same `set_my_standing_schedule`.
8. **The task's cited cadence line was already dead.** `my_onboarding_state` returns
   `'lessons_included', NULL, 'cadence', NULL` hardcoded, so `planQuantity` could never render
   *"1 lessons/week"*. Removed anyway, and replaced with the standing-slot sentence.
9. **`_recurring_allotment` (the `weekly_frequency` formula) is now unused by the mint path** but is
   still called by `set_recurring_day` (the singular-day writer). Left in place; it is one `DROP`
   away once that writer is retired.
10. **`payment_reference` reads `FRENCHHERITAGEEQUESTRIAN-E4525E`** — the brand prefix is the whole
    unstripped name. Pre-existing; a cash declarer now gets one too, though they are never shown it.
11. **Render claims NOT VERIFIED.** No browser was driven: the onboarding slot step, the order-page
    standing-slot line, the repaired payment card and the no-credits panel are read from the diff.
    This is the one thing a WALK would settle in ten minutes.

---

## 7. TEARDOWN — process census

`vitest` was run twice (branch, then `main` for the baseline) with `--maxWorkers=4`, sequentially, per
the resource-hygiene rule. After both runs:

```
$ ps -eo comm | grep -Ec "node|vitest"
0
```

No stray `node`, `vitest` or `psql` processes. `node_modules` in the worktree is a symlink to the
main checkout's, not a second install. The scratchpad holds the two raw test logs; nothing was left
running.
