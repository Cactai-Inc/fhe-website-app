# HORSE_LEASE_V2 — full template extract

Generated 2026-08-04 02:46:24 UTC from the live database (project `lrstswfxfsezdmvkvukc`),
reflecting migration head `20260804100001_deal_rpcs_container_model.sql`.

Every section, clause, field, option list, helper text and conditional in the
live lease template, in render order.

Legend:
  **CONDITIONAL** — appears only when the stated expression is true.
  *(info)* — the text behind that item's info button.
  `{{TOKEN}}` — an input rendered inline in the clause prose.
  Fields list their input kind, and their choices where they have a fixed set.

---

## 1. Parties

`PARTIES`

### INTRO *(no heading set)*

`PARTIES.INTRO`

> This Horse Lease Agreement (the "Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} by and between {{LESSOR.FULL_NAME}} of {{LESSOR.ADDRESS}} ("Lessor") and {{LESSEE.FULL_NAME}} of {{LESSEE.ADDRESS}} ("Lessee").

- **Lessor is an** — `LESSOR.PARTY_TYPE` · input: select · required · owner: LESSOR
    - choices: Individual, Entity / organization
- **Lessee is an** — `LESSEE.PARTY_TYPE` · input: select · required · owner: LESSEE
    - choices: Individual, Entity / organization

## 2. Definitions; Binding Effect; Third-Party Beneficiaries

`DEFINITIONS`

### LESSOR_IND *(no heading set)*

`DEFINITIONS.LESSOR_IND`

**CONDITIONAL** — shows when: (LESSOR.PARTY_TYPE = INDIVIDUAL)

> "Lessor Parties" means Lessor; Lessor's spouse and family and household members, in each case when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Lessor's estate, executors, administrators, legal representatives, successors, and assigns.

### LESSOR_ENT *(no heading set)*

`DEFINITIONS.LESSOR_ENT`

**CONDITIONAL** — shows when: (LESSOR.PARTY_TYPE = ENTITY)

> "Lessor Parties" means Lessor; Lessor's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Lessor and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.

### LESSOR_PENDING *(no heading set)*

`DEFINITIONS.LESSOR_PENDING`

**CONDITIONAL** — shows when: LESSOR.PARTY_TYPE = (empty)

> [Pending — select whether Lessor is an individual or an entity. This placeholder is replaced by the applicable definition and blocks signing.]

### LESSEE_IND *(no heading set)*

`DEFINITIONS.LESSEE_IND`

**CONDITIONAL** — shows when: (LESSEE.PARTY_TYPE = INDIVIDUAL)

> "Lessee Parties" means Lessee; Lessee's spouse and family and household members, in each case when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Lessee's estate, executors, administrators, legal representatives, successors, and assigns.

### LESSEE_ENT *(no heading set)*

`DEFINITIONS.LESSEE_ENT`

**CONDITIONAL** — shows when: (LESSEE.PARTY_TYPE = ENTITY)

> "Lessee Parties" means Lessee; Lessee's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Lessee and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.

### LESSEE_PENDING *(no heading set)*

`DEFINITIONS.LESSEE_PENDING`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = (empty)

> [Pending — select whether Lessee is an individual or an entity. This placeholder is replaced by the applicable definition and blocks signing.]

### BINDING *(no heading set)*

`DEFINITIONS.BINDING`

> Each release, waiver, assumption of risk, and covenant made by a party under this Agreement is made by that party on its own behalf and, to the fullest extent permitted by law, binds anyone claiming by, through, or under that party, including that party's estate, executors, administrators, heirs, legal representatives, successors, assigns, insurers, and subrogees. Each party covenants that it will not permit any person who has not executed this Agreement or a release satisfying the Releases Required for Authorized Riders provision of this Agreement to ride, handle, or care for the Horse, and each party shall indemnify, defend, and hold harmless the other party's Lessor Parties or Lessee Parties, as applicable, from and against any claim brought by that party's family members, invitees, or authorized riders arising out of the Horse or the activities contemplated by this Agreement, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

### BENEFICIARIES *(no heading set)*

`DEFINITIONS.BENEFICIARIES`

> Each Lessor Party and each Lessee Party who is not a signatory to this Agreement is an intended third-party beneficiary of the releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement and may enforce them directly.

## 3. The Horse

`HORSE`

### Horse

`HORSE.IDENTITY`

> This Agreement applies to the following horse (the "Horse"): {{HORSE.REGISTERED_NAME}}
> Color: {{HORSE.COLOR}}
> Markings: {{HORSE.MARKINGS}}
> Breed: {{HORSE.BREED}}
> Registration Number: {{HORSE.REGISTRATION_NUMBER}}
> Sex: {{HORSE.SEX}}
> Foaling date: {{HORSE.AGE_DOB}}
> Current fair market value: {{HORSE.FAIR_MARKET_VALUE}}
> Microchip: {{HORSE.MICROCHIP}}
> Passport: {{HORSE.PASSPORT_NUMBER}}

- **Registered name** — `HORSE.REGISTERED_NAME` · input: text · required · owner: LESSOR
- **Color** — `HORSE.COLOR` · input: select · owner: LESSOR
    - choices: Bay, Chestnut, Gray, Black, Brown, Roan, Palomino, Pinto / Paint, Buckskin, Dun, White / Cremello
- **Markings** — `HORSE.MARKINGS` · input: text · owner: LESSOR
- **Breed** — `HORSE.BREED` · input: select · owner: LESSOR
    - choices: Warmblood, Thoroughbred, Quarter Horse, Arabian, Pony, Draft, Appaloosa, Morgan, Friesian, Andalusian, Mustang, Crossbred / Grade
- **Registration number** — `HORSE.REGISTRATION_NUMBER` · input: text · owner: LESSOR
- **Sex** — `HORSE.SEX` · input: select · owner: LESSOR
    - choices: Mare, Gelding, Stallion, Colt, Filly
- **Foaling date** — `HORSE.AGE_DOB` · input: text · owner: LESSOR
- **Fair market value** — `HORSE.FAIR_MARKET_VALUE` · input: currency · owner: LESSOR
- **Microchip #** — `HORSE.MICROCHIP` · input: text · owner: LESSOR
- **Passport #** — `HORSE.PASSPORT_NUMBER` · input: text · owner: LESSOR

### Ownership of the Horse

`HORSE.OWNERSHIP`

> Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.

### COOWNERS *(no heading set)*

`HORSE.COOWNERS`

> Co-owners: {{TXN.CO_OWNERS}}

- **Co-owner(s)** — `TXN.CO_OWNERS` · input: contacts_list · owner: LESSOR

### OWNERSHIP_LIMITS_Q *(no heading set)*

`HORSE.OWNERSHIP_LIMITS_Q`

> Are there any ownership related leasing restrictions? {{TXN.HAS_OWNERSHIP_LIMITS}}

- **Any limitations on ownership?** — `TXN.HAS_OWNERSHIP_LIMITS` · input: yesno · owner: LESSOR

### OWNERSHIP_LIMITS *(no heading set)*

`HORSE.OWNERSHIP_LIMITS`

**CONDITIONAL** — shows when: TXN.HAS_OWNERSHIP_LIMITS = YES

> Ownership related leasing restrictions: {{TXN.OWNERSHIP_LIMITATIONS}}

- **Ownership limitations** — `TXN.OWNERSHIP_LIMITATIONS` · input: longtext · owner: LESSOR

### Behavior

`HORSE.BEHAVIOR`

> The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.

- **Any exceptions to note?** — `TXN.BEHAVIOR_HAS_EXCEPTIONS` · input: yesno · owner: LESSOR

### BEHAVIOR_EXC *(no heading set)*

`HORSE.BEHAVIOR_EXC`

**CONDITIONAL** — shows when: TXN.BEHAVIOR_HAS_EXCEPTIONS = YES

> The Lessor notes the following known exceptions to the behavior of the Horse: {{TXN.BEHAVIOR_EXCEPTIONS}}.

- **Known behavior exceptions** — `TXN.BEHAVIOR_EXCEPTIONS` · input: longtext · owner: DEAL

### Physical Condition

`HORSE.CONDITION`

> The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement.

- **Any exceptions to note?** — `TXN.CONDITION_HAS_EXCEPTIONS` · input: yesno · owner: LESSOR

### CONDITION_EXC *(no heading set)*

`HORSE.CONDITION_EXC`

**CONDITIONAL** — shows when: TXN.CONDITION_HAS_EXCEPTIONS = YES

> The Lessor notes the following known exceptions to the physical condition of the Horse: {{TXN.CONDITION_EXCEPTIONS}}.

- **Known condition exceptions** — `TXN.CONDITION_EXCEPTIONS` · input: longtext · owner: DEAL

### No Serious Injury History

`HORSE.INJURY_HISTORY_NONE`

**CONDITIONAL** — shows when: TXN.INJURY_HISTORY = NO

> Lessor represents that, to Lessor's knowledge, no person has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse's reaction was within the range of normal equine behavior.

- **Has anyone been seriously injured by the Horse's direct actions?** — `TXN.INJURY_HISTORY` · input: select · required · owner: LESSOR
    - choices: Yes, No

### Serious Injury History Disclosed

`HORSE.INJURY_HISTORY_DISCLOSED`

**CONDITIONAL** — shows when: TXN.INJURY_HISTORY = YES

> Lessor discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury: {{TXN.INJURY_HISTORY_DETAILS}}. Lessee acknowledges this disclosure and proceeds with knowledge of it.

- **Injury history details** — `TXN.INJURY_HISTORY_DETAILS` · input: longtext · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.INJURY_HISTORY = YES

### INJURY_HISTORY_PENDING *(no heading set)*

`HORSE.INJURY_HISTORY_PENDING`

**CONDITIONAL** — shows when: TXN.INJURY_HISTORY = (empty)

> [Pending — state whether anyone has been seriously injured by the Horse's direct actions. This placeholder is replaced by the applicable statement and blocks signing.]

### Pre-Lease Veterinary Examination

`HORSE.VET_CHECK`

> Pre-lease veterinary examination of the Horse: {{TXN.VET_CHECK_CHOICE}}

- **Pre-lease veterinary examination** — `TXN.VET_CHECK_CHOICE` · input: buttons · owner: LESSOR
    - choices: Lessee requested at their own expense, Lessee requested at Lessor's expense, Lessor provided at no cost, Lessee waives the option

### Pre-Lease Trainer Evaluation

`HORSE.TRAINER_EVAL`

> Pre-lease trainer evaluation of the Horse: {{TXN.TRAINER_EVAL_CHOICE}}

- **Professional suitability evaluation** — `TXN.TRAINER_EVAL_CHOICE` · input: buttons · owner: LESSOR
    - choices: Lessee requested at their own expense, Lessee requested at Lessor's expense, Lessor provided at no cost, Lessee waives the option

### Location of the Horse

`LOCATION.MAIN`

> Location of the Horse: {{HORSE.CURRENT_LOCATION}}.

- **Facility** — `HORSE.CURRENT_LOCATION` · input: location · owner: LESSOR

### MOVE_CHOICE *(no heading set)*

`LOCATION.MOVE_CHOICE`

- **Horse will move to a new location for the Lessee** — `TXN.HORSE_MOVES` · input: yesno · owner: LESSOR

### NEW *(no heading set)*

`LOCATION.NEW`

**CONDITIONAL** — shows when: TXN.HORSE_MOVES = YES

> Location during lease term: {{TXN.NEW_LOCATION}}.

- **Location during lease term** — `TXN.NEW_LOCATION` · input: location · owner: LESSOR

### INSPECTION *(no heading set)*

`LOCATION.INSPECTION`

> Lessor may inspect the Horse at any time, subject to the reasonable access rules of the facility where the Horse is kept. If Lessor reasonably determines that the Horse is not being properly cared for, Lessor may take possession of the Horse upon written notice to Lessee.

### Disclaimer of Warranties

`HORSE.WARRANTY`

> Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

## 4. Purpose and Lease Grant

`PURPOSE`

### Purpose of Agreement

`PURPOSE.RECREATION`

**CONDITIONAL** — shows when: TXN.LEASE_PURPOSE = RECREATIONAL or INSTRUCTIONAL or COMPETITION or COMMERCIAL

> For {{TXN.LEASE_PURPOSE}} purposes, Lessee wishes to ride and/or handle Lessor's horse, and Lessor agrees to allow Lessee to ride and/or handle Lessor's horse in exchange for the consideration described herein.

- **Purpose of the lease** — `TXN.LEASE_PURPOSE` · input: select · required · owner: DEAL
    - choices: recreational, instructional, competition, commercial program

### Purpose of Agreement

`PURPOSE.RECREATION_DEFAULT`

**CONDITIONAL** — shows when: TXN.LEASE_PURPOSE = (empty)

> [Pending — select the purpose of this lease. This placeholder is replaced by the applicable purpose language and blocks signing.]

### Lease Grant

`PURPOSE.GRANT`

> Subject to the terms and conditions of this Agreement, Lessor agrees to lease to Lessee and Lessee agrees to lease from Lessor the horse described below.

### Lease Type

`PURPOSE.LEASE_TYPE`

> Lease type: {{TXN.LEASE_TYPE}}.

- **Lease type** — `TXN.LEASE_TYPE` · input: select · required · owner: LESSOR
    - choices: Full lease (full-time access), Partial lease (shared or limited access)

## 5. Schedule for Lessee's Usage

`SCHEDULE`

### Schedule for Lessee's Usage

`SCHEDULE.MAIN`

**CONDITIONAL** — shows when: TXN.LEASE_TYPE = PARTIAL

> Reserved days of use: {{TXN.DAYS_USED}}

- **Reserved days of use** — `TXN.DAYS_USED` · input: week_grid · owner: DEAL

### OTHER *(no heading set)*

`SCHEDULE.OTHER`

**CONDITIONAL** — shows when: TXN.LEASE_TYPE = PARTIAL

> Additional or custom schedule terms: {{TXN.SCHEDULE_TERMS}}

- **Additional schedule terms** — `TXN.SCHEDULE_TERMS` · input: longtext · owner: LESSOR

### Schedule Changes

`SCHEDULE.CHANGES`

**CONDITIONAL** — shows when: TXN.LEASE_TYPE = PARTIAL

> Any changes to the agreed upon schedule must be made and accepted in writing.

## 6. Lease Fee

`LEASE_FEE`

### CHOICE *(no heading set)*

`LEASE_FEE.CHOICE`

> {{TXN.LEASE_FEE}}
> If no monetary lease fee is payable under this Agreement, the parties agree that Lessee's undertakings of care, exercise, and use of the Horse and Lessee's other obligations under this Agreement constitute good and adequate consideration for this Agreement.

- **Lease fee** — `TXN.LEASE_FEE` · input: fee_schedule · owner: LESSOR

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

> All payments are due on their due date or within 5 business days of notification of the amount owed. Payments will be deemed late if they remain unpaid on the 6th business day. Late payments are considered a breach of the contract terms and may be grounds for termination of the Agreement unless the party from whom the payment is owed has communicated in writing the date by which payment will be made. Payments exceeding 1 calendar month in past-due status constitute grounds for termination for cause under the Termination for Cause provisions of this Agreement unless prior written acceptance of the delay is provided by the party to whom the payment is owed.

## 8. Payment Method

`PAYMENT_METHOD`

### Payments by the Lessee

`PAYMENT_METHOD.MAIN`

> The Lessee may pay amounts owed under this Agreement by the following method(s): {{TXN.PAYMENT_METHODS}}

- **Accepted payment methods** — `TXN.PAYMENT_METHODS` · input: buttons · owner: LESSOR
    - choices: Cash, Zelle, Credit Card

### CARD *(no heading set)*

`PAYMENT_METHOD.CARD`

**CONDITIONAL** — shows when: TXN.PAYMENT_METHODS contains CREDIT_CARD

> Credit card payments are processed as follows: {{TXN.CARD_PROCESSOR}}

- **Card processor & instructions** — `TXN.CARD_PROCESSOR` · input: longtext · owner: LESSOR

### Payments by the Lessor

`PAYMENT_METHOD.MAIN_LESSOR`

> The Lessor may pay amounts owed under this Agreement by the following method(s): {{TXN.LESSOR_PAYMENT_METHODS}}

- **Accepted payment methods** — `TXN.LESSOR_PAYMENT_METHODS` · input: buttons · owner: LESSEE
    - choices: Cash, Zelle, Credit Card

### CARD_LESSOR *(no heading set)*

`PAYMENT_METHOD.CARD_LESSOR`

**CONDITIONAL** — shows when: TXN.LESSOR_PAYMENT_METHODS contains CREDIT_CARD

> Credit card payments are processed as follows: {{TXN.LESSOR_CARD_PROCESSOR}}

- **Card processor & instructions** — `TXN.LESSOR_CARD_PROCESSOR` · input: longtext · owner: LESSEE

## 9. Evaluation Period

`EVALUATION`

### CHOICE *(no heading set)*

`EVALUATION.CHOICE`

- **Evaluation period** — `TXN.EVALUATION_ENABLED` · input: buttons · owner: DEAL
    - choices: Requested by Lessee, Required by Lessor, Refused by Lessor, Waived by Lessee
- **Evaluation period** — `TXN.EVAL_PERIOD_TYPE` · input: select · owner: DEAL
    - **CONDITIONAL** — shows when: TXN.EVALUATION_ENABLED = REQUESTED or REQUIRED
    - choices: Included within the lease term, Fixed evaluation period before the term

### Evaluation Period Details

`EVALUATION.DATES_INCLUDED`

**CONDITIONAL** — shows when: TXN.EVALUATION_ENABLED = REQUESTED or REQUIRED AND TXN.EVAL_PERIOD_TYPE = INCLUDED AND TXN.EVAL_INCLUDED_LENGTH >= 1

> Lessee shall have an evaluation period of {{TXN.EVAL_INCLUDED_LENGTH}} {{TXN.EVAL_INCLUDED_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is included at no separate charge, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.

- **Length** — `TXN.EVAL_INCLUDED_LENGTH` · input: number · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.EVAL_PERIOD_TYPE = INCLUDED
- **Unit** — `TXN.EVAL_INCLUDED_UNIT` · input: select · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.EVAL_INCLUDED_LENGTH >= 1
    - choices: day, week, month, days, weeks, months

### Evaluation Period Details

`EVALUATION.DATES_FIXED`

**CONDITIONAL** — shows when: TXN.EVALUATION_ENABLED = REQUESTED or REQUIRED AND TXN.EVAL_PERIOD_TYPE = FIXED AND TXN.EVAL_FIXED_LENGTH >= 1

> Lessee shall have an evaluation period of {{TXN.EVAL_FIXED_LENGTH}} {{TXN.EVAL_FIXED_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is {{TXN.EVAL_FIXED_FEE}}, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.

- **Length** — `TXN.EVAL_FIXED_LENGTH` · input: number · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.EVAL_PERIOD_TYPE = FIXED
- **Unit** — `TXN.EVAL_FIXED_UNIT` · input: select · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.EVAL_FIXED_LENGTH >= 1
    - choices: day, week, month, days, weeks, months
- **Evaluation period fee amount** — `TXN.EVAL_FIXED_FEE` · input: currency · owner: LESSOR

### REFUSED *(no heading set)*

`EVALUATION.REFUSED`

**CONDITIONAL** — shows when: (TXN.EVALUATION_ENABLED = REFUSED)

> No evaluation period applies to this Agreement. The Lessor has declined to provide an evaluation period, and the Lease begins on the Effective Date without one.

### WAIVED *(no heading set)*

`EVALUATION.WAIVED`

**CONDITIONAL** — shows when: (TXN.EVALUATION_ENABLED = WAIVED)

> No evaluation period applies to this Agreement. The Lessee has waived any evaluation period, and the Lease begins on the Effective Date without one.

## 10. Agreement Term

`TERM`

### Agreement Term

`TERM.MAIN`

> Term of this Agreement: {{TXN.LEASE_TERM_TYPE}}. This Agreement begins on {{TXN.LEASE_START}}.

- **Term type** — `TXN.LEASE_TERM_TYPE` · input: select · required · owner: DEAL
    - choices: Fixed period, Open-ended, Other
- **Lease start date** — `TXN.LEASE_START` · input: date · required · owner: DEAL

### FIXED_END *(no heading set)*

`TERM.FIXED_END`

**CONDITIONAL** — shows when: TXN.LEASE_TERM_TYPE = FIXED

> This Agreement continues until {{TXN.LEASE_END}}.

- **Lease end date** — `TXN.LEASE_END` · input: date · owner: DEAL

### Renewal Terms

`TERM.RENEWAL`

**CONDITIONAL** — shows when: TXN.RENEWAL_INCLUDE = YES

> Renewal terms: {{TXN.RENEWAL_TERMS}}

- **Include renewal terms** — `TXN.RENEWAL_INCLUDE` · input: certify · owner: LESSOR
- **Renewal terms** — `TXN.RENEWAL_TERMS` · input: longtext · owner: DEAL

### ADDITIONAL *(no heading set)*

`TERM.ADDITIONAL`

> Additional terms: {{TXN.ADDITIONAL_TERMS}}

- **Add additional terms** — `TXN.ADDITIONAL_TERMS` · input: add_text · owner: LESSOR

### TERMINATION_XREF *(no heading set)*

`TERM.TERMINATION_XREF`

> Notwithstanding the term stated above, this Agreement may be terminated earlier as provided in the Termination section of this Agreement.

## 11. Permitted Use(s) & Restrictions

`PERMITTED_USE`

### Permitted Use(s)

`PERMITTED_USE.MAIN`

> Lessor grants Lessee the right to use the Horse for the following purpose(s): {{TXN.PERMITTED_ACTIVITIES}}
> Lessee shall not use the Horse for any other purpose without Lessor's prior written consent.

- **Permitted activities** — `TXN.PERMITTED_ACTIVITIES` · input: buttons · required · owner: DEAL
    - choices: Riding Lessons, Solo Arena Riding, Group Arena Riding, Jumping, Competitions, Trail Riding

### TRAINER *(no heading set)*

`PERMITTED_USE.TRAINER`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains LESSONS or JUMPING or COMPETITIONS

> Riding Lessons, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trainer or Instructor is present.

### Lessons

`TRAINING_LESSONS.LESSONS`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = INDIVIDUAL AND TXN.PERMITTED_ACTIVITIES contains LESSONS

> Lessee is required to maintain continuous enrollment in weekly riding lessons: {{TXN.LESSONS_REQUIRED}}.
> Lessons shall be conducted only by a French Heritage Equestrian Approved Instructor.

- **Lessee required to take lessons?** — `TXN.LESSONS_REQUIRED` · input: yesno · owner: DEAL

### Lessons

`TRAINING_LESSONS.LESSONS_ENTITY`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY AND TXN.PERMITTED_ACTIVITIES contains LESSONS

> Lessee is permitted by Lessor to provide riding lessons with the Horse: {{TXN.LESSONS_ENTITY_PERMITTED}}.

- **Lessee permitted to provide riding lessons?** — `TXN.LESSONS_ENTITY_PERMITTED` · input: yesno · owner: DEAL

### Lessons

`TRAINING_LESSONS.PENDING`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = (empty) AND TXN.PERMITTED_ACTIVITIES contains LESSONS

> [Pending — select whether Lessee is an individual or an entity. This placeholder is replaced by the applicable lessons terms and blocks signing.]

### Training

`TRAINING_LESSONS.TRAINING`

> Any professional training of the Horse under this Agreement, including groundwork, schooling, and under-saddle training, shall be conducted only by a French Heritage Equestrian Approved Trainer.

### Competitions

`COMPETITIONS.INTRO`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains COMPETITIONS

> Expenses of competition (entry fees, transportation, and the like) are: {{TXN.COMPETITION_EXPENSES}}.
> Any prize money or winnings earned in competition shall belong to: {{TXN.COMPETITION_WINNINGS}}.

- **Competition expenses** — `TXN.COMPETITION_EXPENSES` · input: select · owner: DEAL
    - choices: Paid by Lessee, Paid by Lessor, Other
- **Competition winnings** — `TXN.COMPETITION_WINNINGS` · input: select · owner: DEAL
    - choices: Lessee, Lessor, Other

### Jumping Restrictions

`RESTRICT.JUMP_TITLE`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains JUMPING

> {{TXN.JUMP_OMIT}}

- **No jumping restrictions** — `TXN.JUMP_OMIT` · input: certify · owner: LESSOR

### JUMP_ON *(no heading set)*

`RESTRICT.JUMP_ON`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains JUMPING AND TXN.JUMP_OMIT = NO or (empty)

> Jumping is restricted as follows: maximum height {{TXN.JUMP_MAX_HEIGHT}}; no more than {{TXN.JUMP_DAYS_PER_WEEK}} days per week; under trainer supervision only: {{TXN.JUMP_SUPERVISION}}.

- **Maximum height** — `TXN.JUMP_MAX_HEIGHT` · input: text · owner: DEAL
- **Days per week** — `TXN.JUMP_DAYS_PER_WEEK` · input: number · owner: DEAL
- **Only under trainer supervision?** — `TXN.JUMP_SUPERVISION` · input: yesno · owner: DEAL

### JUMP_OFF *(no heading set)*

`RESTRICT.JUMP_OFF`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains JUMPING AND TXN.JUMP_OMIT = YES

> Lessor does not restrict jumping.

### Competition Restrictions

`RESTRICT.COMP_TITLE`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains COMPETITIONS

> {{TXN.COMP_OMIT}}

- **No competition restrictions** — `TXN.COMP_OMIT` · input: certify · owner: LESSOR

### COMP_ON *(no heading set)*

`RESTRICT.COMP_ON`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains COMPETITIONS AND TXN.COMP_OMIT = NO or (empty)

> Competitions are restricted as follows: {{TXN.COMP_RESTRICTION}}.

- **Competition restriction** — `TXN.COMP_RESTRICTION` · input: text · owner: LESSOR

### COMP_OFF *(no heading set)*

`RESTRICT.COMP_OFF`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains COMPETITIONS AND TXN.COMP_OMIT = YES

> Lessor does not restrict competitions.

### Trail-Riding Restrictions

`RESTRICT.TRAIL_TITLE`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains TRAIL

> {{TXN.TRAIL_OMIT}}

- **No trail-riding restrictions** — `TXN.TRAIL_OMIT` · input: certify · owner: LESSOR

### TRAIL_ON *(no heading set)*

`RESTRICT.TRAIL_ON`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains TRAIL AND TXN.TRAIL_OMIT = NO or (empty)

> Trail riding is restricted as follows: {{TXN.TRAIL_RESTRICTION}}.

- **Trail-riding restriction** — `TXN.TRAIL_RESTRICTION` · input: text · owner: LESSOR

### TRAIL_OFF *(no heading set)*

`RESTRICT.TRAIL_OFF`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains TRAIL AND TXN.TRAIL_OMIT = YES

> Lessor does not restrict trail riding.

### Additional Restrictions

`PERMITTED_USE.RESTRICTIONS`

> Additional restrictions: {{TXN.PERMITTED_RESTRICTIONS}}

- **Add Restrictions** — `TXN.PERMITTED_RESTRICTIONS` · input: add_text · owner: LESSOR

### Other Allowed Activities

`PROHIBITED.OTHER`

**CONDITIONAL** — shows when: TXN.ADDITIONAL_ACTIVITIES contains BREEDING or EMOTIONAL_SUPPORT or FILM_TV_AD or OTHER

> Lessee is permitted to engage in the following additional activities with the Horse: {{TXN.ADDITIONAL_ACTIVITIES}}.

- **Additional permitted activities** — `TXN.ADDITIONAL_ACTIVITIES` · input: buttons · owner: DEAL
    - choices: None — no additional activities, Breeding, Emotional Support Services, Film / Television / Advertising, Other

### Other Allowed Activities

`PROHIBITED.OTHER_NONE`

**CONDITIONAL** — shows when: TXN.ADDITIONAL_ACTIVITIES = (empty) or NONE

> Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.

### OTHER_NOTE *(no heading set)*

`PROHIBITED.OTHER_NOTE`

**CONDITIONAL** — shows when: TXN.ADDITIONAL_ACTIVITIES contains OTHER

> Other additional permitted activity: {{TXN.ADDITIONAL_ACTIVITIES_OTHER}}.

- **Other additional permitted activity** — `TXN.ADDITIONAL_ACTIVITIES_OTHER` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.ADDITIONAL_ACTIVITIES contains OTHER

### Allowing Others to Ride

`PROHIBITED.OTHERS`

> The following additional persons may ride or handle the Horse without Lessor's prior permission: {{TXN.OTHERS_ALLOWED}}.
> Only the persons identified above shall be permitted to ride or handle the Horse without Lessor's written permission.

- **Others allowed to ride** — `TXN.OTHERS_ALLOWED` · input: buttons · owner: DEAL
    - choices: None, Lessee's family members, The trainer/instructor, Riding Lesson Participants, Other

### OTHERS_OTHER *(no heading set)*

`PROHIBITED.OTHERS_OTHER`

**CONDITIONAL** — shows when: TXN.OTHERS_ALLOWED contains OTHER

> Other persons allowed to ride or handle the Horse: {{TXN.OTHERS_ALLOWED_OTHER}}.

- **Other persons allowed** — `TXN.OTHERS_ALLOWED_OTHER` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.OTHERS_ALLOWED contains OTHER

### Releases Required for Authorized Riders

`PERMITTED_USE.RELEASES_REQUIRED`

> All persons other than Lessee must, prior to handling or riding the Horse, have executed a liability release that names the Lessor Parties and the Lessee Parties as released parties, contains an express assumption of the inherent risks of equine activities, has been reviewed and approved by Lessor, and, for any rider under 18 years of age, is signed by the rider's parent or legal guardian. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.

### Transport of the Horse

`PERMITTED_USE.TRANSPORT`

> Transport of the Horse to offsite locations (other than for medical care, which is always permitted): {{TXN.OFFSITE_TRANSPORT}}
> For clarity, riding trails attached to the location at which the Horse is kept under this Agreement are not offsite locations. Where Competitions are a permitted activity under this Agreement, transport of the Horse to and from the competition venue for that competition is deemed consented, subject to any competition restrictions stated in this Agreement.

- **Offsite transport** — `TXN.OFFSITE_TRANSPORT` · input: select · owner: LESSOR
    - choices: Lessor grants permission to transport offsite, Lessor prohibits offsite transport without written consent

## 12. Horse Care and Expenses

`CARE`

### Lessee's Responsibility for Care and Exercise

`SCHEDULE.CARE_DUTY`

**CONDITIONAL** — shows when: TXN.EXERCISE_INCLUDE = YES

> Lessee's use of the Horse is a responsibility as well as a right: regular, consistent exercise and attention are important to the Horse's health and wellbeing. Lessee is required to maintain regular use and exercise for the Horse on their allowed days, unless Lessee has discussed with and received mutual agreement from the Lessor in writing that one of those days will be used as a rest day for the Horse. If Lessee regularly fails to use and care for the Horse, Lessor may terminate this Agreement.

- **Include Lessee care & exercise responsibility** — `TXN.EXERCISE_INCLUDE` · input: certify · owner: LESSOR

### 3rd Party Exercise

`SCHEDULE.TRAINER_CARE`

**CONDITIONAL** — shows when: TXN.TRAINER_CARE_INCLUDE = YES

> Lessee is permitted to engage an approved 3rd party to exercise the Horse. All 3rd party exercise shall be conducted only by a French Heritage Equestrian Approved Trainer. Other 3rd parties must be approved in writing by the Lessor.
> Party responsible for arranging: {{TXN.TRAINER_EXERCISE_ARRANGE}}
> Party responsible for costs: {{TXN.TRAINER_EXERCISE_COST}}
> Lessee's share of the cost: {{TXN.TRAINER_EXERCISE_SPLIT_PCT}}

- **Include 3rd party exercise** — `TXN.TRAINER_CARE_INCLUDE` · input: certify · owner: LESSOR
- **Party responsible for arranging** — `TXN.TRAINER_EXERCISE_ARRANGE` · input: select · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.TRAINER_CARE_INCLUDE = YES
    - choices: Lessee, Lessor, Shared
- **Party responsible for costs** — `TXN.TRAINER_EXERCISE_COST` · input: select · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.TRAINER_CARE_INCLUDE = YES
    - choices: Lessee, Lessor, Shared
- **Lessee's share of the cost** — `TXN.TRAINER_EXERCISE_SPLIT_PCT` · input: percent · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.TRAINER_CARE_INCLUDE = YES AND TXN.TRAINER_EXERCISE_COST = SHARED

### INTRO *(no heading set)*

`CARE.INTRO`

> Horse care and expenses shall be managed and paid for by the responsible party as listed below.

### SUPPLEMENTS *(no heading set)*

`CARE.SUPPLEMENTS`

> {{TXN.MEDICATIONS}}

- **Medications and supplements** — `TXN.MEDICATIONS` · input: med_schedule · owner: LESSOR

### Farrier Care

`CARE.FARRIER`

> Party responsible for arranging: {{TXN.FARRIER_ARRANGE}}
> Party responsible for costs: {{TXN.FARRIER_COST_PARTY}}
> Farrier: {{HORSE.FARRIER_NAME}}
> Farrier phone: {{HORSE.FARRIER_PHONE}}

- **Party responsible for arranging** — `TXN.FARRIER_ARRANGE` · input: select · owner: LESSOR
    - choices: Lessor, Lessee, Trainer/Instructor, Boarding Staff, Other
- **Farrier** — `HORSE.FARRIER_NAME` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.FARRIER_ARRANGE = LESSEE
- **Party responsible for costs** — `TXN.FARRIER_COST_PARTY` · input: select · owner: LESSOR
    - choices: Lessor, Lessee, Trainer/Instructor, Boarding Staff, Other
- **Farrier phone** — `HORSE.FARRIER_PHONE` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.FARRIER_ARRANGE = LESSEE

### Veterinary Care

`CARE.ROUTINE_VET`

> Party responsible for arranging: {{TXN.VET_ARRANGE}}
> Party responsible for costs: {{TXN.VET_COST_PARTY}}
> Veterinarian: {{HORSE.VET_NAME}}
> Practice: {{HORSE.VET_BUSINESS}}
> Address: {{HORSE.VET_ADDRESS}}
> Veterinarian phone: {{HORSE.VET_PHONE}}

- **Party responsible for arranging** — `TXN.VET_ARRANGE` · input: select · owner: LESSOR
    - choices: Lessor, Lessee, Trainer/Instructor, Boarding Staff, Other
- **Veterinarian** — `HORSE.VET_NAME` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.VET_ARRANGE = LESSEE
- **Party responsible for costs** — `TXN.VET_COST_PARTY` · input: select · owner: LESSOR
    - choices: Lessor, Lessee, Trainer/Instructor, Boarding Staff, Other
- **Practice** — `HORSE.VET_BUSINESS` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.VET_ARRANGE = LESSEE
- **Address** — `HORSE.VET_ADDRESS` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.VET_ARRANGE = LESSEE
- **Veterinarian phone** — `HORSE.VET_PHONE` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.VET_ARRANGE = LESSEE

### Protective Equipment

`CARE.PROTECTIVE`

> Horse must wear protective equipment: {{TXN.PROTECTIVE_REQUIRED}}

- **Horse must wear protective equipment** — `TXN.PROTECTIVE_REQUIRED` · input: yesno · owner: LESSOR

### PROTECTIVE_EQUIP *(no heading set)*

`CARE.PROTECTIVE_EQUIP`

**CONDITIONAL** — shows when: TXN.PROTECTIVE_REQUIRED = YES

> Lessor will provide the following equipment for the Horse: {{TXN.PROTECTIVE_EQUIPMENT}}
> Lessee must ensure equipment is used and properly secured to the Horse prior to all activities.

- **Protective equipment** — `TXN.PROTECTIVE_EQUIPMENT` · input: buttons · owner: DEAL
    - choices: Front boots / wraps, Hind boots / wraps, Other

### Tack

`CARE.TACK`

> When riding and handling the Horse, Lessee shall use only tack in good condition that is properly fitted to the Horse.
> {{TXN.TACK_PROHIBITED}}

- **Is Lessee prohibited from using certain tack or equipment?** — `TXN.TACK_PROHIBITED` · input: reveal_text · owner: LESSOR

### Rider Aids

`CARE.RIDER_AIDS`

> The following rider aids are prohibited: {{TXN.RIDER_AIDS}}.

- **Prohibited rider aids** — `TXN.RIDER_AIDS` · input: buttons · owner: DEAL
    - choices: Crop or bat, Longe whip, Dressage whip, Other

### RIDER_AIDS_OTHER *(no heading set)*

`CARE.RIDER_AIDS_OTHER`

**CONDITIONAL** — shows when: TXN.RIDER_AIDS contains OTHER

> Other prohibited rider aid: {{TXN.RIDER_AIDS_OTHER}}.

- **Other prohibited rider aid** — `TXN.RIDER_AIDS_OTHER` · input: text · owner: LESSOR

## 13. Insurance, Risk of Loss, and Indemnification

`INSURANCE_RISK`

### Insurance Requirements

`INSURANCE_RISK.INSURANCE`

> The parties agree to the insurance elections set forth below. Each policy elected or required below shall be maintained in effect for the duration of this Agreement.

### General Liability Insurance

`INSURANCE_RISK.GENERAL_LIABILITY`

- **General liability insurance is not required for or by either party under this Agreement.** — `TXN.GL_NOT_REQUIRED` · input: certify · owner: LESSOR

### GL_STATUS *(no heading set)*

`INSURANCE_RISK.GL_STATUS`

**CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO or (empty)

> Lessor: {{TXN.GL_LESSOR_STATUS}} general liability insurance covering the Horse and the activities contemplated by this Agreement.
> Lessee: {{TXN.GL_LESSEE_STATUS}} general liability insurance covering the Horse and the activities contemplated by this Agreement.

- **Lessor** — `TXN.GL_LESSOR_STATUS` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO or (empty)
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
- **Lessee** — `TXN.GL_LESSEE_STATUS` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO or (empty)
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain

### GL_DED_SIMPLE *(no heading set)*

`INSURANCE_RISK.GL_DED_SIMPLE`

**CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO or (empty) AND (TXN.GL_LESSOR_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN OR TXN.GL_LESSEE_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN)

> If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.GL_DED_RESP}}.

- **Deductible responsibility (Lessee-responsibility claims)** — `TXN.GL_DED_RESP` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO or (empty)
    - choices: Lessor, Lessee, Split, Other

### GL_DED_SPLITC *(no heading set)*

`INSURANCE_RISK.GL_DED_SPLITC`

**CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO or (empty) AND TXN.GL_DED_RESP = SPLIT AND (TXN.GL_LESSOR_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN OR TXN.GL_LESSEE_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN)

> The deductible shall be split between the parties: {{TXN.GL_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.GL_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

- **Split — % paid by Lessor** — `TXN.GL_DED_RESP_SPLIT_LESSOR` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO or (empty) AND TXN.GL_DED_RESP = SPLIT
- **Split — % paid by Lessee** — `TXN.GL_DED_RESP_SPLIT_LESSEE` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = NO or (empty) AND TXN.GL_DED_RESP = SPLIT

### GL_NONE *(no heading set)*

`INSURANCE_RISK.GL_NONE`

**CONDITIONAL** — shows when: TXN.GL_NOT_REQUIRED = YES

> Lessor has elected not to require general liability insurance under this Agreement. Lessor accepts full risk and responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement, except as otherwise expressly allocated in this Agreement.

### General Liability — Lessee Responsibility

`INSURANCE_RISK.GL_LESSEE_RESP`

**CONDITIONAL** — shows when: TXN.GL_LESSEE_RESPONSIBLE = YES

> Lessee has elected to accept, and hereby accepts, financial responsibility for general liability insurance under this Agreement. Lessee shall obtain and maintain, at Lessee's sole cost, general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and shall provide proof of coverage to Lessor upon request. As between the parties, and except as otherwise expressly allocated in this Agreement, Lessee bears responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement to the extent not covered by an in-force policy.

- **The Lessee accepts financial responsibility for general liability insurance under this Agreement.** — `TXN.GL_LESSEE_RESPONSIBLE` · input: certify · owner: LESSEE
    - **CONDITIONAL** — shows when: TXN.GL_LESSOR_STATUS = NONE AND TXN.GL_LESSEE_STATUS = NONE AND TXN.GL_NOT_REQUIRED = NO or (empty)

### Mortality Insurance

`INSURANCE_RISK.MORTALITY`

- **Mortality insurance is not required for or by either party under this Agreement.** — `TXN.MORT_NOT_REQUIRED` · input: certify · owner: LESSOR

### MORT_STATUS *(no heading set)*

`INSURANCE_RISK.MORT_STATUS`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty)

> Lessor: {{TXN.MORT_LESSOR_STATUS}} mortality insurance on the Horse.
> Lessee: {{TXN.MORT_LESSEE_STATUS}} mortality insurance on the Horse.

- **Lessor** — `TXN.MORT_LESSOR_STATUS` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty)
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
- **Lessee** — `TXN.MORT_LESSEE_STATUS` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty)
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain

### MORT_DEDR_SIMPLE *(no heading set)*

`INSURANCE_RISK.MORT_DEDR_SIMPLE`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty) AND (TXN.MORT_LESSOR_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN OR TXN.MORT_LESSEE_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN)

> If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.MORT_DED_RESP}}.

- **Deductible responsibility** — `TXN.MORT_DED_RESP` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty)
    - choices: Lessor, Lessee, Split, Other

### MORT_DEDR_SPLITC *(no heading set)*

`INSURANCE_RISK.MORT_DEDR_SPLITC`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty) AND TXN.MORT_DED_RESP = SPLIT AND (TXN.MORT_LESSOR_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN OR TXN.MORT_LESSEE_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN)

> The deductible shall be split between the parties: {{TXN.MORT_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MORT_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

- **Deductible split — paid by Lessor** — `TXN.MORT_DED_RESP_SPLIT_LESSOR` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty) AND TXN.MORT_DED_RESP = SPLIT
- **Deductible split — paid by Lessee** — `TXN.MORT_DED_RESP_SPLIT_LESSEE` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty) AND TXN.MORT_DED_RESP = SPLIT

### MORT_NONE *(no heading set)*

`INSURANCE_RISK.MORT_NONE`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = YES

> Lessor has elected not to require mortality insurance under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse's value in the event of the Horse's death, theft, or humane destruction, except as otherwise expressly allocated in this Agreement.

### Mortality — Lessee Responsibility

`INSURANCE_RISK.MORT_LESSEE_RESP`

**CONDITIONAL** — shows when: TXN.MORT_LESSEE_RESPONSIBLE = YES

> Lessee has elected to accept, and hereby accepts, financial responsibility for mortality insurance under this Agreement. Lessee shall obtain and maintain, at Lessee's sole cost, mortality insurance on the Horse for the duration of this Agreement in an amount not less than the Horse's current fair market value, and shall provide proof of coverage to Lessor upon request. As between the parties, and except as otherwise expressly allocated in this Agreement, Lessee bears responsibility for the loss of the Horse's value in the event of the Horse's death, theft, or humane destruction to the extent not covered by an in-force policy.

- **The Lessee accepts financial responsibility for mortality insurance under this Agreement.** — `TXN.MORT_LESSEE_RESPONSIBLE` · input: certify · owner: LESSEE
    - **CONDITIONAL** — shows when: TXN.MORT_LESSOR_STATUS = NONE AND TXN.MORT_LESSEE_STATUS = NONE AND TXN.MORT_NOT_REQUIRED = NO or (empty)

### Medical Insurance

`INSURANCE_RISK.MEDICAL`

- **Medical insurance is not required for or by either party under this Agreement.** — `TXN.MED_NOT_REQUIRED` · input: certify · owner: LESSOR

### MED_NONE *(no heading set)*

`INSURANCE_RISK.MED_NONE`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = YES

> Lessor has elected not to maintain medical insurance on the Horse. Lessor accepts full risk and responsibility for any and all injury to or illness of the Horse during the term of this Agreement, including all costs of veterinary care arising from such injury or illness, except as otherwise expressly allocated in the Horse Care and Expenses section of this Agreement.

### Medical — Lessee Responsibility

`INSURANCE_RISK.MED_LESSEE_RESP`

**CONDITIONAL** — shows when: TXN.MED_LESSEE_RESPONSIBLE = YES

> Lessee has elected to accept, and hereby accepts, financial responsibility for medical insurance under this Agreement. Lessee shall obtain and maintain, at Lessee's sole cost, medical insurance on the Horse for the duration of this Agreement, and shall provide proof of coverage to Lessor upon request. As between the parties, and except as otherwise expressly allocated in the Horse Care and Expenses section of this Agreement, Lessee bears responsibility for the costs of veterinary care arising from injury to or illness of the Horse to the extent not covered by an in-force policy.

- **The Lessee accepts financial responsibility for medical insurance under this Agreement.** — `TXN.MED_LESSEE_RESPONSIBLE` · input: certify · owner: LESSEE
    - **CONDITIONAL** — shows when: TXN.MED_LESSOR_STATUS = NONE AND TXN.MED_LESSEE_STATUS = NONE AND TXN.MED_NOT_REQUIRED = NO or (empty)

### MED_STATUS *(no heading set)*

`INSURANCE_RISK.MED_STATUS`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty)

> Lessor: {{TXN.MED_LESSOR_STATUS}} medical insurance on the Horse.
> Lessee: {{TXN.MED_LESSEE_STATUS}} medical insurance on the Horse.

- **Lessor** — `TXN.MED_LESSOR_STATUS` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty)
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain
- **Lessee** — `TXN.MED_LESSEE_STATUS` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty)
    - choices: Has and will maintain, Will obtain and will maintain, Does not have and will not obtain

### MED_DEDR_SIMPLE *(no heading set)*

`INSURANCE_RISK.MED_DEDR_SIMPLE`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty) AND (TXN.MED_LESSOR_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN OR TXN.MED_LESSEE_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN)

> If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.MED_DED_RESP}}.

- **Deductible responsibility** — `TXN.MED_DED_RESP` · input: select · required · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty)
    - choices: Lessor, Lessee, Split, Other

### MED_DEDR_SPLITC *(no heading set)*

`INSURANCE_RISK.MED_DEDR_SPLITC`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty) AND TXN.MED_DED_RESP = SPLIT AND (TXN.MED_LESSOR_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN OR TXN.MED_LESSEE_STATUS = HAS_WILL_MAINTAIN or WILL_OBTAIN)

> The deductible shall be split between the parties: {{TXN.MED_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

- **Deductible split — paid by Lessor** — `TXN.MED_DED_RESP_SPLIT_LESSOR` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty) AND TXN.MED_DED_RESP = SPLIT
- **Deductible split — paid by Lessee** — `TXN.MED_DED_RESP_SPLIT_LESSEE` · input: text · owner: LESSOR
    - **CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty) AND TXN.MED_DED_RESP = SPLIT

### MED_TAIL *(no heading set)*

`INSURANCE_RISK.MED_TAIL`

**CONDITIONAL** — shows when: TXN.MED_NOT_REQUIRED = NO or (empty)

> Any out-of-pocket costs for deductibles or other expenses related to the needs of the Horse are to be paid by Lessor, and where Lessee is deemed to be responsible for part or all of a cost paid by Lessor, Lessee shall reimburse Lessor in accordance with the acceptable payment methods stated in this Agreement, or, if Lessee so requests prior to payment by Lessor, Lessee may make such request to pay the billing party directly using a method allowed by that party. Lessee may, with Lessor's written permission, pay for any or all of Lessor's portion when paying the billing party directly, and Lessor may reimburse Lessee in accordance with the terms of this Agreement. Lessor assumes and is responsible for all risks and costs not paid or covered by any policy held by either party, including in the event a policy is not in effect at the time of the incident, an incident for which a claim is made is deemed not to be covered by a policy, a payment for a claim made for an incident that is covered by a policy is less than the actual cost incurred, or a claim made to a policy is denied for any reason, except as otherwise expressly allocated in this section or elsewhere in this Agreement.

### Care, Custody and Control Insurance

`INSURANCE_RISK.CCC`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY

> Lessee shall obtain and maintain, for the duration of this Agreement, care, custody and control insurance covering the Horse while in Lessee's care, custody, or control, with a death benefit limit of not less than the Horse's current fair market value of {{HORSE.FAIR_MARKET_VALUE}}, with an effective start date no later than the commencement of this Agreement. Lessee shall provide proof of coverage to Lessor upon request and shall maintain the policy in good standing for the duration of this Agreement; failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.

### Coordination of Coverage

`INSURANCE_RISK.COORDINATION`

**CONDITIONAL** — shows when: TXN.MORT_NOT_REQUIRED = NO or (empty) AND LESSEE.PARTY_TYPE = ENTITY

> Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor's mortality insurance shall be the first policy noticed and claimed against for any such covered event. Lessee's care, custody and control insurance is secondary and shall respond only to the extent the loss was caused by Lessee's gross negligence, reckless conduct, or intentional misconduct. Where a loss was so caused, Lessee shall bear the net cost of any applicable deductible and any uninsured portion of the loss, and the parties shall reimburse one another as necessary to give effect to this allocation regardless of the order in which the policies respond. Each party shall promptly notify its insurer of a covered event and shall cooperate in the submission and adjustment of claims. Absent a determination that Lessee so caused the loss, all deductibles and uninsured amounts remain Lessor's responsibility.

### Risk of Loss of or Injury to the Horse

`INSURANCE_RISK.RISK_OF_LOSS`

> Lessor assumes all risk of loss of or injury to the Horse during the term of this Agreement, except to the extent caused by Lessee's gross negligence, reckless conduct, or intentional misconduct.

### Loss of Use

`INSURANCE_RISK.LOSS_OF_USE_ACK`

> Lessor acknowledges and accepts that loss of use of the Horse may result from injury to, illness of, or the death of the Horse. No loss-of-use insurance is required or provided under this Agreement.

### Assumption of Inherent Risks

`INSURANCE_RISK.ASSUMPTION_INHERENT`

> Lessee understands that horseback riding and handling horses are inherently dangerous activities. Lessee acknowledges that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. Lessee acknowledges the California common law doctrine of "Primary Assumption of Risk," as established by the California Supreme Court in Knight v. Jewett (1992) 3 Cal.4th 296 and subsequent equine-specific case law (e.g., Levinson v. Owens (2009) 176 Cal.App.4th 1534). Consistent with this precedent, Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that no Lessor Party owes a duty to protect Lessee from these inherent risks.

### Release of Liability

`INSURANCE_RISK.RELEASE`

> In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, completely releases, forever discharges, and agrees to hold harmless the Lessor Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee's use, handling, or riding of the Horse, whether caused by the ordinary negligence of any Lessor Party or otherwise. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

### Release of Liability by Lessor

`INSURANCE_RISK.RELEASE_LESSOR`

> In consideration of the mutual promises in this Agreement, Lessor, on behalf of Lessor and anyone claiming by, through, or under Lessor, completely releases, forever discharges, and agrees to hold harmless the Lessee Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessor's riding or handling of the Horse or Lessor's presence at any facility where the Horse is kept during the term of this Agreement, whether caused by the ordinary negligence of any Lessee Party or otherwise. Lessor expressly and voluntarily assumes all inherent risks of equine activities in connection with such riding, handling, or presence. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

### Required Protective Attire

`INSURANCE_RISK.SAFETY_ATTIRE`

> Lessee shall wear, and shall ensure that any other person riding the Horse under Lessee's authorization wears, an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Riders shall provide their own helmet, boots, and pants meeting these requirements unless otherwise agreed in writing. Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes permission to ride or handle the Horse and constitutes a material breach of this Agreement.

### Trail Riding Risks

`INSURANCE_RISK.TRAIL_RIDING`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains TRAIL

> Lessee acknowledges that riding outside an enclosed arena, including trail riding, exposes Lessee and the Horse to additional risks, including uneven terrain, traffic, wildlife, water crossings, and other conditions that may cause the Horse to spook or behave unpredictably. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

### Jumping Risks

`INSURANCE_RISK.JUMPING_RISKS`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains JUMPING

> Lessee acknowledges that jumping the Horse exposes Lessee and the Horse to additional risks beyond flat riding, including refusals, run-outs, awkward or missed distances, falls, unseating, and the Horse landing, stopping, or twisting unpredictably. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

### Competition Risks

`INSURANCE_RISK.COMPETITION_RISKS`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains COMPETITIONS

> Lessee acknowledges that competing with the Horse exposes Lessee and the Horse to additional risks, including unfamiliar and crowded show grounds, proximity to other horses and riders, loudspeakers, banners, and other stimuli that may cause the Horse to spook or behave unpredictably, as well as the physical demands and pressures of competition. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

### Shared Arena Riding Risks

`INSURANCE_RISK.SHARED_ARENA_RISKS`

**CONDITIONAL** — shows when: TXN.PERMITTED_ACTIVITIES contains ARENA_GROUP

> Lessee acknowledges that riding in an arena at the same time as other riders exposes Lessee and the Horse to additional risks, including collisions, crowding, sudden movements or loss of control by other horses or riders, and the Horse reacting to other horses. Lessee agrees to ride with awareness of others, to follow standard arena etiquette and right-of-way rules and any directions of Lessor or an instructor, and voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

### Waiver of Unknown Claims

`INSURANCE_RISK.WAIVER_UNKNOWN`

> Each party, on behalf of itself and anyone claiming by, through, or under it, expressly waives any and all claims released under this Agreement that the waiving party does not know or suspect to exist in its favor at the time of this Agreement. Each party acknowledges that it is familiar with, and expressly waives the protections of, California Civil Code Section 1542, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party." Each party assumes the risk that claims presently unknown to it may later be discovered, and acknowledges that this waiver is a material term of this Agreement.

### Mutual Indemnification

`INSURANCE_RISK.INDEMNIFICATION`

> Each party shall indemnify, defend, and hold harmless the other party and, respectively, the Lessor Parties or the Lessee Parties, from and against any and all claims, damages, losses, liabilities, costs, and expenses arising out of the indemnifying party's use, handling, care, or possession of the Horse, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

### Limitation of Liability

`INSURANCE_RISK.LIMITATION`

> Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the Horse's current fair market value of {{HORSE.FAIR_MARKET_VALUE}}. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct, to either party's indemnification obligations for third-party claims for bodily injury or death, or to amounts actually covered by insurance available for the loss.

## 14. Termination

`TERMINATION`

### Lessee's Right to Terminate

`TERMINATION.LESSEE`

> Lessee may terminate this Agreement by giving Lessor at least {{TXN.LESSEE_TERM_NOTICE_DAYS}} days' prior written notice.

- **Days notice** — `TXN.LESSEE_TERM_NOTICE_DAYS` · input: number · owner: DEAL

### Owner's Right to Terminate

`TERMINATION.OWNER`

> Lessor may terminate this Agreement by giving Lessee at least {{TXN.OWNER_TERM_NOTICE_DAYS}} days' prior written notice.

- **Days notice** — `TXN.OWNER_TERM_NOTICE_DAYS` · input: number · owner: DEAL

### Termination for Cause

`TERMINATION.CAUSE`

> Either party may terminate this Agreement for cause (including a material breach that remains uncured) by giving the other party at least {{TXN.CAUSE_TERM_NOTICE_DAYS}} days' prior written notice.

- **Days notice** — `TXN.CAUSE_TERM_NOTICE_DAYS` · input: number · owner: DEAL

### Self-Termination upon Loss or Injury

`TERMINATION.LOSS`

> This Agreement shall self-terminate if the Horse is significantly injured or seriously ill as determined by a licensed veterinarian, or dies. Lessee is entitled to a prorated refund of Lease Fee paid for the remaining time unused at the time of self-termination. In the event Lessee is found to have caused, through gross negligence, reckless conduct, or intentional misconduct, the injury, illness, or death, Lessor may retain the unused portion of the paid Lease Fee.

### Termination upon Loss of Use

`TERMINATION.LOSS_OF_USE`

> If the Horse becomes unusable for the purposes of this Agreement for any reason, Lessee may terminate this Agreement immediately upon written notice to Lessor. Upon such termination, Lessee is entitled to a prorated refund of any Lease Fee paid for the remaining unused time as of the date of termination.

### Survival

`TERMINATION.SURVIVAL`

> The releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement, and any payment obligations accrued before termination, survive the expiration or termination of this Agreement for any reason.

## 15. Notice and Contact Information

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

## 16. Assignment or Transfer

`ASSIGNMENT`

### Assignment or Transfer

`ASSIGNMENT.NO_ASSIGN`

> Lessee shall not assign, sublease, or otherwise transfer this Agreement or any of Lessee's rights or obligations under it without Lessor's prior written consent, unless permitted in the sections above.

## 17. Entire Agreement

`ENTIRE_AGREEMENT`

### Entire Agreement

`ENTIRE_AGREEMENT.INTEGRATION`

> This Agreement contains the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions and understandings. Any modification of this Agreement must be in writing and signed by all parties.

## 18. Governing Law and Venue

`GOVERNING_LAW`

### Governing Law and Venue

`GOVERNING_LAW.CHOICE`

> This Agreement is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or relating to this Agreement or the Horse shall be resolved by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, or another administrator the parties agree to in writing, with arbitrator fees and administrative costs allocated as those rules provide. Either party may bring a qualifying claim in small claims court, and either party may seek provisional or injunctive relief, including recovery of possession of the Horse, in a court of competent jurisdiction without waiving arbitration. Judgment on the award may be entered in any court having jurisdiction.

## 19. Attorneys' Fees

`ATTORNEYS_FEES`

### Attorneys' Fees

`ATTORNEYS_FEES.PREVAILING`

> Each party shall cover their own attorney's fees and costs.

## 20. Severability

`SEVERABILITY`

### Severability

`SEVERABILITY.SAVING`

> If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.

## 21. Lessee's Representations

`LESSEE_REPS`

### Lessee's Representations

`LESSEE_REPS.MAIN_INDIVIDUAL`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = INDIVIDUAL

> Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into this Agreement; that Lessee has no physical or mental condition that would prevent Lessee from safely participating in the activities contemplated by this Agreement; and that Lessee has the requisite knowledge and experience to handle and ride the Horse, and will use reasonable care in doing so and follow Lessor's instructions. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and anyone claiming by, through, or under Lessee, including the right to sue the Lessor Parties.

### Lessee's Representations

`LESSEE_REPS.MAIN_ENTITY`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY

> Lessee represents and warrants that Lessee is duly organized and in good standing, and has full authority to enter into this Agreement, and that the individual signing this Agreement does so as Lessee's authorized representative; that each person who rides or handles the Horse under Lessee's authorization will, before doing so, have executed the releases required under this Agreement and possess the knowledge and experience to handle and ride the Horse safely; and that Lessee will use reasonable care and follow Lessor's instructions in all handling of the Horse. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and anyone claiming by, through, or under Lessee, including the right to sue the Lessor Parties.

### Lessee's Representations

`LESSEE_REPS.PENDING`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = (empty)

> [Pending — select whether Lessee is an individual or an entity. This placeholder is replaced by the applicable representations and blocks signing.]

## 22. Signatures

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

### LESSEE_CAPACITY *(no heading set)*

`SIGNATURES.LESSEE_CAPACITY`

**CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY

> By: {{LESSEE.ENTITY_SIGNER_NAME}}
> Title: {{LESSEE.ENTITY_SIGNER_TITLE}}
> Signing on behalf of {{LESSEE.FULL_NAME}}

- **Signing individual — name** — `LESSEE.ENTITY_SIGNER_NAME` · input: text · required · owner: LESSEE
    - **CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY
- **Signing individual — title** — `LESSEE.ENTITY_SIGNER_TITLE` · input: text · required · owner: LESSEE
    - **CONDITIONAL** — shows when: LESSEE.PARTY_TYPE = ENTITY

### LESSOR_CAPACITY *(no heading set)*

`SIGNATURES.LESSOR_CAPACITY`

**CONDITIONAL** — shows when: LESSOR.PARTY_TYPE = ENTITY

> By: {{LESSOR.ENTITY_SIGNER_NAME}}
> Title: {{LESSOR.ENTITY_SIGNER_TITLE}}
> Signing on behalf of {{LESSOR.FULL_NAME}}

- **Signing individual — name** — `LESSOR.ENTITY_SIGNER_NAME` · input: text · required · owner: LESSOR
    - **CONDITIONAL** — shows when: LESSOR.PARTY_TYPE = ENTITY
- **Signing individual — title** — `LESSOR.ENTITY_SIGNER_TITLE` · input: text · required · owner: LESSOR
    - **CONDITIONAL** — shows when: LESSOR.PARTY_TYPE = ENTITY

## Fields not attached to any clause

- **First monthly payment date** — `TXN.MONTHLY_START` · input: date · owner: DEAL · clause_key: LEASE_FEE.PAYMENTS

