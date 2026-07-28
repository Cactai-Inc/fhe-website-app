# Contract engine — external data dependencies (verified 2026-07-27)

Purpose: the contact/client records system is being restructured in a parallel
thread. This is the verified inventory of everything the contract engine
(HORSE_LEASE_V2 and the flat templates) **reads from or writes to outside its own
template tables**, so that thread can report which of its changes touch the
contract creation → authoring → signing → delivery pipeline, and we can time the
push accordingly. Every fact below was read from the live database functions and
API code, not inferred.

---

## 1. The identity-critical fact (read this first)

**Every person-anchor in the contract system is `contact_id`. No contract table
carries a `user_id`.**

| Table | Person columns | Role |
|---|---|---|
| `contract_parties` | `contact_id`, `party_role` | who is on the contract (LESSOR / LESSEE / …) |
| `document_parties` | `contact_id`, `party_role` | who is on each document instance |
| `signatures` | `signer_contact_id`, `party_role` | who signed |
| `document_deliveries` | `recipient_contact_id` | who received an executed copy |
| `contracts` | `originator_contact_id` (+ `horse_id`, `purchase_id`) | who started it |

Accounts are reached only *through* `profiles.contact_id` (the 1:1 bridge).
Anything the refactor does to contact identity — merging duplicate contacts,
re-anchoring a contact under an account, changing how a contact is promoted —
directly moves who a signed contract belongs to. **Re-parenting or merging a
`contact_id` that appears in `signatures` or `document_parties` rewrites who
signed a legal document.** (This is the same class of risk as the parked
Ecosystem Stage 3 re-anchoring of 6 stranded executed documents.)

## 2. Entry points (what creates a contract)

- **`start_lease_contract_v2(p_lessee_contact_id, p_lessor_contact_id, p_horse_id, p_responsible_role)`**
  — the only creator of new leases (called from `src/lib/api.ts:1799`). Takes raw
  **contact ids** for both parties; joins `contacts` to validate; writes
  `contracts`, `documents`, `contract_parties`, `contract_fields`.
- **`generate_document(p_contact_id, p_template_key, p_contract_id, p_horse_id, p_parties jsonb, p_service_type)`**
  — the underlying document factory (also used by the flat templates / releases).
- **`add_lease_participant(p_document_id, p_contact_id, …)` / `remove_lease_participant`**
  — additional riders on a lease, again contact-anchored.
- Counterparty provisioning: when the other party has no account, account
  creation flows through the shared **`_ensure_client_account`** spine (the same
  one the invite system uses). If the refactor changes that spine's signature or
  semantics, contract counterparty invites change with it.

## 3. Party auto-fill (contacts → document text)

**`fill_party_fields_from_contacts`** materializes party tokens
(`LESSOR.FULL_NAME`, `LESSEE.ADDRESS`, …) into `contract_fields` by reading these
exact `contacts` columns:

`first_name`, `last_name`, `email`, `phone`, `address_composed`,
`address_line1`, `address_line2`, `city`, `state`, `postal_code`, `is_company`

Renaming, splitting, or repurposing **any** of those columns breaks party
auto-fill silently (blank names/addresses in generated leases). If the refactor
moves person data from `contacts` onto an account-side table for promoted
people, this function must learn the new read path in the same change.

## 4. Horse data (horse record → document text)

- **`attach_horse_to_document`** + **`capture_horse_record_info`** read/write
  `horses` (+ `horse_breeds`, `horse_colors` lookups): identity fields
  (`HORSE.REGISTERED_NAME`, color, breed, sex, markings, registration, microchip,
  passport, `HORSE.FAIR_MARKET_VALUE`) and farrier/vet contact fields.
- `HORSE.FAIR_MARKET_VALUE` is now **load-bearing legal language**: it is the
  imported minimum for Lessee-obtained mortality insurance and the default
  Limitation-of-Liability cap. Horse-record ownership rules (who may edit a
  horse) therefore gate a contract's dollar terms.
- Note: `capture_horse_record_info` deliberately lets a **non-owner party**
  (e.g. FHE as Lessee) supply missing horse details — it does its own
  party/staff authorization. If the refactor tightens horse-edit authorization,
  keep this carve-out.

## 5. Composition + workflow (self-contained, but reads config)

- Template tables: `contract_templates`, `contract_section_defs`,
  `contract_clause_defs`, `contract_field_defs`, `template_tokens`,
  `template_variants`, `lookup_options` — all keyed by `template_key`,
  no person data.
- `remerge_contract_from_clauses` / `recompose_document_fields` /
  `sync_contract_fields_from_defs` — compose `documents.merged_body` from
  `contract_fields`. Person data enters only via the party fields (§3).
- **`advance_document_workflow`** also touches: `document_party_controls`,
  `document_shares`, `document_change_requests`, `caller_party_roles`,
  `notifications` (notification rows are **`user_id`-keyed** — a party without
  an account gets no in-app notification; email is the fallback),
  `business_config` / `config_values` (org display values).

## 6. Signing + execution

- **`sign_release` / signing flow** writes `signatures.signer_contact_id`.
- Document execution triggers **`derive_affiliations` / `apply_affiliations`**
  (the Stage-2 sole group writer) — executing a lease can change the signer's
  standing groups (e.g. HORSE_OWNER). The refactor owns these functions; the
  contract engine depends on their trigger wiring staying on document-execution.
- Execution also stamps `status_events` (+ `current_status` on `documents`).

## 7. Delivery + linkage (post-execution)

- **`api/deliver-documents.ts` / `deliver-document`** — emails executed copies:
  reads party **contact emails**, logs to `document_deliveries`
  (`recipient_contact_id`), brands from the value registry via
  `resolveTenantEmailIdentity` (ORG.* tokens).
- **`link_contract_to_purchase`** — ties `contracts.purchase_id` to
  `purchases`/`purchase_items` (buyer is `buyer_contact_id` — same anchor).
- `api/delete-document-with-copy.ts` — consults `document_deliveries` before
  allowing deletion.

## 8. What the refactor thread should answer back

1. Do contacts get **merged/deduplicated or re-keyed**? If yes: what happens to
   `contact_id` references in `signatures`, `document_parties`,
   `contract_parties`, `document_deliveries` (§1)?
2. Do any of the **§3 contacts columns** change name, move, or split
   (person vs company, address restructure)?
3. Does **promotion** (contact → account) change `profiles.contact_id`
   semantics, or ever create a *new* contact row for the account side? (The
   contract engine assumes one stable contact_id per person forever.)
4. Does **`_ensure_client_account`** change signature/behavior? (Contract
   counterparty invites ride on it.)
5. Any change to **horse ownership/edit authorization** (affects §4, including
   the non-owner carve-out)?
6. Timing: are the changes additive (safe to push the contract work first) or
   do they rewrite contact columns in place (coordinate the push)?
