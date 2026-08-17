# TASK HARVESTCLOSE — reconcile every flagged item, machine-close what is dead, hand the owner a decision sheet

## WHY THIS EXISTS — the owner's own statement of the goal (2026-08-16)

> *"the entire reason that thread was made was to review everything every thread has reported as
> remaining, unresolved, needing further study, being an issue, or for some reason flagged. the goal
> of the thread was to reconcile all 975 items to deduplicate, then review the remaining against the
> latest code and remove any already resolved or superseded/no longer relevant. the remaining items
> are the ones to review manually to keep or remove and the final list of kept items will go into
> the to-do list queue."*

**The pipeline, in his words:**

```
975 flagged items  →  DEDUPLICATE  →  machine-close what the code says is
   (all 104 reports)   (all of them,     already resolved / superseded /
                        one family list)  no longer relevant
                                              ↓
                              WHAT SURVIVES = the owner's manual
                              keep-or-remove pass  ← THIS TASK'S DELIVERABLE
                                              ↓
                              what he KEEPS becomes the to-do queue
```

⚠️ **You are producing the sheet he makes that pass on — you are NOT producing the to-do list.**
Nothing becomes a to-do until the owner keeps it. **Do not pre-decide what stays**, and do not
quietly drop an item because it looks minor: **your only licence to remove something is factual
evidence that it is resolved, superseded, or no longer relevant.** Everything else survives to his
pass, however small.

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

## Phase 2 — RECONCILE ALL 975 INTO ONE FAMILY LIST, before verifying anything
**This is the owner's "reconcile all 975 items to deduplicate" step, and it is the whole spine of
the task.** Deduplication happens in **both** directions:

- **WITHIN each of the six unverified slices** — the same finding recurs across reports in different
  wording. (This step is already done for UI, 72→51, and IDENTITY, 109→99. **The six others have
  never had it.**)
- **ACROSS all eight slices** — `verified-UI.md` and `verified-IDENTITY.md` already name ~25
  cross-slice duplicates in their summaries (UI-24 ↔ identity spine; UI-39/40 ↔ DB-MISC;
  ID-33/61/58/63/72 ↔ SEC; ID-66→74 ↔ DB-MISC; ID-94/95/96/98 ↔ DOCFLOW, and more).

**The product of this phase is ONE numbered family list covering all 975 items** — not eight slice
lists. A fact verified once is verified everywhere it appears; **verifying the same fact three times
is the exact waste this task exists to avoid.**

- Merge only **same-fact** items. Similar is not same.
- **Every source report stays listed on the family** — that is how the owner sees an item raised
  five separate times and judges it accordingly.
- **State the collapse:** 975 raw → N families.

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

# THE OUTPUT — TWO FILES

## 1. `docs/reports/flagharvest-work/DECIDE.md` — **the deliverable.** The owner's keep/remove sheet.

**Everything that survived machine-closing, and nothing else.** Optimised for one thing: the owner
going down the list saying *keep* or *remove* **without opening a single file.**

**Format — one block per family, tight enough to judge at a glance:**

```
### <NN>. <plain-language title>
what:     <ONE sentence a non-developer can act on — no jargon, no file paths in this line>
where:    <surface or area — "Clients page", "booking emails", "horse records">
raised:   <N reports, earliest date>  ·  sources: <report files>
checked:  <what you verified and what you found — file:line or SQL + result>
rank:     <1–6>
if kept:  <what doing it would involve, one line>
```

- **Group by rank**, most severe first: **1** live defect · **2** security / data-integrity ·
  **3** blocking or owner-decision-owed · **4** unviewed inventory · **5** correctness /
  consistency · **6** cosmetic / cleanup.
- **`what:` is the line the decision gets made on.** Write it for the owner, not for a developer.
  An item he cannot understand in one read is an item he cannot decide on.
- **Raised-five-times is a signal** — surface the count, it tells him what kept coming back.
- **No recommendations to keep or drop.** State the facts; the pass is his.

**Head the file with a one-screen summary:** 975 raw → N families → M machine-closed → **K awaiting
his decision**, the rank split of those K, and **every rank-1 and rank-2 item by title**.

## 2. `docs/reports/flagharvest-work/CLOSED.md` — the audit trail

Every family removed by machine-closing, with its evidence — **commit hash or migration filename,
and confirmation the fix is real.** One line each is fine. This exists so the owner can spot-check
that nothing live was closed on a bad reading, and so no item silently vanishes.

⚠️ **A decision (D1–D15) is NEVER a reason to close or drop an item** — the owner's standing rule.
If a decision bears on it, note it and keep the status purely factual.

⚠️ **You fix nothing, and you build no to-do list.** `DECIDE.md` feeds the owner's manual pass; only
what he keeps becomes the queue.

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
1. `DECIDE.md` and `CLOSED.md` both exist, together accounting for **all 975 items** — every raw
   item is either in a surviving family or in a closed one. **Nothing may vanish unaccounted for.**
2. **All 975 are reconciled into ONE family list**, deduped **within and across** slices, each family
   listing every source report — state the collapse (975 → N).
2b. `DECIDE.md` is ordered by rank and every `what:` line is **plain language a non-developer can
    decide on** — no file paths, no function names in that line.
3. Every CLOSED family names **a commit hash or migration filename**, and confirms the fix is real.
4. Every STILL OPEN family shows **what was checked** — file:line, or SQL text plus result.
5. The 120 previously-open UI/IDENTITY items are **re-baselined against the 180 new commits**, with
   the count that flipped to closed stated plainly.
6. `gitlog-2.txt` is written and used.
7. **Report the phase-by-phase attrition** — families entering and leaving Phases 3, 4 and 5. This
   is how the owner sees the method worked.
8. No application code, migration or push.

Report to `docs/reports/TASK-HARVESTCLOSE-REPORT.md`. Do not push; the orchestrator merges.
