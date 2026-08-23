# TASK AUTHORITY REPORT — one booking owner, one credit write path

**Base:** `origin/main`, branch `task/authority`, worktree
`~/Downloads/claude-code-repo/wt-authority`. Real prod DB
(`db.lrstswfxfsezdmvkvukc.supabase.co`) queried and migrated directly via
`psql` throughout — every migration dry-ran inside `BEGIN … ROLLBACK` first,
then applied for real, then proven with a query. **Owner ruling in §3
(`account_contact_id` is the authoritative booking owner) already approved —
no stop for sign-off, per instruction.** Do not push; committed only.

```
supabase/migrations/20260822T2348_authority_1_bookings_owner_backfill.sql          (NEW, applied)
supabase/migrations/20260822T2349_authority_2_bookings_owner_derive_trigger.sql    (NEW, applied)
supabase/migrations/20260822T2350_authority_3_bookings_self_read_by_contact.sql    (NEW, applied)
supabase/migrations/20260822T2351_authority_4_void_orphan_lesson_credit.sql        (NEW, applied)
supabase/migrations/20260822T2352_authority_5_audit_bookings.sql                   (NEW, applied)
```

Frontend, same working copy: `src/lib/api.ts`, `src/lib/ops/api-lessons.ts`,
`src/pages/app/ops/lessons/LessonCreditsPage.tsx`. `npm run typecheck`,
`npm run typecheck:api`, `npm run lint`: 0 errors (46 pre-existing warnings,
matching the documented baseline — none introduced by this diff).

---

## §2's numbers were already stale — checked before touching anything

The task doc's 2026-08-18 measurement (4 lesson_credits rows, 1 orphan) had
drifted by the time this ran: prod now carries **7** undeleted rows, because
the credit engine minted 3 more in the interim. But the orphan's *signature*
— no `offering_id`, no `purchase_id`, no `purchase_item_id`, no
`period_start`, no `expires_at` — still matched exactly **one** row
(`d2697af5-4d47-4265-9c7a-6362a400fe39`, client Madeline Do), confirmed by
walking `docs/reports/OWNER-WALKTHROUGH-2026-08-18.md` back to her name and
her 3-vs-11 booking-count split. The bookings split (32 / 8 / 3, 43 total)
was unchanged and re-verified exactly.

**`lesson_credits` already had an audit trigger** (`audit_lesson_credits`,
added 2026-06-30 by `mod_lessons.sql`, confirmed live via
`pg_get_functiondef`/`information_schema.triggers`) — the task doc's claim
that `audit_logs` doesn't cover it was also stale. Only `bookings` was
genuinely missing coverage; Part C's migration adds only that one trigger.

## Part A — booking ownership authority

**A1 (backfill).** 33 rows updated (32 scheduled + 1 non-scheduled, matching
§4.1's expectation exactly) via the single deterministic join through
`clients.contact_id` (unique, `NOT NULL`). Proving `SELECT`: 0 rows with
`client_id` and no `account_contact_id` remain.

**A2 (derive trigger).** `bookings_derive_account_contact_id`, `BEFORE INSERT
OR UPDATE OF client_id, account_contact_id`, mirroring the codebase's
established `trg_status_bookings` idiom (BEFORE, so `NEW` assignment sticks —
the §6 trap). Derives from `client_id` when `account_contact_id` is null,
raises on disagreement when both are supplied. THE TEST §8.3 run separately
in its own `BEGIN…ROLLBACK` (not embedded in the migration — an INSERT left
in a committed migration would fire `bookings_assign_code` /
`booking_form_lifecycle` / `bookings_unit_link` / `status_bookings` side
effects a same-file `DELETE` can't safely unwind): inserting a booking with
only `client_id` came back with `account_contact_id` correctly derived, then
rolled back clean.

**A3 (repoint the reads) — the real finding.** Grepped every `bookings` read
in `src/` and `api/`. Result: **there is nothing to repoint there.** All four
direct `.from('bookings')` calls (`src/lib/api.ts` × 1, `src/lib/ops/api-lessons.ts`
× 3) filter by `purchase_id`, `kind`+`status`, or `request_id` — never by an
owner column. Every booking read that touches ownership goes through a
`SECURITY DEFINER` RPC (`admin_client_bookings`, `admin_client_overview`,
`my_lesson_sessions`, `calendar_free_busy`, part of `admin_client_accounts`)
that lives in `supabase/`, outside this task's literal `src/`+`api/` grep
scope — see "flagged, not fixed" below for why they're left alone.

**But one gate in that scope was actively wrong, and it's the mechanism
behind the owner's own words.** `bookings_self_read` (RLS, `SELECT`) admitted
a row only when `account_user_id = auth.uid()`. `account_user_id` is
populated on just 3 of 43 scheduled bookings — it's the column the ruling in
§3 names as "documentation, not authority." `listOrderBookings()`
(`src/lib/api.ts`), called directly from `ActivationOrderPanel.tsx` (a client
self-service surface, not staff), does a raw `.from('bookings')` read that
hits this policy as the account holder. For 40 of 43 bookings, that query
came back **empty for a booking that plainly belonged to the caller** — this
is "I couldn't reach the booking from her account," reproduced exactly.
Migration `authority_3` repoints the policy to
`account_contact_id = current_contact_id()`. Verified live, inside
`BEGIN…ROLLBACK`, by setting `request.jwt.claim.sub` to Madeline Do's
`user_id` and `role` to `authenticated`: she can now read all 12 of her own
`kind='lesson'` bookings directly, where the old policy would have let
through only the 3 carrying `account_user_id`.

**A4 (Madeline Do — the walkthrough's own test case).**

| surface | logic | count |
|---|---|---|
| "her account page" (`admin_client_bookings`'s own join, `client_id → clients.contact_id → profiles`) | `client_id`-keyed | **12** (`kind='lesson'`) |
| calendar/sessions (raw `account_contact_id` filter, now backfilled) | `account_contact_id`-keyed | **12** (`kind='lesson'`) |

Both agree, because the backfill + derive trigger now guarantee the two
columns can never disagree (proven separately by THE TEST §8.2: 0 mismatches
across all of `bookings`). Before this task, the walkthrough had them at 3 vs
11 (a narrower "lesson, not-available" cut) — the exact split named in
`OWNER-WALKTHROUGH-2026-08-18.md` §2.1.

## Part B — one credit write path

**B5 (delete the wrong path).** `createLessonCredit()` and
`consumeLessonCredit()` deleted from `src/lib/ops/api-lessons.ts`, along with
the file-header sentence admitting the missing bookings⇄credits linkage
(no longer true — `complete_lesson_session` is the linkage). `LessonCreditsPage.tsx`:
removed the "Use 1 credit" row action, the "Grant credits" button, the
`GrantForm` component, and the `Modal`/drawer state entirely. The page now
only calls `listLessonCredits()` / `listLessonClients()`.

**Found during B5, not named in the task doc — a second, dead copy of the
exact same wrong path.** `src/lib/api.ts` carried its *own* parallel
`listLessonPackages` / `createLessonPackage` / `listLessonCredits` /
`createLessonCredit` suite (lines ~1521–1893) — a pre-module-split leftover,
**never imported anywhere** (confirmed by grep across `src/`; every real
caller uses `src/lib/ops/api-lessons.ts`). This is the same file that already
carries the established pattern for retiring this exact situation — Records
and Employees both have a one-line pointer comment where their old duplicate
suites used to be (`api.ts:1541`, `:1556`, pre-existing). I deleted the dead
Lessons suite the same way, including its own raw-insert `createLessonCredit`
— dead code or not, it was a second write path onto `lesson_credits`
importable by any future caller, which is precisely what D18 forbids. This
wasn't in the task's literal scope but is squarely inside its intent.

**B6 (the page states its own contract).** Added a banner: *"This ledger is
read-only. Credits are minted automatically by purchases and consumed by
completing a session on **Sessions**"* — linking to
`/app/ops/lessons/sessions` (confirmed live route, `App.tsx:406`).

**B7 (void the orphan).** `authority_4` sets
`credits_remaining = 0` on `d2697af5-…` (Madeline Do), guarded by the same
five-null signature so it can never accidentally touch a real grant.
`audit_lesson_credits` (pre-existing) recorded the before/after automatically
— confirmed: `audit_logs` has exactly 2 rows for that `record_id`, and
they tell the whole story on their own: an `INSERT` at `2026-08-18 21:31` (the
owner's original test click, `credits_remaining: → 1`) and an `UPDATE` at
`2026-08-22 16:50` (this migration, `credits_remaining: 1 → 0`). THE TEST §8.6
query (`WHERE purchase_id IS NULL`) returns exactly this one row,
`credits_remaining=0`.

## Part C — audit coverage

`authority_5` adds `audit_bookings` (`AFTER INSERT OR UPDATE OR DELETE`,
`audit_row_change()` — the same mechanism as the other 93 already-audited
tables, no second pattern per D18). `lesson_credits` needed nothing; its
trigger already existed. Verified live inside `BEGIN…ROLLBACK`: an UPDATE on
a real `bookings` row now produces an `audit_logs` row (0 → 1), where before
this migration it produced none.

## THE TEST — results

1. Scheduled bookings with `account_contact_id IS NULL`: **0**.
2. `account_contact_id` / `clients.contact_id` mismatches: **0**.
3. Insert-only-`client_id` probe, inside `BEGIN…ROLLBACK`: `account_contact_id`
   arrived populated (`3f611380-…`), then rolled back — no residue.
4. Madeline Do: account-page-equivalent count **12** == calendar/sessions
   count **12** (`kind='lesson'`, both paths agree post-backfill).
5. `grep -rn "consumeLessonCredit\|createLessonCredit" src/ api/` → **no matches**
   (both call sites and both doc-comment mentions of the literal names removed).
6. Orphan row: `credits_remaining=0`, `expires_at` null; `audit_logs` row
   exists for it.
7. Bookings UPDATE → `audit_logs` row for `bookings` (verified live,
   `BEGIN…ROLLBACK`). `lesson_credits` debit → `audit_logs` row for
   `lesson_credits` (pre-existing trigger, verified the same way).
8. `npm run typecheck` (frontend + api): 0 errors. `npm run lint`: 0 errors,
   46 pre-existing warnings (baseline, untouched by this diff).

## Flagged, not fixed

- **A staff JWT can still write `lesson_credits` raw, bypassing the engine.**
  `anon`'s direct DML grants on `lesson_credits`/`bookings` are inert — RLS is
  enabled on both and no policy admits `anon`, so those grants are dead
  weight, not a live hole. But `lesson_credits_staff_write` (`USING/WITH CHECK
  has_staff_access()`) has no opinion on *how* the write arrives — a staff
  member's own JWT can `PATCH .../lesson_credits` through PostgREST directly
  and it will succeed, with no engine, no audit-worthy business logic, just
  the (now-existing) row-change audit trail. Deleting the frontend functions
  removes the only caller this session found, not the DB-level door. This
  feeds the rank-2 default-grant item on the DECIDE sheet, per the task's own
  instruction to report rather than fix here.
- **Five DB-side RPCs still key bookings ownership through `client_id` alone**,
  not `account_contact_id`: `admin_client_bookings`, `admin_client_overview`,
  `my_lesson_sessions`, `calendar_free_busy`, `bookings_claim_on_account_link`.
  (`admin_client_accounts`'s one bookings-touching subquery already `OR`s all
  three columns together — `client_id`, `account_contact_id`, and
  `account_user_id` — so it isn't in this list.) Left alone for two reasons:
  (1) they live in `supabase/`, outside this task's literal `src/`+`api/` grep
  scope (§4.3); (2) they're proven equivalent to `account_contact_id` today
  (§8.2: 0 disagreements) and the new BEFORE trigger (A2) guarantees they stay
  that way going forward — so unlike the RLS policy this task did fix, they
  were never actually producing a wrong answer, only a legacy-pattern one.
  Ruling text says `client_id` should "never be read for ownership by any new
  code" — these are old code, not new, but a future task should still
  repoint them so `account_contact_id` is the only thing anyone has to reason
  about.
- **`test/db`'s default (snapshot) path won't exercise these five new
  migrations** until `fixtures/schema_snapshot.sql` is regenerated — a
  separate, known exercise (per TESTREPAIR), not attempted here. Full
  migration replay (`createTestDbFromMigrations`) already breaks earlier in
  the chain at `20260709160000_enforce_launch_modules.sql`, a pre-existing,
  unrelated gap — confirmed via `harness.ts`'s own comment, not introduced by
  this task. Because of that earlier break, no current test reaches these new
  migrations either way. I still hardened `authority_1` and `authority_4`
  against replay on non-prod data (their original draft had `RAISE EXCEPTION`
  on an exact prod row count, which would have permanently broken any future
  full-chain replay the moment it got that far) — see the comments in both
  files.
- **No contacts/clients duality workaround was needed.** This task's
  backfill and trigger both went *through* `clients.contact_id`, which is
  exactly the seam the duality already provides (unique, `NOT NULL`) — no
  new workaround, no new debt.

## Not touched (explicitly out of scope, per §5)

No calendar changes (W1–W5). No completion of the 43 stale bookings. No
contacts/clients merge. No nav changes. No `grant_credit` RPC — named here
again as the real follow-up if ad-hoc comp grants are wanted as a feature,
per D13 (mandatory reason, period, expiry, audit; an editor, not a migration).
