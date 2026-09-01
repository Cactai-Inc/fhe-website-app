# TASK A13 — Lessee can book lessons with their leased horse

Branch: `task/a13-lessee-booking`, worktree `~/Downloads/claude-code-repo/wt-a13`, off
`origin/main`.

The orchestrator's "verified current state" section (`attach_booking_horse` eligibility test,
`book_open_slot`'s unchecked lesson-branch horse write, `CalendarPage.tsx:563` behavior, test
data on Beau) was re-confirmed against live `pg_proc.prosrc` and the DB before building — all of
it held exactly as stated.

## What was built

### 1. Shared eligibility helper + both RPCs
`supabase/migrations/20260804140000_lessee_lesson_booking.sql`:

- `caller_may_use_horse(p_contact uuid, p_horse uuid) returns boolean` (new) — owner
  (`current_owner_contact_id`) OR lessee-stamp within window (`lessee_contact_id = p_contact AND
  (lease_end IS NULL OR lease_end >= current_date)`) OR an active `horse_relationships` row with
  `relationship IN ('OWNER','LESSEE')` and the existing term bound (`active AND (term_end IS NULL
  OR term_end >= current_date)`).
- `attach_booking_horse` — `CREATE OR REPLACE`, live body carried forward unchanged except the
  inline ownership OR-clause inside the existing `v_mine` `EXISTS` query is now
  `caller_may_use_horse(v_contact, h.id)`; the surrounding guard (`h.id = p_horse_id AND
  h.org_id = v_org AND h.deleted_at IS NULL`), the booking/kind checks, and the care-docs gate are
  byte-for-byte the same as live.
- `book_open_slot` — `CREATE OR REPLACE`, live body carried forward unchanged, with one insertion:
  in the lesson branch (`v_kind = 'lesson'`), when `p_horse_id IS NOT NULL` the function now
  requires `caller_may_use_horse(v_contact, p_horse_id)` (raises `'that horse is not yours'`
  otherwise) *before* the credit-deduction step; no care-docs gate on this path (care-specific,
  per the locked design). `NULL` horse on a lesson booking still passes through unchecked
  (barn-supplied horse path, untouched).

Dry-run (`BEGIN; \i <migration>; ROLLBACK;`) confirmed all three `CREATE FUNCTION`s were
syntactically sound and callable before touching production; applied for real afterward and
re-confirmed via `pg_get_functiondef` that all three live definitions match the migration
(`caller_may_use_horse` present in both callers' `prosrc`).

### 2. `CalendarPage.tsx` picker
`src/pages/app/CalendarPage.tsx` (`DetailPanel`):
- Added `isLesson = item.kind === 'lesson'` alongside the existing `isCare`.
- The horse-fetch `useEffect` now runs for `isCare || isLesson` (was `isCare`-only).
- New optional picker block, shown only `isLesson && horses.length > 0`, labeled "Which horse?
  (optional)" — same `<select>`/styling pattern as the care picker, defaulting to no horse
  selected. Care's picker (required, "Which horse is this for?") is untouched.
- `book()` now passes `horseId` through for both kinds: `bookOpenSlot(item.id, (isCare ||
  isLesson) ? horseId || null : null)`. The `disabled` condition on the Book button is unchanged
  (`isCare && !horseId`) — the lesson picker stays optional, matching the locked design ("NO
  schedule/reserved-days enforcement").

## 3. Live proof (production DB)

All three checks below ran through a single psql session against the live DB. The identity
simulation reused A11's exact technique: the same non-staff test profile
(`cjzigs@icloud.com` / `user_id 0a7fc801-5b17-41f5-b379-11982030d182`, role `USER`, so
`has_staff_access()` stays false) had its `profiles.contact_id` temporarily repointed to the
lessee contact (`352c3898…`, "French Heritage Equestrian"), and — new for this task, since
`attach_booking_horse`/`book_open_slot` also require a resolvable `current_client_id()` — its
existing `clients` row (`4ead27a9-8af2-4ea3-aa7b-3d241a545980`, previously tied to the horse
owner `d99f1472…` in the same org) was likewise temporarily repointed to the lessee contact,
inside the *same* transaction. `SET LOCAL request.jwt.claims = '{"sub":"0a7fc801…"}'` made
`auth.uid()` resolve to that profile for the duration. Everything — the two repoints, a throwaway
`bookings` row, and the RPC calls — ran inside one transaction that was then **rolled back**;
nothing was committed. Confirmed after rollback that both the profile and the client row are
back to their original `contact_id` (`d99f1472…`) and that zero throwaway booking rows remain.

**Negative — helper, unrelated contact** (plain read-only call, no simulation needed):
```
SELECT caller_may_use_horse('7a603cc1-0760-40f3-9e1d-4f8717a37752', 'a8e82033-cf9e-48aa-8ea5-a856f2ede597');
 may_use_beau_unrelated_contact
---------------------------------
 f
```
Contact `7a603cc1…` has no `current_owner_contact_id`/`lessee_contact_id` match and no
`horse_relationships` row at all on Beau (verified directly) — a genuinely unrelated contact, not
the known `d5088607…` data-noise contact the task doc flags (that one *does* carry an active
`LESSEE` `horse_relationships` row on Beau and would incorrectly pass — deliberately avoided as
the negative case, per the task's own warning not to trip on it).

**Positive — `attach_booking_horse`, real RPC path, as the lessee** (single rolled-back
transaction):
```
BEGIN;
UPDATE profiles SET contact_id = '352c3898…' WHERE user_id = '0a7fc801…';         -- UPDATE 1
UPDATE clients  SET contact_id = '352c3898…' WHERE id = '4ead27a9…';              -- UPDATE 1
SET LOCAL request.jwt.claims = '{"sub":"0a7fc801…"}';

-- session identity: contact_id=352c3898…, client_id=4ead27a9…, org_id=e656f20b…, is_staff=f
SELECT caller_may_use_horse(current_contact_id(), 'a8e82033…');    -- may_use_beau = t

INSERT INTO bookings (org_id, kind, status, client_id, starts_at, ends_at)
VALUES (current_org(), 'lesson', 'scheduled', current_client_id(), now()+'7 days', now()+'7 days'+'1 hour')
RETURNING id;                                        -- throwaway booking a97a88be-5188-4004-9af0-2c97838f8e6c

SELECT attach_booking_horse('a97a88be…', 'a8e82033…');
 {"ok": true, "horse_id": "a8e82033-cf9e-48aa-8ea5-a856f2ede597"}

SELECT id, horse_id, client_id, kind FROM bookings WHERE id = 'a97a88be…';
 a97a88be… | a8e82033-cf9e-48aa-8ea5-a856f2ede597 | 4ead27a9… | lesson

ROLLBACK;

-- post-rollback: profile.contact_id = d99f1472… (restored), clients.contact_id = d99f1472… (restored),
-- count of matching throwaway bookings = 0
```

**Supplementary — `book_open_slot`'s new lesson-branch gate, negative case** (separate
rolled-back transaction, same identity-simulation technique): inserted a throwaway generic open
lesson slot (`is_flexible=true, status='available'`, mirroring `publish_open_slots`'s shape),
then called `book_open_slot(<slot>, <unrelated horse 8da6bb10-e72f-4db3-81ba-c27d7c25bbe0>)` —
a horse owned by a third contact (`b996dd2c…`), confirmed to have zero `horse_relationships`
overlap with the lessee. The call raised `ERROR: that horse is not yours` from the new gate
(`book_open_slot` line 36, the exact line added by this migration) before ever reaching the
credit-deduction step, then the transaction was rolled back. This is a check beyond the task's
required proof list (which only names `attach_booking_horse`'s path) — added for confidence since
`book_open_slot` was the RPC with the previously-unchecked write. A positive case for
`book_open_slot` wasn't run: the lessee contact has no `lesson_credits` row, so it would only
prove the horse-gate passes before failing later on `NO_CREDITS` — a strictly weaker signal than
the `attach_booking_horse` proof already on record, so it was skipped rather than manufacturing a
throwaway credit row to force a clean "success" response.

**No cleanup step was needed**: every write in every proof above (profile repoint, client
repoint, throwaway bookings) lived inside a transaction that was rolled back, and each rollback
was followed by a fresh query confirming zero residue. Per the task's rule ("allowed writes = the
one migration + the logged throwaway booking rows … + the rolled-back simulation"), this session
used only the migration and the rolled-back simulation — no committed throwaway rows were left
that needed a separate `DELETE`.

## Done-checks
- `npm run typecheck` — clean.
- `npm run typecheck:api` — clean.
- `npm run lint` — **29 warnings / 0 errors**, matching the stated baseline exactly (confirmed
  `CalendarPage.tsx` contributes zero new warnings).
- Live proofs above (positive and negative, both RPCs touched).

## Honesty check against the task's own bar
Server-side (RPC/RLS/data) behavior is proven live via the psql output above, for both the
positive (lessee books Beau via `attach_booking_horse`) and negative (unrelated contact rejected
by the helper; unrelated horse rejected by `book_open_slot`'s new gate) cases. **No browser step
ran in this task** — the task's own "Done-checks" list only names typecheck/lint + the psql
proofs, both satisfied. The `CalendarPage.tsx` picker change is code-complete and typecheck-clean
but has not been visually confirmed in a browser. `docs/archive/BUILD_TRACKER.md` A13 is marked **PARTIAL
— server-verified, browser pending** accordingly, not DONE.

## Scope discipline
Touched only: the one migration, `CalendarPage.tsx`, `docs/archive/BUILD_TRACKER.md`, this report, and
the task doc copy. `ClauseDocument.tsx` was not read or touched (frozen). `horse_page_detail`,
`HorsePage.tsx`, and `src/lib/horses.ts` (A12's parallel thread) were not read or touched —
`listStableHorses`/`StableHorse` used by the new picker come from `src/lib/stable.ts`, a
different, unrelated file. The pre-existing data noise on Beau (duplicate `d5088607…` `LESSEE`
rows with a dangling `source_document_id`) was left exactly as-is, not cleaned up, and was
specifically routed around when choosing the negative-test contact.
