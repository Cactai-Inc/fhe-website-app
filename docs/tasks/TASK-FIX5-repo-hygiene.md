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

## 2. ⚠️ THE BLAST RADIUS — MEASURED, AND IT IS THE WHOLE DIFFICULTY

| | |
|---|---|
| files citing a `docs/…` path | ⚠️ **417** |
| citations inside `src/` and `supabase/migrations/` | ⚠️ **75** — code comments and migration headers |
| `CLAUDE.md` | **15** |

⚠️ **EVERY MOVE BREAKS A REFERENCE SOMEWHERE. The moving is trivial; the repair is the task.**
⚠️ **Migration files are HISTORY — if a header cites a moved path, fix it, but never alter a
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
7. ⚠️ **THE REFERENCE REPAIR. Grep every moved path and fix all 417 files.** **This is the step that
   makes the rest safe, and it is the one most likely to be skimped.**

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
3. ⚠️ **ZERO broken `docs/…` references across all 417 files.** **Paste the grep proving it** — this
   is the acceptance test for the whole task.
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
