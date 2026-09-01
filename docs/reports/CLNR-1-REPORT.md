# CLNR-1 — sweep report

**First-ever CLNR sweep.** No prior `CLNR-*` ledger or report existed. Full working log with every
query is `docs/reports/CLNR-1-LEDGER.md`. This report is the summary §6 of `CLNR-ROLE.md` asks for.

---

## CENSUS — BEFORE

- `docs/` top-level folders: `archive, contract-content, contract-exports, design, method, orch,
  proposed, reference, reports, staged, tasks, ui-orders` (12). §2a's canonical list is
  `orch, tasks, tests, reports, method, reference, design, archive` (8, and `tests/` doesn't exist
  yet). **5 folders outside §2a:** `contract-content`, `contract-exports`, `proposed`, `staged`,
  `ui-orders`.
- Loose files at `docs/` root: 1 (`.DS_Store`, untracked — not a §4 trigger, threshold is >20).
- `docs/tasks/`: 203 files, 3 not matching `TASK-<ID>-*.md`.
- `docs/reports/`: 209 files/dirs, including 11 tracked screenshot-dump directories totaling **~57 MB**
  committed to git, and one `.patch` file.
- `docs/reference/`: 44 entries, several topic-named subdirectories (`flows/`, `lease-map/`,
  `leather/`, `insurance-decision-map/`, `navhover-frames/`, `shelved-cardstock-header/`).
- `docs/orch/`: 6 files — `BOARD.md`, `ORCH6-BRIEF.md`, `RUN-QUEUE.md` (current) plus
  `HANDOFF-ORCH3.md`, `HANDOFF-ORCH4.md`, `HANDOFF-ORCH5.md` (dead single-file-handoff lineage,
  pre-dating the folder convention `docs/method/00-START-HERE.md` established 2026-08-27).
- Worktrees: `main` + `wt-1..wt-5` (pool, detached HEAD @ `14140564`, all clean, all ancestor-merged)
  + `wt-signstrip` (branch `task/signstrip`, clean, ancestor-merged) = **6 non-main worktrees**
  against the §4 cap of 3.
- Branches: ~75 local + ~50 remote. Not mass-audited this sweep (see Drift below).
- Role files in `docs/method/`: 6 real roles (`ORCHESTRATOR.md`, `DISCO-ROLE.md`, `DSNR-ROLE.md`,
  `TASK-ROLE.md`, `CLNR-ROLE.md`, `RNR-ROLE.md`) + `CODR-PROFILE.md` (a `TASK` profile, not a
  separate role) + 5 numbered method docs (`00-START-HERE.md` … `04-OPEN-QUESTIONS.md`, still
  live/cited by `ORCH6-BRIEF.md`) + 2 dated one-off artifacts (`BENCH-TEST-2026-09-01.md`,
  `ORCH6-FOR-REVIEW-2026-09-01.md`) sitting in a folder §2a scopes to "how we work."

## WHAT MOVED (`git mv`, nothing deleted)

| From | To | Why |
|---|---|---|
| `docs/orch/HANDOFF-ORCH3.md` | `docs/archive/HANDOFF-ORCH3.md` | Dead single-file-handoff lineage, superseded by `docs/orch/BOARD.md` + `ORCH6-BRIEF.md`. Header added naming the superseder. |
| `docs/orch/HANDOFF-ORCH4.md` | `docs/archive/HANDOFF-ORCH4.md` | Same lineage. Header added naming the superseder. |
| `docs/orch/HANDOFF-ORCH5.md` | `docs/archive/HANDOFF-ORCH5.md` | Already self-declared `[SUPERSEDED 2026-08-27]` in its own title — moved to match its own claim. |
| `docs/tasks/INTAKE-ACCTPAGE-owner-spec-2026-08-12.md` | `docs/reference/INTAKE-ACCTPAGE-owner-spec-2026-08-12.md` | Not a task spec — a verbatim owner-request capture, "QUEUED, NOT AUTHORED." Matches the existing `TOPIC-2026-08-12.md` reference-folder convention. Zero prior references, zero repair needed. |
| `docs/tasks/ADMIN-REVIEW-ANALYSIS-STANDARD.md` | `docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md` | A cross-task rubric, not a task spec — belongs beside its companion `docs/method/METHOD-area-sweeps.md`, which `ZONE-SWEEPS-A1-A12.md` already cites as the paired directive. 9 prose references repaired (8 `TASK-AR*` specs + `TASK-AR4-REPORT.md`). |
| stray `docs/.DS_Store` | deleted | Untracked Finder cruft, already gitignored (`.gitignore:17`) — not a repo document. |

**References repaired** (path only, prose left otherwise untouched — see Drift for the one line that
needs more than a path fix): `docs/method/ORCHESTRATOR.md` (×2), `docs/method/00-START-HERE.md`
(×2), `docs/tasks/TASK-FLOWMAP-every-flow-the-app-facilitates.md`,
`docs/archive/OWNER-DECISIONS-PENDING-2026-08-20.md`, plus the 9 `ADMIN-REVIEW-ANALYSIS-STANDARD`
citations above. Verified clean by re-grep: zero references outside `docs/archive/` still point at
an old path (matches inside the three archived files themselves, citing each other, are left as
frozen historical narrative — rewriting them would be editing the historical record, not repairing
a live reference).

## WORKTREES — RECYCLED

`wt-signstrip` (`task/signstrip`, merged, clean) → tagged `archive/signstrip-2026-09-01` (commit
`f4f67133`) → `git worktree move` to `wt-6` → `git checkout --detach origin/main` → `git clean -xdf
-e node_modules -e .env -e .env.db` → local branch `task/signstrip` deleted (no remote copy
existed). Full commit history is preserved under the tag.

⚠️ **Mid-sweep finding:** between first census and the recycle step, `wt-1` had moved from idle
`(detached HEAD @ 14140564)` to live — checked out on `task/signdoor` at a new commit. Another
thread claimed it while this sweep was running. Re-verified `wt-2` through `wt-5` immediately before
touching anything: all four were still idle, clean, unchanged. `wt-1` was never touched by this
sweep (it was always in the "keep" set).

**Enforced the keep-3 cap:** kept `wt-1` (live, `task/signdoor`), `wt-2`, `wt-3` (idle pool, `.env`
+ `.env.db` confirmed byte-identical across all five original pool slots via `md5`, so nothing
worktree-unique was lost). Removed `wt-4`, `wt-5`, `wt-6` via `git worktree remove` after
re-confirming each was still idle and clean at the moment of removal.

**Worktrees after:** `main`, `wt-1` [task/signdoor], `wt-2`, `wt-3` — 3 non-main, at the cap.

## §2b RESUMABILITY TEST — PASS/FAIL PER ROLE

| Role | Result | Note |
|---|---|---|
| `ORCH` | **PASS, with a live defect** | `docs/method/ORCHESTRATOR.md` line 22 tells every fresh `ORCH` thread *"for what is happening right now, read `HANDOFF-ORCH3.md`… that is state"* — pointing at a file now two lineages stale (that file is itself superseded by `HANDOFF-ORCH4`→`HANDOFF-ORCH5`→the `docs/method/` folder→`docs/orch/BOARD.md`+`ORCH6-BRIEF.md`). Path repaired so the reference resolves (now points into `docs/archive/`), but the *claim* that it is current state is wrong and is role-file content, not mine to rewrite. **Filed as the top drift item below.** |
| `DISCO` | **PASS** | `DISCO-ROLE.md` exists; `docs/reports/DISCO-1-{LEDGER,HANDOFF}.md` findable by name. Single instance, nothing to disambiguate. |
| `DSNR` | **AT RISK** | `DSNR-ROLE.md` exists, but its artifacts are filed as `DSGN-1/2-{LEDGER,HANDOFF}.md` — a different prefix than the role name. A thread told *"you are DSNR"* would search for `DSNR-*` and not find its own history on the first try. Not fixed — renaming these would touch a role/artifact-naming convention, which is a locked-with-the-owner decision, not a mechanical one. |
| `TASK` | **PASS** | `TASK-ROLE.md` exists; `docs/tasks/TASK-<ID>-*.md` now 100% conforming (post-move) except `ZONE-SWEEPS-A1-A12.md`, which is deliberately pre-split (12 drafted-not-launched briefs) and left in place. ~30 task specs have no matching `TASK-<ID>-REPORT.md`; cross-checked each against `git branch -a` and only one (`UIREVIEW`) has any branch at all — the other ~29 look like unstarted backlog, not silently-shipped-unreported work, but this sweep did not open each one to confirm. |
| `CLNR` | **PASS** | First-ever run; this report and its ledger are now the seed. |
| `RNR` | **PASS** | `RNR-ROLE.md` exists; role is explicitly stateless/mechanical, nothing to resume. |

**Two-live-lineages check:** the one real instance found (`HANDOFF-ORCH3/4/5.md` vs. the current
`docs/orch/` state) is resolved by the archive above.

## DRIFT REPORTED, NOT FIXED — for ORCH

1. ⚠️ **`docs/method/ORCHESTRATOR.md:22`** — stale "read this for current state" pointer, detailed
   above. Needs an owner/ORCH content edit, not a CLNR path fix (already done).
2. **`CLNR-ROLE.md` §2b's own text is stale** — it says *"the FOUR role files … `ORCH-ROLE.md` ·
   `DISCO-ROLE.md` · `TASK-ROLE.md` · `CLNR-ROLE.md`"*. The real filename is `ORCHESTRATOR.md`, not
   `ORCH-ROLE.md`, and there are six roles now (`DSNR` and `RNR` both postdate that sentence).
   `THE-RUNNING-RECORD.md` already has the correct five-then-six-role picture. A decision recorded
   only in one role file's stale prose while another file has it right is exactly the "two files
   disagree" pattern this role exists to catch — reporting it, not editing role-file prose myself.
3. **`DSNR`/`DSGN` naming mismatch** — see resumability table above. Needs a lock: is the role
   `DSNR` and the artifact prefix `DSGN` a permanent split, or should one be renamed to match the
   other?
4. **5 folders outside the §2a taxonomy**, two of which are load-bearing for code (not just
   documentation, so moving them without a script update would break the build):
   - `docs/contract-content/`, `docs/contract-exports/` — actively read by
     `scripts/build-lease-extract.mjs`, `scripts/build-sale-template-migration.mjs`, and cited
     inside two committed Supabase migrations. These are pipeline inputs, not human documentation —
     candidate for living outside `docs/` entirely, but that's a build-config change, not a `git mv`.
   - `docs/ui-orders/` — 20 files, internally consistent `UIO-<n>-*.md` convention, no code
     references. Candidate to just become a locked 9th taxonomy category rather than be folded
     elsewhere — it already behaves like one.
   - `docs/proposed/`, `docs/staged/` — one file each (a SQL proposal, a JSON test fixture), no code
     references, unclear whether they're meant to be durable or personal scratch. Needs the owner to
     say which.
5. **~57 MB of screenshot evidence is committed directly into `docs/reports/*-shots/` and
   `flagharvest-work/`** (`walk1`–`walk4` alone are 46.7 MB). `.gitignore` line 29's comment
   ("Visual-milestone screenshots, generated by `scripts/shot.mjs`") names `out/` as the intended
   (ignored) destination — these landed in tracked folders instead. Purging them would mean rewriting
   git history, which this sweep is explicitly not authorized to do unilaterally. Flagging the
   number so ORCH can decide whether the evidence is worth the repo weight.
6. **`docs/reports/PAGEVIS-navfilter.patch`** is not orphaned — it's a deliberately *held* patch,
   named in `TASK-PAGEVIS-REPORT.md` as "proven green before it was held… `git apply` it after
   HORSEONE merges." `HORSEONE` has no report and no branch (see below) — so unless it landed under
   a different name, the patch is still correctly waiting. Worth a direct check, not a guess.
7. **~29 task specs with no report and no matching branch** (`ATTRIB, BOOKFLOW, CONTRACTMENUS,
   DASHBOARDS, DASHFEED, DAYSHEET, DEPENDENT, FIX6, FUNNELDOORS, HOMESHAPES, HORSEONE, INVITELINK,
   LANDINGSIGNIN, LIFECYCLE, MONTHEND, NAVHOVER, OFFERINGDOCS, ONEEDITOR, ONEPEOPLE, ONERAIL,
   ONETEAM, P1SHIP, PARTYJOURNEY, RECORDSELECT, REQCARDS, RIDERQUALIFY, SIGNBOOK, SIGNDOOR,
   SITECOPY, THREEFORMS`) plus `UIREVIEW` (has a branch, `origin/task/uireview`, but no report).
   Reads as unstarted backlog, not silent-ship — but this sweep did not open each spec to confirm,
   so treat as a list to triage, not a list of confirmed defects.
8. **Branch sprawl**: ~75 local + ~50 remote branches. Only the one branch tied to a
   merged+clean-and-still-on-disk worktree (`task/signstrip`) is an explicit §4 trigger, so only
   that one was deleted (tagged first). The rest were census-counted, not audited or deleted — a
   full merged/stale-branch audit is real work in its own right and risks the exact false-negative
   failure mode `[[fhe-feedback-ancestor-check-insufficient]]` warns about if rushed. Recommend a
   dedicated pass, not folding it into this sweep.
9. **`docs/method/BENCH-TEST-2026-09-01.md` and `ORCH6-FOR-REVIEW-2026-09-01.md`** are dated,
   one-off review artifacts sitting in a folder §2a scopes to role/method definitions. Left alone —
   both are same-day, almost certainly still being actively read for the owner's design review right
   now ("NEVER MOVE A FILE UNDER A RUNNING THREAD"). Revisit after that review is consumed; likely
   home is `docs/reports/`.
10. **`docs/reference/` has topic-named subdirectories** (`flows/`, `lease-map/`, `leather/`,
    `insurance-decision-map/`, `navhover-frames/`, `shelved-cardstock-header/`) — the same
    "no nesting by topic" principle §2a states explicitly for `tasks/tests/reports` arguably applies
    here too. Not touched — these are established, multi-file working areas and reclassifying them
    is a bigger judgment call than a first sweep should make unilaterally.

11. **This sweep ran directly in the shared `main` working directory, and a concurrent commit landed
    mid-sweep.** While repairing references, `HEAD` moved from `911aa440` to `8b57f8c8`
    ("CR-98 A1 answered…"), committed **and already pushed to `origin/main`** by `admin@cactai.io`
    at `10:52:10`. It absorbed this sweep's already-`git mv`-staged renames (0 content diff on
    those 5 files) alongside an unrelated 40-line addition to `docs/reference/CHANGE-ORDER-LEDGER.md`
    that this sweep did not make and did not touch. Nothing was lost — confirmed the incoming commit
    touched none of the files this sweep still had unstaged edits on — but it's the live version of
    the exact risk `CLNR-ROLE.md` §3's non-negotiables gesture at for worktrees ("never move a file
    under a running thread") applying equally to a docs-only sweep sharing `main` with a live
    committer. No action taken — `CLNR-ROLE.md` doesn't currently require a worktree for docs-only
    sweeps, and this one caused no damage — but worth ORCH knowing that `main` was not quiet during
    this sweep.

## TEARDOWN + PROCESS CENSUS

- No lingering dev-server processes (`next dev`, `vite`, `npm run dev`) and no listeners on the
  common dev ports (3000/5173/4000/8080) — checked via `ps aux` and `lsof`, both clean.
- Worktree count at cap (3) — see above.
- `git status --short` at the end of this sweep shows only the moves/edits listed above, plus the
  two new files in `docs/reports/` (this report and its ledger). Nothing else pending.

## COMMIT

Everything below is staged and committed **by explicit path**, never `docs/`. Nothing pushed —
per `CLNR-ROLE.md` §6, that's ORCH's call.
