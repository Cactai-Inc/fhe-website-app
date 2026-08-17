# TASK HARVESTCLOSE — finish the flag harvest, cheaply, and hand back a ranked defect queue

**RUN WITH: Opus 5 · thinking ON · effort HIGH. ONE thread. NO subagents — that is not a style
preference, it is the rule that was broken last time and it cost the owner ~$50 and a 5-hour
account lockout in ten minutes.**

**HOW TO RUN THIS TASK — read before starting:**
- **Everything you need is in this file** and in `docs/reports/flagharvest-work/` **on `main`**.
- **This is READ-ONLY except for the files you write.** Change no application code, run no
  migrations, fix nothing. You produce a queue; the owner decides what gets built.
- **Report to `docs/reports/TASK-HARVESTCLOSE-REPORT.md`. Commit; do NOT push.**
- **Never claim a status without evidence you can paste.**

---

# WHAT ALREADY EXISTS — DO NOT REDO ANY OF IT

The harvest's expensive half is **done** and now lives on `main` in
`docs/reports/flagharvest-work/`:

| artifact | state |
|---|---|
| `batch1–8.md`, `master-items.txt` | **975 raw items** extracted from all 104 task reports |
| `master-inventory.txt`, `inventory-B.md` | **130 inventory entries** |
| `slice-*.md` × 8 | the 975 items **already sliced by domain** |
| `verified-UI.md` | **DONE** — 72 raw → 51 families (7 closed / 39 open / 2 superseded / 3 undetermined) |
| `verified-IDENTITY.md` | **DONE** — 109 raw → 99 families (14 closed / 81 open / 2 superseded / 2 undetermined) |
| `gitlog.txt` | commits to 2026-08-13 — **stale, see below** |

**⚠️ Re-extracting, re-slicing or re-reading the 104 source reports is FORBIDDEN.** That work is
paid for. Start from the slice files.

## The six unverified slices — 794 raw items

`CONTRACT-A` 162 · `CONTRACT-B` 185 · `SEC` 137 · `DOCFLOW` 121 · `DB-MISC` 98 · `EMAIL` 91

## ⚠️ THE THING THAT CHANGES EVERYTHING: the verification baseline is 180 commits stale

Both verified slices were judged against **`6a58c0f` (2026-08-13)**. `main` is now **180 commits
ahead**, including these merged threads: **PAYLOCK · CREDITFIX · BOOKLINK · REVIEWQ · PAGEMERGE ·
ONBOARD · CASHCONFIRM · ZELLECLOSE · CREDITALIGN · LESSONFORM · FEECHOICE**, plus a large body of
website work.

**So a meaningful share of the 120 items currently marked OPEN are already fixed.** Verifying the
six remaining slices against today's `main` without first re-baselining would repeat that error at
six times the scale.

**Two corrections to the old `VERIFY-INSTRUCTIONS.md`** (otherwise still a good guide, and its
four statuses and output format are RETAINED):
- Its scratchpad paths and worktree path are **dead** — everything is on `main` now.
- It says *"test:db is broken (203 failures)"*. Current truth: **the PGlite suite is not a green
  baseline — ~46 pre-existing red files.** Still never citable as proof a feature is broken.

---

# THE METHOD — this is the point of the task

**The owner's rule, verbatim:** *"the thread that evaluates if something was done reads the code
one time and then checks all 65 things… its not checking and reading the code 65 times
individually."*

**Work in this order. Each phase is cheaper than the one after it, so anything a cheap phase
resolves must never reach an expensive one.**

## Phase 1 — refresh the cheap evidence, ONCE (no per-item work)
Build these once, in memory, and reuse for every judgement afterwards:
1. **A fresh commit log** for the full window (`git log --oneline` from `6a58c0f` to `HEAD`, 180
   commits) — replaces the stale `gitlog.txt`. **Write it to
   `docs/reports/flagharvest-work/gitlog-2.txt`.**
2. **The migration filename list** (`supabase/migrations/`), which is dated and task-named.
3. **The 11 merged task reports** named above — each states what it fixed. **Read each once.**

## Phase 2 — dedupe ACROSS slices before verifying anything
`verified-UI.md` and `verified-IDENTITY.md` **already list ~25 cross-slice duplicates** in their
summaries (UI-24 ↔ identity spine; UI-39/40 ↔ DB-MISC; ID-33/61/58/63/72 ↔ SEC; ID-66→74 ↔
DB-MISC; ID-94/95/96/98 ↔ DOCFLOW, and more).

- **Build ONE cross-slice family list first.** A fact verified once is verified for every slice it
  appears in. **Verifying the same fact three times is the exact waste this task exists to avoid.**
- Merge only same-fact items; similar is not same.

## Phase 3 — bulk-close from Phase 1 evidence, no code reading
Sweep **all 914 families** (794 new + 120 previously-open) against the commit log, migration list
and the 11 reports. Anything demonstrably fixed closes here, citing **a commit hash or migration
filename**. **Expect this to close a large fraction. Do not read application code in this phase.**

## Phase 4 — ONE grounding read per domain, then batch-judge
Only for what survives Phase 3.
- For each domain, **read the relevant code and query prod ONCE** — build the picture, then judge
  **every remaining item in that domain against it**.
- **Never re-read the same file for a second item.** If two items concern one file, they are judged
  in the same pass.
- Prod SQL: `psql "$(head -1 .env.db)" -tAc "<SQL>"`, **SELECT only**. ⚠️ `auth.uid()` is NULL on
  that connection, so RLS-gated RPCs legitimately return zero rows — **query `pg_policies`,
  `pg_proc`, `information_schema` directly and never conclude "broken" from an empty RPC result.**

## Phase 5 — re-baseline the two already-verified slices
**Only their OPEN items** (39 UI + 81 IDENTITY) get re-checked against the 180 new commits — a
**delta check, not a fresh pass.** Their CLOSED/SUPERSEDED entries stand.

---

# THE OUTPUT — a queue the owner can act on, not a report to admire

**`docs/reports/flagharvest-work/QUEUE.md`** — every surviving family, **ranked**, using the
existing cost-rank scale:

> **1** live defect · **2** security / data-integrity · **3** blocking or owner-decision-owed ·
> **4** unviewed inventory · **5** correctness / consistency · **6** cosmetic / cleanup

Each entry keeps the established format: `item · sources · raised · status · evidence ·
decision-note · recommendation`.

**Lead the queue with a one-screen summary:** how many families, the status split, and **the
rank-1 and rank-2 items listed by title** — that is the part the owner will act on first.

⚠️ **A decision (D1–D15) is NEVER a reason to close or drop an item** — the owner's standing rule.
If a decision bears on it, note it in `decision-note` and keep the status purely factual.

⚠️ **You do not fix anything.** Recommendations only. Items that deserve their own task get named
as such in the summary.

---

# TRAPS
- **NO subagents. One thread.** The cost incident that motivated this task was caused by fan-out
  where each agent re-read the same context.
- **Do not re-extract from the 104 reports** — start from the slices.
- **Do not verify the same fact twice** across slices (Phase 2 exists to prevent it).
- **Do not read code in Phase 3**, and **do not re-read a file per item in Phase 4.**
- **Never cite the PGlite suite as proof anything is broken** — ~46 files are red on `main` today.
- **"Probably fixed" is not a status.** Name the commit or migration, and confirm the fix is real.
- **CANNOT DETERMINE is respectable**; a guess is not.
- **Change no code, apply no migration, push nothing.**

# THE TEST THIS MUST PASS
1. `QUEUE.md` exists, ranked, covering **all eight slices** — the six newly verified plus the two
   re-baselined.
2. **Cross-slice duplicates appear ONCE**, listing every source report — state how many families
   collapsed.
3. Every CLOSED family names **a commit hash or migration filename**, and confirms the fix is real.
4. Every STILL OPEN family shows **what was checked** — file:line, or SQL text plus result.
5. The 120 previously-open UI/IDENTITY items are **re-baselined against the 180 new commits**, with
   the count that flipped to closed stated plainly.
6. `gitlog-2.txt` is written and used.
7. **Report the phase-by-phase attrition** — families entering and leaving Phases 3, 4 and 5. This
   is how the owner sees the method worked.
8. No application code, migration or push.

Report to `docs/reports/TASK-HARVESTCLOSE-REPORT.md`. Do not push; the orchestrator merges.
