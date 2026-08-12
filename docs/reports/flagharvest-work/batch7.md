# FLAGHARVEST batch7 — extracted items

## TASK-A12-REPORT.md

### ITEM
- report: TASK-A12-REPORT.md
- date: 2026-08-04
- item: The A11 "Leased to"/"Your lease" line inside the Location card was left untouched, out of scope, and is not simply redundant with the new Lease card.
- quote: "The pre-existing "Leased to"/"Your lease" line inside the "Location" card (A11) was left untouched — out of this task's scope"
- kind: correctness
- artifacts: src/pages/app/HorsePage.tsx
- decision-mention: none

### ITEM
- report: TASK-A12-REPORT.md
- date: 2026-08-04
- item: No browser step ran; the UI (Lease card, HorsePageDetail type) is code-complete and typecheck-clean but not visually confirmed. Tracker marked PARTIAL.
- quote: "No browser step ran in this task — the UI ... is code-complete and typecheck-clean but has not been visually confirmed in a browser."
- kind: not-verified
- artifacts: src/pages/app/HorsePage.tsx, src/lib/horses.ts, docs/BUILD_TRACKER.md
- decision-mention: none

## TASK-A14-REPORT.md

### ITEM
- report: TASK-A14-REPORT.md
- date: 2026-08-04
- item: STATUS detail renders the raw status label, not a from→to string, because status_events has no "from" column — a deviation from the doc.
- quote: "STATUS `detail` is the raw status label, not a from→to string — `status_events` has no "from" column; fabricating one would violate the doc's own "do not invent" instruction"
- kind: correctness
- artifacts: status_events, contract_event_log
- decision-mention: none

### ITEM
- report: TASK-A14-REPORT.md
- date: 2026-08-04
- item: The DELIVERED kind is declared in the doc's vocabulary but never emitted because document_deliveries has no send/delivered distinction.
- quote: "`DELIVERED` kind is declared but never produced (see above) — data has no send/deliver distinction"
- kind: correctness
- artifacts: document_deliveries, contract_event_log
- decision-mention: none

### ITEM
- report: TASK-A14-REPORT.md
- date: 2026-08-04
- item: OPENED kind was added beyond the doc's four required kinds, from a real document_opened table the doc did not anticipate existing.
- quote: "`OPENED` kind was added beyond the doc's four required kinds — a real source (`document_opened`) exists"
- kind: correctness
- artifacts: document_opened, contract_event_log
- decision-mention: none

### ITEM
- report: TASK-A14-REPORT.md
- date: 2026-08-04
- item: The non-staff rejection was not live-tested (no party JWT minted); evidence is citation of an identical guard on publish_open_slots.
- quote: "I did not mint a party JWT (no test-user session available in this worktree). Evidence is the citation + identical-guard argument ... No live negative test was run."
- kind: not-verified
- artifacts: contract_event_log, publish_open_slots, has_staff_access()
- decision-mention: none

## TASK-ACCOUNTSURFACE-REPORT.md

### ITEM
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: The two nav call sites in AppLayout.tsx still point at /app/account?section=stable; until ONEMENU repoints them the Stable nav is not a direct link (works only via redirect).
- quote: "the two nav call sites in `AppLayout.tsx` still point at `/app/account?section=stable` — that file is ONEMENU's, not touched here."
- kind: blocked-on-owner
- artifacts: AppLayout.tsx, /app/stable, /app/account
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: My Posts' "+ Post" create button stays page-only; no create control was added to the Account panel's inline version — a considered omission flagged for the owner.
- quote: "My Posts' "+ Post" button (PLUSPASS) stays page-only ... Flagging it as a considered omission, not an oversight, in case the owner wants it added."
- kind: blocked-on-owner
- artifacts: MyPostsContent, AccountPanels.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: The Google-switch "or is switching to one" clause is unimplemented; no client-observable signal exists for an in-flight email-change-to-Google.
- quote: ""Or is switching to one" I did not implement — I found no client-observable signal for an in-flight email-change-to-Google anywhere in the codebase"
- kind: not-verified
- artifacts: LoginSecurityCard, EmailChangeModal
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: The section order (10 rows) is not owner-ranked; today's relative order was preserved plus one placement call for two new rows, awaiting owner ranking.
- quote: "This still needs the owner's ranking — I did not decide a final order, only preserved what exists plus the one placement call above"
- kind: blocked-on-owner
- artifacts: AccountHub.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: My Lessons' Account-row icon changed from Boxes to GraduationCap to remove a duplicate-icon collision — a deliberate change flagged.
- quote: "My Lessons' icon changed from `Boxes` to `GraduationCap` on the Account row ... flagging it as a deliberate change rather than something that crept in."
- kind: cosmetic
- artifacts: AccountHub.tsx, MyLessonsContent
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: Nav-page eyebrow/document-title copy on all five subject pages was changed to match the label table, a scope-reading the author flagged in case it is wrong.
- quote: "Nav-page eyebrow/document-title copy on all five subject pages ... now matches the §4 table exactly ... flagging the reasoning in case that reading is wrong"
- kind: correctness
- artifacts: My Documents/My Lessons/My Posts/My Orders/My Gifts/My Stable pages
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: Worktree has no Supabase credentials, so the 390px screenshot and the runtime halves of items 2/4/5/7 could not be done; app throws supabaseUrl is required.
- quote: "This worktree has no Supabase credentials ... I could not log in, could not click through, and could not take the requested screenshot. This is not a gap I can close myself"
- kind: blocked-on-owner
- artifacts: /app/stable, HorseIntakeForm, StableSection
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: Runtime behavior (stable render, add flows, redirect firing, accordion at 390px) is assumed from code correctness, not verified in a running browser.
- quote: "Assumed, not runtime-verified: everything gated behind an authenticated session ... These rest on the code being correct ... rather than on having watched them run."
- kind: not-verified
- artifacts: /app/stable, AccountHub.tsx
- decision-mention: none

## TASK-ADMINSWEEP-PHASE1.md

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: R-1 — the admin's own dashboard /app/ops has no nav entry; OpsDashboard and InstructorHome are both dark, so a trainer has no landing surface at all.
- quote: "`/app/ops` — the admin's own dashboard cannot be opened ... A trainer signing in has no landing surface at all."
- kind: defect
- artifacts: /app/ops, OpsHome, OpsDashboard.tsx, InstructorHome
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: R-2 — /app/ops/horses (HorsesPage) has zero references outside its route; a third horse surface over the same 4 horses that nobody can open.
- quote: "`/app/ops/horses` — a third horse page nobody can open. `HorsesPage` ... has zero references in the entire codebase outside its route registration."
- kind: inventory
- artifacts: /app/ops/horses, HorsesPage
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: R-3 — /app/ops/intake (the largest ops page) is reachable only when the lead list is non-empty; with an empty list there is no route to the page.
- quote: "`/app/ops/intake` is reachable only when there is work in it ... With an empty lead list there is no route to the page."
- kind: defect
- artifacts: /app/ops/intake, IntakePage, DashboardPanel.tsx
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: mod.brokerage is enabled for the tenant but has no nav entry and no hub page — an enabled module with no surface.
- quote: "`mod.brokerage` is enabled for this tenant but has no nav entry and no hub page ... An enabled module with no surface."
- kind: inventory
- artifacts: mod.brokerage, AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: N-1 / X-1 — the Contacts retirement is half-applied: the /app/ops/contacts route redirects but the nav item is still shown, so Clients and Contacts both land on /app/admin.
- quote: "The Contacts retirement is half-applied — two nav rows, one page ... `CONTACTS_PAGE_RETIRED` is referenced only in `App.tsx`, never in `AppLayout.tsx`"
- kind: defect
- artifacts: ContactsPage.tsx, AppLayout.tsx, App.tsx, CONTACTS_PAGE_RETIRED
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: X-3 — /app/ops/availability is a dormant legacy redirect with no nav and no links; target long since moved to the calendar.
- quote: "`/app/ops/availability` redirect | No nav, no links, target long since moved to the calendar | Dormant"
- kind: inventory
- artifacts: /app/ops/availability
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: X-4 — three horse surfaces (Horses / Records / unreachable Horses) all read the same roster; which two to remove is a Phase 2 design call.
- quote: "Two of the three horse surfaces | Horses / Records / (unreachable) Horses all read the same roster | Which two is a Phase 2 design call"
- kind: blocked-on-owner
- artifacts: /app/ops/horse-records, /app/ops/records, /app/ops/horses
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-1 — no admin order surface of any kind; /app/orders is the member's own list, hidden from admin.
- quote: "Orders (business) | Nothing. `/app/orders` is the member's own order list ... and is hidden from admin. No admin order surface of any kind."
- kind: inventory
- artifacts: /app/orders, OrdersContent
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-2 — Horse care: 12 offerings exist and are DB-segmented but there is no page, nav entry, label or module for them.
- quote: "Horse care | The 12 offerings exist and are correctly segmented in the DB ... but there is no page, no nav entry, no label and no module."
- kind: inventory
- artifacts: offerings (segment='horse')
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-3 — no obligations view of Lessons; neither the KPI hub nor the sessions board shows what the business is carrying.
- quote: "Obligations view of Lessons ... Neither shows what the business is carrying."
- kind: inventory
- artifacts: /app/ops/lessons, lesson_packages, lesson_credits
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-4 — Sales KPIs/P&L/expenses backend is written but unapplied, and no client code exists for its 8 objects.
- quote: "Sales KPIs / P&L / expenses | Backend written and unapplied ... No client code exists either — nothing in `src/` references any of its 8 objects"
- kind: inventory
- artifacts: 20260726090000_biz_expenses_and_financials.sql, sales_summary, business_kpis, profit_and_loss
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-5 — Marketing entirely missing at the schema level; no campaign/audience/schedule/post-performance table exists.
- quote: "Marketing, entirely | No campaign, post-performance, or planning surface, and no tables to build one on."
- kind: inventory
- artifacts: content_posts, feed_posts, content_resources, content_blocks
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-6 — a staff landing surface (OpsDashboard, InstructorHome) is built but unreachable; owner reversed the InstructorHome retirement ("wire up, don't retire").
- quote: "A landing surface for staff | `OpsDashboard` and `InstructorHome` are both built and both unreachable (R-1)."
- kind: inventory
- artifacts: OpsDashboard, InstructorHome
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-7 — a brokerage surface is missing; mod.brokerage is on with nothing behind it.
- quote: "A brokerage surface | `mod.brokerage` is on with nothing behind it."
- kind: inventory
- artifacts: mod.brokerage
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: F-1 — half the fulfillment-unit ledger is orphaned: 6 of 12 units point at purchase_id/purchase_item_id that no longer exist despite ON DELETE CASCADE, evidencing ~57 hard-deleted purchases.
- quote: "Half the ledger is orphaned. 6 of the 12 units point at `purchase_id` and `purchase_item_id` values that no longer exist, despite both FKs being `ON DELETE CASCADE`"
- kind: data-integrity
- artifacts: fulfillment_units, purchases, purchase_items
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: F-2 — the consumption side has never been exercised: 0 of 319 bookings carry purchase/credit/contract links and no unit carries a booking_id, so an obligations view would show only open units.
- quote: "The consumption side has never been exercised. Not one booking of any status carries a `purchase_id`, `credit_id` or `contract_id` — 0 of 319"
- kind: data-integrity
- artifacts: bookings, fulfillment_units
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: Could not determine why the 6 orphaned units survived a validated cascade — mechanism inferable but the specific event is unrecoverable; any obligations page needs an orphan filter.
- quote: "Why the 6 orphaned units survived a validated cascade (F-1). The mechanism is inferable ... but the specific event is not recoverable"
- kind: data-integrity
- artifacts: fulfillment_units
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: Could not determine whether the 39 scheduled bookings should have carried purchase links (F-2), i.e. wiring bug vs legacy data; needs the booking-creation path traced before M-3.
- quote: "Whether the 39 scheduled bookings should have carried purchase links (F-2) ... needs the booking-creation path traced end to end — out of scope"
- kind: data-integrity
- artifacts: bookings
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: Could not determine whether "Horse care" (M-2) is a module or a section — a Phase 2 structure decision.
- quote: "Whether "Horse care" (M-2) is a module or a section. The catalog segmentation ... supports either. This is a Phase 2 structure decision."
- kind: blocked-on-owner
- artifacts: offerings (segment='horse')
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: Runtime rendering not verified — every page verified by reading its data path, not by opening it; "renders real data" means calls a live API with no seed fallback, not a visual confirmation.
- quote: "Runtime rendering. Every page was verified by reading its data path, not by opening it in a browser. No admin surface was clicked through."
- kind: not-verified
- artifacts: all admin nav pages
- decision-mention: none

### ITEM
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: N-3 — three nav entries share the Contact icon (Leads, Team, Contacts) and three share Shield (all of Settings); noted only, icon exercise not re-opened.
- quote: "Three nav entries share the `Contact` icon (Leads, Team, Contacts) and three share `Shield` (all of Settings)."
- kind: cosmetic
- artifacts: AppLayout.tsx
- decision-mention: none

## TASK-BOOKWRITE-REPORT.md

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: The 6 orphaned fulfillment units (purchase and item GONE despite ON DELETE CASCADE) were reported and left untouched; ~71 purchases were removed with referential integrity suppressed; owner has not ruled.
- quote: "The 6 orphaned units — reported, untouched ... The owner has not ruled on them and they are left exactly as found."
- kind: data-integrity
- artifacts: fulfillment_units, purchases, purchase_items
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: A backfill of the 319 existing bookings is recommended against — purchase_id/credit_id/horse_id mostly unrecoverable; the 39 real bookings are a hand-kept record whose supporting rows were deleted.
- quote: "Recommend no backfill. Fix forward; let the existing rows be what they are."
- kind: data-integrity
- artifacts: bookings, lesson_credits
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #1 — createLessonCredit is duplicated across src/lib/api.ts:1814 and src/lib/ops/api-lessons.ts:251; a future change made in one will be missed in the other.
- quote: "`createLessonCredit` is duplicated ... the duplication means a future change will be made in one and missed in the other."
- kind: defect
- artifacts: src/lib/api.ts, src/lib/ops/api-lessons.ts
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #2 — generate_lease_availability parses TXN.DAYS_USED as a comma list but the live lease holds a prose sentence, producing wrong day tokens; the day parsing is wrong and predates this task.
- quote: "the day parsing is wrong and predates this task."
- kind: defect
- artifacts: generate_lease_availability, TXN.DAYS_USED
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #3 — generate_lease_availability had been unreachable (filtered on archived template key HORSE_LEASE); retargeted to the live family. The feature has never run in production.
- quote: "`generate_lease_availability` had been unreachable ... Worth knowing that this feature has never run in production."
- kind: defect
- artifacts: generate_lease_availability
- decision-mention: D10

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #4 — save_calendar_item's edit branch overwrites client_id/purchase_id/offering_id/horse_id unconditionally, so a partial payload silently clears them; latent, not changed.
- quote: "`save_calendar_item`'s edit branch overwrites unconditionally ... Not changed — tightening it risks breaking intentional clearing."
- kind: defect
- artifacts: save_calendar_item
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #5 — status_events files bookings under entity_type='offering'; checked and deliberate, recorded so a future thread does not "fix" it into a regression.
- quote: "`status_events` files bookings under `entity_type = 'offering'`. Checked, and it is deliberate ... Recorded so a future thread does not "fix" it into a regression."
- kind: correctness
- artifacts: status_events, booking_status_code()
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #6 — listLessonSessions() reads 318 where 39 exist; TASK-COUNTFIX owns the read path, not touched.
- quote: "`listLessonSessions()` reads 318 where 39 exist — TASK-COUNTFIX owns the read path. Not touched."
- kind: defect
- artifacts: listLessonSessions()
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Changed bookings.purchase_id FK from ON DELETE CASCADE to SET NULL because BOOKWRITE writers now populate it and a purchase delete would otherwise destroy booking history; an armed cascade this task closed.
- quote: "leaving that armed was not acceptable. Changed to `ON DELETE SET NULL` ... A cascade this task armed, and closed."
- kind: data-integrity
- artifacts: bookings.purchase_id
- decision-mention: D11

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: NOT VERIFIED — the UI (instructor picker, purchase auto-link, service picker, consumed/open transitions) has not been exercised in a browser; 9-step checklist outstanding.
- quote: "The UI has not been exercised in a browser. Checklist: ..."
- kind: not-verified
- artifacts: CalendarItemPanel.tsx, ScheduleSessionForm.tsx
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: test:db is broken (60 of 68 files failing) and is not cited as evidence anywhere in the report.
- quote: "`test:db` is broken (60 of 68 files failing) and is not cited as evidence anywhere in this report."
- kind: process
- artifacts: test:db
- decision-mention: none

### ITEM
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Rolled-back proofs consumed display-code sequence numbers (purchase_code_seq at 95, booking_code_seq at 438), so the next real rows will have visible gaps; no rows were created.
- quote: "Display-code sequences are non-transactional, so the rolled-back proof runs consumed numbers without creating rows ... leaving visible gaps."
- kind: process
- artifacts: purchase_code_seq, booking_code_seq
- decision-mention: none

## TASK-C10-REPORT.md

### ITEM
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Found mid-verification a systemic pre-existing privilege exposure — the public schema default privilege auto-grants EXECUTE on every new function to anon/authenticated/service_role; fixing it project-wide is out of C10 scope.
- quote: "this project's `public` schema has a default privilege auto-granting `EXECUTE` on every newly created function to `anon`, `authenticated`, and `service_role` ... fixing it project-wide is outside C10's scope."
- kind: security
- artifacts: pg_default_acl, is_minor_contact, notify_minor_delivery_skipped, log_mirror_delivery, notify_staff
- decision-mention: none

### ITEM
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Production was written to in two passes for grant statements — the committed migration reflects the final state; a direct follow-up REVOKE/GRANT brought prod in sync rather than a second migration file.
- quote: "production was therefore written to in two passes for the grant statements ... production was brought in sync with a direct follow-up `REVOKE/GRANT` (not a second migration file)"
- kind: process
- artifacts: 20260804150000_minor_delivery_guard.sql
- decision-mention: none

### ITEM
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: deliver-evaluation-report.ts's minor branch could not be exercised against live data — no evaluation report belongs to a minor; reasoned, not exercised.
- quote: "no evaluation report exists for Gabriella or any minor today ... this specific file's minor branch was reasoned, not exercised."
- kind: not-verified
- artifacts: api/deliver-evaluation-report.ts
- decision-mention: none

### ITEM
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: admin-send-invitation.ts's minor-reject branch is structurally unreachable against live data (the new trigger guarantees no minor carries an email); kept as defense-in-depth but not exercised via live HTTP.
- quote: "the guard's true-branch is, by construction, currently unreachable against live data ... Not exercised via a live HTTP call"
- kind: not-verified
- artifacts: api/admin-send-invitation.ts, is_minor_contact
- decision-mention: none

### ITEM
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Out of scope (per locked design) — purge-routine guardian orphaning (what happens to a minor's records if the guardian is deleted/merged) not addressed.
- quote: "Purge-routine guardian orphaning (what happens to a minor's records if their guardian contact is deleted/merged) — not addressed."
- kind: out-of-scope
- artifacts: purge_account
- decision-mention: none

### ITEM
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Out of scope — sign-start self-serve age screening (kiosk-side minor detection before a release is signed) not addressed; sign_release's form-DOB validator untouched.
- quote: "Sign-start self-serve age screening ... not addressed; `sign_release`'s existing form-DOB validator is untouched"
- kind: out-of-scope
- artifacts: sign_release
- decision-mention: none

### ITEM
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Out of scope — profiles-based reminder senders (calendar-reminders, notifications-nudge) not touched; a minor without an account is already incidentally unreachable there.
- quote: "Profiles-based reminder senders ... these resolve recipients via `profiles`, and a minor without an account is already incidentally unreachable there. Not touched."
- kind: out-of-scope
- artifacts: calendar-reminders, notifications-nudge
- decision-mention: none

### ITEM
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: No live email was sent by this task; all delivery-path reasoning in §3 is a traced read of the code against live rows, labeled "not executed".
- quote: "No live email was sent by this task. All delivery-path reasoning in §3 is a traced read of the code ... explicitly labeled "not executed""
- kind: not-verified
- artifacts: api/_lib/delivery.ts, api/deliver-document.ts, api/deliver-documents.ts
- decision-mention: none

## TASK-EMAILEXTRACT-REPORT.md

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: D9 finding — the welcome and dunning email WORDING still exists in renderTemplate (api/_lib/email.ts) though the producers were deleted; deliberately not restored and not extracted, to avoid reversing a settled decision.
- quote: "the welcome and dunning WORDING still exists in `renderTemplate` ... No producer, no caller. Not restored, not extracted."
- kind: correctness
- artifacts: api/_lib/email.ts, renderTemplate
- decision-mention: D9

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: renderTemplate is now entirely dead (its last caller moved to the table); kept, not deleted — deleting it is a separate deliberate act.
- quote: "`renderTemplate` is now entirely dead — deleting it is a separate, deliberate act."
- kind: inventory
- artifacts: api/_lib/email.ts, renderTemplate
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Deviation — created an email-specific token namespace MSG.* (18 rows) despite the task saying not to, because those values are properties of the message; stated rather than slipped in.
- quote: "The task said "Do NOT create an email-specific token namespace." I created one: `MSG.*`, 18 rows."
- kind: correctness
- artifacts: template_tokens, MSG.*
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Inconsistent HTML escaping across senders is preserved byte for byte and now visible as _HTML token twins; a unified escaping policy is real work with output changes needing owner sign-off.
- quote: "Inconsistent HTML escaping across the senders is preserved byte for byte and now visible as `_HTML` token twins. A unified escaping policy ... needs owner sign-off"
- kind: correctness
- artifacts: DOC.TITLE, DOC.TITLE_HTML, contract-voided.ts, deliver-documents.ts
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: api/contract-invite.ts:117 hardcodes 'French Heritage Equestrian' as the identity fallback when resolveTenantEmailIdentity throws — a multi-tenant leak that predates this task; contract-voided.ts has the same. Left as found.
- quote: "`api/contract-invite.ts:117` hardcodes `'French Heritage Equestrian'` as the identity fallback ... a §15 multi-tenant leak that predates this task. `contract-voided.ts` has the same."
- kind: security
- artifacts: api/contract-invite.ts, api/contract-voided.ts, resolveTenantEmailIdentity
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: email_templates has no org_id — bodies are global; correct now but flagged to revisit when a second tenant wants different wording.
- quote: "`email_templates` has no `org_id` — bodies are global ... Correct now; revisit when a second tenant wants different wording."
- kind: correctness
- artifacts: email_templates
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: No plain-text alternative exists and could not be added here — SendProviderInput has no text field; a text/plain alternative is transport work first, deliberately not added speculatively.
- quote: "No plain-text alternative exists, and could not be added here. `SendProviderInput` has no text field ... The column was deliberately not added speculatively."
- kind: out-of-scope
- artifacts: SendProviderInput
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: request-received's three enum→label maps (CATEGORY_LABEL, CHANNEL_LABEL, CONTACT_METHOD_LABEL) are the last email-adjacent vocabulary left in code.
- quote: "`request-received`'s three enum→label maps are the last email-adjacent vocabulary in code"
- kind: correctness
- artifacts: request-received.ts, CATEGORY_LABEL, CHANNEL_LABEL, CONTACT_METHOD_LABEL
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: The renderer is duplicated across api/_lib/emailTemplates.ts and the copy inside diff.mjs (a .mjs script cannot import .ts); the duplication is guarded by an assertion but remains.
- quote: "The renderer is duplicated — `api/_lib/emailTemplates.ts` ... and the copy inside `diff.mjs`"
- kind: correctness
- artifacts: api/_lib/emailTemplates.ts, scripts/emailextract/diff.mjs
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: D13 is not fully satisfied — there is no UI; the owner can only change email wording via save_draft + publish RPCs (a thread or DB client). The Templates > Emails list is TASK-TEXTEDIT's surface, named as a follow-up.
- quote: "D13 IS NOT FULLY SATISFIED ... There is no UI ... this is `TASK-TEXTEDIT`'s surface, extended to a second list."
- kind: not-verified
- artifacts: email_template_list, email_template_save_draft, email_template_publish, src/lib/templateEditor.ts
- decision-mention: D13

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: The MANAGER/EMPLOYEE staff-read arm of the email_templates policy is proven by policy definition, not by a live actor — no such account exists in production.
- quote: "No MANAGER/EMPLOYEE account exists in production ... so the staff-read policy's manager arm is proven by policy definition, not by a live actor."
- kind: not-verified
- artifacts: email_templates RLS
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: test:db was not cited as proof — it is broken (60 of 68 files fail); proofs are the render harness and production transactions.
- quote: "`test:db` was not cited as proof of anything — it is broken (60 of 68 files fail)"
- kind: process
- artifacts: test:db
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Behavior change — fallback WORDS moved from code into templates; rendered output unchanged (proven) but the words are now owner-editable. The one behavior change, stated.
- quote: "The one behaviour change I made, and it is not in the output. Fallback WORDS moved from code into the templates"
- kind: correctness
- artifacts: email_templates, DOC.HAS_TITLE
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Correction — the measured "19 files that compose an email" was three high (3 compose nothing) and three low (3 composers not on the list); the real count is 19 distinct emails across 16 files.
- quote: "The measured "19 files" was three high and three low."
- kind: correctness
- artifacts: email-change-complete.ts, delivery-sweep.ts, admin-provision-tenant.ts, expire-holds.ts, contract-working-copy.ts, receipt.ts
- decision-mention: none

### ITEM
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Correction — the 6-hour guard is in the executed-document delivery path, not the invitation path as the task described; invitation protections are different mechanisms.
- quote: "Correction to the task: the guard is in the executed-document delivery path, not the invitation path."
- kind: correctness
- artifacts: document_deliveries_doc_recipient_channel_uidx, supersede_invitations, invitation_request_resend
- decision-mention: none

## TASK-GUARDREST-REPORT.md

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Correction — the bare-guard query under-reports: its prosrc !~ 'coalesce' filter hides every bare guard in a function that has any unrelated coalesce. The real number is 19, not 15; four functions were invisible.
- quote: "The query returns 15, as the task said. But the real number is 19 ... Four functions with the exact dangerous shape were invisible to it"
- kind: security
- artifacts: mark_comment_review, request_contract_termination, set_horse_locations, set_horse_medications
- decision-mention: none

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Correction — the task's stated rationale (NULL-auth caller makes the guard go NULL) is wrong; helpers coalesce to false. The real hole is a staff caller with NULL org_id (e.g. admin@cactai.io, SUPER_ADMIN), plus a NULL-data family.
- quote: "The stated rationale is wrong ... The hole is one step in from there: a caller who IS staff but whose `org_id` is NULL."
- kind: security
- artifacts: has_staff_access(), is_admin(), current_org()
- decision-mention: D1a

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Live hole 1 — attach_horse_to_document admitted the platform owner (org NULL) to write to a tenant document; fixed and proven before/after.
- quote: "attach_horse_to_document — the platform owner writes to a tenant document ... A2. platform owner (org NULL) => ADMITTED (no error)"
- kind: security
- artifacts: attach_horse_to_document
- decision-mention: none

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Live hole 2 — request_booking_change let any member act on 294 bookings with NULL client_id (write access, flipped status to pending); fixed and proven.
- quote: "request_booking_change — any member can act on 294 bookings that are not theirs ... It also flipped the booking's status to `pending`, so this was write access"
- kind: security
- artifacts: request_booking_change, bookings.client_id
- decision-mention: none

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Live hole 3 — purge_account's structural gate went NULL on the proof domain (current_setting unset), so a @purge-proof.invalid address could purge; fixed and proven.
- quote: "purge_account — the structural gate goes NULL on the proof domain ... the `RAISE` is skipped and the purge proceeds."
- kind: security
- artifacts: purge_account
- decision-mention: none

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: The MANAGER/EMPLOYEE mismatch was resolved by widening three RLS SELECT policies (documents/contacts/horses) to has_staff_access(); write policies stay is_admin(), an asymmetry recorded so it is not rediscovered as a bug.
- quote: "Write policies remain `is_admin()` while reads are now `has_staff_access()`. Intentional (above), but recorded so the asymmetry is not rediscovered as a bug."
- kind: security
- artifacts: documents_admin_write, contacts_admin_write, horses_admin_write
- decision-mention: D1a

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: No trigger provisions profiles at signup — diagnosed, NOT built. Two real orphan accounts exist (OAuth signup and direct-signup past the invite spine); a signup trigger is a security decision needing an owner ruling.
- quote: "No trigger provisions `profiles` at signup — diagnosed, NOT built ... Recommend a separate task with an owner ruling"
- kind: blocked-on-owner
- artifacts: auth.users, profiles, src/lib/auth.ts, signUpWithPassword
- decision-mention: D5

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Flagged #1 — a document points at a contract that does not exist; any attach_horse_to_document on it dies on documents_contract_id_fkey. The armed defect TASK-SUPERSEDE recorded. Out of scope.
- quote: "A document points at a contract that does not exist ... This is the armed defect TASK-SUPERSEDE recorded ... Out of scope — guard-only."
- kind: data-integrity
- artifacts: documents.contract_id, contracts, attach_horse_to_document
- decision-mention: none

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Flagged #2 — 294 bookings have client_id NULL; the guard is now safe but the data question stands (should staff-created bookings carry a client, what is a NULL one for). Worth a ruling.
- quote: "294 bookings have `client_id` NULL. The guard is now safe, but the data question stands ... Worth a ruling."
- kind: blocked-on-owner
- artifacts: bookings.client_id
- decision-mention: none

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Flagged #3 — the owner cannot create an instructor account; TeamPage invites staff as ADMIN only and the MANAGER/EMPLOYEE roles this RLS change made real cannot be granted without SQL. A D13 gap, owner's call.
- quote: "The owner cannot create an instructor account ... A D13 gap: it now needs SQL. Small fix ... but it is a role/permission change, so it is the owner's call"
- kind: blocked-on-owner
- artifacts: TeamPage
- decision-mention: D13

### ITEM
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Flagged #4 — clone_contract_template is not executable by authenticated (pre-existing, deliberate psql/migration-only tool); its guard was coalesced here regardless. Not a regression.
- quote: "`clone_contract_template` is not executable by `authenticated` ... Pre-existing and deliberate ... Not a regression."
- kind: correctness
- artifacts: clone_contract_template, 20260807130000_leasefork_clone_grant_hardening.sql
- decision-mention: none

## TASK-I1B-REPORT.md

### ITEM
- report: TASK-I1B-REPORT.md
- date: 2026-08-05
- item: Browser verification pending — visual pinned↔collapsed transition, hover-peek, tooltip readability, and mobile header button spacing not confirmed.
- quote: "Browser verification (visual pinned↔collapsed transition, hover-peek, tooltip readability, mobile header button spacing) — flagged per the task doc's own "browser pending" framing."
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-I1B-REPORT.md
- date: 2026-08-05
- item: The build's prerender step fails with supabaseUrl is required; confirmed pre-existing on origin/main (worktree has no .env), not a regression.
- quote: "The build script's prerender step (`scripts/prerender.mjs`) fails with `supabaseUrl is required` — confirmed this is pre-existing on `origin/main` ... not a regression"
- kind: process
- artifacts: scripts/prerender.mjs
- decision-mention: none

## TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: This audit was corrected by NOGUARD2 in three places — "nine unguarded contract_fields writers" is really seven (two are trigger-only functions).
- quote: ""Nine unguarded anon-reachable `contract_fields` writers" — it is SEVEN. `contract_split_deductible_sync` and `sync_horse_fields_to_documents` are `RETURNS trigger`"
- kind: correctness
- artifacts: contract_split_deductible_sync, sync_horse_fields_to_documents
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: Correction — three of the lock-carrying functions are NOT anon=false; set_document_co_buyer and remove_document_co_buyer are anon=true, and set_field_structured (a fourth lock-caller) was omitted entirely. remove_document_co_buyer deletes BUYER parties on any document with no identity check.
- quote: ""All three [lock-carrying functions] are `anon = false`" — WRONG ... `remove_document_co_buyer` has no identity check and deletes BUYER parties on any document id."
- kind: security
- artifacts: set_document_co_buyer, remove_document_co_buyer, set_field_structured, set_contract_field
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: Correction — the claim "a function with an internal caller must be guarded, not revoked" is false; SECURITY DEFINER inner calls are checked against postgres, so six of seven are revoked rather than re-guarded.
- quote: ""A function with an internal caller must be GUARDED, not revoked — revoking would break the caller." FALSE."
- kind: correctness
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: void_signatures_on_edit confirmed — anon-reachable, no identity check, no caller anywhere (dead code); voids every signature on any document and resets status. Recommendation: DROP.
- quote: "There is no identity check of any kind ... Any unauthenticated caller holding a document id voids every signature on that document ... Recommendation: DROP it, do not guard it."
- kind: security
- artifacts: void_signatures_on_edit, signatures, documents
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: The report understates the contract-field surface by 3×: 28 functions write to contract_fields, 22 anon-executable, nine anon-reachable with no identity check.
- quote: "28 functions write to `contract_fields`. 22 of them are anon-executable. Nine are anon-executable and carry no identity check at all"
- kind: security
- artifacts: contract_fields, apply_field_formats, bos_generate_document, recompose_document_fields, fill_party_fields_from_contacts
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: lease_expiry_nudge is a definer wrapper that launders the missing privilege — anon-reachable, its whole body calls the anon-unreachable lease_reminder_sweep. A class, not an instance.
- quote: "The wrapper launders the missing privilege. The finding stands; the count of 76 stands; the explanation in the report does not. This is a class, not an instance."
- kind: security
- artifacts: lease_expiry_nudge, lease_reminder_sweep
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: The authenticated definer surface (396 callable functions, 111 more than anon) has never been measured — a separate audit that outranks the residue of this one on consequence.
- quote: "NOGUARD1 measured the anonymous surface. The authenticated surface is larger and has never been measured. That is a separate audit"
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: The three gift_* NULL-propagating guards (gift_claim_link, gift_mark_sent, gift_reschedule) do not fire for anon; each needs one coalesce(...,false), copied from gift_transfer.
- quote: "The three `gift_*` NULL-propagating guards — confirmed verbatim ... `gift_transfer` already carries the fix."
- kind: security
- artifacts: gift_claim_link, gift_mark_sent, gift_reschedule, gift_transfer
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: Open question — drop void_signatures_on_edit or guard it (owner decides). It has no caller; guarding preserves dead code, dropping is cleaner and reversible.
- quote: "Drop `void_signatures_on_edit`, or guard it? It has no caller anywhere. Guarding preserves dead code"
- kind: blocked-on-owner
- artifacts: void_signatures_on_edit
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: Open question — may NOGUARD2 apply migrations to production in-thread, or stop at dry-run for review.
- quote: "May NOGUARD2 apply migrations to production in-thread, or stop at dry-run for review?"
- kind: blocked-on-owner
- artifacts: none
- decision-mention: none

## TASK-NOGUARD1-REPORT.md

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Headline — 76 of 285 anon-reachable SECURITY DEFINER functions do not enforce an access rule; 38 of those modify data. (Read-only audit, nothing fixed.)
- quote: "76 of 285 anon-reachable `SECURITY DEFINER` functions do not enforce an access rule. 38 of those modify data."
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: void_signatures_on_edit — worst finding: takes a document id, soft-deletes every signature and resets status, no identity check, no caller (dead code), anon holds EXECUTE.
- quote: "the worst finding is `void_signatures_on_edit(uuid)` — it takes a document id, soft-deletes every signature on it, and resets the document's status. It has no identity check of any kind, no caller"
- kind: security
- artifacts: void_signatures_on_edit, signatures, documents
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Four functions are protected only by a NOT NULL column constraint, not by any access rule; a future migration relaxing one silently opens a write path. Flagged, not fixed.
- quote: "Four functions are protected by a column constraint rather than by any access rule. A future migration relaxing one of those silently opens a write path. Flagged, not fixed"
- kind: security
- artifacts: content_acknowledgments, dm_hidden_conversations, feed_seen, feed_view_pref, dm_hide_conversation
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Three gift_* functions have a guard present but with no effect (NULL-propagation) — the only "guard present, no effect" write cases; fix is a one-line coalesce copy.
- quote: "The three `gift_*` functions — the only "guard present, no effect" cases left."
- kind: security
- artifacts: gift_claim_link, gift_mark_sent, gift_reschedule
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: contract_fields mutator family (recompose_document_fields, sync_contract_fields_from_defs, seed_cascade_fields, regroup_contract_subjects, apply_field_formats, fill_party_fields_from_contacts, remove_document_co_buyer) can insert/rewrite/reorder/delete any contract; four have no caller; none checks assert_not_signature_locked first.
- quote: "Together these can insert, rewrite, reorder and delete the content of any contract. Four of the seven have no caller at all. None of them checks `assert_not_signature_locked` first"
- kind: security
- artifacts: recompose_document_fields, sync_contract_fields_from_defs, seed_cascade_fields, regroup_contract_subjects, apply_field_formats, fill_party_fields_from_contacts, remove_document_co_buyer
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: affiliation_reconciliation and wall_onboarding_invariant_violations are two unauthenticated full customer-roster dumps, both dead code.
- quote: "`affiliation_reconciliation` and `wall_onboarding_invariant_violations` — two unauthenticated full-roster dumps. Both are dead code."
- kind: security
- artifacts: affiliation_reconciliation, wall_onboarding_invariant_violations
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: confirm_booking_for_purchase confirms a booking without payment, bypassing the Stripe webhook path; reachable from stripe-webhook.ts so any fix must keep the service_role path alive.
- quote: "Confirms a booking without payment — bypasses the Stripe webhook path ... guard on `auth.role() = 'service_role'`, never on `session_user` alone."
- kind: security
- artifacts: confirm_booking_for_purchase, api/stripe-webhook.ts
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: The grant default (pg_default_acl grants EXECUTE on every new public function to anon) is the root cause and is unchanged; every migration adds to this surface by default. This is the root cause; items 1-7 are symptoms.
- quote: "The grant default regenerates this class ... Until it changes, every migration adds to this surface by default ... This is the root cause; items 1–7 are symptoms."
- kind: security
- artifacts: pg_default_acl
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Both trap grants (PUBLIC =X/postgres and anon=X/postgres) are present on every function checked; either revoke alone is a silent no-op — any revoke must name anon, authenticated and PUBLIC separately and re-read has_function_privilege.
- quote: "Both trap grants are present on every function I checked ... Any revoke must name `anon`, `authenticated` and `PUBLIC` separately ... never the `REVOKE` output."
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — the authenticated surface is not modelled at all; every one of the 76 is also callable by any signed-up account and most of the 199 "enforcing" only distinguish nobody from somebody. Judged the larger surface, untouched.
- quote: "`authenticated` is not modelled at all ... I judge this the larger surface, and it is untouched here."
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — the 76 were not executed (by instruction), so "no guard in the body" is a claim about code, not a demonstration; something outside the body (trigger/CHECK/FK/NOT NULL) could still stop them, so 76 may be an over-count.
- quote: "I did not execute the 76 ... There are probably more, which would make my 76 an over-count."
- kind: not-verified
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — RLS policies were not audited for their own NULL logic (only one policy checked); RLS fails closed on NULL where IF NOT fails open.
- quote: "RLS is not in the picture, and that is load-bearing ... I checked that one policy. I did not check the rest."
- kind: security
- artifacts: RLS policies, profiles_select_own
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — dynamic SQL (org_public_config, rls_auto_enable use EXECUTE format) is invisible to every method used; cannot generalise from two.
- quote: "A guard assembled at runtime is invisible to every method I used. Neither of those two hides a guard, but I cannot generalise from two."
- kind: not-verified
- artifacts: org_public_config, rls_auto_enable
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — overloads not checked; keyed on proname in several places, so two same-named functions with different signatures would be conflated (one guarded overload could mask an unguarded one).
- quote: "Overloads. I keyed on `proname` in several places ... one guarded overload could mask an unguarded one. I did not check for overloads"
- kind: not-verified
- artifacts: pg_proc
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — argument-typed composite functions (horse_field_token_value, booking_notifies_client, booking_service_type take whole table rows) are under-tested; ranked low by reasoning, not test.
- quote: "Argument-typed composite functions are under-tested ... I ranked them low on that reasoning rather than on a test."
- kind: not-verified
- artifacts: horse_field_token_value, booking_notifies_client, booking_service_type
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — reachability is proven but exploitability is inferred; the 22P02 probe proves the request reaches argument parsing, not that the body completes. Authorisation does not stop them, not that they all succeed.
- quote: "Reachability is proven, exploitability is inferred ... the honest statement is: authorisation does not stop them, not they all succeed."
- kind: not-verified
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Point-in-time snapshot — measured 2026-08-07 against ab3d490; three threads in flight, any adding a function adds to the list.
- quote: "A point-in-time snapshot. Measured 2026-08-07 against `ab3d490`. Three threads are in flight ... any of them adding a function adds to this list."
- kind: process
- artifacts: SECURITY DEFINER functions
- decision-mention: none

## TASK-PARTYCTRL-REPORT.md

### ITEM
- report: TASK-PARTYCTRL-REPORT.md
- date: 2026-08-04
- item: Default-values deviation — used the uniform UI-panel default (can_fill true, rest false) for all party roles rather than the reference doc's role-asymmetric rows, since that asymmetry doesn't generalize to BUYER/SELLER; per the task spec's own instruction.
- quote: "used `ContractPage.tsx`'s panel instead ... All three starters (and the backfill) seed every non-FHE/COMPANY party role with this same uniform default."
- kind: correctness
- artifacts: document_party_controls, ContractPage.tsx, set_party_controls
- decision-mention: none

### ITEM
- report: TASK-PARTYCTRL-REPORT.md
- date: 2026-08-04
- item: Backfill included CLIENT/PARTICIPANT onboarding documents outside the three starters' template scope because the backfill clause is document-pattern-based, not starter-scoped; flagged as an inclusion decision.
- quote: "the CLIENT/PARTICIPANT documents are onboarding-style contracts outside the three starters' template scope, but the task spec's backfill clause is document-pattern-based ... so they're included."
- kind: correctness
- artifacts: document_party_controls, document_parties
- decision-mention: none

### ITEM
- report: TASK-PARTYCTRL-REPORT.md
- date: 2026-08-04
- item: A2's tracker status left as NOT VERIFIED — send-to-parties itself is still unverified live and is the party-verify thread's item, not this task's.
- quote: "A2's status left as `NOT VERIFIED` unchanged — send-to-parties itself is still unverified live and is the party-verify thread's item"
- kind: not-verified
- artifacts: docs/BUILD_TRACKER.md
- decision-mention: none

## TASK-TESTDB-REPORT.md

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Correction — the task doc's stated cause (migration growth exceeding the 10s beforeAll timeout) is wrong; createTestDb loads a snapshot and does not replay migrations. Real cause is PGlite contention on a memory-starved box.
- quote: "The task doc's stated cause is wrong ... It does not replay migrations at all ... The actual cause is contention."
- kind: correctness
- artifacts: createTestDb(), vitest.config.ts, test/db/fixtures/schema_snapshot.sql
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: The snapshot fixture contains zero setval statements, so display-code sequences load at start value while seeded rows already hold consumed codes; 21 files died on organizations_display_code_key. Fixed via alignDisplayCodeSequences.
- quote: "The snapshot contains zero `setval` statements ... 21 files dying on `duplicate key value violates unique constraint "organizations_display_code_key"`."
- kind: defect
- artifacts: schema_snapshot.sql, harness.ts, alignDisplayCodeSequences()
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Systemic finding — SNAPSHOT_DATA_TABLES is a hand-maintained allowlist; every migration-seeded reference table not on it is a silent latent suite failure. Seven were found by chasing failures; there is no guard for the eighth.
- quote: "This is the systemic finding. The allowlist is a hand-maintained list, and every migration-seeded reference table that isn't on it is a silent, latent suite failure ... There is no guard that would catch the eighth."
- kind: process
- artifacts: SNAPSHOT_DATA_TABLES, harness.ts, modules, tiers, horse_breeds, org_modules, template_variants
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: D-1 (real, live) — block_settled_billable_line_update() trigger references NEW.transaction_id, a column dropped with the transactions retirement; any UPDATE to a SETTLED billable_lines row raises a misleading error and blocks legitimate updates (e.g. deleted_at). Reported, not patched.
- quote: "a seal trigger references a dropped column ... a legitimate update to a settled row (e.g. stamping `deleted_at`) fails too."
- kind: defect
- artifacts: block_settled_billable_line_update(), billable_lines
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: D-2 (dead code) — owns_order(uuid) is a SQL function querying the dropped orders table; unreachable (no RLS/function/view/code reference) because old-style SQL bodies aren't dependency-tracked. Cleanup, not breakage.
- quote: "an orphan function survives `orders` ... `orders` is GONE ... It is unreachable"
- kind: defect
- artifacts: owns_order(uuid), orders
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Correction — a first looser scan suggested nine functions referencing dropped tables; eight were false (JSON keys/comments), only owns_order genuinely queries a dropped table.
- quote: "a first, looser scan suggested nine functions referencing dropped tables. Eight were false ... I nearly reported eight defects that do not exist."
- kind: correctness
- artifacts: owns_order(uuid)
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Harness limitation — the snapshot carries no GRANT/REVOKE and BOOTSTRAP blanket-grants ALL, so ~16 tests asserting table-level REVOKE cannot pass no matter how correct production is (e.g. horse_relationships DELETE genuinely revoked). Reported, not fixed.
- quote: "every test asserting a table-level REVOKE cannot pass on the snapshot path, no matter how correct production is ... The test is right, production is right, and the harness cannot express the assertion."
- kind: process
- artifacts: schema_snapshot.sql, harness.ts, BOOTSTRAP, horse_relationships
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Blocked — 8 files still die in beforeAll on a retired setup helper (provision_lesson_invitation / engagements) while their subjects are live; not deletable without losing coverage, not mechanically fixable, needs a decision.
- quote: "8 files still die in `beforeAll` on a retired setup helper while their actual subject is live ... Why I stopped rather than rewriting them"
- kind: blocked-on-owner
- artifacts: provision_lesson_invitation, provision_client_invitation, engagements, create_purchase_engagement
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Urgent finding — provision_client_invitation, the canonical account-provisioning spine, has ZERO test coverage; every provisioning test is written against a function that no longer exists. A follow-up task worth opening.
- quote: "`provision_client_invitation` — the canonical account-provisioning spine ... has ZERO test coverage ... That is a follow-up task worth opening on its own."
- kind: process
- artifacts: provision_client_invitation, test/db/
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: The 203 failures are pre-existing conditions that 651 skipped tests were hiding — clusters: REVOKE assertions (~16), retired tables in live files (9), stale module-set premise (~10), missing retired functions (4), assorted assertion drift.
- quote: "None are regressions from this task — all are pre-existing conditions that 651 skipped tests were hiding."
- kind: process
- artifacts: test:db
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Stale premise cluster — tests assert FHE has mod.barnops/mod.employees OFF but production has all six mod.* enabled; the gate mechanism is fine, the tests need a rival org as the OFF case.
- quote: "Tests assert FHE has `mod.barnops`/`mod.employees` OFF. Production has all six `mod.*` enabled. The gate mechanism is fine; the vehicle is out of date"
- kind: correctness
- artifacts: org_modules
- decision-mention: none

### ITEM
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Recommendation not applied — capping maxWorkers to 4 cuts internal test time (1201s→680s) with identical pass results but was deliberately left out of committed config so bigger machines stay fast; set on memory-constrained CI.
- quote: "Recommendation, not applied: capping `maxWorkers` to 4 ... I deliberately left it out of the committed config so bigger machines stay fast."
- kind: process
- artifacts: vitest.config.ts
- decision-mention: none

## INVENTORY

### INVENTORY
- report: TASK-ADMINSWEEP-PHASE1.md
- what: /app/ops (OpsHome → OpsDashboard/InstructorHome) has no nav entry and is unreachable; two whole surfaces dark, trainers have no home.
- where: /app/ops, src/pages/app/ops/OpsDashboard.tsx, InstructorHome
- quote: "`/app/ops` — the admin's own dashboard cannot be opened. No nav entry ... `OpsDashboard` (221 lines ...) and `InstructorHome` ... are dark"

### INVENTORY
- report: TASK-ADMINSWEEP-PHASE1.md
- what: /app/ops/horses (HorsesPage, 127 lines) has zero references outside its route — a third unreachable horse surface.
- where: /app/ops/horses, HorsesPage
- quote: "`HorsesPage` (127 lines ...) has zero references in the entire codebase outside its route registration."

### INVENTORY
- report: TASK-ADMINSWEEP-PHASE1.md
- what: /app/ops/availability is a dormant legacy redirect with no nav and no links.
- where: /app/ops/availability
- quote: "redirect → `/app/calendar` | NO (dormant legacy redirect)"

### INVENTORY
- report: TASK-ADMINSWEEP-PHASE1.md
- what: mod.brokerage is enabled but has no nav entry and no hub page; its entry was removed because it 404'd on an unregistered route.
- where: mod.brokerage, AppLayout.tsx:331
- quote: "An enabled module with no surface."

### INVENTORY
- report: TASK-ADMINSWEEP-PHASE1.md
- what: boarding (×4), barnops (×4), employees (×3) module pages are dark by design because their modules are off (not dead code).
- where: /app/ops/boarding/{facilities,agreements,charges}, /app/ops/barnops/{resources,consumption,allocation-rules}, /app/ops/employees/{staff,schedule}
- quote: "dark — hub hidden, module off"

### INVENTORY
- report: TASK-ADMINSWEEP-PHASE1.md
- what: The Sales financials backend (8 objects) is written but unapplied to prod and has no client code referencing it.
- where: supabase/migrations/20260726090000_biz_expenses_and_financials.sql (sales_summary, business_kpis, growth_summary, profit_and_loss, upsert_expense, delete_expense, list_expenses, expense_categories_list)
- quote: "none of the 8 objects ... exist in prod ... there is no client code for it either"

### INVENTORY
- report: TASK-EMAILEXTRACT-REPORT.md
- what: renderTemplate() in api/_lib/email.ts is now entirely dead (no callers) and still contains D9-forbidden welcome and dunning email wording; kept, not deleted.
- where: api/_lib/email.ts, renderTemplate
- quote: "`renderTemplate` still contains the welcome email and the dunning email ... It is copy looking for a sender."

### INVENTORY
- report: TASK-NOGUARD1-REPORT.md
- what: void_signatures_on_edit is dead code — no caller in src/, api/, pg_proc or any trigger — yet anon-executable and voids all signatures on any document.
- where: void_signatures_on_edit
- quote: "It has no caller. Verified three ways ... **none — dead code**"

### INVENTORY
- report: TASK-NOGUARD1-REPORT.md
- what: apply_field_formats, regroup_contract_subjects, seed_cascade_fields are anon-callable contract_fields mutators with no callers anywhere (dead code).
- where: apply_field_formats, regroup_contract_subjects, seed_cascade_fields
- quote: "**none — dead code**"

### INVENTORY
- report: TASK-NOGUARD1-REPORT.md
- what: affiliation_reconciliation and wall_onboarding_invariant_violations are unauthenticated full-roster dump functions with no callers (dead code).
- where: affiliation_reconciliation, wall_onboarding_invariant_violations
- quote: "Full customer roster dump, unauthenticated. **none — dead code**"

### INVENTORY
- report: TASK-TESTDB-REPORT.md
- what: owns_order(uuid) is an orphan SQL function querying the dropped orders table, unreachable by any RLS/function/view/code.
- where: owns_order(uuid)
- quote: "It is unreachable: no RLS policy, no other function, no view and no code in `src/` or `api/` references it."

### INVENTORY
- report: TASK-TESTDB-REPORT.md
- what: 48 tests across 5 files (plus describe blocks) were deleted because their subjects (transactions, orders, engagements, tier layer, purchase catalog shadow catalogs) are retired/GONE.
- where: purchase_catalog_matrix.test.ts, client_balance_read.test.ts, settlement_rollup.test.ts, e2e_payment.test.ts, client_self_signing.test.ts
- quote: "48 tests across 5 files, plus 3 describe blocks and 1 test inside surviving files ... Each was verified GONE against the live database"

### INVENTORY
- report: TASK-ACCOUNTSURFACE-REPORT.md
- what: The old DocumentsPanel and PaperViewer were removed from AccountPanels.tsx (superseded by DocumentsContent.tsx); SavedPanel is all that remains (67 lines, down from 200).
- where: AccountPanels.tsx, DocumentsPanel, PaperViewer, DocumentsContent.tsx
- quote: "the old `DocumentsPanel`/`PaperViewer` are gone from there, superseded by `DocumentsContent.tsx`."
