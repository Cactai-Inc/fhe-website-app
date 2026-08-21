# TASK-TESTREPAIR — the contract engine's safety net is down

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** Bounded, mechanical, with the cause already
named. **APPLY YOUR WORK. Do not hold.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-testrepair` (**copy `.env.db` in**), branch
`task/testrepair` · report to `docs/reports/TASK-TESTREPAIR-REPORT.md` · commit, **do not push** ·
no subagents. ⚠️ **Cap vitest workers (`--maxWorkers=2`)** — this machine has 8GB.

---

# 1. WHY

**`TASK-CONTRACTSEND` found `contract_workflow` and `e2e_contract` failing 40 of 42 tests on
`main`** — *"the contract engine's main DB suite isn't running, and the schema snapshot predates
PARTYSTAGING, ADDITEM, NOSTRIP, BUYANDBOOK and CATEGORISE."*

**The contract engine is the most expensive and most legally consequential part of this product, and
its own test suite has been dead for weeks.** Every contract change since has shipped with no net.

⚠️ **This is also why `TASK-CONTRACTSEND` could not diagnose the counterparty Suggest failure** —
*"the PGlite snapshot is 18 days stale and can't run that code path at all."* **Repairing the
snapshot unblocks that diagnosis.**

---

# 2. THE BASELINE — read this before you touch anything

**`test/db` is a KNOWN-RED BASELINE: 46 failed files / 26-28 passed, ~203 failures.** That is the
documented state, not a regression, and **nothing may cite it as proof.** Threads diff it
**file-for-file** against `main` to show they added no failures.

⚠️ **Your job is NOT to make all 46 green.** It is to make **`contract_workflow` and `e2e_contract`
run**, and to report honestly what the rest are.

---

# 3. THE WORK

## §1 — refresh the schema snapshot
⚠️ **The snapshot's cutoff is 2026-08-03 — "everything since is invisible to `test/db`"**
(CONTRACTSEND, measured). **That is eighteen days and at least seven merged tasks**, so any test
asserting behaviour introduced after that date cannot have been exercised, and any test written
against it is running blind.
The PGlite snapshot predates five merged tasks. Regenerate it so it carries the current schema —
PARTYSTAGING, ADDITEM, NOSTRIP, BUYANDBOOK, CATEGORISE, and today's SLOTREACH and LESSONPLAN.
⚠️ **~31 migrations in this repo REWRITE existing function bodies in place** and are **not safe to
replay on a fresh database** — they find nothing to rewrite and silently no-op. **This is a
pre-existing property of the repo, not a bug to fix here.** Say how you handled it.

## §2 — get the two suites running
`contract_workflow` and `e2e_contract`. **A test that fails for a real reason is a finding; a test
that cannot run is the problem.** Distinguish the two explicitly.
⚠️ **Do not delete tests to go green.** If a test asserts behaviour that a merged decision changed
(D14 · D22 · D23 · D25 · D28 · D29), **update it to the ruling and cite the D-rule.** If it asserts
something now genuinely wrong, say so and leave it failing with a note.

## §3 — the counterparty Suggest diagnosis
With the snapshot current, **run the path CONTRACTSEND could not.** Its report has one proven lead —
start there. ⚠️ **Diagnose only. Do not fix it here** — report the cause and the proposed diff.

## §4 — report the true state of `test/db`
After §1–§3, give the honest number: how many files fail, how many are stale-snapshot artefacts, how
many assert superseded behaviour, how many are real defects. **That number is the deliverable** —
this project has cited "46 red" as a baseline for weeks without anyone knowing what is in it.

---

# 4. OUT OF SCOPE
Fixing application defects the tests expose (report them) · the frontend suite · CI (**none exists —
no `.github/workflows`; local runs are the only verification this repo has**).

# 5. THE TEST THIS MUST PASS
1. **`contract_workflow` and `e2e_contract` execute** — pass or fail for real reasons, not
   snapshot errors.
2. **A file-for-file diff against `main`** showing no suite regressed.
3. **Every test changed cites the D-rule** that changed the behaviour.
4. **The counterparty Suggest cause is named**, with a proposed diff and no fix applied.
5. **The true composition of the 46 red files is reported**, by category.
6. `typecheck` 0 · lint identical to main.
7. **TEARDOWN:** no vitest pool, esbuild or vite left running — census in the report.

# 6. REPORT
`docs/reports/TASK-TESTREPAIR-REPORT.md`. Lead with: **does the contract engine have a working
safety net again, yes or no.**
