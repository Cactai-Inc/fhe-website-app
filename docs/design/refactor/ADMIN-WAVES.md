# ADMIN-WAVES — execution sequence for the orchestrator

Rules for every wave: smallest correct diff per task; fix every flagged bug on any page the
wave touches (nothing backlogged); live walkthrough of the wave's surfaces before the wave
closes — code inspection is not verification; report per wave with test results, questions,
challenges, gaps, conflicts. No new mechanism beside an existing correct one (D18). Registry
keys never change when paths move.

⚠️ **Not yet safe to run as written — see ORCH3 notes appended 2026-08-24 at the end of this
file before sending any wave to a build thread.**

## Wave 0 — shell and dead wood (no data work)
1. Shared shell: PageHeader with declared back targets, rail grouped by the four zones,
   role-scoped; mobile top bar + bottom bar (Dashboard / Create / Menu); Create sheet stub
   wired to existing creation routes.
2. Retirements: review/*, hubs/*, OpsHome launcher (redirect /app/ops → /app/dashboard),
   NavGroupCardsPage, InstructorHome + preview route, OpsDashboard, OwnerDashboard (after the
   DashboardHome import check). Redirect table for every retired path — no 404s from old
   bookmarks.
3. Registry pass: rows added for Calendar, Messages, Templates, Modules; people.records
   replaced by the five split keys; hub keys carried onto merged surfaces.
Exit: every rail entry lands on a real page one click deep; no route without a back target;
walkthrough of the full rail on desktop and mobile.

## Wave 1 — Dashboard verification + Money
1. UVT the dashboard: both views, both accounts, every zone row's deep link against the Wave 0
   route table.
2. Money surface assembled (payments review, board charges, ledger links); figure-traceability
   spot-check: every displayed number opens its rows.
Exit: owner walkthrough sign-off on both views.

## Wave 2 — People + Horses
1. Records split: People page with five tabs incl. Archived; Clients 400 fixed; ?open= deep
   links preserved; ContactsPage/ArchivedAccountsPage retired into it.
2. Horses merged (list + detail tabs incl. health, parties); records.hub retired.
3. Evaluations render as record tabs on rider and horse (D27); standalone evaluation pages
   retire once verified reachable from both.
4. Intake trio verified and merged into creation flows; invite flow reachable from People.
Exit: create-person (email-minimum for what the current model allows), create-horse, invite,
archive, evaluation-open all walked live.

## Wave 3 — Documents + Deals
1. Documents desk (queue + library) merged; viewer detail kept; dead-end exits closed
   (viewer/contract pages get back targets).
2. Deals: acquisition intake as creation flow; inline party add verified against current model.
3. Contract-system completion claim verified by walkthrough here: create → parties → sign →
   countersign → executed, one pass, real UI.
Exit: the contract walkthrough passes or its failures are reported as findings, not patched
silently.

## Wave 4 — Lessons + progression v1
1. Lessons surface with four tabs; credits Commit actions carried over intact.
2. Progression v1 per PROGRESSION-PLAN.md: schema, seed curriculum, plan composition from the
   rider frontier, progress marking in the session write-up, milestone flags.
3. Dashboard Notes/Plans zones read real progression data.
Exit: Claire composes a real plan for a real rider in under a minute without free-writing;
write-up marks progress; milestone appears.

## Wave 5 — Community
1. Compose + content library; publish renders in member feed and content/:slug.
2. Moderation author join fixed; Activity restyled; Messages onto the shell.
Exit: author → draft → preview → publish → member-visible, walked live.

## Wave 6 — Admin zone
1. Templates/Forms/Products/Branding/Modules/Field options/Page visibility/Oversight onto the
   shell; Team save-confirmation fixed; BookingFieldsSettings folded into Forms; Registry page
   scope resolved.
Exit: full-rail walkthrough repeat; zero pages outside the shell; report closes with the
remaining-defects list (target: empty).

---

## ORCH3 notes, appended 2026-08-24 — read before sending any wave

1. **Wave 0 step 2's "OwnerDashboard (after the DashboardHome import check)" is wrong as
   written.** Verified live: `OwnerDashboard.tsx` is imported by `DashboardChrome.tsx`,
   `api-dashboard.ts`, and `DashboardHome.tsx` — it is the current dashboard (built by
   TASK-DASHBOARDBUILD, 2026-08-22/23). Only `OpsDashboard.tsx` (the 2026-07-01 predecessor) is
   correctly retireable. See ADMIN-IA.md §5 for the full correction.
2. **The primitive kit this whole sequence depends on has not been built.** `src/ui/` does not
   exist; `.claude/skills/fhe-ui/` does not exist (both checked directly, 2026-08-24). Wave 0
   step 1 names "PageHeader" but not the rest of 01-DESIGN-SYSTEM.md's kit (Section, CardGrid,
   FormGrid, Toolbar, Table v2, RecordList, DetailDrawer, Commit, StatusChip, LedgerList, the
   four non-content states, Toast) that ADMIN-PAGE-SPECS.md assumes every later wave composes
   from. Either the kit needs an explicit build step added to Wave 0, or someone confirms it
   exists somewhere this check missed — as written, Waves 1–6 have a silent unmet dependency.
3. **The Commit pattern (D19 tiers) is still marked "proposed, awaiting owner sign-off" in its
   own source document** (01-DESIGN-SYSTEM.md §6), but every wave here treats it as settled.
   Confirm sign-off before Wave 0 builds it as a primitive everything else calls.
4. **Calendar (Wave 1's implicit scope, via the Dashboard's Schedule dependency) is now a much
   bigger item than a re-skin.** See ADMIN-IA.md §8, ADMIN-PAGE-SPECS.md's Calendar section, and
   PROGRESSION-PLAN.md — the owner specified a real rebuild (standing-open-slots removal, the
   request/approve/pay flow, a label bug fix, panel→modal, a separate activity-report surface,
   and a full-page Lesson Plan with bidirectional notes) on 2026-08-24. This wave sequence does
   not currently reflect that scope increase; whoever schedules Calendar needs to size it against
   the expanded spec, not the one-line original description.
5. **Admin.tsx is not dead code** — one live importer (`RecordsPage.tsx`), currently the Clients
   tab, currently being edited by a separate in-flight thread (TASK-PAMELA). Coordinate before
   Wave 2 touches it.
