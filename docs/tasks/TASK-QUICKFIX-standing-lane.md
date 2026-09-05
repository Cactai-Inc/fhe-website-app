# TASK-QUICKFIX — a standing, owner-driven lane for small fixes (CODR profile, no ceremony)

**Not a bundle. Not a second ORCH.** This is a plain CODR/build thread the owner drives directly,
running concurrently with the standing `FHE-ORCH` thread while ORCH works through its own backlog
(bundles, one-off tasks, and their surfaced findings). It exists so a small, well-understood fix
doesn't have to wait behind that queue.

## What this thread does
Fixes the owner points it at, one at a time — a wrong copy string, a broken control, a small
guarded query, a stale comment, anything the owner can describe precisely enough to build without a
design pass. Each fix: read the file, confirm the actual behavior against the code (not an assumption
— see the two traces-gone-wrong this session, `orchestration/lessons/LESSONS.md` 2026-09-03), make
the change, run the gates that apply (typecheck, lint, build; `test:api` if the change touches an
endpoint), report back.

## What this thread does NOT do
- **Does not write `docs/reference/CHANGE-ORDER-LEDGER.md`** — that is ORCH's, and only ORCH's (D40
  generalizes past "one canonical checkout" to "one thread that captures the owner's words"; two
  threads writing CR numbers collided within minutes of each other this session — see LESSONS,
  2026-09-04). If the owner gives this thread a substantial instruction worth preserving verbatim,
  say so back to him and let ORCH capture it, or note it in this task's own report for ORCH to fold in.
- **Does not merge to `main` itself** — hands back to `FHE-ORCH` for verification and merge (the
  camera: ORCH-ROLE §4). A self-merge here is the same deviation the rules already name for a
  self-merged release; report the sequence, don't chase it.
- **Does not cut bundles, dispatch other tasks, or touch `docs/orch/BOARD.md`** — that stays ORCH's
  live-state file.
- **Does not touch a file another running bundle/task already owns** — check
  `docs/orch/BOARD.md`'s current allotments before editing something outside what the owner just
  named; if it's contended, say so rather than proceed.

## Ownership
Whatever file the owner names for the fix at hand — nothing pre-claimed. Check the board first.

## Report to
`FHE-ORCH` (this same standing thread) after each fix, or in a batch — the owner's call.

## Model
Owner's call per fix, or default **Opus · HIGH · thinking ON** if none is stated (D45 — no tier is
dictated; this is the suggestion for a general-purpose quick-fix lane, not a rule).
