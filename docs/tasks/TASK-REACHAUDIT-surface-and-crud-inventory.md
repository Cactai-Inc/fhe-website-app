# TASK-REACHAUDIT — every surface, its reach, its CRUD, and its write paths

**Read-only. This task changes no code. Its entire output is two documents.**

---

## 1. What this serves — the owner's words

> *"This app is riddled with problems but i dont know which are real and which are because there
> is so much work that hasnt run yet."* — owner, 2026-08-18

The answer, proven in `docs/reports/OWNER-WALKTHROUGH-2026-08-18.md`, is that almost none of it is
unbuilt — **it is built and unreachable**. Eight separate instances of correct code that no route,
nav row, link or call site reaches (§0 of that report). Read that report in full before starting;
it is the calibration set for this audit (see TEST #2).

**Why this task exists:** no task has ever specified the app as a whole. Every task specified a
write path and proved that write path, so the seam between a correct function and a human who can
reach it belongs to nobody (D17). **This audit produces the inventory the project has never had.**
It is the direct input to the flow map and to every UI rebuild decision that follows. Nothing
starts on the UI until this returns.

---

## 2. What was measured (orchestrator, 2026-08-18, on main @ `ce47fa7`)

Record the main commit you audit in the report header — other threads change source while you run.

- `grep -c "path=" src/App.tsx` → **128** route attribute matches (raw; nested/index routes mean
  the true surface count is yours to establish).
- `grep -cE '^\s*\{ key:' src/lib/pageRegistry.ts` → **27** registry rows.
- `find src/pages -name "*.tsx" | wc -l` → **117** page files.

**128 vs 27 vs 117 is the gap this audit exists to explain, row by row.**

Nav truth lives in **two places, and the registry is the smaller one**: `src/lib/pageRegistry.ts`
AND hand-written JSX arrays in `src/components/AppLayout.tsx` (`StaffNavItems` ~line 415,
`ClientNavItems` ~line 1085, header icons ~line 1738). A page can have a real nav row and no
registry row (the calendar does). Audit both, always.

---

## 3. The deliverables — two files, nothing else

### 3a. `docs/reference/SURFACE-INVENTORY.md` — the durable artifact

One row per routed surface. Columns:

| column | content |
|---|---|
| **path** | the route |
| **component** | the page file |
| **registry** | registry `key`, or **NONE** |
| **reach** | `NAV:<group, source file:line>` · `LINK-ONLY:<linking page(s)>` · `URL-ONLY` · `ORPHAN` (routed, zero links in) |
| **role gate** | who can load it (from the route guard / page logic) |
| **name check** | the label a human sees, and a ⚠ flag when the label does not say what the page does (the bookings list is named *Sessions* — that class) |
| **CRUD** | which of create / read / update / delete / archive exist on the page, each with the function it calls |
| **write class** | per mutation: **ENGINE-RPC** (calls a DB function) · **RAW-TABLE-WRITE** (PostgREST `.insert/.update/.delete` straight on a table) · **MIXED** — with `file:line` for each |
| **D19 flags** | per value-moving action, four Y/N: states-itself-first · captures-reason · records-reference · undoable |
| **ledger reads** | does the page read any of `audit_logs` · `notifications` · `document_deliveries` · `status_events` · `receipt_sends`? |

Also two closing sections: **page files with no route** (dead-file candidates — list, never delete)
and **routes whose only reach is the half-retired `reviewSection.ts`**.

### 3b. `docs/reports/TASK-REACHAUDIT-REPORT.md`

Method, the 128/27/117 reconciliation, findings ranked by severity, and the standard
**flagged-not-fixed** section. Findings here means *reach/CRUD/write-path defects* — not UI taste.

---

## 4. Method — one grounding read per context, then batch judgment

Per the L3 rule: **read each shared context ONCE**, then judge every row against those reads.
Never re-open `App.tsx` per route.

1. Read `src/App.tsx` once → the route list.
2. Read `src/lib/pageRegistry.ts` once, `src/components/AppLayout.tsx` nav arrays once,
   `src/lib/reviewSection.ts` once → the reach map.
3. `grep -rn "to=\|navigate(\|href=" src/` once → the link graph (LINK-ONLY vs ORPHAN).
4. Then per page: read the page file and the `src/lib/api-*.ts` module it imports. That is the
   CRUD, write-class, D19 and ledger data.
5. `grep -rn "\.from('" src/lib src/pages` once → the raw-write candidate list to reconcile
   against step 4.

**No subagents (standing repo rule). No production DB access — this is a source audit; row counts
are not findings and the DB layer is already established as largely correct.**

---

## 5. The traps

- **Comments lie.** `pageRegistry.ts:125` says Calendar/Catalog are "parked in Review" — stale;
  both have permanent nav rows restored by `ab45b18`. Only code and git history count. A stale
  comment already caught the orchestrator once (walkthrough §5b).
- **The registry is not the nav.** 27 rows vs a much larger hand-written nav in `AppLayout.tsx`.
  A page absent from the registry can still be perfectly reachable, and vice versa.
- **A green function call is not reach.** For every surface, also confirm something links IN.
  Routed-but-unlinked is `ORPHAN`, and it is the dominant defect class here (8 known instances).
- **`reviewSection.ts` is half-retired** — its nav group was deleted (`ab45b18`, 2026-08-15) but
  9 groups / 27 slots / 5 `ops/review*` routes still ship. Classify them URL-ONLY; do **not**
  propose deletion — that teardown is item W13 and belongs to another decision.
- **D1a:** `admin@cactai.io` being denied by tenant-gated logic is CORRECT. Not a finding. Three
  threads have gotten this wrong.
- **Empty is not a finding.** Pre-launch counts are the expected state.
- **`test:db` is broken** (46 red files is the documented baseline). Cite nothing from it.
- **`assertWrote()` is a guard, not an engine.** A raw table write wrapped in `assertWrote` is
  still RAW-TABLE-WRITE.
- **CLOSEOUT runs in parallel** and will change calendar/credit/contract files under you. Audit
  main at one commit, record the hash, and do not chase its diffs.

---

## 6. OUT of scope

- **Any code change. Any fix. Any deletion.** Two new docs files are the entire diff.
- UI/design opinions beyond the `name check` column.
- Production SQL, RLS analysis, the DECIDE sheet, `api/` serverless functions (Vercel endpoints
  are actors in the upcoming flow map, not surfaces).
- Public marketing pages may be summarized in a single grouped row each — the depth belongs to
  `/app/**` and `/book/**`.

---

## 7. Constraints

- Worktree: `~/Downloads/claude-code-repo/wt-reachaudit`, branch `task/reachaudit`.
- **Do not push.** Commit with explicit paths (never `git add docs/`).
- Contended files: **none** — you create two new files and touch nothing else. If you believe a
  file needs fixing, write it in flagged-not-fixed.
- **TEARDOWN:** start no dev server, no vitest. End the report with a process census
  (`ps aux | grep -E "vite|vitest|node" | grep -v grep`) proving you left nothing running.

---

## 8. THE TEST THIS MUST PASS

1. **Every route App.tsx renders appears exactly once** in the inventory, and the report
   reconciles 128 raw matches → true route count → 27 registry rows → 117 page files, naming
   every page file with no route.
2. **Calibration: the inventory rediscovers all eight §0 instances** from
   `OWNER-WALKTHROUGH-2026-08-18.md` **from the method alone** — e.g. `/app/ops` lands as
   URL-ONLY, `/book/rider` as ORPHAN, `LessonCreditsPage` mutations as RAW-TABLE-WRITE with no
   D19 flags. **If any of the eight is missing, the method is broken — fix the method, not the
   row.**
3. Every mutation on every audited page carries a write class **with `file:line`**.
4. Every value-moving action carries all four D19 flags, each Y or N, none blank.
5. The ledger-reads column is complete for all five ledgers, and the report states which surfaces
   (if any) read each one. Near-zero is the expected answer (W11) — confirm it mechanically,
   don't re-announce it as news.
6. `git diff --stat` shows **two added docs files and zero code changes**.

---

## 9. Report

`docs/reports/TASK-REACHAUDIT-REPORT.md`. THE REACH section is N/A — this task is read-only, and
its deliverable IS the reach map.
