# HORSE_LEASE_V2 — full template extract

Every section, clause, field, option list, helper text and conditional in the
live lease template, in render order. Companion to INFO_BUTTON_AUDIT.md and
CONDITIONAL_CLAUSES.md — clause keys and field keys match across all three.

Legend:
  **CONDITIONAL** — appears only when the stated expression is true.
  *(info)* — the text behind that item's info button.
  `{{TOKEN}}` — an input rendered inline in the clause prose.
  Fields list their input kind, and their choices where they have a fixed set.

---


## 1. Parties

`PARTIES`

### Intro

`PARTIES.INTRO`

*(info)* The parties to the lease. Owner (Lessor) leases the horse to the Lessee.

> This Horse Lease Agreement (the "Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} by and between {{LESSOR.FULL_NAME}} of {{LESSOR.ADDRESS}} ("Lessor") and {{LESSEE.FULL_NAME}} of {{LESSEE.ADDRESS}} ("Lessee").

- **Lessor is an** — `LESSOR.PARTY_TYPE` · input: select
    - choices: Individual, Entity / organization
    - *(info)* Set from the Lessor's contact record (company vs person) at creation; override if needed. Chooses which "Lessor Parties" definition applies.
- **Lessee is an** — `LESSEE.PARTY_TYPE` · input: select
    - choices: Individual, Entity / organization
    - *(info)* Derived from the Lessee's contact record (company vs person) at creation; override if needed. Drives the entity-specific representations, CCC insurance, and Coordination of Coverage clauses.

## 2. The Horse

`HORSE`

### Horse

`HORSE.IDENTITY`

*(info)* Identity of the leased horse. Most of this auto-fills from the horse's record.

> This Agreement applies to the following horse (the "Horse"): {{HORSE.REGISTERED_NAME}}
> Color: {{HORSE.COLOR}}
> Markings: {{HORSE.MARKINGS}}
> Breed: {{HORSE.BREED}}
> Registration Number: {{HORSE.REGISTRATION_NUMBER}}
> Sex: {{HORSE.SEX}}
> Year foaled: {{HORSE.AGE_DOB}}
> Current fair market value: {{HORSE.FAIR_MARKET_VALUE}}
> Microchip: {{HORSE.MICROCHIP}}
> Passport: {{HORSE.PASSPORT_NUMBER}}

- **Registered name** — `HORSE.REGISTERED_NAME` · input: text
- **Color** — `HORSE.COLOR` · input: select
    - choices: Bay, Chestnut, Gray, Black, Brown, Roan, Palomino, Pinto / Paint, Buckskin, Dun, White / Cremello
- **Markings** — `HORSE.MARKINGS` · input: text
    - *(info)* e.g. blaze, socks, snip
- **Breed** — `HORSE.BREED` · input: select
    - choices: Warmblood, Thoroughbred, Quarter Horse, Arabian, Pony, Draft, Appaloosa, Morgan, Friesian, Andalusian, Mustang, Crossbred / Grade
- **Registration number** — `HORSE.REGISTRATION_NUMBER` · input: text
- **Sex** — `HORSE.SEX` · input: select
    - choices: Mare, Gelding, Stallion, Colt, Filly
- **Year foaled** — `HORSE.AGE_DOB` · input: text
- **Fair market value** — `HORSE.FAIR_MARKET_VALUE` · input: currency
    - *(info)* Used to compute liquidated damages if the horse is lost or injured.
- **Microchip #** — `HORSE.MICROCHIP` · input: text
- **Passport #** — `HORSE.PASSPORT_NUMBER` · input: text
### Ownership of the Horse

`HORSE.OWNERSHIP`

*(info)* e.g. a lease, community-property spouse, installment purchase, or a prior seller's right of first refusal.

> Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.

### Coowners

`HORSE.COOWNERS`

> Co-owners: {{TXN.CO_OWNERS}}

- **Co-owner(s)** — `TXN.CO_OWNERS` · input: contacts_list
    - *(info)* Add Co-Owner
### Ownership Limits Q

`HORSE.OWNERSHIP_LIMITS_Q`

> Are there any ownership related leasing restrictions? {{TXN.HAS_OWNERSHIP_LIMITS}}

- **Any limitations on ownership?** — `TXN.HAS_OWNERSHIP_LIMITS` · input: yesno
    - *(info)* Choose Yes only if there are liens, encumbrances, or other limitations to describe.
### Ownership Limits

`HORSE.OWNERSHIP_LIMITS`

**CONDITIONAL** — shows when: TXN.HAS_OWNERSHIP_LIMITS = YES

> Ownership related leasing restrictions: {{TXN.OWNERSHIP_LIMITATIONS}}

- **Ownership limitations** — `TXN.OWNERSHIP_LIMITATIONS` · input: longtext
### Behavior

`HORSE.BEHAVIOR`

*(info)* Whether the Lessee relies on their own knowledge of the horse's behavior, or the Owner warrants no history of dangerous behavior except as noted.

> The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.

- **Any exceptions to note?** — `TXN.BEHAVIOR_HAS_EXCEPTIONS` · input: yesno
    - *(info)* The Lessor warrants the Horse has no history of dangerous behavior. Choose Yes only to note specific known behaviors.
### Behavior Exc

`HORSE.BEHAVIOR_EXC`

**CONDITIONAL** — shows when: TXN.BEHAVIOR_HAS_EXCEPTIONS = YES

> The Lessor notes the following known exceptions to the behavior of the Horse: {{TXN.BEHAVIOR_EXCEPTIONS}}.

- **Known behavior exceptions** — `TXN.BEHAVIOR_EXCEPTIONS` · input: longtext
    - *(info)* List any known behaviors — e.g. biting, kicking, bucking, rearing, bolting, trailer-loading or farrier issues.
### Physical Condition

`HORSE.CONDITION`

*(info)* Whether the Lessee relies on their own knowledge of the horse's condition, or the Owner warrants it is sound except as noted.

> The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement.

- **Any exceptions to note?** — `TXN.CONDITION_HAS_EXCEPTIONS` · input: yesno
    - *(info)* The Lessor warrants the Horse is sound and in good condition. Choose Yes only to note specific known illnesses, lamenesses, or physical conditions.
### Condition Exc

`HORSE.CONDITION_EXC`

**CONDITIONAL** — shows when: TXN.CONDITION_HAS_EXCEPTIONS = YES

> The Lessor notes the following known exceptions to the physical condition of the Horse: {{TXN.CONDITION_EXCEPTIONS}}.

- **Known condition exceptions** — `TXN.CONDITION_EXCEPTIONS` · input: longtext
    - *(info)* List any known illnesses, lamenesses, or physical conditions the Lessee should be aware of.
### Pre-Lease Veterinary Examination

`HORSE.VET_CHECK`

*(info)* ELS recommends a pre-lease vet exam. Choose who arranges and pays for it (the ELS default is the Lessee, but this is a selectable term).

> Pre-lease veterinary examination of the Horse: {{TXN.VET_CHECK_CHOICE}}

- **Pre-lease veterinary examination** — `TXN.VET_CHECK_CHOICE` · input: buttons
    - choices: Lessee requested at their own expense, Lessee requested at Lessor's expense, Lessor provided at no cost, Lessee waives the option
### Pre-Lease Trainer Evaluation

`HORSE.TRAINER_EVAL`

> Pre-lease trainer evaluation of the Horse: {{TXN.TRAINER_EVAL_CHOICE}}

### Disclaimer of Warranties

`HORSE.WARRANTY`

> Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE.

- **Professional suitability evaluation** — `TXN.TRAINER_EVAL_CHOICE` · input: buttons
    - choices: Lessee requested at their own expense, Lessee requested at Lessor's expense, Lessor provided at no cost, Lessee waives the option

## 3. Purpose and Lease Grant

`PURPOSE`

### Purpose of Agreement

`PURPOSE.RECREATION`

**CONDITIONAL** — shows when: TXN.LEASE_PURPOSE is one of (RECREATIONAL, INSTRUCTIONAL, COMPETITION, COMMERCIAL)

> For {{TXN.LEASE_PURPOSE}} purposes, Lessee wishes to ride and/or handle Lessor's horse, and Lessor agrees to allow Lessee to ride and/or handle Lessor's horse in exchange for the consideration described herein.

- **Purpose of the lease** — `TXN.LEASE_PURPOSE` · input: select
    - choices: recreational, instructional, competition, commercial program
    - *(info)* Unset renders the neutral "For the purposes permitted herein" phrasing.
### Purpose of Agreement

`PURPOSE.RECREATION_DEFAULT`

**CONDITIONAL** — shows when: TXN.LEASE_PURPOSE is unset

> For the purposes permitted herein, Lessee wishes to ride and/or handle Lessor's horse, and Lessor agrees to allow Lessee to ride and/or handle Lessor's horse in exchange for the consideration described herein.

### Lease Grant

`PURPOSE.GRANT`

> Subject to the terms and conditions of this Agreement, Lessor agrees to lease to Lessee and Lessee agrees to lease from Lessor the horse described below.

### Lease Type

`PURPOSE.LEASE_TYPE`

> Lease type: {{TXN.LEASE_TYPE}}.

- **Lease type** — `TXN.LEASE_TYPE` · input: select
    - choices: Full lease (full-time access), Partial lease (shared or limited access)
    - *(info)* Full lease gives the Lessee full-time access and care responsibility. Partial lease is shared or limited; the Owner retains responsibility for the Horse's exercise and use.

## 4. Definitions; Binding Effect; Third-Party Beneficiaries

`DEFINITIONS`

### Lessor Ind

`DEFINITIONS.LESSOR_IND`

**CONDITIONAL** — shows when: LESSOR.PARTY_TYPE = INDIVIDUAL (or unset)

> "Lessor Parties" means Lessor and Lessor's heirs, next of kin, spouse, estate, executors, administrators, legal representatives, successors, and assigns.

### Lessor Ent

`DEFINITIONS.LESSOR_ENT`

**CONDITIONAL** — shows when: LESSOR.PARTY_TYPE = ENTITY

> "Lessor Parties" means Lessor and, as applicable, Lessor's owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers, and the family members of any of the foregoing. With respect to each natural person falling within any of the foregoing categories, "Lessor Parties" also includes that person's heirs, next of kin, spouse, estate, executors, administrators, legal representatives, successors, and assigns, in each case to the same extent as if that person had entered into this Agreement individually as Lessor.

### Lessee Ind

`DEFINITIONS.LESSEE_IND`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = INDIVIDUAL (or unset)

> "Lessee Parties" means Lessee and Lessee's heirs, next of kin, spouse, estate, executors, administrators, legal representatives, successors, and assigns.

### Lessee Ent

`DEFINITIONS.LESSEE_ENT`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY

> "Lessee Parties" means Lessee and, as applicable, Lessee's owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers, and the family members of any of the foregoing. With respect to each natural person falling within any of the foregoing categories, "Lessee Parties" also includes that person's heirs, next of kin, spouse, estate, executors, administrators, legal representatives, successors, and assigns, in each case to the same extent as if that person had entered into this Agreement individually as Lessee.

### Binding

`DEFINITIONS.BINDING`

> Each party enters into this Agreement on behalf of itself and all of its respective Lessor Parties or Lessee Parties, as applicable, and all releases, waivers, assumptions of risk, and covenants made by a party under this Agreement are made on behalf of all of that party's Parties and bind each of them to the same extent as the party itself.

### Beneficiaries

`DEFINITIONS.BENEFICIARIES`

> Each Lessor Party and each Lessee Party is an intended third-party beneficiary of the releases, waivers, assumptions of risk, and limitations of liability in this Agreement and may enforce them directly.


## 5. Schedule for Lessee's Usage

`SCHEDULE`

### Schedule for Lessee's Usage

`SCHEDULE.MAIN`

**CONDITIONAL** — shows when: TXN.LEASE_TYPE = PARTIAL

*(info)* When Lessee may use the horse. Pick a schedule type, and mark specific days on the grid where applicable.

> Reserved days of use: {{TXN.DAYS_USED}}

- **Reserved days of use** — `TXN.DAYS_USED` · input: week_grid
    - *(info)* Mark the days of the week reserved for Lessee's use (applies when the schedule is specific days).
### Other

`SCHEDULE.OTHER`

**CONDITIONAL** — shows when: TXN.LEASE_TYPE = PARTIAL

> Additional or custom schedule terms: {{TXN.SCHEDULE_TERMS}}

- **Additional schedule terms** — `TXN.SCHEDULE_TERMS` · input: longtext
    - *(info)* Describe the usage schedule the parties agree to.
### Schedule Changes

`SCHEDULE.CHANGES`

**CONDITIONAL** — shows when: TXN.LEASE_TYPE = PARTIAL

> Any changes to the agreed upon schedule must be made and accepted in writing.


## 6. Lease Fee

`LEASE_FEE`

### Choice

`LEASE_FEE.CHOICE`

> {{TXN.LEASE_FEE}}

- **Lease fee** — `TXN.LEASE_FEE` · input: fee_schedule
    - *(info)* Set the initial payment due, then add one or more monthly fee options. When more than one option is present, select the one that applies.

## 7. Payment Terms

`PAYMENT_TERMS`

### Right of Offset

`PAYMENT_TERMS.OFFSET`

> A party to whom money is owed under this Agreement may offset the amount owed against any amount that party owes to the other party.

### Receipts

`PAYMENT_TERMS.RECEIPTS`

> A party seeking reimbursement for an expense paid on behalf of the other party shall provide a receipt or other reasonable documentation of the expense as a condition of reimbursement.

### Late Payments

`PAYMENT_TERMS.LATE`

*(info)* Late fee, interest rate, and the grace period before interest begins to accrue.

> All payments are due on their due date or within 5 business days of notification of the amount owed. Payments will be deemed late if they remain unpaid on the 6th business day. Late payments are considered a breach of the contract terms and may be grounds for termination of the Agreement unless the party from whom the payment is owed has communicated in writing the date by which payment will be made. Payments exceeding 1 calendar month in past-due status constitute grounds for termination for cause under the Termination for Cause provisions of this Agreement unless prior written acceptance of the delay is provided by the party to whom the payment is owed.


## 8. Payment Method

`PAYMENT_METHOD`

*(info)* How each party may pay amounts owed under this Agreement.  Select every method the party may use to pay.  Credit cards List the name of the processor(s) and access information (e.g. emailed invoice with link, text message with payment link, payment url inserted here, etc).

### Payments by the Lessee

`PAYMENT_METHOD.MAIN`

> The Lessee may pay amounts owed under this Agreement by the following method(s): {{TXN.PAYMENT_METHODS}}

- **Accepted payment methods** — `TXN.PAYMENT_METHODS` · input: buttons
    - choices: Cash, Zelle, Credit Card
### Card

`PAYMENT_METHOD.CARD`

**CONDITIONAL** — shows when: TXN.PAYMENT_METHODS includes CREDIT_CARD

> Credit card payments are processed as follows: {{TXN.CARD_PROCESSOR}}

- **Card processor & instructions** — `TXN.CARD_PROCESSOR` · input: longtext
### Payments by the Lessor

`PAYMENT_METHOD.MAIN_LESSOR`

> The Lessor may pay amounts owed under this Agreement by the following method(s): {{TXN.LESSOR_PAYMENT_METHODS}}

- **Accepted payment methods** — `TXN.LESSOR_PAYMENT_METHODS` · input: buttons
    - choices: Cash, Zelle, Credit Card
### Card Lessor

`PAYMENT_METHOD.CARD_LESSOR`

**CONDITIONAL** — shows when: TXN.LESSOR_PAYMENT_METHODS includes CREDIT_CARD

> Credit card payments are processed as follows: {{TXN.LESSOR_CARD_PROCESSOR}}

- **Card processor & instructions** — `TXN.LESSOR_CARD_PROCESSOR` · input: longtext

## 9. Location of Horse

`LOCATION`

### Location of the Horse

`LOCATION.MAIN`

*(info)* Where Horse is kept during the lease. Choose the Owner's home address or another facility.

> Location of the Horse: {{HORSE.CURRENT_LOCATION}}.

- **Facility** — `HORSE.CURRENT_LOCATION` · input: location
    - *(info)* The barn or facility where Horse is kept.
### Move Choice

`LOCATION.MOVE_CHOICE`

- **Horse will move to a new location for the Lessee** — `TXN.HORSE_MOVES` · input: yesno
    - *(info)* Check yes if the Horse will be kept at a different location during the lease. A location block will appear to fill in manually.
### New

`LOCATION.NEW`

**CONDITIONAL** — shows when: TXN.HORSE_MOVES = YES

> Location during lease term: {{TXN.NEW_LOCATION}}.

- **Location during lease term** — `TXN.NEW_LOCATION` · input: location
    - *(info)* Facility / place name, full street address, and any notes for locating the Horse — access codes and the property manager's contact information.
### Inspection

`LOCATION.INSPECTION`

> Lessor may inspect the Horse at any time. If Lessor determines that the Horse is not being properly cared for, Lessor may take possession of the Horse.


## 10. Evaluation Period

`EVALUATION`

### Choice

`EVALUATION.CHOICE`

*(info)* An optional trial window at the start of the lease during which either party may end the arrangement.

- **Evaluation period** — `TXN.EVALUATION_ENABLED` · input: buttons
    - choices: Requested by Lessee, Required by Lessor, Refused by Lessor, Waived by Lessee
    - *(info)* Whether an evaluation (trial) period applies. Choose Requested or Required to set its length.
### Evaluation Period Details

`EVALUATION.DATES_INCLUDED`

**CONDITIONAL** — shows when: TXN.EVALUATION_ENABLED is one of (REQUESTED, REQUIRED) AND TXN.EVAL_FIXED_LENGTH is unset AND TXN.EVAL_FIXED_UNIT is unset AND TXN.EVAL_FIXED_FEE is unset

> Lessee shall have an evaluation period of {{TXN.EVAL_INCLUDED_LENGTH}} {{TXN.EVAL_INCLUDED_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is included at no separate charge, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.

- **Length** — `TXN.EVAL_INCLUDED_LENGTH` · input: number
    - *(info)* How long the evaluation period lasts (enter the number first).
- **Unit** — `TXN.EVAL_INCLUDED_UNIT` · input: select
    - choices: day, week, month, days, weeks, months
    - **CONDITIONAL** — shows when: TXN.EVAL_INCLUDED_LENGTH >= 1
### Evaluation Period Details

`EVALUATION.DATES_FIXED`

**CONDITIONAL** — shows when: TXN.EVALUATION_ENABLED is one of (REQUESTED, REQUIRED) AND TXN.EVAL_INCLUDED_LENGTH is unset AND TXN.EVAL_INCLUDED_UNIT is unset

> Lessee shall have an evaluation period of {{TXN.EVAL_FIXED_LENGTH}} {{TXN.EVAL_FIXED_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is {{TXN.EVAL_FIXED_FEE}}, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.

- **Length** — `TXN.EVAL_FIXED_LENGTH` · input: number
    - *(info)* How long the evaluation period lasts (enter the number first).
- **Unit** — `TXN.EVAL_FIXED_UNIT` · input: select
    - choices: day, week, month, days, weeks, months
    - **CONDITIONAL** — shows when: TXN.EVAL_FIXED_LENGTH >= 1
- **Evaluation period fee amount** — `TXN.EVAL_FIXED_FEE` · input: currency

## 11. Agreement Term

`TERM`

### Agreement Term

`TERM.MAIN`

*(info)* How long the lease runs. A fixed period has a set end date; an open-ended lease continues until terminated.

> Term of this Agreement: {{TXN.LEASE_TERM_TYPE}}. This Agreement begins on {{TXN.LEASE_START}}.

- **Term type** — `TXN.LEASE_TERM_TYPE` · input: select
    - choices: Fixed period, Open-ended, Other
    - *(info)* A fixed period ends on a set date; an open-ended lease continues until either party terminates it.
- **Lease start date** — `TXN.LEASE_START` · input: date
### Fixed End

`TERM.FIXED_END`

**CONDITIONAL** — shows when: TXN.LEASE_TERM_TYPE = FIXED

> This Agreement continues until {{TXN.LEASE_END}}.

- **Lease end date** — `TXN.LEASE_END` · input: date
    - *(info)* Leave blank for an open-ended lease.
### Renewal Terms

`TERM.RENEWAL`

**CONDITIONAL** — shows when: TXN.RENEWAL_INCLUDE = YES

*(info)* Any renewal, extension, or other term arrangement not covered by a simple start and end date.

> Renewal terms: {{TXN.RENEWAL_TERMS}}

- **Include renewal terms** — `TXN.RENEWAL_INCLUDE` · input: certify
    - *(info)* Checking this box adds a renewal-terms clause to the lease. Leaving it unchecked omits it.
- **Renewal terms** — `TXN.RENEWAL_TERMS` · input: longtext
    - *(info)* Describe any renewal, extension, or other arrangement.
### Additional

`TERM.ADDITIONAL`

> Additional terms: {{TXN.ADDITIONAL_TERMS}}

- **Add additional terms** — `TXN.ADDITIONAL_TERMS` · input: add_text
    - *(info)* Additional terms
### Termination Xref

`TERM.TERMINATION_XREF`

> Notwithstanding the term stated above, this Agreement may be terminated earlier as provided in the Termination section of this Agreement.


## 12. Permitted Use(s) & Restrictions

`PERMITTED_USE`

### Permitted Use(s)

`PERMITTED_USE.MAIN`

*(info)* Check every activity Lessee is allowed to use the horse for. Any use not checked requires the Owner's written consent.

> Lessor grants Lessee the right to use the Horse for the following purpose(s): {{TXN.PERMITTED_ACTIVITIES}}
> Lessee shall not use the Horse for any other purpose without Lessor's prior written consent.

- **Permitted activities** — `TXN.PERMITTED_ACTIVITIES` · input: buttons
    - choices: Riding Lessons, Solo Arena Riding, Group Arena Riding, Jumping, Competitions, Trail Riding
    - *(info)* Select every activity the Lessee may do with the Horse. Riding Lessons, Horse Training, Jumping, and Competitions require an approved Trainer to be present.
### Trainer

`PERMITTED_USE.TRAINER`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes one of (LESSONS, JUMPING, COMPETITIONS)

> Riding Lessons, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trainer or Instructor is present.

### Lessons

`TRAINING_LESSONS.LESSONS`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = INDIVIDUAL (or unset)

*(info)* Whether Lessee must take riding lessons as a condition of the lease, and with whom.

> Lessee is required to maintain continuous enrollment in weekly riding lessons: {{TXN.LESSONS_REQUIRED}}.
> Lessons shall be conducted only by a French Heritage Equestrian Approved Instructor.

- **Lessee required to take lessons?** — `TXN.LESSONS_REQUIRED` · input: yesno
    - *(info)* Whether Lessee must take riding lessons as a condition of the lease.
### Lessons

`TRAINING_LESSONS.LESSONS_ENTITY`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY

*(info)* Whether the entity Lessee may provide riding lessons with the Horse.

> Lessee is permitted by Lessor to provide riding lessons with the Horse: {{TXN.LESSONS_ENTITY_PERMITTED}}.

- **Lessee permitted to provide riding lessons?** — `TXN.LESSONS_ENTITY_PERMITTED` · input: yesno
### Training

`TRAINING_LESSONS.TRAINING`

*(info)* Whether Horse is in professional training during the lease, and with whom.

> Any professional training of the Horse under this Agreement, including groundwork, schooling, and under-saddle training, shall be conducted only by a French Heritage Equestrian Approved Trainer.

### Competitions

`COMPETITIONS.INTRO`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS

*(info)* Whether and on what terms the Lessee may compete on the horse.

> Expenses of competition (entry fees, transportation, and the like) are: {{TXN.COMPETITION_EXPENSES}}.
> Any prize money or winnings earned in competition shall belong to: {{TXN.COMPETITION_WINNINGS}}.

- **Competition expenses** — `TXN.COMPETITION_EXPENSES` · input: select
    - choices: Paid by Lessee, Paid by Lessor, Other
    - *(info)* Who pays the expenses of competing.
- **Competition winnings** — `TXN.COMPETITION_WINNINGS` · input: select
    - choices: Lessee, Lessor, Other
    - *(info)* Who keeps any prize money or winnings.
### Jumping Restrictions

`RESTRICT.JUMP_TITLE`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes JUMPING

> {{TXN.JUMP_OMIT}}

- **No jumping restrictions** — `TXN.JUMP_OMIT` · input: certify
### Jump On

`RESTRICT.JUMP_ON`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes JUMPING AND TXN.JUMP_OMIT = NO (or unset)

> Jumping is restricted as follows: maximum height {{TXN.JUMP_MAX_HEIGHT}}; no more than {{TXN.JUMP_DAYS_PER_WEEK}} days per week; under trainer supervision only: {{TXN.JUMP_SUPERVISION}}.

- **Maximum height** — `TXN.JUMP_MAX_HEIGHT` · input: text
    - *(info)* e.g. max feet.
- **Days per week** — `TXN.JUMP_DAYS_PER_WEEK` · input: number
- **Only under trainer supervision?** — `TXN.JUMP_SUPERVISION` · input: yesno
### Jump Off

`RESTRICT.JUMP_OFF`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes JUMPING AND TXN.JUMP_OMIT = YES

> Lessor does not restrict jumping.

### Competition Restrictions

`RESTRICT.COMP_TITLE`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS

> {{TXN.COMP_OMIT}}

- **No competition restrictions** — `TXN.COMP_OMIT` · input: certify
### Comp On

`RESTRICT.COMP_ON`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS AND TXN.COMP_OMIT = NO (or unset)

> Competitions are restricted as follows: {{TXN.COMP_RESTRICTION}}.

- **Competition restriction** — `TXN.COMP_RESTRICTION` · input: text
### Comp Off

`RESTRICT.COMP_OFF`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS AND TXN.COMP_OMIT = YES

> Lessor does not restrict competitions.

### Trail-Riding Restrictions

`RESTRICT.TRAIL_TITLE`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes TRAIL

> {{TXN.TRAIL_OMIT}}

- **No trail-riding restrictions** — `TXN.TRAIL_OMIT` · input: certify
### Trail On

`RESTRICT.TRAIL_ON`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes TRAIL AND TXN.TRAIL_OMIT = NO (or unset)

> Trail riding is restricted as follows: {{TXN.TRAIL_RESTRICTION}}.

- **Trail-riding restriction** — `TXN.TRAIL_RESTRICTION` · input: text
### Trail Off

`RESTRICT.TRAIL_OFF`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes TRAIL AND TXN.TRAIL_OMIT = YES

> Lessor does not restrict trail riding.

### Additional Restrictions

`PERMITTED_USE.RESTRICTIONS`

> Additional restrictions: {{TXN.PERMITTED_RESTRICTIONS}}

- **Add Restrictions** — `TXN.PERMITTED_RESTRICTIONS` · input: add_text
    - *(info)* Restrictions on the permitted activities
### Other Allowed Activities

`PROHIBITED.OTHER`

**CONDITIONAL** — shows when: TXN.ADDITIONAL_ACTIVITIES includes one of (BREEDING, EMOTIONAL_SUPPORT, FILM_TV_AD, OTHER)

*(info)* Any additional activities the Owner wishes to prohibit.

> Lessee is permitted to engage in the following additional activities with the Horse: {{TXN.ADDITIONAL_ACTIVITIES}}.

- **Additional permitted activities** — `TXN.ADDITIONAL_ACTIVITIES` · input: buttons
    - choices: None — no additional activities, Breeding, Emotional Support Services, Film / Television / Advertising, Other
    - *(info)* Additional activities GRANTED to Lessee beyond the permitted uses in the Permitted Use(s) clause. Anything not granted remains prohibited by the catch-all. Unset or None renders the no-additional-activities statement.
### Other Allowed Activities

`PROHIBITED.OTHER_NONE`

**CONDITIONAL** — shows when: TXN.ADDITIONAL_ACTIVITIES = NONE (or unset)

> Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.

### Other Note

`PROHIBITED.OTHER_NOTE`

**CONDITIONAL** — shows when: TXN.ADDITIONAL_ACTIVITIES includes OTHER

> Other additional permitted activity: {{TXN.ADDITIONAL_ACTIVITIES_OTHER}}.

- **Other additional permitted activity** — `TXN.ADDITIONAL_ACTIVITIES_OTHER` · input: text
    - **CONDITIONAL** — shows when: TXN.ADDITIONAL_ACTIVITIES includes OTHER
    - *(info)* An additional activity Lessee is permitted to engage in; restrictions belong in Additional Restrictions.
### Allowing Others to Ride

`PROHIBITED.OTHERS`

*(info)* Who besides the Lessee may ride or handle the horse without asking the Owner.

> The following additional persons may ride or handle the Horse without Lessor's prior permission: {{TXN.OTHERS_ALLOWED}}.
> Only the persons identified above shall be permitted to ride or handle the Horse without Lessor's written permission.

- **Others allowed to ride** — `TXN.OTHERS_ALLOWED` · input: buttons
    - choices: None, Lessee's family members, The trainer/instructor, Riding Lesson Participants, Other
    - *(info)* Select who besides the Lessee may ride or handle the horse without the Owner's permission.
### Others Other

`PROHIBITED.OTHERS_OTHER`

**CONDITIONAL** — shows when: TXN.OTHERS_ALLOWED includes OTHER

> Other persons allowed to ride or handle the Horse: {{TXN.OTHERS_ALLOWED_OTHER}}.

- **Other persons allowed** — `TXN.OTHERS_ALLOWED_OTHER` · input: text
    - **CONDITIONAL** — shows when: TXN.OTHERS_ALLOWED includes OTHER
    - *(info)* Name the other person(s) allowed to ride or handle the Horse.
### Releases Required for Authorized Riders

`PERMITTED_USE.RELEASES_REQUIRED`

> All persons other than Lessee must have executed Lessee's liability release, which has been reviewed and approved by Lessor, prior to handling or riding the Horse. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.

### Transport of the Horse

`PERMITTED_USE.TRANSPORT`

> Transport of the Horse to offsite locations (other than for medical care, which is always permitted): {{TXN.OFFSITE_TRANSPORT}}
> For clarity, riding trails attached to the location at which the Horse is kept under this Agreement are not offsite locations.

- **Offsite transport** — `TXN.OFFSITE_TRANSPORT` · input: select
    - choices: Lessor grants permission to transport offsite, Lessor prohibits offsite transport without written consent
    - *(info)* Controls whether the Lessee may take the Horse to offsite locations for any reason other than medical care. Riding trails attached to the stated location are not considered offsite.

## 13. Horse Care and Expenses

`CARE`

### Lessee's Responsibility for Care and Exercise

`SCHEDULE.CARE_DUTY`

**CONDITIONAL** — shows when: TXN.EXERCISE_INCLUDE = YES

*(info)* The lease schedule carries a duty of consistent care; 24 hours' notice is required if Lessee cannot make a scheduled day.

> Lessee's use of the Horse is a responsibility as well as a right: regular, consistent exercise and attention are important to the Horse's health and wellbeing. Lessee is required to maintain regular use and exercise for the Horse on their allowed days, unless Lessee has discussed with and received mutual agreement from the Lessor in writing that one of those days will be used as a rest day for the Horse. If Lessee regularly fails to use and care for the Horse, Lessor may terminate this Agreement.

- **Include Lessee care & exercise responsibility** — `TXN.EXERCISE_INCLUDE` · input: certify
    - *(info)* Checking this box adds the care-and-exercise obligation clause to the lease. Leaving it unchecked omits that clause.
### 3rd Party Exercise

`SCHEDULE.TRAINER_CARE`

**CONDITIONAL** — shows when: TXN.TRAINER_CARE_INCLUDE = YES

> Lessee is permitted to engage an approved 3rd party to exercise the Horse. All 3rd party exercise shall be conducted only by a French Heritage Equestrian Approved Trainer. Other 3rd parties must be approved in writing by the Lessor.
> Party responsible for arranging: {{TXN.TRAINER_EXERCISE_ARRANGE}}
> Party responsible for costs: {{TXN.TRAINER_EXERCISE_COST}}
> Lessee's share of the cost: {{TXN.TRAINER_EXERCISE_SPLIT_PCT}}

- **Include 3rd party exercise** — `TXN.TRAINER_CARE_INCLUDE` · input: certify
    - *(info)* Checking this box adds the clause permitting the Lessee to hire the approved trainer to exercise the Horse. Leaving it unchecked omits that clause.
- **Party responsible for arranging** — `TXN.TRAINER_EXERCISE_ARRANGE` · input: select
    - choices: Lessee, Lessor, Shared
    - **CONDITIONAL** — shows when: TXN.TRAINER_CARE_INCLUDE = YES
    - *(info)* Who arranges the 3rd party exercise.
- **Party responsible for costs** — `TXN.TRAINER_EXERCISE_COST` · input: select
    - choices: Lessee, Lessor, Shared
    - **CONDITIONAL** — shows when: TXN.TRAINER_CARE_INCLUDE = YES
    - *(info)* Who pays for the 3rd party exercise.
- **Lessee's share of the cost** — `TXN.TRAINER_EXERCISE_SPLIT_PCT` · input: percent
    - **CONDITIONAL** — shows when: TXN.TRAINER_CARE_INCLUDE = YES AND TXN.TRAINER_EXERCISE_COST = SHARED
    - *(info)* Lessee's percentage share of the 3rd party exercise cost; the remainder is the Lessor's.
### Intro

`CARE.INTRO`

> Horse care and expenses shall be managed and paid for by the responsible party as listed below.

### Supplements

`CARE.SUPPLEMENTS`

*(info)* Supplements means any medication, vitamin, mineral, or other feed additive Horse regularly receives. List them and identify who administers them.

> {{TXN.MEDICATIONS}}

- **Medications and supplements** — `TXN.MEDICATIONS` · input: med_schedule
    - *(info)* Add each medication or supplement with its dose and schedule, and set the party responsible for administering, for ordering, and for its cost (each can be a different party).
### Farrier Care

`CARE.FARRIER`

*(info)* Who arranges routine hoof care (trimming and shoeing), and Horse's preferred farrier.

> Party responsible for arranging: {{TXN.FARRIER_ARRANGE}}
> Party responsible for costs: {{TXN.FARRIER_COST_PARTY}}
> Farrier: {{HORSE.FARRIER_NAME}}
> Farrier phone: {{HORSE.FARRIER_PHONE}}

- **Party responsible for arranging** — `TXN.FARRIER_ARRANGE` · input: select
    - choices: Lessor, Lessee, Trainer/Instructor, Boarding Staff, Other
- **Farrier** — `HORSE.FARRIER_NAME` · input: text
    - **CONDITIONAL** — shows when: TXN.FARRIER_ARRANGE = LESSEE
    - *(info)* Farrier on the horse record.
- **Party responsible for costs** — `TXN.FARRIER_COST_PARTY` · input: select
    - choices: Lessor, Lessee, Trainer/Instructor, Boarding Staff, Other
- **Farrier phone** — `HORSE.FARRIER_PHONE` · input: text
    - **CONDITIONAL** — shows when: TXN.FARRIER_ARRANGE = LESSEE
    - *(info)* Farrier phone on the horse record.
### Veterinary Care

`CARE.ROUTINE_VET`

*(info)* Routine Veterinary Care means vaccinations, de-worming, dental care, and other regular preventive treatments provided on a normal schedule. Identify who arranges it and Horse's preferred veterinarian.

> Party responsible for arranging: {{TXN.VET_ARRANGE}}
> Party responsible for costs: {{TXN.VET_COST_PARTY}}
> Veterinarian: {{HORSE.VET_NAME}}
> Practice: {{HORSE.VET_BUSINESS}}
> Address: {{HORSE.VET_ADDRESS}}
> Veterinarian phone: {{HORSE.VET_PHONE}}

- **Party responsible for arranging** — `TXN.VET_ARRANGE` · input: select
    - choices: Lessor, Lessee, Trainer/Instructor, Boarding Staff, Other
- **Veterinarian** — `HORSE.VET_NAME` · input: text
    - **CONDITIONAL** — shows when: TXN.VET_ARRANGE = LESSEE
    - *(info)* Veterinarian on the horse record.
- **Party responsible for costs** — `TXN.VET_COST_PARTY` · input: select
    - choices: Lessor, Lessee, Trainer/Instructor, Boarding Staff, Other
- **Practice** — `HORSE.VET_BUSINESS` · input: text
    - **CONDITIONAL** — shows when: TXN.VET_ARRANGE = LESSEE
    - *(info)* Veterinary practice on the horse record.
- **Address** — `HORSE.VET_ADDRESS` · input: text
    - **CONDITIONAL** — shows when: TXN.VET_ARRANGE = LESSEE
    - *(info)* Veterinary address on the horse record.
- **Veterinarian phone** — `HORSE.VET_PHONE` · input: text
    - **CONDITIONAL** — shows when: TXN.VET_ARRANGE = LESSEE
    - *(info)* Veterinarian phone on the horse record.
### Protective Equipment

`CARE.PROTECTIVE`

*(info)* Protective equipment (such as boots or wraps) required for particular activities, and who provides it.

> Horse must wear protective equipment: {{TXN.PROTECTIVE_REQUIRED}}

- **Horse must wear protective equipment** — `TXN.PROTECTIVE_REQUIRED` · input: yesno
    - *(info)* Check Yes if the Lessor requires the Horse to wear protective equipment.
### Protective Equip

`CARE.PROTECTIVE_EQUIP`

**CONDITIONAL** — shows when: TXN.PROTECTIVE_REQUIRED = YES

> Lessor will provide the following equipment for the Horse: {{TXN.PROTECTIVE_EQUIPMENT}}
> Lessee must ensure equipment is used and properly secured to the Horse prior to all activities.

- **Protective equipment** — `TXN.PROTECTIVE_EQUIPMENT` · input: buttons
    - choices: Front boots / wraps, Hind boots / wraps, Other
    - *(info)* The protective equipment Horse must wear during those activities.
### Tack

`CARE.TACK`

*(info)* Any saddle, bit, bridle, or other tack that must be used with Horse, and who provides it.

> When riding and handling the Horse, Lessee shall use only tack in good condition that is properly fitted to the Horse.
> {{TXN.TACK_PROHIBITED}}

- **Is Lessee prohibited from using certain tack or equipment?** — `TXN.TACK_PROHIBITED` · input: reveal_text
    - *(info)* List any tack or equipment the Lessee is prohibited from using.
### Rider Aids

`CARE.RIDER_AIDS`

*(info)* Artificial aids Lessee may use when riding Horse.

> The following rider aids are prohibited: {{TXN.RIDER_AIDS}}.

- **Prohibited rider aids** — `TXN.RIDER_AIDS` · input: buttons
    - choices: Crop or bat, Longe whip, Dressage whip, Other
    - *(info)* Select any rider aids the Lessee is prohibited from using. Leave blank if none.
### Rider Aids Other

`CARE.RIDER_AIDS_OTHER`

**CONDITIONAL** — shows when: TXN.RIDER_AIDS includes OTHER

> Other prohibited rider aid: {{TXN.RIDER_AIDS_OTHER}}.

- **Other prohibited rider aid** — `TXN.RIDER_AIDS_OTHER` · input: text
    - *(info)* Describe the other approved rider aid.

## 14. Insurance, Risk of Loss, and Indemnification

`INSURANCE_RISK`

### Insurance Requirements

`INSURANCE_RISK.INSURANCE`

> The parties agree to the insurance elections set forth below. Each policy elected or required below shall be maintained in effect for the duration of this Agreement.

### General Liability Insurance

`INSURANCE_RISK.GENERAL_LIABILITY`

- **General liability insurance is not required for or by either party under this Agreement.** — `TXN.GL_NOT_REQUIRED` · input: certify
### Gl Status

`INSURANCE_RISK.GL_STATUS`

**CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO (or unset)

> Lessor: {{TXN.GL_LESSOR_STATUS}} general liability insurance covering the Horse and the activities contemplated by this Agreement.
> Lessee: {{TXN.GL_LESSEE_STATUS}} general liability insurance covering the Horse and the activities contemplated by this Agreement.

- **Lessor** — `TXN.GL_LESSOR_STATUS` · input: select
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO (or unset)
- **Lessee** — `TXN.GL_LESSEE_STATUS` · input: select
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO (or unset)
### Gl Ded Simple

`INSURANCE_RISK.GL_DED_SIMPLE`

**CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO (or unset)

> If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.GL_DED_RESP}}.

- **Deductible responsibility (Lessee-responsibility claims)** — `TXN.GL_DED_RESP` · input: select
    - choices: Lessor, Lessee, Split, Other
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO (or unset)
    - *(info)* Applies only to claims arising from events for which Lessee bears responsibility; other claims leave the deductible with the policyholder.
### Gl Ded Splitc

`INSURANCE_RISK.GL_DED_SPLITC`

**CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO (or unset) AND TXN.GL_DED_RESP = SPLIT

> The deductible shall be split between the parties: {{TXN.GL_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.GL_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

- **Split — % paid by Lessor** — `TXN.GL_DED_RESP_SPLIT_LESSOR` · input: text
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO (or unset) AND TXN.GL_DED_RESP = SPLIT
    - *(info)* Percentage only (no stated amount to anchor a $ split). The other share auto-fills to total 100%.
- **Split — % paid by Lessee** — `TXN.GL_DED_RESP_SPLIT_LESSEE` · input: text
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO (or unset) AND TXN.GL_DED_RESP = SPLIT
    - *(info)* Percentage only. The other share auto-fills to total 100%.
### Gl None

`INSURANCE_RISK.GL_NONE`

**CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = YES

> Lessor has elected not to require general liability insurance under this Agreement. Lessor accepts full risk and responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement, except as otherwise expressly allocated in this Agreement.

### Mortality Insurance

`INSURANCE_RISK.MORTALITY`

*(info)* Mortality insurance pays out if the Horse dies. Where required, decide who is responsible for obtaining and maintaining the policy.

- **Mortality insurance is not required for or by either party under this Agreement.** — `TXN.MORT_NOT_REQUIRED` · input: certify
### Mort Status

`INSURANCE_RISK.MORT_STATUS`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset)

> Lessor: {{TXN.MORT_LESSOR_STATUS}} mortality insurance on the Horse.
> Lessee: {{TXN.MORT_LESSEE_STATUS}} mortality insurance on the Horse.

- **Lessor** — `TXN.MORT_LESSOR_STATUS` · input: select
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset)
- **Lessee** — `TXN.MORT_LESSEE_STATUS` · input: select
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset)
### Mort Dedr Simple

`INSURANCE_RISK.MORT_DEDR_SIMPLE`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset)

> If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.MORT_DED_RESP}}.

- **Deductible responsibility** — `TXN.MORT_DED_RESP` · input: select
    - choices: Lessor, Lessee, Split, Other
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset)
### Mort Dedr Splitc

`INSURANCE_RISK.MORT_DEDR_SPLITC`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset) AND TXN.MORT_DED_RESP = SPLIT

> The deductible shall be split between the parties: {{TXN.MORT_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MORT_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

- **Deductible split — paid by Lessor** — `TXN.MORT_DED_RESP_SPLIT_LESSOR` · input: text
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset) AND TXN.MORT_DED_RESP = SPLIT
- **Deductible split — paid by Lessee** — `TXN.MORT_DED_RESP_SPLIT_LESSEE` · input: text
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset) AND TXN.MORT_DED_RESP = SPLIT
### Mort None

`INSURANCE_RISK.MORT_NONE`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = YES

> Lessor has elected not to require mortality insurance under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse's value in the event of the Horse's death, theft, or humane destruction, except as otherwise expressly allocated in this Agreement.

### Medical Insurance

`INSURANCE_RISK.MEDICAL`

- **Medical insurance is not required for or by either party under this Agreement.** — `TXN.MED_NOT_REQUIRED` · input: certify
### Med None

`INSURANCE_RISK.MED_NONE`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = YES

> Lessor has elected not to maintain medical insurance on the Horse. Lessor accepts full risk and responsibility for any and all injury to or illness of the Horse during the term of this Agreement, including all costs of veterinary care arising from such injury or illness, except as otherwise expressly allocated in the Horse Care and Expenses section of this Agreement.

### Med Status

`INSURANCE_RISK.MED_STATUS`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset)

> Lessor: {{TXN.MED_LESSOR_STATUS}} medical insurance on the Horse.
> Lessee: {{TXN.MED_LESSEE_STATUS}} medical insurance on the Horse.

- **Lessor** — `TXN.MED_LESSOR_STATUS` · input: select
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset)
- **Lessee** — `TXN.MED_LESSEE_STATUS` · input: select
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset)
### Med Dedr Simple

`INSURANCE_RISK.MED_DEDR_SIMPLE`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset)

> If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.MED_DED_RESP}}.

- **Deductible responsibility** — `TXN.MED_DED_RESP` · input: select
    - choices: Lessor, Lessee, Split, Other
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset)
### Med Dedr Splitc

`INSURANCE_RISK.MED_DEDR_SPLITC`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset) AND TXN.MED_DED_RESP = SPLIT

> The deductible shall be split between the parties: {{TXN.MED_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

- **Deductible split — paid by Lessor** — `TXN.MED_DED_RESP_SPLIT_LESSOR` · input: text
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset) AND TXN.MED_DED_RESP = SPLIT
- **Deductible split — paid by Lessee** — `TXN.MED_DED_RESP_SPLIT_LESSEE` · input: text
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset) AND TXN.MED_DED_RESP = SPLIT
### Med Tail

`INSURANCE_RISK.MED_TAIL`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO (or unset)

> Any out-of-pocket costs for deductibles or other expenses related to the needs of the Horse are to be paid by Lessor, and where Lessee is deemed to be responsible for part or all of a cost paid by Lessor, Lessee shall reimburse Lessor in accordance with the acceptable payment methods stated in this Agreement, or, if Lessee so requests prior to payment by Lessor, Lessee may make such request to pay the billing party directly using a method allowed by that party. Lessee may, with Lessor's written permission, pay for any or all of Lessor's portion when paying the billing party directly, and Lessor may reimburse Lessee in accordance with the terms of this Agreement. Lessor assumes and is responsible for all risks and costs not paid or covered by any policy held by either party, including in the event a policy is not in effect at the time of the incident, an incident for which a claim is made is deemed not to be covered by a policy, a payment for a claim made for an incident that is covered by a policy is less than the actual cost incurred, or a claim made to a policy is denied for any reason.

### Care, Custody and Control Insurance

`INSURANCE_RISK.CCC`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY

> Lessee shall obtain and maintain, for the duration of this Agreement, care, custody and control insurance covering the Horse while in Lessee's care, custody, or control, with a death benefit limit of not less than the Horse's current fair market value of {{HORSE.FAIR_MARKET_VALUE}}, with an effective start date no later than the commencement of this Agreement. Lessee shall provide proof of coverage to Lessor upon request and shall maintain the policy in good standing for the duration of this Agreement; failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.

### Coordination of Coverage

`INSURANCE_RISK.COORDINATION`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO (or unset) AND LESSEE.PARTY_TYPE = ENTITY

> Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor's mortality insurance shall be the first policy noticed and claimed against for any such covered event. Lessee's care, custody and control insurance is secondary and shall respond only to the extent the loss was caused by Lessee's gross negligence, reckless conduct, or intentional misconduct. Where a loss was so caused, Lessee shall bear the net cost of any applicable deductible and any uninsured portion of the loss, and the parties shall reimburse one another as necessary to give effect to this allocation regardless of the order in which the policies respond. Each party shall promptly notify its insurer of a covered event and shall cooperate in the submission and adjustment of claims. Absent a determination that Lessee so caused the loss, all deductibles and uninsured amounts remain Lessor's responsibility.

### Risk of Loss of or Injury to the Horse

`INSURANCE_RISK.RISK_OF_LOSS`

*(info)* Allocates the risk if the Horse is lost, dies, is stolen, or is injured while on lease.

> Lessor assumes all risk of loss of or injury to the Horse during the term of this Agreement, except to the extent caused by Lessee's gross negligence, reckless conduct, or intentional misconduct.

### Loss of Use

`INSURANCE_RISK.LOSS_OF_USE_ACK`

> Lessor acknowledges and accepts that loss of use of the Horse may result from injury to, illness of, or the death of the Horse. No loss-of-use insurance is required or provided under this Agreement.

### Assumption of Inherent Risks

`INSURANCE_RISK.ASSUMPTION_INHERENT`

*(info)* Assumption of the inherent risks of equine activities, grounded in California case law. Under owner review — to be reevaluated.

> Lessee understands that horseback riding and handling horses are inherently dangerous activities. Lessee acknowledges that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. Lessee acknowledges the California common law doctrine of "Primary Assumption of Risk," as established by the California Supreme Court in Knight v. Jewett (1992) 3 Cal.4th 296 and subsequent equine-specific case law (e.g., Levinson v. Owens (2009) 176 Cal.App.4th 1534). Pursuant to this binding legal precedent, Lessee, on behalf of all Lessee Parties, expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that no Lessor Party owes a duty to protect Lessee from these inherent risks.

### Release of Liability

`INSURANCE_RISK.RELEASE`

*(info)* Release of Lessor from claims, including ordinary negligence. Under owner review — to be reevaluated.

> In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and all Lessee Parties, completely releases, forever discharges, and agrees to hold harmless the Lessor Parties from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee's use, handling, or riding of the Horse, whether caused by the ordinary negligence of any Lessor Party or otherwise. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

### Required Protective Attire

`INSURANCE_RISK.SAFETY_ATTIRE`

> Lessee shall wear, and shall ensure that any other person riding the Horse under Lessee's authorization wears, an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Riders shall provide their own helmet, boots, and pants meeting these requirements unless otherwise agreed in writing. Lessee, on behalf of all Lessee Parties, assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes permission to ride or handle the Horse and constitutes a material breach of this Agreement.

### Trail Riding Risks

`INSURANCE_RISK.TRAIL_RIDING`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes TRAIL

> Lessee acknowledges that riding outside an enclosed arena, including trail riding, exposes Lessee and the Horse to additional risks, including uneven terrain, traffic, wildlife, water crossings, and other conditions that may cause the Horse to spook or behave unpredictably. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

### Jumping Risks

`INSURANCE_RISK.JUMPING_RISKS`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes JUMPING

> Lessee acknowledges that jumping the Horse exposes Lessee and the Horse to additional risks beyond flat riding, including refusals, run-outs, awkward or missed distances, falls, unseating, and the Horse landing, stopping, or twisting unpredictably. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

### Competition Risks

`INSURANCE_RISK.COMPETITION_RISKS`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS

> Lessee acknowledges that competing with the Horse exposes Lessee and the Horse to additional risks, including unfamiliar and crowded show grounds, proximity to other horses and riders, loudspeakers, banners, and other stimuli that may cause the Horse to spook or behave unpredictably, as well as the physical demands and pressures of competition. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

### Shared Arena Riding Risks

`INSURANCE_RISK.SHARED_ARENA_RISKS`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES includes ARENA_GROUP

> Lessee acknowledges that riding in an arena at the same time as other riders exposes Lessee and the Horse to additional risks, including collisions, crowding, sudden movements or loss of control by other horses or riders, and the Horse reacting to other horses. Lessee agrees to ride with awareness of others, to follow standard arena etiquette and right-of-way rules and any directions of Lessor or an instructor, and voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

### Waiver of Unknown Claims

`INSURANCE_RISK.WAIVER_UNKNOWN`

> Each party, on behalf of itself and, respectively, the Lessor Parties or the Lessee Parties, expressly waives any and all claims against the other party and its respective party group that the waiving party does not know or suspect to exist at the time of this Agreement, and acknowledges that this waiver is a material term of this Agreement. Each party assumes the risk that claims presently unknown to it may later be discovered.

### Mutual Indemnification

`INSURANCE_RISK.INDEMNIFICATION`

*(info)* Which party protects the other against third-party claims arising from the lease.

> Each party shall indemnify, defend, and hold harmless the other party and, respectively, the Lessor Parties or the Lessee Parties, from and against any and all claims, damages, losses, liabilities, costs, and expenses arising out of the indemnifying party's use, handling, care, or possession of the Horse, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

### Limitation of Liability

`INSURANCE_RISK.LIMITATION`

> Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the Horse's current fair market value of {{HORSE.FAIR_MARKET_VALUE}}. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.


## 15. Termination

`TERMINATION`

### Lessee's Right to Terminate

`TERMINATION.LESSEE`

*(info)* How much notice the Lessee must give to end the lease early.

> Lessee may terminate this Agreement by giving Lessor at least {{TXN.LESSEE_TERM_NOTICE_DAYS}} days' prior written notice.

- **Days notice** — `TXN.LESSEE_TERM_NOTICE_DAYS` · input: number
    - *(info)* Days of notice the Lessee must give to terminate.
### Owner's Right to Terminate

`TERMINATION.OWNER`

*(info)* How much notice the Owner must give to end the lease early.

> Lessor may terminate this Agreement by giving Lessee at least {{TXN.OWNER_TERM_NOTICE_DAYS}} days' prior written notice.

- **Days notice** — `TXN.OWNER_TERM_NOTICE_DAYS` · input: number
    - *(info)* Days of notice the Owner must give to terminate.
### Termination for Cause

`TERMINATION.CAUSE`

*(info)* Notice period for terminating because the other party is in breach.

> Either party may terminate this Agreement for cause (including a material breach that remains uncured) by giving the other party at least {{TXN.CAUSE_TERM_NOTICE_DAYS}} days' prior written notice.

- **Days notice** — `TXN.CAUSE_TERM_NOTICE_DAYS` · input: number
    - *(info)* Days of notice required to terminate for cause.
### Self-Termination upon Loss or Injury

`TERMINATION.LOSS`

> This Agreement shall self-terminate if the Horse is significantly injured or seriously ill as determined by a licensed veterinarian, or dies. Lessee is entitled to a prorated refund of Lease Fee paid for the remaining time unused at the time of self-termination. In the event Lessee is found to have caused, through gross negligence, reckless conduct, or intentional misconduct, the injury, illness, or death, Lessor may retain the unused portion of the paid Lease Fee.

### Termination upon Loss of Use

`TERMINATION.LOSS_OF_USE`

> If the Horse becomes unusable for the purposes of this Agreement for any reason, Lessee may terminate this Agreement immediately upon written notice to Lessor. Upon such termination, Lessee is entitled to a prorated refund of any Lease Fee paid for the remaining unused time as of the date of termination.

### Survival

`TERMINATION.SURVIVAL`

> The releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement, and any payment obligations accrued before termination, survive the expiration or termination of this Agreement for any reason.


## 16. Notice and Contact Information

`NOTICE`

### Form of Notice

`NOTICE.FORM`

> Any notice required or permitted under this Agreement shall be in writing and delivered by a method that provides evidence of receipt to the party at the contact information below. Notice by email is not effective unless the receiving party acknowledges receipt.

### Lessee

`NOTICE.LESSEE_ADDRESS`

> Name: {{LESSEE.FULL_NAME}}
> Address: {{LESSEE.ADDRESS}}
> Phone: {{LESSEE.PHONE}}
> Email: {{LESSEE.EMAIL}}

### Lessor

`NOTICE.LESSOR_ADDRESS`

> Name: {{LESSOR.FULL_NAME}}
> Address: {{LESSOR.ADDRESS}}
> Phone: {{LESSOR.PHONE}}
> Email: {{LESSOR.EMAIL}}

### Changes in Contact Information

`NOTICE.CHANGES`

> Each party shall promptly notify the other party in writing of any change in the party's address or contact information.


## 17. Assignment or Transfer

`ASSIGNMENT`

### Assignment or Transfer

`ASSIGNMENT.NO_ASSIGN`

> Lessee shall not assign, sublease, or otherwise transfer this Agreement or any of Lessee's rights or obligations under it without Lessor's prior written consent, unless permitted in the sections above.


## 18. Entire Agreement

`ENTIRE_AGREEMENT`

### Entire Agreement

`ENTIRE_AGREEMENT.INTEGRATION`

> This Agreement contains the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions and understandings. Any modification of this Agreement must be in writing and signed by all parties.


## 19. Governing Law and Venue

`GOVERNING_LAW`

### Governing Law and Venue

`GOVERNING_LAW.CHOICE`

*(info)* The state whose law governs the lease, and the county and state where any lawsuit must be filed.

> This Agreement shall be governed by the laws of the State of California. Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California.


## 20. Attorneys' Fees

`ATTORNEYS_FEES`

### Attorneys' Fees

`ATTORNEYS_FEES.PREVAILING`

> Each party shall cover their own attorney's fees and costs.


## 21. Severability

`SEVERABILITY`

### Severability

`SEVERABILITY.SAVING`

> If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.


## 22. Lessee's Representations

`LESSEE_REPS`

### Lessee's Representations

`LESSEE_REPS.MAIN_INDIVIDUAL`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = INDIVIDUAL (or unset)

> Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into this Agreement; that Lessee has no physical or mental condition that would prevent Lessee from safely participating in the activities contemplated by this Agreement; and that Lessee has the requisite knowledge and experience to handle and ride the Horse, and will use reasonable care in doing so and follow Lessor's instructions. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.

### Lessee's Representations

`LESSEE_REPS.MAIN_ENTITY`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY

> Lessee represents and warrants that Lessee is duly organized and in good standing, and has full authority to enter into this Agreement, and that the individual signing this Agreement does so as Lessee's authorized representative; that each person who rides or handles the Horse under Lessee's authorization will, before doing so, have executed the releases required under this Agreement and possess the knowledge and experience to handle and ride the Horse safely; and that Lessee will use reasonable care and follow Lessor's instructions in all handling of the Horse. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.


## 23. Signatures

`SIGNATURES`

### Signatures

`SIGNATURES.BLOCK`

> IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.
> 
> LESSEE
> Signature: {{SIG.LESSEE.NAME}}
> Printed Name: {{LESSEE.PRINTED_NAME}}
> Date: {{SIG.LESSEE.DATE}}
> 
> LESSOR (OWNER)
> Signature: {{SIG.LESSOR.NAME}}
> Printed Name: {{LESSOR.PRINTED_NAME}}
> Date: {{SIG.LESSOR.DATE}}

