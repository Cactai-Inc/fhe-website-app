# ADMIN-IA — staff/admin information architecture and route dispositions

Scope: staff/admin surfaces only. Member app and public site untouched except where an admin
action lands on them. Superadmin rail untouched. Authority for keys: `src/lib/pageRegistry.ts`.
Authority for mounts: `src/App.tsx`. This document covers the union — registered nav rows AND
unregistered mounts.

Standing rulings inherited: D30 rules this is the CURRENT app, refactored to be fully usable for
however long it stays in service — optimized and streamlined, not rebuilt to the new-platform
design. D17 (reachable and correctly named), D18 (no second mechanism beside a correct one),
D19 (Commit-style value-moving actions), D25 (offering wording), D26 (two owner views), D27
(evaluations are records on a rider or horse — this stands; the queued "evaluations to Money"
proposal is dead), D13/D21 (owner-editable configuration).

## 1. The zone model

Four zones. Claire sees three, CJ sees all four. Zones are rail groups, not pages.

**Owner, 2026-08-24 — confirmed:** "claire gets three and i get 4." This zone count is settled,
not open. See §8 below for what's now known about how Claire actually uses these two of the
three zones day to day.

1. DASHBOARD — see, track, monitor, act. The landing surface for both accounts, both views
   (trainer/business per D26). Every zone row deep-links to the surface that owns the work.
2. WORK — create, start, audit, find. Calendar, People, Horses, Documents, Deals, Lessons,
   Money, and the operating modules (Boarding, Barn Ops, Employees). Flat entries — no Records
   umbrella, no hub-card launcher pages. One click from rail to working surface.
3. COMMUNITY — the member-facing face of the business: Activity/feed, Compose (long-form
   authoring — see §4), Moderation, Messages.
4. ADMIN (admin role only) — app management: Templates (document + form builders and their
   implemented versions), Products & pricing, Branding, Team, Field options, Page visibility,
   Oversight/activity log, tenant + account settings.

## 2. Navigation chrome

Desktop: left rail, grouped by zone in the order above, role-scoped (zone 4 renders only for
admin). Active page highlighted; module entries appear only when `org_modules.enabled` (existing
gate; unchanged).

Mobile: top app bar on every page — back affordance (left), page title, page actions (right).
Fixed bottom bar, three targets: Dashboard, Create (+), Menu. Dashboard is one tap from
anywhere, always. Create opens the same quick-create sheet everywhere (person, horse, session,
document, deal, post). Menu opens the zone-grouped list that mirrors the desktop rail.

⚠️ **Owner, 2026-08-24 — open, not settled:** "Dashboard is the access point and likely this is
the place to use a footer nav or a subheader nav or a quick access nav floating as a button in
the bottom right of the phone since she does most things on her phone." The owner is exploring
alternatives to the fixed-bottom-bar spec above, not rejecting it outright — he used "likely" and
"or" three times. **This is genuinely undecided.** Whoever builds this should not treat the
three-target bottom bar as settled without asking; the real constraint underneath the question is
that Claire is mobile-primary and needs the Dashboard and her Schedule/Calendar reachable in one
motion from anywhere, which any of the three options (footer nav, subheader, floating button)
could satisfy.

## 3. The back rule (standing, enforced)

Every page below rail level renders the shared PageHeader with a defined back target. Back
targets are declared, not inferred: a detail page returns to its list with list state (tab,
filters, scroll query params) preserved; a list page returns to Dashboard. Browser back is never
the only path. A route with no declared back target fails review. Dead-end paths listed in §6
are all closed by this rule plus the retirements below.

## 4. Compose — long-form authoring (the open mystery, answered)

Articles, guides, and long posts are `content_posts` (the content store already models this).
Compose is a new surface in the Community zone: draft in a simple block editor (title, cover,
body blocks, attachments), preview as the member will see it, publish to the feed or save as
draft. Published posts render in the member feed and at `content/:slug` (mount exists).
ContentStorePage becomes the library view behind Compose (drafts, published, archived). No AI
anywhere in this path; it is authoring plus the existing store.

## 5. Dispositions

Format: current mount → registry key if any → disposition → resulting home.

⚠️ **Verified 2026-08-24, before this ran anywhere: two of the claims below are wrong. Corrected
inline, not silently.**

Dashboard and landings
- /app/dashboard (DashboardHome) → mgmt.dashboard → KEEP, verify by UVT → Dashboard zone,
  landing route for staff. VERIFY which components render the two views and that OpsDashboard /
  OwnerDashboard are not imported by it before deleting them.
  ⚠️ **CORRECTED — do not retire `OwnerDashboard.tsx`.** Verified live: it is imported by
  `DashboardChrome.tsx`, `api-dashboard.ts`, and `DashboardHome.tsx` — it IS the current dashboard,
  built by TASK-DASHBOARDBUILD (2026-08-22/23) and edited continuously since. The "OpsDashboard /
  OwnerDashboard" pairing in the original sentence conflated a genuinely dead file with a live
  one because they share a naming pattern. `OpsDashboard.tsx` (the 2026-07-01 predecessor) is
  correctly retireable; `OwnerDashboard.tsx` is not — retiring it would delete the working
  dashboard. Run the stated import check for real before touching either.
- OpsDashboard.tsx → none → RETIRE (superseded dashboard generation). **Confirmed correct** —
  this is the genuinely dead 2026-07-01 predecessor.
- InstructorHome.tsx, InstructorHomePreview.tsx (/app/ops/preview/instructor-home) → none →
  RETIRE (preview scaffolding).
- /app/ops (OpsHome module launcher) → none → RETIRE; the rail replaces it. Route redirects to
  /app/dashboard. **Before this lands: confirm every module hub currently reachable only through
  this launcher gets a real flat rail entry under WORK** — TASK-DASHBOARDBUILD's own report
  flagged this launcher as "the only reach to some module hubs" and left it standing for exactly
  this reason. Don't repeat that gap.
- hubs/ (Barnops/Boarding/Employees/Lessons/RecordsHubPage) → boarding.hub etc. → RETIRE as
  pages; each module becomes one surface with tabs (below). Registry keys survive on the merged
  surface (TASK-RECORDS precedent: one key, one nav row, tabs inside).
- NavGroupCardsPage.tsx → none → RETIRE.
- review/ (ReviewBanner, ReviewIndexPage, ReviewMounts) → none → RETIRE entirely. Permanent
  homes plus the dashboard are the acceptance mechanism. Any mount only reachable through
  Review gets a permanent home in this document or dies here.

Work zone
- /app/calendar (CalendarPage + CalendarItemPanel) → none (App-pages block) → **REBUILD, not
  KEEP — see §8, this is now a much larger item than originally scoped.** Registry row added;
  CalendarSettingsPanel folds in as calendar-local settings. Gains the scope control
  (today / week / next N / month) as a view toggle, not new pages.
- /app/records + /app/records/:tab (RecordsPage) → people.records → SPLIT. The umbrella
  unwinds per owner ruling:
  - PEOPLE — clients, leads, partners, vendors, archived (D11) as tabs. One nav row.
    ContactsPage and ArchivedAccountsPage merge in (redirect mounts already exist for
    ops/contacts, ops/directory, ops/leads).
    ⚠️ **`Admin.tsx` is NOT dead code.** Verified 2026-08-24: it has exactly one importer,
    `RecordsPage.tsx`, and it IS the live Clients tab today. Any merge here replaces its role,
    it does not delete an already-dead file.
  - HORSES — merge HorsesPage, HorseRecordsPage, records.hub into one list; HorsePage is the
    detail with health (HorseHealthPage) and parties (HorsePartiesPage) as detail tabs.
  - DOCUMENTS — Documents queue/list merged (DocumentsQueuePage + staff Documents view);
    DocumentViewerPage stays the detail. NewContractPage remains the creation flow;
    ContractPage remains contract detail.
  - DEALS — DealsPage list, DealPage detail. KEEP.
  - LESSONS LEDGER — the records/lessons tab becomes the Lessons surface below.
  Each of the five gets its own rail entry and its own registry key. `people.records` retires;
  orphan visibility rows are harmless per the registry's own rules.
- Lessons — lessons.hub, lessons.plans, lessons.credits → CONSOLIDATE into one Lessons surface,
  tabs: Sessions (SessionsPage), Plans (LessonPlansPage + progression v1, see
  PROGRESSION-PLAN.md — **substantially expanded 2026-08-24, see that file**), Credits
  (LessonCreditsPage, Commit actions per TASK-CREDITGRANT), Packages (LessonPackagesPage). Staff
  label stays "Lessons"; member-facing wording per D25.
- Money — NEW rail entry: Payments review (PaymentReviewPage), Board charges
  (BoardChargesPage), Credits ledger cross-link. Revenue figures on the dashboard already read
  true; every figure here deep-links to its ledger rows.
- Boarding — one surface, tabs: Agreements, Charges (also linked from Money), Facilities &
  stalls.
- Barn Ops — one surface, tabs: Resources, Consumption log, Allocation rules.
- Employees — one surface, tabs: Staff, Schedule.
- Intake trio — IntakePage (ops/intake), HorseIntakePage, AcquisitionIntakePage → MERGE into
  creation flows: person creation from People, horse creation from Horses, acquisition intake
  from Deals. VERIFY each page's actual writes before retiring the mounts; AccountInvitePage
  (ops/accounts/new) stays as the invite flow reachable from People.
- /app/evaluations + ops/evaluations (EvaluationsPage, EvaluationReportsPage) →
  community.evaluations → MOVE per D27: evaluations render as record tabs on the rider (People
  detail) and the horse (Horses detail), with the due-queue as a dashboard zone (C12 exists).
  The standalone pages retire once both record surfaces host them.
- Support (ops/support) → mgmt.support → KEEP, Work zone.

Community zone
- ActivityPage (ops/activity) → community.activity → KEEP.
- Compose + ContentStorePage (ops/content) → community.content → REBUILD per §4.
- ModerationPage (ops/moderation) → community.moderation → KEEP; fix the author-list join (one
  of the three flagged bugs).
- Messages (/app/messages) → none → KEEP, registry row added, Community zone.
- OversightPage (ops/oversight) → community.oversight → MOVE to Admin zone (it is an audit
  read, not community work).
- LookupReviewPage (ops/lookups, "Field options") → community.lookups → MOVE to Admin zone.

Admin zone
- Team (TeamPage) → settings.team → KEEP; fix the vanishing save-confirmation on the four
  panel controls.
- Branding (AdminBrandingPage) → settings.branding → KEEP.
- Products (AdminProductsPage) → settings.products → KEEP.
- Forms (AdminFormsPage) → settings.forms → KEEP; BookingFieldsSettings folds in here (D12: the
  Form builder owns it).
- Templates (AdminTemplatesPage + AdminTemplateEditorPage) → none → KEEP, registry rows added
  (document builder per D12; templates never deleted per D16).
- Page visibility (AdminPageVisibilityPage) → settings.page_visibility → KEEP, protected.
- Modules (AdminModulesPage) → none → KEEP, registry row added.
- Registry (AdminRegistryPage) → none → VERIFY: if platform-scoped it moves behind superadmin;
  if tenant-scoped it stays here.
- Oversight, Field options — moved in from Community above.

Member-app mounts listed for scope clarity, untouched: Home, Schedule, Threads, MemberProfile,
ContentPostDetail, member Documents, Onboarding, Orders, Gifts, Catalog, Checkout, MyLessons,
member Support, AccountHub, MyPosts, Stable, CareHome, DealHome, contracts/:id member view.

Superadmin (Organizations, ProvisionTenant, TenantDetail): untouched, out of scope. The
TenantDetailPage suspend-without-confirm defect stays on record for the Commit primitive's
first superadmin adoption, not this refactor.

## 6. Dead ends closed

The back rule plus these retirements close the known dead-end paths: Review-only mounts,
launcher-only reachability (/app/ops), preview routes, hub-card-only children, and
document/contract detail pages that currently strand the user. Claude Code inventories any
remaining route whose only inbound link died in this refactor and reports it in the wave that
touches its area — nothing ships unreachable (D17) and nothing ships exit-less.

## 7. Claims to verify, not inherit

Flow and contract fixes reported complete: verified by live walkthrough in the wave that touches
each area. Dashboard: UVT before its wave closes. The three flagged bugs (Clients 400,
Community author join, Team save-confirmation) are fixed inside their waves, not backlogged.

⚠️ **Add a fourth flagged bug, found 2026-08-24, verified against the live component:**
`src/pages/app/CalendarPage.tsx`'s `itemLabel()` function deliberately returns an opaque label
("Reserved") for any calendar item that isn't `is_mine` — a rule written for a CLIENT viewer
(so one client can't read another client's private schedule) but applied unconditionally,
including to staff. `isStaff` already exists as a variable in this component and is used to gate
several other UI elements, but is never passed into `itemLabel()`. This is why the calendar
shows generic states instead of real names to staff — see PROGRESSION-PLAN.md / the Calendar
section of ADMIN-PAGE-SPECS.md for the full fix, folded into the Schedule rebuild rather than
patched standalone, since the rebuild changes what the label needs to say anyway (offering +
person, D25-correct, category-level for lessons and specific-offering-level for horse care).

## 8. What Claire's actual daily use looks like (owner, 2026-08-24 — read before building §5's Calendar item)

> "The big thing for her is she lives in two places, the dashboard overview, and the calendar
> view with action buttons shown below it and on the items when they are opened from the
> calendar... the other surface is the one she uses when she is working with a client, and that
> surface can be accessed from the dashboard but also by going into it directly, this is focused
> on clients, lessons, horses, horse care, and the activities she does on a daily basis, this is
> where she creates an activity log or a lesson plan or a notes."

Of her three zones, two do almost all the daily work: **Dashboard** (overview — "everything she
is juggling or that needs her attention or that she wants to know should be there") and
**Calendar**, specifically, within Work (not the Work zone broadly — Calendar is where she
actually operates: creates sessions, opens lesson plans, writes activity notes). Design the
Calendar surface accordingly — it is not a peer entry among many, it is Claire's primary working
surface and needs to be genuinely robust, not a thin scheduling grid. Full detail — view modes,
the standing-open-slots removal, the request/booking/payment flow, the label fix, the
panel-to-modal change, the separate activity-report surface, the lesson-plan rebuild — is in
ADMIN-PAGE-SPECS.md's Calendar section and PROGRESSION-PLAN.md, both substantially rewritten
2026-08-24. Don't re-derive any of it here; this section exists only to record the "why" behind
why Calendar gets so much more weight than a typical Work-zone entry.
