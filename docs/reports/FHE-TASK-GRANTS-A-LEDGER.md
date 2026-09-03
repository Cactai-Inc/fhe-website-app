# FHE-TASK-GRANTS-A — LEDGER (TASK thread, DSNR profile)

**Spec:** `docs/tasks/TASK-GRANTS-A-author-the-acl-sweep-spec.md` (on `bundle/grants`, read from `wt-1`).
**Bundle:** `docs/orch/BUNDLE-GRANTS.md`. **Dispatched by / hand back to:** `FHE-MGMT-GRANTS`.
**Opened 2026-09-03 · tree `wt-2` · branch `task/grants-a-spec` from `origin/main` @ 2779ca2c.**

## RESUME
Role / thread   FHE-TASK-GRANTS-A · wt-2 · task/grants-a-spec (DSNR profile: specs only, no build, no GRANT/REVOKE run)
Merge-base      2779ca2c (origin/main at 07:02 PDT 2026-09-03; bundle/grants is d5f97724, ahead of main by 3 — the bundle files are NOT on main)
DONE            worktree guard (detached + porcelain empty) → claimed task/grants-a-spec → clean; psql to production proven
IN FLIGHT       ledger opened; CLNR pass next
NEXT            CLNR §3 census → re-run the MGMT population query → the writer sweep over all 326
DECIDED         —
BLOCKED         nothing
DO NOT          do not run any GRANT/REVOKE; do not call any function (probing a writer writes production — `has_function_privilege` is the probe); do not touch bodies (B2 owns them)

## LOG
