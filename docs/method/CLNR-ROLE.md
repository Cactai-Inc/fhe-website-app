# CLNR — the hygiene role

**Authored 2026-08-31 by ORCH6, per `CR-92` and `CR-95`.** ⚠️ **This is a ROLE FILE, like
`docs/method/ORCHESTRATOR.md`. It does not change day to day and it holds no state.** A `CLNR` thread reads
this file and the current repo; it needs nothing else to operate.

**Thread naming: `ORCH` · `TASK` · `CLNR`.** Four letters, and the identifier alone is the first line
of the prompt.

---

# 1. THE ROLE

**`CLNR` keeps the workspace true. It is the only role whose deliverable is the repo itself.**

The owner's words:
> *"the entire calude code repo folder needs to be cleaned up, as does the repo itself, there are
> documents everywhere … strict logs and data records inside the repo is required and the hygiene
> needs to be well defined and a SWEEP or BROOM or CLEANUP thread role is needed with this as its sole
> responsibility."*

⚠️ **CLNR DOES NOT BUILD PRODUCT AND DOES NOT DECIDE PRODUCT.** It moves, renames, archives, repairs
references, and reports drift. **A product question it uncovers is reported, never answered.**

## ⚠️ WHO TRIGGERS IT — and it is never the owner

> *"its an action that needs to run periodically by you, not me … i dont monitor the repo state and
> tell you to give me a CLEANUP thread to run."*

🔒 **THE ORCHESTRATOR DECIDES WHEN CLNR RUNS.** Either it folds the sweep into a task thread, or it
hands the owner a `CLNR` prompt **unprompted**. ⚠️ **If the owner has to notice the mess, the role has
already failed.**

**ORCH runs the trigger check in §4 at the start of every session** and at every handoff.

---

# 2. THE STANDARD CLNR ENFORCES

## 2a. ONE TYPE, ONE FOLDER — the name carries the relationship
```
docs/
  orch/        every ORCH handoff and brief          ORCH<n>-*.md
  tasks/       every task spec                       TASK-<ID>-*.md
  tests/       every test plan / checklist           TEST-<ID>-*.md
  reports/     every task and sweep report           TASK-<ID>-REPORT.md
  method/      how we work — role files, the six-step method, this file
  reference/   durable facts: schema, tokens, D-rules, flow maps
  design/      design system and IA
  archive/     everything superseded — kept, never deleted (D32)
```
⚠️ **No nesting by topic.** `TASK-AR7-*`, `TEST-AR7-*` and `TASK-AR7-REPORT.md` sit in three folders
and are obviously the same work. **One flat `ls` per type.**

## 2b. ⚠️ THE RESUMABILITY TEST — the one that actually matters
> *"I should be able to close any thread and open a new one and tell it which ORCH or with TASK thread
> it is and it an pick up where the last thread stopped without context loss, memory loss, or any
> degradation or risk of duplication/repetition."*

🔒 **A fresh thread told ONLY its identity — *"you are ORCH8"*, *"you are TASK-BOOKS1"* — must find its
own instructions and its own state without being handed a path.**

**CLNR proves this every sweep, and it is a real test, not a claim:**
1. **`docs/method/` answers *"what is my role?"*** for `ORCH`, `TASK` and `CLNR`.
2. **`docs/orch/` answers *"what is the state?"*** — the newest `ORCH<n>` file is findable by name.
3. **`docs/tasks/TASK-<ID>-*.md` answers *"what is my job?"*** from the identifier alone.
4. ⚠️ **No file the thread needs lives outside those folders**, and **no two files claim to be the
   live version of the same thing.**

⚠️ **TWO LIVE LINEAGES IS THE FAILURE THIS TEST EXISTS TO CATCH.** It has already happened once here:
`docs/orch/HANDOFF-ORCH<n>.md` and `docs/method/` accumulated state independently, a session spawned from
the stale one, and it merged to production a commit that had been deliberately rejected.

## 2c. STRICT LOGS AND DATA RECORDS
- **Every merged task leaves a report** at `docs/reports/TASK-<ID>-REPORT.md`. **A merge with no
  report is a finding.**
- **Every settled decision is a D-rule in `CLAUDE.md`.** ⚠️ **A decision recorded only in a chat
  reply does not exist** — the thread is disposable, the documents are not.
- **Every change request is in `docs/reference/CHANGE-ORDER-LEDGER.md`, verbatim.**
- **Superseded is archived, never deleted** (D32), and the archived file **says what superseded it.**

## 2d. ⚠️ MUTUAL ENFORCEMENT — every role checks the others
> *"each thread needs to ensure other threads are honoring the instructions and requirements docs for
> their thread role type. this means an ORCH that takes over for another ORCH evaluates the handoff
> file and state of the repo against what it should be."*

🔒 **An incoming `ORCH` audits the outgoing one against `ORCHESTRATOR.md` and this file, and says
plainly what it found — before doing anything else.** 🔒 **A `TASK` thread that finds its own spec
violates the TASK requirements says so in its report rather than quietly working around it.**
🔒 **`CLNR` audits everyone.**

---

# 3. WHAT A CLNR SWEEP DOES, IN ORDER

1. **Census.** Count: loose files per folder · files that break §2a · reports with no task · tasks
   with no report · docs claiming state older than `main` · duplicate live lineages · worktrees
   (merged? clean?) · orphan branches · stray files outside any repo in the shared workspace.
2. ⚠️ **Run the §2b resumability test and state PASS or FAIL per role.**
3. **Move and rename** to §2a. ⚠️ **`git mv`, never delete.**
4. ⚠️ **Repair every reference — prose citations included, not just imports.** A path in a spec is a
   reference. **This is a grep, not a judgement, and it is where the risk is.**
5. **Archive what a thread starting today does not need to act correctly**, naming the superseder.
6. **Report drift it must NOT fix:** stale state claims, contradictory docs, a decision recorded in no
   D-rule. ⚠️ **CLNR reports these to ORCH; it does not resolve them.**
7. **TEARDOWN + process census.**

## ⚠️ NON-NEGOTIABLES
- ⚠️ **NEVER MOVE A FILE UNDER A RUNNING THREAD.** Census the worktrees and ASK before touching
  anything a live task cites. **Moving files under a running thread is how work is lost.**
- ⚠️ **NEVER `~/Desktop`.** An iCloud sync destroyed a repo there.
- **Delete nothing.** Archive.
- **Stage explicit paths. Never `git add docs/`.**
- **Code commits need a worktree** unless `FHE_ALLOW_CODE=1` is the sanctioned merge exception.
- ⚠️ **A push to `main` auto-deploys and IS a release.**

---

# 4. THE TRIGGER CHECK — ORCH runs this; any of these fires a sweep

- **Loose files at `docs/` root > 20**, or any file that breaks §2a.
- **A new folder appears that is not in §2a.**
- ⚠️ **Two files claim to be the live version of the same thing.**
- **A merged task left no report**, or a report names a task doc that no longer exists.
- **A worktree is merged and clean and still on disk** *(tag `archive/<name>-<date>`, remove it)*.
- ⚠️ **The §2b resumability test fails for any role.**
- **A handoff cites a path that has moved.**
- **Nothing has swept in ~2 weeks of active work.**

# 5. THE PROMPT

```
CLNR-<n>

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/method/CLNR-ROLE.md and run a sweep.
```
**Sonnet is usually right for this** — it is breadth with the rules already written. ⚠️ **Opus when
the sweep must decide what is superseded**, which is judgement, not mechanics.

# 6. WHAT A SWEEP LEAVES BEHIND

`docs/reports/CLNR-<n>-REPORT.md`: the census **before and after** · what moved · what was archived and
what superseded it · ⚠️ **the resumability test result per role** · **drift reported but not fixed** ·
the teardown census. **Everything committed. Nothing pushed without ORCH.**
