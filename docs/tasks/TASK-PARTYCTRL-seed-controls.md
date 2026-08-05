# TASK PARTYCTRL — seed document_party_controls at contract creation (bootstrap-deadlock fix)

Production bug, verified live 2026-08-04 by the orchestrator and independently root-caused by
the party-verify thread: **no contract starter seeds `document_party_controls`**
(`start_lease_contract_v2`, `start_sale_contract`, `add_deal_document` — all confirmed via
prosrc). The ONLY writer is `set_party_controls`, and the admin "Document controls" panel
derives its role list from `party_controls` itself (`ContractPage.tsx:1444`), as does
`invitableRoles` gating the Send button. Result: every freshly authored contract has zero
controls rows → the panel renders nothing → no UI path can create the first row → the contract
can never be configured or sent. The executed reference doc `ecaecd42-...` HAS 2 controls rows
(configured before this regressed) — use it as the reference shape.

## Locked design

Seed at creation, in the starters — do NOT widen `contract_document_detail` or add UI bootstrap
paths. One row per party role the new contract carries (however the starter determines its
parties — read each starter to see what party rows/roles it creates, and seed controls for
exactly those roles). Default permission values: read `set_party_controls` and the executed
reference doc's 2 rows; if the reference rows express the standard posture (each party may fill
their own side), use those values as the seed defaults. If the reference rows look
role-asymmetric in a way that is clearly contract-specific, then use the UI panel's initial/
default state as found in `ContractPage.tsx` — state in the report which source you used and
why.

## Work items

1. Read first, in this order: `\d document_party_controls`; the 2 reference rows on
   `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3`; `set_party_controls` prosrc; the party-creation
   section of each starter's prosrc (`start_lease_contract_v2`, `start_sale_contract`,
   `add_deal_document`). Record all of it in the report.
2. Migration: `CREATE OR REPLACE` each of the three functions, live body carried forward
   unchanged (SQLTRUTH recapture + later migrations are in git — but verify against live prosrc
   before editing, and say so), inserting the seed block after party creation. Idempotent
   inserts (`ON CONFLICT DO NOTHING` if a unique key exists on document+role; check `\d`).
3. **Backfill**: every existing non-deleted document that has document_parties (or whatever
   partyhood the starters create) but ZERO `document_party_controls` rows gets the same default
   seed — EXCEPT documents in executed/terminal states (leave history alone; they can't be
   configured anyway). List every backfilled document id in the report. If the count is large
   (>25), print the count + first 25 and proceed.
4. Live proof:
   - `BEGIN;` → call `start_lease_contract_v2` with test params (mirror how the UI calls it —
     find its call site) → verify the new document has controls rows for every party role →
     `ROLLBACK;`. Raw output in the report. Same rolled-back proof for `start_sale_contract`.
     For `add_deal_document`, a rolled-back proof if callable without a deal fixture; otherwise
     reasoned trace with the inserted block quoted.
   - Post-backfill: `SELECT count(*)` of configurable-state documents still lacking controls
     rows → must be 0.
5. Update `docs/BUILD_TRACKER.md`: add a one-line note under A2 that the party-controls
   bootstrap deadlock is fixed (do not change A2's status — the party-verify thread owns that).

## Rules
- Branch `task/partyctrl-seed` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-partyctrl -b task/partyctrl-seed origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB: allowed writes = the one migration + the logged backfill + rolled-back proofs.
- `ClauseDocument.tsx` FROZEN. No UI changes at all in this task. Signed documents never
  deleted. Dry-run the migration in `BEGIN;...ROLLBACK;` first.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors — nothing TSX should change, run them anyway) + live proofs.
- Report: `docs/reports/TASK-PARTYCTRL-REPORT.md`, committed + pushed. Print ONLY the report
  path.
