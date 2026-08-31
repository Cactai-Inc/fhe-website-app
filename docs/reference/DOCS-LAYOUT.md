# THE DOCS LAYOUT — proposed, 2026-08-31

⚠️ **PROPOSAL. Nothing has been moved.** Written after the owner's instruction:
> *"the entire claude code repo folder is a fucking mess, youve treated it like your personal slop
> room when its a shared workspace for all the repos, and the fhe website app repo is an even bigger
> mess with 0 hygiene, no cleanup and reconciliation when new structure principles are implemented."*

⚠️ **He is right, and the specific failure is mine: I put `ORCH6-BRIEF.md` in `docs/handoff/`, which
is an INSTRUCTION folder** — `00-START-HERE`, `01-THE-PROMPT`, `02-THE-SIX-STEP-METHOD` — **not a
folder of handoff documents.** He moved it beside the other `ORCH*` files, which was the only
sensible place, and I should have asked rather than invented a home.

## THE MEASURED STATE

| | |
|---|---|
| `docs/` loose files at the root | **64** |
| `docs/reports/` | **617 files** |
| `docs/tasks/` | **186 files** |
| `docs/reference/` | 52 · `docs/design/` 14 · `docs/archive/` 19 |
| `supabase/migrations/` | ⚠️ **972 files, 9.5 MB** |
| `test/db/` | 80 files, ⚠️ **51 of them red and cited by nothing** |

## THE RULE — one type, one folder. Names carry the relationship.

**The owner's own instruction, and it is the right call:**
> *"keeping all types in their own space rather than stratifying along another lense of commonality
> … while that would seem logical, it creates a deeply nested folder structure that is far more
> complicated than it needs to be … the appending of the orch to their name would be a better
> solution than the excessive folder nesting."*

```
docs/
  orch/        every ORCH handoff and brief          ORCH<n>-*.md
  tasks/       every task spec                       TASK-<ID>-*.md
  tests/       every test plan / checklist           TEST-<ID>-*.md
  reports/     every task and sweep report           TASK-<ID>-REPORT.md · SWEEP-<Ax>-REPORT.md
  method/      how we work — stable, rarely changes
  reference/   durable facts: schema, tokens, D-rules, flow maps
  design/      design system and IA
  archive/     everything superseded, kept not deleted (D32)
```

⚠️ **THE NAME IS THE JOIN.** `TASK-AR7-*` · `TEST-AR7-*` · `TASK-AR7-REPORT.md` sit in three folders
and are obviously the same work. **No nesting required, and one flat `ls` per type.**

⚠️ **`docs/handoff/` STOPS BEING A HANDOFF FOLDER.** It holds the standing instructions a new
orchestrator reads. **Rename it `docs/method/`** and move `METHOD-*.md` in beside it. **The `ORCH*`
files go to `docs/orch/`, together, as the owner already did by hand.**

## WHAT MOVES TO ARCHIVE

**Test: does a thread starting today need it to act correctly?** No → archive.

- **Superseded status and plan docs** — `SESSION-STATUS-*` ×6 · `PLAN-OF-ATTACK-2026-08-12` ·
  `WORK-INVENTORY-2026-08-08` · `OPEN-ITEMS-2026-08-18` · `RESTART-2026-08-25` ·
  `ORCHESTRATOR-HANDOFF` · `HANDOFF.md` · `SESSION_HANDOFF_2026-08-07` · `THREAD_REGISTRY`.
- **Completed audits and one-off specs** — `SYSTEM_AUDIT_2026-07-31` · `INFO_BUTTON_AUDIT` ·
  `CREDIT_AND_BALANCE_AUDIT` · `clause-gate-batch-spec` · `insurance-resolution-spec` ·
  `AUTONOMOUS_BOOKING_SPEC` · `BUILD_TRACKER`.
- **`docs/reports/` — 617 files.** ⚠️ **Keep the reports for work still in flight and everything the
  live ledger cites; archive the rest by date.** Reports are evidence — **archived, never deleted.**
- **The `build 2` folder and anything outside the orch/task/test/report framework**, per the owner.

⚠️ **NOTHING IS DELETED. `git mv` into `docs/archive/`, preserving history** (D32).

## ⚠️ THE MIGRATIONS — the biggest win, and the one real trap

**972 files, 9.5 MB, and D30 already rules them archived rather than carried forward:** *"it documents
history; it builds nothing."* **There is no `schema_migrations` table — they are a hand-maintained
journal applied by `psql`.** ⚠️ **114+ rewrite function bodies in place and are NOT replayable on a
fresh database.**

**Replace them, for daily use, with a maintained pair in `docs/reference/`:**
- **`DB-SCHEMA.md`** — every table, its columns, and what it is for, generated from the live database.
- **`DB-MAP.md`** — the functions that matter, what writes what, and the spines. ⚠️ **Generated, with
  the command in its own header, so it can be regenerated rather than rotting.**

### ⚠️ THE TRAP — FOUR SCRIPTS READ THE MIGRATIONS DIRECTORY
**Verified 2026-08-31. A blind `git mv` breaks all four:**
| Script | Why |
|---|---|
| `scripts/build-lease-extract.mjs:68` | `ls supabase/migrations \| sort \| tail -1` — reads the newest filename |
| `scripts/build-template-load-migration.mjs:21` | **writes** a migration |
| `scripts/build-form-definitions-migration.mjs:19` | **writes** a migration |
| `scripts/emailextract/gen-seed.mjs:11` | **writes** a migration |

**So: archive the historical files, keep the directory live for new ones, and fix the four scripts in
the same change.** ⚠️ **Tag `pre-refactor-migrations` before moving anything** (D30 §2).

**Same for `test/db/` — 80 files, 51 red, and `ORCHESTRATOR.md` already rules that nothing may cite
them as proof.** Archive the red ones; keep what passes and is cited.

## WHY THIS IS NOT COSMETIC

⚠️ **Two live defects this month were caused by stale documents, not by code:**
`TASK-PAGEMERGE` deferred real work citing a claim already three days stale (D20), and
`AppLayout.tsx:636` asserted a fix that was never written, so the owner reported the same defect
three times. **A repo where the current instruction cannot be told from the superseded one produces
exactly these.**

## HOW TO DO IT SAFELY

⚠️ **A `git mv` sweep across 800+ files is a real change with a real blast radius**: every
cross-reference in `CLAUDE.md`, the ledger, the briefs and 617 reports points at a path.
**Sequence:** move the loose root files → the `ORCH*` set → archive superseded reports → the
migrations with their four scripts → regenerate the schema pair → **then grep for broken paths and
fix them.**

⚠️ **NOT WHILE `TASK-FIX3` AND `TASK-FIX4` ARE IN FLIGHT.** They cite task paths, and moving files
under a running thread is how work gets lost. **After FIX4 merges, before the zone sweeps** — the
sweeps then read a clean tree, which is exactly when it pays for itself.

---

# PART 2 — THE SHARED WORKSPACE, `~/Downloads/claude-code-repo/`

> *"the markdown files in claude code repo should be moved to their appropriate place as well as any
> files in the downloads folder itself that have a home somewhere inside claude code repo inside one
> of the repos."*

⚠️ **This is a SHARED workspace holding several repos** — `fhe-website-app`, `orchestration`,
`rabbit-hole-v3`, `FRACTAL`, `vscode-mods`. **Loose files at its root belong to none of them and are
invisible to every repo's history.** Surveyed 2026-08-31.

## THE ELEVEN LOOSE MARKDOWN FILES — ten are FHE's, one is not

| File | Home | Note |
|---|---|---|
| `ADMIN-IA-REVISION.md` | `fhe/docs/design/` | *"Revises ADMIN-IA.md §1"* — its sibling is already in the repo. ⚠️ **Cited by `TASK-AR6`; a live document living outside the repo it governs.** |
| `04-SEQUENCE-AND-RULINGS.md` | `fhe/docs/design/` | part of the same refactor set |
| `CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md` | `fhe/docs/design/` | the chat thread's output |
| `REFACTOR-POSITION-2026-08-22.md` | `fhe/docs/archive/` | *"My current opinion"* — superseded by `REBUILD-SCOPE-multi-tenant-platform` |
| `THREAD-ASSESSMENT-2026-08-22.md` | `fhe/docs/archive/` | a thread's own synthesis, historical |
| `TASK-AUTHORITY-one-owner-one-write-path.md` | `fhe/docs/tasks/` | **merged as `a1eebe9` — archive with the task set** |
| `SETUP-REMOTE.md` | `fhe/docs/reference/` | setup instructions |
| ⚠️ `TASK-ONERAIL-…md` | **nowhere** | ⚠️ **BYTE-IDENTICAL to `fhe/docs/tasks/`'s copy. Delete the root one.** |
| ⚠️ `01-DESIGN-SYSTEM.md` | **decide first** | ⚠️ **DIFFERS from `fhe/docs/design/refactor/prior-thread-2026-08-20/01-DESIGN-SYSTEM.md`. A blind move OVERWRITES a real difference — diff and reconcile before touching it.** |
| `v2authoringbrief.md` | ⚠️ **NOT FHE** | *"v2.0 GAS Build"* — a different project. **Ask the owner; do not file it into FHE.** |
| `handoff.zip` · `orchestration.zip` | archive | ⚠️ **`orchestration/` exists as a live directory — confirm the zip is not the only copy of something before archiving.** |

⚠️ **`Icon` is a macOS artefact — leave it.**

## ⚠️ NINE MERGED WORKTREES ARE STILL SITTING THERE

`wt-ar1` … `wt-ar7`, `wt-fix1`, `wt-fix2` — **all nine verified merged into `main`.**
**Per `ORCHESTRATOR.md` §6 each should have been archive-tagged and removed at merge, and I did not
do it.** ⚠️ **That is the same hygiene failure the owner is describing, and it is mine.**

**Per worktree: `git merge-base --is-ancestor` ✅ · `git status --porcelain` must be EMPTY ·
`git tag archive/<name>-<date>` · `git worktree remove` · `git branch -d`.**
⚠️ **`wt-fix3` and `wt-fix4` are NOT in this list — they have not run yet. Do not touch them.**

## SEQUENCE — and the same caution as Part 1

1. ⚠️ **Reconcile `01-DESIGN-SYSTEM.md` first** — it is the only one that can lose content.
2. Move the nine unambiguous files with `git mv` **into the FHE repo**, so they gain history.
3. Delete the byte-identical `TASK-ONERAIL` duplicate.
4. **Ask about `v2authoringbrief.md`.**
5. Archive-tag and remove the nine merged worktrees.
6. **Grep for references to every moved path and fix them.**

⚠️ **NOT WHILE `TASK-FIX3` / `TASK-FIX4` ARE IN FLIGHT** — they will create `wt-fix3` and `wt-fix4`
in this directory, and moving files under a running thread is how work is lost.
