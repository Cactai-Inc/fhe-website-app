# TASK-FULLAUDIT — worktree inventory & rulings (2026-09-25; re-verified 2026-10-05)

> ⚠️ **UPDATE 2026-10-05 — worktrees ALREADY PRUNED; branch refs survive; owner ruling applied.**
> `git worktree list` now shows ONLY the main checkout (on `task/cr126-horse-and-bos`). The 18
> dead worktree registrations are gone — the pruning the owner expected happened. But the branch
> refs survived the prune (prune removes the registration, not the branch): still present are
> `bundle/grants`, `task/cr119-a`, `task/grants-a-spec` (merged), `task/grants-b`, `task/grants-v`,
> `task/supplies-a`, plus remote `origin/bundle/grants`.
> **Owner decisions (2026-10-05):** (1) the unmerged anon-revoke security work is **FOLDED INTO
> THE AUDIT as seed finding F0** — the fresh thread re-derives the correct revoke set against
> today's schema and reports it; this thread changes no grants. (2) **Leave all branch refs
> alone** — harmless, owner will clean them when ready. **No branch action is taken.**
> **F0 is confirmed STILL OPEN:** measured 2026-10-05, **211 public functions are anon-executable**
> (unchanged from 2026-09-25; `task/grants-b` would cut it to ~134 but was never merged, and is
> stale — the schema gained ~20 functions since it branched: the ATN system, orders/payments/
> audit RPCs, booking-drafts RPCs, CR-126 horse/BOS functions). Replaying the branch is WRONG;
> re-derive. `task/grants-v` verified grants-b "DOES NOT HOLD on item 6 edit 4 only" — 195 of 196
> revokes were proven correct, one was wrong.

---

**Original inventory (2026-09-25), kept for the record:** 18 registered worktrees, every
DIRECTORY already gone from disk, all `prunable` — only git's registration and the branch
commits remained. No worktree had live edits; the question was which BRANCHES held unmerged work.

## Summary ruling
- **14 of 18 point at commits already MERGED into main** → prune freely, nothing is lost.
- **4 branches carry unmerged commits.** Of those: **2 are superseded by work now on main**
  (prune), **1 is a bookkeeping/empty branch** (prune), and **1 holds a real, unmerged
  security hardening that main does NOT have** (⚠️ KEEP the branch, and it becomes AUDIT
  FINDING #0 below — do not prune until the owner decides).

---

## The 14 merged worktrees — PRUNE
`git worktree prune` clears all of them (dirs are gone); the branches below are ancestors of
main, so deleting the branch refs loses nothing:

| wt | branch / head | state |
|----|---------------|-------|
| wt-1  | bundle/grants → (see unmerged) | dir gone |
| wt-3  | bundle/supplies (f8b10c99) | MERGED |
| wt-5  | detached 0e9ebaf0 | MERGED |
| wt-6  | detached c48be110 | MERGED |
| wt-7  | bundle/dashboards (0fd7ab43) | MERGED |
| wt-8  | detached d4d67e9f | MERGED |
| wt-9  | bundle/funneldebt (c666aebb) | MERGED |
| wt-10 | detached 2779ca2c | MERGED |
| wt-11 | detached e8436d46 | MERGED |
| wt-12 | task/stranger-vs-error (4150b8fe) | MERGED |
| wt-14 | detached 79f719c2 | MERGED |
| wt-15 | detached df2ebcb1 | MERGED |
| wt-16 | detached df2ebcb1 | MERGED |
| wt-17 | detached e8436d46 | MERGED |
| wt-18 | detached 21d0e702 | MERGED |

(These are ORCH/MGMT bookkeeping commits and task branches whose content is on main. The
directories no longer exist, so there is no working state to preserve.)

---

## The 4 unmerged branches — individual rulings

⚠️ **All four were branched from an EARLY-SEPTEMBER main and never rebased.** Their diffs vs
today's main show thousands of *deletions* — that is NOT their work removing things; it is the
diff surfacing everything main has ADDED since they branched (OrdersPage, PaymentsPage,
AtnHistoryPage, the ATN + B2 + #6 migrations, vercel.json crons). Judge each only by its own
`+` additions.

### 1. `task/grants-b` (7f2b36ff, +3 commits) — ⚠️ KEEP → AUDIT FINDING #0
**Real work:** `20260903…_the_anon_door_closes_on_every_writer_nothing_anonymous_calls.sql`
(+321 lines) — 195 ACL-only `REVOKE`s that cut anon-executable functions from a reported 326 to
134, plus 4 stale-comment removals. **Main does NOT have this**: measured today, **211 public
functions are still anon-executable.** This is a genuine, unmerged security hardening.
**RULING: do not prune. Surface as FINDING #0 for the audit** — the owner decides whether to
rebase-and-merge this branch or have the audit re-derive the revoke set against today's schema
(preferred, since the function set has changed since 2026-09-03). The branch is the evidence,
not necessarily the patch to apply as-is.

### 2. `task/cr119-a` (d08fc901, +3 commits) — SUPERSEDED → prune
**Its work:** co-buyer election exit · "a gate field must never be homed on its own pending
placeholder" · horse-intake location autosave / normalization / Barn-Stall Other escape.
**Verified superseded on main:** main already has the `*_GATE` stable-home clauses (my CR-1,
commit f8fb6660) and `TXN.CO_BUYER_ENABLED` homed on `PARTIES.CO_BUYER_GATE` — the exact fix
this branch pioneered, done more completely on main. ⚠️ **One piece to double-check before
pruning:** the *horse-intake normalization* (address/name normalize, Barn/Stall "Other"
escape) and its test `cr119_cobuyer_election_exit.test.ts` — confirm the audit covers horse
intake; if main lacks the normalization, re-derive it there. Otherwise prune.

### 3. `bundle/grants` (62697d29, +6 commits) — MOSTLY BOOKKEEPING → prune after #0 saved
Orchestration/MGMT ledger commits that CARRY task/grants-b. The only substantive code is
grants-b's (covered by #0). Once #0 is captured, prune.

### 4. `task/supplies-a` (624b7cb9, +1 commit) — EMPTY → prune
Single commit "open ledger" — a ledger/bookkeeping file, no application code. Prune.

---

## Recommended action (owner runs, or approves the audit thread to run)
1. **Before pruning anything**, tag the one branch with real unmerged code so it is never lost:
   `git tag keep/grants-b-anon-revokes task/grants-b` (and optionally `keep/cr119-a task/cr119-a`
   until the horse-intake check is done).
2. `git worktree prune` — clears all 18 dead registrations (dirs are already gone).
3. Delete the merged branch refs at leisure; keep the two tagged ones until the audit rules on
   FINDING #0 and the horse-intake check.
4. **No thread is actively working any of these** (all dirs gone), so there is nothing to
   interrupt — the owner's "find the thread doing that work" concern does not apply; these are
   abandoned trees from the parallel-MGMT experiment (early September), superseded by the
   single-thread work done since.
