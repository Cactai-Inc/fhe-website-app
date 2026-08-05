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
| A8 | **Email fires on the completing signature**, both parties, PDF attached, signatures visible in the PDF | **DONE** (2026-08-05) — trigger→function→endpoint chain live-fired twice (manual dispatch + a real DRAFT→EXECUTED transition), new `document_deliveries` rows written each time, owner confirmed inbox receipt with correct PDF/signature. See `docs/reports/TASK-A8-REPORT.md`. |
| A9 | Email formatting and content correct (from-name, subject, body, branding) | **DONE** (2026-08-05) — owner confirmed from-name, subject, body, and branding correct on the live-fired test emails. See `docs/reports/TASK-A8-REPORT.md`. |
| A10 | Horse record stamped with lessee + lease dates on execution | **DONE** — verified live |
| A11 | Horse record VISIBLE to the lessee, showing them as lessee | **PARTIAL — server-verified, browser pending** (2026-08-04): `my_stable_horses()`/`horse_page_detail()` proven via psql (simulated lessee session, rolled back) to return the lease term + a new `viewer_is_lessee` flag; stable-card "Leased through <date>" and horse-page "You lease this horse through <date>" framing coded; dead `/app/stable` link fixed. No browser click has confirmed the UI renders this — see `docs/reports/TASK-A11-REPORT.md`. |
| A12 | Horse record shows the partial-lease schedule captured in the contract | **PARTIAL — server-verified, browser pending** (2026-08-04): `horse_page_detail()` extended with a top-level `lease` object (read-through from the active executed lease's `contract_fields`, not stamped), proven via psql against Beau's real executed lease (`days_used` = "Lessor: Tue, Thu, Sun; Lessee: Mon, Wed, Fri, Sat.", `lease_type` = PARTIAL, `schedule_terms` blank on that doc) and confirmed `null` for horses with no active lease. `HorsePageDetail` type + a "Lease" card on `HorsePage.tsx` record tab coded (term line reusing A11's viewer-framing, lease type, "Reserved days" preformatted, "Additional schedule terms"). No browser click has confirmed the UI renders this — see `docs/reports/TASK-A12-REPORT.md`. |
| A13 | Lessee can book lessons with that horse | **PARTIAL — server-verified, browser pending** (2026-08-04): shared `caller_may_use_horse(contact, horse)` helper (owner OR lessee-stamp-in-window OR active OWNER/LESSEE `horse_relationships` row) now backs both `attach_booking_horse` and `book_open_slot`'s lesson branch — the latter previously wrote `p_horse_id` through on lesson bookings with no validation at all. Proven live via psql (simulated lessee session, rolled back, zero residue): the helper returns true for the lessee on Beau and false for an unrelated contact; `attach_booking_horse` (real RPC) successfully attaches Beau to a throwaway lesson booking as the lessee; `book_open_slot`'s new lesson-branch gate rejects an unrelated horse. `CalendarPage.tsx` now shows the horse picker for lesson bookings too ("Which horse? (optional)"), gated on `listStableHorses()` returning ≥1 horse; care behavior unchanged. No browser click has confirmed the UI renders this — see `docs/reports/TASK-A13-REPORT.md`. |
| A14 | Contract-scoped EVENT LOG visible to admin (sent, opened, signed, delivered) | **DONE** (2026-08-04) — `contract_event_log(p_document_id)` RPC (staff-gated) unifies `status_events`/`document_deliveries`/`signatures`/`document_opened`/`contract_change_log`; staff-only "Activity" card on `ContractPage.tsx`, verified live against a real executed doc (8 events incl. SENT + SIGNED). See `docs/reports/TASK-A14-REPORT.md`. |
| A15 | **Delivery failures surfaced** — bounce/rejection raises a notification to admin | **DONE** (2026-08-05) — fixed the false-alarm source first (`send_executed_document_email`'s `net.http_post` had no timeout, so pg_net's 5000ms default recorded false timeouts on real 6-8s sends). New `sweep_undelivered_executed_documents()` (SECURITY DEFINER, service_role-only; reuses `undelivered_executed_documents()` as its candidate generator) runs hourly via `/api/delivery-sweep` (same cron auth posture as `expire-holds`/`calendar-reminders`), alerts staff once per document via `notify_staff` (kind `delivery_failure`) for an executed doc stamped >10min ago with a missing non-mirror delivery, then marks `executed_email_error` so it never repeats. Minors excluded for free (C10's guard trigger means a minor never carries a direct email, so the email-non-empty join already used by the reused finder drops them — both guardian-addressed and no-guardian-skipped cases, avoiding double-alerting with C10's own alert). Proven via a rolled-back synthetic-doc simulation (alert fires, marker writes, re-run is a no-op, zero residue after ROLLBACK) and a real live sweep run (0 alerts — correct, since all 37 current undelivered docs predate the stamp trigger and have a NULL `executed_email_sent_at`, exactly as predicted). KNOWN LIMITATION: true mailbox-level bounces (SMTP accepted, bounced later) are OUT OF SCOPE — Gmail SMTP gives no bounce webhook; not built. See `docs/reports/TASK-A15-REPORT.md`. |
| A16 | Admin notified when a party signs (as lessee AND as admin) | **DONE** (2026-08-04, `TASK-A16`) — characterization found `record_signature` already broadcast to staff on the *completing* signature only (`document_executed`, generic title, no doc id); no notification existed for a partial (non-completing) signature at all, so "NOT VERIFIED" was correct — the gap was real. Added ONE unified `notify_staff(org,'party_signed',...)` call, firing after every successful signature (partial or completing), best-effort/non-blocking (`BEGIN/EXCEPTION WHEN OTHERS`, mirrors `documents_send_executed_email`'s isolation — a notify failure can never block or roll back a sealed signature). Excludes company-side signing (staff signing on the company's behalf) even when it's the completing signature. The completing signature's title carries both facts ('&lt;title&gt; — fully executed; signed by &lt;name&gt; (&lt;role&gt;)') in one row; the prior staff-only `document_executed` broadcast for that same event was folded into this new call to avoid a duplicate row (the co-signer-facing `document_executed` notification to OTHER parties is untouched). Proven live via psql (simulated sessions, rolled back, `start_lease_contract_v2` + `record_signature` directly): individual partial signature → 2 rows (one per admin) with exact title/link; individual completing signature → 2 more rows titled "fully executed"; company-side completing signature → 0 new rows; zero residue after rollback (27 baseline notifications before and after). Kiosk `sign_release` has no notification and none was added — no existing precedent found for kiosk→staff signing alerts, and A16's tracker text is about contract parties; flagged as an open question for the orchestrator rather than assumed. See `docs/reports/TASK-A16-REPORT.md`. |
| A17 | Documents page: party opens any document and views the final PDF | **PARTIAL — server-side fix verified, browser pending** (2026-08-04, `TASK-DOCVIS`): root cause was `my_documents()` and the `documents_select` RLS policy keying off `documents.contact_id` alone, ignoring `document_parties`. Both now OR in `caller_is_document_party(id)` (`documents_select` policy; `caller_owns_document` itself left untouched since it also gates `signatures_insert_self`, a write path). Proven live via psql (simulated sessions, rolled back): LESSOR contact now sees the executed lease via `my_documents()` and direct `SELECT`; an unrelated contact still gets zero rows; a party-only UPDATE on the document and a party-only signature INSERT are both still RLS-rejected exactly as before. All 5 currently-EXECUTED production documents with a mismatched signer now resolve visible to that signer. LESSEE side still BLOCKED (company party, see A7). No browser click has confirmed the Documents page renders this — see `docs/reports/TASK-DOCVIS-REPORT.md`. |
| A18 | Documents page: self-send a copy | **PARTIAL — server-side fix verified, browser pending** (2026-08-04): unblocked by A17's fix (the page can now load a row to click "Send" from). Button's own correctness still unverified in-browser. LESSEE side BLOCKED. |
| A19 | Documents page: print / download | **PARTIAL — server-side fix verified, browser pending** (2026-08-04): unblocked by A17's fix, same as A18. LESSEE side BLOCKED. |

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

## I. USER-ACCOUNT NAV & MOBILE UX (owner spec 2026-08-04)

| # | Item | Status |
|---|---|---|
| I1 | Sidebar collapse/expand toggle: staff/admin only — removed entirely for USER accounts | **USER removal shipped + staff toggle code-complete, browser pending.** TASK I removed the ClientRail pin/hover toggle for USER accounts (fixed 240px, done). TASK I misread the spec as "nobody has it" — owner ruling 2026-08-05 clarified staff/admin GAIN the capability; see I1B. |
| I1B | Staff/admin sidebar collapse toggle (remediation of I1's missing half) + mobile menu button moved to header | **Code-complete, browser pending.** Recovered the old ClientRail pin/hover-to-peek pattern from git history (`cc39087^`) and rebuilt it on the staff rail only: pinned (240/256px) ⇄ collapsed (56px icon strip, tooltips, group headings → separators), `localStorage` key `staffRail.pinned`. Fill-only active state preserved, no gold ring reintroduced. `CommunityNav` regained a minimal collapsed icon-only branch. Mobile "Menu" trigger moved from in-content to the header (right of the F logo, `lg:hidden`), for both staff and USER layouts — single render site, no duplicate triggers. See `TASK-I1B-REPORT.md`. |
| I2 | Dynamic USER sidebar + avatar menu: links for Orders, Documents, Stable, My Posts, Saved Content appear ONLY once that page has ≥1 entry (empty → reachable via Account page only). Purpose: discoverability without instructions (horse entries, and Documents which every account starts non-empty) | **PARTIAL — code-complete, browser pending.** `my_nav_presence()` live in prod (orders/documents/stable/posts real EXISTS checks, saved hardcoded false — no backing data model exists, orchestrator ruling); wired into rail + avatar dropdown + mobile drawer. Found+fixed a pre-existing bug: SavedPanel showed fake seed items to every account regardless of SEED_ENABLED. See `TASK-I-REPORT.md`. |
| I3 | Mobile menu close button: the word "Close" (icon may stay alongside), visually prominent, larger; more padding in the menu header so it clears the highlighted Community button | **PARTIAL — code-complete, browser pending.** See `TASK-I-REPORT.md`. |
| I4 | Selected-page indicator: replace the dark-green fill (overpowering on the light UI, poor small-text contrast). Direction: slightly darker shade of the nav panel color, optionally a gold outline (matches gold link icons); if the darker shade alone reads clearly, drop the outline. Open-menu state on the close button uses the same dark shade | **PARTIAL — code-complete, browser pending.** Shipped with the gold ring (cream-200 fill alone judged too subtle against cream-100/white surroundings); one-line revert documented inline. Applied at all 7 render sites. See `TASK-I-REPORT.md`. |
| I5 | Community-feed expandability affordance: small "show" helper text + down arrow when collapsed; "hide" + up arrow when expanded (replaces the right arrow) | **PARTIAL — code-complete, browser pending.** See `TASK-I-REPORT.md`. |
| I6 | One canonical USER nav order (Community Feed, Dashboard, Calendar, Lessons*, Orders, Catalog, Documents, Messages, My Posts, My Stable, Account) across the mobile drawer, desktop USER rail, and the welcome/first-visit modal's page list; presence/module gating preserved; avatar menu untouched | **Code-complete, browser pending (auth-gated — could not log in under this task's no-DB-access constraint).** New shared `ClientNavItems` (AppLayout.tsx) drives both rail and drawer; `AppOverviewModal`'s `pageLines()` now takes the same `presence`/`lessonsOn` AppLayout threads in, so its list matches exactly (also wired into `Onboarding.tsx`'s tour instance, the other caller of the same modal). Lessons is module-gated (`hasModule('mod.lessons')`), pending owner confirm — one `lessonsOn &&` line to drop. Saved Content intentionally dropped from these 3 surfaces per the doc's explicit 4-item presence list (still reachable via Account page + avatar menu, untouched). See `TASK-UIPOLISH-REPORT.md`. |
| I7 | Green-glass surface (translucent green tint + backdrop-blur, `@supports` fallback) on the mobile drawer + desktop USER rail only (not the staff rail) | **Code-complete, browser pending — tint strength/legibility needs owner eyes on a real screen.** One shared `NAV_GLASS` constant (AppLayout.tsx); one-line revert to the prior `bg-cream-100` documented inline and in the report. Nav text/icon colors untouched. | 
| I8 | Community feed page: remove the smaller duplicate "Community Feed" label, increase padding above the remaining title by 35%, replace the tagline copy exactly | **Code-complete, browser pending.** `Home.tsx` eyebrow removed; `h1` top margin 0.125rem → 0.16875rem (`mt-[0.169rem]`). Tagline replaced in `FEED_VIEW_META.all.description` (`seed.ts`) — only the "All" view's copy, per the doc's exact quoted string. See `TASK-UIPOLISH-REPORT.md`. |
| I9 | Mobile menu open button: icon-only, square, no text, no outline, `PanelLeftOpen` from lucide | **Code-complete, browser pending.** Matches the header's existing icon-button treatment (Create/Calendar). See `TASK-UIPOLISH-REPORT.md`. |
| I10 | Header wordmark "French Heritage" centered + debossed (bold brand display serif); header logo replaced (favicon artwork, not the green "F" square) | **Code-complete, browser pending — deboss/shadow values are a starting point, needs owner eyes.** Brand font confirmed present (Cormorant Garamond, hosted via `index.css`'s Google Fonts `@import`, weight 700 available) — no STOP triggered. Shown for both USER and STAFF/ADMIN headers (no header-row collision found between them); superadmin's platform chrome is unchanged and never shows it. See `TASK-UIPOLISH-REPORT.md`. |

## J. ADMIN DOCUMENTS LIBRARY & DEALS VETTING (owner spec 2026-08-04)

| # | Item | Status |
|---|---|---|
| J1 | Admin Documents page redesigned as the business's document library: preset views (tabs or equivalent) by what a barn/equestrian business of this volume actually files — design informed by RESEARCH (orchestrator-owned) into what a business document storage system should contain, not guessed | **RESEARCH IN PROGRESS** |
| J2 | "+" button expanded to quick-create/add everything the admin routinely needs (inventory the app's existing create actions first; owner reviews the proposed list before build) | **NOT STARTED** |
| J3 | Deal adoption: a contract created independently of a deal can be brought into a deal afterward — create-deal-from-contract in the appropriate UI location, gracefully; deal_type/parties/consideration DERIVED from the contract's existing data (and other attached docs), not manually re-entered | **NOT STARTED** |
| J4 | Deal page post-creation editability: members/consideration/type are set once at creation and the UI offers no edit affordance afterward — everything manually set must be editable in place (owner spec 2026-08-05) | **NOT STARTED** |
| J5 | Deal-party vs contract-party divergence model: the two CAN legitimately disagree (deal with a company whose asset is titled in the owner's personal name, or vice versa) — no forced sync; the UI must show the linkage AND the divergence explicitly (e.g. deal party: the LLC · signs as: the person), so it's a visible fact, not an accident (owner spec 2026-08-05) | **NOT STARTED — design first** |

---

## Working order

1. **A8/A9 first** — email on execution with PDFs. Highest go-live risk.
2. **A2/A3/A4/A7 + A17–A19** — the party-side experience, browser-verified.
3. **A11–A13** — horse record visibility, schedule, lessee booking.
4. **A14–A16** — event log and failure notifications.
5. **B1–B3** — lead notifications.
6. **C4–C10** — the four kiosk pages.
7. **D, E, F, G** — flow upgrades, dual entry, lesson card, calendar status.
