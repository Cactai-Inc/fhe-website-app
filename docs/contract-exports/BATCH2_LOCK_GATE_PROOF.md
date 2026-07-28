# Batch 2 — Lock-gate enforcement proof (2026-07-27, rolled-back transaction)

Requirement (authoring thread, Decision 3 hardening): the lock step must refuse
to lock any instrument with LESSEE.PARTY_TYPE, the medical election, or the
mortality election unset, so a fallback body can never appear in an executed
document.

## Finding: enforcement already exists at BOTH gates — no new machinery needed

1. **Lock transition** (`advance_document_workflow` → `locked`): refuses while
   any required, currently-visible field is empty
   (`cannot lock: N required field(s) still empty`).
2. **Direct sign path** (`lock_and_sign_contract` from `editable`): same
   refusal with an even stricter (visibility-blind) count.
3. `executed` is reachable **only** through `record_signature`; a state-sync
   trigger (`trg_documents_sync_workflow`) prevents manual workflow flips.

Batch 2 completes the chain by marking the gate fields `required = true`:
`LESSEE.PARTY_TYPE`, `TXN.MORT_ELECTED`, `TXN.MED_COVERAGE`, `TXN.GL_POSTURE`,
`TXN.GL_DED_RESP`. Their host clauses are unconditional, so they always count
when empty.

## Demonstration (fresh draft via start_lease_contract_v2, all rolled back)

- Party-type derivation: Lessee = FHE (company contact) →
  `LESSEE.PARTY_TYPE = [ENTITY]` auto-filled at creation; override remains
  possible; a person contact derives INDIVIDUAL. Derivation fills blank values
  only — a manual override is never overwritten.
- Lock attempt with gates unset →
  `ERROR: cannot lock: 8 required field(s) still empty`
  (blocking list included TXN.GL_DED_RESP, TXN.GL_POSTURE, TXN.MED_COVERAGE,
  TXN.MORT_ELECTED + the pre-existing required deal fields).
- After setting all required fields → `lock result: locked`,
  `final state: locked`.

Conclusion: an instrument with any of the three elections unset cannot reach
`locked`, and therefore cannot reach `executed` — the conditional fallback
bodies (individual reps, "No mortality insurance…", medical Option A) can only
appear in an executed document as explicit selections.
