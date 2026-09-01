# TASK-REQCARDS — the request card is an action surface, and both ends press buttons

**Source:** CR-99 entire + CR-98 steps 11–14. **Authored by DSGN-2, 2026-09-01.**
**Standing requirements:** `docs/method/TASK-ROLE.md`.
**Must merge first:** `TASK-LIFECYCLE` (the machine) and `TASK-SIGNBOOK` (the `requested` bookings
these cards act on).
🔒 **THE SHAPE (§9) NEEDS THE OWNER'S EYES BEFORE BUILD** — card style and cluster location are his
open questions (*"a dedicated style and possibly a location"*). ORCH: route §9 to him first.

## 1 · THE OWNER'S WORDS
> *"we need a dedicated style and possibly a location where these cluster when there are more than
> one shown at a time, for the type of card that shows an order and/or booking request. the
> notification cards need to enable actions … seeing the contact information so we can contact the
> client, suggesting a different date and/or time, approving an order and/or approving a booking
> request and marking an order paid."*

> *"status should set automatically for the calendar entry based on the stage of approval and
> payment … each seqential interaction that advances the order's payment status being the result of
> a button clicked by either party as required by the software."*

And CR-98 steps 11–14: approve → client notified payment due → deep link opens the payment modal on
the dashboard → PAY CASH · PAY WITH ZELLE → staff confirm → `scheduled`; the Zelle close-out button
lives **on the staff notification**.

## 2 · MEASURED (2026-09-01, main @ 475f1724 — re-run, don't trust)
- **No staff request-card surface exists.** `grep -rn "RequestCard" src/` → nothing; FLOWTRACE
  (2026-08-13) found no review queue; DAYSHEET (2026-08-24) confirmed pending/approval never wired.
  The CARD is greenfield; everything it CALLS is not:
- **The client payment half is built**: `src/components/order/OrderPayment.tsx` — cash/zelle choice,
  zelle reference, tap-to-copy details, "actually the other method" switch, `reportMyPayment`.
  CASHCONFIRM gave staff the claims bucket reusing `mark_purchase_paid`; ZELLECLOSE closed the Zelle
  loop. BACKDATE (2026-09-01) just touched `mark_purchase_paid` — build on ITS current shape.
- **The alert spine exists** (`submitRequest` path); `PaymentReviewPage.tsx` is prior art for a
  staff review surface.
- The six states and their transitions are TASK-LIFECYCLE's — including `pending` = approved
  awaiting payment.

## 3 · THE INCUMBENT — greenfield card, convergent actions
The card and its cluster are NEW (D18 check done — nothing does this today). **Every action on it
must be a call to something that exists**: approve → LIFECYCLE's transition; contact info → the
contact record; suggest-a-time → LIFECYCLE's hold/reschedule shape; mark-paid →
`mark_purchase_paid` (never a second writer — that RPC was overwritten live once already, BOOKS1).

## 4 · WHY THIS IS ONE CHUNK AND NOT TWO
CR-99's staff card and CR-98's client payment modal are **the two ends of one ping-pong**: approve
(staff button) → pay (client button) → confirm (staff button) → `scheduled` (derived). The ledger
itself says CR-99 *"IS CR-97's state machine seen from the staff side."* Two specs would define the
same transitions twice — the exact D18 failure. One chunk, both ends.

## 5 · THE WORK
1. **The staff card**: one component, one style, rendering an order and/or booking request; a
   dedicated cluster location when more than one is live (§9 shape — owner first). Actions:
   contact details · suggest a different date/time · approve order · approve booking · mark paid ·
   confirm Zelle received (CR-98 step 14: on the notification itself).
2. **The client side**: dashboard notification + email deep link → the dashboard opens **the payment
   modal for that order** (CR-98 step 12: from email → browser → logged-in dashboard → modal).
   The modal is `OrderPayment` relocated out of the onboarding wizard (SIGNBOOK moves it; this task
   gives it its modal home) — order, total due, PAY CASH · PAY WITH ZELLE, per CR-98 step 13,
   including the close-the-notification behaviour on completion.
3. **Status is DERIVED, never typed**: the calendar entry's status follows approval+payment stage
   automatically. No status dropdown anywhere in this task. Every advance = one button, one side.
4. **Notifications close when their act completes** (steps 13–14): paid-cash notice clears on staff
   confirm; Zelle notice clears on the client's "I sent it"; staff's Zelle card clears on
   mark-paid.

## 6 · THE TRAPS
1. ⚠️ **The second machine** (D18, named in the ledger): no new status enum, no card-local state
   that shadows the booking's. The card READS LIFECYCLE's state and CALLS its transitions.
2. ⚠️ **One payment writer.** `mark_purchase_paid` only — it has been overwritten live (BOOKS1) and
   reverted three times on the mint bug (CREDITFIX). Mint stays keyed to payment confirmation.
3. ⚠️ **Notification ≠ record** (FLOWTRACE's two-ledger lesson): the card renders from the
   requests/bookings tables, not from a copy stored in the notification. A dismissed notification
   must not orphan a live request.
4. ⚠️ **Deep link auth**: step 12's email link must land through login without dropping the target
   order (return-destination handling exists — `wallReturn` is prior art).
5. ⚠️ **Suggest-a-different-time** must be LIFECYCLE's hold/`Pending reschedule` shape, not a free
   rewrite of the booking.
6. ⚠️ **Supabase errors are not Error instances** — machine-code branches on these staff actions
   must not go through `instanceof Error` (ERRSWEEP; use the `toErrorMessage`/`useAsync` idiom).
7. ⚠️ **New RPCs get explicit REVOKE** — default privileges re-grant anon on fresh functions
   (BOOKS1 trap).

## 7 · OUT OF SCOPE
The wizard (SIGNBOOK). The door (SIGNDOOR). Calendar month-view rendering (AR1's complaint, not
this). Any payment method beyond cash/Zelle.

## 8 · THE REACH
**Staff:** the dashboard's card cluster (location per owner's §9 answer) — and the same actions
must be reachable from the notification email. **Client:** the dashboard notification, and the
email link that opens the same modal. For each: is that the only way? Say so in the report.

## 9 · THE SHAPE — needs the owner before build
- **Cluster location:** proposed: a dedicated "Requests" band pinned at the top of the staff
  dashboard, collapsible count-badge when >3.
- **Card anatomy:** header = who + what (order / booking / both) · body = items, total, requested
  date/time, current stage · footer = the stage's ONE next action prominent, secondary actions
  (contact, suggest time) quiet.
- **States the card passes through:** requested → approved/payment-due → paid-claimed →
  scheduled/closed; plus empty (no cards) and error (action failed, card says so inline).
- **Client-side modal:** order summary, total, two payment buttons; cash → confirmation page;
  zelle → details + "I sent it"; closed = notification gone.
- Audiences: staff see the cluster; the client sees only their own notification + modal.

## 10 · THE TEST THIS MUST PASS *(from CR-98 steps 11–14 + CR-99)*
1. A `requested` booking+order renders ONE card in the cluster; approve on the card → client is
   notified payment is due (notification + email). *(11)*
2. The client's email link lands them, logged in, on the dashboard with the modal open for that
   order. *(12)*
3. CASH: records method, notifies staff, staff confirm → booking flips to `scheduled`, both
   notifications clear. *(13/14, and the derived-status quote)*
4. ZELLE: details shown → "I sent it" → staff card gains "mark paid" ON the notification → clicking
   it marks paid via `mark_purchase_paid` (query the payment row) → `scheduled`. *(13/14)*
5. Contact-details and suggest-a-time actions work from the card; suggest-a-time produces
   LIFECYCLE's reschedule state, visible to the client.
6. Nowhere in the diff is a typed/selectable status; every state change in the test above happened
   via a button press by the side the software required.
7. Multiple simultaneous requests cluster in the agreed location; zero requests renders the agreed
   empty state.

## 11 · THE REPORT
`docs/reports/TASK-REQCARDS-REPORT.md`. Worktree from the first edit.

---

# ⚠️ REQUIRED READING ADDED 2026-09-01 BY ORCH6 — §9 IS SUPERSEDED

🔒 **`CR-99` ASK-OWNER **A2** IS ANSWERED** in `/Users/cactai/Downloads/claude-code-repo/fhe-website-app/docs/reference/CHANGE-ORDER-LEDGER.md` — search `## CR-99 · A2`.
**IT SUPERSEDES §9 OF THIS SPEC. Do not build §9's proposed card anatomy or its "Requests band".**

**The owner's ruling, in short:**
- ⚠️ **ONE SPECIFIC SPOT ON THE DASHBOARD LISTING ALL NEW REQUESTS — leads, bookings, orders,
  "etc."** **Not an orders band. One inbox of new requests, whatever kind they are.**
- 🔒 **THE SHAPE IS WHATEVER THE SYSTEM ALREADY BUILDS. Do NOT design a new card** (D18). **The
  only requirement is that it CARRIES the five functions already specified in CR-99:** see the
  contact information · suggest a different date and/or time · approve the order · approve the
  booking · mark it paid.

⚠️ **Verify this spec's premises against production before building — a sibling thread proved one
of its own spec's traps wrong on 2026-09-01, and it was the load-bearing one (D20).**
