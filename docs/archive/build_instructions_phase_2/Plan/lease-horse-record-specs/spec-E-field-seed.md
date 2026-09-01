# Spec E — Full-Granularity Field Seed

Goal: replace the stale, consolidated field seed inside `start_lease_contract` with the new template's complete field set, and apply the same treatment to `start_purchase_contract`. Every non-SIG token in the template must have a seeded `contract_fields` row (so re-merge, GAP C, resolves everything from fields).

## E.1 Ownership rules (recap)
- LESSEE personal fields → `owner_role='LESSEE'`.
- LESSOR personal fields → `owner_role='LESSOR'`.
- ALL horse fields → `owner_role='LESSOR'` (horse owner authoritative; also feeds the horse sub-lock, GAP F).
- ALL negotiated terms (TXN.*) → `owner_role='DEAL'`.

## E.2 Lease seed — the complete field list
Rewrite the `seed_contract_fields(v_doc, jsonb_build_array( ... ))` payload in `start_lease_contract` (migration `20260705010000`, re-issued via CREATE OR REPLACE in a new forward migration) to exactly the fields below. `value_type` ∈ text/longtext/currency/date/select/checkbox. `required` marks fields that gate lock (decision 8). `sort_order` groups by section in ascending order. Leave `value` unset (blank) for everything — the owner fills at authoring; the seed only DEFINES fields.

Personal — LESSEE (owner_role LESSEE):
- `LESSEE.FULL_NAME` (text, required) · `LESSEE.ADDRESS` (text) · `LESSEE.PHONE` (text) · `LESSEE.EMAIL` (text)

Personal — LESSOR (owner_role LESSOR):
- `LESSOR.FULL_NAME` (text, required) · `LESSOR.ADDRESS` (text) · `LESSOR.PHONE` (text) · `LESSOR.EMAIL` (text)

Horse (owner_role LESSOR):
- `HORSE.REGISTERED_NAME` (text, required) · `HORSE.BARN_NAME` (text) · `HORSE.BREED` (text) · `HORSE.COLOR` (text) · `HORSE.SEX` (text) · `HORSE.AGE_DOB` (text) · `HORSE.REGISTRATION_NUMBER` (text) · `HORSE.MICROCHIP` (text) · `HORSE.FAIR_MARKET_VALUE` (currency) · `HORSE.CURRENT_LOCATION` (text) · `HORSE.VET_NAME` (text) · `HORSE.VET_PHONE` (text) · `HORSE.FARRIER_NAME` (text) · `HORSE.FARRIER_PHONE` (text)

SETTLED (supersedes any earlier hedge): horse fields are LESSOR-owned `contract_fields`, authored on the contract by the Lessor. There is no "mirror from the central horse record" option — per Spec H, the horse record does not necessarily exist yet; the contract is one of the paths that BIRTHS the horse record. On lease execution the horse fields create/populate the horse record (Spec H.4). The horse sub-lock (spec-F) governs this section. `generate_document` may still populate initial values from a horses row IF the contract was started against an existing horse (dedup match), but the authoritative values at signing are the `contract_fields`, and re-merge (spec-C) resolves all `HORSE.*` from `contract_fields`. Include all four vet/farrier tokens above in the seed (they were previously flagged as optionally table-sourced; they are now contract-owned).

Terms — condition & ownership (owner_role DEAL):
- `TXN.CONDITION_EXCEPTIONS` (longtext) · `TXN.BEHAVIOR_EXCEPTIONS` (longtext) · `TXN.OWNERSHIP_LIMITATIONS` (longtext)

Terms — lease type & term (DEAL):
- `TXN.LEASE_TYPE` (select, required) · `TXN.LEASE_TERM` (text) · `TXN.LEASE_START` (date) · `TXN.LEASE_END` (date) · `TXN.RENEWAL_TERMS` (longtext)

Terms — evaluation period (DEAL, optional section):
- `TXN.EVALUATION_START` (date) · `TXN.EVALUATION_END` (date)

Terms — permitted use (DEAL):
- `TXN.PERMITTED_ACTIVITIES` (longtext) · `TXN.USE_RESTRICTIONS` (longtext) · `TXN.AUTHORIZED_USERS` (text)

Terms — partial-lease schedule (DEAL, optional section):
- `TXN.RESERVED_DAYS` (text) · `TXN.SHARED_WITH` (text)

Terms — payment (DEAL):
- `TXN.LEASE_FEE` (currency, required) · `TXN.PAYMENT_SCHEDULE` (text) · `TXN.PAYMENT_TERMS` (longtext) · `TXN.LATE_PAYMENT_TERMS` (longtext)

Terms — boarding & care (DEAL):
- `TXN.BOARDING_RESPONSIBILITY` (text) · `TXN.CARE_RESPONSIBILITY` (text) · `TXN.SUPPLEMENTS` (longtext) · `TXN.SUPPLEMENTS_RESPONSIBILITY` (text)

Terms — vet & farrier (DEAL):
- `TXN.ROUTINE_VET_RESPONSIBILITY` (text) · `TXN.EMERGENCY_VET_RESPONSIBILITY` (text) · `TXN.FARRIER_RESPONSIBILITY` (text) · `TXN.VET_AUTH_CONTACT` (text)

Terms — training & lessons (DEAL):
- `TXN.TRAINING_TERMS` (longtext) · `TXN.LESSON_TERMS` (longtext)

Terms — protective equipment & tack (DEAL):
- `TXN.PROTECTIVE_EQUIPMENT` (longtext) · `TXN.PROTECTIVE_EQUIPMENT_PROVIDER` (text) · `TXN.TACK_TERMS` (longtext) · `TXN.LESSOR_EQUIPMENT` (longtext) · `TXN.LESSEE_EQUIPMENT` (longtext)

Terms — cost allocation, full granularity (DEAL). Each is the resolved phrase (e.g. "Lessee 100%" or "Lessor 60% / Lessee 40%") that the UI composes from a responsibility select + split percent; store the composed phrase as the field value:
- `TXN.BOARD_COST` (text) · `TXN.TRAINING_COST` (text) · `TXN.LESSONS_COST` (text) · `TXN.SUPPLEMENTS_COST` (text) · `TXN.FARRIER_COST` (text) · `TXN.ROUTINE_VET_COST` (text) · `TXN.NON_ROUTINE_VET_COST` (text) · `TXN.OTHER_CARE_COST` (text) · `TXN.OTHER_EXPENSES_COST` (text)

Terms — insurance, three blocks (DEAL, optional sections). Store cost as the composed phrase; party as text:
- `TXN.MORTALITY_INSURANCE_COST` (text) · `TXN.MORTALITY_INSURANCE_PARTY` (text)
- `TXN.MAJOR_MEDICAL_INSURANCE_COST` (text) · `TXN.MAJOR_MEDICAL_INSURANCE_PARTY` (text)
- `TXN.LOSS_OF_USE_INSURANCE_COST` (text) · `TXN.LOSS_OF_USE_INSURANCE_PARTY` (text)

Terms — competition (DEAL, optional section):
- `TXN.COMPETITION_TERMS` (longtext) · `TXN.COMPETITION_EXPENSES` (text) · `TXN.COMPETITION_WINNINGS` (text)

Terms — risk / prohibited / termination (DEAL):
- `TXN.RISK_ALLOCATION` (longtext) · `TXN.PROHIBITED_ACTIVITIES` (longtext) · `TXN.TERMINATION_TERMS` (longtext)

Every token above must exactly match a `{{...}}` token in the new `HORSE_LEASE.md`. Cross-check against the template's token list (84 distinct tokens; minus the 4 SIG tokens = 80 seeded fields, matching this list). If any template token is missing from this list or vice versa, reconcile before shipping — re-merge leaves unmatched tokens blank, which would silently drop a term.

## E.3 The composed-phrase decision (cost/insurance fields)
The template prints one line per cost category (e.g. `Board: {{TXN.BOARD_COST}}`). The intake captured responsibility (Lessor/Lessee/Split) + split percent as separate inputs. The APP composes those into the single phrase stored in the `*_COST` field value. Specify in the app layer (not SQL): when the owner sets a cost category, the UI writes e.g. "Lessee 100%", "Lessor 60% / Lessee 40%", or leaves blank (→ that line strips at lock). This keeps the document checkbox-free and the field model simple. Document this composition rule wherever the contract authoring UI is built.

## E.4 Purchase seed
`start_purchase_contract` (`20260705020000`) already seeds BUYER/SELLER/HORSE/DEAL. Verify its seeded tokens match `HORSE_PURCHASE_SALE.md` exactly (it predates any template change). The purchase template was not rebuilt in this project, so its seed likely still matches; confirm and, if the owner opts to drop the purchase COMPANY-not-a-party clause (Spec A.3), no seed change is needed (that clause has no tokens). If the purchase template is later brought to full parity, mirror this spec's approach.

## E.5 Acceptance
- Every non-SIG token in `HORSE_LEASE.md` has exactly one seeded `contract_fields` row with correct `owner_role`.
- `required` set on LESSEE.FULL_NAME, LESSOR.FULL_NAME, HORSE.REGISTERED_NAME, TXN.LEASE_TYPE, TXN.LEASE_FEE (adjust with owner if more should gate lock).
- Generating + re-merging a fully-filled lease yields a body with no leftover tokens (except SIG until signing).
