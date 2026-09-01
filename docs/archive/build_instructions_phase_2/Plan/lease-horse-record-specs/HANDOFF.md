# Handoff — Standardized Negotiated Lease & Purchase

Audience: Claude Code, implementing against the FHE web app repo.
Companion documents: `00-RECONCILIATION-SPEC.md` (why + what exists), `spec-A` through `spec-G` (each gap), `artifacts/` (the new template + the obsolete forms for reference).

Read `00-RECONCILIATION-SPEC.md` first. It establishes the single most important fact: the negotiation engine already exists (`20260705010000_contract_workflow_engine.sql` + `20260705020000_purchase_broker_contracts.sql`). You are NOT building it. You are (1) replacing the lease template, (2) closing a small set of wiring gaps so negotiated field values and optional sections actually reach the signed document, (3) adding a horse sub-lock, (4) adding contract-counterparty onboarding, and (5) retiring obsolete placeholder files.

## 1. Build order (each step is additive; use migration timestamps after 20260705020000)

1. Spec B — add `horses` columns (fair_market_value, vet/farrier name+phone). Foldable into step 3's generate_document replacement.
2. Spec A — replace `supabase/contract_templates/HORSE_LEASE.md` with `artifacts/contract_templates/HORSE_LEASE.md`; re-run `node scripts/build-template-load-migration.mjs`; add the forward re-assert migration so production picks up the new body.
3. Spec C — add `remerge_contract_from_fields(document_id)` (re-merge from `contract_fields` + data-driven CUT + strip-unfilled), wire it into the `locked` transition in `advance_document_workflow` and into `lock_and_sign_contract`. Fold Spec B's FAIR_MARKET_VALUE arm into the same generate_document CREATE OR REPLACE if you touch it. THIS IS THE CORE STEP.
4. Spec E — rewrite the `start_lease_contract` field seed to the full template field set with correct ownership; verify `start_purchase_contract`'s seed against its template.
5. Spec F — add the Lessor horse-section sub-lock (confirm/reopen RPCs, lock gate, auto-reopen on horse-field edit, read-model field).
6. Spec G — contract-counterparty invitation + redemption + minimal app surface.
7. Spec H — the horse record system: extend `horses` + add `horse_relationships` / `horse_reconciliation`; the standardized intake + `create_horse_record` with microchip dedup; execution effects (lease attaches lessee-for-term, sale transfers ownership); onboarding field append; staff horse-records page; marketplace listing wiring. Build AFTER A–G (lease execution is one of the four creation paths).

Steps 1–5 are backend/migration + generator work and can land and be tested via PGlite before any UI. Step 6 spans migration + API + app routing. Step 7 spans migration + app (staff page, account surface, marketplace wiring).

## 2. Obsolete files — disposition

DELETE / DO NOT USE as a capture path:
- `artifacts/intake_forms_OBSOLETE/Intake Form - Horse Lease Lessor.md`
- `artifacts/intake_forms_OBSOLETE/Intake Form - Horse Lease Lessee.md`

These two placeholder intake forms were built for a form_definitions-style flat capture. They are the WRONG mechanism for the standardized, negotiated instrument: capture for the lease is `contract_fields` via the engine (seeded by `start_lease_contract`, edited through `set_contract_field`, negotiated through `request_document_change`). Do not add them under `build_instructions_phase_2/Documents/Forms/`. They are included in `artifacts/` only as a field-inventory reference for the Spec E seed (their sections/fields map 1:1 to the seeded `contract_fields`). Once Spec E's seed is in place, discard them.

The old `form_definitions` rows `INTAKE_HORSE_LEASE_IN` and `INTAKE_HORSE_LEASE_OUT` (in the generated `20260629120000_form_definitions.sql`) are a DIFFERENT product surface — the brokerage representation intake (client seeking help to lease), which captures representation objectives (budget, discipline preferences), NOT executed-lease terms. Decision for the owner, stated in the handoff so it's explicit:
- If the brokerage lease-representation intake is still a live product surface, LEAVE these two form_definitions rows as-is; they are unrelated to the standardized instrument and coexist fine.
- If the standardized negotiated lease fully replaces the brokerage lease intake, deactivate these two rows (set `active=false` in a forward migration) rather than deleting, preserving history. Do NOT delete the form_definitions machinery or the other forms.

The earlier-delivered `HORSE_LEASE.md` that was a "dramatically simplified placeholder" is already superseded in the repo (the repo copy had the standardized arbitration clause). The new `artifacts/contract_templates/HORSE_LEASE.md` supersedes both. There is one source of truth going forward: `supabase/contract_templates/HORSE_LEASE.md`.

HORSE RECORD + HORSE INTAKE (spec-H): the PRIOR horse record shape and any prior/minimal horse intake and their wiring are superseded by the standardized matched pair (`artifacts/horse_record/horse_record_schema.sql` + `artifacts/horse_record/horse_intake_form.md`). Remove the old horse intake capture and repoint ALL horse data entry (the four creation paths) to the standardized intake + `create_horse_record`. DIFF the standardized field set against any horse fields already in code BEFORE replacing, so nothing is lost. Do NOT delete the `form_definitions`/`intake_submissions` machinery — it still serves convert-submission (lead) forms; only horse capture moves to the record-creation pattern.

## 3. Wiring checklist — make it fully functional

Backend:
- [ ] New `horses` columns exist; generate_document resolves `HORSE.FAIR_MARKET_VALUE` (+ vet/farrier already in v9).
- [ ] `contract_templates.body` for `HORSE_LEASE` = new source; `template_tokens` re-derived (all new tokens present); forward re-assert migration applied for existing DBs.
- [ ] `remerge_contract_from_fields` exists, is idempotent, starts from the ORIGINAL template body, resolves all non-SIG tokens from `contract_fields`, evaluates the Spec C.3 CUT table, strips empty term lines, leaves SIG tokens.
- [ ] `advance_document_workflow` `locked` transition calls re-merge AND gates on: no open change requests (exists), no required field empty (exists), horse section confirmed (Spec F, new).
- [ ] `lock_and_sign_contract` straight-from-editable path also re-merges and enforces the horse-confirm gate.
- [ ] `start_lease_contract` seeds the full field set with correct `owner_role`/`section`/`required`/`value_type`/`sort_order`; every non-SIG lease token has exactly one field.
- [ ] Horse sub-lock: `confirm_horse_section`/`reopen_horse_section` RPCs; auto-reopen on `HORSE.*` edit in `set_contract_field`; confirmation surfaced in `contract_document_detail`.
- [ ] Counterparty invite issuance (contract-scoped), `redeem_contract_invitation` links profile→party contact without granting community membership, redirect to the contract.

App / API:
- [ ] Contract authoring UI (owner): renders seeded fields grouped by section; owner fills DEAL fields, leaves counterparty-owed fields blank+required, sets `recipient_editing` (the editable/suggestions vs contribute-and-sign control), composes cost/insurance responsibility+percent into the stored phrase (Spec E.3), calls `share_document`, and holds the Lessor "confirm horse info" control.
- [ ] Cost/insurance composition rule implemented (responsibility select + split percent → "Lessee 100%" / "Lessor 60% / Lessee 40%" / blank).
- [ ] Counterparty minimal surface: intake (their fields only, via `can_edit`) → review (merged body) → sign; change-request affordance only when `recipient_editing`; no feed/community/ops routes for a contract-only user.
- [ ] Notifications already link to `/app/contracts/{id}`; ensure that route renders the counterparty and owner views appropriately.
- [ ] Owner-signs-last enforced in UI (counterparty signs first when they owe input; owner's signature is the final gate with a withdraw/bounce option before signing).

Token dictionary:
- [ ] `docs/TOKEN_DICTIONARY.md` updated with the new `TXN.*` lease tokens (per Spec E list) and `HORSE.FAIR_MARKET_VALUE`, and vet/farrier if not already documented.

## 4. Test checklist (PGlite, mirroring existing `test/db/*` style)

- [ ] Generate a lease → all seeded fields exist with correct ownership; SIG tokens present; CUT markers present in `merged_body` (not yet stripped).
- [ ] Ownership: LESSEE cannot edit a `LESSOR`/`HORSE`/`DEAL` field; LESSOR cannot edit LESSEE personal fields; with `recipient_editing=false` the counterparty cannot edit DEAL fields; with it true they can request changes (not edit) unless they are the originator.
- [ ] Lock gate: cannot lock with an open change request; cannot lock with a required field empty; cannot lock until horse section confirmed.
- [ ] Horse sub-lock: `confirm_horse_section` requires LESSOR/staff; editing a `HORSE.*` field after confirm clears it.
- [ ] Re-merge/strip: lease with all splits/insurance/competition/evaluation blank → final body omits those sections and shows no empty `Label:` lines; filling `TXN.LEASE_TYPE='Partial Lease'` keeps the partial section; a late-added split appears; idempotent re-merge.
- [ ] Signing: `lock_and_sign_contract` → `record_signature` fills SIG tokens in the re-merged body; EXECUTED only after all signer parties sign; owner-last order holds; `workflow_state='executed'`; execution hash set once.
- [ ] Counterparty onboarding: contract invite → Google/password auth → profile links to party contact → can fill own fields and sign; contract-only user has no community/feed access.

## 5. Done-criteria (acceptance for the whole project)

The feature is complete when an owner can, entirely in-app:
1. Start a lease (or purchase) as either party or as facilitator for a client, with the counterparty invited by email.
2. Author terms, choosing per contract whether the counterparty may suggest edits or only contribute their info and sign.
3. Have the counterparty onboard into a minimal contract-only surface, complete their information (and, if enabled, suggest changes), and have the negotiation loop run to mutual settlement (silence = consent; lock blocked only by open requests, empty required fields, or an unconfirmed horse section).
4. Reach a locked, field-sourced final document that shows only agreed, filled terms — optional sections dropped when unused — with acknowledgments and signatures appearing only at lock.
5. Have the counterparty sign, then the owner review and sign last (with the ability to withdraw or bounce for correction before signing), producing an executed, hashed document both parties can see.

Everything above rests on the existing engine; the deliverables here are the template, the re-merge/strip/CUT wiring, the seed, the horse sub-lock, and the counterparty onboarding. No part of the existing signing/hashing/notification machinery is reimplemented.

## 6. Settled decisions (previously open — now resolved, do not re-ask the owner)
- Purchase template parity: the purchase agreement reaches full parity with the standardized lease (same engine, negotiation, controls, onboarding, re-merge/strip, record-on-execution), differing only in lease-vs-sale language and sale-specific provisions. The owner will PROVIDE a same-source purchased sale agreement as the reference; do NOT author the equine sale agreement from scratch. Scope for the sale flow is bounded and blocked on that reference. Note in project memory: "Sale flow = bring HORSE_PURCHASE_SALE to full lease parity using an owner-provided same-source reference; not to be started without it." Sale execution transfers ownership seller→buyer (no term); lease execution attaches lessee-for-term (owner unchanged); both retain history.
- Horse vet/farrier/fair-market-value tokens: LESSOR-owned `contract_fields` (settled in spec-E; the horse record is born from the contract, so there is no central record to mirror at authoring time).
- Horse-field ownership generally: horse fields are authored by the Lessor on the contract and birth the horse record on execution (spec-H).
- Brokerage `INTAKE_HORSE_LEASE_IN/OUT`: leave active (owner has not reviewed them; unrelated to the standardized instrument). Deactivate only on explicit owner instruction.
- Required-field set that gates lock: LESSEE.FULL_NAME, LESSOR.FULL_NAME, HORSE.REGISTERED_NAME, TXN.LEASE_TYPE, TXN.LEASE_FEE. (Owner-confirmed starting set; add more only on owner instruction.)
- All intakes are authenticated: the horse intake link requires Google-or-password sign-in (email pre-verified by the link) before the form shows; there is no anonymous horse intake. Every horse record has an authenticated creator; owner/lessee parties are separate and may be unassigned (e.g. a staff-created listing horse).
- Onboarding horse capture: replaced with the FULL horse intake field set (appended to onboarding), producing a full record on activation; non-document fields may be blank.
- Dispute-resolution clause: the CURRENT arbitration language is the short form — "Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California." The delivered `artifacts/contract_templates/HORSE_LEASE.md` uses it. Do NOT reintroduce the older JAMS/AAA streamlined-arbitration clause; it was superseded on main (the reference repo originally handed over was ~93 commits behind main and still carried the old clause). When loading the lease body, use this short clause; if main's other documents show a different current clause, match main and flag the discrepancy rather than silently using either.

## 6a. Cross-update flag (act on this in the OTHER update, which runs first)
An authenticated user filling a form to create a record they own is RECORD-CREATION, not convert-submission. These must not share a pipeline. The app update running BEFORE this one should establish a generic authenticated-user form-to-record pattern (form → data record owned by the submitter; no review queue; no convert semantics). Add this to that update's instructions. If it is built there, the horse work (spec-H) uses it; if not, spec-H's `create_horse_record` stands alone. Horse-record creation must NOT be logged as a convert-submission.
