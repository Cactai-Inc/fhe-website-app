# Spec F — Lessor Horse-Section Sub-Lock

Goal: the horse section is authoritative to the Lessor and stays editable until the Lessor affirmatively marks it reviewed/accurate — a per-section confirmation distinct from the overall document lock (owner decision 10). The Lessee may pre-fill horse fields if they have the info, but the Lessor is the source of truth and must confirm before the document can lock.

## F.1 Design choice
Implement as a per-document, per-section confirmation stamp rather than a full generic section-lock table (only one section needs it now; keep it simple, extend later if needed).

Add to `documents` (additive):
```
ALTER TABLE documents ADD COLUMN IF NOT EXISTS horse_section_confirmed_at   timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS horse_section_confirmed_by   uuid REFERENCES contacts(id);
```

(If Claude Code prefers a generic design for future sections, create `contract_section_confirmations(document_id, section, confirmed_by_contact_id, confirmed_at, UNIQUE(document_id, section))` with the same RPC semantics below. Either is acceptable; the two-column form is the minimum.)

## F.2 RPC: `confirm_horse_section(p_document_id uuid)`
SECURITY DEFINER, `search_path=public`. Authorization: the caller must hold the LESSOR party role on the document's engagement (use `caller_party_roles(p_document_id)` and check for 'LESSOR'), OR staff of the org. Behavior:
- Require the document be `editable`/`editing` (can't confirm a locked/executed doc's section — it's moot).
- Set `horse_section_confirmed_at = now()`, `horse_section_confirmed_by = current_contact_id()`.
- Return the stamp.

Provide the inverse `reopen_horse_section(p_document_id)` (LESSOR or staff) that nulls both columns — used when a horse field is edited after confirmation (see F.4).

## F.3 Gate lock on horse-section confirmation
In `advance_document_workflow`, extend the `p_to='locked'` guards: in addition to "no open change requests" and "no required field empty," require `horse_section_confirmed_at IS NOT NULL`. Error message: "cannot lock: the horse information has not been confirmed by the Lessor." This makes the sub-lock a lock precondition (decision 10).

Also add the same check in `lock_and_sign_contract`'s straight-from-editable path.

## F.4 Auto-reopen on horse-field edit
When any `HORSE.*` field is edited via `set_contract_field` after confirmation, the confirmation must be invalidated so the Lessor re-confirms the changed info. In `set_contract_field`, after a successful UPDATE, if the field's `owner_role='LESSOR'` and its `field_key` begins with `HORSE.` and the document has a non-null `horse_section_confirmed_at`, null the two confirmation columns (and optionally notify the Lessor to re-confirm). This enforces "stays editable until the Lessor locks that section by editing, adding, or clicking reviewed."

## F.5 Read model
Add `horse_section_confirmed_at` / `horse_section_confirmed_by` to `contract_document_detail`'s `document` object so the UI can show the horse section's confirmation state and render the "I reviewed the horse information; it is accurate and complete" control to the Lessor.

## F.6 Acceptance
- A lease cannot lock until `confirm_horse_section` has been called by the Lessor (or staff).
- Editing any `HORSE.*` field after confirmation clears the confirmation and blocks lock until re-confirmed.
- The Lessee filling horse fields does NOT set the confirmation (only LESSOR/staff can).
