# TASK-REAPER — the hold reaper has thrown on every run since 2026-07-13

**Authored 2026-09-01 by ORCH6.** ⚠️ **Read `docs/method/TASK-ROLE.md` first.** Small and fully
diagnosed — the value here is not finding it, it is fixing it without breaking the scheduler.

## THE ROOT CAUSE — found, not suspected
`/api/expire-holds` returns **500 `{"error":"reaper failed"}`** on every hourly run. It calls
`reap_expired_holds()`, whose body is:

```
UPDATE request_selections SET state = 'lapsed' WHERE state = 'approved_awaiting_claim' ...
PERFORM release_expired_holds();      -- ⚠️ THIS FUNCTION DOES NOT EXIST
```

⚠️ **`release_expired_holds()` was dropped on 2026-07-13** by
`supabase/migrations-archive/20260713180000_spine_s22_orders_retire.sql:159`, with the comment
*"orders-based and **unused** (the live reaper is `reap_expired_holds`)"*. **It was not unused — the
live reaper calls it.** ⚠️ **A textbook instance of §2a of the TASK role: the drop reported success
and broke its own caller.**

⚠️ **AND THE WHOLE FUNCTION ROLLS BACK, SO THE `UPDATE` NEVER COMMITS EITHER.** **Nothing has been
reaped for seven weeks.**

## ⚠️ WHAT IS *NOT* A FINDING
**Measured 2026-09-01: `request_selections` holds 0 rows `approved_awaiting_claim` and 0 overdue.**
🔒 **No data was lost and no client was affected. The queue is empty.** ⚠️ **This is a broken alarm,
not lost work — do not write it up as an incident.** **It matters because a scheduled job that fails
every hour trains everyone to ignore a failing scheduler, and because the queue will not stay empty.**

## WHAT TO BUILD
**Remove the dead `PERFORM`.** The dropped function was orders-based and its housekeeping was retired
with the orders spine. ⚠️ **Before deleting it, establish in one paragraph whether the order/booking/
slot housekeeping it named still needs doing anywhere.** **If it does, say so and STOP — that is a
second task, not a silent re-implementation.** If it does not, the reaper is the `UPDATE` alone.

## TRAPS
- ⚠️ **`CREATE OR REPLACE FUNCTION` on `reap_expired_holds` — prove the ACL from `pg_proc.proacl`
  before and after.** It is called by the service role from the endpoint.
- ⚠️ **The endpoint is gated to 06:00–21:00 America/Los_Angeles** (owner ruling C7). **A run outside
  that window is a no-op and returns 200 — do not read that as a fix.** **Prove it inside the window.**
- **Do not touch the other four scheduled endpoints.**

## THE TEST
1. **`select reap_expired_holds();` returns a count instead of raising.** Paste it.
2. ⚠️ **A row that IS overdue actually flips to `lapsed` and the change COMMITS** — rehearse in
   `BEGIN; … ROLLBACK;` with a synthetic row, and paste before/after.
3. **`pg_proc.proacl` before and after.**
4. ⚠️ **The live endpoint returns 200 inside the window.** *(The owner or ORCH runs it — you cannot
   call production with the cron secret from a worktree. Say so and give the exact command.)*
5. `typecheck` · `typecheck:api` · **lint ≤ 46** · `build`.

## FILES
`supabase/migrations/` (one migration) and, only if needed, `api/expire-holds.ts`.
⚠️ **Nothing else. Four other threads are live.**

## REPORT
`docs/reports/TASK-REAPER-REPORT.md`.
