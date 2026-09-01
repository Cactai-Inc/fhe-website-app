# TASK REVIEWQ — a booking is REQUESTED until the company says otherwise

**Owner's observation (FLOWTRACE items 10 + 11, his own test run):** a client's booking shows
**BOOKED, not REQUESTED/PENDING**, and **nothing surfaces on the company side** to confirm it,
reject it, or propose an alternative. Refusing one today **hard-deletes the row**.

**Read first:** `docs/reports/TASK-FLOWTRACE-REPORT.md` §10, and
`docs/reports/TASK-BOOKLINK-REPORT.md` — BOOKLINK linked bookings to client+item and made the
debit/order real. **This task is its other half: the company's side of the same transaction.**
Do not re-derive what those established.

---

# WHAT WAS MEASURED (prod, 2026-08-15 — verify, then build)

1. **`bookings_status_check` ALREADY permits `pending`** (full vocabulary: draft, available,
   unavailable, pending, pending_slot, pending_payment, confirmed, cancelled, expired,
   completed, scheduled, no_show). **No constraint migration is needed to introduce it.**
2. **Nothing is pending today**: prod holds exactly `available` (280) and `scheduled` (39).
   Every client-made booking lands `scheduled` — i.e. confirmed on arrival, which is the defect.
3. **The request machinery EXISTS and is the incumbent — extend it, do not rebuild:**
   `request_booking_change` + `decide_booking_change` (RPCs), `booking_change_requests` (table),
   and client-side `requestBookingChange` / `RequestTimePanel` / `fetchRescheduleFee`
   (`CalendarPage.tsx` ~:501-538). **A second approval mechanism alongside this is the exact
   duplication failure this project keeps paying for — name the incumbent in your report.**
4. **`delete_calendar_item` HARD-DELETES** (`delete from bookings`, no `deleted_at` — verified).
   The owner's own two test bookings were destroyed this way, orphaning their audit events and
   leaving spent credits pointing at rows that no longer exist.

# THE BUILD

## R1 — a client-made booking arrives PENDING, not confirmed
- Client-side booking writes land `status='pending'` (the constraint already allows it).
- **Staff-made bookings stay immediately scheduled** — staff booking IS the confirmation.
- Every client-facing surface that renders a booking must say **Requested / Pending**, not
  "Booked". Sweep them: calendar item, My Lessons, order/booking lists, any confirmation copy.
  **A screen that says "Booked" over a pending row is the same class of lie as the payment copy
  PAYLOCK fixed.**

## R2 — the company queue: confirm · decline · propose another time
- One staff surface listing everything awaiting a decision. **Put it where staff already work**
  — the Dashboard's needs-attention band and/or Calendar — rather than minting a new page
  nobody navigates to (the app already has three horse rosters from exactly that instinct).
- Three actions, all through the existing decision path (`decide_booking_change` family):
  **confirm** → `scheduled`; **decline** → see R3; **propose another time** → a counter-offer
  the client can accept or decline, reusing `booking_change_requests` rather than a new table.
- **The client is notified on every one of these** — the notification spine exists
  (`docs/reference/NOTIFICATIONS.md`); one row per attempt, provable, per the fire-and-forget lesson in
  `orchestration/lessons/LESSONS.md`.

## R3 — refusal stops destroying evidence
- Declining sets a terminal status (`cancelled`, with the reason recorded) — **never DELETE**.
- **Audit the whole delete path**: `delete_calendar_item`'s hard DELETE must become a soft
  retire for anything with a client, a purchase, a credit debit, or audit history. Standing
  rule (D11, CLAUDE.md): *nothing is purged; retire behind a boolean.*
- **Restore what a decline must return**: if BOOKLINK debited a credit or created an order for
  that booking, declining must give the credit back / void the order — state exactly what your
  implementation does with the money side. **This is the highest-risk part of the task: a
  declined lesson that silently keeps a client's credit is theft by software.**

## R4 — reschedule requests round-trip (BOOKLINK's §B4 monthly seam)
- A client requesting a different time inside their month goes through this same queue.
  BOOKLINK made monthly plans real and non-carrying-over; the *approval* of a move is here.

# TRAPS
- **The status vocabulary is already wide — do not add another word for the same idea.**
  Reuse `pending`; do not invent `requested` as a 13th status.
- **`assertWrote()` on every write** — RLS silently zeroes UPDATEs.
- **Migrations never contain BEGIN/COMMIT**; dry-run and PROVE the rollback.
- **PGlite proof required** for anything new (model: `test/db/creditfix_mint_from_unit_count.test.ts`).
- **Do not touch** the contract/party-staging surfaces — a concurrent thread owns
  `ContractPage.tsx`, `ClauseDocument.tsx`, `AddElementModal.tsx`, `PartyControlsCard.tsx`.
  If you need a change there, **report the diff; the orchestrator applies it.**
- Records/Lessons/Documents/Files/Deals are now TABS on the Records page (2026-08-15) — rebase
  and look before assuming any of those are standalone pages.

# THE TEST THIS MUST PASS
1. A client books → the row is `pending` and every client-facing surface says so.
2. Staff sees it in a queue they already visit, with three actions.
3. Confirm → `scheduled` + client notified (notification row proven).
4. Decline → terminal status, **row still exists**, reason recorded, client notified, and the
   credit/order consequence stated and proven by query.
5. Propose-another-time round-trips through `booking_change_requests` — no new table.
6. `delete_calendar_item` can no longer destroy a booking that carries client/purchase/audit
   history — proven by attempting it.
7. Every DB claim shown as query output; every render claim marked NOT VERIFIED with a numbered
   owner checklist.

Report to `docs/reports/TASK-REVIEWQ-REPORT.md`. Do not push; the orchestrator merges.
