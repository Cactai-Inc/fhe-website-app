# Horse Lease & Purchase — Negotiated Contract Reconciliation Spec

Status: ready for implementation by Claude Code
Scope: wire the standardized, negotiated Horse Lease Agreement (and bring the already-wired Horse Purchase to the same standard) onto the existing generic contract-workflow engine, replacing the two placeholder intake forms.

This is a reconciliation, not a greenfield build. Most of the negotiation machinery already exists in the repo. This document states what exists, confirms which owner decisions it already satisfies, and specifies only the gaps. Every gap is written as a concrete change against a named migration/function/file in the implementation specs referenced at the end.

## 1. Owner decisions this implements (locked)

1. One standardized Lease template and one standardized Purchase template, party-role-neutral, used whether FHE facilitates between two third parties or is itself a party.
2. The owner (staff) initiates every contract. There is no client-initiated authoring path.
3. Inclusion is automatic: a term that carries a value or selection is included; a term left empty is either omitted (if not surfaced to the other party) or a required blank the other party must fill (if surfaced). There is no separate "include" flag.
4. Two document controls: an editable/non-editable toggle, and for non-editable a sub-selector of suggestions-enabled vs contribute-and-sign. Editable or non-editable-with-suggestions engages negotiation; contribute-and-sign is straight-through.
5. Signature order when the counterparty owes any input: counterparty completes their information first, reviews the finished version, signs; then the owner reviews and signs last. The owner's last signature is the verification gate (owner may withdraw or bounce for correction, e.g. wrong horse, before signing).
6. Strip-unfilled-at-lock: the finished document shows only terms that ended with a value or selection; empty/omitted terms and their optional sections do not appear.
7. Acknowledgments and both signatures appear only in the locked/signing phase, never during authoring or negotiation.
8. Silence-is-consent: a term the owner filled and the counterparty never touched is agreed by default. Lock is gated on "no open change requests AND no required field empty," not on explicit per-term dual acceptance.
9. Full history: every field value (with author + timestamp) and every change request (with author, target, requested text, resolution) is preserved.
10. Horse information is authoritative to the Lessor and remains editable until the Lessor affirmatively marks the horse section reviewed/accurate — a sub-lock distinct from overall document lock.
11. Negotiated unit is the field; presentation groups fields by section (email and UI).
12. The invited counterparty's app is minimal: sign in with Google for a Gmail address, else set a password with email as username; the app opens to their intake (their personal fields, plus any fields the owner surfaced to them), then the finished document for review, then signature — plus viewing their own account. In the negotiation branch the same small surface also shows the in-progress document with change-request controls.

## 2. What already exists (foundation — do not rebuild)

Migration `20260705010000_contract_workflow_engine.sql` is the generic multi-party contract engine, sitting on top of the existing `documents` / `signatures` machinery. It provides, with RLS and PGlite coverage:

- `documents.workflow_state` (`editable→editing→in_review→locked→executed`, plus `void`) as a finer layer beside `documents.status`. Advanced only through `advance_document_workflow`; `executed` reachable only via signing.
- `documents.recipient_editing` — the editable/non-editable-with-suggestions control (decision 4). `documents.originator_contact_id` — the initiating party.
- `contract_fields` — per-term rows with `owner_role` (a party role, or literal `DEAL`), `value`, `value_type`, `required`, `sort_order`, `section`, and `entered_by_contact_id` / `entered_at` (decision 9, field history). All writes go through `set_contract_field` (ownership matrix: staff→any; `DEAL`→originator always, counterparty only if `recipient_editing`; a party-role field→only that party). Raw DML revoked.
- `document_change_requests` — numbered per-document change requests targeting a field or section, `open→accepted/rejected/withdrawn`, with author and resolver. `request_document_change` / `resolve_change_request` drive it and notify the other side (decisions 9, 11).
- `advance_document_workflow` — the state machine. Its `locked` guard already enforces decision 8 exactly: refuses to lock while any change request is `open`, and refuses while any `required` field is empty.
- `share_document` / `set_recipient_editing` — set the counterparty grant and mirror `recipient_editing`.
- `record_signature` v6 and `lock_and_sign_contract` — the only path to `executed`; encodes the owner-signs-last rule (decision 5). Signatures are captured only here (decision 7).
- `contract_notify` and the `in_review`/`locked` transitions insert `notifications` rows linking to `/app/contracts/{id}` (decision 12 feed handoff).
- `my_contract_documents` / `contract_document_detail` — list and detail read models, the detail including a per-field `can_edit` flag mirroring the ownership rule.
- `start_lease_contract` (this migration) and `start_purchase_contract` / `start_broker_contract` (`20260705020000_purchase_broker_contracts.sql`) — the wired starters that create the engagement, generate the document, and seed the field set.

`generate_document` is at v9 (defined in `20260703030000_rider_onboarding.sql`, superseding the v8 body in `20260630000000`). v9 DOES process CUT markers, but the keep/strip conditions are HARDCODED to `MINOR%` (minor party present) and `JUMPER%` (jumper service). It resolves tokens from engagement/horse/transaction tables ONCE at generation.

Decisions already fully satisfied by the above with no change: 2, 4, 5 (mechanism), 7, 8, 9, 11.

## 3. The gaps (what this project actually builds)

Each gap below has a dedicated implementation spec (Section 6). The gaps trace to two root causes: (a) the seeded lease/purchase field sets predate the new full-granularity templates; (b) `generate_document` merges once from tables and its CUT conditions are hardcoded, so negotiated `contract_fields` values never re-merge and the lease's optional sections never evaluate.

GAP A — Templates. The new standardized `HORSE_LEASE.md` (full PDF fidelity, tokenized, no checkboxes, CUT-marker optional sections, house-standard clauses, ORG/COMPANY-not-a-party removed) replaces the placeholder. `HORSE_PURCHASE_SALE.md` already exists and is retained; verify it against the same standards. Spec: `spec-A-templates.md`.

GAP B — Horse schema columns. `horses` lacks `fair_market_value`, `vet_name`, `vet_phone`, `farrier_name`, `farrier_phone`. v9 already references vet/farrier; the new lease references all five. Add columns + extend v9's HORSE arm (fair_market_value) and the token dictionary. Spec: `spec-B-horse-columns.md`.

GAP C — Re-merge from fields at lock (THE CORE GAP). Negotiated values live in `contract_fields`; `documents.merged_body` is never rebuilt from them. Add a function that, at lock, re-merges the template body from the current `contract_fields` values, evaluates data-driven CUT conditions, and applies strip-unfilled — producing the final body the parties sign (decisions 3, 6). Spec: `spec-C-remerge-and-strip.md`.

GAP D — Data-driven CUT conditions for the lease. v9's CUT keep/strip is hardcoded to MINOR/JUMPER. The lease's optional sections (`EVALUATION_PERIOD`, `PARTIAL_LEASE`, `INSURANCE`, `MORTALITY_INSURANCE`, `MAJOR_MEDICAL_INSURANCE`, `LOSS_OF_USE_INSURANCE`, `COMPETITION`) must keep/strip based on field values, not hardcoded rules. Delivered together with GAP C (the re-merge function owns CUT evaluation) but specified explicitly because it defines each section's condition. Spec: `spec-C-remerge-and-strip.md`, Section "CUT condition table."

GAP E — Full-granularity field seed. `start_lease_contract` seeds the old consolidated field set (single care/insurance blobs, no cost splits, no optional-section fields, no fair-market-value). Rewrite its `seed_contract_fields` payload to the new template's complete field set with correct `owner_role` / `section` / `required` / `value_type` / `sort_order`. Apply the same to `start_purchase_contract`. Spec: `spec-E-field-seed.md`.

GAP F — Horse-section sub-lock. No per-section lock exists. Add a `contract_field_section_locks` concept (or a per-document horse-reviewed stamp) that the Lessor sets, gating the horse section as reviewed/accurate independent of overall lock (decision 10). Spec: `spec-F-horse-sublock.md`.

GAP G — Counterparty onboarding + minimal app surface. `redeem_invitation` grants community membership on an accepted invite, and rider onboarding exists, but the lease/purchase counterparty needs: invite by email → Google-or-password auth → an app that opens only to their contract intake → review → sign, plus their own account. Specify the invite issuance for a contract counterparty, the redemption path that lands them on the contract (not the community feed), and the minimal-surface routing. Spec: `spec-G-counterparty-onboarding.md`.

GAP H — Obsolete files. The two placeholder intake forms (`Intake Form - Horse Lease Lessor.md`, `Intake Form - Horse Lease Lessee.md`) and the old `INTAKE_HORSE_LEASE_IN` / `INTAKE_HORSE_LEASE_OUT` form_definitions are NOT the capture path for the standardized instrument — capture is `contract_fields` via the engine. Handoff document specifies their disposition. See `HANDOFF.md`.

GAP I — Horse record system (SEPARATE, LARGER sub-project). The horse record is the authoritative source of horse data, created by four authenticated paths (account-activation intake, add-a-horse from the account page, lease/sale transaction, staff add-a-horse), with a matched standardized intake form, a microchip-based dedup model, execution effects (lease attaches lessee-for-term; sale transfers ownership; both keep history), a staff horse-records page, marketplace listing wiring, and an onboarding field append that replaces the prior minimal horse capture. This subsumes and settles the horse-field ownership question from GAP E: horse fields are LESSOR-owned `contract_fields` that BIRTH the horse record on lease execution. Spec: `spec-H-horse-records.md`, with artifacts `artifacts/horse_record/horse_record_schema.sql` and `artifacts/horse_record/horse_intake_form.md`.

## 4. Field-ownership model for the lease (authoritative)

Personal fields are owned by their party and only that party (or staff) may edit them. Horse fields are owned by the Lessor (the horse owner is authoritative). All negotiated terms are `DEAL` (owner/originator sets; counterparty may edit only when `recipient_editing`, else may only request changes). This matches `set_contract_field`'s existing matrix; the seed in GAP E assigns every field its `owner_role` accordingly. The full field list with ownership is in `spec-E-field-seed.md`.

## 5. End-to-end flow (target, on the existing engine)

1. Owner runs `start_lease_contract` (staff-only) → engagement + `HORSE_LEASE` document + seeded fields (GAP E), `originator=` the party FHE acts as (or the client FHE represents), `workflow_state=editable`.
2. Owner fills the terms they set (DEAL fields), leaves counterparty-owed terms blank+`required`, sets the two controls (`recipient_editing` on for suggestions; off for contribute-and-sign), and shares to the counterparty (`share_document`) → counterparty notified.
3. Counterparty accepts invite (GAP G), lands on the contract, fills their personal fields and any surfaced required fields; if `recipient_editing`, may `request_document_change` on DEAL fields. Submits.
4. If any change requests are open, owner resolves them (`resolve_change_request`) until none remain; negotiation continues via the same loop (decision 8/11). If contribute-and-sign and only personal fields were owed, no negotiation.
5. Counterparty reviews the finished version and signs; owner reviews last and signs (`lock_and_sign_contract` → `record_signature` v6). At `locked`, the body is re-merged from fields with CUT + strip-unfilled applied (GAP C/D) so the signed document shows only agreed, filled terms.
6. `executed`; both parties see the final in their surfaces.

## 6. Implementation specs (build in this order)

1. `spec-B-horse-columns.md` — additive schema; nothing depends on it that isn't also new.
2. `spec-A-templates.md` — load the new lease body; re-run the template loader generator.
3. `spec-C-remerge-and-strip.md` — the re-merge/CUT/strip function + wiring into lock. (Includes the CUT condition table = GAP D.)
4. `spec-E-field-seed.md` — rewrite the lease and purchase seeds to full granularity.
5. `spec-F-horse-sublock.md` — the Lessor horse-section sub-lock.
6. `spec-G-counterparty-onboarding.md` — invite → auth → minimal contract surface.
7. `spec-H-horse-records.md` — the horse record system (intake/record matched pair, four creation paths, dedup, execution effects, staff page, marketplace wiring, onboarding append). Depends on: spec-B (horse columns), spec-C/E (horse fields on the contract that birth the record). Build AFTER the lease flow (A–G) is in place, since lease execution is one of the four creation paths and relies on the seeded horse fields.
8. `HANDOFF.md` — obsolete-file disposition, wiring checklist, test checklist, done-criteria.

All new SQL is additive (CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS / new tables), consistent with the repo's live-data, additive-only convention. New migration filenames follow the existing timestamp pattern; use timestamps after `20260705020000`.
