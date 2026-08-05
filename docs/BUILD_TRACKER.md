# BUILD TRACKER — lease go-live, kiosk, and booking

**Rule:** an item is DONE only when its full pathway is traced — DB → RPC → API →
UI → the actual user-visible outcome — and verified live. "The function exists"
is not done. "It typechecks" is not done.

Status vocabulary: **DONE** (traced + verified live) · **BUILT** (code exists,
not verified end to end) · **PARTIAL** · **NOT STARTED** · **BLOCKED**.

Last updated 2026-08-04.

---

## A. LEASE GO-LIVE — required before the owner sends real leases

This is the critical path. Everything here must be DONE.

| # | Item | Status |
|---|---|---|
| A1 | Author a lease as admin; required-field gating names what is missing | **DONE** — verified 2026-08-03 live |
| A2 | Send to parties; each party can open it from their invite | **NOT VERIFIED** — party-controls bootstrap deadlock found by the verify pass (`TASK-A-PARTY-VERIFY`) and fixed same day (`TASK-PARTYCTRL`): all three starters now seed `document_party_controls`; 10 documents backfilled. Send-to-parties re-verification pending post-fix. |
| A3 | Lessor edits only lessor-owned fields; lessee-owned are inert to them | **BUILT** — server enforces; UI affordance added 2026-08-04. Verify attempt 2026-08-04 was blocked by the pre-fix bootstrap bug; re-verification pending post-fix. |
| A4 | A fully preconfigured contract presents nothing demanding review to the other party | **BUILT** — gated previews scope to unmade + owned selections. Verify attempt 2026-08-04 blocked by the pre-fix bootstrap bug; re-verification pending post-fix. |
| A5 | Approve → auto-lock when preconditions pass | **DONE** — verified live |
| A6 | Both signatures → EXECUTED | **DONE** — verified live (company-side signing was impossible before 2026-08-03; fixed) |
| A7 | Locked/executed contract is read-only to BOTH parties in the UI | **PARTIAL** (2026-08-04) — LESSOR verified live: PASS after fixing a stale "awaiting other party" message shown on already-executed docs (`ContractPage.tsx`, missing `!isExecuted` gate). LESSEE side BLOCKED — LESSEE is a company party; no login can ever represent it under the current model (see report finding 4; needs an admin "view-as-party" lens). |
| A8 | **Email fires on the completing signature**, both parties, PDF attached, signatures visible in the PDF | **NOT VERIFIED** — the single largest go-live risk |
| A9 | Email formatting and content correct (from-name, subject, body, branding) | **NOT VERIFIED** |
| A10 | Horse record stamped with lessee + lease dates on execution | **DONE** — verified live |
| A11 | Horse record VISIBLE to the lessee, showing them as lessee | **PARTIAL — server-verified, browser pending** (2026-08-04): `my_stable_horses()`/`horse_page_detail()` proven via psql (simulated lessee session, rolled back) to return the lease term + a new `viewer_is_lessee` flag; stable-card "Leased through <date>" and horse-page "You lease this horse through <date>" framing coded; dead `/app/stable` link fixed. No browser click has confirmed the UI renders this — see `docs/reports/TASK-A11-REPORT.md`. |
| A12 | Horse record shows the partial-lease schedule captured in the contract | **PARTIAL — server-verified, browser pending** (2026-08-04): `horse_page_detail()` extended with a top-level `lease` object (read-through from the active executed lease's `contract_fields`, not stamped), proven via psql against Beau's real executed lease (`days_used` = "Lessor: Tue, Thu, Sun; Lessee: Mon, Wed, Fri, Sat.", `lease_type` = PARTIAL, `schedule_terms` blank on that doc) and confirmed `null` for horses with no active lease. `HorsePageDetail` type + a "Lease" card on `HorsePage.tsx` record tab coded (term line reusing A11's viewer-framing, lease type, "Reserved days" preformatted, "Additional schedule terms"). No browser click has confirmed the UI renders this — see `docs/reports/TASK-A12-REPORT.md`. |
| A13 | Lessee can book lessons with that horse | **PARTIAL — server-verified, browser pending** (2026-08-04): shared `caller_may_use_horse(contact, horse)` helper (owner OR lessee-stamp-in-window OR active OWNER/LESSEE `horse_relationships` row) now backs both `attach_booking_horse` and `book_open_slot`'s lesson branch — the latter previously wrote `p_horse_id` through on lesson bookings with no validation at all. Proven live via psql (simulated lessee session, rolled back, zero residue): the helper returns true for the lessee on Beau and false for an unrelated contact; `attach_booking_horse` (real RPC) successfully attaches Beau to a throwaway lesson booking as the lessee; `book_open_slot`'s new lesson-branch gate rejects an unrelated horse. `CalendarPage.tsx` now shows the horse picker for lesson bookings too ("Which horse? (optional)"), gated on `listStableHorses()` returning ≥1 horse; care behavior unchanged. No browser click has confirmed the UI renders this — see `docs/reports/TASK-A13-REPORT.md`. |
| A14 | Contract-scoped EVENT LOG visible to admin (sent, opened, signed, delivered) | **DONE** (2026-08-04) — `contract_event_log(p_document_id)` RPC (staff-gated) unifies `status_events`/`document_deliveries`/`signatures`/`document_opened`/`contract_change_log`; staff-only "Activity" card on `ContractPage.tsx`, verified live against a real executed doc (8 events incl. SENT + SIGNED). See `docs/reports/TASK-A14-REPORT.md`. |
| A15 | **Delivery failures surfaced** — bounce/rejection raises a notification to admin | **NOT STARTED** |
| A16 | Admin notified when a party signs (as lessee AND as admin) | **NOT VERIFIED** |
| A17 | Documents page: party opens any document and views the final PDF | **FAIL** (2026-08-04, LESSOR) — `documents.contact_id` is a single-owner column; `my_documents()` and the `documents_select` RLS policy both key off it alone, ignoring `document_parties`. A genuine LESSOR signer is invisible to their own Documents page. **Confirmed live production impact: 5 currently-EXECUTED documents today have a real signer who can't see it.** LESSEE side BLOCKED (company party, see A7). Needs an RLS + RPC fix. See report finding 3. |
| A18 | Documents page: self-send a copy | **FAIL** (2026-08-04, LESSOR) — cascades from A17: the page never loads a row to click "Send" from. Button's own correctness unverified (unreachable, not confirmed-broken). LESSEE side BLOCKED. |
| A19 | Documents page: print / download | **FAIL** (2026-08-04, LESSOR) — cascades from A17, same as A18. LESSEE side BLOCKED. |

## B. LEAD / INBOUND NOTIFICATIONS

| # | Item | Status |
|---|---|---|
| B1 | Website form submission emails hello@fhequestrian.com | **NOT VERIFIED** |
| B2 | In-app notification on submission | **NOT VERIFIED** |
| B3 | Persistent unread indicator on the Inbound nav button | **NOT VERIFIED** |

## C. KIOSK SELF-ONBOARDING (additive — old URLs stay live)

| # | Item | Status |
|---|---|---|
| C1 | GUEST is a real category (constraints, derivation, standing categories) | **DONE** — verified live 2026-08-04 |
| C2 | GUEST document set (RELEASE_GENERAL, COMPANY_POLICIES, FACILITY_RULES) | **DONE** — verified live |
| C3 | Promotion at purchase; document sets union, never strip | **DONE** — verified live (found + fixed a stripping bug) |
| C4 | `/sign/guest` page | **NOT STARTED** |
| C5 | `/sign/rider` page | **NOT STARTED** |
| C6 | `/sign/horse` page | **NOT STARTED** |
| C7 | `/sign/rider+horse` page | **NOT STARTED** |
| C8 | Pre-submit screen: welcome copy, eligible services, email + confirm-email, deliverability guidance, vCard contact button | **NOT STARTED** |
| C9 | Reuses the EXISTING activation email + link (no parallel sender) | **NOT STARTED** |
| C10 | Minor downstream rules (no outreach to minors, guardian-addressed) | **DONE** — built + verified live 2026-08-04, see `docs/reports/TASK-C10-REPORT.md` |

## D. ONBOARDING FLOW UPGRADES (serves invite AND kiosk paths)

| # | Item | Status |
|---|---|---|
| D1 | Flow shows the person's orders and the offerings they contain | **NOT STARTED** |
| D2 | Calendar shown for booking when the purchase is bookable | **NOT STARTED** |
| D3 | Create a new order from within the flow (modal over calendar) | **NOT STARTED** |
| D4 | Payment inside the same modal; on confirm, modal closes and calendar refreshes | **NOT STARTED** |
| D5 | Purchased offerings appear as bookable credits | **BUILT** — credits granted on payment, verified; surfacing in-flow not started |

## E. DUAL-ENTRY BOOKING (calendar-first OR catalog-first)

| # | Item | Status |
|---|---|---|
| E1 | Cart line can carry a chosen slot | **NOT STARTED** — `CartItem` has no slot field |
| E2 | Slot HOLD so a selected time is not sold twice before payment | **NOT STARTED** — `expire-holds` cron exists; coverage unverified |
| E3 | Calendar-first: pick time → pick offering → checkout | **NOT STARTED** |
| E4 | Catalog-first: pick offering → optionally attach slot → checkout | **NOT STARTED** |
| E5 | Skip-booking path: buy now, book later from credits | **PARTIAL** — credits + `book_open_slot` work; no in-flow path |
| E6 | Checkout shows order contents, attached bookings, prices, total | **PARTIAL** — checkout exists; no booking lines |

## F. LESSON CARD & HORSE ON BOOKING

| # | Item | Status |
|---|---|---|
| F1 | Lesson card in calendar right-side panel | **NOT STARTED** |
| F2 | Same card on the lessons page (one record, two views) | **NOT STARTED** |
| F3 | Rider notes / questions field | **CODE-COMPLETE, BROWSER PENDING** — `SessionNotesView.tsx` (read+write, phase-derived pre/post, grouped thread) mounted on `CalendarPage.tsx`'s detail panel and `MyLessons.tsx`'s upcoming-lesson cards; live write proof via rolled-back psql RPC call, browser verification not yet done |
| F4 | Instructor pre-lesson notes | **BUILT** — `booking_notes` has phase + author_role; staff UI exists: `LessonLogEditor.tsx:104` has a phase-selectable compose |
| F5 | Instructor post-lesson notes | **BUILT** (same — `LessonLogEditor.tsx:104`) |
| F6 | Rider selects their own horse on the booking | **BUILT** — `attach_booking_horse` verified to exist; no UI |
| F7 | Default lesson horse for riders with one/several horses | **NOT STARTED** |
| F8 | Retroactive attach when a horse record is created after booking | **NOT STARTED** |
| F9 | Barn-supplied horse hidden from rider until the lesson happens | **NOT STARTED** |

## G. CALENDAR DOCUMENT STATUS

| # | Item | Status |
|---|---|---|
| G1 | Staff calendar shows whether a client's documents are complete | **NOT STARTED** |
| G2 | Client calendar shows their own outstanding documents | **NOT STARTED** |
| G3 | 48-hour reminder before a booking when documents are incomplete | **NOT STARTED** |

## H. DEFERRED BY DECISION (do not build yet)

| # | Item | Why |
|---|---|---|
| H1 | Order revision: swap a line, credit or bill the difference | Money model undecided; credits are sessions-only integers, no balance exists — see `CREDIT_AND_BALANCE_AUDIT.md` |
| H2 | Horse capacity + rider matching + autonomous booking | Blocked on real horses (P1) and the skill vocabulary (P5) — see `AUTONOMOUS_BOOKING_SPEC.md` |
| H3 | Removing the old kiosk URLs | Owner ruling 2026-08-04: additive only, nothing ripped out |

---

## Working order

1. **A8/A9 first** — email on execution with PDFs. Highest go-live risk.
2. **A2/A3/A4/A7 + A17–A19** — the party-side experience, browser-verified.
3. **A11–A13** — horse record visibility, schedule, lessee booking.
4. **A14–A16** — event log and failure notifications.
5. **B1–B3** — lead notifications.
6. **C4–C10** — the four kiosk pages.
7. **D, E, F, G** — flow upgrades, dual entry, lesson card, calendar status.
