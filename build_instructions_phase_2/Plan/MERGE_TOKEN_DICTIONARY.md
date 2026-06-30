# FHE Merge Token Dictionary
# The contract between documents and the database

This is the canonical naming layer. Every fillable field in every contract and intake form uses a token from this dictionary; every token maps to a database column or a computed value. Documents and SQL must both conform to this file. If a field is not in this dictionary, it is either fixed legal text (not tokenized) or a new token to be added here first.

## Token syntax

`{{NAMESPACE.FIELD}}` — double braces, uppercase, dot-separated namespace. Namespacing prevents collisions when one contract has multiple people (a purchase has BUYER, SELLER, and FHE).

Three token kinds:
- Field tokens: filled from a database column. `{{BUYER.FULL_NAME}}`.
- System tokens: filled by the app at generation time. `{{DOC.UUID}}`, `{{DOC.GENERATED_DATE}}`.
- Signature tokens: filled by the signing flow, never pre-merged. `{{SIG.BUYER.NAME}}`, `{{SIG.BUYER.DATE}}`.

## Critical rule — fields vs. clauses

Do NOT tokenize fixed legal language. Lines like "Disputes shall be resolved by:", "FHE does not guarantee:", "Client releases FHE from claims arising from:" are clause headings followed by fixed contract prose, not blanks to fill. They stay as written. Only tokenize true variable data: party identity, horse identity, money, dates, locations, and explicit selections.

## Party namespaces

Which party namespaces appear in which contracts (from the actual signature blocks):

| Contract (canonical) | Party namespaces |
|----------------------|------------------|
| Horse Purchase and Sale Agreement | BUYER, SELLER, FHE |
| Horse Sale and Transfer Agreement | SELLER, BUYER, FHE |
| Horse Lease Agreement | LESSOR, LESSEE, FHE |
| Horse Lease/Purchase Representation Agreement | CLIENT, FHE |
| Horse Search and Acquisition Retainer | CLIENT, FHE |
| Horse Evaluation Services Agreement | CLIENT, FHE |
| Horse Training Services Agreement | CLIENT(OWNER), FHE |
| Horse Exercise Services Agreement | CLIENT(OWNER), FHE |
| Horsemanship Training Agreement | PARTICIPANT, PARENT/GUARDIAN (if minor), FHE |
| Rider Lesson and Jumper Training Agreement | PARTICIPANT, PARENT/GUARDIAN (if minor), FHE |
| Minor Rider Agreement | PARTICIPANT, PARENT/GUARDIAN, FHE |
| Independent Contractor Agreement | CONTRACTOR, FHE |
| Horse Emergency Veterinary Authorization | OWNER, FHE |
| Human Emergency Medical Authorization v2 | PARTICIPANT, PARENT/GUARDIAN, FHE |
| Photo/Video/Media Release | PARTICIPANT/CLIENT, PARENT/GUARDIAN (if minor), FHE |
| Facility Rules and Safety Acknowledgment | CLIENT/PARTICIPANT, FHE |
| Facility Use and Business Operations License | OWNER(facility), FHE(lessee) |

CLIENT, BUYER, SELLER, LESSOR, LESSEE, OWNER, PARTICIPANT, CONTRACTOR, PARENT, GUARDIAN are all person-shaped and share the person field set below. FHE is the company and uses the FHE namespace.

## Person field set (applies to every person namespace)

Replace PARTY with the namespace (BUYER, SELLER, CLIENT, etc.).

| Token | Schema source | Notes |
|-------|---------------|-------|
| {{PARTY.FULL_NAME}} | contacts.full_name | "Full Legal Name" / "Name" |
| {{PARTY.PHONE}} | contacts.phone | |
| {{PARTY.EMAIL}} | contacts.email | |
| {{PARTY.ADDRESS}} | contacts.address (composed) | single-line composed address |
| {{PARTY.PRINTED_NAME}} | contacts.full_name | signature block printed name |
| {{PARTY.TITLE}} | contact_roles.title | only where a title applies |
| {{PARTY.RELATIONSHIP}} | engagement_party.relationship | e.g. parent→participant |

## FHE namespace (company; from brand.ts / config)

| Token | Source |
|-------|--------|
| {{FHE.LEGAL_NAME}} | config: legal entity (Master Field list — currently blank, DBA "French Heritage Equestrian") |
| {{FHE.SIGNATORY_NAME}} | config: authorized signatory |
| {{FHE.SIGNATORY_TITLE}} | config: signatory title |
| {{FHE.PHONE}} | brand.ts phoneDisplay (858-439-3614) |
| {{FHE.EMAIL}} | brand.ts email (Hello@FHEquestrian.com) |
| {{FHE.ADDRESS}} | config: facility/business address |

## Horse namespace (needs a horses table — see reconciliation)

| Token | Schema source |
|-------|---------------|
| {{HORSE.REGISTERED_NAME}} | horses.registered_name |
| {{HORSE.BARN_NAME}} | horses.barn_name |
| {{HORSE.BREED}} | horses.breed |
| {{HORSE.COLOR}} | horses.color |
| {{HORSE.SEX}} | horses.sex |
| {{HORSE.AGE_DOB}} | horses.date_of_birth (or age) |
| {{HORSE.HEIGHT}} | horses.height |
| {{HORSE.REGISTRATION_NUMBER}} | horses.registration_number |
| {{HORSE.MICROCHIP}} | horses.microchip_id |
| {{HORSE.CURRENT_LOCATION}} | horses.current_location |

## Transaction / money namespace

| Token | Schema source |
|-------|---------------|
| {{TXN.PURCHASE_PRICE}} | transactions.amount |
| {{TXN.DEPOSIT_AMOUNT}} | transactions.deposit_amount |
| {{TXN.DEPOSIT_TERMS}} | transactions.deposit_terms |
| {{TXN.BALANCE_DUE}} | computed |
| {{TXN.PAYMENT_TERMS}} | transactions.payment_terms |
| {{TXN.PAYMENT_SCHEDULE}} | transactions.payment_schedule |
| {{TXN.COMMISSION_RATE}} | pricing config (blank — Master Field list); per-deal override in Part B |
| {{TXN.COMMISSION_MIN}} | pricing config (blank); minimum-commission floor |
| {{TXN.RETAINER_FEE}} | transactions.retainer_fee (Part B engagement form) |
| {{TXN.SERVICE_FEE}} | transactions.service_fee — flat placement/success/representation fee; the flat alternative to TXN.COMMISSION_RATE |
| {{TXN.LEASE_TERM}} | transactions.lease_term |
| {{TXN.TRIAL_PERIOD}} | transactions.trial_period |
| {{TXN.DELIVERY_DATE}} | transactions.delivery_date |
| {{TXN.DELIVERY_LOCATION}} | transactions.delivery_location |

## Engagement / service namespace

| Token | Schema source |
|-------|---------------|
| {{ENG.ID}} | engagements.display_code (ENG-YYYY-NNNNNN) |
| {{ENG.SERVICE_TYPE}} | engagements.service_type (the 13-value catalog) |
| {{ENG.START_DATE}} | engagements.start_date |
| {{ENG.INTENDED_USE}} | intake.intended_use |
| {{ENG.DISCIPLINE}} | intake.discipline |
| {{ENG.BUDGET}} | intake.budget |
| {{ENG.PROTECTION_PERIOD}} | config (representation protection window) |

## System / document namespace

| Token | Source |
|-------|--------|
| {{DOC.UUID}} | documents.id |
| {{DOC.ID}} | documents.display_code (DOC-...) |
| {{DOC.GENERATED_DATE}} | now() at generation |
| {{DOC.EFFECTIVE_DATE}} | set at execution |

## Signature namespace (filled only by the signing flow)

| Token | Filled when |
|-------|-------------|
| {{SIG.PARTY.NAME}} | signer types name |
| {{SIG.PARTY.DATE}} | signature timestamp |
| {{SIG.PARTY.IP}} | captured for the audit trail (recommended; CA has no Equine Activity Liability Act, the waiver is primary protection) |

## Governance

The legal clause text (governing law = California, venue = San Diego County) is fixed and not tokenized; it already appears correctly across the set. Only the venue/county VALUES would tokenize if you ever operate elsewhere — for launch, leave as fixed text.

Any new field discovered during tokenization gets added here first, then used. The SQL field-mapping table (reconciliation spec) is generated from this dictionary — they must stay in sync.
