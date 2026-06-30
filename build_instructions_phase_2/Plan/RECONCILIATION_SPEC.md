# FHE Reconciliation Spec
# Aligning all documents and the SQL to the contracts + token dictionary

Canonical authority, in order: (1) contract legal language and structure are canonical, EXCEPT (2) the finalized 13-service catalog overrides any service reference in any document, and (3) the Merge Token Dictionary is canonical for field naming. Where a contract names a killed service, the catalog wins and the reference is removed.

This spec is the change list. It does not rewrite the files inline; it tells Claude Code exactly what to change, grouped so the work is mechanical and verifiable.

## Group A — The 20 contracts (canonical legal docs; tokenize + de-stale)

A1. Pick canonical, delete the rest from the working set (see exclusion list):
- Purchase: keep "Horse Purchase and Sale Agreement". Drop "Horse Purchase Agreement".
- Sale: keep "Horse Sale and Transfer Agreement". Drop "Horse Sale Agreement".
- Emergency medical: keep "...v2". Drop the non-v2.
- Keep "Horse Lease/Purchase Representation Agreement" as the representation doc (FHE's role), distinct from the transfer docs.

A2. Tokenize every true fillable field using the dictionary. Replace labeled blanks with the namespaced token for the party/entity the block belongs to. Example, in the Purchase and Sale Agreement SELLER block: "Name:" → "Name: {{SELLER.FULL_NAME}}", "Phone:" → "{{SELLER.PHONE}}", etc. HORSE INFORMATION block → {{HORSE.*}}. PURCHASE PRICE/$ → {{TXN.PURCHASE_PRICE}}. Effective Date → {{DOC.EFFECTIVE_DATE}}. Signature blocks → {{SIG.PARTY.*}} (never pre-merged).

A3. Do NOT tokenize clause headings with fixed legal prose: "Disputes shall be resolved by:", "FHE does not guarantee:", "Client releases FHE from claims arising from:", "Seller represents:", "This Agreement shall be governed by:" (the answer is fixed: California / San Diego County). These remain as written.

A4. Remove killed-service references (catalog overrides contract). Specific spots found:
- Contract guide "Document 3" titled "Training, Exercise, Clipping & Horse Care Agreement" → retitle to drop "Horse Care"; that combined doc maps to the separate Training, Exercise, and Clipping (clipping survived) agreements.
- "horse care services" / "grooming" enumerations in the Purchase/Sale recital B, Training agreement, Facility agreement, and Evaluation agreement service lists → strike "grooming" and "horse care" from the service enumerations; keep clipping, training, exercise, riding, handling.
- Any "□ Grooming" / "□ Horse care" checkbox options → remove.

A5. Confirm every contract carries: governing law (CA), venue (San Diego County), gross-negligence non-waiver consistent with Civil Code §1668 (do not write a waiver that purports to release gross negligence), and—since CA has no Equine Activity Liability Act—a robust primary-assumption-of-risk recital. These are present in most; verify across all 20 after edits.

## Group B — Client intake forms (tokenize for capture; align to schema)

B1. These feed the database, so their fields become the form schema, not merge tokens in a document. For each intake form, map every labeled field and checkbox to an intake column/JSON key using the dictionary's namespaces (CLIENT.*, HORSE.*, ENG.INTENDED_USE, ENG.DISCIPLINE, ENG.BUDGET, service-selection checkboxes → enumerated values). Output: a field-to-column map per form (Claude Code builds the form + the insert).
B2. Remove killed-service checkboxes: "Grooming Fundamentals", "Grooming", "Horse Care" in active intake forms.
B3. Service-selection checkboxes must use the 13-value catalog values exactly (HORSE_PURCHASE_ASSISTANCE, RIDING_LESSON, HORSE_CLIPPING, etc.), not free text.

## Group C — Company engagement-intake + delivery forms (migrate token scheme)

C1. These are already tokenized but use the OLD flat scheme. Migrate to the dictionary's namespaced scheme:
- {{ENGAGEMENT_ID}} → {{ENG.ID}}
- {{UUID}} / {{DOC UUID}} → {{DOC.UUID}}
- {{CLIENT_ID}} → keep as a system id, render client name via {{CLIENT.FULL_NAME}} where a name is shown
- {{CREATED_DATE}} → {{DOC.GENERATED_DATE}}
- {{REPORT_ID}}, {{RECORD_ID}} → {{DOC.ID}} scoped by record type, or dedicated {{REPORT.ID}} / {{RECORD.ID}} (add to dictionary)
- {{HORSE_ID}} → keep as id; render details via {{HORSE.*}}
C2. Remove "Horse Care Agreement (if applicable)", "Grooming", "Grooming Education", "Grooming / Handling" lines.
C3. Delivery reports (Evaluation, Search, Finder, Lease Condition, Horsemanship) are the fulfillment artifacts — confirm each maps to a service_record/report row and carries {{ENG.ID}} + {{DOC.ID}}.

## Group D — Instruction files (the build reference; reconcile to final scheme)

D1. The instruction files carry "REQUIRED DATABASE FIELDS" sections — update these to cite the dictionary token/column names exactly, so they remain the authoritative form-to-DB map Claude Code follows.
D2. Remove the Horse Clipping instruction set? NO — clipping survived. KEEP it. Remove only grooming/horse-care instruction content (which lives in the excluded "Other Versions" folder, not here).
D3. Each intake+completion instruction pair should name: which contract(s) the engagement generates, which intake form feeds it, and which delivery artifact closes it. Verify the trio is consistent per service.

## Group E — SQL reconciliation (carry the field mapping)

The SQL grows a template-assembly layer on top of the existing schema. New migrations (additive; do not alter the seven deployed):

E1. `contract_templates` — id, service_type, template_key, title, body (the tokenized contract text), version, active. One row per canonical contract.
E2. `template_tokens` — template_id, token (e.g. {{SELLER.FULL_NAME}}), source_table, source_column, kind (field|system|signature), required. This is the dictionary, in the database. Generated from MERGE_TOKEN_DICTIONARY.md; they must match.
E3. `horses` — the dictionary's HORSE.* columns (registered_name, barn_name, breed, color, sex, date_of_birth, height, registration_number, microchip_id, current_location, current_owner_contact_id). Purchase/sale/lease/representation flows require it.
E4. `engagement_parties` — engagement_id, contact_id, party_role (BUYER|SELLER|LESSOR|LESSEE|CLIENT|PARTICIPANT|CONTRACTOR|PARENT|GUARDIAN|OWNER), relationship. Resolves multi-party contracts to people.
E5. `documents` — generated documents: id, display_code, engagement_id, template_id, merged_body, status (DRAFT|AWAITING_SIGNATURE|EXECUTED|VOID), generated_at. (Extends/replaces the lightweight order_documents for transaction docs; keep order_documents for the simple checkout agreements or migrate — Claude Code to choose the least-disruptive path and document it.)
E6. `signatures` — document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, method. Multi-party: one row per signer. Append-only after signed_at.
E7. `document_deliveries` — document_id, recipient_contact_id, delivered_at, channel, copy_url. Records the "deliver copies to the various parties" step.
E8. `audit_logs` — append-only trigger-based log (the Master Field list and security model require it). Apply the model in DATABASE_SECURITY_AND_PERMISSION_MODEL.md.
E9. Catalog reconciliation migration — deactivate killed services in `offerings`; align offering identifiers/segments to the 13-value catalog; ensure HORSE_CLIPPING retained. Add the 13 values as a lookup table per the enum-strategy decision (lookup tables, not native enums).
E10. Pricing/config table — commission rates, travel fee method, cancellation fees, minimums (currently blank in Master Field list); referenced by {{TXN.*}} tokens.

E11. RLS for all new tables per the security model: contract_templates admin-write/all-read-active; horses/engagement_parties/documents/signatures/deliveries owner-scoped via engagement ownership; audit_logs append-only, admin-read.

## Verification (run after edits, before handoff close)

- Every token used in any contract/form exists in the dictionary and in template_tokens. No orphan tokens.
- Zero occurrences of grooming / horse care / bathing / mane-pull / turnout-assist / show-prep in the active (non-excluded) set.
- Every contract retains CA governing law + San Diego County venue + §1668-consistent waiver.
- Each service's intake → contract(s) → delivery trio is consistent (Group D3).
- The 13 catalog values are used verbatim in all service-selection fields.
