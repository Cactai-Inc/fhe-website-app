# TASK PURPOSEFIX — Purpose of Agreement (and all DEAL-owned selects) must be actionable

Live defect, owner-reported 2026-08-05 twice: on the lease contract page, the Purpose of
Agreement selection ("MAKE A SELECTION") is not actionable, even after both parties on the
live documents were granted `can_edit_deal` and even though the renderer treats DEAL-owned
fields as shared (`ClauseDocument.tsx:163-170` returns true for DEAL). Server-side
`set_contract_field` permits staff and deal-edit holders, and permits workflow states
editable/editing/in_review. Something between page state and control rendering makes the
select inert.

## Facts to build on (verified)
- Field: `TXN.LEASE_PURPOSE`, select, 4 options, owner_role DEAL, required, no gate of its own.
- Clause pair: `PURPOSE.RECREATION_DEFAULT` (placeholder, gate equals [""]) renders while
  unset; `PURPOSE.RECREATION` (real sentence containing the `{{TXN.LEASE_PURPOSE}}` token)
  gates on any of the 4 values — so while unset, the select can only be offered via the
  GATED-PREVIEW rendering of that second clause (or as a gate-control/orphan field).
- Live documents to test with: `9a56b738-...` (AVERIFY2 test doc, both parties test
  identities) — use THIS ONE for all experiments. Sarah's real doc `704c8d2d-...` is a live
  negotiation: HANDS OFF except read-only queries.
- Both docs' `document_party_controls` rows already have `can_edit_deal=true` (granted
  2026-08-05 at orchestrator level).

## Work items
1. **Root-cause first.** Trace how ContractPage computes the editability flag(s) passed into
   the renderer (`cb.editable`, workflow_state gating, review states) AND how the
   gated-preview/gate-control path renders a select for a clause whose gate is unmet. Identify
   the exact line(s) making the control inert for: (a) staff view, (b) party-with-deal-edit
   view. State the mechanism in the report before fixing.
2. **Fix.** Constraints:
   - Preferred: fix in `ContractPage.tsx` / control-wiring (NOT frozen).
   - `ClauseDocument.tsx` is FROZEN: if the true fix requires touching it, STOP, post the
     exact minimal diff you propose in chat, and wait for orchestrator approval before
     applying. Do not restructure it — minimal surgical change only.
   - The fix must respect real permissions: DEAL-owned selects actionable for staff and for
     parties with `can_edit_deal`; inert (with the existing other-party affordance) otherwise.
     In-review state: editable per the server's own rule (editable/editing/in_review).
3. **Also ship the permanent seeding change (owner ruling "the deal gates nothing"):** one
   migration updating the three starters' seed INSERT (from TASK-PARTYCTRL,
   `20260804150000_seed_party_controls_at_creation.sql` bodies) to seed
   `can_edit_deal=true`, plus a backfill UPDATE for existing NON-terminal documents' controls
   rows still at false. Signed/executed docs excluded (nothing to edit). List affected rows.
4. **Live proof:**
   - Simulated party session (technique in prior reports) on the AVERIFY2 test doc:
     `set_contract_field('9a56b738-...','TXN.LEASE_PURPOSE','RECREATIONAL')` succeeds, then
     set back to '' (a real revert, logged) — proves server path.
   - UI proof is browser-pending as always — but state precisely, from the fixed code, which
     component now renders the interactive select and under which conditions.
   - Re-verify Sarah's doc READ-ONLY: confirm her controls row has can_edit_deal=true and the
     fixed UI logic would render her select actionable (reasoned trace, no writes).
5. Update `docs/BUILD_TRACKER.md` (this rides under A-lane quality; add a row under section A
   noting the defect + fix).

## Rules
- Branch `task/purposefix` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-purposefix -b task/purposefix origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB writes: the one migration + the logged revert-style proof + backfill. Sarah's
  document: READ-ONLY, absolutely no writes.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors) + proofs.
- Report: `docs/reports/TASK-PURPOSEFIX-REPORT.md`, committed + pushed. Print ONLY the report
  path.
