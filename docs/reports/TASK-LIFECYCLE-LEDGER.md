# TASK-LIFECYCLE — running ledger

**Thread:** `TASK` · opened 2026-09-01 · branch **`task/lifecycle-b` in `wt-2`**, from `origin/main`.
⚠️ **RELOCATED MID-BUILD.** It started on `task/lifecycle` in `wt-1`; `SIGNBOOK` was dispatched into
the same worktree and the owner ordered separation. **`wt-1` and `task/lifecycle` are abandoned and
must never be touched by this thread again.** The ledger commit was cherry-picked across; the three
migration files written before the order were copied out READ-ONLY.
⚠️ **LEFT BEHIND IN `wt-1`, FOR ORCH TO SWEEP — three UNTRACKED files I created there and did not
delete, because the order was to stop touching that tree:**
`supabase/migrations/20260901T1530_*.sql`, `20260901T1600_*.sql`, `20260901T1620_*.sql`.
**They are byte-identical to the ones now on this branch. `git clean -xdf` in `wt-1` removes them.** **Spec:** `docs/tasks/TASK-LIFECYCLE-six-states-and-the-thirty-day-horizon.md`.
**Binding:** `docs/method/TASK-ROLE.md` · `docs/method/THE-RUNNING-RECORD.md`.

## 🔴 RESUME
**Dispatched as `FHE-TASK-REQCARDS`. REQCARDS is unbuildable — it drives a machine that does not
exist — and the owner, asked, ruled: BUILD LIFECYCLE FIRST.** That exchange and his two other
rulings are in `docs/reports/TASK-REQCARDS-LEDGER.md` on `main`; **read it before REQCARDS is
dispatched again.** This thread is now TASK-LIFECYCLE.

**Progress:** measurement complete · design locked · migrations next.

## CLNR (zeroth act)
CLNR: clean — pool worktrees idle and clean, no new §2a breakage.

## FIRST ACT — the spec read back
Make the booking mean something. Six states — `requested` · `approved` · `pending` · `scheduled` ·
`moved` · `cancelled` — on the ONE machine that exists, reached by the surfaces that exist, with the
schedule generated one confirmed month plus one pending month instead of ninety days. I widen the
CHECK, teach `booking_status_code` the new states explicitly, collapse the three spellings of
pending to one, fix all THREE `current_date + 90` sites, move the `cancelled` filter out of
`calendar_free_busy`'s `WHERE` and into its `CASE` so the parties can see their own cancellation,
and hang `moved` on the change-request machine that already exists.
**I will not** build a waitlist, touch the `available`/`Open` renderer or the 594 generated rows,
retro-withdraw the sessions already booked beyond the window, write a second state machine, or
build the request cards (REQCARDS owns those).

## SECOND ACT — the premises, re-run 2026-09-01 against production
| Spec premise | Re-run | Verdict |
|---|---|---|
| `bookings.status` = available 594 · scheduled 117 · cancelled 6 · completed 1 | **604** · 117 · 6 · 1 | ✅ (the 10 are the daily cron generating) |
| CHECK permits 12; **"`approved` and `moved` are NOT — widen for exactly two values"** | the 12 are as printed, **and `requested` IS NOT AMONG THEM EITHER** | 🔴 **SPEC WRONG. THREE values must be added, not two.** `requested` is the first of the owner's six states and the state SIGNBOOK and REQCARDS both build on. Widening for two would have left the whole funnel unable to write its own first state |
| three functions carry `current_date + 90` | `_ensure_plan_horizon` · `ensure_standing_slots` · `mint_recurring_allotments` | ✅ exactly three |
| 23 inside 30d · 21 in 30–60 · 22 beyond 60, latest 2026-11-30 | **23 · 22 · 21**, latest **2026-11-30** | ✅ still **43 beyond 30+30** |
| `booking_status_code` ends `ELSE 'pending'` | confirmed, and it is `IMMUTABLE SQL` | ✅ |
| `calendar_free_busy` carries `AND b.status NOT IN ('cancelled','expired')` in its `WHERE` | confirmed, line-for-line | ✅ |
| Trap 9: BACKDATE and BOOKS1 unmerged, land first | **both merged** (`98646249`, `14140564`); the board marks `mark_purchase_paid` free | ✅ dependency cleared |

## FACTS THE SPEC DID NOT CARRY (each one changed the design)
1. **`_generate_plan_month` hardcodes `'scheduled'`** on every row it inserts. The pending month is
   made there or nowhere.
2. **`bookings.status` DEFAULT is `'pending_slot'`** — the value the spec says was never written.
   Zero rows carry it, so no insert path relies on the default; but the default must move before
   the value can leave the CHECK.
3. **A reschedule MOVES THE ROW** (`decide_booking_change` applies a delta to `starts_at`). So the
   "hold" the owner described needs no new table and no second row: **the booking sitting at its OLD
   time in status `moved` IS the hold**, and approval moves it, which releases the old slot by
   construction. This is the whole of traps 9/10 in the test, for free.
4. **`request_booking_change` already writes `status='pending'`** on the old booking. That write is
   where `moved` belongs.
5. ⚠️ **`confirm_booking_for_purchase` has NO caller in the database and exactly one in the app** —
   `api/_lib/reconcile.ts:146`, a service-role path. **`mark_purchase_paid` does not call it.** So
   *"confirming payment flips the month's bookings"* (test 5) has no interactive implementation
   today. It is not dead code; it is code the staff path never reaches.
6. **The approve surface already exists**: `CalendarPage.tsx:1286` (`fetchOpenChangeRequests`) and
   `:1293`/`CalendarItemPanel.tsx:426` (`decideBookingChange`, `confirmBooking`). §7.1's answer is
   the calendar's requests list — **not a new queue.**
7. `confirm_booking_for_purchase` sets `'confirmed'` for lessons too **and carries `'scheduled'` in
   its own `WHERE`**, so it can downgrade a scheduled lesson. Converging on it means fixing that.

## THE DESIGN, LOCKED
- **A · states** — CHECK gains `requested`, `approved`, `moved`; loses `pending_slot`,
  `pending_payment` (zero rows, D32 not engaged); DEFAULT moves to `requested`;
  `booking_status_code` gets explicit arms for all three new states (all → `pending`: a held slot is
  not `cancelled` and not yet `scheduled`).
- **B · horizon** — `_ensure_plan_horizon` runs the current month as today and **the following month
  as `pending`**, and all three 90-day sites become end-of-next-month.
- **C · the read** — `cancelled` moves out of `calendar_free_busy`'s `WHERE` into its `CASE`;
  outsiders get `NULL` (slot renders empty), parties get their real state. `moved` renders to
  outsiders as `pending_reschedule`, with the sixth legend row shipping beside it.
- **D · transitions** — reschedule writes `moved`; a fresh request writes `requested`; staff approve
  writes `approved` and fires `request_purchase_payment` when the order is unpaid and no credit paid
  for it; the client declaring a method writes `pending`; **payment confirmation flips to
  `scheduled` through a trigger on `purchases` guarded by `WHEN (OLD.payment_status IS DISTINCT FROM
  NEW.payment_status AND NEW.payment_status='paid')`** — no column list, so the `UPDATE OF` trap
  cannot silence it — calling the existing `confirm_booking_for_purchase`.

## EVENTS
- **2026-09-01** — REQCARDS stood down; owner ruled LIFECYCLE first. Measured production; premises
  re-run; one spec error found (`requested` missing from the widening); design locked above.
