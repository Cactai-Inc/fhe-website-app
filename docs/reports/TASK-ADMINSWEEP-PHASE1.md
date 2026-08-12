# TASK-ADMINSWEEP — Phase 1: inventory and reconciliation

**Status: Phase 1 complete. Hard stop for owner review. No code changed.**

Branch `task/adminsweep`, rebased onto `origin/main` at **d84a562** (after UPLOADS,
ONEAUTHOR and DOCQUEUE merged). Database facts queried live against prod
`lrstswfxfsezdmvkvukc` on 2026-08-11. This document is the only output; nothing was
built, deleted, merged or re-iconed, per the task's Phase 1 constraint.

Where a carried finding turned out to be different on inspection, this report says so
and gives the evidence rather than repeating the original figure.

---

## 1a. What exists

### The nav as it stands

Six groups, built by `manageNavGroups()` in
[AppLayout.tsx:353](src/components/app/AppLayout.tsx#L353). **25 tenant-side entries**;
super-admin instead gets a 3-entry Platform rail that replaces everything.

Of the 25, **22 are visible to this tenant's admin today**. Three are hidden because
their module is off: `mod.boarding`, `mod.barnops` and `mod.employees` are all `false`
in `org_modules`. Enabled: `mod.lessons`, `mod.horserecords`, `mod.brokerage`.

### The route table

**50 staff-gated routes** are registered under `/app` in
[App.tsx:253-321](src/App.tsx#L253-L321). The nav reaches 25 of them. The rest are
reached from inside pages — or, in three cases, not at all.

#### Nav entries → pages (all render real data)

| Route | Nav label | Group | Renders | Data |
|---|---|---|---|---|
| `/app/dashboard` | Dashboard | Management | `DashboardHome` | notifications + open leads |
| `/app/ops/support` | Support | Management | `SupportPage` | `listSupportRequests` |
| `/app/ops/lessons` | Lessons | Management | `LessonsHubPage` | `lessonsSummary` (gated `mod.lessons`, ON) |
| `/app/ops/horse-records` | Horses | Management | `HorseRecordsPage` | `staffHorseRecords` |
| `/app/ops/documents` | Documents | Management | `DocumentsQueuePage` | rebuilt by DOCQUEUE (411 lines) |
| `/app/ops/deals` | Deals | Management | `DealsPage` | `contractPartyOptions` |
| `/app/ops/payments/review` | Payment review | Management | `PaymentReviewPage` | `payment_notifications` — **0 rows** |
| `/app/ops/leads` | Leads | People | `LeadsPage` | `ContactDirectory mode=leads` |
| `/app/admin` | Clients | People | `Admin.tsx` roster cards | 30 contacts |
| `/app/ops/contacts` | Contacts | People | **redirect → `/app/admin`** | — see defect N-1 |
| `/app/ops/team` | Team | People | `TeamPage` | `adminListMembers` + grants |
| `/app/ops/directory` | Directory | People | `DirectoryPage` | `ContactDirectory mode=directory` |
| `/app/ops/activity` | Activity | Community | `ActivityPage` | `statusFeed` |
| `/app/ops/evaluations` | Evaluations | Community | `EvaluationReportsPage` | `staffContactDirectory` |
| `/app/ops/moderation` | Moderation | Community | `ModerationPage` | `feedModerationList` |
| `/app/ops/lookups` | Field options | Community | `LookupReviewPage` | `listLookupSuggestions` |
| `/app/ops/content` | Content store | Community | `ContentStorePage` | rebuilt by UPLOADS (288 lines) |
| `/app/ops/oversight` | Oversight | Community | `OversightPage` | `adminOversight` + integrity panel |
| `/app/ops/boarding` | Boarding | Modules | `BoardingHubPage` | **hidden — `mod.boarding` off** |
| `/app/ops/barnops` | Barn Ops | Modules | `BarnopsHubPage` | **hidden — `mod.barnops` off** |
| `/app/ops/records` | Records | Modules | `RecordsHubPage` | `listRecordHorses` |
| `/app/ops/employees` | Employees | Modules | `EmployeesHubPage` | **hidden — `mod.employees` off** |
| `/app/ops/admin/branding` | Branding | Settings | `AdminBrandingPage` | brand + property term |
| `/app/ops/admin/products` | Products | Settings | `AdminProductsPage` | 43 offerings |
| `/app/ops/admin/forms` | Forms | Settings | `AdminFormsPage` | `adminFormDefinitions` |

**Verification criterion 1 result: no stubs and no 404s.** Every nav entry resolves to a
page that reads live data. `SEED_ENABLED` is `false` in [seed.ts:10](src/lib/seed.ts#L10),
so no admin surface is showing sample content. The one nav entry that does not resolve to
a page of its own is Contacts, which redirects (defect N-1 below).

#### Routes with no nav entry

| Route | Page | Reachable? |
|---|---|---|
| `/app/ops` | `OpsHome` → `OpsDashboard` (admin) / `InstructorHome` (trainer) | **NO** |
| `/app/ops/horses` | `HorsesPage` — horse roster + create/edit | **NO** |
| `/app/ops/availability` | redirect → `/app/calendar` | **NO** (dormant legacy redirect) |
| `/app/ops/intake` | `IntakePage` — 907 lines | **conditionally** — see R-3 |
| `/app/ops/accounts/new` | `AccountInvitePage` | yes — CreateModal, Clients, NewContract |
| `/app/ops/contracts/new` | `NewContractPage` | yes — CreateModal, ClientRecordActions, doc queue, DocumentQueuePicker |
| `/app/ops/documents/:id` | `DocumentViewerPage` | yes — from the queue |
| `/app/ops/deals/:dealId` | `DealPage` | yes — from Deals |
| `/app/ops/superadmin/provision` | `ProvisionTenantPage` | yes — from Organizations |
| `/app/ops/lessons/{packages,credits,sessions}` | 3 pages | yes — from Lessons hub |
| `/app/ops/records/horses/:id/{parties,health}` | 2 pages | yes — from Records hub |
| `/app/ops/boarding/{facilities,agreements,charges}` | 3 pages | dark — hub hidden, module off |
| `/app/ops/barnops/{resources,consumption,allocation-rules}` | 3 pages | dark — hub hidden, module off |
| `/app/ops/employees/{staff,schedule}` | 2 pages | dark — hub hidden, module off |

### The three unreachable surfaces

**R-1 · `/app/ops` — the admin's own dashboard cannot be opened.**
No nav entry, and the only mention of the string `/app/ops` anywhere outside `App.tsx` is
a doc comment in [OpsDashboard.tsx:14](src/pages/app/ops/OpsDashboard.tsx#L14). This was
flagged as an open routing question before this sweep; what the sweep adds is the size of
what is behind it. `OpsHome` is a role switch, so **two** whole surfaces are dark:
`OpsDashboard` (221 lines — tenant KPIs, work-queue counts, module launcher) and
`InstructorHome` (the trainer's entire home: today's sessions, client count, request
queue). A trainer signing in has no landing surface at all.

This also strands the only working links to Intake: both dark pages link to it.

**R-2 · `/app/ops/horses` — a third horse page nobody can open.**
`HorsesPage` (127 lines, roster + create/edit modal over `listHorses`/`createHorse`) has
**zero** references in the entire codebase outside its route registration. There are now
three horse surfaces over the same 4 horses:

- `/app/ops/horse-records` — nav "Horses" (Management), ungated, owner/lessee assignment
- `/app/ops/records` — nav "Records" (Modules, `mod.horserecords`), ownership + health lanes
- `/app/ops/horses` — unreachable

**R-3 · `/app/ops/intake` is reachable only when there is work in it.**
Inbound was deliberately removed from the nav (UIO-012), but nothing replaced the entry
point. The only live path is the Dashboard's lead tiles — either a per-lead tile
(`/app/ops/intake?request=<id>`) or the "N more waiting →" button, which
[renders only when there are more leads than fit](src/components/app/DashboardPanel.tsx#L348).
With an empty lead list there is **no route to the page**. It is reachable today only
because `requests` holds 7 `new` + 5 `contacted` rows. This is the largest ops page in the
codebase and its reachability depends on the data.

### One more dark module

`mod.brokerage` is **enabled** for this tenant but has no nav entry and no hub page — the
entry was removed because it pointed at an unregistered route and 404'd
([AppLayout.tsx:331](src/components/app/AppLayout.tsx#L331)). An enabled module with no
surface.

---

## 1b. What the business needs

The owner's three sections, carried from the task unchanged. This is the specification
Phase 2 designs against; it is not derived from the code.

| Section | Contains |
|---|---|
| **Sales** | KPIs, plus all sales content: orders, payments, and the obligation books by service category (Lessons, Horse care) |
| **Marketing** | KPIs, plus internal posts, external posts, campaigns, planning |
| **Business / company management** | brand, account, company settings — "all that type of stuff rolls up into one page" |

---

## 1c. The reconciliation

### HAVE AND KEEP

Everything in the nav table above renders real data and belongs to one of the three
sections. Mapped to the owner's structure:

- **Sales** — Payment review, Deals, Products, Lessons hub (packages/credits/sessions)
- **Marketing** — Content store, Moderation, Activity *(all record/QC surfaces; none is
  a marketing surface in the owner's sense — see NEED AND MISSING)*
- **Business/company** — Branding, Forms, Field options, Team, Oversight
- **People** — Clients, Leads, Directory, Team
- **Records** — Horses, Records hub, Documents, Evaluations, Support

### HAVE AND REMOVE — candidates for the owner's decision

Phase 1 does not remove. These are put forward with evidence; the owner decides, and
Phase 2's "remove first" step executes whatever survives review. Removal means hidden
behind a boolean, never deleted (the `86a2c33` rule).

| # | Candidate | Evidence | Note |
|---|---|---|---|
| X-1 | **Contacts** nav entry | Route already redirects to `/app/admin`; duplicate of the Clients entry three rows above it | Defect N-1 — the retirement is half-applied |
| X-2 | `/app/ops/horses` (`HorsesPage`) | Zero references; third page over the same 4 horses | Already effectively removed; make it deliberate |
| X-3 | `/app/ops/availability` redirect | No nav, no links, target long since moved to the calendar | Dormant |
| X-4 | Two of the three horse surfaces | Horses / Records / (unreachable) Horses all read the same roster | Which two is a Phase 2 design call, not a sweep call |

**Explicitly NOT proposed for removal:** the module pages behind off modules
(boarding ×4, barnops ×4, employees ×3). They are dark by design — module gating working
correctly for a tenant that has not bought them — not dead code.

### NEED AND MISSING

| # | Need | State today |
|---|---|---|
| M-1 | **Orders (business)** | Nothing. `/app/orders` is the member's own order list (`OrdersContent`, shared with the Account panel) and is hidden from admin. No admin order surface of any kind. |
| M-2 | **Horse care** | The 12 offerings exist and are correctly segmented in the DB (`segment='horse'`: 6 `recurring`, 6 `scheduled`) — but there is no page, no nav entry, no label and no module. The catalog knows about horse care; the admin surface does not. |
| M-3 | **Obligations view of Lessons** | `/app/ops/lessons` is a KPI hub (credits outstanding, active packages, clients with credits) over `lesson_packages` + `lesson_credits`; `/app/ops/lessons/sessions` is a day-grouped booking board. Neither shows what the business is carrying. |
| M-4 | **Sales KPIs / P&L / expenses** | Backend written and unapplied (below). **No client code exists either** — nothing in `src/` references any of its 8 objects, and there is no `api-sales.ts` or `api-business.ts` in `src/lib/ops/`. |
| M-5 | **Marketing, entirely** | No campaign, post-performance, or planning surface, and **no tables to build one on**. The only marketing-adjacent tables are `content_posts` (0 rows), `feed_posts` (20), `content_resources`, `content_blocks`. No campaign/audience/schedule table exists. |
| M-6 | **A landing surface for staff** | `OpsDashboard` and `InstructorHome` are both built and both unreachable (R-1). This one is "have, can't get to" rather than "missing" — the cheapest item on the list. |
| M-7 | **A brokerage surface** | `mod.brokerage` is on with nothing behind it. |

**The structural gap the task names is confirmed and is worse than "almost none".**
Admin has pages for records — contacts, horses, documents, leads, team, evaluations — and
exactly one money surface, Payment review, whose queue is empty. `Deals` is contracts.
There is no admin surface anywhere for what was sold, what is owed, or what was collected.

---

## Carried findings — verified, with two corrections

### The obligations ledger: generation IS firing. The ledger is thin because commerce is thin.

The task asked for this to be established before anything is built on it. It was, against
prod:

- Trigger `purchase_items_generate_units` (AFTER INSERT ON `purchase_items` →
  `trg_generate_fulfillment_units()`) is live and **fires correctly**.
- **All 6 live `purchase_items` have their units** — 3 `recurring` → `period`, 3
  `scheduled` → `session`. Coverage is 100%, not partial.
- `fulfillment_units` now holds **12 rows, not 7** (period 3 / session 9).

So the emptiness is not a generation bug. The whole commerce dataset is tiny: **2
purchases and 6 purchase items**, both purchases `awaiting_payment` / `unpaid`
($420 and $1,000). A view over this ledger will look empty because it *is* empty, which is
the risk the task named — but the cause is upstream of the ledger.

Two things found while establishing this, both of which affect any page built on it:

**F-1 · Half the ledger is orphaned.** 6 of the 12 units point at `purchase_id` **and**
`purchase_item_id` values that no longer exist, despite both FKs being `ON DELETE CASCADE`
and `convalidated = true`. The `purchases` display-code sequence has reached PUR-000059
with 2 rows surviving, so roughly 57 purchases were hard-deleted — evidently with FK
triggers suppressed (a restore or a `session_replication_role = replica` cleanup), which
is how cascade was bypassed. An obligations page would show 6 unattributable rows.

**F-2 · The consumption side has never been exercised.** Not one booking of any status
carries a `purchase_id`, `credit_id` or `contract_id` — 0 of 319 — and not one
`fulfillment_unit` carries a `booking_id`. Of the 319 bookings, 280 are `available`
(availability slots) and 39 are `scheduled`. The ledger generates but is never consumed,
so every unit reads `open` forever. **An obligations view built today would show 12 open
units, 6 of them orphaned, and nothing ever closing.** This is the finding that most
affects M-3.

### The Sales backend is genuinely unapplied

Confirmed: none of the 8 objects in
`supabase/migrations/20260726090000_biz_expenses_and_financials.sql` exist in prod —
`sales_summary`, `business_kpis`, `growth_summary`, `profit_and_loss`, `upsert_expense`,
`delete_expense`, `list_expenses`, `expense_categories_list` all return nothing from
`pg_proc`. Not applied, per the constraint. **Adding to the carried note:** there is no
client code for it either, so "Sales has a backend waiting" is accurate about the SQL and
overstates how close the surface is — the entire read path and UI remain to be written.

### Marketing has nothing — confirmed, and the gap is at the schema level

No campaign, audience, schedule, or post-performance table exists. M-5 is not a missing
page; it is a missing subsystem.

---

## Nav changes — reported, not applied

`AppLayout.tsx` belongs to MOBILEPASS, and NAVMOTION is live in it. Per the constraint,
these are reported for whoever owns the file:

**N-1 · The Contacts retirement is half-applied — two nav rows, one page.**
[ContactsPage.tsx:518-524](src/pages/app/ops/ContactsPage.tsx#L518-L524) states that while
`CONTACTS_PAGE_RETIRED` is true, "the `/app/ops/contacts` route redirects to `/app/admin`
**and the nav item is hidden**." The route half is done. The nav half is not:
`CONTACTS_PAGE_RETIRED` is referenced only in `App.tsx`, never in `AppLayout.tsx`, and
`{ to: '/app/ops/contacts', label: 'Contacts' }` is still an unconditional member of
`ACCOUNTS_GROUP` at [AppLayout.tsx:311](src/components/app/AppLayout.tsx#L311). The People
group therefore shows **Clients** and **Contacts** three rows apart, both landing on
`/app/admin`. The one-line fix is to filter that entry on `CONTACTS_PAGE_RETIRED`, in the
file's owner's hands.

**N-2 · Nothing in the nav reaches `/app/ops`** (R-1) — including for trainers, who have
no home surface at all as a result.

**N-3 · Three nav entries share the `Contact` icon** (Leads, Team, Contacts) and three
share `Shield` (all of Settings). Noted only because it intersects the settled icon
assignment; the icon exercise is not re-opened here.

---

## What could not be determined

1. **Whether `/app/ops` should be nav-linked or retired.** Deliberately not decided — it
   is an open routing question and the answer depends on Phase 2's grouping, which comes
   last by design. Both surfaces behind it are intact and building.
2. **Why the 6 orphaned units survived a validated cascade (F-1).** The mechanism is
   inferable (FK triggers suppressed during a bulk delete) but the specific event is not
   recoverable from the current DB state. It does not block Phase 2; it does mean any
   obligations page needs an orphan filter.
3. **Whether the 39 scheduled bookings *should* have carried purchase links (F-2)**, or
   whether they predate the purchase↔booking wiring. Distinguishing a wiring bug from
   legacy data needs the booking-creation path traced end to end — out of scope for an
   inventory, and worth its own task before M-3 is built.
4. **Whether "Horse care" (M-2) is a module or a section.** The catalog segmentation
   (`segment='horse'`) supports either. This is a Phase 2 structure decision.
5. **Runtime rendering.** Every page was verified by reading its data path, not by opening
   it in a browser. No admin surface was clicked through. The claim "renders real data"
   means the page calls a live API for its content and has no seed fallback; it is not a
   visual confirmation.

---

## Verification

| Criterion | Result |
|---|---|
| 1. Every admin nav entry resolves to a page that renders real data — no stubs, no 404s | **Pass**, with one qualifier: 25/25 resolve and none is a stub; the Contacts entry resolves to a redirect, not a page of its own (N-1) |
| 2. Nothing reachable that the owner marked remove | **N/A in Phase 1** — nothing has been marked yet; the candidate list is above for review |
| 3. Everything needed exists or is listed as deferred with a reason | **Pass** — M-1 … M-7, each with its state and blocker |
| 4. Typecheck, lint, build clean | **Pass** — all three run, exit 0, on d84a562 |

Phase 1 changed no code, so criterion 4 is a baseline check rather than a regression
check: the only file this task adds is this Markdown report. All three ran green in the
worktree:

- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) — exit 0
- `npm run lint` (`eslint .`) — exit 0, no output
- `npm run build` (vite build → prerender → seo-files) — exit 0, prerendered
  `/lessons`, `/horse`, `/acquisition`, wrote `sitemap.xml` + `robots.txt`

Two environment notes, since both cost a false result before they were caught:

- The worktree had no `node_modules`. The first typecheck failed with
  `tsc: command not found`, and an earlier check that reported dependencies present was a
  misread of a pipeline's exit code, not a real result. Dependencies are now symlinked
  from the main checkout.
- The worktree had no `.env`, so the first full build failed at the prerender step with
  `Error: supabaseUrl is required` — *after* `vite build` itself had succeeded. That is an
  environment failure, not a code failure; with `.env` copied in, the full build passes.
  Worth knowing for any worktree-based task that reports "build clean": the vite step and
  the prerender step fail for different reasons and only the latter needs credentials.

Both `node_modules` and `.env` are gitignored, so neither is committed.

---

## Where Phase 2 starts

The task's sequence is **remove, then build, then group**. Phase 1 hands over:

- a removal list of 4 candidates (X-1 … X-4), of which X-1 is a live defect rather than a
  judgement call;
- a build list of 7 needs (M-1 … M-7), of which **M-6 is nearly free** — two finished
  surfaces are one routing decision away from being reachable;
- one thing that must be settled before M-3 is built: **F-2**. The obligations view has a
  ledger that generates and never gets consumed. Building the view first would show an
  empty board and the page would take the blame.

Grouping is not proposed here, by design. `docs/reference/nav-icon-exercise.md` was used
only for the settled icon assignment; none of its merges informed any finding above.
