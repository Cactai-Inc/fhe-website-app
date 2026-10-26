# Regression pass: every document and flow outside the three contracts

Branch `test/regression` from `main` (e9eedc9a). Session date 2026-10-25.
Purpose: prove the functions/forms/rendering the disclosure + horse-record overhaul
changed (`horse_field_token_value`, `generate_document`, `HorseIntakeForm`,
`BodyWithSignatures`, shared PDF module) still work on production, before any V2
definition is removed. Findings reported, not fixed, unless a fix is one line and
named.

Test horse: ZZ Test Horse `2d07a570-d79c-4cc7-b292-a42c83c2d62c` (org
`e656f20b-ef43-4725-9029-19e7f0190d9c`). Staff/client test accounts from `.env.test`.

---

## Rendering architecture (established up front)

Two token-resolution engines exist and **have diverged**:

- **`generate_document(...)`** — the FLAT-template generator. Carries its OWN inline
  HORSE-token `CASE` block (lines 163–192 of the live def). This is what renders every
  flat template.
- **`horse_field_token_value(horses, field)`** — used by the CLAUSE/field-composed path
  (`sync_contract_fields_from_defs`, `regenerate_contract_document`,
  `capture_horse_record_info`, `expand_horse_blocks`, `attach_horse_to_document`,
  `add_deal_document`). This is the function the overhaul rewrote.

Key divergences between the two (flat vs clause), confirmed from live defs:

| token | generate_document (flat) | horse_field_token_value (clause) |
|---|---|---|
| SEX | raw `v_horse.sex` (e.g. `MARE`) | normalized (`Mare`) |
| pending-field empty | prints empty | prints `To be provided` |
| KNOWN_CONDITIONS | `horse_list_prose(known_conditions_list,'condition')` | `horse_section_text_block` → `[[DISCLOSURE:...]]` markers |
| MEDICATION_* | `horse_medications_prose` / `horse_medication_component` | `horse_meds_prose_v2` |
| MEDICAL/BEHAVIORAL/INJURIES/SUPPLEMENTS/gates | **absent → resolve to `''`** | present, emit disclosure blocks |
| REGISTRATION_ORG / PASSPORT_COUNTRY / TRAINING_HISTORY / COMPETITION_HISTORY | absent → `''` | present |

Consequence to verify in item 2: flat templates do NOT emit disclosure markers; they
print the structured lists as inline prose. The overhaul's new behaviours
("To be provided", normalized sex, disclosure boxes) live only on the clause path.

Provider/location/meds sources (both engines, via helpers):
- providers: `horse_provider_value(horse, 'VET'|'FARRIER', part)` → `horse_relationships` (active)
- location: `horse_current_location_label(horse)` → `horse_locations` (end_on IS NULL)
- meds: `horse_medications` (deleted_at IS NULL)

---

## Item 1 — Inventory

Every active template that is NOT one of the three overhaul contracts
(HORSE_LEASE_V3, HORSE_SALE_V3, HORSE_BILL_OF_SALE). All 14 are **flat** — zero
`contract_clause_defs`, zero `contract_field_defs`, full body text — and all render
through **`generate_document`** (flat path). None route through
`horse_field_token_value`. Doc counts are live (deleted_at IS NULL), by status.

| key | title | contract_kind | compose | HORSE tokens | party namespaces | assigned by | docs (by status) |
|---|---|---|---|---|---|---|---|
| COMPANY_POLICIES | Company Policies | (none) | flat → generate_document | — | CLIENT | category(Horse owner/Guest/Rider), service_type(most), sign_path(all), role_bundle(BUYER active; LESSOR/SELLER/LESSEE inactive) | DRAFT 1, EXECUTED 31 |
| EVALUATION_LIABILITY_WAIVER | Pre-Purchase / Lease Evaluation Liability Waiver | (none, svc HORSE_EVALUATION) | flat | — | CLIENT | service_type(HORSE_EVALUATION) | none |
| FACILITY_LICENSE | Facility Use and Business Operations License | (none) | flat | — | OWNER,COMPANY | none found (manual only) | none |
| FACILITY_RULES | Facility Rules and Safety Acknowledgment | (none) | flat | — | CLIENT,PARTICIPANT | category(Guest/Rider/Horse owner), service_type(most), sign_path(all) | DRAFT 1, EXECUTED 31 |
| HORSE_EMERGENCY_VET | Horse Emergency Veterinary Authorization | (none) | flat | AGE_DOB, BARN_NAME, BREED, COLOR, CURRENT_LOCATION, FAIR_MARKET_VALUE, FARRIER_NAME, FARRIER_PHONE, HEIGHT, KNOWN_CONDITIONS, MEDICATION_ADDITIONAL, MEDICATION_DOSAGE, MEDICATION_INSTRUCTIONS, MEDICATION_NAME, MICROCHIP, REGISTERED_NAME, REGISTRATION_NUMBER, SEX, VET_NAME, VET_PHONE (20) | CLIENT (+OWNER,COMPANY,EMERGENCY_CONTACT ns) | category(Horse owner), service_type(training/exercise/clipping), sign_path(horse, rider+horse), role_bundle(BUYER active; LESSOR inactive) | EXECUTED 2 |
| HORSE_SEARCH_RETAINER | Horse Finder Search and Sourcing Retainer | (none, svc HORSE_FINDER) | flat | — | CLIENT,COMPANY | (svc HORSE_FINDER — not in requirement rows seen; manual) | none |
| HORSE_TRANSACTION_REP | Horse Transaction Representation | (none) | flat | BARN_NAME, BREED, CURRENT_LOCATION, MICROCHIP, REGISTERED_NAME (5) | CLIENT,COMPANY | none found (manual only) | none |
| HUMAN_EMERGENCY_MEDICAL | Human Emergency Medical Authorization v2 | (none) | flat | — | PARTICIPANT,GUARDIAN,COMPANY,EMERGENCY_CONTACT (CLIENT,PARTICIPANT tokens) | category(Rider), service_type(lessons/jumper), sign_path(rider, rider+horse) | DRAFT 1, EXECUTED 31 |
| INDEPENDENT_CONTRACTOR | Independent Contractor Agreement | (none, svc INDEPENDENT_CONTRACTOR) | flat | — | CONTRACTOR,COMPANY | (svc — manual) | none |
| MINOR_RIDER | Minor Rider Agreement | (none) | flat | — | PARTICIPANT,GUARDIAN,COMPANY,EMERGENCY_CONTACT | (no requirement row — manual) | none |
| RELEASE_GENERAL | General Visitor Liability Release | (none) | flat | — | CLIENT,PARTICIPANT | category(Guest), service_type(eval/finder/sale/purchase/lease-in), sign_path(guest), role_bundle(BUYER active; LESSOR/SELLER inactive) | EXECUTED 1 |
| RELEASE_HORSE_CARE | Horse Handling and Routine Care Liability Release | (none) | flat | AGE_DOB, BARN_NAME, BREED, COLOR, CURRENT_LOCATION, FAIR_MARKET_VALUE, FARRIER_NAME, FARRIER_PHONE, HEIGHT, MICROCHIP, REGISTERED_NAME, REGISTRATION_NUMBER, SEX, VET_NAME, VET_PHONE (15) | CLIENT,PARTICIPANT | category(Horse owner), service_type(clipping/exercise/training), sign_path(horse, rider+horse), role_bundle(BUYER active; LESSOR inactive) | EXECUTED 2 |
| RELEASE_JUMPER_ADDENDUM | Jumper Training Addendum — Rider Ability Attestation | (none, svc JUMPER_TRAINING) | flat | — | CLIENT,PARTICIPANT | service_type(JUMPER_TRAINING) | none |
| RELEASE_PARTICIPANT | Participant Liability Release | (none) | flat | — | CLIENT,PARTICIPANT | category(Horse owner/Rider), service_type(lessons/training/exercise/clipping/jumper/horsemanship), sign_path(horse, rider, rider+horse) | DRAFT 1, EXECUTED 31 |

**Flat templates carrying HORSE tokens (item-2 targets): HORSE_EMERGENCY_VET,
RELEASE_HORSE_CARE, HORSE_TRANSACTION_REP.** HORSE_EMERGENCY_VET is the only one
carrying disclosure-adjacent tokens (KNOWN_CONDITIONS, MEDICATION_*).

Also live: a legacy `HORSE_LEASE_V2` (inactive template) still has **1 EXECUTED**
document attached — not in the active inventory but a real row that any "remove V2
definition" step must account for.

## Item 2 — Flat template rendering
## Item 3 — Onboarding and kiosk
## Item 4 — Delivery
## Item 5 — Contract role bundle
## Item 6 — Two findings from the bundle round
## Item 7 — Database test suite
## Item 8 — Report + checklist
