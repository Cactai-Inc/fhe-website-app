# FLOWS — BOOKING (public request · authenticated session · recurring)

**Traced at main `c56559e` (2026-08-20), prod read-only.**
Areas touched: **Public site** (funnels, questions, checkout) · **Member app** (Calendar,
My Lessons) · **Management** (Records → Leads, Payment review) · **Modules → Lessons**
(SessionsPage) · mail edge + 3 of the 5 crons.
Incumbents absorbed: FLOWTRACE §§6–10, CLOSEOUT §§2–3, RETEST steps 1–24,
LESSONREQUEST/CAREPATH findings via FLOW-PROGRAM-WAVES.

---

## F4 — Public booking request (the unauthenticated funnel)

TRIGGER      Visitor opens a funnel: `/lessons` (Header "Book a Lesson"), `/horse`
             (Header "Horse Care Services"), `/acquisition` (Header "Find a Horse"),
             `/contact` ("Say Hello"), `/gift` (footer + funnel links) — SURFACE-INVENTORY
             §1 rows. `/book/rider` now redirects to `/lessons` (CLOSEOUT §3.6).
ACTORS       visitor (lead) · staff · system: `api/request-received.ts`,
             `api/inquiry-confirmation.ts`, mail provider.
PRECONDITION None. Cart lives in `sessionStorage`.

SEQUENCE
1. Visitor adds items; the tracker derives its step count (CLOSEOUT §3.1). Items that ask
   questions route through `/questions` (the ASKRIGHT engine: question sets keyed on
   service_type+subject, shared questions asked once, inference fills and yields —
   RETEST steps 8–16 own the render proof). Lessons-only carts skip straight to
   `/checkout` (ASKRIGHT 10).
2. `/checkout` (`InquiryForm.tsx:208`) → `submitRequest` (`src/lib/api.ts`) →
   `submit_public_request` RPC (api.ts:79) — SECURITY DEFINER; riding-experience is now
   enforced server-side from the same `intake_requirements` row the form reads
   (CLOSEOUT §3.4, refusal writes nothing).
3. The RPC inserts `requests` (+ draft order lines) and fires the in-app staff
   notification (request-received.ts header). Trigger `requests_capture_contact_trg`
   links/creates the contact and lead (REQTRIGGER fix ab283cb).
   → *Visitor sees `/confirmation`; staff see "New inquiry" in-app.*
4. `submitRequest` then dispatches BOTH alert emails from the one spine
   (api.ts:121-122): `/api/request-received` → tenant ops inbox (full submission read
   back from the row, never from the caller) and `/api/inquiry-confirmation` → the
   submitter's own copy ("not a booking confirmation" by design). Every attempt writes
   `request_alert_sends` (kind `staff` / `buyer`).
5. Staff open the lead (Records → Leads; the lead page shows the submission, its draft
   order, and every answer with readable labels — ASKRIGHT 15/RETEST 20), agree a time on
   the phone, and provision (F1) with the agreed-lesson panel — request flips
   `new → invited → converted`.

NOTIFIES     staff ops-inbox email + buyer confirmation email per submission
             (`request_alert_sends`, both kinds; prod holds 2 staff rows, `succeeded=true` —
             the only proven real sends in the whole system) · in-app staff notification.
TERMINAL     `requests` row `status='converted'` with a stamped invitation, or worked
             `contacted`. Prod today: `new 9 · contacted 6`, channels `booking 6 · kiosk 9`.
VARIANTS     gift enquiry (`src/lib/gifts.ts:145` routes through the same `submitRequest`
             spine — GIFTPATH closed the raw-insert bypass) · kiosk participant flow files
             `channel='kiosk'` (onboarding.md F3) · mixed carts are filed under the funnel
             the visitor stood in (CLOSEOUT §3.3 — owner question still open).
BREAKS
1. **Entries that never reach the alert spine (the task's explicit question):**
   - `/release` — no request row at all (onboarding.md F3-BREAKS-1). **BROKEN.**
   - `/sign/*` self-onboarding — provisions an account with no request row and no staff
     alert (onboarding.md F2-BREAKS-2). **BROKEN.**
   - Everything else (contact, funnels, gift, participant kiosk) now converges on
     `submitRequest`. **WORKS (server-proven); sends UNPROVEN.**
2. **UNPROVEN** — the email pair has succeeded exactly twice in history; no send has been
   observed for gift or kiosk categories. RETEST steps 1–2.
3. **Inherited (CLOSEOUT §3.3)** — no `mixed` category exists; a mixed cart under-files.

---

## F5 — Authenticated session booking (the logged-in path)

TRIGGER      Member opens `/app/calendar` (ClientNavItems, AppLayout.tsx:1085).
ACTORS       member · staff (confirmer) · system: `calendar-reminders` +
             `notifications-nudge` crons.
PRECONDITION Account active, wall down; a spendable `lesson_credits` row (credit-gated),
             or the book-and-pay path (BOOKLINK debit-or-create).

SEQUENCE
1. Availability renders from `bookings` rows with `status='available'`
   (published by `_publish_open_slots_for_org`; prod: 275 available vs 43 scheduled —
   always qualify which kind of "booking" is meant).
2. Member books: `CalendarPage.tsx:573` → `bookOpenSlot(slotId, horseId, creditId)` →
   `book_open_slot` (prod body read this trace): validates the slot, spends the **chosen**
   credit when `p_credit_id` is passed (the picker exists now — FLOWTRACE item 7's
   "no picker" is FIXED at the RPC seam), otherwise falls back to
   `ORDER BY (offering_id = v_offering) DESC NULLS LAST, purchased_at`; horse-care docs
   gate raises `HORSE_CARE_DOCS_REQUIRED` and the UI surfaces the generated list
   (CalendarPage.tsx:578).
3. The booking is written **`status='pending'`** — the prod body's own comment:
   `-- status lands 'pending' (was 'scheduled' — FLOWTRACE item 10)`. Item 10 is FIXED.
   → *Member sees "requested"; staff see it as a pending item.*
4. Custom time: `CalendarPage.tsx:919` → `requestOpenTime({…, offeringId})` — the
   parameter FLOWTRACE §9 found dropped is now passed. Member may withdraw while pending
   (`withdrawMyPendingBooking`; a pending booking is editable, not negotiable —
   ONBOARD §7 comment at CalendarPage.tsx:560).
5. Staff confirm: `CalendarItemPanel.tsx:476` Confirm button (gate `status==='pending'` —
   now a state real bookings actually hold) → `confirmBooking` (CalendarPage.tsx:1093) →
   `confirm_booking`: pending/pending_slot/pending_payment → `scheduled` (lesson) or
   `confirmed`, approves any pending change rows, notifies. Staff refusal is still
   `delete_calendar_item` (CalendarItemPanel.tsx:450) — see BREAKS 2.
6. Change/cancel: member `requestBookingChange` → staff `decideBookingChange`
   (CalendarPage.tsx:1084) — `_refund_booking_credit` fires on decide/withdraw/delete/swap
   (prod dependency scan, this trace).
7. Delivery of the session: staff run it from SessionsPage or the calendar —
   `complete_lesson_session` flips `scheduled → completed` and links the spent credit
   (prod body), which is also what consumes the fulfilment unit (fulfilment.md F14).
8. Reminders: `calendar_reminder_sweep` (hourly cron `/api/calendar-reminders`) writes 1h/2h
   in-app reminders and emails `booking_%` notifications inside the 06:00–21:00 PT window,
   with a copy to the ops inbox.

NOTIFIES     booking pending/confirmed/changed notifications in-app; emails only via the
             hourly calendar cron and daily nudge — **neither cron has ever been observed
             running** (OPEN-ITEMS §4), so every email step here is UNPROVEN.
TERMINAL     `bookings.status='completed'` + credit consumed + unit consumed.
             Prod today: 43 scheduled, 1 cancelled, **0 completed ever** — the tail of this
             flow has still never run for a real client.
VARIANTS     book-and-pay (no credit): BOOKLINK B1-B4 debit-or-create (`swap_booking_item`
             covers item changes) · gift-credit bookings · staff-made bookings for a client
             (`schedule_lesson_session` from LeadWorkDrawer.tsx:271 / SessionsPage.tsx:178).
BREAKS
1. **BROKEN (inherited, LESSONREQUEST F1 — spot-confirmed unchanged)** — no tenant
   timezone: 12 live functions render UTC into client-facing text ("your 4pm lesson at
   11:00 PM"). Cross-flow; also hits F6 and contracts notifications.
2. **PARTIAL (FLOWTRACE item 11, half-fixed)** — Confirm now works (pending is real), but
   refusal is still a hard `DELETE` with `_refund_booking_credit` and **no notification to
   the client**; no reject-with-reason, no counter-offer surface. The queue is the
   calendar itself.
3. **Inherited (FLOWTRACE §10)** — `trg_status_bookings` writes booking events as
   `entity_type='offering'`; the audit trail misfiles every booking event.
4. **Ownership columns (W6, standing)** — three owner columns on `bookings`; 32 of 43
   scheduled rows have NULL `account_contact_id`. Any reader must say which column it
   filters on; `bookings_claim_on_account_link_trg` (profiles trigger) back-claims on
   account link.
5. **UNPROVEN** — all renders and all emails (RETEST 25, 38).

---

## F6 — Recurring plans (care plans / monthly allotments)

TRIGGER      Purchase of a `config_kind='period'` SKU (member checkout or provisioning), or
             staff setting the plan's days.
ACTORS       member · staff · system: `/api/mint-monthly-allotments` (daily 08:20 cron).
PRECONDITION The plan's order is **paid** (D9 prepaid gate) — see BREAKS 1.

SEQUENCE
1. Purchase mints month 1 at order-open: `trg_mint_credits_when_order_opens` /
   `trg_mint_purchase_credits` → `_mint_credits_for_purchase_item` — **mint is
   `unit_count × quantity` off the catalog row** (prod body: "A session pack mints
   unit_count × quantity"; the FLOWTRACE F8 name-regex is GONE — CREDITALIGN live).
   A draft order mints nothing (CLOSEOUT §2.1 bonus proof).
2. Staff pick the days: `CalendarItemPanel.tsx:238` → `setRecurringDays` →
   `set_recurring_days` — the chosen days ARE the entitlement (CAREPLANS).
3. `CalendarItemPanel.tsx:262` → `generateMonthlyLessons` → `generate_monthly_lessons` →
   `_generate_plan_month`: one booking per chosen day, each spending one allotment credit
   from the plan's own line — proven to agree exactly (CLOSEOUT §2.1 walk21: 5 == 5).
4. Month roll: the daily cron calls `mint_recurring_allotments()` — idempotent on
   `(purchase_item_id, period_start)`, gated on `payment_status='paid'` and
   `plan_ends_on` (prod body read this trace).

NOTIFIES     Nothing plan-specific; generated bookings ride F5's notification spine.
TERMINAL     Each month: `lesson_credits` row for the period, bookings placed on chosen
             days, credits spent to zero (walk21's shape).
BREAKS
1. **BROKEN today by data, not code** — every purchase in prod is `unpaid` (4 of 4), so the
   paid-gated cron mints **nothing for anyone**. Until the payment tail (commerce.md F10)
   is exercised, month 2 of every plan silently fails to exist. The code is proven
   (walk21); the flow is not.
2. **UNPROVEN** — the cron itself has never been observed running (no vercel log access,
   no minted row to date it by). What would prove it: one `lesson_credits` row whose
   `period_start` is a month after its sibling with no staff actor in the audit trail.
3. **Inherited (CAREPATH test 10)** — a weekly ×2 item still takes only one weekday;
   parked with TASK-CAREPLANS.
