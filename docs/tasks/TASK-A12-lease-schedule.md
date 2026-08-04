# TASK A12 — Horse record shows the partial-lease schedule captured in the contract

Tracker item **A12 only**. A11 is DONE (merged: `viewer_is_lessee`, lease term on stable cards).
A13 (lesson booking) is a separate task — do not touch booking code.

## Verified current state (orchestrator discovery 2026-08-04 + A11 results — trust this)

- Schedule data lives ONLY in the contract: `TXN.DAYS_USED` (input_kind `week_grid` — composed
  TEXT via `compose_week_grid`, not structured data) and `TXN.SCHEDULE_TERMS` (longtext), both
  in section SCHEDULE of HORSE_LEASE_V2. Nothing copies them anywhere; no horse RPC or UI
  references them.
- `horse_page_detail` was extended by A11 with a top-level `viewer_is_lessee` key (migration
  `20260804130000_horse_page_viewer_is_lessee.sql` — use THIS as the current function body to
  extend; it is the live truth).
- HorsePage (`src/pages/app/HorsePage.tsx`) tabs: record | documents | schedule | history. The
  "schedule" tab is the BOOKINGS list — a different concept with the same name. A12 renders on
  the RECORD tab, NOT there.
- Test data exists: horse `a8e82033-cf9e-48aa-8ea5-a856f2ede597` ("Beau") is stamped with
  lessee `352c3898-...`, lease_start 2026-08-01, open-ended, from executed lease
  `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` (which has `TXN.LEASE_TYPE = PARTIAL`).
- Lease-template detection helper exists: `is_horse_lease_template(key)`.

## Locked design (do not revisit)

Read-through, not copy: the lease schedule is read FROM the executed lease document at display
time. No new columns on `horses`, no stamping, no new tables.

## Work items

1. **Migration**: extend `horse_page_detail` (CREATE OR REPLACE, carrying the A11 body forward
   unchanged) with a top-level `lease` jsonb object, present only when an ACTIVE executed lease
   exists for the horse: the latest EXECUTED, non-deleted document whose template satisfies
   `is_horse_lease_template` and is linked to this horse (use the same linkage the execution
   trigger uses — `documents`/`contracts` horse linkage as found in
   `20260803020001_execution_effects_null_guard.sql`), whose lease window covers current_date
   (start <= today, end null-or-future — read the window from the horses stamp, which is the
   execution-time truth). Shape:
   `{ lessee_name, lease_start, lease_end, lease_type, days_used, schedule_terms, source_document_id }`
   where `days_used`/`schedule_terms`/`lease_type` are that document's `contract_fields` values
   for `TXN.DAYS_USED` / `TXN.SCHEDULE_TERMS` / `TXN.LEASE_TYPE` (null when blank). Dry-run in
   `BEGIN;...ROLLBACK;`, apply live, verify via a real `SELECT horse_page_detail('a8e82033-...')`.
2. **Type**: `src/lib/horses.ts` — add the `lease` object to `HorsePageDetail` (nullable).
3. **UI**: `HorsePage.tsx` RECORD tab — a "Lease" block rendered only when `lease` is non-null:
   term line (reuse the A11 framing — "You lease..." when `viewer_is_lessee`, else "Leased
   to..."), lease type when present, "Reserved days" rendering `days_used` as preformatted
   lines (it is composed text — do NOT parse it), "Additional schedule terms" for
   `schedule_terms` when present. Match the page's existing Detail/card styling exactly. No
   lease = block absent entirely.
4. **Live proof**, raw psql in the report: `horse_page_detail` for Beau returns the `lease`
   object with the real `TXN.DAYS_USED` text from the executed lease (if that field is blank on
   the test lease, say so and show the object with nulls — do not fabricate schedule data).

## Rules
- Branch `task/a12-lease-schedule` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-a12 -b task/a12-lease-schedule origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB: the ONLY write is the one migration. Everything logged.
- `src/components/app/ClauseDocument.tsx` is FROZEN. Signed documents are never deleted. Do not
  touch booking code (A13's lane) or `CalendarPage.tsx`.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors) + the live proof.
- Update `docs/BUILD_TRACKER.md` A12 honestly ("server-verified, browser pending" if true).
- Report: `docs/reports/TASK-A12-REPORT.md`, committed + pushed. Print ONLY the report path.
