# DISCO-1 → ORCH · HANDOFF

**Thread:** `DISCO-1` · **Closed** 2026-09-01 · **Role:** `docs/method/DISO-ROLE.md`
**Working record:** `docs/reports/DISCO-1-LEDGER.md` — every number below has its query printed there.
**Scope:** CR-94's six passes, and `docs/CR-TRIAGE-keep-kill-do-2026-08-27.md` reconciled against
what has shipped in the five days since.

⚠️ **THIS IS A STEP-2 DELIVERABLE. STEP 3 HAS NOT RUN.** CR-94 was captured and 🔒 RULED on
2026-08-31; the owner's assignment here was research. **There are no new locked decisions in this
handoff, because DISCO-1 never had the discussion that produces them.** §6 is what step 3 opens with.

⚠️ **ORCH: DO NOT AUTHOR PASS 1 OR PASS 3 SPECS FROM THIS DOCUMENT ALONE.** §2 contains a finding
that puts the ruled pass order in question, and that is the owner's to settle, not ORCH's.

---

# 1 · THE CAPTURED REQUEST, VERBATIM — CR-94

> *"there is no way for claire to mark orders paid, this might be a latent bug related to the
> transition from old records page and new records page? bundle the research and remediation in with
> the calendar overhaul since an order, a payment, and a scheduled offering are all linked."*

> *"its all part of the same pass over calendar, orders, payments, discounts, revenue, losses,
> scheduling, etc… these updates need to ship asap and as a unit either consecutively or in one
> update pass, targeted fixes are faster to run and more likely to thorough and accurate and easier
> to validate."*

> *"all of our clients are largely not in the system fully, their orders, payments, revenue, and
> scheduled bookings need to be backfilled and we need the surfaces to function properly to be able
> to do this."*

**Ledger entry:** `docs/CHANGE-ORDER-LEDGER.md:3826`. **Nothing in it is overridden by this handoff.**

---

# 2 · ⚠️ THE ONE FINDING THAT CHANGES THE SHAPE OF THE UNIT

## THE BACKFILL CANNOT BE DONE, AND PASS 5 IS WHERE THAT IS DISCOVERED

The owner's stated purpose for the whole unit is to get his clients' real history into the system
**with their real dates.** Measured:

| The act | Can it carry a real date? | Evidence |
|---|---|---|
| create the order | ⚠️ **NO** | `attach_offerings_to_client(p_contact_id, p_offering_ids, p_mark_paid, p_payment_method, p_notes, p_partial_amount, p_org_id)` — **no date parameter exists** |
| record the payment | ⚠️ **NO** | `mark_purchase_paid` **has** `p_paid_at`; `api/orders-mark-paid.ts:109-114` passes four arguments and **not that one**. `markOrderPaid()` has no date parameter to pass |
| the revenue figure | ⚠️ **NO** | `revenue_summary` recognises at `paid_at` — a backfilled year lands as one day |
| the scheduled booking | ✅ **YES** | `<input type="datetime-local">`, and production already holds bookings back to 2026-07-20 |

⚠️ **Three of the owner's four legs are blocked, and the fourth already works.**

⚠️ **The consequence is worse than "blocked".** If the backfill is attempted as things stand, it does
not fail — **it succeeds and produces a false financial history that looks correct**: every order and
every payment stamped with the day it was typed, every prior month reading zero, and the dashboard
ribbon, the calendar money line and CR-86's P&L all reporting it confidently.

### ⚠️ THE SEQUENCING QUESTION THIS RAISES — AND DISO IS NOT ANSWERING IT

CR-94's 🔒 RULED order puts **the backfill surfaces at pass 5 of 6**. On this evidence pass 5 looks
like a **prerequisite** of passes 1 and 3, because pass 1 defines revenue *at `paid_at`* and pass 3
measures the rolling schedule *from the order* — and neither field can be set correctly today.

**That is a proposed change to a ruling of his. It goes to him as ASK-OWNER 1 (§6), not to a task
thread.** ⚠️ **A ruling of the owner's is not an input to the orchestrator's judgement.**

**Smallest thing that would unblock it, for his consideration only:** a date on the two entry points.
`mark_purchase_paid` already accepts one — **half the fix is a parameter nobody passes.**

---

# 3 · THE SIX PASSES — STATE, MEASURED

## Pass 1 · The money spine (`TASK-BOOKS1`, specced, unbuilt) — ⚠️ NOTHING OF IT EXISTS
**Incumbent (D18):** `revenue_summary(timestamptz,timestamptz)` — the one revenue definition.
`calendar_revenue` is its retired predecessor: **still in the database, zero call sites.**

- **No `discount`, no list price, no comp marker, no write-down, no paid-through period** anywhere in
  the schema. A `purchase_items` line holds **one** price and 14 columns.
- ✅ **This confirms the triage's guess as fact:** CR-39 (comp), CR-40 (discount) and CR-16's
  price-override are **one missing mechanism**, built once.
- ⚠️ **`revenue_summary` would invert a comp:** `coalesce(nullif(amount_paid,0), amount, 0)` — a
  giveaway settled at zero falls back to list price and is **counted as full revenue.**
- ✅ **Zero comps recorded to date, so no figure is wrong yet.** The first comp entered before
  `TASK-BOOKS1` lands is the one that breaks it — as the spec's §3 already says.

## Pass 2 · Settling an order from where the work happens — ⚠️ CONFIRMED, AND THE LEDGER NAMED THE WRONG FILE
**Incumbent (D18):** `markOrderPaid` → `/api/orders-mark-paid` → `mark_purchase_paid` /
`confirm_payment_claim`. ⚠️ **One spine, already correct, already staff-permitted. Pass 2 is a REACH
change. Nothing new may be written.**

- `markOrderPaid` still has **exactly one call site** — `PaymentReviewPage.tsx:153`.
- ⚠️ **CORRECTION.** CR-94's table blames *"the client record's Orders tab"*. That surface —
  `OrdersContent.tsx`, which renders "Manage payment" — is **the member's own My Orders**
  (`listMyOrders()`, mounted at `/app/orders` and `AccountHub.tsx:205`). **Staff never see it about
  anyone else.** The staff client record is **`ContactDossierModal.tsx`**: its Orders tab
  (`:584-628`) shows a status badge and offers only *attach offerings*; its Payments tab (`:867`) is
  read-only and filters on `payment_status='paid'`, **so an unpaid order is not even visible there.**
  ⚠️ **A task thread sent to the named file would have fixed the wrong screen.**
- ⚠️ **THE TRAP:** "mark paid" already appears **twice** on surfaces the owner works from —
  `ClientRecordActions.tsx:350-394` (`unpaid|partial|paid` at order creation) and
  `CalendarItemPanel.tsx:635` (`needs_payment|paid` when a booking creates an order). **Neither
  settles an order that already exists.** The person who has used those two will reasonably expect
  the third case to work.
- **What is stuck:** 17 orders exist in the whole business — **12 `awaiting_payment`/`unpaid`**, 4
  paid, 1 draft. Named: Gabriella Olenik ×2, Rachel Engelhorn ×2, Kit Garcin, Madeline Do, Evan
  LaBuzetta ×2, Audrey Slater, Serena Lee, Charlotte Caddell, Beth Davis.

## Pass 3 · The rolling schedule (CR-90) — ⚠️ THE STATES ARE ALREADY BUILT AND UNUSED
**Incumbent (D18):** `_ensure_plan_horizon(p_purchase_item_id, p_through)` — **one function, one
line**: `v_through := coalesce(p_through, current_date + 90)`. ✅ **CR-90's replacement has exactly
one place to happen.**

- ✅ **"THIS EXISTS":** `bookings_status_check` already permits twelve values including **`pending`,
  `pending_payment` and `confirmed`** — the three rungs CR-28 and CR-60 both describe.
  **In use: `available` 594, `scheduled` 117, `completed` 1. Nine of the twelve have never been
  written.** ⚠️ **Pass 3 needs no migration on `bookings`.**
- ⚠️ **`skipped` is genuinely absent** — CR-22's one real gap, confirmed.
- **All three standing plans are held to `2026-11-29`.** Of 117 `scheduled` sessions: **23 inside 30
  days · 21 in days 30-60 · 22 beyond 60.** Under CR-90, **22 sessions are holding time nobody has
  paid for.**

## Pass 4 · The month-end cycle — ✅ THE OPEN QUESTION IS ANSWERED
CR-94 pass 4 says *"Establish first whether ANY scheduled job runs in production."*

- ⚠️ **`pg_cron` is NOT installed.** `cron.job` does not exist; **nothing can be scheduled in SQL.**
- ✅ **But the Vercel crons ARE running, and it is proven, not inferred:** five jobs declared in
  `vercel.json`, and `bookings.reminder_1h_sent_at` holds **5 rows, most recent
  `2026-08-30 10:02:48-07`** — `/api/calendar-reminders` has written to production.
- **So CR-90's month-end cycle needs a sixth Vercel cron, not new infrastructure.**
  ⚠️ **`CRON_SECRET` must be set in two places** — a deploy step, and the step most likely to be
  missed.

## Pass 5 · The backfill surfaces — ⚠️ **BLOCKED. SEE §2.**

## Pass 6 · The calendar items — see §4 below.

---

# 4 · CR-TRIAGE RECONCILED — WHAT HAS ACTUALLY SHIPPED

⚠️ **SCOPE OF THIS RECONCILIATION, STATED HONESTLY.** The **DO lane (15 items)** and **G1 Calendar
(CR-01…07)** were re-measured item by item, because they are the work list and CR-94's own pass 6.
G5 was measured through the money-spine query. ⚠️ **G2, G3, G4, G6, G7 and G9 were NOT re-measured
this session** and are listed below only where a CR-94 query happened to touch them. **Do not read a
silent row as "unchanged" — read it as "not measured on 2026-09-01".**

## 4a · The DO lane — 15 items (the triage said 14; ORCH5 already corrected it to 15)

| CR | Triage verdict | State on 2026-09-01 | Evidence |
|---|---|---|---|
| **CR-02** | DO — fix the slip on **two** bookings | ⚠️ **NOT DONE, and the verdict is WRONG** | **One** row is bad: `BKG-000100` runs **00:00 → 13:00**. `BKG-000349` is **12:00 → 13:00 and correct** — it is the *evidence*, not a twin. ⚠️ **A thread would have "fixed" a good row** |
| **CR-04** | DO — *"make the screen look at the label"* | ⚠️ **NOT DONE, and the verdict is HALF RIGHT** | Cause confirmed: `calendar_free_busy` sends `is_mine:false, mine_role:'staff'`; `CalendarPage.tsx:139` tests `is_mine` and falls through to `'Reserved'`. ⚠️ **But the staff payload carries `client_id`/`offering_id` — UUIDs, no NAMES.** Reading the label fixes the fall-through and then **displays two UUIDs.** It is a two-part fix |
| **CR-52** | DO — delete the "being activated" page | ⚠️ **PARTIAL — needs his eye** | `ProtectedRoute.tsx:117-146`: the lie is gone and replaced by an honest *"We couldn't activate your account"* with Try again / Sign out. **But the page still exists, and a transient *"Activating your account…"* still renders while healing.** He asked for deletion; he got a rewrite that arguably meets his own conditional |
| **CR-54** | DO — investigation first | ✅ **INVESTIGATION NOW COMPLETE. FIX NOT DONE** | ⚠️ **The hypothesis is CONFIRMED EXACTLY.** `DocumentsContent.tsx` renders the same executed documents **twice**: `:455` `[...awaiting, ...sealed]` via `SelfSignRow` (knows `party_role` — *"You sign as client"*), and `:481` `executedRows` from `myDocuments()` (knows `signed_at` — *"Signed · date"*). **`signableById` at `:429` exists purely to bridge them, which proves the author knew they overlap.** Two components, two shapes, one set of documents |
| **CR-56** | DO — remove the text | ⚠️ **NOT DONE** | `DocumentsContent.tsx:452` still renders *"Contracts you've signed"* |
| **CR-64** | DO — delete the onboarding liar page | ⚠️ **NOT DONE** | `Onboarding.tsx:927-929` still renders *"Nothing to do here."* / *"You're all squared away — there's no onboarding waiting on you."* |
| **CR-65** | DO — the exit-map sweep | ⚠️ **NOT STARTED** | No exit-map document exists in `docs/reports/` or `docs/reference/`. **The deliverable he specified — one table across ten flows — has never been produced** |
| **CR-68a** | DO — outside-click destroys input | ✅ **SHIPPED** | `TASK-FIX4`/`MODAL2`: the shared `Modal` kit now asks whether the dialog holds a field and **ignores the backdrop click if it does** (`Modal.tsx:52,194`). Fixed at the component level, as the verdict required |
| **CR-68b** | DO — two location fields, delete the outdoor line | ⚠️ **NOT DONE** | `HorseIntakeForm.tsx:435` still reads *"Barn (blank if outdoor)"* |
| **CR-68c** | DO — placeholder text | ⚠️ **NOT DONE** | The exact string he gave is not in `HorseIntakeForm.tsx` |
| **CR-69** | DO — remove euthanasia, add photo upload | ⚠️ **NOT DONE** | The block is still in `HorseIntakeForm.tsx` — and that file is the **one shared component** behind both the account page and the contract path |
| **CR-70a** | DO — verify remove works, double-gated | ⚠️ **PARTIAL** | `HorseRecordsPage.tsx:134-136` **archives rather than deletes** (D11). ⚠️ **That is a better answer than the triage's** — the triage argued hard delete justifies the friction; D11 says nothing is purged. **The two are unreconciled and it is a one-word ruling** |
| **CR-70b-storage** | DO — set types and limits | ⚠️ **NOT DONE — UNCHANGED SINCE ORCH5 MEASURED IT** | **12 buckets. All 12 accept ANY MIME type. 11 have no size limit. `feed-media` and `profile-images` are PUBLIC. `profile-images` is public, any type, no limit** |
| **CR-73** | DO after two checks | ✅ **APPEARS DONE** | No *"I have reviewed the horse information"* string in `src`, and **no matching row in `contract_field_defs`** |
| **CR-76-faults** | DO — bind the select, write codes, **reconcile the case** | ⚠️ **HALF DONE — and the unfixed half is the data** | ✅ The writer is fixed: `OrdersContent.tsx:29` now offers exactly `zelle`/`cash` as lowercase values with capitalised labels. ⚠️ **The reconciliation never happened:** production still holds **`zelle` ×9, `Zelle` ×3, `cash` ×1, NULL ×4.** **Three rows written by the old dropdown are still miscased** |

**DO lane score: 3 done (CR-68a, CR-73, and CR-76-faults' code half) · 2 partial (CR-52, CR-70a) ·
10 not started.**

## 4b · G1 Calendar — CR-94's own pass 6

| CR | Triage | State on 2026-09-01 |
|---|---|---|
| **CR-01** | KEEP | ⚠️ **Unchanged.** `CalendarPage.tsx` (1,461 lines) still hosts `CalendarItemPanel` (966 lines) directly, so nothing else can open an item |
| **CR-03** | KEEP — *"92% of the bookings table is furniture"* | ⚠️ **Now 83.4% — and that is not progress.** 594 of 712 rows are generated slots. The share fell because **real bookings grew**, not because furniture was removed. ⚠️ **The generator is STILL RUNNING: 72 new slots in the last 7 days, newest `2026-08-31 00:50`.** The number the build must remove keeps growing while the item waits |
| **CR-05** | KEEP — prerequisite to CR-07 | ⚠️ **Unchanged.** `offerings` has 23 columns and **no `duration_minutes`.** ✅ **CR-05, not CR-03, is the true head of the calendar chain** |
| **CR-06** | KEEP — decommission the toggle | ✅ **SHIPPED, UNCREDITED.** No `three-position`/`toggleAvailability` match anywhere; `CalendarItemPanel.tsx:46` now carries `ItemType = 'unavailable' \| 'offering' \| 'appointment'`. ⚠️ **What CR-06 protected still stands** — the third position was how availability got published, and 594 rows say that mechanism is untouched |
| **CR-07** | KEEP — 30-min clash-aware picker | ⚠️ **Not built.** `CalendarItemPanel.tsx:551,555` are two free-form `<input type="datetime-local">` — **exactly the condition that produced CR-02** |

---

# 5 · WHERE THE TRIAGE OR THE LEDGER WAS WRONG — four corrections

⚠️ **Per DISO-ROLE §5.6: an unwritten correction is how a wrong premise reaches a build thread.**
**None of these came from the owner — DISCO-1 had no conversation with him. All four are DISO
correcting an inherited document against production.**

1. ⚠️ **CR-94's measured table names the wrong file.** *"The client record's Orders tab"* is
   `OrdersContent.tsx`, **the member's own My Orders**. The staff record is `ContactDossierModal.tsx`.
   **The defect is real; the address was wrong.**
2. ⚠️ **CR-02 is one bad booking, not two.** `BKG-000349` is correct and would have been "fixed".
3. ⚠️ **CR-04 is not a one-line fix.** The staff payload carries no client name and no offering name,
   only UUIDs. The triage's verdict promises more than the read delivers.
4. ⚠️ **CR-03's 92% is now 83.4%, and the direction is misleading.** Furniture is still being
   generated weekly; only the denominator moved.

**And one correction the repo has already absorbed:** ORCH5's audit note that the DO lane is
**fifteen** items, not fourteen, is correct and is used above.

---

# 6 · ⚠️ ASK-OWNER — WHAT STEP 3 OPENS WITH

**Ordered most-blocking first, so his answers cascade. Nothing here is answered by the code —
each was checked first.**

1. ⚠️ **THE SEQUENCE.** The backfill (pass 5) cannot record a real date for an order or a payment,
   and passes 1 and 3 both depend on those dates being right. **Does pass 5 move to the front, or do
   passes 1-2 ship first and the backfill wait?** *(This is the only question that changes what ORCH
   specs next. Everything else can proceed either way.)*
2. **CR-70a — hard delete or archive?** The triage ruled *"hard delete is irreversible, so
   confirmation is exactly where friction belongs."* **The code archives instead, per D11.**
   **D11 looks right and the triage looks stale — but it is his ruling either way.**
3. **CR-52 — is the rewrite enough?** He asked for the page **deleted**. He got an honest page with a
   real next step, plus a transient *"Activating your account…"*. **His own words allowed a page that
   *"provides a valid useful accurate error message"* — so this may already be satisfied.**
4. **CR-76-faults — the three miscased rows.** The writer is fixed. **Reconciling three production
   rows is a one-row-at-a-time correction on live payment records; per the standing rule on live
   documents, it is his decision, not a thread's.**
5. **Carried, unanswered, from CR-96:** ⚠️ **is there a `DSGN` role, or is step 4 formally ORCH's
   spec?** Every TASK thread to date has been a build thread. **This is still open and DISCO-1 did not
   touch it.**

---

# 7 · WHAT WAS ASKED AND ANSWERED — ⚠️ ORCH MUST NOT RE-ASK THESE

| Question | Answer | Where |
|---|---|---|
| Does ANY scheduled job run in production? (CR-94 pass 4) | ✅ **YES.** `pg_cron` absent, but five Vercel crons are declared and `calendar-reminders` has written 5 rows, latest 2026-08-30 | §3 pass 4 |
| Have comps been recorded as paid, making revenue wrong today? (CR-39) | ✅ **NO — zero comps to date.** No historical figure is wrong. The *first* comp is the one that breaks it | §3 pass 1 |
| Are comp / discount / price-override one mechanism? (CR-39/40/16) | ✅ **YES, confirmed as fact.** A line holds one price and the schema has no discount, comp or write-down anywhere | §3 pass 1 |
| Do `pending` / `confirmed` booking states need building? (CR-28/60/90) | ✅ **NO.** Already legal in `bookings_status_check`; nine of twelve states have never been written. **`skipped` is the one real gap** | §3 pass 3 |
| Is `current_date + 90` in more than one place? (CR-90) | ✅ **NO.** One line in `_ensure_plan_horizon` | §3 pass 3 |
| Was CR-54's "two components, two shapes" hypothesis right? | ✅ **YES, exactly.** Both lists render the same executed documents; `signableById` bridges them | §4a |
| Can bookings be backdated for the data pass? | ✅ **YES** — the only one of the owner's four legs that works today | §2 |

---

# 8 · DISCO-1 SELF-ASSESSMENT — where this handoff leaves ORCH guessing

⚠️ **DISO-ROLE §5: *"If DISO's handoff leaves ORCH guessing, DISO failed — and ORCH says so rather
than filling the gap silently."* Three places it does:**

1. ⚠️ **No step 3 happened, so there are no VALIDATION CRITERIA agreed with the owner** — and
   DISO-ROLE §4 makes those the point of the exercise. **ORCH cannot supply them and should not
   invent them.** They come from the conversation ASK-OWNER 1 opens.
2. ⚠️ **G2, G3, G4, G6, G7 and G9 of the triage were not re-measured.** The reconciliation in §4 is
   complete for the DO lane and G1 only. **A second DISO pass is needed to close the other six
   groups, or the owner rules that only the DO lane and CR-94's unit matter now.**
3. **Pass 6's remaining scope is unbounded.** CR-94 says the calendar items are *"CR-02, CR-07,
   CR-04, and the rest of the DO list, ⚠️ which the owner has since widened beyond the original
   14."* **What he widened it to was not captured, and DISCO-1 could not find it written down.**

---

# 9 · TEARDOWN

**Processes started: none.** No dev server, no build, no test run, no background job. `psql` invoked
12 times, each exiting on completion. **No worktree. No write to production. No migration. Nothing
staged, nothing committed.** Two files written, both new:
`docs/reports/DISCO-1-LEDGER.md` · `docs/reports/DISCO-1-HANDOFF.md`.
