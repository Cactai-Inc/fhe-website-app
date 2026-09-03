# TASK-METHOD-MGMT — REPORT

**CLNR: not run as a sweep.** This task moved nothing and wrote only new files; the canonical
checkout carried an untracked `docs/reports/FHE-TASK-TACKROOM-LEDGER.md` from a live thread, left alone.

## 1. Headline
Three files authored in `docs/method/` from `MGMT-DESIGN-BRIEF-2026-09-02.md`, each carrying a
**NOT IN FORCE** banner: `MGMT-ROLE.md` (372 lines, a role file in the shape of `ORCHESTRATOR.md` and
`TASK-ROLE.md`), `VRFY-PROFILE.md` (135, a profile in the shape of `CODR-PROFILE.md`),
`WALKR-PROFILE.md` (127, same). Commit `4c9a1bb2` on `task/method-mgmt` in `wt-5`. Nothing pushed.
**Nothing is in force until ORCH records the MGMT model as a D-rule.**

## 2. The read-back (TASK-ROLE.md § FIRST ACT — recorded here, since the thread is non-interactive)
Understood the task as: turn the brief's five sections into (a) one role file for a standing-per-bundle,
Fable-tier intermediary that inherits ORCH's discipline scoped to one bundle, and (b) two TASK
profiles. Would change: three new files. Would not change: any existing role file, `CLAUDE.md`,
the board, the brief. That is what was done.

## 3. Premises re-verified (TASK-ROLE.md § SECOND ACT)
- Every path the three files cite exists on `main` at `b846b227` (scripted check; the only miss was
  this report, now written). `FLOW-MAP.md`, `MODEL-CHOICE-NOTES-2026-09-01.md`, `CHANGE-ORDER-LEDGER.md`,
  `TASK-LEDGER.md`, `BOARD.md`, `TASK-WALK4-REPORT.md` all confirmed.
- The brief says WALKR walks "real surfaces + real DB". Verified that a precedent exists for walking
  with a staff login and a `WALKTEST` fixture (`TASK-WALK4-REPORT.md` lines 1–25, purge list §32), so
  WALKR cites the precedent rather than inventing a credentials rule.
- The prompt's `cd` line pointed at the canonical checkout; the board (line 11) assigns METHOD-MGMT
  to `wt-5`, and D40 gives the canonical checkout to ORCH. Followed the board. D36 guard on `wt-5`:
  detached, `git status --porcelain` empty, `.env` pair present.

## 4. Flagged, not fixed
- `ORCHESTRATOR.md` §0b's table still lists `RNR` as "always running" and `DISCO` as a thread; §0z
  supersedes it in prose only. Not this task's file.
- `CLNR-ROLE.md` §2b names "all four" roles; the roster is now six profiles plus two thread kinds.
  Not this task's file.
- `TASK-ROLE.md` § WHERE YOU SIT still says "YOU HAND TO `ORCH` … ORCH writes `TASK-<ID>-VERIFICATION.md`";
  under MGMT the writer is VRFY and the approver is MGMT. Needs a one-line amendment when ORCH records.

## 5. Decided that the brief did not decide — each marked "ORCH ratifies" in the file
| # | Decision | Why, from the repo's own idiom |
|---|---|---|
| 1 | **MGMT merges on a `bundle/<name>` branch in its own worktree and pushes `bundle/<name>:main`; it never writes the canonical checkout** (MGMT-ROLE §8) | D40 gives the canonical checkout one writer, ORCH. Serializing every MGMT through that slot recreates the collision D40 was written against. Disjoint bundles (guard 1) make the fetch-merge-push loop conflict-free by construction; a conflict is guard 1 failing and escalates |
| 2 | **The board stays one file; each MGMT owns one `## BUNDLE <NAME>` section** (§10) | brief §2: "the board stays the single right-of-way map". Disjoint hunks merge clean; ORCH fetches |
| 3 | **Bundle handoff lives at `docs/orch/BUNDLE-<NAME>.md`** (§7) | CLNR §2a: `docs/orch/` is every ORCH handoff and brief |
| 4 | **Respawn naming `FHE-MGMT-<BUNDLE>-2`** (numbers, ORCH-style) | MGMT is a successor of a standing thread, not a sibling task; D37 letters are for sibling tasks |
| 5 | **`-V` and `-W` reserved on every lineage for the verifier and the walk** | D37's lettering, with two letters fixed so the verifier and walk are findable by name across lineages |
| 6 | **VRFY writes `TASK-<ID>-VERIFICATION.md`; MGMT appends `## VALIDATION` citing it** | keeps the two files ORCHESTRATOR §4a already requires; only the author of one changes |
| 7 | **VRFY checks out the task branch DETACHED in its own tree** | git refuses a second checkout of a branch; detached also makes "changes nothing" mechanical |
| 8 | **Walk findings are intake in the walk report; MGMT carries them up; ORCH files them** | THE-RUNNING-RECORD §4: one home each; the change-order ledger is ORCH's to write |
| 9 | **Escalation summons format and the "everything not pre-registered goes to ORCH" table** (§9) | brief §1's "summoned … never a re-run discussion" plus ORCHESTRATOR §0a "escalate patterns, not incidents" |
| 10 | **MGMT at Fable · HIGH; VRFY Opus · HIGH (Sonnet for a re-run); WALKR Opus only** | brief §1 "on your level of capability"; MODEL-CHOICE-NOTES; WALK4's findings all required judgement |

## 6. Where the brief was wrong or silent
- Silent on push authority. Decided (§5 #1) rather than left as a question, because the repo's own
  words ("merged work that sits unpushed is work at risk") answer it.
- Silent on how MGMT writes the board without the canonical checkout. Decided (§5 #2).
- Silent on the walk's credentials. The precedent answers it; the file points at the dispatch.

## 7. Gates
Docs-only. `typecheck` / `lint` / `build` not run — no code changed.

## 8. Owner render checklist
None — nothing renders.

## 9. TEARDOWN
No servers, browsers or scratch worktrees started. `wt-5` holds `task/method-mgmt`, clean, for
ORCH to merge (docs-only; `FHE_ALLOW_CODE` not needed). Ledger: `docs/reports/FHE-TASK-METHOD-MGMT-LEDGER.md`.
