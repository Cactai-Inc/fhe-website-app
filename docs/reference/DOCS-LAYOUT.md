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
