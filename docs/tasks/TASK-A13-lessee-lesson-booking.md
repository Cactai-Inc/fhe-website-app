# TASK A13 — Lessee can book lessons with their leased horse

Tracker item **A13 only**. A11 is DONE (merged). A12 (lease schedule display) runs in a
parallel thread — do NOT touch `horse_page_detail`, `HorsePage.tsx`, or `src/lib/horses.ts`.

## Verified current state (orchestrator discovery 2026-08-04 — trust this, do not re-derive)

- `attach_booking_horse(p_booking_id, p_horse_id)` eligibility (live prosrc): caller owns the
  booking; kind must be lesson|care; horse test = `current_owner_contact_id = caller` OR any
  active `horse_relationships` row (`hr.active AND (term_end IS NULL OR term_end >=
  current_date)`) — it does NOT check `horses.lessee_contact_id`, has NO relationship-role
  filter (any role qualifies), and no lease-window bound of its own. Care-only doc gate:
  `assert_horse_care_eligible`.
- `book_open_slot(p_booking_id, p_horse_id)`: kind derived from offering segment
  (`horse`→care, else lesson). Care branch: horse REQUIRED + `assert_horse_care_eligible`.
  Lesson branch: NO horse validation at all — `horse_id = coalesce(p_horse_id, horse_id)`
  written through unchecked.
- UI: `CalendarPage.tsx:563` passes `isCare ? horseId || null : null`; the horse picker
  (`:635-642`, "Which horse is this for?") renders only for care; booking disabled without a
  horse only when care (`:661`).
- Test data: horse `a8e82033-...` ("Beau") stamped lessee `352c3898-...`, active
  `horse_relationships` LESSEE row `a9fb30d0-...`, from executed lease `ecaecd42-...`.
- Known pre-existing data noise on Beau (do NOT clean up in this task, just avoid tripping on
  it): two duplicate active LESSEE rows for a different contact (`d5088607-...`) whose
  `source_document_id` no longer exists.

## Locked design (do not revisit)

1. One shared eligibility helper, `caller_may_use_horse(p_contact uuid, p_horse uuid) returns
   boolean`: owner (`current_owner_contact_id`) OR lessee-stamp within window
   (`lessee_contact_id = p_contact AND (lease_end IS NULL OR lease_end >= current_date)`) OR
   active `horse_relationships` row with `relationship IN ('OWNER','LESSEE')` and the existing
   term bound. Both RPCs below use it so the definition can never fork again.
2. `attach_booking_horse`: replace its inline horse test with the helper (keep every other
   guard exactly as-is, including the care-docs gate).
3. `book_open_slot` lesson branch: when `p_horse_id` is provided, require
   `caller_may_use_horse(v_contact, p_horse_id)` (skip the care-docs gate — care-specific).
   NULL horse on a lesson stays allowed (barn-supplied horse path, untouched).
4. UI `CalendarPage.tsx`: show the existing horse picker for LESSON bookings too, when
   `listStableHorses()` returns ≥1 horse — labeled "Which horse? (optional)" for lessons;
   care behavior unchanged (required + gated). Pass `horseId` through for lessons at `:563`.
   NO schedule/reserved-days enforcement — explicitly out of scope (deferred with H2).

## Work items

1. Migration with the helper + both RPC updates (CREATE OR REPLACE, carrying live bodies
   forward — the live bodies are in git as of the SQLTRUTH recapture; verify against live
   prosrc anyway before editing). Dry-run `BEGIN;...ROLLBACK;`, apply, verify.
2. `CalendarPage.tsx` picker change (item 4 above). Match existing styling/copy patterns.
3. **Live proof**, raw psql in the report:
   - As the lessee contact (reuse A11's proven simulation technique: inside one transaction,
     `SET LOCAL request.jwt.claims` against the repointed non-staff test profile, ROLLBACK
     after; confirm profile restored): `caller_may_use_horse` returns true for Beau; a lesson
     booking books/attaches Beau successfully via the real RPC path (use a real open slot or a
     throwaway booking; clean up the throwaway rows afterward and cite the deletes — bookings
     are not signed documents, cleanup is allowed).
   - Negative: a contact with NO ownership/lease of Beau is rejected by the helper (pick any
     unrelated test contact; read-only check of the helper function directly is acceptable).
4. Update `docs/archive/BUILD_TRACKER.md` A13 honestly ("server-verified, browser pending" if true).

## Rules
- Branch `task/a13-lessee-booking` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-a13 -b task/a13-lessee-booking origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB: allowed writes = the one migration + the logged throwaway booking rows (which
  you then remove, citing row ids) + the rolled-back simulation. Nothing else.
- `ClauseDocument.tsx` FROZEN. `horse_page_detail`/`HorsePage.tsx`/`horses.ts` belong to the
  parallel A12 thread — do not touch. Signed documents never deleted.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors) + live proofs (positive and negative).
- Report: `docs/reports/TASK-A13-REPORT.md`, committed + pushed. Print ONLY the report path.
