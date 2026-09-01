# DSGN-1 → ORCH · HANDOFF

**Thread:** `DSGN-1` · **Closed** 2026-09-01 · **Role:** `docs/method/DSGN-ROLE.md`
**Working record:** `docs/reports/DSGN-1-LEDGER.md`
**Assignment:** prepare `CR-90` and `CR-97` for build from `docs/reports/DISO-1-HANDOFF.md`.

**Delivered — two specs:**
- `docs/tasks/TASK-LIFECYCLE-six-states-and-the-thirty-day-horizon.md`
- `docs/tasks/TASK-MONTHEND-the-invoice-the-reminder-and-the-deliberate-override.md`

---

# 0 · ⚠️ WHY I DID NOT STOP, THOUGH DISO-1 TOLD YOU I SHOULD

**`DISO-1-HANDOFF.md` §0 says *"DO NOT AUTHOR PASS 1 OR PASS 3 SPECS FROM THIS DOCUMENT ALONE"* and
§8 says no validation criteria exist because step 3 never ran.** ⚠️ **`DSGN-ROLE.md` §2 says that if
step 3 never ran I must name what is missing and hand it back.** **I am proceeding anyway, and this
is the justification — check it before you accept the specs.**

**Step 3 DID run, after DISO-1 closed.** Seven commits later the same day (`9b3fe0ab`, `98ecec05`,
`afa5cf94`, `95818364`, `7b5d37f8`, `8d79bd0c`, `5f1a0446`, plus `9def8e3c` for CR-90) wrote the
owner's answers into `docs/reference/CHANGE-ORDER-LEDGER.md` as 🔒 RULED text — the hold behaviour,
the display collision, the read rule, `Pending reschedule`, the waitlist signal.
🔒 **Those rulings ARE the validation criteria** — his words, decided, in the canonical ledger — and
`TASK-LIFECYCLE` §9 is built from them rather than from my idea of done.
**And `DSGN-ROLE.md` itself (`7b7b1316`, written after the handoff) names CR-90 + CR-97 as its worked
example of one chunk**, which is ORCH6 transmitting the same decision.

⚠️ **DISO's §0 warning is therefore STALE, not wrong when written.** **If you disagree that the
ledger rulings are sufficient, stop me here** — that is your call, not mine.

---

# 1 · THE CHUNKS, IN DEPENDENCY ORDER

## ⚠️ FIRST — WHAT MUST MERGE BEFORE EITHER OF THEM

**Both chunks sit behind two builds that are FINISHED BUT UNMERGED as of 2026-09-01:**

| Branch | Worktree | Head | Why it blocks |
|---|---|---|---|
| `task/backdate` | `wt-1` | `a8279916` | owns `mark_purchase_paid` + settlement; CR-97 names it as landing first |
| `task/books1` | `wt-books1` | `43cc7bd5` | owns `revenue_summary` and **what "paid" means** — `TASK-MONTHEND` must not re-derive it |

⚠️ **CR-97's own dependency note is explicit: *"`CR-89`'s payment disposition decides what 'paid'
means, and `TASK-BACKDATE` decides what date it happened on. Both land first."*** **And it adds:
*"`TASK-BACKDATE` is live and touches settlement. Do not run this beside it."***
⚠️ **The two have already collided once** — `e0dc0090` *"patch `mark_purchase_paid` in place, not
over BOOKS1"*. **A third writer on that function at the same time is the failure mode to avoid.**

## ▶ CHUNK 1 · `TASK-LIFECYCLE` — the six states and the 30+30 horizon

**Owns:** `bookings_status_check` · `calendar_free_busy` · `booking_status_code` ·
`_ensure_plan_horizon` · `ensure_standing_slots` · `mint_recurring_allotments` ·
`request_booking_change` / `decide_booking_change` / `book_open_slot` / `confirm_booking` and the
other status-writing seams · `CalendarPage.tsx` · `CalendarItemPanel.tsx`.

**Must NOT touch:** `mark_purchase_paid` · `revenue_summary` · `attach_offerings_to_client`
*(BACKDATE / BOOKS1)* · `ops/kit/Modal.tsx` *(MODAL2)* · `AppLayout.tsx` / `pageRegistry.ts` *(CR85)*
· `api/expire-holds.ts` *(REAPER)* · **the waitlist** · **the `available`/`Open` renderer**.

**Merges after:** `TASK-BACKDATE`, `TASK-BOOKS1`.

### ⚠️ WHY THIS IS ONE CHUNK AND NOT TWO
**The horizon cannot be specced apart from what `pending` means.** CR-90's *"30 days confirmed +
30 pending"* and CR-97's `pending` state are **the same value in the same column**. Two threads would
each have defined it, and the second would have found the first's definition already in the table.
🔒 **The ledger says it outright (`:4035`): *"Same machine."*** **Splitting it is exactly the drift
`DSGN-ROLE.md` §1 puts the chunking decision in one role to prevent.**

## ▶ CHUNK 2 · `TASK-MONTHEND` — the invoice, the reminder, and the D9 override

**Owns:** `.github/workflows/scheduled-jobs.yml` · a new `api/` endpoint · the scheduled caller and
its date rule · `request_purchase_payment`'s **caller gate only** · `api/_lib/paymentRequest.ts`'s
header comment · the two email bodies.

**Must NOT touch:** anything in Chunk 1's list · `mint_recurring_allotments` · `bookings` at all.
⚠️ **This chunk sends mail. It does not move a booking.**

**Merges after:** `TASK-LIFECYCLE` *(it needs `pending` to mean something)*, and after `TASK-BOOKS1`
*(it must read BOOKS1's answer for "unpaid", not invent one)*.

### ⚠️ WHY THIS IS A SECOND CHUNK AND NOT PART OF THE FIRST
**It is a CONSUMER of the machine, not part of it.** It fires transitions the first chunk defines;
it defines none. **It is also the only half with an outward-facing, irreversible act — email to real
clients — and a deliberate override of a settled decision (D9).** **That deserves its own report
section and its own review, which a single merged chunk would have buried.**
⚠️ **Chunk 1 is validatable without it** *(the horizon and the states are provable in SQL)*, **and
Chunk 2 is not validatable without Chunk 1** — which is the dependency direction, not a reason to
merge them.

---

# 2 · ⚠️ THE CONTENTION I CAN SEE — you resolve it, I cannot see what is running

**Live worktrees measured 2026-09-01** *(`git worktree list`)*: `wt-1` task/backdate · `wt-2`
task/modal2 · `wt-3` task/reaper · `wt-books1` · `wt-cr85`. ⚠️ **`RUN-QUEUE.md:17` still claims
"Worktrees: NONE LIVE" — that line is stale and will mislead the next thread.**

| File / function | Chunk 1 | Chunk 2 | Also claimed by | Resolution I suggest |
|---|---|---|---|---|
| **`request_purchase_payment`** | ✅ **calls** it when `approved` fires | ✅ **widens its caller gate** to `service_role` | — | ⚠️ **The one genuine collision between MY two chunks.** Chunk 1 calls it as staff and needs no change; **Chunk 2 owns the gate.** Sequencing solves it — **but if you run them in parallel, they will both open this function** |
| `mark_purchase_paid` / settlement | reads the result *(the flip)* | reads "paid" | **BACKDATE, BOOKS1** | 🔒 **Neither of my chunks may write it.** Both specs say so |
| `.github/workflows/scheduled-jobs.yml` | — | ✅ owns | **REAPER** touches `api/expire-holds.ts` only, per its FILES section | **No overlap, but confirm REAPER stayed inside its FILES list before merging Chunk 2** |
| `CalendarPage.tsx` / `CalendarItemPanel.tsx` | ✅ owns | — | **CR85** owns `AppLayout.tsx` + `pageRegistry.ts`, not these | **Clear — but CR85 is the most contended file pair in the repo; merge it first regardless** |
| `ContactDossierModal.tsx` | possibly, for THE REACH §7.1 | — | ⚠️ **BACKDATE owns its Orders tab** | ⚠️ **Chunk 1 must find the approval surface AFTER BACKDATE merges**, or it will design against a screen that is about to change |

---

# 3 · MODEL AND EFFORT — a recommendation; you decide

| Chunk | Recommendation | Why |
|---|---|---|
| **`TASK-LIFECYCLE`** | ⚠️ **Opus · thinking ON · effort HIGH — and MAX is defensible** | A state machine spanning ~20 status-writing functions, a viewer-scoped read that must not leak, and three horizon sites where fixing the obvious one does nothing. **The failure mode is silent and user-visible** (one identity seeing another's cancelled booking). **MAX buys judgement under uncertainty, and the read-leak question is genuinely that** |
| **`TASK-MONTHEND`** | **Opus · thinking ON · effort HIGH** | Smaller in surface, **but it emails real clients and deliberately overrides a settled decision.** ⚠️ **Not Sonnet** — the D9 judgement and the UTC/Pacific month-boundary trap are exactly where breadth-without-judgement produces a confident wrong answer |

---

# 4 · ⚠️ ASK-OWNER — most-blocking first

1. ⚠️ **THE WAITLIST SHAPE — the only one that blocks a build I have NOT written.**
   CR-97 rules a `Pending reschedule` slot is waitlistable, then asks what happens the moment the
   hold releases, and **the ledger's own three options are different products**: **(a)** the slot
   opens and the waitlister is notified · **(b)** a first-refusal window before anyone else can take
   it · **(c)** it converts straight to a `requested` booking for them.
   **I have scoped the waitlist OUT of both chunks and specced the LABEL only.** ⚠️ **Nothing else
   waits on this** — but no waitlist can be built until he answers, and **(b) is the only shape that
   needs a timer**, so it is not a detail that can be retrofitted.

2. ⚠️ **THE 43 SESSIONS ALREADY BEYOND 30+30 — his money, his clients' calendars.**
   Measured: **23 inside 30 days · 21 in days 30–60 · 22 beyond 60, latest `2026-11-30`.**
   **Madeline Do's three confirmed unpaid months are the case that produced CR-90.**
   🔒 **I ruled that the build does NOT retro-withdraw them (D32), changes generation going forward
   only, and reports the count.** **That is the safe, additive default and it does not block.**
   **But leaving them leaves the defect he complained about**, so he should choose: **restate them
   as `pending` · leave them · withdraw them.**

3. ⚠️ **DOES *"AVAILABILITY IS THE ABSENCE OF A BLOCK"* MEAN DELETING THE 594 `Open` CHIPS NOW?**
   His ruling says *"Do not build an available-state renderer; today's 594 `available` rows are the
   schema's business, not the calendar's."* **Read literally, that deletes `CalendarPage.tsx:130`'s
   `'Open'` label and the `Available` legend row.**
   ⚠️ **I scoped it OUT**, because it is the **CR-03/CR-06 availability inversion**, which
   `RUN-QUEUE.md` §9 item 9 records as **BLOCKED** — *"neither `request_open_time` nor
   `confirm_booking` debits a credit, so the request path books for free"* — **so removing the chip
   removes the request path's only entry point while it is still free.**
   **I read his ruling as governing what `cancelled` and a released `moved` become, not as
   authority to decommission availability publishing. He should confirm.**

4. **THE D9 AMENDMENT.** CR-90 asks for a scheduled invoice and a scheduled overdue reminder.
   **D9 says there is no dunning email, and `api/_lib/paymentRequest.ts`'s header says
   *"NOT DUNNING (D9): nothing schedules this."*** 🔒 **I ruled CR-90 wins — newer, explicit, his own
   words — and required the build to flag it** (D24's rule for colliding decisions).
   ⚠️ **`CLAUDE.md`'s D9 needs amending to say so, and a build thread must not do that.** **It is the
   second narrowing of D9; D24 was the first.**

5. ⚠️ **NOT AN ASK — DISO's ASK-OWNER 1 IS RESOLVED BY EVENTS. Do not re-ask it.**
   DISO asked whether **pass 5 (the backfill) moves ahead of passes 1–3**. **It already did:**
   `TASK-BACKDATE` was specced (`61ec7f4b`) and built (`a8279916`) on 2026-09-01, ahead of both.
   **The question is answered by what was done.**

---

# 5 · ⚠️ WHAT I DECIDED THAT DISO DID NOT — deciding silently is the failure

1. **Two chunks, not one** — §1. DSGN-ROLE's worked example calls CR-90+CR-97 one chunk; **I split
   off the month-end cadence** because it is a consumer of the machine, it is the only outward-facing
   half, and it carries the D9 override. ⚠️ **The STATES and the HORIZON stay together, which is the
   part the worked example was actually protecting.**
2. ⚠️ **CORRECTION TO DISO — the 90-day horizon is in THREE functions, not one.** DISO §7 answers
   *"✅ NO. One line in `_ensure_plan_horizon`."* **Measured: `_ensure_plan_horizon` (a default),
   `ensure_standing_slots` and `mint_recurring_allotments` (both pass it explicitly, overriding the
   default).** 🔒 **A thread following DISO's answer would have changed a default nobody reads and
   proved nothing — and `mint_recurring_allotments` is on a DAILY cron, so it would have undone the
   fix every morning.** **This is the single most valuable thing DSGN-1 found.**
3. **CR-90's "invoice" is the EXISTING payment request, not a new object** — `request_purchase_payment`
   + `sendPaymentRequest` + the `payment_request_sends` ledger. **DISO reported *"No invoice is
   generated anywhere"*, which is true and reads as greenfield.** ⚠️ **It is a convergence** (D18).
4. **CR-97's viewer-scoped read has an incumbent** — `calendar_free_busy` is **already** a four-branch
   viewer-scoped `CASE`. **The build is two branches and moving one filter, not a new read.**
5. **`moved` converges on `booking_change_requests` / `decide_booking_change`**, which already carry
   a direction-aware approve/decline with `awaiting_client`. **Not a new mechanism.**
6. **The waitlist is OUT** (§4.1) · **the `available` renderer is OUT** (§4.3) · **the 43 existing
   sessions are NOT retro-deleted** (§4.2).
7. ⚠️ **I proceeded despite DISO's "do not author pass 3 specs from this document alone"** — §0.

---

# 6 · ⚠️ THE SHAPE THAT NEEDS THE OWNER'S EYES BEFORE A BUILD THREAD STARTS

🔒 **`TASK-LIFECYCLE` §6.** Per `DSGN-ROLE.md` §4, new states visible to a user and a new label
require the shape to be reviewed before build.

**What is in it:** the six states · what each of the three audiences sees for every state · the
transition table with its skip conditions · the empty case · the error case · and **`Pending
reschedule`, the one new label, with its legend row** beside the existing five
(`CalendarPage.tsx:119-125`).

⚠️ **The visibility table is his own ruling transcribed** (`CHANGE-ORDER-LEDGER.md:4080-4092`) —
**it is not a fresh proposal.** **What he has not seen is how it renders**: a sixth colour on a
five-row legend, and `cancelled` becoming visible to its parties for the first time.
**A month-view caveat is flagged in the spec** — `CalendarPage.tsx:624` records that month view
truncates to three items per day, **so a `Pending reschedule` chip may not survive it.**

---

# 7 · TEARDOWN

**Processes started: none.** No dev server, no build, no test run, no background job.
**No worktree opened. No write to production. No migration. Nothing staged, nothing pushed.**
`psql` invoked **14 times**, every one read-only (`select` only), each exiting on completion.

**Files written — FOUR, all new:**
1. `docs/reports/DSGN-1-LEDGER.md`
2. `docs/reports/DSGN-1-HANDOFF.md`
3. `docs/tasks/TASK-LIFECYCLE-six-states-and-the-thirty-day-horizon.md`
4. `docs/tasks/TASK-MONTHEND-the-invoice-the-reminder-and-the-deliberate-override.md`
