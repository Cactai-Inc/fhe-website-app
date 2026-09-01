# TASK A11 — Horse record visible to the lessee, showing them as lessee

Branch: `task/a11-lessee-visibility` (renamed from `task/a11-13-lessee-horse`), worktree
`~/Downloads/claude-code-repo/wt-a1113`, off `origin/main`.

**Deviation from setup**: this worktree/branch pre-existed from an earlier attempt that stopped with
a single commit, "A11-13: report blocker — task spec doc missing, no build performed" (the spec doc
hadn't been placed yet). This session was handed the actual spec
(`docs/tasks/TASK-A11-lessee-visibility.md`), copied it in, renamed the branch per the task's own
instruction, and proceeded — no prior work was lost or overwritten.

**Rebase note**: before finalizing, discovered the branch had been cut from `main` before
`task/a14-event-log` and a `task/sqltruth` recapture merged into it — diffing against current
`origin/main` made it look like this task's `BUILD_TRACKER.md` edit reverted A14 back to
PARTIAL. It didn't; the branch was simply behind. Stashed the in-progress changes, rebased onto
`origin/main` (clean, no conflicts), popped the stash (auto-merged `BUILD_TRACKER.md` cleanly —
A14's DONE row is untouched, only the A11 row carries this task's edit). Re-ran all done-checks
and re-verified the live DB state post-rebase; both hold (see below).

The orchestrator's "verified current state" section (RLS window, route, execution-effects trigger,
`stable.ts` field-drop, `HorsePage.tsx:170` framing, dead `/app/stable` link, zero horses with
`lessee_contact_id` set) was independently re-checked against the code and DB before building — all
of it held exactly as stated.

## What was built

### 1. Lease term on the stable cards
- `src/lib/stable.ts` — `StableHorseRow` (the RPC row shape) and `StableHorse` (the client type) both
  gained `lease_start`/`lease_end`; `toStableHorse` carries them through (`my_stable_horses()` already
  returned both columns — only the client wrapper was dropping them).
- `src/pages/app/AccountHub.tsx` — a leased horse's card badge now reads `Leased through <date>` when
  `lease_end` is set (falls back to plain `Leased` for an open-ended lease with no end date), reusing
  the same date format `HorsePage.tsx` already uses (`toLocaleDateString(undefined, {year, month:
  'short', day: 'numeric'})`, added as a local `fmtDate` in this file since it wasn't previously
  imported here).

### 2. Lessee-perspective framing on the horse page
Viewer identity isn't derivable client-side: the payload only ever carried the *resolved lessee name*,
never the raw `lessee_contact_id` to compare against the viewer's own contact. Per the task's fallback
instruction, extended the RPC with a jsonb field rather than changing its signature:
- `supabase/migrations/20260804130000_horse_page_viewer_is_lessee.sql` — `CREATE OR REPLACE
  FUNCTION horse_page_detail`, full body carried forward unchanged except one added top-level key:
  `'viewer_is_lessee', (v_h.lessee_contact_id IS NOT NULL AND v_h.lessee_contact_id =
  current_contact_id())`. Dry-run failed only on an unrelated pre-existing condition (a raw psql
  session has no `current_org()`/`auth.uid()` context — see §4), which confirmed the `CREATE FUNCTION`
  itself was syntactically sound; applied for real, confirmed via `pg_proc.prosrc` containing the new
  key.
- `src/lib/horses.ts` — `HorsePageDetail` gained `viewer_is_lessee: boolean` at the top level (sibling
  of `record`, not nested inside it — it's viewer context, not part of the horse's own data).
- `src/pages/app/HorsePage.tsx:170-174` — when `detail.viewer_is_lessee`, the lease line renders "Your
  lease" / "You lease this horse through `<date>`" (omitting the "through" clause for an open-ended
  lease); otherwise unchanged owner/staff framing: "Leased to" / "`<name>` (through `<date>`)".

### 3. Dead `/app/stable` link
- `src/pages/app/CalendarPage.tsx:642` — `Add your horse` now links to `/app/account?section=stable`
  instead of the unregistered `/app/stable`.
- `src/pages/app/AccountHub.tsx` — `AccountHub` didn't support opening a section via URL before (`open`
  always initialized to `null`); added `useSearchParams` and read an optional `?section=` param on
  mount to set the initial open section, so the link actually lands on the My Stable panel rather than
  a generic account page the user would have to click through again.

## 4. Live proof (production DB)

**Confirmed before touching anything**: zero horses had `lessee_contact_id` set (matches the
orchestrator's note — the stamping pathway has never fired on real data). No idempotent re-fire
wrapper exists for `apply_contract_execution_effects()` (only the trigger function itself; grepped
`pg_proc` for anything else mentioning "execution_effect" — nothing). Confirmed the test lease
`ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` predates the trigger, exactly as expected: its horse
(`a8e82033-cf9e-48aa-8ea5-a856f2ede597`, "Beaumont de Cactai" / "Beau") had `lessee_contact_id`/
`lease_start`/`lease_end` all null, despite the document being EXECUTED with `document_parties` rows
for both LESSOR (`d99f1472…`, contact `current_owner_contact_id` on the horse) and LESSEE
(`352c3898…`, "French Heritage Equestrian"), and the lease's `contract_fields` carrying
`TXN.LEASE_START = 2026-08-01`, `TXN.LEASE_TYPE = PARTIAL`, `TXN.LEASE_TERM_TYPE = OPEN_ENDED`
(so `TXN.LEASE_END` is blank by design, not a data gap).

**Stamped via a targeted UPDATE + INSERT**, mirroring `apply_contract_execution_effects()`'s lease
branch (`supabase/migrations/20260803020001_execution_effects_null_guard.sql` lines 97–110) exactly,
using the values that branch would have computed (`v_lessor = d99f1472…` from `document_parties`
LESSOR, `v_lessee = 352c3898…` from LESSEE, `v_start = 2026-08-01`, `v_end = NULL`). Dry-run first
inside `BEGIN;...ROLLBACK;`, confirmed the expected row shapes, then applied for real and committed:

```sql
UPDATE horses
   SET lessee_contact_id = '352c3898-65d0-4a90-ad59-29107b7e03fe',
       lease_start = '2026-08-01', lease_end = NULL,
       current_owner_contact_id = coalesce(current_owner_contact_id, 'd99f1472-48b4-466e-aaa7-f76396745c17'),
       updated_at = now()
 WHERE id = 'a8e82033-cf9e-48aa-8ea5-a856f2ede597';
-- UPDATE 1

INSERT INTO horse_relationships (org_id, horse_id, relationship, party_contact_id,
                                 term_start, term_end, source_document_id, created_by_contact_id)
VALUES ('e656f20b-ef43-4725-9029-19e7f0190d9c', 'a8e82033-cf9e-48aa-8ea5-a856f2ede597', 'LESSEE',
        '352c3898-65d0-4a90-ad59-29107b7e03fe', '2026-08-01', NULL,
        'ecaecd42-0d82-428b-b72f-b73b0cc3f9f3', '352c3898-65d0-4a90-ad59-29107b7e03fe');
-- INSERT 0 1 → new row id a9fb30d0-7415-4ae0-9877-280cf34bab66
```

**Deliberate omission**: the trigger's lease branch also does `PERFORM ensure_horse_documents(v_horse,
NEW.contract_id, true)` (auto-generates HORSE_EMERGENCY_VET / RELEASE_HORSE_CARE paperwork for the
owner). The task's own instruction names only "a targeted UPDATE on `horses` + `horse_relationships`
INSERT" as the mirror target — that function is a separate document-bundling side effect outside
A11's scope (visibility, not paperwork generation), and it depends on `current_contact_id()`/
`has_staff_access()` resolving a real authenticated app session, which a direct superuser psql
connection doesn't have. Not run; logged here as a known, deliberate gap from the full trigger body.

**This test data STAYS** — it reflects the real executed lease `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3`
and was not cleaned up, per the task's instruction.

**RPC proof, as the lessee.** No `auth.users`/`profiles` account is currently linked to contact
`352c3898…` (a pre-existing identity-duplication gap unrelated to A11 — the login sharing
`hello@fhequestrian.com`'s email is linked via `profiles.contact_id` to a *different* contact,
"Claire Bourdon"; not touched here, out of scope). To exercise the real RPCs as the lessee without
creating any persisted account, the proof ran inside a single transaction that was rolled back:
temporarily repointed the existing non-staff test profile (`cjzigs@icloud.com`, role `USER`, so
`has_staff_access()` stays false and the actual lessee-recognition path — not the staff path — is
what's exercised) to `contact_id = 352c3898…`, simulated its session via `SET LOCAL
request.jwt.claims`, ran the real RPCs, then rolled back — restoring the profile to its original
`contact_id` exactly. Nothing from this step was persisted (confirmed by re-querying the profile
after rollback: back to `d99f1472…`).

```
-- viewer identity during the simulated session
 viewer_contact_id                    | is_staff
 352c3898-65d0-4a90-ad59-29107b7e03fe | f

-- my_stable_horses()
 id                                   | registered_name    | nickname | is_owner | lease_start | lease_end
 a8e82033-cf9e-48aa-8ea5-a856f2ede597 | Beaumont de Cactai  | Beau     | f        | 2026-08-01  |

-- horse_page_detail('a8e82033-...')
 lessee_name                    | lease_start  | lease_end | viewer_is_lessee
 "French Heritage Equestrian"   | "2026-08-01" | null      | true

-- profile restored after ROLLBACK
 user_id                              | contact_id
 0a7fc801-5b17-41f5-b379-11982030d182 | d99f1472-48b4-466e-aaa7-f76396745c17
```

Both RPCs return correctly for the lessee: the horse appears in `my_stable_horses()` with
`is_owner = false` and the lease term attached, and `horse_page_detail()` carries `viewer_is_lessee =
true` alongside the same lease term the UI reads.

## Done-checks (re-run after the rebase above)
- `npm run typecheck` — clean.
- `npm run typecheck:api` — clean.
- `npm run lint` — **29 warnings / 0 errors**, matching the stated baseline exactly (no new warnings
  introduced).
- Re-queried production directly post-rebase: `pg_proc.prosrc` for `horse_page_detail` still contains
  `viewer_is_lessee`; `horses` row `a8e82033…` still carries `lessee_contact_id =
  352c3898…`/`lease_start = 2026-08-01`/`lease_end = NULL`; `horse_relationships` row
  `a9fb30d0-7415-4ae0-9877-280cf34bab66` (LESSEE, term_start 2026-08-01, term_end NULL) still present
  alongside the pre-existing, unrelated duplicated LESSEE rows for the other contact noted below.

## Honesty check against the task's own bar
Server-side (RPC/RLS/data) behavior is proven live via the psql output above. **No browser step ran
in this task** — TASK-A11 has no owner-click-script component (unlike TASK-A-PARTY-VERIFY); its own
"Done-checks" section lists only typecheck/lint + the two raw psql proofs, both satisfied. `AccountHub`
and `HorsePage` UI changes are code-complete and typecheck clean but have not been visually confirmed
in a browser. `docs/archive/BUILD_TRACKER.md` A11 is marked **PARTIAL — server-verified, browser pending**
accordingly, not DONE.

## Scope discipline
Touched only files/DB objects listed above. A12 (partial-lease schedule display) and A13 (lessee
lesson booking) were left untouched, including two other lease/booking-adjacent things noticed in
passing and deliberately not acted on: (1) the same horse (`a8e82033…`) already carries an unrelated,
duplicated pair of active `LESSEE` `horse_relationships` rows for a different contact
(`d5088607-4b60-413e-b221-0524469a5083`) referencing a `source_document_id`
(`378c1fe9-bba6-45e5-a6ce-efae0b4f8c01`) that no longer exists in `documents` — pre-existing data
noise from outside this task, not touched; (2) `ClauseDocument.tsx` was not read or modified (frozen,
and not implicated in any A11 item).
