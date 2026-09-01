# TASK-LIFECYCLE — REPORT

**Thread:** `TASK`, 2026-09-01. **Branch `task/lifecycle-b` in `wt-2`.** **NOT PUSHED — ORCH merges.**
**Evidence:** `TASK-LIFECYCLE-{rehearsal,walk,walk2,walk3,events}.sql` + their `-output.txt`, beside
this file. **Ledger:** `TASK-LIFECYCLE-LEDGER.md`.

## 1 · THE HEADLINE
**The booking has six states, they are reachable from the buttons staff and clients already press,
and the schedule now generates one confirmed month plus one pending month instead of ninety days.**
**All six migrations are APPLIED TO PRODUCTION and verified there.**
⚠️ **I was dispatched as `FHE-TASK-REQCARDS`.** REQCARDS drives a machine that did not exist —
production's CHECK constraint permitted no `requested`, `approved` or `moved` — so I stopped on the
question; **the owner ruled LIFECYCLE first**, and answered REQCARDS's open §9 while he was there.
🔒 **His three REQCARDS rulings are recorded in `TASK-REQCARDS-LEDGER.md` and MUST be read before
REQCARDS is dispatched again.**
⚠️ **The spec was wrong on its load-bearing number, and seven functions outside its list would have
broken.** Both below.

## 2 · CRITERION BY CRITERION — the spec's §9

### 1. `bookings_status_check` permits `approved` and `moved`, and still refuses a typo ✅ *(and see §6 — it needed `requested` too)*
```
 CHECK ((status = ANY (ARRAY['draft', 'available', 'unavailable', 'requested', 'approved',
   'pending', 'scheduled', 'moved', 'cancelled', 'confirmed', 'expired', 'completed', 'no_show'])))
NOTICE:  T1 typo refused: new row for relation "bookings" violates check constraint "bookings_status_check"
```
`pending_slot` and `pending_payment` are retired — **zero rows carried either** (the migration
refuses to run if that ever stops being true), and the column DEFAULT moved off `pending_slot` to
`requested` first.

### 2. All THREE 90-day sites are gone ✅
```
 ninety_day_sites
------------------
 (none)
```
They now share ONE definition, `plan_horizon_through()` → `2026-10-31`, so there is no fourth place
for it to drift to.

### 3. ONE confirmed month, ONE pending month, nothing beyond ✅
```
 {"ok": true, "months": 2, "created": 9, "pending": 4, "through": "2026-10-31"}
  month  |  status   | count
---------+-----------+-------
 2026-09 | scheduled |     5
 2026-10 | pending   |     4
```

### 4. `mint_recurring_allotments()` twice does not extend past the pending month ✅
```
 first_run  {"month": "2026-09-01", "through": "2026-10-31", "plans_generated": 3, "sessions_booked": 0}
 second_run {"month": "2026-09-01", "through": "2026-10-31", "plans_generated": 3, "sessions_booked": 0}
 generated_beyond_the_horizon | 0
```
*(`furthest_booking` stays `2026-11-30` — that is the pre-existing 43, deliberately untouched. See 13.)*

### 5. Confirming payment flips THAT month and touches no other ✅
```
before   2026-09 scheduled 5 · 2026-10 pending 4
after    2026-09 scheduled 5 · 2026-10 scheduled 4
other_orders_bookings_moved | 0
```

### 6. `pending` does NOT block booking (D23/D24) ✅
A client holding a `pending` booking made another request in the same session:
`second_request_status | requested`.

### 7. The viewer-scoped read, three identities, same slot ✅ — **closed in the function, not the UI**
`moved` booking `d8ecc859…`:
```
PARTY     {"status": "moved", "is_mine": true, "mine_role": "client", … full detail}
OUTSIDER  {"status": "pending_reschedule", "is_mine": false, id/starts_at/ends_at only}
STAFF     moved | client_id 4255090d-…
```

### 8. A cancelled booking is visible to its parties and absent for everyone else ✅
```
party_sees | cancelled     staff_sees | cancelled     outsider_sees | (absent)
```
⚠️ **This changes what real users see today, and that is the point of the change, not a regression.**
Six cancelled bookings become visible to their own parties for the first time.

### 9. A held `moved` slot is not bookable by an outsider ✅
```
NOTICE:  T9 refusal: that time is no longer open
```

### 10. On approval the hold releases and the old slot empties ✅
```
decision | approved      booking_now | scheduled   moved_to | 2026-09-08 18:30:00-07
items_at_the_old_time | 0        (read as the OUTSIDER)
```
**No hold table and no second row: the booking sitting at its OLD time in `moved` IS the hold, and
approval moves that same row, which releases the old slot by construction.**

### 11. `booking_status_code` gives a deliberate code to the new states ✅
```
 requested→pending · approved→pending · pending→pending · moved→pending
 scheduled→scheduled · confirmed→scheduled · cancelled→cancelled · completed→completed
```
The arm is named in the body, above the `ELSE`: `WHEN p_status IN ('requested','approved','pending','moved')`.
⚠️ **`moved` collapses to `pending`, deliberately — NOT `cancelled`: the slot is still held.**
⚠️ **The four writes produce TWO `status_events` rows, not four, and that is correct** — the trigger
writes only when the CODE changes, and all four pre-firm states share one code. `current_status`
carries it. *(`TASK-LIFECYCLE-events-output.txt`.)*

### 12. `approved` fires `request_purchase_payment` on an unpaid order, not on a paid one ✅ — **both approve buttons**
```
UNPAID  decide_booking_change → {"status": "approved_payment_due", "payment_requested": true}  → booking `approved`
        order timeline: purchase_unpaid "Evaluation Lesson — payment due" (buyer notified)
PAID    decide_booking_change → payment_requested false → booking `scheduled`
UNPAID  confirm_booking       → {"status": "approved", "payment_requested": true}   → booking `approved`
```
🔒 **The last line is the one that mattered.** The staff queue's Confirm button
(`CalendarPage.tsx:1320`) and the item panel (`CalendarItemPanel.tsx:426`) call **`confirm_booking`**,
not `decide_booking_change`. Had the rule gone only where the spec pointed, `approved` would have
been unreachable from the button staff actually press. The rule is written ONCE —
`booking_awaiting_payment(bookings)` — and both callers ask it.

### 13. Sessions still beyond 30+30, stated and NOT changed ✅
```
 days_30_60 | beyond_60 |   latest
         22 |        21 | 2026-11-30
```
**43 sessions, unchanged, exactly as measured before the work.** Trap 8 / D32.

### 14. `pg_proc.proacl` before and after ✅
**The 15 replaced functions are byte-identical before and after** (`diff` of
`proacl-before/after` returns only the three ADDED lines). All `CREATE OR REPLACE` on the same
signature — no `DROP`, so no ACL reset. The three NEW functions carry **no `anon` and no PUBLIC**:
```
+ booking_awaiting_payment(bookings)   :: postgres=X | authenticated=X | service_role=X
+ plan_horizon_through()               :: postgres=X | service_role=X
+ trg_confirm_bookings_when_paid()     :: postgres=X | service_role=X
```

### 15. Gates ✅
`typecheck` **0** · `typecheck:api` **0** · **lint 46 problems, 0 errors** (the ceiling) ·
`build` **clean** · `test:api` **7/7**. ⚠️ `test:db` not run — red at baseline and proof of nothing.

### 16. Renders NOT VERIFIED by me — §8 below.

## 3 · THE REACH (D17) — file and line

| §7 question | The answer |
|---|---|
| **1. Staff mark a `requested` booking `approved` — what do they click?** | The calendar's own requests queue: `src/pages/app/CalendarPage.tsx:1295` `RequestsBar` → `:1320` `confirmNew()` → `confirmBooking` → `confirm_booking`. **AND** `src/pages/app/CalendarItemPanel.tsx:426` `confirm()`, the same act from the item panel. 🔒 **No second queue was built — the incumbent was the right home, as §7 asked me to establish first.** |
| **2. A client sees their booking is `pending` — where, and what does it tell them?** | `src/pages/app/CalendarPage.tsx:788` — their own row is orange, and `isPending` is what keeps **Edit** and **Withdraw** on it (`update_my_pending_booking` / `withdraw_my_pending_booking`). Also `MyLessonsContent.tsx:193`, which renders it with the word **REQUESTED**. |
| **3. An outsider sees `Pending reschedule` — on which views?** | `calendar_free_busy` emits it, so **every** view fed by that one function: `CalendarPage.tsx:118` (the class), `:139` (the label), `:124` (the new legend row). ⚠️ **Week AND month, because neither has its own status vocabulary.** ⚠️ **The month view truncates to three items per day (`CalendarPage.tsx:624`) — a fourth item's label does not survive that, and this task does not change it** (AR1's complaint, out of scope). |

**Is that the only way?** For staff, yes — those two components are the only callers of
`confirm_booking` in the codebase. **REQCARDS will add the notification-row route the owner ruled
for today; until it lands, the calendar is the only door.**

## 4 · ⚠️ WHERE THE SPEC WAS WRONG

1. 🔴 **§2b: *"the constraint must be widened for exactly two values, and no others."* IT IS THREE.**
   The spec read the twelve legal values, spotted that `approved` and `moved` were missing, and did
   not notice that **`requested` — the FIRST of the owner's six states — was not there either.**
   Widening for two would have shipped a machine that cannot write its own first state, and would
   have blocked `TASK-SIGNBOOK` (whose whole end-cap is a `requested` booking) and `TASK-REQCARDS`
   (whose first test renders one).
2. **§2a's counts have drifted**: `available` is **604**, not 594 — the daily cron generating. Every
   other measured number re-ran true, including the 43.
3. **§3's incumbent table is right and it is most of the design** — the reschedule machine really did
   need no new table. Credit where it is due: naming `calendar_free_busy` as an already-viewer-scoped
   read saved this task from writing a second one.

## 5 · ⚠️ WHAT I DECIDED THAT THE SPEC DID NOT

1. **`requested`, `approved` and `moved` all collapse to code `pending`.** The spec told me to decide
   `moved` deliberately and I extended the same reasoning to the other two: none of them is a
   session anyone can rely on, and none is cancelled.
2. **The DEFAULT moved to `requested`.** It had to move off `pending_slot` for that value to leave
   the CHECK. A booking nobody has approved is a request.
3. **The pending month is ALWAYS the next month, not "next month unless already paid."** §9.3 states
   it unconditionally. ⚠️ **The consequence: per-month billing does not exist yet — `TASK-MONTHEND`
   builds it — so today the flip out of `pending` comes from confirming the plan's ORIGINAL
   purchase.** Named here because it is the seam MONTHEND lands on.
4. **The payment flip hangs on a TRIGGER, not on `mark_purchase_paid`.** That function has been
   overwritten live once (BOOKS1) and reverted three times (CREDITFIX); hanging the flip in its body
   would put it in that blast radius and would still miss `finalize_purchase_payment`.
   ⚠️ **The trigger carries NO column list** — `AFTER UPDATE` + a `WHEN` on OLD/NEW values, because
   `UPDATE OF <col>` fires on the columns the statement NAMES.
5. **`approved` is staff-only.** `request_purchase_payment` is staff-only, so when a CLIENT accepts a
   staff counter-time the path behaves exactly as it did before. **No regression, but it means an
   unpaid order accepted by the client still lands `scheduled`** — flagged below.
6. **The approved-unpaid branch does NOT also send a "confirmed" notification.**
   `request_purchase_payment` already raises the buyer's payment-due notice; two notices for one act
   is the noise, and the session is not confirmed anyway.
7. **`my_lesson_sessions` still reports `PENDING` for all four pre-firm states.**
   `MyLessonsContent.tsx:147` filters the member's upcoming list to `SCHEDULED|PENDING` — emitting
   `REQUESTED` would have **deleted the client's own session from their own page.**

## 6 · 🔴 WHAT THE SPEC'S LIST OF SIX MISSED — seven more functions and two buttons

**The spec named six functions that test the `pending` triple. Splitting `requested` out of
`pending` broke seven more, and every one of them fails as "the button does nothing."**

| Where | What would have happened |
|---|---|
| `withdraw_my_pending_booking` | the client could not withdraw their own unanswered ask |
| `update_my_pending_booking` | …nor change its time |
| `propose_booking_time` | staff could not counter-offer a time on a new request |
| `booking_item_options` | the member could not see which purchased item the session spends |
| `swap_booking_item` | …nor change it — raised `NOT_PENDING` on the exact booking it exists for |
| `ops_day_sheet` | **a brand-new request would have vanished from the staff day sheet** |
| `calendar_reminder_sweep` | the 1h/2h reminders would have skipped fresh requests |
| `CalendarItemPanel.tsx:958` | **the staff Confirm and Decline buttons would have disappeared from every new request** |
| `CalendarPage.tsx:788` | the member's own request became read-only the moment they made it |

🔒 **All nine are fixed and applied** (`20260901T1700_*`, `20260901T1720_*`, and the two components).
**Each list gains exactly the states that used to be spelled `pending`, so every surface does what it
did yesterday.**

## 7 · ⚠️ FLAGGED, NOT FIXED — one line each
- ⚠️ **THREE UNTRACKED FILES ARE STRANDED IN `wt-1`** (`supabase/migrations/20260901T{1530,1600,1620}_*.sql`), written before the collision order; byte-identical to this branch's, and `git clean -xdf` in `wt-1` removes them. **I was told not to touch that tree again, so I did not.**
- A 1-hour reminder now fires for an UNAPPROVED session, because it did yesterday when that state was spelled `pending` — product question for DSGN, not a regression.
- A client accepting a staff counter-time on an unpaid order still lands `scheduled` without a payment request (`request_purchase_payment` is staff-only).
- `confirm_booking_for_purchase` set `'confirmed'` for lessons where every other transition sets `'scheduled'`, and carried `'scheduled'` in its own WHERE so it could DOWNGRADE a scheduled lesson — both fixed in passing, since converging on it meant reading it.
- The month view truncates to three items per day, so a fourth `Pending reschedule` label is not rendered there (AR1, out of scope).
- The waitlist behind `Pending reschedule` does not exist and was not stubbed (§5, and the owner's own ASK-OWNER is still open).

## 8 · THE OWNER'S RENDER CHECKLIST — ⚠️ NOT VERIFIED BY ME, no worktree has a staff login
**On your phone, signed in as `hello@fhequestrian.com`:**
1. **Calendar → the legend.** There is now a **sixth row, `Pending reschedule`**, dashed orange. Confirm it fits the strip on the phone and does not wrap badly.
2. **Calendar → Pending requests bar.** Press **Confirm** on a new request whose order is unpaid. ⚠️ **You should get a dialog that says the order is not paid and that approving SENDS A PAYMENT REQUEST — before anything happens.** Cancel it once, confirm the nothing-happened; then press it again and accept.
3. After accepting, the session should read **approved (orange)**, NOT booked-green, and the client should have a payment-due notice.
4. **Open a session and cancel it.** ⚠️ **You and the client can now both SEE the cancellation on the calendar; before today it vanished for everyone including you.** Check that reads right to you.
5. **As a client (second device or a test login): ask to reschedule a session.** The old time should stay occupied and read **Moving — awaiting approval** to you, and **Pending reschedule** to anyone else. Approve it from staff; the old time should go empty.
6. **A recurring client's calendar:** this month solid green, **next month orange/pending**. ⚠️ **That is the change you asked for and it will look different to what you are used to.** Nothing beyond next month should be generated from now on — the 43 sessions already out to 30 November are still there and were deliberately not touched.
7. **Day sheet** — confirm a brand-new request still appears on it.

## 9 · TEARDOWN — the census
- **No servers, browsers or scratch worktrees started.** `npm run build` and `vitest` ran and exited.
- **Worktrees:** `wt-2` holds this branch. ⚠️ **`wt-1` is `SIGNBOOK`'s and was left alone from the moment the order came** (see §7 line 1). `wt-3` untouched.
- ⚠️ **`task/lifecycle` in `wt-1` is ABANDONED — do not merge it.** **`task/lifecycle-b` in `wt-2` is the work.**
- Scratch SQL lives under the session scratchpad, not in the repo.

## 10 · THE PROMPT FOR THE NEXT STATION — this is for **`ORCH`**
```
FHE-ORCH

Verify TASK-LIFECYCLE and write docs/reports/TASK-LIFECYCLE-VERIFICATION.md.
The branch is task/lifecycle-b in wt-2 (NOT task/lifecycle in wt-1 — abandoned,
and three stray untracked migrations of mine need git clean -xdf there).
All six migrations are ALREADY APPLIED TO PRODUCTION. Read
docs/reports/TASK-REQCARDS-LEDGER.md before re-dispatching REQCARDS: the owner
answered its §9 and named the modal's option set as still open.
```

---
## VALIDATION — ORCH7, 2026-09-01
Independently verified in production at merge time (not from the thread's own outputs): the CHECK
constraint (six states in, two spellings retired), the DEFAULT ('requested'), zero
`current_date + 90` sites, the `purchases_confirm_bookings` trigger with NO column list, proacl
on the three new functions (no anon, no PUBLIC), status distribution (604/117/6/1 unchanged),
`plan_horizon_through()` = 2026-10-31, `request_open_time` writing 'requested', and
`calendar_free_busy` viewer-scoping. Reach verified in source (`api-calendar.ts:551` →
RequestsBar/ItemPanel; legend row `CalendarPage.tsx:138`). Gates after merge: typecheck 0 ·
typecheck:api 0 · lint 46w/0e · build clean · test:api 7/7. Full detail:
`TASK-LIFECYCLE-VERIFICATION.md`. Merge commit: 5b9fed67.
