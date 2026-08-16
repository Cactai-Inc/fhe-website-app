# TASK-REVIEWQ REPORT — a booking is REQUESTED until the company says otherwise

**Base:** `origin/main` @ `9deb682`, worktree `~/Downloads/claude-code-repo/wt-reviewq`,
branch `task/reviewq`. Four migrations applied live to prod this session (dry-run in
`BEGIN…ROLLBACK` first — six functional scenarios exercised end-to-end and rolled back,
then applied for real, then re-verified with read-only queries against prod's actual
identities). **Do not push; the orchestrator merges.**

```
supabase/migrations/20260815T2200_reviewq_m1_schema_widen.sql
supabase/migrations/20260815T2300_reviewq_m2_write_paths_land_pending.sql
supabase/migrations/20260815T2400_reviewq_m3_decision_rpcs.sql
supabase/migrations/20260815T2500_reviewq_m4_delete_never_destroys_evidence.sql
```

`npm run typecheck`, `npm run typecheck:api`, `npm run lint`: 0 errors (39 pre-existing
warnings, none new). One pre-existing lint **error** in
`test/db/creditfix_mint_from_unit_count.test.ts:261` (`'client' is assigned a value but
never used`) — confirmed byte-identical to `main`, not touched this session, flagged for
whoever owns that file.

**A real bug was found and fixed mid-session, not just designed around:** extending
`decide_booking_change` with a 4th parameter required `DROP FUNCTION` + `CREATE
FUNCTION` (a different signature, so `CREATE OR REPLACE` alone would have left the old
3-arg overload in place, ambiguating every existing call site — caught immediately by
the dry-run). The DROP+CREATE turned out to have a second consequence I didn't expect:
the fresh function object picked up **Postgres's own default EXECUTE-TO-PUBLIC grant**
instead of inheriting the old signature's `authenticated`/`service_role`-only grants —
confirmed live (`anon` and `PUBLIC` both showed `EXECUTE` immediately after the
migration ran). Fixed live with an explicit `REVOKE ALL … FROM PUBLIC, anon`, and the
migration file itself corrected so a fresh apply doesn't reintroduce it. The function's
own internal permission check would have refused an anon caller either way (verified),
but the grant itself was wrong and is now closed.

**A second thing was found and fixed before it shipped:** `status_events` was drafted
as a fourth "does this booking have history" signal for `delete_calendar_item`, then
dropped after checking live — `trg_status_bookings` inserts one on **every** booking
INSERT unconditionally, including a plain `available` slot nobody has ever claimed
(proven: all 280 of prod's untouched available slots already carry one). Treating it as
history would have made every delete a retire and silently defeated the legitimate
hard-delete case this function still needs to serve. The shipped check uses three
narrower signals instead: `client_id`, `purchase_id`, `credit_id`, plus whether an open
`booking_change_requests` row exists.

---

# R1 — a client-made booking arrives PENDING, not confirmed

**`book_open_slot`** (FLOWTRACE item 10, re-verified live before editing) wrote
`status = 'scheduled'` literally when a client claimed an already-published open slot —
the exact "BOOKED, never REQUESTED" defect, and the only client path that could ever
produce a live booking without a decision. Now writes `status = 'pending'` and inserts
the companion request row (below). **`request_open_time` already wrote `'pending'`**
(verified live) — it only gained the same companion-row insert, so both client paths
feed the one queue.

**Staff-made bookings are unchanged** — `save_calendar_item` reads `status` from
whatever the panel sends (staff explicitly picks it; the default committing path is
`scheduled`), never auto-derived. Not touched.

**`booking_status_code`** (the display-bucket function FLOWTRACE flagged: "collapses
`pending`/`pending_slot`/`pending_payment` all into `'scheduled'`") now buckets pending
into its own `'pending'` code. Proven live: `booking_status_code('pending') = 'pending'`
(was `'scheduled'`). This is what feeds `bookings.current_status` and
`status_events`, so a pending booking is now correctly evented and denormalized as
pending, not silently stamped scheduled the moment it's created.

**`my_lesson_sessions`** (the RPC behind the client-facing "My Lessons" upcoming list)
raw-`upper()`-cased the DB status into a closed `SCHEDULED|COMPLETED|CANCELLED|NO_SHOW`
union with no `PENDING` member. A pending lesson would carry a status value the type
didn't admit — and `MyLessonsContent.tsx`'s `s.status === 'SCHEDULED'` upcoming-filter
would **silently drop it from the list entirely**, the same class of lie PAYLOCK's
payment-copy fix addressed, just on the read side instead of the write side. Fixed to
bucket the same way `booking_status_code` does, with `PENDING` added; the client-facing
badge now renders "REQUESTED" (orange) instead of a hardcoded "SCHEDULED" (green) string
that was previously shown unconditionally regardless of actual status.

**Sweep, what changed vs. what was already right:**
- `CalendarPage.tsx`'s `itemClass`/`LEGEND` already had orange styling and a "Pending"
  legend entry for `pending`/`pending_slot`/`pending_payment` — pre-built ahead of the
  DB ever emitting the state (FLOWTRACE: "the pending states exist"). Not touched; it
  was already correct, just unreachable until this task.
- `MyLessonsContent.tsx` — filter widened to include `PENDING`, badge now dynamic
  (REQUESTED/orange vs SCHEDULED/green) instead of a hardcoded string.
- `Schedule.tsx` — a second client-facing surface, found via **TypeScript itself**: its
  `SESSION_STATUS_LABEL`/`SESSION_STATUS_CLASS` maps are typed
  `Record<MemberLessonSession['status'], string>`, so widening the union to add
  `PENDING` turned a silent gap into a compile error, which is exactly the kind of sweep
  a grep for the literal string "Booked" would have missed. Added "Requested" / orange.
- `my_lesson_progress` / `my_lesson_reports` also raw-`upper()`-case status, but both
  feed *past-lesson write-up* surfaces (progress notes, instructor reports) that
  structurally only apply to completed/no-show lessons — **not swept, flagged** as a
  theoretical (not observed) gap, not a live defect.
- The staff sessions board (`SessionsPage.tsx`, `listLessonSessions` in
  `api-lessons.ts`) has its own `LessonSessionStatus` union with the same shape — **not
  swept**; staff already see a pending item correctly via the calendar's orange coloring
  and the queue below, so this wasn't chased down under this task's client-facing
  mandate, but it's the same class of gap and worth a follow-up pass.

# R2 — the company queue: confirm · decline · propose another time

**No new page, no new table** — extended the incumbent machinery exactly as instructed.
Both client booking paths now insert a companion `booking_change_requests` row
(`request_kind = 'new'`, `status = 'pending'`) at creation, in the same INSERT the
booking itself lands in. This means the existing "Pending requests" orange bar
(`RequestsBar` in `CalendarPage.tsx`, reading `open_change_requests()`) picks up a fresh
booking request for free — it was already the right surface, it just structurally could
never see one before (FLOWTRACE item 11: "a new booking structurally cannot appear in
it").

**Three actions, all through `decide_booking_change`, extended (not duplicated):**
- **Confirm** → the existing `confirm_booking` RPC (already wired to a "Confirm
  request" button in `CalendarItemPanel.tsx:679`, gated on `status === 'pending'` — a
  state no booking had ever reached, so it had never fired) now also closes the
  companion queue row, so the two confirm entry points (the queue bar's new "Confirm"
  button, and the item panel's pre-existing one) can never leave a stale `pending` row
  behind regardless of which one staff uses. Proven live: `status → scheduled`,
  companion row `→ approved`, one `booking_confirmed` notification row.
- **Decline** → see R3.
- **Propose another time** → new `propose_booking_time(booking_id, new_start, new_end,
  note?)`, staff-only. Updates the **same** open `booking_change_requests` row in place
  (reuses the table, per spec — no second one) and sets `awaiting_client = true`, which
  flips who `decide_booking_change` will accept a decision from. The client sees it via
  a new `MyProposedTimes` panel on their own Calendar page (sourced from
  `fetchMyPendingChanges()`, widened — see below) with Accept/Decline, both routed
  through the same `decide_booking_change`.

**The client is notified on every decision** — confirm, decline, and a staff counter,
all `INSERT INTO notifications` inside the same transaction as the state change (proven
by query, per the fire-and-forget lesson: a durable row that exists iff the attempt
succeeded, not a fire-and-forget network call with no outcome record).

# R3 — refusal stops destroying evidence

**A genuine company decline of a fresh request** (staff clicks Decline on a `'new'` row
nobody countered): terminal `status = 'cancelled'` (never reverts to a prior live
status, since there wasn't one), reason captured via `window.prompt` and stored on the
change-request row's new `staff_note` column, client notified with the reason inline.
Proven live: `{"status":"rejected","kind":"new","credit_refunded":true}`, notification
title `"Your request for … was declined — no availability that week"`.

**The money side, stated exactly:** `book_open_slot` is the only client path that ever
debits money before a decision (it requires an existing credit; `request_open_time`
debits nothing). On decline, if the booking carries a `credit_id`, a fresh
`lesson_credits` row (`package_key = 'change_credit'`, 1/1) is minted — the **same**
convention `decide_booking_change`'s pre-existing cancel/defer branch already uses
(mint-back, not reverse-in-place), via a new shared `_refund_booking_credit` helper.
**No client path ever auto-creates a new purchase/order before a decision** —
`_debit_or_create_for_booking`'s order-creation branch is reachable only from
`save_calendar_item` (staff), confirmed by grepping every function body in prod for
callers — so "void the order" has no live code path to build against today. If that
ever changes, this refund helper is the one seam to extend, not a second one.

**`delete_calendar_item`** — verified live before editing: literal `DELETE FROM
bookings`, no `deleted_at` column existed at all. Reworked into a loop over every
affected id (was a single-row `DELETE`, with a scope-wide bulk `DELETE` for
`future`/`all` that would have silently skipped, not retired, any row with history it
didn't happen to match): a row carrying a client, a purchase, a credit, or an open
request is retired — `deleted_at`/`deleted_by` stamped, `status → 'cancelled'` (which
`calendar_free_busy`'s existing `WHERE status NOT IN ('cancelled','expired')` already
excludes, so retirement needed no new read-path filter), credit refunded via the same
helper decline uses, any open companion row withdrawn. A row with none of that — an
unused `available`/`draft`/`unavailable` slot, or an unclaimed `block` — is still
hard-deleted, proven live on a genuinely untouched slot.

# R4 — reschedule requests round-trip (BOOKLINK's §B4 monthly seam)

Untouched by design: `request_booking_change`'s monthly no-carryover guard (added by
BOOKLINK) lives entirely inside the client-raises/staff-decides direction, which this
task didn't modify. The new staff-proposes/client-decides direction
(`propose_booking_time` + `awaiting_client`) is a **fresh** ('new'-kind) request only —
it does not touch an already-live booking's reschedule path, so BOOKLINK's guard and
this task's queue coexist without overlap. Not separately re-tested; no code path
connects them.

---

# THE TEST THIS SPEC NAMED — status

1. **A client books → the row is `pending` and every client-facing surface says so.**
   PROVEN at the DB layer (`book_open_slot`/`request_open_time` both land `pending`,
   `booking_status_code`/`my_lesson_sessions` bucket it correctly). Calendar coloring
   was already correct; My Lessons and Schedule badges fixed this session. **Render NOT
   VERIFIED** — no browser session; see the owner checklist.
2. **Staff sees it in a queue they already visit, with three actions.** PROVEN —
   `open_change_requests()` returns the fresh row with zero new RPCs to fetch it; the
   `RequestsBar` component gained Confirm/Decline/Propose-time for `kind === 'new'`
   rows. **Render NOT VERIFIED.**
3. **Confirm → `scheduled` + client notified (notification row proven).** PROVEN live
   (prod dry-run) and in the PGlite suite.
4. **Decline → terminal status, row still exists, reason recorded, client notified, and
   the credit/order consequence stated and proven by query.** PROVEN live and in the
   PGlite suite — status `cancelled`, row count unchanged (still 1, not 0), `staff_note`
   holds the reason, a `change_credit` row exists, notification title includes the
   reason. Order-void has no reachable code path today — stated above, not silently
   skipped.
5. **Propose-another-time round-trips through `booking_change_requests` — no new
   table.** PROVEN both directions live and in the PGlite suite: client accepts →
   booking shifts to the proposed time and confirms; client declines → the countered row
   is marked `withdrawn`, a fresh `pending` row is inserted with the booking's original
   time, and the booking itself stays `pending` (never silently flips to confirmed) —
   the "exactly one open row per pending booking" invariant holds after the round trip,
   asserted directly in the test.
6. **`delete_calendar_item` can no longer destroy a booking that carries
   client/purchase/audit history — proven by attempting it.** PROVEN live and in the
   PGlite suite: the row still exists after the call (not zero rows), retired not
   deleted, credit refunded; a genuinely untouched slot is still actually removed
   (control case, also proven, both live and in the suite).
7. **Every DB claim shown as query output; every render claim marked NOT VERIFIED with
   a numbered owner checklist.** Done — six scenarios proven live against prod inside
   `BEGIN…ROLLBACK` (real client Claire Bourdon, real staff admin@fhequestrian.com, real
   credit/slot rows, nothing persisted until the migrations themselves were applied
   separately and re-verified with read-only queries), plus 15 PGlite tests against the
   pre-REVIEWQ schema snapshot (`npx vitest run
   test/db/reviewq_pending_and_company_queue.test.ts` — 15/15 pass). Checklist below.

```sql
-- #3 proof (live dry-run, rolled back)
select decide_booking_change(id, true) from booking_change_requests where booking_id='…';
-- {"kind": "new", "status": "approved", "affected": 1}
select status from bookings where id='…';  -- scheduled

-- #4 proof
select decide_booking_change(id, false, false, 'no availability that week') from …;
-- {"kind": "new", "status": "rejected", "credit_refunded": true}
select title from notifications where kind='booking_declined';
-- "Your request for Aug 4, 04:00 PM was declined — no availability that week"

-- #6 proof
select delete_calendar_item('<a scheduled, client+credit-bearing booking id>');  -- 1
select status, deleted_at is not null as retired from bookings where id='…';
-- cancelled | t   (row still present)
select delete_calendar_item('<a plain untouched available slot id>');  -- 1
select count(*) from bookings where id='…';  -- 0   (control: genuinely removed)
```

---

# TRAPS — addressed

- **Status vocabulary** — `pending` reused exactly as it stood; no 13th status invented.
  (`booking_change_requests.request_kind` gained one new value, `'new'` — a different
  vocabulary on a different table, not the trap's target.)
- **`assertWrote()`** — not used here: every write in this task goes through a
  `SECURITY DEFINER` RPC with explicit `IF NOT FOUND THEN RAISE EXCEPTION` guards (the
  incumbent pattern on every function this task touched), which throws rather than
  silently no-opping — the same outcome `assertWrote()` gives the frontend, enforced
  server-side instead since these are all RPC calls, not direct table writes from the
  client.
- **No `BEGIN`/`COMMIT` in migration files** — confirmed: all four files contain neither;
  every dry-run/apply wrapped them externally via `psql`.
- **PGlite proof** — `test/db/reviewq_pending_and_company_queue.test.ts`, modeled on
  `creditfix_mint_from_unit_count.test.ts`'s before/apply/after structure. One schema
  gap found and documented in the test itself (`lesson_credits.purchase_id` postdates
  the 2026-08-03 snapshot; added defensively in `beforeAll`, exact same reasoning
  CREDITFIX's own test already documents for the same column).
- **Contract/party-staging surfaces** — not touched. `ContractPage.tsx`, `ClauseDocument.tsx`,
  `AddElementModal.tsx`, `PartyControlsCard.tsx` do not appear in this diff.
- **Records/Lessons/Documents/Files/Deals as Records tabs** — rebased onto `main` after
  that landed; nothing in this task assumed any of them were standalone pages.

# FLAGGED, NOT FIXED

- **`my_lesson_progress` / `my_lesson_reports`** raw-`upper()`-case status the same way
  `my_lesson_sessions` did before this fix. Not swept — both feed past-lesson
  write-up/progress surfaces that structurally shouldn't see a pending lesson today, so
  this is a theoretical gap, not an observed one. Worth a follow-up if that assumption
  ever turns out wrong.
- **The staff sessions board** (`SessionsPage.tsx` / `listLessonSessions` in
  `api-lessons.ts`) has its own separate `LessonSessionStatus` union with the identical
  shape/gap `MemberLessonSessionStatus` had. Not swept this session — staff already see
  a pending item correctly elsewhere (calendar coloring + the queue), so it wasn't
  chased under this task's client-facing mandate, but it's the same class of defect.
- **`status_events`'s `entity_type = 'offering'` mislabeling** for booking events
  (FLOWTRACE's own flag) — read around (the `EXISTS` check I considered and dropped for
  `delete_calendar_item` didn't depend on the label being right), not fixed. Still
  wrong, still not this task's scope.
- **`test/db/creditfix_mint_from_unit_count.test.ts:261`** pre-existing lint error
  (unused `client` var), confirmed unrelated to this session, not touched.

# OUT OF SCOPE (per spec, untouched)

Contract/party-staging surfaces (explicitly fenced off), any change to
`request_booking_change`'s own monthly-carryover guard, ledger unification, the kiosk,
Zelle inbound matching.

---

# OWNER CHECKLIST — every render claim above, NOT VERIFIED, to run in a browser

1. As a client with a spare lesson credit, claim an open slot on the calendar — confirm
   it shows orange/"Pending" on the grid immediately, not green/"Booked".
2. Same client, open My Lessons — confirm the session appears under "Upcoming lessons"
   with an orange "REQUESTED" badge and the "Waiting on our team to confirm this time"
   note, not a green "SCHEDULED" badge.
3. As staff, open the Calendar — confirm the orange "Pending requests" bar shows the new
   request with three buttons: Confirm, Decline, Propose time.
4. Click Confirm — confirm the booking turns green/"Booked" on the grid and the client's
   My Lessons badge flips to "SCHEDULED".
5. Make a second request, click Decline, type a reason — confirm the client sees a
   decline notification containing that reason, and (if the request was made against a
   credit) their credit balance is back to what it was before the request.
6. Make a third request, click "Propose time", pick a different start/end, click Send —
   confirm the row now reads "Waiting on client's response" with no action buttons.
7. As that client, open the Calendar — confirm a "We proposed a different time" panel
   appears with Accept/Decline; Accept moves the booking to the new time and marks it
   scheduled; on a fresh request, Decline puts it back in staff's queue as a new pending
   request rather than silently disappearing.
8. As staff, open a pending booking's detail panel (click the item directly, not the
   queue bar) — confirm both "Confirm request" and the new "Decline" button appear and
   work identically to the queue bar's versions.
9. As staff, delete a plain unclaimed open slot from the calendar — confirm it's
   actually gone. Then delete a booking that has a client attached — confirm it
   disappears from the calendar (goes to cancelled) but does NOT reappear anywhere as an
   error, and check with the orchestrator/DB that the row is retired, not gone, and any
   debited credit came back.
