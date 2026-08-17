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

## Why the first attempt was inefficient — the owner's diagnosis (2026-08-16)

> *"that thread running a full review of each of the 975 items without deduplicating first and
> without using a single stored context memory entry so all of them were reviewed in one pass was
> why that thread was super inefficient… the list of items being collected to review them was step 1
> and knowing the tally was 975 told me that part ran properly. the deduplicate was not done
> properly, and that should be where things pickup. then we have the list of items and we review
> them against the code together in a single pass to see what is still really unresolved and
> possibly which of those is no longer something to resolve."*

**Two failures, and the fix for each:**

| what went wrong | the rule now |
|---|---|
| items were reviewed **before** being deduplicated, so the same fact was investigated many times | **Deduplicate FIRST. Nothing is judged until the family list is complete.** |
| each item was reviewed with its **own** context load, instead of one context serving all of them | **Load the evidence ONCE, then sweep every family against it in a single pass.** |

**⚠️ COLLECTION IS DONE AND ACCEPTED. The 975 tally is correct and confirms step 1 ran properly.
RESUME AT DEDUPLICATION.** Do not re-collect, do not re-extract, do not reopen the 104 reports.

## Phase 1 — DEDUPLICATE (the resume point, and the spine of the task)
**Nothing is verified in this phase.** Produce **ONE numbered family list covering all 975 items**
— see the reconciliation rules below. This must be complete before any judging begins, because
every duplicate left in the list is an investigation paid for twice.

### The reconciliation rules — all 975 into one family list
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

## Phase 2 — LOAD THE EVIDENCE ONCE
Build the whole picture **before judging anything**, and reuse it for every family. This is the
"single stored context" the first attempt lacked.

1. **A fresh commit log** — `git log --oneline` from `6a58c0f` to `HEAD` (180 commits). Write it to
   `docs/reports/flagharvest-work/gitlog-2.txt`. Replaces the stale `gitlog.txt`.
2. **The migration filename list** (`supabase/migrations/`) — dated and task-named.
3. **The 11 merged task reports** named above — each states what it fixed. **Read each once.**
4. **The code and prod surfaces the family list actually touches** — derived from the families, so
   you read what is needed and nothing else. **Read each file once; query each object once.**
   - Prod SQL: `psql "$(head -1 .env.db)" -tAc "<SQL>"`, **SELECT only**. ⚠️ `auth.uid()` is NULL on
     that connection, so RLS-gated RPCs legitimately return zero rows — **query `pg_policies`,
     `pg_proc`, `information_schema` directly and never conclude "broken" from an empty RPC result.**

## Phase 3 — ONE SWEEP: judge every family against the loaded evidence
**A single pass over the family list.** For each family assign one factual status:

- **RESOLVED** — a later commit or migration demonstrably fixed it. **Name the hash or filename and
  confirm the fix is real.** "Probably fixed" is not a status.
- **SUPERSEDED** — the thing it concerned no longer exists (file deleted, table retired, page
  removed). Show it is gone.
- **STILL OPEN** — you checked current code or prod and it is still there. Show what you checked.
- **CANNOT DETERMINE** — respectable; a guess is not. Say what you tried.

**⚠️ Do not go back for more context per item.** If a family needs a surface you did not load,
note it and batch those together for **one** follow-up read at the end of the sweep — never a
read per item.

### The fourth bucket the owner asked for: *"no longer something to resolve"*
Some items will be **STILL OPEN yet pointless** — the surface they concern is being redesigned out
from under them. ⚠️ **The flow program now in flight rewrites `/lessons`, `/horse`, `/acquisition`,
the checkout and the questions/submission pages** (`ASKRIGHT`, `CAREPATH`, `LESSONREQUEST`,
`SESSIONBOOK`; `RIDERQUALIFY` cancelled, `THREEFORMS` retired). An item about a screen that is
being replaced next week is technically open and practically moot.

**Mark these `STILL OPEN — MOOT?`, with one line saying which in-flight task overtakes it.**
**Do NOT remove them yourself** — this is a judgement, not a fact, and the owner makes it on his
pass. Flagging them is what saves him time; deciding for him is what loses his trust.

## Phase 4 — fold in the two already-verified slices
Their **within-slice dedup is reusable input** to Phase 1 — do not redo it. Their **OPEN items
(39 UI + 81 IDENTITY) are families like any other** and go through the same single sweep, since
they were judged 180 commits ago. Their CLOSED/SUPERSEDED entries **stand** — spot-check a handful
cheaply against the commit log rather than re-verifying them.

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
moot?:    <blank, or: which in-flight task overtakes this and why>
if kept:  <what doing it would involve, one line>
```

**Put every `STILL OPEN — MOOT?` family in its own section at the top**, before the ranked groups.
Those are the fastest decisions on the sheet and clearing them shrinks everything below.

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
- **Do not re-extract from the 104 reports** — collection is done; resume at deduplication.
- **Do not judge anything before the family list is complete** (Phase 1 precedes Phase 3, always).
- **Do not re-read a file or re-query an object for a second family.** Load once in Phase 2, sweep
  once in Phase 3. Missing surfaces are batched into ONE follow-up read, never a read per item.
- **Do not remove a MOOT item yourself** — flag it and let the owner decide.
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
7. **Report the attrition:** 975 raw → N families after dedup → M resolved/superseded →
   **K on the owner's sheet**, of which J are flagged MOOT. This is how he sees the method worked.
8. **Report the efficiency proof:** the number of distinct files read and prod objects queried, and
   confirmation that **no file was read twice**. If that number is anywhere near the family count,
   the method was not followed.
9. No application code, migration or push.

Report to `docs/reports/TASK-HARVESTCLOSE-REPORT.md`. Do not push; the orchestrator merges.
