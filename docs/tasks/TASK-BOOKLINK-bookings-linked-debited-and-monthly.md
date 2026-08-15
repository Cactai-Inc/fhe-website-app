# TASK BOOKLINK — every booking linked to its client and its purchased item; monthly plans real

**Owner, 2026-08-15, verbatim — this is the design, quote it back before deviating:**

> *"the booking should have a picker for the user to select what item from their list of
> purchased items they are booking and the staff should pick both the client and the item they
> are booking for that client and then it should either debit that clients credits or create an
> order for that client and staff needs to then mark it as needing to be paid via zelle or cash
> or already paid via zelle or cash."*

> *"also any one on a monthly plan needs to be assigned one and marked as such so their lessons
> can be added to the calendar and if they have a recurring day of the week for the lesson it
> can be set and then they can request for a reschedule to another day of the same week or a
> different week later in the month, but monthly lessons need to be used in the month they dont
> carry over to the next month."*

**Read `docs/reports/TASK-FLOWTRACE-REPORT.md` first** — it is the prod-verified audit of this
whole flow and much of what you need is already established there. This spec adds what was
measured on 2026-08-15 and the owner's design above.

---

# WHAT WAS MEASURED (2026-08-15, prod + code — verify, then build; do not re-derive)

1. **14 of 39 real scheduled lessons have `client_id` NULL** — the client's identity lives only
   in a hand-typed note ("Melanie 3/8", "Naomi"). Consequences, both verified in
   `calendar_free_busy` (read its body — the role/ownership branching is the whole story):
   clients see their own lessons privacy-masked as grey "unavailable" blocks; staff see items
   nothing can label. The other 278 NULLs are open availability slots — correct, leave them.
2. **The staff panel (`src/pages/app/CalendarItemPanel.tsx`) already has every picker** —
   client (`:76`), that client's purchases (`:77-78,121`), offering (`:75`), horse — **and all
   of them save as `|| null`** (`:162-175`). A notes-only lesson is a legal save.
3. **`save_calendar_item` never debits credits** (verified: zero references to
   `lesson_credits` in its body) and never creates a purchase. Picking a client changes
   nothing operationally — which is exactly why staff type "Melanie 3/8": **the note is the
   ledger.** Do not remove the notes habit until the system visibly does the counting
   (FLOWTRACE flagged this precisely — owner's punch-card counts are live procedure).
4. **No purchase has ever had a `payment_method`** (0 rows non-null, whole table) and **'cash'
   does not exist as a method anywhere** — the owner's design requires zelle AND cash, both as
   "needs to be paid" and "already paid".
5. **The client-side subject picker is absent, not broken**: `requestOpenTime` accepts an
   `offeringId` the call site never passes (`CalendarPage.tsx:720` per FLOWTRACE);
   `book_open_slot` picks a credit by oldest `purchased_at`. The parameter path exists —
   build the UI, pass it through.
6. **Reschedule-request machinery partially exists**: `requestBookingChange` +
   `RequestTimePanel` + `fetchRescheduleFee` are live in `CalendarPage.tsx` (~:501-538), and
   staff-side recurring bookings exist (`series_id` on bookings; the panel can create
   single or recurring). The monthly-plan reschedule flow should extend these, not duplicate
   them (the two-implementations rule — name the incumbent in your report).
7. **Backfill state when this spec was written**: Melanie O'Mea-Smith ×6, Marissa Robertson ×1,
   Serena Lee ×1 map unambiguously to client rows (the orchestrator may have applied this
   already — CHECK before redoing); Naomi Pouliot / Hannah Dryden / Gabriella Olenik exist as
   contacts with no client row; "Maddie" matches nothing; "Audrey 2/4" has two candidate
   contacts (Slater = has client row / Brennan = not), owner ruling pending.

# THE BUILD, in dependency order

## B1 — the pointer becomes required, with an escape that creates instead of skips
- A committed (non-draft) `kind='lesson'` booking **requires a client**. The panel's empty
  state offers "create the client" inline (the provisioning spine exists —
  `provision_client_invitation` family; reuse it, do not write a second client-creation path).
- Drafts and `unavailable`/open-slot items are exempt — they have no client by design.

## B2 — staff picks the item; the system does the accounting (owner's sentence, mechanized)
- Staff picks client + the purchased item being consumed (the purchases picker already
  exists). On commit: **debit that client's credits** for credit-backed items, **or create an
  order** (a `purchases` row through the same spine everything else uses — see FLOWTRACE §3 on
  the three order origins) when there's nothing to debit.
- Staff then marks payment state: needing-payment or already-paid, **via zelle or cash**. Cash
  must be added wherever payment methods live (check the constraint/enum on
  `purchases.payment_method` and every reader — PAYLOCK's report lists the payment-path
  readers). A cash payment still produces the same provable payment trail (status_events /
  receipt machinery — one spine, not a cash side-channel).

## B3 — client picks what they're booking against
- The booking panel (client side) gains the purchased-items picker feeding the `offeringId`
  parameter that already exists end-to-end. No more oldest-credit-wins guessing.

## B4 — monthly plans become assignable and real
- **Assigned and marked**: an active monthly plan on a client is explicit and visible (the
  purchase of a `config_kind='recurring'` offering IS the assignment — surface it as a marker
  on the client, don't invent a parallel table).
- **Recurring day**: settable (staff or client), producing the weekly series on the calendar —
  `series_id` machinery exists; extend it.
- **Reschedule**: the client can request moving a lesson to another day of the same week, or a
  different week later in the same month — through the existing request/approve machinery
  (B2's review side), never silent self-move.
- **No carryover — month boundary is a hard wall**: a month's lessons expire at month end.
  Wherever the entitlement is represented (credits minted per month, or period
  `fulfillment_units`), it must carry an expiry the boookkeeping enforces, and the UI must show
  "N left this month". ⚠️ COORDINATE: the pending credit-ledger fix (FLOWTRACE §8, restore
  `20260726010000`'s unit_count minting reverted by `20260802020000`) is upstream of this —
  monthly SKUs mint ZERO credits today. Whoever runs first, the other must not double-mint;
  say in your report exactly how monthly entitlements are represented and expired.

## B5 — the backfill completes
- Whatever remains unlinked after the orchestrator's 8-row backfill + the owner's rulings:
  link them, creating client rows via the spine where the person exists only as a contact.

# TRAPS
- **Writes must prove they landed** — `assertWrote()` everywhere; RLS silently zeroes UPDATEs.
- **A migration file must never contain BEGIN/COMMIT** (two threads corrupted prod dry-runs).
- **REVOKE/GRANT silent no-ops** — after any grant change, `has_function_privilege()` proof.
- **`test:db` may not be citable** — verify against prod with SQL; use the PGlite harness for
  new migrations (`test/db/paylock_finalize_payment_buyer_keys.test.ts` is the model).
- **Do not build a second implementation of anything** — purchases spine, provisioning spine,
  request machinery, series machinery all exist. Convergence, not greenfield.
- **Executed documents / signing freeze / D-rules in CLAUDE.md all stand.**

# OUT OF SCOPE
- The duplicate-page merge program (separate task), the kiosk, Zelle inbound matching,
  the review queue beyond what B2/B4's request path needs, ledger unification (flag, don't do).

# THE TEST THIS MUST PASS
1. A committed lesson cannot exist without a client pointer (prove: constraint or guarded RPC
   refuses; the panel offers inline client creation instead).
2. Staff books a credit-backed lesson → that client's balance visibly decrements, provably in
   the DB, and the calendar shows the lesson as the client's.
3. Staff books with nothing to debit → an order exists on the purchases spine, marked
   needing-payment or paid, via zelle or cash, with a provable trail.
4. A client books against a chosen purchased item and the booking records that choice.
5. A monthly-plan client has a marker, a recurring day producing calendar entries, a working
   reschedule request within the month — and provably zero usable entitlement from last month.
6. Melanie's four upcoming lessons render as HER lessons in her own calendar view.
7. Every DB claim proven by query output; every render claim listed NOT VERIFIED with a
   numbered owner checklist.

Report to `docs/reports/TASK-BOOKLINK-REPORT.md`. Do not push; the orchestrator merges.
