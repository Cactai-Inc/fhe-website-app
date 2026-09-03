# BUNDLE-DASHBOARDS — B7 (cut by ORCH, 2026-09-03; RECONCILED-2026-09-02.md §8 row B7)

**Sender: hand everything back to `FHE-ORCH`** (the standing thread answers whatever its number; today
`FHE-ORCH-8`). Bundle tree: `wt-7`. Task trees allotted: `wt-8` (ask ORCH for more; the pool grows on
demand).

## Why this bundle runs NOW
B5 SUPPLIES (running, `FHE-MGMT-SUPPLIES`) specs its dashboard / projection / deviation / report
tasks as CONSUMERS of this bundle's engine and GATES their build on this bundle's merge. **The first
deliverable of this bundle is therefore the ENGINE CONTRACT, before any dashboard is built.**

## Read first, in this order
1. `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-107 (many dashboards + an accessibility selector for
   the two owner accounts; the D13 note there — a which-dashboards selector is access control, not
   arrangement, and is NOT excluded) and §CR-112·A1 **#11, #12, #13** (dashboard config · element
   config · report = snapshot of the user's dashboard + figures; company documents do not co-mingle
   with client documents; outdated/superseded renaming). **These are the requirements.**
2. `docs/design/DASHBOARDS-GROUND-UP-PLAN.md` — the held plan (owner was reviewing; never approved
   as written). Revisit it against 1; do not build it as written.
3. `docs/tasks/TASK-DASHBOARDBUILD-*` + `docs/reports/TASK-DASHBOARDBUILD-REPORT.md` — what IS built:
   two D26 role-emphasis dashboards on the self-arranging zone framework
   (`src/lib/dashboard/registry.ts`, `DashboardView = 'trainer' | 'business'`).
4. `docs/tasks/TASK-FIX6-ops-and-sales.md` (absorbed — its toggle text is CR-107's requirement; do not
   run it as written) · `TASK-DASHFEED-*` (fold; blocked on three owner questions — see escalation 3)
   · `TASK-HOMESHAPES-*` (design input only) · `TASK-DAYSHEET-*` (residual check only; mostly built —
   `api/calendar-reminders.ts` sends the 07:00 Pacific day sheet).
5. `CLAUDE.md` D13 + the D13 exception (self-arranging surfaces need no editor), D18, D19, D32,
   D35/D36, D39, D41/D44.
6. Memory/record: **the two owner accounts premise.** Claire works under `hello@` (shared login;
   `docs/reference/…` shared-login audit gap). CR-107 and CR-112 #11 assume per-ACCOUNT provisioning
   for Claire and CJ separately. The DSNR task MEASURES how many owner accounts exist in production
   before designing per-account anything (escalation 1).

## The items, with state
| # | Item | State |
|---|---|---|
| 1 | **THE ENGINE CONTRACT** — the global, plug-and-play dashboard-config + element-config + report machinery (CR-112 #11–#13): what a dashboard is, what an element is, its inputs and display variants, per-account provisioning from a tenant default, cadence, the report generator (snapshot + explicit figures + per-entity statement + business snapshot), storage, naming/supersession. Written as `docs/design/DASHBOARD-ENGINE-CONTRACT.md` and sent UP to ORCH the moment it is stable, so B5 can spec against it | **DSNR spec needed (Fable) — FIRST** |
| 2 | **CR-107** — many dashboards; an accessibility selector deciding which dashboards each owner account can reach; the dashboards page as the door | plan exists, never approved; spec needed |
| 3 | M5 — the `_waiting_items()` spine: `dash_waiting_on_you` / `dash_waiting_on_clients` live in production with zero callers; `b9bc9edc` WaitingZones deliberately unmerged | facts known; decide reuse-or-retire inside item 1/2's spec (D32: retire = leave, never drop) |
| 4 | M2 — the owner's dashboard metric list (never received) | escalation 2 |
| 5 | DASHFEED — cluster by what it asks of you | fold; escalation 3 |
| 6 | HOMESHAPES — member home is `AppOverviewModal` only; no zones by account shape | design input to item 1 (a client dashboard is a dashboard under the same engine) |
| 7 | DAYSHEET residual — Claire's static advancing day view, if anything; then archive its 1,327 lines of working notes | residual check inside DSNR; archive is a docs move (allowed here, it is this bundle's file) |
| 8 | FIX6 — absorbed by CR-107 | closed by item 2; write the one-line disposition in the bundle report |

## Ownership declaration (D35/D36) — this bundle holds:
- **DB:** `dash_waiting_on_you` · `dash_waiting_on_clients` · `_waiting_items` · every NEW
  table/function for dashboard config, element config, per-account provisioning, report generation
  and report storage. Reports are "stored in documents" (CR-112 #12) — **declare the exact storage
  objects before applying** (the `files`/`file_links` spine exists; the contract-system `documents`
  table is under the signing freeze — do not add columns to it without ORCH's word).
- **Files:** `api/deliver-report.ts` · `api/reports-monthly.ts` (both NEW — report email delivery and
  monthly auto-generation, CR-112·A1 #10/#12, CR-113's digest scheduler; unowned until now — ORCH
  grants them to this bundle 2026-09-03) + the matching `.github/workflows/scheduled-jobs.yml` line ·
  `src/lib/dashboard/**` · `src/components/app/dashboard/**` (`DashboardChrome`,
  `TrainerZones`, `BusinessZones`, new zones) · `src/pages/app/ops/OwnerDashboard.tsx` · the
  dashboards page + selector (new) · the company "my documents" page (new) · `api/calendar-reminders.ts`
  ONLY if item 7 finds a residual · `docs/design/DASHBOARDS-GROUND-UP-PLAN.md` (revise or supersede)
  · `pageRegistry.ts` rows for the new pages.
- **NOT this bundle's:** supplies data, the supplies dashboard's CONTENT and its report figures
  (B5 consumes the engine) · `AppLayout.tsx` nav (B10) · the requests inbox zone's content (B6 —
  this bundle provides the zone slot and the contract) · first-party analytics `page_events` /
  `client_errors` beacons (plan §8 gaps 3–4 — that is B4 SITE / CR-106; a dashboard tile READS it
  later) · the tasks/reminders substrate (plan §5 — not in any CR; do NOT build it; list it as a
  proposal in the report).
- **Trees:** `wt-7` (MGMT) · `wt-8` (tasks).

## Pre-registered escalation points (the only summons) — each with what to put in front of him
1. **Two owner accounts?** If production has ONE owner login (`hello@` shared), per-account
   provisioning for "Claire and myself" has no second account to provision. Prepare: the accounts
   that exist, the delta, two options (a second owner account · a per-person profile under one
   login), a recommendation.
   → **CLOSED-BY-EVIDENCE 2026-09-03 (MGMT re-ran):** two distinct tenant ADMIN logins exist (`admin@`→business, `hello@`→trainer). The shared-login gap is that stamps under `hello@` cannot say which PERSON acted; provisioning follows the login. Not raised with the owner.
2. **The metric list (M2)** — he said he had one in a chat thread; ask for it ONCE with the
   engine's element list as the frame (what each element needs as input).
3. **DASHFEED's three owner questions** — restate them from `docs/method/04-OPEN*` verbatim; he
   answers or strikes.
   → **COLLAPSED 2026-09-03:** 04-OPEN §1 (messaging: one store, three views, after T3) and §2 (two boards stay; shared facts on both) are ANSWERED in the file; §3 (the metric list) IS escalation 2. Restated verbatim in `FHE-DSNR-DASHBOARDS-HANDOFF.md` §6.3.
4. **Element-config vs D13** — CR-112 #11's element config (inputs + display variant per element)
   is a per-element EDITOR. The D13 exception excluded ARRANGEMENT editors. Put the boundary in front
   of him: selector = access (allowed), element config = content/formula (D13 says owner-editable),
   zone arrangement (excluded). Recommend and ask "in force?".
5. **The company documents page** — a new owner-only surface; its name and its place (Account? the
   dashboards page? Admin?). One recommendation.
6. Anything the spec cannot resolve from CR-107 / CR-112 #11–#13 — ask ONCE, batched.

## Gates to ORCH
- **The engine contract goes UP before any build** (B5 is waiting on it).
- **A standard being set:** the dashboards page, the selector and the report modal shape are
  standards every later dashboard inherits — render checklist up before merge.
- **Anything a client sees** (a client dashboard under the engine, a client report) — up before
  merge, always.

## Merge lane
Engine contract + config tables + registry changes FIRST, as one unit (so B5 can build against a
merged interface). Then dashboards / selector / report generator per task after VRFY.

## Sequence inside the bundle
DSNR (tier: MGMT evaluates and decides, D45 — the SHAPE: the engine contract, the plan revisit, the spec set + disjoint chunk
declaration) → CODR (Opus · HIGH · ON) in parallel where DSNR declared disjoint → VRFY per merge
(Opus · HIGH · ON; production: per-account config lands on the ACCOUNT not the tenant; report
generation is idempotent; outdated/superseded renaming works on regeneration; `proacl` on every new
function — fresh functions inherit anon via default privileges) → WALKR at close: the owner's
dashboards page as each owner account · generate a monthly report · the supersede path (FLOW-MAP
names where they exist; WALKTEST fixture, never a real client).

## Suggested model/effort — SUGGESTIONS ONLY (D45): MGMT evaluates each task's work and decides, stating why
DSNR: MGMT decides (D45). CODR: Opus · HIGH · ON. VRFY: Opus · HIGH · ON. WALKR: Opus · HIGH · ON.
