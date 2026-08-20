# TASK-FLOWMAP — REPORT

**Run 2026-08-20 · branch `task/flowmap` (worktree `wt-flowmap`) · base main @ `c56559e`**
(the task doc was written at `8186b47`; main moved before the run — every output header
records `c56559e`). **Read-only: zero code, zero migrations, `SELECT`-only against prod.**
Commits: `5066de4` (Phase 1) · `492adda` (Phase 2) · `a2e17c4` (Phase 3) · this one.
THE REACH and THE TELL are N/A per the task doc — the deliverable IS the map.

## Deliverables

- `docs/reference/FLOW-MAP.md` — register (20 flows), actor register (11 human roles,
  11 system actors incl. all 5 crons), area crossings with named seams, 8 cross-flow
  findings, incumbent disagreements.
- `docs/reference/flows/{onboarding,booking,contracts,fulfilment,commerce,staff-ops}.md`
  — the sequences, all in the §4b record (TRIGGER/ACTORS/PRECONDITION/SEQUENCE with
  what-each-party-sees/NOTIFIES/TERMINAL/VARIANTS/BREAKS).

## Method (as specced, §6)

One grounding read each: the four incumbents + SURFACE-INVENTORY; all 34 `api/`
endpoint headers; ONE psql pass for the trigger map (128 non-internal public-schema
rows at trace time vs the task's 133 measured at `8186b47` — main and prod both moved;
the delta was not chased). Then forward traces from entry surfaces into `src/lib/**`,
into prod function bodies (`pg_get_functiondef`), reading a body only when a flow
reached it. Terminal states verified by batch `SELECT` counts. No subagents, no writes,
no browser, nothing signed.

## What was absorbed from each incumbent

- **FLOWTRACE** — Phase 1's spine, carried with per-claim re-verification. Four of its
  headline defects are FIXED since (items 5/7/10/12 — PAYLOCK, the credit picker,
  `status='pending'`, unit_count minting; each proven from the live function body);
  items 1/2/4-booking-step/11-refusal/timezone stand and are cited where they live.
- **RETEST-CHECKLIST** — adopted as ordering authority; no order disagreement found;
  UNPROVEN entries point at its steps instead of restating them.
- **DUAL_IDENTITY_TRACE** — cited as the variant rule on F1/F7/F19; no drift found.
- **FLOW-PROGRAM-WAVES** — used for dating and for the standing timezone/mixed-cart
  findings only.
- **CLOSEOUT/CONTRACTWALK** (adjacent incumbents) — CLOSEOUT's eight fixes taken as the
  current truth of the lease flow after spot-verifying §1.7's trigger predicate and the
  one-gate delegation in prod bodies; CONTRACTWALK used for the client's-eye walk, its
  A1–A3 marked closed.

## The mandated resolution: `deal_autocomplete_on_execution`

**It fires — on one of the two execution paths — and has never yet had anything to fire
on.** Proof chain (fulfilment.md F14 step 3): trigger def is
`AFTER UPDATE OF workflow_state ON documents`; `record_signature`'s execution UPDATE
names `workflow_state` in its SET list (prod functiondef line 106), so every
contract-engine execution arms it; CLOSEOUT §1.7's rolled-back walk shows the envelope
follow (`draft → executed`). `sign_release` executes via a status-only UPDATE, so the
kiosk path **skips** it (and `apply_contract_execution_effects` +
`snapshot_execution_audit` with it) — Postgres column-list semantics, new finding X4.
Production has 0 `deals` and 0 `contracts` rows, so "has it ever fired live" is
answered by absence of use, not absence of wiring. CONTRACTWALK's "trapped in a branch
that never runs" is superseded by migration `20260819T0140` and must not be carried
forward.

## Findings, ranked

1. **X1 — no cron has ever demonstrably run** (five schedules, five dependent flows,
   zero observed effects; sharpest tell: 46 notifications, 0 `emailed_at` in history).
2. **X2 — the unpaid-everything deadlock** (4 purchases, all unpaid, 0 payment keys →
   every paid-gate in the app is data-dead: month-roll, Zelle matching, receipts).
3. **X3 — write-only ledgers** — seven audit/send tables, one reader surface. The
   owner's "what is she seeing" question has a table and no screen.
4. **X4 — `sign_release` skips the execution triggers** (no audit snapshot for any
   kiosk-signed document; latent trap for future status-only executors). NEW.
5. **F3-BREAKS-1 — `/release` alerts nobody at all now** (no request row, no email;
   sharpened from FLOWTRACE §12). NEW evidence: prod `sign_release` body has zero
   `requests` references; `Release.tsx` never calls `submitRequest`.
6. **X5 — silent refusal** of member bookings (unnotified hard DELETE) — the surviving
   half of FLOWTRACE item 11.
7. **X7 — unreachable front doors** (`/sign/*`, `/app/ops`, `/app/gifts`) — flow-level
   confirmation of REACHAUDIT's class.
8. **X6 — no tenant timezone** (standing, 12 functions).
9. **X8 — status-vocabulary drift** (`invitations.accepted` vs writers' `redeemed`;
   booking events as `entity_type='offering'`). NEW half, small but audit-rotting.
10. **F2-BREAKS-2 — a successful self-onboarding is invisible to staff** (only the
    failure path escalates). NEW.

## Flagged, not fixed

Everything above — this task changes nothing by charter. Two items deserve immediate
owner attention because they are one query away from resolution: X1 (open the Vercel
cron logs once) and X2 (make one real payment through the PAYLOCK-fixed path).
No code diffs are proposed; fixes are specced after, per §7's last trap.

## The test this must pass — answered

1. All five named flows complete in Phase 1, every §4b field filled, no blank BREAKS or
   what-each-party-sees ✅. 2. Every entry surface cites an inventory row; steps cite
   file:line or RPC names ✅. 3. All 5 crons appear as actors with flows (register §2) ✅.
4. `deal_autocomplete_on_execution` resolved with proof, both directions ✅. 5. Incumbent
claims re-verified at `c56559e` or marked inherited — the fixed-since list is explicit
(FLOW-MAP §5) ✅. 6. Every register status justified; every UNPROVEN names its proof
(a browser step, a real send, a cron observation — most point at RETEST steps or the
Vercel dashboard) ✅. 7. `git diff --stat` across the four commits: **7 documents, zero
code, zero migrations** ✅.

## Teardown

No dev server started, no vitest run, psql invocations were one-shot (no held
sessions). Process census at close:

```
ps aux | grep -E "vite|vitest|node|psql" | grep -v grep   → (output in final commit message: empty)
```
