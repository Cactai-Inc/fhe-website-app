# TASK A11-13 (Lessee Horse Visibility/Schedule/Booking) — BLOCKED at Step 2

**Date:** 2026-08-04
**Branch:** `task/a11-13-lessee-horse`
**Worktree:** `~/Downloads/claude-code-repo/wt-a1113`

## Status: STOPPED — spec doc missing

Step 1 completed: worktree created cleanly off `origin/main` at `418174e`
(Merge task/r11-numbering-additem: heading-derived numbering + add-item rebuild).

Step 2 failed: `docs/tasks/TASK-A11-13-lessee-horse.md` does not exist.

## Diagnosis (two passes)

1. Direct copy from the shared checkout path given in the prompt failed —
   file not found at
   `~/Downloads/claude-code-repo/fhe-website-app/docs/tasks/TASK-A11-13-lessee-horse.md`.
2. Retry / broadened search, all negative:
   - `git log --all --diff-filter=A -- "*TASK-A11*"` in `fhe-website-app` — no commit ever added this file, on any branch.
   - `git branch -a` — a branch named `task/a11-13-lessee-horse` did **not** pre-exist; it was created fresh by this task's own step 1 (`git worktree add ... -b task/a11-13-lessee-horse origin/main`).
   - `git status --short` in the shared checkout — file not present among untracked files either.
   - `find ~/Downloads/claude-code-repo -iname "*A11-13*"` (whole tree, all worktrees) — no hits.
   - Checked `wt-orchestrator` specifically (where task docs for other threads, e.g. A8, A14, C-sign-pages, are authored) — no A11-13 doc there either, only pre-existing lessee-horse *migrations* (`20260710160000_my_stable_lessee.sql`, `20260714380000_lessee_horse_access_term_scoped.sql`, `20260714420000_lessee_reads_horse_docs_in_term.sql`, `20260727230000_lease_v2_lessee_obtain_deductible.sql`) and lease contract exports — no design/discovery doc for A11-13.
   - `docs/archive/BUILD_TRACKER.md` lines 30-32 confirm A11/A12/A13 are tracked items but marked **NOT VERIFIED** with no linked spec:
     - A11: Horse record VISIBLE to the lessee, showing them as lessee — visibility window may not exist
     - A12: Horse record shows the partial-lease schedule captured in the contract
     - A13: Lessee can book lessons with that horse

`.env.db` copy succeeded independently (92 bytes, copied to worktree root), confirming this is not an environment/permissions issue — the spec file was simply never authored/committed.

## Why stopping here (not proceeding)

The task instructions are explicit that this doc contains "verified discovery
and LOCKED design decisions — build, don't re-derive or redesign," and that
DB writes are constrained to "exactly what the doc lists, all logged." The
target DB is production. Without the doc there is no verified discovery, no
locked design, and no enumerated allowed-write list to work within —
proceeding would mean re-deriving scope and inventing a write-list against
production data, which the task explicitly prohibits and which the orchestration
protocol requires the orchestrator (not the worker thread) to own.

Per the task's own failure rule: diagnosed, retried once (broadened search
across history/branches/worktrees), retry did not surface the file — logging
and stopping rather than pausing for permission or guessing at design.

## What's needed to unblock

Someone with the orchestrator role needs to author
`docs/tasks/TASK-A11-13-lessee-horse.md` in `fhe-website-app` (matching the
format of sibling docs like `TASK-A14-contract-event-log.md` /
`TASK-A8-execution-email.md`) covering discovery + locked design for:

- A11: lessee-visible horse record / visibility window
- A12: partial-lease schedule surfaced from the contract onto the horse record
- A13: lessee lesson booking against that horse

Once committed to `fhe-website-app`, this worktree/branch can resume from
step 2.

## No code or DB changes were made.
