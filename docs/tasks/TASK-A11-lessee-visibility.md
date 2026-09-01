# TASK A11 — Horse record visible to the lessee, showing them as lessee

Tracker item **A11 only**. A12 (lease schedule display) and A13 (lesson booking) are SEPARATE
tasks — do not touch their scope even where it looks adjacent.

## Verified current state (orchestrator discovery, 2026-08-04 — trust this, do not re-derive)

- The visibility window EXISTS: RLS `horses_select` uses `client_can_read_horse(id)`, which
  grants the lessee SELECT while `lease_end IS NULL OR lease_end >= current_date`.
- Route `/app/horses/:horseId` is live (`App.tsx:236` → `HorsePage.tsx`), guarded by
  `horse_page_detail`'s `caller_owns_horse` check, which passes for a lessee.
- Lease execution stamps `horses.lessee_contact_id / lease_start / lease_end` AND inserts an
  active `horse_relationships` row (LESSEE, term_start/term_end) —
  `supabase/migrations/20260803020001_execution_effects_null_guard.sql:96-113`.
- `my_stable_horses()` already returns leased horses WITH `lease_start`/`lease_end`, but the
  client wrapper DROPS both fields: `src/lib/stable.ts:68-101` (`StableHorseRow` omits them,
  `toStableHorse` discards them). "My Stable" cards in `AccountHub.tsx` (~:356-390) badge
  Leased/Owned and link to the horse page.
- `HorsePage.tsx:170` renders `Leased to <name> (through <date>)` — owner-perspective framing;
  a lessee viewing their own leased horse sees their own name in outward framing.
- Dead link: `CalendarPage.tsx:642` links to `/app/stable`, a route that is not registered.
- Live DB currently has ZERO horses with `lessee_contact_id` set — the pathway has never run
  on real data.

## Work items

1. **Carry the lease term to the stable cards.** `src/lib/stable.ts`: add `lease_start` /
   `lease_end` to `StableHorseRow` and through `toStableHorse`. In `AccountHub.tsx`, leased
   horse cards show "Leased through <date>" (reuse the page's existing date formatting).
2. **Lessee-perspective framing on the horse page.** When the viewer IS the lessee, the lease
   line reads "You lease this horse through <date>" instead of "Leased to <own name>".
   Determine the viewer's contact identity the way HorsePage/its RPC already does; if not
   derivable client-side, extend `horse_page_detail` with `viewer_is_lessee boolean`
   (CREATE OR REPLACE if the return shape allows; jsonb payload extension preferred over
   signature change). Owner/staff views keep the current outward framing.
3. **Fix the dead `/app/stable` link** at `CalendarPage.tsx:642` — point it at the real
   AccountHub location of the My Stable section and verify the link resolves.
4. **Live proof.** No horse currently has a lessee stamped. Set up test data via the REAL
   pathway: check whether executed test lease `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` stamped a
   horse; it predates the stamping trigger, so if (expected) it did not, look for an idempotent
   re-fire of the execution-effects function; if none exists, stamp via a targeted UPDATE on
   `horses` + `horse_relationships` INSERT that mirrors the trigger body EXACTLY
   (`20260803020001` lines 96-113), logging both statements as test-data setup. Then prove with
   raw psql output:
   - `my_stable_horses()` returns the horse with the lease term for the lessee's contact.
   - `horse_page_detail(<horse_id>)` succeeds for the lessee and carries what the UI renders
     (incl. `viewer_is_lessee` if you added it).
   This test data STAYS (it reflects a real executed lease) — log it, don't clean it up.

## Rules
- Branch/worktree: REUSE the existing `~/Downloads/claude-code-repo/wt-a1113` worktree; rename
  the branch first: `git branch -m task/a11-13-lessee-horse task/a11-lessee-visibility`.
- Production DB: allowed writes = one migration IF item 2 needs the RPC extension, + the logged
  test-data setup in item 4. Nothing else. Every statement in the report.
- `src/components/app/ClauseDocument.tsx` is FROZEN. Signed documents are never deleted.
  Dry-run any migration in `BEGIN;...ROLLBACK;` before applying.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors), plus the two live proofs above.
- Update `docs/archive/BUILD_TRACKER.md` A11 honestly ("server-verified, browser pending" if that is
  the truth — browser-observed steps stay unclaimed).
- Report: `docs/reports/TASK-A11-REPORT.md`, committed + pushed on the branch. Raw outputs,
  deviations with reasons, retry log. Print ONLY the report path in chat.
