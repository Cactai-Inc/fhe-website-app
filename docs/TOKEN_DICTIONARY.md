# Token Dictionary

FHE DOCUMENT MERGE TOKEN DICTIONARY (owner canon, 2026-07-03 revision)

Format: {{NAMESPACE.FIELD}}. Namespaces: ORG (company), DOC (document instance), ORD (order instance), REQ (request inputs submitted with an order), CLIENT (authenticated person profile), PARTICIPANT (minor receiving services, from linked dependent record), HORSE (horse record), SIG (signature/acknowledgment events), TXN (transaction/fee terms), ENG (engagement scope inputs), DIR (transaction direction terms resolved by role), SELLER/BUYER/LESSOR/LESSEE (third-party transaction parties, not necessarily clients).

Data sources: CLIENT.* autofills from the profiles table for the authenticated user. PARTICIPANT.* autofills from the dependents/minors link. HORSE.* autofills from the horses table plus horse_records; CLIENT.HORSE_CAPACITY resolves from horse_parties.role at signing. ORD.*/REQ.* are captured per order. TXN.*/ENG.*/DIR.* are set per engagement at approval. SIG.* are captured at the acknowledgment event. SELLER/BUYER/LESSOR/LESSEE are entered per transaction document.

ORG NAMESPACE
ORG.LEGAL_NAME - Company legal/DBA name as rendered on all documents. Resolves to the DBA entity, never an individual's name. Used in all 18 documents.
ORG.EMAIL - Company contact email for notices and media-consent revocation. Used in the three releases.

DOC NAMESPACE
DOC.EFFECTIVE_DATE - Execution/effective date of the document instance. Used in all documents.

ORD NAMESPACE
ORD.UUID - Unique identifier of the order copy; joins order, approval, payment memo, and receipt. Used in the five order forms.
ORD.SERVICE_SELECTION - The specific service(s) selected from the offering list for this order. Used in lesson, training, and exercise order forms.

REQ NAMESPACE
REQ.PREFERRED_SCHEDULE - Client-submitted preferred dates and times for scheduling. All five order forms.
REQ.LOCATION_PREFERENCE - Requested service location where applicable. Lesson, horsemanship, training, exercise order forms.
REQ.NOTES - Free-text notes submitted with the request. All five order forms.
REQ.CONDITION_UPDATES - Client-reported horse condition changes since the last engagement. Training and exercise order forms.

CLIENT NAMESPACE (profile autofill)
CLIENT.FULL_NAME - Legal full name. Medical auth, vet auth, search retainer, transaction representation.
CLIENT.PRINTED_NAME - Name as printed at signature blocks. All signed documents.
CLIENT.DOB - Date of birth. Medical auth only.
CLIENT.ADDRESS - Mailing address. Medical auth, vet auth, search retainer, transaction representation.
CLIENT.PHONE - Phone. All signed documents.
CLIENT.EMAIL - Email. All signed documents.
CLIENT.HORSE_CAPACITY - Capacity as to the horse (owner, co-owner, lessee, authorized agent), resolved from horse_parties.role at signing. Equine services release, vet auth.
CLIENT.RIDING_EXPERIENCE_YEARS - Years of riding experience attested. Participant release, jumper addendum.
CLIENT.JUMP_EXPERIENCE - Prior jumping experience and maximum height schooled. Participant release, jumper addendum.
CLIENT.RIDING_BACKGROUND - Prior instruction, showing, or competition experience. Participant release, jumper addendum.
CLIENT.JUMP_LIMITATIONS - Relevant injuries, physical limitations, or riding gaps. Jumper addendum.
CLIENT.EUTHANASIA_INITIALS - Initials acknowledging the euthanasia-approval clause. Vet auth.
CLIENT.EMERGENCY_CONTACT_1_NAME / _RELATIONSHIP / _PHONE - Primary emergency contact. Medical auth, vet auth.
CLIENT.EMERGENCY_CONTACT_2_NAME / _RELATIONSHIP / _PHONE - Secondary emergency contact. Medical auth.

PARTICIPANT NAMESPACE (minor, from dependent record)
PARTICIPANT.FULL_NAME - Minor's full name. Releases, medical auth, jumper addendum, rules, lesson and horsemanship order forms.
PARTICIPANT.DOB - Minor's date of birth. Same documents.

HORSE NAMESPACE (horse record autofill)
HORSE.REGISTERED_NAME - Registered name. All horse documents and horse order forms.
HORSE.BARN_NAME - Barn name. Vet auth, equine services release, transaction docs, training/exercise order forms.
HORSE.BREED - Breed. Vet auth, equine services release, evaluation, lease, purchase/sale, transfer, transaction rep.
HORSE.COLOR - Color. Vet auth, equine services release, lease, purchase/sale, transfer.
HORSE.SEX - Sex. Same set as color.
HORSE.AGE_DOB - Age or date of birth. Vet auth, equine services release, evaluation, lease, purchase/sale, transfer.
HORSE.HEIGHT - Height. Purchase/sale, transfer.
HORSE.REGISTRATION_NUMBER - Registration/identification number. Vet auth, evaluation, lease, purchase/sale, transfer.
HORSE.MICROCHIP - Microchip/tattoo identification. Lease, purchase/sale, transfer.
HORSE.CURRENT_LOCATION - Current facility/location. All horse documents.
HORSE.OWNER_NAME - Owner or seller of a third-party horse being evaluated. Evaluation order form.
HORSE.VET_NAME / HORSE.VET_PHONE - Designated veterinarian. Vet auth; vet name also in purchase/sale and transfer PPE sections.
HORSE.FARRIER_NAME / HORSE.FARRIER_PHONE - Farrier contact. Vet auth.
HORSE.KNOWN_CONDITIONS - Disclosed medical/behavioral conditions. Vet auth.
HORSE.MEDICATION_NAME / _DOSAGE / _INSTRUCTIONS / _ADDITIONAL - Authorized medication details, per-horse structured fields. Vet auth.
HORSE.TRAINING_HISTORY / HORSE.COMPETITION_HISTORY / HORSE.MEDICAL_HISTORY / HORSE.BEHAVIORAL_HISTORY / HORSE.MEDICATION_HISTORY - Seller disclosure histories. Purchase/sale.

SIG NAMESPACE (acknowledgment events)
SIG.CLIENT.NAME / SIG.CLIENT.DATE - Client signature and date. All client-signed documents.
SIG.SELLER.NAME / SIG.SELLER.DATE - Seller signature and date. Purchase/sale, transfer.
SIG.BUYER.NAME / SIG.BUYER.DATE - Buyer signature and date. Purchase/sale, transfer.
SIG.LESSOR.NAME / SIG.LESSOR.DATE - Lessor signature and date. Lease.
SIG.LESSEE.NAME / SIG.LESSEE.DATE - Lessee signature and date. Lease.

SELLER / BUYER / LESSOR / LESSEE NAMESPACES (per transaction document)
SELLER.FULL_NAME / PRINTED_NAME / ADDRESS / PHONE / EMAIL - Seller identity and contact. Purchase/sale, transfer.
BUYER.FULL_NAME / PRINTED_NAME / ADDRESS / PHONE / EMAIL - Buyer identity and contact. Purchase/sale, transfer.
LESSOR.FULL_NAME / PRINTED_NAME / ADDRESS / PHONE / EMAIL - Lessor identity and contact. Lease.
LESSEE.FULL_NAME / PRINTED_NAME / ADDRESS / PHONE / EMAIL - Lessee identity and contact. Lease.

DIR NAMESPACE (direction terms resolved by client role)
DIR.DIRECTION_TERM - The transaction type phrase (purchase, sale, lease). Evaluation, search retainer, transaction rep.
DIR.ROLE_TERM - The client's role phrase (buyer, seller, lessee, lessor). Same documents.
DIR.TARGET_TERM - What the search seeks (a horse, a buyer, a lessee). Search retainer.
DIR.COUNTERPARTY_TERM - The opposite party phrase (seller, buyer, lessor, lessee). Transaction rep.

ENG NAMESPACE (engagement scope inputs)
ENG.DISCIPLINE - Riding discipline. Evaluation, search retainer.
ENG.INTENDED_USE - Intended use of the horse. Evaluation, search retainer.
ENG.EXPERIENCE_LEVEL - Rider experience level for suitability. Evaluation, search retainer.
ENG.COMPETITION_GOALS - Competition goals. Evaluation.
ENG.OTHER_CONSIDERATIONS - Other evaluation considerations. Evaluation.
ENG.DISCLOSURES - Company conflict/relationship disclosures. Evaluation, search retainer.
ENG.SEARCH_OBJECTIVE - Search objective statement. Search retainer.
ENG.BREED_PREFERENCE / ENG.AGE_RANGE / ENG.HEIGHT_RANGE / ENG.BUDGET / ENG.ADDITIONAL_REQUIREMENTS - Search parameters. Search retainer.
ENG.PROTECTION_PERIOD - Non-circumvention period in months. Search retainer, transaction rep.
ENG.PROGRAM_SCOPE - Specific horsemanship program scope. Horsemanship order form.

TXN NAMESPACE (fees and transaction terms)
TXN.SERVICE_FEE - Lesson or horsemanship program fee. Lesson and horsemanship order forms.
TXN.JUMPER_TRAINING_FEE - Jumper training rate. Lesson order form (conditional section).
TXN.PACKAGE_FEE - Multi-lesson package price. Lesson order form.
TXN.SESSION_FEE - Per-session fee for horse training or exercise. Training and exercise order forms.
TXN.MONTHLY_FEE - Monthly program fee. Training and exercise order forms.
TXN.OTHER_FEES - Additional itemized fees. Training and exercise order forms.
TXN.EVALUATION_FEE - Per-horse evaluation fee. Evaluation order form.
TXN.ADDITIONAL_SERVICES - Additional evaluation services and pricing. Evaluation order form.
TXN.RETAINER_FEE - Flat search retainer fee. Search retainer.
TXN.SUCCESS_FEE - Contingent success/acquisition fee. Search retainer.
TXN.COMMISSION_RATE - Percentage commission of transaction value. Search retainer, transaction rep.
TXN.COMMISSION_MIN - Minimum commission. Transaction rep.
TXN.REPRESENTATION_FEE - Flat representation fee. Transaction rep.
TXN.PAYMENT_TERMS - Payment timing/terms. Search retainer, transaction rep, purchase/sale, lease.
TXN.PAYMENT_SCHEDULE - Installment schedule. Transfer, lease.
TXN.PAYMENT_METHOD - Method of payment for a sale. Purchase/sale, transfer.
TXN.PURCHASE_PRICE - Total price. Purchase/sale, transfer.
TXN.DEPOSIT_AMOUNT - Deposit. Purchase/sale, transfer.
TXN.DEPOSIT_TERMS - Deposit refundability/terms. Purchase/sale.
TXN.BALANCE_DUE - Remaining balance. Purchase/sale, transfer.
TXN.TRANSFER_CONDITION - Event upon which ownership transfers. Purchase/sale, transfer.
TXN.TRANSFER_DATE - Ownership transfer date. Transfer.
TXN.DELIVERY_DATE / TXN.DELIVERY_LOCATION - Delivery logistics. Purchase/sale, transfer.
TXN.TRANSPORT_RESPONSIBILITY - Party responsible for transport. Purchase/sale, transfer.
TXN.RISK_TRANSFER - When risk of loss transfers. Purchase/sale, transfer.
TXN.ADDITIONAL_DISCLOSURES - Seller disclosures beyond the standard set. Purchase/sale, transfer.
TXN.PPE_STATUS - Pre-purchase exam completed or declined. Purchase/sale, transfer.
TXN.PPE_DATE - Pre-purchase exam date. Purchase/sale, transfer.
TXN.TRIAL_PERIOD / TXN.TRIAL_TERMS - Trial period and terms. Purchase/sale, transfer.
TXN.TRIAL_RISK_PARTY - Party bearing risk during trial. Purchase/sale.
TXN.TRIAL_CARE_PARTY - Party responsible for care during trial. Purchase/sale, transfer.
TXN.WARRANTIES - Express seller warranties. Purchase/sale.
TXN.DOCUMENTS_TRANSFERRED - Registration/health/competition documents conveyed. Purchase/sale, transfer.
TXN.EQUIPMENT_INCLUDED / TXN.EQUIPMENT_EXCLUDED - Equipment conveyed or excluded. Purchase/sale, transfer.
TXN.DEFAULT_TERMS - Default remedies. Purchase/sale, transfer.
TXN.LEASE_TYPE - Full or partial lease. Lease.
TXN.LEASE_TERM / TXN.LEASE_START / TXN.LEASE_END / TXN.RENEWAL_TERMS - Lease duration terms. Lease.
TXN.LEASE_FEE - Lease fee. Lease.
TXN.PERMITTED_ACTIVITIES / TXN.USE_RESTRICTIONS / TXN.RESERVED_DAYS / TXN.AUTHORIZED_USERS - Use terms. Lease.
TXN.BOARDING_RESPONSIBILITY / TXN.CARE_RESPONSIBILITY - Care allocation. Lease.
TXN.ROUTINE_VET_RESPONSIBILITY / TXN.EMERGENCY_VET_RESPONSIBILITY / TXN.VET_AUTH_CONTACT - Veterinary allocation. Lease.
TXN.FARRIER_RESPONSIBILITY - Farrier allocation. Lease.
TXN.TRAINING_TERMS - Training provider and restrictions. Lease.
TXN.INSURANCE_REQUIREMENTS - Insurance requirements. Lease.
TXN.LESSOR_EQUIPMENT / TXN.LESSEE_EQUIPMENT - Equipment provided by each party. Lease.
TXN.COMPETITION_TERMS / TXN.COMPETITION_EXPENSES - Competition permissions and cost allocation. Lease.
TXN.RISK_ALLOCATION - Allocation of injury/illness/death/loss-of-use risk. Lease.
TXN.TERMINATION_TERMS - Lease termination notice terms. Lease.

CUT MARKERS
Conditional sections are delimited by paired HTML comments: CUT-START: NAME | condition: ... and CUT-END: NAME. Defined markers: MINOR_PARTICIPANT (guardian certification blocks in participant release, general release, jumper addendum, rules), MINOR_PARTICIPANT_INFO (minor identity blocks in medical auth, lesson and horsemanship order forms), MINOR_CONSENT_TO_TREAT (medical auth section 4), JUMPER_TRAINING_SECTION and JUMPER_TRAINING_FEE (lesson order form, included only when jumper training is selected).

## Key mapping (template files → contract_templates.template_key)

| Owner source doc | template_key |
|---|---|
| company-policies | COMPANY_POLICIES |
| emergency-medical-authorization | HUMAN_EMERGENCY_MEDICAL |
| emergency-veterinary-authorization | HORSE_EMERGENCY_VET |
| equine-services-release | RELEASE_HORSE_CARE **and** RELEASE_HORSE_EXERCISE (same body, both keys preserved for the matrix/kiosk) |
| general-liability-release | RELEASE_GENERAL |
| participant-liability-release | RELEASE_PARTICIPANT |
| property-rules-conduct-agreement | FACILITY_RULES |
| jumper-training-addendum | RIDER_LESSON_JUMPER |
| riding-lesson-agreement (order form) | RIDER_LESSON |
| horsemanship-training-agreement (order form) | HORSEMANSHIP_TRAINING |
| horse-training-agreement (order form) | HORSE_TRAINING |
| horse-exercise-agreement (order form) | HORSE_EXERCISE |
| horse-evaluation-agreement (order form) | HORSE_EVALUATION |
| horse-lease-agreement | HORSE_LEASE |
| horse-purchase-sale-agreement | HORSE_PURCHASE_SALE |
| horse-sale-transfer-agreement | HORSE_SALE_TRANSFER |
| horse-search-retainer-agreement | HORSE_SEARCH_RETAINER |
| horse-transaction-representation-agreement | HORSE_TRANSACTION_REP |

All signed documents now use a single CLIENT signer block (`SIG.CLIENT.*` + `CLIENT.PRINTED_NAME`); minors are handled by CUT-marker sections (no separate ADULT/MINOR SIGNER marker blocks; no GUARDIAN co-signer namespace in the release bodies). MINOR_RIDER template retired (no source file).
