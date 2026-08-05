# TASK COSIGN — company-as-party signing in the UI (owner priority #1, 2026-08-05)

The engine already supports this; the UI blocks it. Owner's rule: **nobody may sign a role
they aren't (representing) a party to; anyone may sign a role they are.** Staff must be able
to sign on behalf of the company when the COMPANY IS A PARTY — the owner drafting and signing
their own company's contracts is a core product requirement.

## Verified facts (trust these)
- `record_signature` (live) has an explicit company branch: when the p_party_role's signer is
  an `is_company` contact in the doc's org, a STAFF caller may sign and the signature is
  recorded with the company contact as signer. PROVEN live in TASK-A16's rolled-back proofs
  ("staff signs the LESSOR role on behalf of the company contact — completing" succeeded;
  that doc's party_signed exclusion for company-side also fired correctly).
- Sarah's real lease `704c8d2d-...`: LESSOR = Sarah (individual), LESSEE = French Heritage
  Equestrian (`352c3898-...`, is_company). The owner, as admin, cannot sign the LESSEE side in
  the UI today. THIS is the defect. (Document itself: READ-ONLY for testing — no writes; use
  the AVERIFY2 test doc `9a56b738-...` for any write proofs; its LESSEE is an individual test
  contact, so for company-side write proofs build a throwaway in-transaction contract with the
  company as a party, rolled back.)
- `approve_contract_review` already excludes company contacts from "demands review" — company
  parties don't gate approval; unrelated to signing.
- The party-side signing UI on ContractPage renders for callers whose contact matches a party
  (`my_roles` from `contract_document_detail`). Staff callers get the admin surface instead —
  characterize exactly how sign affordances are gated (my_roles computation, isStaff branches,
  signature card/CTA rendering) before changing anything.

## Work items
1. **Characterize** (read-only first): how `contract_document_detail` computes `my_roles`;
   whether a staff caller ever receives the company's roles; where ContractPage renders the
   sign CTA and every condition on it (isStaff, isOwnerSide, workflow_state, review state).
   State the exact mechanism blocking staff-signing-for-company in the report before fixing.
2. **Fix**: when the caller is staff AND a party role on the document belongs to the org's
   own company contact (`company_contact_id()` — COMPANYFIX may land a deterministic version
   while you work; use the function, not a hand-rolled lookup), the UI offers the sign action
   for that role, clearly labeled as signing ON BEHALF OF the company (e.g. "Sign as French
   Heritage Equestrian"). It calls the same `record_signature` path the party UI uses (the
   server branch handles the rest). Non-party staff signing anything else stays impossible
   (unchanged); individual parties unchanged.
   - The affordance must respect the same state rules as party signing (ready-to-sign /
     review states as the server enforces them) — mirror, don't invent.
   - If any part of the fix requires `ClauseDocument.tsx`: STOP, post the exact minimal diff
     for orchestrator approval first (it is FROZEN). Expectation: this fix lives in
     ContractPage/contract_document_detail, not the renderer.
3. **RPC change if needed**: if `contract_document_detail` must expose "company roles the
   staff caller may sign," extend its payload (CREATE OR REPLACE, carry live body forward,
   dry-run then apply, grants unchanged). Keep it read-model only.
4. **Live proof** (rolled back, simulated sessions per prior reports):
   - Throwaway in-transaction lease with the company as LESSEE + an individual LESSOR: as a
     staff session, `record_signature(doc, 'LESSEE', 'French Heritage Equestrian', ...)`
     succeeds through the exact call shape the fixed UI issues; signer resolves to the company
     contact; ROLLBACK, zero residue.
   - Negative: staff attempting to sign the INDIVIDUAL party's role is rejected (server
     already does this — show it).
   - Sarah's doc: read-only reasoned trace that the fixed UI now offers "Sign as French
     Heritage Equestrian" on the LESSEE side to the owner's admin session.
5. Update `docs/BUILD_TRACKER.md`: add this under section A (company-party signing UI) with
   honest status.

## Rules
- Branch `task/cosign` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-cosign -b task/cosign origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB writes: at most the one read-model migration + rolled-back proofs. Sarah's
  document: zero writes. Signed documents never deleted.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors) + proofs.
- Report: `docs/reports/TASK-COSIGN-REPORT.md`, committed + pushed. Print ONLY the report path.
