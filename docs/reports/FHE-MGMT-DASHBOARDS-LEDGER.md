# FHE-MGMT-DASHBOARDS — LEDGER (bundle B7, `docs/orch/BUNDLE-DASHBOARDS.md`)

**Role file:** `docs/method/MGMT-ROLE.md` (in force, D44). **Sender / hand back to:** `FHE-ORCH` (the standing thread; `FHE-ORCH-8` today).
**Opened:** 2026-09-03 · bundle tree `wt-7` · branch `bundle/dashboards` from `origin/main` @ `a1399848`; origin/main merged in at `d4d67e9f`.
**Task trees allotted:** `wt-8` (asked ORCH for two more: one for the E1/E2 lane, one for VRFY). **Escalations:** 1 of 6 closed by evidence, 1 collapsed into 2; summons for the remaining points sent to the owner 2026-09-03 (batched, §9 shape); rulings pending.
**Merge lane (board ruling 2026-09-03, overrides MGMT-ROLE §8 step 4):** MGMT never pushes `main`; MGMT pushes `bundle/dashboards`; ORCH merges bundle branches into `main`. Inside the bundle: B ENGINE first as one unit (B5 builds against it); then D→C on the header lane and E1→E2 on the registry lane after VRFY each; STOP after E1 for Claire's Ops list; E3 last; F after escalation 4.
**Model tiers (D45 — MGMT decides per dispatch):** B/C/E1/E3 Opus · HIGH · thinking ON (build inside a locked shape with migrations, RLS, and subtractive registry edits); D/E2/F Sonnet · HIGH · ON considered — decided at each dispatch; VRFY/WALKR Opus · HIGH · ON.

## RESUME
Thread          FHE-MGMT-DASHBOARDS · wt-7 · bundle/dashboards @ (see git) · porcelain must be 0
Station         CODR — dispatching FHE-TASK-DASHBOARDS-B (ENGINE) into wt-8 · summons out to the owner · contract UP to ORCH
DONE            · A merged into bundle/dashboards @ 9fcd6e6b (docs only; VALIDATION appended to TASK-DASHBOARDS-A-REPORT.md; TASK-LEDGER line; BUNDLE escalation rows 1 and 3 annotated)
                · contract docs/design/DASHBOARD-ENGINE-CONTRACT.md STABLE @ 44f7ec24 (A's commit) — on bundle/dashboards, pushed; ORCH asked to merge to main so B5 specs against §9
                · wt-8 retired to the pool (tag archive/dashboards-a-2026-09-03, detached at origin/main, clean) and re-assigned to B
IN FLIGHT       FHE-TASK-DASHBOARDS-B (Opus · HIGH · ON · wt-8 · task/dashboards-b) — awaiting the owner's launch
NEXT            (1) on the owner's rulings: record VERBATIM here + in BUNDLE-DASHBOARDS.md rows 2/4/5/6; paste ruling 4 under spec F §1b, the metric answers under spec E §1b, the page name into spec C's dispatch line; (2) on B's report: audit (ORCHESTRATOR §6: diff vs merge-base, dry-run, flagged-not-fixed) → dispatch -V (VRFY) on B → on HOLDS merge B into bundle/dashboards, push, tell ORCH (B5 builds against a merged interface); (3) then D (wt-8) and E1 (second tree) in parallel; C after D on the header lane; E2 after E1 on the registry lane; (4) after E1 merges: the STOP — summon the owner for Claire's Ops list (FIX6 step 3, his own instruction); E3 after; (5) F only if ruling 4 = in force; (6) WALKR (-W) at close on main as deployed; (7) bundle report
DECIDED         · A's contract accepted as STABLE after MGMT read it in full and re-ran its five headline production claims (all hold); one note passed to B (NULLS NOT DISTINCT needs PG15; fallback already in spec B §5)
                · escalation 1 CLOSED-BY-EVIDENCE; escalation 3 COLLAPSED into 2 — neither is put to the owner
                · the shapes (specs C §8 / D §8 / E §8 / F §8) are pointed at in the same summons as a non-question so C/D/E do not wait a second round trip; the standard also goes up to ORCH in the hand-back
                · B dispatched before any ruling: no escalation gates B (its tables ship regardless of ruling 4; the CHECK drop + seed keep both owners' boards)
                · B reads the spec and the contract by absolute path in wt-7 (they are on bundle/dashboards until ORCH merges to main); it still branches from origin/main per TASK-ROLE §5
                · routed to ORCH, not fixed: my_documents anon=X (B1 GRANTS) · AppLayout.tsx MANAGEMENT_GROUP row for the company documents page (B10 / CR-118 territory) · api/deliver-report.ts + api/reports-monthly.ts + scheduled-jobs.yml line (unowned api files — need assignment before C's email control and the auto-run exist) · registry.ts fenced-block convention → MGMT-SUPPLIES · AdminRegistryPage super-admin-only (D13 gap for every ORG/CONTACT key; B10/CR-110)
BLOCKED         C's dispatch line needs ruling 5 (page name) — builds with the recommendation "Company documents" if he defers; E1's §1b needs rulings 2 and 6b — builds the honest set if none; F needs ruling 4. B, D, E2 blocked on nothing but B's merge order.
DO NOT          · do not author specs or fix at the pass — a returned build goes back to the A lineage (a DSNR-profile task re-issues the spec)
                · do not touch AppLayout.tsx (B10), supplies data/content (B5), requests inbox content (B6), page_events/client_errors (B4), the tasks/reminders substrate (no CR), messaging convergence (after T3), the scheduler (B11), api/** (unassigned)
                · do not add columns to the contract-system `documents` table (signing freeze); reports are never documents rows (contract §1)
                · do not push `main` — push bundle/dashboards only
                · do not merge a build without a TASK-<ID>-VERIFICATION.md verdict of HOLDS; do not let a self-arranging surface be reported as "missing an editor" (D13 exception) — but hold element config (F) to D13 via ruling 4
                · do not let E3 (Ops) be built from a guess — the owner's list or nothing (FIX6 step 3)
                · do not summon the owner for anything not pre-registered; everything else → ORCH
                · do not re-run `git diff origin/main..task/x` — origin/main moved past A's base; diff against the merge-base (phantom deletions otherwise)
                · `grep --include=*.sql` fails in zsh unquoted — quote patterns

## LOG
- 2026-09-03 · claimed wt-7 (detached at 7fcf2188, porcelain empty) → `bundle/dashboards` tracking origin/main @ a1399848; clean run. wt-8 verified idle and assigned to A.
- 2026-09-03 · handoff check (MGMT-ROLE §7): every row present. **Not sent back.** Board ruling on push mechanics (MGMT pushes branch, ORCH merges) adopted.
- 2026-09-03 · facts for A: `_waiting_items` trio has NO creating migration on `main` (applied from unmerged `b9bc9edc`); 04-OPEN §1/§2 already ANSWERED. Dispatched FHE-TASK-DASHBOARDS-A (Fable · HIGH — before D45 was recorded; D45 now governs every later dispatch).
- 2026-09-03 · A handed back: contract STABLE @ 44f7ec24; specs B–F; handoff; plan revisited; DAYSHEET archived. MGMT re-ran on prod: 2 owner ADMIN logins · `_waiting_items` trio authenticated-only · `my_documents` anon=X (flagged) · `reports` bucket empty · 2 org files · no new tables yet · CHECK present. Dry-run merge clean; diff vs merge-base 84e3a960 = docs only. origin/main (d4d67e9f) merged into bundle/dashboards first (ORCH had merged the bundle's opening commit + CR-116/117/118 + D45).
- 2026-09-03 · merged task/dashboards-a → bundle/dashboards @ 9fcd6e6b; VALIDATION appended; TASK-LEDGER line; bundle escalation rows 1 (closed by evidence) and 3 (collapsed into 2) annotated.
- 2026-09-03 · wt-8 retired (archive tag, detached at origin/main, clean) and re-assigned to B. Dispatched FHE-TASK-DASHBOARDS-B (Opus · HIGH · thinking ON — D45 reason: a build inside a locked shape; migration + RLS + adapter refactor with a byte-identical render test; Fable not required). Summons (points 2, 4, 5, 6a/6b/6c) sent to the owner; contract + routed items + tree request sent up to ORCH.

## TEARDOWN (running)
- Census 2026-09-03 at open and at A's merge: no node/vite/vitest/esbuild/browser/psql processes belong to this thread (psql calls were one-shot). Nothing started by MGMT.
