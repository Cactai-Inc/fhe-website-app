# TASK-REAPER-REPORT

## Headline
`reap_expired_holds()` called `release_expired_holds()`, dropped 2026-07-13, on every
invocation — every hourly run has raised and rolled back since, so nothing has been
reaped in seven weeks. Fixed by removing the dead `PERFORM`. Verified the housekeeping
it named has no live counterpart to preserve — nothing else changed.

## Spec read-back (first act)
Understood the task as: `reap_expired_holds()`'s `UPDATE` (lapse overdue
`request_selections`) is correct, but the function also calls
`release_expired_holds()`, which was dropped, so the whole function raises and its
own `UPDATE` rolls back with it. Before deleting the `PERFORM`, I had to establish
whether the order/booking/slot housekeeping `release_expired_holds()` performed is
still needed anywhere — if it is, that's a second task, not something to silently
reimplement. Scope: one migration, `api/expire-holds.ts` only if needed, nothing else.

## Premises verified (second act)
- `select count(*) filter (state='approved_awaiting_claim'), count(*) filter (…and
  hold_expires_at < now())` on prod: **0 and 0**, confirmed 2026-09-01 — matches the
  spec's "queue is empty" claim.
- `pg_get_functiondef('reap_expired_holds()')` on prod, before any change, matched the
  archived migration body exactly, `PERFORM release_expired_holds();` included.
- `select proname from pg_proc where proname='release_expired_holds'` → **0 rows**,
  confirming it does not exist live.

## THE HOUSEKEEPING QUESTION — answered before deleting anything
`release_expired_holds()` operated on `orders` / `bookings_v2` / `availability_slots`
(released held slots, expired stale bookings on unpaid orders). That whole system —
not just the function — was retired the day after it was dropped:
`supabase/migrations-archive/20260714140000_calendar_cleanup.sql` drops
`availability_slots` (`DROP TABLE … CASCADE`), drops `hold_slot` /
`release_booking_hold` (`DROP FUNCTION`), and drops `bookings.slot_id` (`ALTER TABLE …
DROP COLUMN`), with the comment *"the calendar (bookings + business-hours frame) fully
replaced the old availability_slots / hold-a-slot flow."*

Confirmed still true in prod today, not just in the archive:
- `select to_regclass('public.availability_slots')` → `NULL`.
- `bookings.slot_id` is not a column (`information_schema.columns` — 0 rows).
- `grep -rn hold_expires_at supabase/migrations/ src/ api/` → the only live hit is
  `api/expire-holds.ts`'s own query against `request_selections.hold_expires_at`.
  `bookings.hold_expires_at` and `bookings.status = 'pending_slot'` (both still
  columns/defaults on the current `bookings` table) are written and read by nothing —
  vestigial holdovers from the pre-calendar model, not live housekeeping.

**Conclusion: no housekeeping is orphaned by this fix.** The order/booking/slot side
`release_expired_holds()` served was itself decommissioned in full one day later. There
is nothing to reimplement and no second task here. The reaper is the `UPDATE` alone,
as the spec anticipated.

## THE TEST, criterion by criterion

**1. `select reap_expired_holds();` returns a count instead of raising.**
```
 lapsed_count 
--------------
            0
(1 row)
```
(0 is correct — the live queue is empty, per the premise check above.)

**2. A row that IS overdue actually flips to `lapsed` and the change COMMITS** —
rehearsed in `BEGIN; … ROLLBACK;` with a synthetic row (only the test row is rolled
back; the function fix itself was already applied and committed before this
rehearsal):
```
BEGIN
--- BEFORE reap: synthetic row state ---
                  id                  |          state          |        hold_expires_at        
--------------------------------------+--------------------------+-------------------------------
 e894ce89-1a46-4e10-a810-07c99ef54f62 | approved_awaiting_claim | 2026-09-01 00:29:10.820378-07

 lapsed_count 
--------------
            1

--- AFTER reap: synthetic row state ---
                  id                  | state  |        hold_expires_at        
--------------------------------------+--------+-------------------------------
 e894ce89-1a46-4e10-a810-07c99ef54f62 | lapsed | 2026-09-01 00:29:10.820378-07
ROLLBACK
```
Post-rollback check confirms the synthetic row is gone (`count = 0`) — only the test
data was rolled back. The row flipped `approved_awaiting_claim → lapsed` and
`reap_expired_holds()` returned `1`, counting exactly the row it touched.

**3. `pg_proc.proacl` before and after.**
Before (captured inside the dry-run transaction, pre-apply):
```
{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
After (post-apply, on the real function):
```
{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
Identical. `CREATE OR REPLACE` was used deliberately (same name, same signature) —
not `DROP` + `CREATE` — specifically because that resets the ACL silently (D2a). No
`GRANT`/`REVOKE` statements were added; none were needed.

⚠️ Note the live ACL is wider than the 2026-07-08 migration's own
`GRANT … TO service_role` suggests — `anon` and `authenticated` also carry `EXECUTE`
here, from some grant this task didn't touch. Out of scope for TASK-REAPER; flagged
below, not fixed.

**4. The live endpoint returns 200 inside the window.**
Not run by me — I cannot call production with the cron secret from a worktree. The
owner or ORCH runs one of:
```
curl -sS -X POST "https://www.frenchheritageequestrian.com/api/expire-holds" \
  -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json"
```
or, via GitHub Actions (no secret exposed locally):
```
gh workflow run scheduled-jobs.yml -f endpoint=expire-holds
```
Must run inside 06:00–21:00 America/Los_Angeles (owner ruling C7) — outside that
window the endpoint 200s as a no-op (`{"skipped": "outside 6am-9pm PT window", ...}`),
which is not proof of the fix. Expected success body today (queue is empty):
`{"lapsed": 0, "emailed": 0, "hour": <6-20>}`.

**5. `typecheck` · `typecheck:api` · lint ≤ 46 · `build`.**
```
npm run typecheck      → 0 errors
npm run typecheck:api  → 0 errors
npm run lint            → 0 errors, 46 warnings   (baseline is 46 — unchanged)
npm run build            → succeeded, prerender + sitemap completed
```
No source files were touched by this task (only a `.sql` migration), so these are
expected to be no-ops against baseline — run to prove that, not because the change
could plausibly have affected them.

## THE REACH
Unchanged by this fix — no new surface, no UI. The reach was already correct and
stayed correct: `/api/expire-holds` (`api/expire-holds.ts`) is invoked hourly by
`.github/workflows/scheduled-jobs.yml`'s `'0 * * * *'` schedule (the real scheduler;
Vercel's own `crons` block in `vercel.json` has never fired — see that workflow's
header) and remains callable manually via `workflow_dispatch` or a direct
`Authorization: Bearer $CRON_SECRET` POST. This task did not change who calls it or
how; it fixed what happens once called.

## FLAGGED, NOT FIXED
- `reap_expired_holds()`'s live ACL grants `EXECUTE` to `anon` and `authenticated`, not
  just `service_role` as its own defining migration intended — out of scope here, not
  investigated further.
- `bookings.hold_expires_at` and `bookings.status = 'pending_slot'` are vestigial
  (unread, unwritten) leftovers of the pre-calendar slot-hold model — not a defect,
  not touched.

## Decided without the spec deciding it
- Used `CREATE OR REPLACE` rather than `DROP FUNCTION` + `CREATE FUNCTION`, to avoid
  the ACL-reset trap the spec itself warns about (D2a). This was implicit in the
  spec's own trap note but not stated as the method to use.
- Did not add any `GRANT`/`REVOKE` statements to the migration — the ACL only needed
  to survive unchanged, and `CREATE OR REPLACE` does that on its own; adding grants
  would have been the second write path this repo's rules warn against, for no gain.

## Where the spec was wrong
Nowhere. The root cause, the empty-queue framing, and the "establish whether the
housekeeping is still needed" instruction all checked out exactly as written.

## Files touched
`supabase/migrations/20260901T0100_the_reaper_stops_calling_a_dropped_function.sql`
only. `api/expire-holds.ts` needed no change — its error handling and RPC call were
already correct; the bug was entirely inside the function body.

## Mechanics
- Worktree: both pool worktrees (`wt-1`, `wt-2`) were busy (uncommitted work on
  `task/backdate` and `task/modal2`) at start, so per the "if every pool worktree is
  busy" clause I created `wt-3` off `origin/main` (`git worktree add ../wt-3 -b
  task/reaper origin/main`) and copied `.env` / `.env.db` in from the main tree.
  `npm ci` completed in-tree (silent, ~normal).
- Migration discipline followed: dry-run in `BEGIN; … ROLLBACK;` against prod first
  (returned `0`, no error, ACL unchanged) → applied for real → verified with the
  queries above → committed. No self-contained `COMMIT;` in the file.
- Committed as one slice: `3952315d` on `task/reaper`, migration file only
  (`git add` by explicit path, not `git add .`).
- Not pushed — per protocol, ORCH merges.

## TEARDOWN census
No servers, dev processes, or browsers were started — this task ran `npm ci`,
`tsc --noEmit` (×2), `eslint`, `vite build`, and `psql` invocations only, all of which
ran to completion in the foreground and exited on their own.
```
ps aux | grep -E 'vite|vitest|esbuild|node' | grep -v grep | grep -i wt-3
→ no wt-3 processes found
```
`wt-3` itself is left in place (branch `task/reaper`, one commit ahead of
`origin/main`, clean tree) for ORCH to audit and merge — not removed, per "never
remove a worktree whose branch is unmerged."

## Owner's render checklist
There is no UI change to render — this is a database function fix reached only by the
hourly cron / manual POST. One check, on the owner's or ORCH's machine (not a phone —
this needs `CRON_SECRET`, which does not belong on a phone):
1. Confirm the time is between 6am and 9pm Pacific.
2. Run the `curl` (or `gh workflow run`) command under THE TEST §4 above.
3. Expect HTTP 200 with a body like `{"lapsed": 0, "emailed": 0, "hour": <N>}` — not
   `{"error": "reaper failed"}` and not `{"skipped": ...}`.
