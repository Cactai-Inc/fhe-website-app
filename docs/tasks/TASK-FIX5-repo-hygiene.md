# TASK-FIX5 — one type per folder, and nothing lives outside a repo

⚠️ **THIS IS A BUILD TASK, and it is almost entirely `git mv` + reference repair.** No features, no
migrations, no behaviour change. Report to `docs/reports/TASK-FIX5-REPORT.md`.

**The plan is `docs/reference/DOCS-LAYOUT.md` — read it first, both parts.** This file is the
execution order, the traps and the tests.

---

## 1. WHY — and it is not cosmetic

**Owner, 2026-08-31:**
> *"the entire claude code repo folder is a fucking mess, youve treated it like your personal slop
> room when its a shared workspace for all the repos, and the fhe website app repo is an even bigger
> mess with 0 hygiene, no cleanup and reconciliation when new structure principles are implemented."*

⚠️ **TWO LIVE DEFECTS THIS MONTH CAME FROM STALE DOCUMENTS, NOT CODE.** `TASK-PAGEMERGE` deferred
real work citing a claim already three days stale (D20). `AppLayout.tsx:636` asserted a fix that was
never written, so **the owner reported the same nav defect three times.** **A tree where the current
instruction cannot be told from the superseded one produces exactly these.**

## 2. THE BLAST RADIUS — corrected 2026-08-31, and it is SMALLER than first stated

⚠️ **The orchestrator first wrote "417 files cite a docs/ path" as the headline risk. That number is
real but MISLEADING, and the owner challenged it.** Broken down:

| Where | Files citing a `docs/…` path |
|---|---|
| `docs/` itself | **338** — 175 tasks · 105 reports · 33 root · 25 elsewhere |
| `supabase/migrations/` | 44 |
| `src/` | 20 · `test/` 11 · `api/` 1 · `README.md` 1 · `CLAUDE.md` 1 |

⚠️ **BUT `docs/tasks/`, `docs/reports/`, `docs/reference/` AND `docs/design/` DO NOT MOVE — they are
already the target layout.** So most citations point at paths that stay put. **Measured:**

| | |
|---|---|
| task + report files citing a path that **MOVES** *(`docs/handoff/`, `HANDOFF-ORCH*`)* | ⚠️ **5** |
| task + report files citing `docs/tasks\|reports\|reference\|design` — **unaffected** | **255** |

⚠️ **SO THE REPAIR IS ~5 FILES PLUS THE 33 LOOSE ROOT FILES PLUS WHATEVER ARCHIVING RELOCATES — NOT
417.** **Do not spend the task grinding a 417-file grep.**

**The honest rule: repair is proportional to what MOVES, not to what CITES.**
1. **Move a batch.**
2. **Grep for the OLD paths of that batch only.**
3. **Fix what breaks, then move the next batch.**

⚠️ **THE ONE PLACE THE BIG NUMBER STILL MATTERS: `docs/reports/` archiving.** Moving 500+ reports into
`docs/archive/` relocates paths that **255 files may cite.** ⚠️ **That step alone deserves the full
grep. The folder renames do not.**
⚠️ **Migration headers cite `docs/` in 44 files. Fix a header if it breaks; NEVER alter a
migration's SQL.**

## 3. THE TARGET LAYOUT

```
docs/
  orch/        ORCH<n>-*.md              every orchestrator handoff and brief
  tasks/       TASK-<ID>-*.md
  tests/       TEST-<ID>-*.md
  reports/     TASK-<ID>-REPORT.md · SWEEP-<Ax>-REPORT.md
  method/      how we work — stable
  reference/   durable facts: schema, tokens, D-rules, flow maps
  design/      design system and IA
  archive/     everything superseded — kept, never deleted (D32)
```

⚠️ **THE NAME IS THE JOIN.** `TASK-AR7-*` · `TEST-AR7-*` · `TASK-AR7-REPORT.md` live in three folders
and are obviously one piece of work. **No nesting. One flat `ls` per type** — the owner's explicit
instruction, and the reason for it is that deep trees are what nobody maintains.

⚠️ **`docs/handoff/` IS NOT A HANDOFF FOLDER — RENAME IT `docs/method/`.** It holds
`00-START-HERE`, `01-THE-PROMPT`, `02-THE-SIX-STEP-METHOD` — standing instructions. **The
orchestrator put `ORCH6-BRIEF.md` in it because the NAME matched, which is the mistake this rename
prevents.** Move `METHOD-*.md` in beside them; **the `ORCH*` files go to `docs/orch/`, where the
owner already put them by hand.**

## 4. ORDER OF EXECUTION — smallest blast radius first

**Commit after each step.** ⚠️ **A single 800-file commit cannot be reviewed or reverted.**

1. **`docs/handoff/` → `docs/method/`**, and `METHOD-*.md` in beside it.
2. **Every `ORCH*` / `HANDOFF-ORCH*` file → `docs/orch/`.**
3. **The 64 loose root files** → their folder per `DOCS-LAYOUT.md`, or `docs/archive/`.
4. **`docs/reports/` — 617 files.** ⚠️ **Keep anything the live ledger, `RUN-QUEUE.md` or an
   in-flight task cites. Archive the rest BY DATE.** Reports are evidence — **archived, never
   deleted.**
5. **The shared workspace** — Part 2 of the plan. **See §5, it has its own traps.**
6. **The migrations** — §6.
7. ⚠️ **THE REFERENCE REPAIR — per §2, batch by batch.** After each move, grep for **that batch's
   OLD paths only** and fix what breaks. ⚠️ **The `docs/reports/` archiving in step 4 is the one step
   that earns a full sweep. Do NOT grep 417 files after a folder rename.**

## 5. ⚠️ THE SHARED WORKSPACE — three traps, all verified

`~/Downloads/claude-code-repo/` holds several repos. **Eleven loose markdown files sit at its root,
invisible to every repo's history.** Ten belong to FHE.

1. ⚠️ **`01-DESIGN-SYSTEM.md` DIFFERS from `docs/design/refactor/prior-thread-2026-08-20/01-DESIGN-SYSTEM.md`.**
   **A blind move overwrites a real difference. Diff it, reconcile it, say what you kept.**
2. ⚠️ **`TASK-ONERAIL-…md` is BYTE-IDENTICAL to the in-repo copy — delete the root one only.**
3. ⚠️ **`v2authoringbrief.md` is NOT FHE** — *"v2.0 GAS Build"*, a different project.
   **DO NOT file it into this repo. Leave it and flag it.**

⚠️ **`ADMIN-IA-REVISION.md` is cited by `TASK-AR6` and is a LIVE document living outside the repo it
governs.** It goes to `docs/design/`.
**`handoff.zip` / `orchestration.zip`:** ⚠️ **`orchestration/` exists as a live directory — confirm
the zip is not the only copy of something before archiving.** **`Icon` is a macOS artefact; leave it.**

### ⚠️ NINE MERGED WORKTREES, AND REMOVING ONE WRONG LOSES WORK
`wt-ar1` … `wt-ar7`, `wt-fix1`, `wt-fix2` — **all nine verified merged.**
**Per worktree, in this order:** `git merge-base --is-ancestor task/<x> main` ✅ **AND**
`git status --porcelain` **EMPTY** → `git tag archive/<name>-2026-09-01` → `git worktree remove` →
`git branch -d`. ⚠️ **An orchestrator once force-removed a worktree that had work in it. Do not use
`--force`.**
⚠️ **`wt-fix3` and `wt-fix4` are LIVE OR ABOUT TO BE. DO NOT TOUCH THEM.** ⚠️ **And any `wt-*` not on
that list of nine — leave it and report it.**

## 6. ⚠️ THE MIGRATIONS — the biggest win, and the sharpest trap

**972 files, 9.5 MB. D30 already rules them archived rather than carried forward:** *"it documents
history; it builds nothing."* There is no `schema_migrations` table — they are a hand-maintained
journal applied by `psql`, and **114+ rewrite function bodies in place and are NOT replayable.**

⚠️ **FOUR SCRIPTS READ OR WRITE THAT DIRECTORY. A blind `git mv` breaks all four:**
| Script | What it does |
|---|---|
| `scripts/build-lease-extract.mjs:68` | `ls supabase/migrations \| sort \| tail -1` — **reads the newest filename** |
| `scripts/build-template-load-migration.mjs:21` | **writes** a migration |
| `scripts/build-form-definitions-migration.mjs:19` | **writes** a migration |
| `scripts/emailextract/gen-seed.mjs:11` | **writes** a migration |

**So: `git tag pre-refactor-migrations` FIRST (D30 §2) → move the historical files to
`supabase/migrations-archive/` → keep `supabase/migrations/` LIVE for new ones → fix all four scripts
in the same commit.**

⚠️ **CUT-OFF: archive everything applied before 2026-08-01; keep August onward live.** Recent
migrations are the ones a thread still reads to understand current behaviour.

**Then generate the replacement pair in `docs/reference/`, from the LIVE database:**
- **`DB-SCHEMA.md`** — every table and column, and what it is for.
- **`DB-MAP.md`** — the functions that matter, what writes what, the spines.
⚠️ **Each must carry, in its own header, the exact command that regenerates it** — the owner asked
for *"a new updated schema and db map that is maintained"*, and **a generated file with no stated
command rots exactly like the thing it replaced.**

**`test/db/` — 80 files, 51 red.** `ORCHESTRATOR.md` already rules nothing may cite them as proof.
**Archive the red ones; keep what passes and is cited.** ⚠️ **Verify red/green yourself — do not trust
the count.**

## 7. OUT OF SCOPE

Any behaviour change · any SQL inside a migration · `v2authoringbrief.md` · `wt-fix3` / `wt-fix4` ·
the `orchestration/` repo's own contents *(a product artifact — see `docs/ORCHESTRATOR.md`)*.

## 8. CONSTRAINTS

- **Worktree `wt-fix5`, branch `task/fix5`**, from `origin/main`. ⚠️ **Copy `.env.db` and `.env` in.**
- ⚠️ **RUN ONLY AFTER `TASK-FIX3` AND `TASK-FIX4` HAVE MERGED.** Both cite task paths and both create
  worktrees in the directory you are cleaning. **Moving files under a running thread is how work is
  lost.**
- ⚠️ **`git mv` ALWAYS — never `rm` + create.** History is the point (D32).
- **`test:db` red is the documented baseline.** Lint baseline **46**.
- **COMMIT AS YOU GO, per step. DO NOT PUSH.** ⚠️ **TEARDOWN: census pasted.**

## 9. THE TEST THIS MUST PASS

1. **`docs/` root holds only folders** — paste `ls docs/`.
2. **Every file is in the folder its type dictates.** Name the exceptions and why.
3. ⚠️ **ZERO broken `docs/…` references.** **Paste the grep** — run it against the OLD path of every
   batch you moved, not against all 417. ⚠️ **The `docs/reports/` archiving step gets the full sweep;
   the folder renames do not.**
4. **`CLAUDE.md`'s 15 citations all resolve.**
5. **`npm run build`, `typecheck`, `typecheck:api`, lint ≤46** — proving the four migration scripts
   still work.
6. **`scripts/build-lease-extract.mjs` finds the newest migration** after the split. **Run it.**
7. **`DB-SCHEMA.md` and `DB-MAP.md` exist, are generated from production, and state their own
   regeneration command.**
8. **The nine worktrees are tagged and removed; `wt-fix3`/`wt-fix4` untouched.** Paste
   `git worktree list`.
9. **The shared workspace root holds no FHE markdown** — paste `ls`.
10. ⚠️ **`git log --follow` works on three moved files.** **Proof that history survived.**
11. **Nothing was deleted except the byte-identical `TASK-ONERAIL` duplicate.** ⚠️ **State that
    plainly** (D32).

---

# ⚠️ STATE UPDATE — 2026-08-31, ORCH6. READ THIS BEFORE §5 AND §2.

**1 · THE NINE MERGED WORKTREES ARE GONE.** ⚠️ **§5's worktree section is STALE.** All ten
(`wt-ar1`–`wt-ar7`, `wt-fix1`, `wt-fix2`, `wt-fix4`) were verified merged and clean, tagged
`archive/<name>-2026-08-31`, and removed by ORCH6. **`git worktree list` now shows the canonical
checkout only** — plus whatever the currently-running threads have created. ⚠️ **Re-run the census
yourself; do not act on either list without looking.**

**2 · `TASK-FIX4` HAS MERGED** (`a9ffcdcd`). Its report is at `docs/reports/TASK-FIX4-REPORT.md` and
moves with the rest.

**3 · FOUR NEW TASK DOCS EXIST AND MUST MOVE WITH EVERYTHING ELSE:**
`TASK-CR85-three-nav-sections.md` · `TASK-BOOKS1-what-a-sale-was-worth.md` ·
`TASK-MODAL2-the-close-rule-and-the-save-state.md` — plus their reports when they land.
⚠️ **`docs/handoff/RUN-QUEUE.md` cites every one of them by path, and so does the ledger.**
**The reference repair must catch prose citations, not only imports.**

**4 · ⚠️ YOUR TARGET LAYOUT IS NOW A REQUIREMENT, NOT A PROPOSAL — see `CR-92`.** The owner:
> *"the ORCH and TASK thread instructions for 6 steps, handoff, and operating requirements need a
> home and need to be kept to strict adherence to these approaches. I should be able to close any
> thread and open a new one and tell it which ORCH or with TASK thread it is and it an pick up where
> the last thread stopped without context loss, memory loss, or any degradation or risk of
> duplication/repetition."*

⚠️ **THEREFORE `docs/orch/` AND `docs/method/` ARE THE LOAD-BEARING PART OF THIS TASK**, not the tidy
part. **After you finish, a fresh thread told only *"you are ORCH7"* or *"you are TASK-X"* must be
able to find its own instructions and its own state without being told a path.** ⚠️ **State in your
report whether that is true, and name what is still missing if it is not.**

**5 · ⚠️ WHAT IS *NOT* YOURS: the ROLE and the STANDARD.** `CR-92` also asks for a dedicated
**SWEEP / BROOM / CLEANUP** thread role that owns hygiene permanently, strict in-repo logs, and
mutual enforcement between thread types *(an incoming ORCH auditing the outgoing one against the role
docs)*. ⚠️ **That is a separate task. You move the files and repair the references; the role that
keeps them that way is authored separately.** **Do not invent it here — but do not lay the files out
in a way that makes it harder, either.**

**6 · ⚠️ THE ROLE FILES NOW EXIST AND `docs/method/` IS ALREADY CREATED.**
`docs/method/DISO-ROLE.md` · `docs/method/TASK-ROLE.md` · `docs/method/CLNR-ROLE.md` are in place.
⚠️ **`docs/ORCHESTRATOR.md` MUST BE RENAMED `docs/method/ORCH-ROLE.md`** so all four roles sit
together and a thread told only its identity can find its own file. **It is cited widely — the
reference repair is the work, and prose citations count.**
**`docs/handoff/02-THE-SIX-STEP-METHOD.md` and `docs/METHOD-*.md` join them in `docs/method/`.**
