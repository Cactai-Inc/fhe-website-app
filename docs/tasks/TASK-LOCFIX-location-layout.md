# TASK LOCFIX — lease Location section layout defects (owner spec 2026-08-05)

Three rendering defects in the lease contract editor's Location clause (section 3.8 of
HORSE_LEASE_V2), owner-reported with screenshots. Layout only — no data model changes, no
template content changes beyond what's strictly required for the layout fix.

## The defects
1. **Address input rows are right-justified.** The "Location during lease term" composite
   input (Facility/place name, Street address, City/State/ZIP rows) renders pushed against
   the RIGHT margin. Owner wants the whole input block LEFT-aligned.
2. **Current address starts on the label's line.** "Location of the Horse: Carmel Creek
   Ranch, …" — the address value should START BELOW the "Location of the Horse:" text, not
   run on from it.
3. **"Location during lease term" prints twice.** The first printing is the correct intro
   text; the second appears on the same line as/beside it (as the field's own label render)
   and must be removed — WITHOUT the first address input row moving up onto the intro line.

## How to approach
1. Characterize first: find what renders this clause's address widgets — the composite
   address input (likely `InlineFieldControl`/`ContractCascade` machinery and/or the
   matrix-line layout in the renderer) and where the label duplication comes from (a
   "Label: {{token}}" prose pattern rendering the label AND the control echoing its own
   field label is the likely shape). State the mechanism per defect in the report before
   fixing.
2. Fix preference order: field-def/template data (e.g. blanking a redundant field label) >
   non-frozen components (`InlineFieldControl`, `ContractCascade`, `ContractPage`) >
   `ClauseDocument.tsx`, which is FROZEN — if any defect's true fix lives there, STOP and
   post the exact minimal diff for orchestrator approval before applying (precedent: the
   PURPOSEFIX approval flow).
   NOTE: a PURPOSEFIX-branch change to ClauseDocument.tsx (gateControls filter, ~line 866)
   may merge while you work — branch off current origin/main and if you must rebase, keep
   that change intact.
3. These defects likely reproduce on ANY address-bearing clause (sale template too) — fix
   generically at the rendering/label layer, not with clause-specific special cases. Say in
   the report where else the fix applies.
4. If template DATA must change (labels/body text of the Location clause), apply to the
   template defs AND to live NON-executed lease documents' per-document copies so open
   contracts (incl. Sarah's `704c8d2d-...`) render fixed — BUT: any write touching Sarah's
   document requires listing the exact statements in the report; content-neutral label/layout
   data only; zero changes to her field VALUES or state. If unsure whether a write is
   content-neutral, STOP and ask.

## Proof
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors).
- Per defect: the mechanism, the fix, and (for any DB/template change) before/after raw
  output for the affected clause rows. UI is browser-pending as usual — say so honestly.
- Update `docs/BUILD_TRACKER.md` under section A (lease editor polish) honestly.

## Rules
- Branch `task/locfix` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-locfix -b task/locfix origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB writes: only template/per-doc label-layer data fixes as scoped above +
  rolled-back proofs, all logged. Signed documents never deleted.
- Report: `docs/reports/TASK-LOCFIX-REPORT.md`, committed + pushed. Print ONLY the report
  path.
