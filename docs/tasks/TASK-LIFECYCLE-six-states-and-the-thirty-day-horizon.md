# TASK-LIFECYCLE — the booking is six states, and the schedule is 30 days plus 30 pending

**Authored 2026-09-01 by `DSGN-1`** from `CR-97` + `CR-90` (`docs/reference/CHANGE-ORDER-LEDGER.md`
:3642, :3966) and `docs/reports/DISCO-1-HANDOFF.md` §3 pass 3.
⚠️ **Read `docs/method/TASK-ROLE.md` first — the standing requirements are there, not here.**

🔒 **CR-90 AND CR-97 ARE ONE TASK, AND THAT IS AN ARCHITECTURE DECISION, NOT A SCHEDULING ONE.**
The ledger says it outright (`:4035`): *"This IS `CR-90`'s 'pending until payment is confirmed.'
Same machine."* **The rolling 30-day schedule is this lifecycle applied a month at a time.** Two specs
would each have had to define what `pending` means, and they would have disagreed.

---

## 1 · THE OWNER'S WORDS

**On the states (2026-09-01):**
> *"I noticed the booking system is failing in a weird way, the stages/status dont function, a block
> is either booked or open. it should have at least, requested, approved, pending, scheduled, moved,
> cancelled."*

> *"moved is the status of a rescheduled booking (shown only to company and user who it belongs to),
> for anyone else it shows as empty and available. cancelled is the status for an order that was
> cancelled by staff or client, it shows as cancelled to both parties and open and available to
> everyone else."*

**On the horizon (2026-08-31), on finding Madeline Do booked through 30 November:**
> *"Why did you set 90 days worth when the directive ive instructed is that the schedule should be set
> every 30 days with the next 30 days shown as pending until payment is confirmed… Once they confirm
> their payment to us we confirm it was received and the pending bookings for the month flip to booked
> or confirmed or whatever term we use internally for that status."*

**On the hold, answering the reschedule collision (2026-09-01):**
> *"a held slot isnt empty and available until the new booking is approved then the hold is released."*
> *"to everyone else it can show as pending reschedule, to indicate its likely to open up."*

**On what a calendar shows at all (2026-09-01):**
> *"the calendar is only going to show unavailble timeslots with something in them all other calendar
> space is just empty which means its available."*

---

## 2 · WHAT WAS MEASURED — 2026-09-01, every number with its query

**⚠️ Re-run these yourself. They are DSGN's, not DISO's, and they already caught one wrong answer.**

**a · What is ever written to `bookings.status`:**
```sql
select status, count(*) from bookings group by 1 order by 2 desc;
```
→ `available` **594** · `scheduled` **117** · `cancelled` **6** · `completed` **1**.
**Four of twelve legal values. Two of them are 99% of the table** — the owner's *"either booked or
open"*, exactly.

**b · What the constraint already permits:**
```sql
select pg_get_constraintdef(oid) from pg_constraint where conname='bookings_status_check';
```
→ twelve: `draft available unavailable pending pending_slot pending_payment confirmed cancelled
expired completed scheduled no_show`.
✅ **`pending` and `cancelled` are already legal.** ⚠️ **`approved` and `moved` are NOT — the
constraint must be widened for exactly two values, and no others.**

**c · The horizon, and where it actually lives:**
```sql
select proname, (regexp_matches(prosrc,'.{0,70}current_date\s*\+\s*90.{0,40}','g'))[1]
from pg_proc where pronamespace='public'::regnamespace and prosrc ~ 'current_date\s*\+\s*90';
```
→ ⚠️ **THREE functions, not one:**
| function | the line | why it matters |
|---|---|---|
| `_ensure_plan_horizon` | `v_through date := coalesce(p_through, current_date + 90)` | a **default** |
| `ensure_standing_slots` | `v_target date := current_date + 90` → passed as `p_through` | **overrides the default** |
| `mint_recurring_allotments` | `v_target date := current_date + 90` → passed as `p_through` | **overrides it, and runs daily on cron** |

**d · What is already scheduled past the ruled window:**
```sql
select count(*) filter (where starts_at < now()+interval '30 days'),
       count(*) filter (where starts_at >= now()+interval '30 days' and starts_at < now()+interval '60 days'),
       count(*) filter (where starts_at >= now()+interval '60 days'), max(starts_at)::date
from bookings where status='scheduled' and starts_at > now();
```
→ **23 inside 30 days · 21 in days 30–60 · 22 beyond 60 · latest `2026-11-30`.**
⚠️ **43 sessions are held beyond 30+30 today, all `scheduled`, none `pending`.**

---

## 3 · ⚠️ THE INCUMBENTS, NAMED (D18) — THIS IS A CONVERGENCE, NOT A GREENFIELD

**Almost everything this task needs already exists. Naming it is most of the design.**

| What CR-97/CR-90 asks for | The incumbent | Verdict |
|---|---|---|
| a **viewer-scoped read** of a booking | ⚠️ **`calendar_free_busy` ALREADY IS ONE** — a four-branch `CASE`: staff → full detail · `b.client_id = v_client` → full detail · flexible+`available` → bookable · **`ELSE` → opaque `{status:'unavailable'}` with travel folded in** | 🔒 **CONVERGE. Do NOT write a second read.** The shape the owner described is already the shape of this function |
| the **move** machine | **`booking_change_requests`** (22 cols) + **`request_booking_change`** + **`decide_booking_change`** — already direction-aware via `awaiting_client`, already refunds a credit on decline, already notifies both sides | 🔒 **CONVERGE.** `moved` is a state ON this machine, not a new one beside it |
| the **payment request** that `approved` fires | **`request_purchase_payment(p_purchase_id, p_note)`** → `/api/order-request-payment` → `sendPaymentRequest` — staff-only, writes the order timeline, logs one send | 🔒 **CONVERGE. This is also CR-90's "invoice"** — see `TASK-MONTHEND` |
| collapsing many statuses to a few | **`booking_status_code(p_status)`** — 12 → 4 (`completed`/`cancelled`/`pending`/`scheduled`), consumed by **`trg_status_bookings`** | 🔒 **CONVERGE — and see Trap 2, it has a silent `ELSE`** |
| the **30-day horizon** | `_ensure_plan_horizon` + its two callers *(§2c)* | 🔒 **CONVERGE, at all three sites** |
| a **waitlist** | ⚠️ **NOTHING.** `to_regclass('public.waitlist')` is NULL; no `waitlist` in `src` or the migrations | ⚠️ **GREENFIELD — AND OUT OF SCOPE. See §5** |

---

## 4 · ⚠️ THE TRAPS — this is the part that earns the spec

**1 · 🔒 FIXING `_ensure_plan_horizon`'s DEFAULT CHANGES NOTHING.**
**Both callers pass `p_through` explicitly**, so the `coalesce` default is dead code from their point
of view. ⚠️ **And `mint_recurring_allotments` is wired to the live `/api/mint-monthly-allotments`
cron** (`.github/workflows/scheduled-jobs.yml`, `20 8 * * *`, running — proven), **so a fix that
misses it is silently undone every single morning.** **All three sites, or none.**
⚠️ **`docs/reports/DISCO-1-HANDOFF.md` §7 states the opposite** — *"Is `current_date + 90` in more than
one place? ✅ NO. One line."* **That answer is wrong and is corrected here.** Do not trust it.

**2 · `booking_status_code` ends `ELSE 'pending'`.**
⚠️ **A new status you have not taught it — `approved`, `moved` — falls silently into `'pending'`**,
and `trg_status_bookings` writes that into `status_events`. **The row looks right and the timeline
lies.** **Teach it both new states explicitly, and decide deliberately which code `moved` collapses
to** *(it is not `cancelled`: the slot is still held)*.

**3 · `calendar_free_busy` hides `cancelled` from EVERYONE, including the parties.**
Its `WHERE` carries `AND b.status NOT IN ('cancelled','expired')`. **The owner's rule is that
cancelled shows AS CANCELLED to both parties and as nothing to everyone else.**
🔒 **So the filter must move OUT of the `WHERE` and INTO the `CASE`** — otherwise the parties cannot
see their own cancellation. ⚠️ **This changes what real users see today. That is the point of the
change, not a regression** — say so in the report.

**4 · Do NOT touch the `available` renderer. It is a different, already-blocked item.**
`CalendarPage.tsx:130` returns `'Open'` for `status==='available'` and `:120` carries an `Available`
legend row, over the 594 generated rows. **CR-97's *"do not build an available-state renderer"* is a
rule about what `cancelled` and a released `moved` become — it is NOT authority to delete the
availability publishing mechanism.** ⚠️ **That is the CR-03/CR-06 inversion, and `RUN-QUEUE.md` §9
item 9 records it as BLOCKED** — *"neither `request_open_time` nor `confirm_booking` debits a credit,
so the request path books for free."* **Removing the chip would remove the request path's only entry
point while it is still free.** **Out of scope. See §5, and the ASK-OWNER in the DSGN handoff.**

**5 · Three names for one idea: `pending` · `pending_slot` · `pending_payment`.**
Six live functions test the triple together — `booking_status_code`, `my_lesson_sessions`,
`calendar_money_items`, `confirm_booking`, `confirm_booking_for_purchase`, `booking_form_applies`.
⚠️ **`pending_slot` is the column DEFAULT and has never once been written.** **Resolve to ONE name —
the owner said `pending` — and update every one of the six in the same change.** ⚠️ **Leaving a
second spelling alive is precisely the D18 failure this repo keeps paying for.**
🔒 **Retire the surplus names from the CHECK only after proving zero rows carry them** (measured:
zero today). **Retiring a value is not deleting data** (D32 is not engaged).

**6 · 🔒 `pending` MUST NOT GATE BOOKING (D23/D24).**
*"nothing blocks them from any action because the lesson never happens without payment being
verified."* ⚠️ **A `pending` month is VISIBLE, not withheld.** **The client keeps their standing
slot while payment is unconfirmed** — D24 ruled exactly this and calls the opposite *"precisely the
block the owner ruled out."* **A build that makes `pending` mean "cannot book" has inverted the
ruling.**

**7 · A recurring plan's entitlement is the SLOT, not a spendable credit (D23 corollary).**
*"mint into eternity the weekly schedule and its gated on did they pay at the staff fullfilment
level."* ⚠️ **`_ensure_plan_horizon` mints credits per month AND generates the month's bookings.**
**Shrinking the horizon shrinks both.** **A recurring allotment row with `remaining = 0` is CORRECT
and an orchestrator has already been corrected for reporting it as a defect. Do not report it again.**

**8 · The 43 sessions already beyond the window are NOT yours to delete.**
⚠️ **D32: nothing is ever removed from the database.** 🔒 **DSGN'S RULING: this task changes what is
GENERATED from now on. It does not retro-withdraw existing rows.** **Report the exact count that sits
beyond 30+30 after your change, and stop there** — what to do with Madeline's already-confirmed
November is the owner's money and the owner's client, and it is an ASK-OWNER in the DSGN handoff.

**9 · `TASK-BACKDATE` and `TASK-BOOKS1` land first, and both are unmerged right now.**
CR-97 §Dependencies: *"`CR-89`'s payment disposition decides what 'paid' means, and `TASK-BACKDATE`
decides what date it happened on. Both land first."* ⚠️ **Measured 2026-09-01: `task/backdate` is at
`a8279916` in `wt-1` and `task/books1` at `43cc7bd5` in `wt-books1` — built, not merged.**
**`TASK-BACKDATE` owns `mark_purchase_paid`; `TASK-BOOKS1` owns `revenue_summary` and the disposition.
You own neither.**

**10 · `CREATE OR REPLACE` re-grants `anon` and `authenticated` by default.**
The standing trap in this repo *(`fhe-revoke-from-public-is-not-enough`)*. ⚠️ **Paste
`pg_proc.proacl` before and after for every function you replace.**

---

## 5 · WHAT IS OUT OF SCOPE — explicitly

- ⚠️ **THE WAITLIST.** CR-97 rules a `Pending reschedule` slot is waitlistable, **and its own
  ASK-OWNER on what happens when the hold releases is UNANSWERED** — three shapes the ledger itself
  calls *"different products"*. **Do not build one. Do not stub one.** Render the label; the label is
  in scope, the queue behind it is not.
- ⚠️ **The `available`/`Open` renderer and the 594 generated rows** — Trap 4. CR-03/CR-06, blocked.
- **The invoice and the two month-end emails** — `TASK-MONTHEND`, which merges after this.
- **`revenue_summary`, `mark_purchase_paid`, the disposition model** — BOOKS1 and BACKDATE.
- **`CalendarPage.tsx`'s 1,461-line decomposition (CR-01)** and the 30-minute picker (CR-07).
- **The owner's own data entry** (D30). This makes the rule true going forward; it does not backfill.

---

## 6 · 🔒 THE SHAPE — ⚠️ THIS NEEDS THE OWNER'S EYES BEFORE A BUILD THREAD STARTS

**Per `DSGN-ROLE.md` §4: new states visible to a user, and one new label.** **The table below is the
owner's own ruling transcribed** (`CHANGE-ORDER-LEDGER.md:4080-4092`) — **it is not a fresh proposal**
— but the RENDERING of it is new and he has not seen it.

| State | The parties see | ⚠️ Everyone else sees |
|---|---|---|
| `requested` · `approved` · `pending` · `scheduled` | the real state | **a block — `Booked` / `Unavailable`** |
| `completed` · `no_show` | the real state | **a block — `Booked` / `Unavailable`** |
| `cancelled` | **cancelled** | ⚠️ **nothing — the slot renders empty** |
| `moved`, new time NOT yet approved | **moved** | ⚠️ **`Pending reschedule`** — occupied, signalling it may open |
| `moved`, new time approved | **moved** | ⚠️ **nothing — the hold releases, slot renders empty** |

**The transitions, as he specified them:**

| State | Entered when | Skipped when |
|---|---|---|
| **requested** | an order is created with a date/time chosen · a user MOVES an item · a credit-holder picks a time | — |
| **approved** | staff mark a requested booking approved. ⚠️ **fires `request_purchase_payment` on an unpaid order** | already paid · user has credits · rescheduled paid order |
| **pending** | the client declares a payment method on an unpaid order | already paid |
| **scheduled** | a PAID, approved booking at the time shown | — |
| **moved** | rescheduled; ⚠️ **the OLD slot is HELD until the new time is approved, then released** | — |
| **cancelled** | staff or client cancelled | — |

**The empty case:** no items in range → the calendar renders empty space. ⚠️ **Empty IS available —
there is no "available" chip to render** *(and no existing one is removed, per Trap 4)*.
**The error case:** a transition the caller may not fire raises, and the surface shows the database's
own message. ⚠️ **`decide_booking_change` already establishes this idiom — follow it, do not invent
a second error vocabulary.**

**`Pending reschedule` is the ONE new label.** `CalendarPage.tsx:119-125` already carries a five-row
`LEGEND` (`Available`, `Booked`, `Pending`, `Draft / notice`, `Unavailable`).
⚠️ **A sixth colour with no legend row is a colour nobody can read — the legend entry ships with it.**

---

## 7 · THE REACH (D17)

⚠️ **Answer each with file and line in the report. "It exists in the database" is not an answer.**
1. **A staff member marks a `requested` booking `approved` — what do they click, from which page?**
   ⚠️ **If no surface can do it, the state machine is unreachable and the task is not done.**
   `open_change_requests` and `decide_booking_change` already have a queue — **establish whether it
   is the right home before building a second one.**
2. **A client sees their booking is `pending` — where, and what does it tell them to do?**
3. **An outsider looking at a held slot sees `Pending reschedule` — on which view(s)?**
   ⚠️ **Week AND month.** *(`CalendarPage.tsx:624` records that month view already truncates to three
   items per day — say whether the label survives that.)*

## 8 · THE TELL (D19)

- **Every transition writes a `status_events` row** through the existing trigger — ⚠️ **and Trap 2
  means you must prove the row carries the RIGHT code, not just that a row exists.**
- **`approved` on an unpaid order says on screen that a payment request was sent, before it sends.**
- **A move says what it is holding and until when.**
- ⚠️ **Every one of these is reversible** — name, for each new transition, what undoes it.

## 9 · THE TEST THIS MUST PASS

**Numbered, provable, pasted. Built from the owner's rulings, not from your idea of done.**

1. **`bookings_status_check` permits `approved` and `moved`** — and still refuses a typo. Paste both.
2. ⚠️ **All THREE 90-day sites are gone.** Re-run §2c's query and paste the empty result.
3. ⚠️ **A recurring plan generates ONE confirmed month plus ONE pending month, and NOTHING beyond.**
   Rehearse in `BEGIN; … ROLLBACK;` on a real plan; paste the months and their statuses.
4. ⚠️ **`mint_recurring_allotments()` run twice in a row does not extend past the pending month.**
   **This is the cron. Prove it, because it is the one that undoes the fix daily.**
5. **Confirming payment flips that month's `pending` bookings to `scheduled`/`confirmed`** — and
   touches no other month. Paste before and after.
6. ⚠️ **`pending` does NOT block booking (D23/D24).** A client with a `pending` month books. Prove it.
7. **The viewer-scoped read, proven from THREE identities on the same slot** — the owner, the other
   party, and an unrelated client. ⚠️ **Paste all three payloads for `cancelled` and for `moved`.**
   **A UI-only difference fails this test** — the leak must be closed in `calendar_free_busy`.
8. **A cancelled booking is visible to its parties** *(it is not today — Trap 3)* **and absent for
   everyone else.**
9. **A held `moved` slot is NOT bookable by an outsider** — attempt it and paste the refusal.
10. **On approval of the new time the hold releases** and the old slot goes empty for outsiders.
11. ⚠️ **`booking_status_code` returns a deliberate code for `approved` and `moved`** — not the
    `ELSE` fallthrough. Paste the mapping and one `status_events` row per new state.
12. **`approved` on an unpaid order fires `request_purchase_payment`; on a paid one it does not.**
    Prove both.
13. ⚠️ **The count of sessions still beyond 30+30**, stated plainly (Trap 8). **Do not change them.**
14. **`pg_proc.proacl` before and after for every replaced function** (Trap 10).
15. `typecheck` · `typecheck:api` · **lint ≤ 46** · `build`.
16. ⚠️ **Renders NOT VERIFIED by you** — an owner checklist naming the phone, the week view and the
    month view.

## 10 · WHERE THE REPORT GOES
`docs/reports/TASK-LIFECYCLE-REPORT.md`. ⚠️ **ORCH appends its `## VALIDATION` block to it.**
⚠️ **A gap found in this build returns to `DSGN`, not to you and not to ORCH** (`DSGN-ROLE.md` §1).
