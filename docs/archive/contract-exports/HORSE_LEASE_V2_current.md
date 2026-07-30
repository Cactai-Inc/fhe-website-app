# HORSE_LEASE_V2 — Current Lease Agreement (structured export)

The LIVE lease template (`start_lease_contract_v2`). The agreement is assembled from a structured authoring model: **Sections › Clauses (with body text + {{TOKENS}}) › Fields**. Revise clause bodies / headings / fields / ordering as needed. **Keep the `[KEY]` identifiers** so changes map back precisely; where you want something added or removed, say so explicitly (e.g. "ADD clause after CARE.VET" / "REMOVE clause ASSIGNMENT.SUBLEASE").

Tokens like `{{LESSOR.FULL_NAME}}` are auto-filled at generation — leave them intact unless a change requires it.

---

## [PARTIES] Parties

### Clauses

**[PARTIES.INTRO]**

This Horse Lease Agreement (the "Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} by and between {{LESSOR.FULL_NAME}} of {{LESSOR.ADDRESS}} ("Lessor") and {{LESSEE.FULL_NAME}} of {{LESSEE.ADDRESS}} ("Lessee").

### Fields
- **[LESSEE.PARTY_TYPE]** Lessee is an — _select/select_, owner: LESSEE, required · options: [{"label":"Individual","value":"INDIVIDUAL"},{"label":"Entity / organization","value":"ENTITY"}]

## [PURPOSE] Purpose and Lease Grant

### Clauses

**[PURPOSE.RECREATION]** — Purpose of Agreement _(shown when: {"equals":["RECREATIONAL","INSTRUCTIONAL","COMPETITION","COMMERCIAL"],"field_key":"TXN.LEASE_PURPOSE"})_

For {{TXN.LEASE_PURPOSE}} purposes, Lessee wishes to ride and/or handle Lessor's horse, and Lessor agrees to allow Lessee to ride and/or handle Lessor's horse in exchange for the consideration described herein.

**[PURPOSE.RECREATION_DEFAULT]** — Purpose of Agreement _(shown when: {"equals":[""],"field_key":"TXN.LEASE_PURPOSE"})_

For the purposes permitted herein, Lessee wishes to ride and/or handle Lessor's horse, and Lessor agrees to allow Lessee to ride and/or handle Lessor's horse in exchange for the consideration described herein.

**[PURPOSE.GRANT]** — Lease Grant

Subject to the terms and conditions of this Agreement, Lessor agrees to lease to Lessee and Lessee agrees to lease from Lessor the horse described below.

**[PURPOSE.LEASE_TYPE]** — Lease Type

Lease type: {{TXN.LEASE_TYPE}}.

### Fields
- **[TXN.LEASE_PURPOSE]** Purpose of the lease — _select/select_, owner: DEAL · options: [{"label":"recreational","value":"RECREATIONAL"},{"label":"instructional","value":"INSTRUCTIONAL"},{"label":"competition","value":"COMPETITION"},{"label":"commercial program","value":"COMMERCIAL"}]
- **[TXN.LEASE_TYPE]** Lease type — _select/select_, owner: LESSOR, required · options: [{"label":"Full lease (full-time access)","value":"FULL"},{"label":"Partial lease (shared or limited access)","value":"PARTIAL"}]

## [SCHEDULE] Schedule for Lessee's Usage

### Clauses

**[SCHEDULE.MAIN]** — Schedule for Lessee's Usage _(shown when: {"equals":["PARTIAL"],"field_key":"TXN.LEASE_TYPE"})_

Reserved days of use: {{TXN.DAYS_USED}}

**[SCHEDULE.OTHER]** _(shown when: {"equals":["PARTIAL"],"field_key":"TXN.LEASE_TYPE"})_

Additional or custom schedule terms: {{TXN.SCHEDULE_TERMS}}

**[SCHEDULE.CHANGES]** — Schedule Changes _(shown when: {"equals":["PARTIAL"],"field_key":"TXN.LEASE_TYPE"})_

Any changes to the agreed upon schedule must be made and accepted in writing.

### Fields
- **[TXN.SCHEDULE_TERMS]** Additional schedule terms — _longtext/longtext_, owner: LESSOR
- **[TXN.DAYS_USED]** Reserved days of use — _week_grid/text_, owner: DEAL

## [LEASE_FEE] Lease Fee

### Clauses

**[LEASE_FEE.CHOICE]**

{{TXN.LEASE_FEE}}

### Fields
- **[TXN.LEASE_FEE]** Lease fee — _fee_schedule/text_, owner: LESSOR
- **[TXN.MONTHLY_START]** First monthly payment date — _date/date_, owner: DEAL · shown when: {"equals":["FEE"],"field_key":"TXN.LEASE_FEE_TYPE"}

## [PAYMENT_TERMS] Payment Terms

### Clauses

**[PAYMENT_TERMS.OFFSET]** — Right of Offset

A party to whom money is owed under this Agreement may offset the amount owed against any amount that party owes to the other party.

**[PAYMENT_TERMS.RECEIPTS]** — Receipts

A party seeking reimbursement for an expense paid on behalf of the other party shall provide a receipt or other reasonable documentation of the expense as a condition of reimbursement.

**[PAYMENT_TERMS.LATE]** — Late Payments

All payments are due on their due date or within 5 business days of notification of the amount owed. Payments will be deemed late if they remain unpaid on the 6th business day. Late payments are considered a breach of the contract terms and may be grounds for termination of the Agreement unless the party from whom the payment is owed has communicated in writing the date by which payment will be made. Payments exceeding 1 calendar month in past-due status constitute grounds for termination for cause under the Termination for Cause provisions of this Agreement unless prior written acceptance of the delay is provided by the party to whom the payment is owed.

## [PAYMENT_METHOD] Payment Method

### Clauses

**[PAYMENT_METHOD.MAIN]** — Payments by the Lessee

The Lessee may pay amounts owed under this Agreement by the following method(s): {{TXN.PAYMENT_METHODS}}.

**[PAYMENT_METHOD.CARD]** _(shown when: {"contains":["CREDIT_CARD"],"field_key":"TXN.PAYMENT_METHODS"})_

Credit card payments are processed as follows: {{TXN.CARD_PROCESSOR}}.

**[PAYMENT_METHOD.MAIN_LESSOR]** — Payments by the Lessor

The Lessor may pay amounts owed under this Agreement by the following method(s): {{TXN.LESSOR_PAYMENT_METHODS}}.

**[PAYMENT_METHOD.CARD_LESSOR]** _(shown when: {"contains":["CREDIT_CARD"],"field_key":"TXN.LESSOR_PAYMENT_METHODS"})_

Credit card payments are processed as follows: {{TXN.LESSOR_CARD_PROCESSOR}}.

### Fields
- **[TXN.PAYMENT_METHODS]** Accepted payment methods — _buttons/checkbox_, owner: LESSOR · options: [{"label":"Cash","value":"CASH"},{"label":"Zelle","value":"ZELLE"},{"label":"Credit Card","value":"CREDIT_CARD"}]
- **[TXN.CARD_PROCESSOR]** Card processor & instructions — _longtext/longtext_, owner: LESSOR
- **[TXN.LESSOR_PAYMENT_METHODS]** Accepted payment methods — _buttons/checkbox_, owner: LESSEE · options: [{"label":"Cash","value":"CASH"},{"label":"Zelle","value":"ZELLE"},{"label":"Credit Card","value":"CREDIT_CARD"}]
- **[TXN.LESSOR_CARD_PROCESSOR]** Card processor & instructions — _longtext/longtext_, owner: LESSEE

## [HORSE] The Horse

### Clauses

**[HORSE.IDENTITY]** — Horse

This Agreement applies to the following horse (the "Horse"): {{HORSE.REGISTERED_NAME}}
Color: {{HORSE.COLOR}}
Markings: {{HORSE.MARKINGS}}
Breed: {{HORSE.BREED}}
Registration Number: {{HORSE.REGISTRATION_NUMBER}}
Sex: {{HORSE.SEX}}
Year foaled: {{HORSE.AGE_DOB}}
Current fair market value: {{HORSE.FAIR_MARKET_VALUE}}
Microchip: {{HORSE.MICROCHIP}}
Passport: {{HORSE.PASSPORT_NUMBER}}

**[HORSE.OWNERSHIP]** — Ownership of the Horse

Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.

**[HORSE.COOWNERS]**

Co-owners: {{TXN.CO_OWNERS}}

**[HORSE.OWNERSHIP_LIMITS_Q]**

Are there any ownership related leasing restrictions? {{TXN.HAS_OWNERSHIP_LIMITS}}

**[HORSE.OWNERSHIP_LIMITS]** _(shown when: {"equals":["YES"],"field_key":"TXN.HAS_OWNERSHIP_LIMITS"})_

Ownership related leasing restrictions: {{TXN.OWNERSHIP_LIMITATIONS}}

**[HORSE.BEHAVIOR]** — Behavior

The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.

**[HORSE.BEHAVIOR_EXC]** _(shown when: {"equals":["YES"],"field_key":"TXN.BEHAVIOR_HAS_EXCEPTIONS"})_

The Lessor notes the following known exceptions to the behavior of the Horse: {{TXN.BEHAVIOR_EXCEPTIONS}}.

**[HORSE.CONDITION]** — Physical Condition

The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement.

**[HORSE.CONDITION_EXC]** _(shown when: {"equals":["YES"],"field_key":"TXN.CONDITION_HAS_EXCEPTIONS"})_

The Lessor notes the following known exceptions to the physical condition of the Horse: {{TXN.CONDITION_EXCEPTIONS}}.

**[HORSE.VET_CHECK]** — Pre-Lease Veterinary Examination

Pre-lease veterinary examination of the Horse: {{TXN.VET_CHECK_CHOICE}}

**[HORSE.TRAINER_EVAL]** — Pre-Lease Trainer Evaluation

Pre-lease trainer evaluation of the Horse: {{TXN.TRAINER_EVAL_CHOICE}}

**[HORSE.WARRANTY]** — Disclaimer of Warranties

Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE.

### Fields
- **[TXN.CO_OWNERS]** Co-owner(s) — _contacts_list/text_, owner: LESSOR
- **[TXN.HAS_OWNERSHIP_LIMITS]** Any limitations on ownership? — _yesno/text_, owner: LESSOR
- **[TXN.OWNERSHIP_LIMITATIONS]** Ownership limitations — _longtext/longtext_, owner: LESSOR
- **[HORSE.REGISTERED_NAME]** Registered name — _text/text_, owner: LESSOR, required
- **[TXN.VET_CHECK_CHOICE]** Pre-lease veterinary examination — _buttons/select_, owner: LESSOR · options: [{"label":"Lessee requested at their own expense","value":"LESSEE_OWN"},{"label":"Lessee requested at Lessor's expense","value":"LESSEE_AT_LESSOR"},{"label":"Lessor provided at no cost","value":"LESSOR_FREE"},{"label":"Lessee waives the option","value":"WAIVED"}]
- **[TXN.TRAINER_EVAL_CHOICE]** Professional suitability evaluation — _buttons/select_, owner: LESSOR · options: [{"label":"Lessee requested at their own expense","value":"LESSEE_OWN"},{"label":"Lessee requested at Lessor's expense","value":"LESSEE_AT_LESSOR"},{"label":"Lessor provided at no cost","value":"LESSOR_FREE"},{"label":"Lessee waives the option","value":"WAIVED"}]
- **[TXN.CONDITION_EXCEPTIONS]** Known condition exceptions — _longtext/longtext_, owner: DEAL
- **[HORSE.COLOR]** Color — _select/select_, owner: LESSOR · options: [{"label":"Bay","value":"BAY"},{"label":"Chestnut","value":"CHESTNUT"},{"label":"Gray","value":"GRAY"},{"label":"Black","value":"BLACK"},{"label":"Brown","value":"BROWN"},{"label":"Roan","value":"ROAN"},{"label":"Palomino","value":"PALOMINO"},{"label":"Pinto / Paint","value":"PINTO"},{"label":"Buckskin","value":"BUCKSKIN"},{"label":"Dun","value":"DUN"},{"label":"White / Cremello","value":"WHITE"}]
- **[TXN.BEHAVIOR_EXCEPTIONS]** Known behavior exceptions — _longtext/longtext_, owner: DEAL
- **[TXN.CONDITION_HAS_EXCEPTIONS]** Any exceptions to note? — _yesno/text_, owner: LESSOR
- **[HORSE.MARKINGS]** Markings — _text/text_, owner: LESSOR
- **[HORSE.BREED]** Breed — _select/select_, owner: LESSOR · options: [{"label":"Warmblood","value":"WARMBLOOD"},{"label":"Thoroughbred","value":"THOROUGHBRED"},{"label":"Quarter Horse","value":"QUARTER_HORSE"},{"label":"Arabian","value":"ARABIAN"},{"label":"Pony","value":"PONY"},{"label":"Draft","value":"DRAFT"},{"label":"Appaloosa","value":"APPALOOSA"},{"label":"Morgan","value":"MORGAN"},{"label":"Friesian","value":"FRIESIAN"},{"label":"Andalusian","value":"ANDALUSIAN"},{"label":"Mustang","value":"MUSTANG"},{"label":"Crossbred / Grade","value":"CROSSBRED"}]
- **[TXN.BEHAVIOR_HAS_EXCEPTIONS]** Any exceptions to note? — _yesno/text_, owner: LESSOR
- **[HORSE.REGISTRATION_NUMBER]** Registration number — _text/text_, owner: LESSOR
- **[HORSE.SEX]** Sex — _select/select_, owner: LESSOR · options: [{"label":"Mare","value":"MARE"},{"label":"Gelding","value":"GELDING"},{"label":"Stallion","value":"STALLION"},{"label":"Colt","value":"COLT"},{"label":"Filly","value":"FILLY"}]
- **[HORSE.AGE_DOB]** Year foaled — _text/text_, owner: LESSOR
- **[HORSE.FAIR_MARKET_VALUE]** Fair market value — _currency/currency_, owner: LESSOR
- **[HORSE.MICROCHIP]** Microchip # — _text/text_, owner: LESSOR
- **[HORSE.PASSPORT_NUMBER]** Passport # — _text/text_, owner: LESSOR

## [LOCATION] Location of Horse

### Clauses

**[LOCATION.MAIN]** — Location of the Horse

Location of the Horse: {{HORSE.CURRENT_LOCATION}}.

**[LOCATION.MOVE_CHOICE]**

**[LOCATION.NEW]** _(shown when: {"equals":["YES"],"field_key":"TXN.HORSE_MOVES"})_

Location during lease term: {{TXN.NEW_LOCATION}}.

**[LOCATION.INSPECTION]**

Lessor may inspect the Horse at any time. If Lessor determines that the Horse is not being properly cared for, Lessor may take possession of the Horse.

### Fields
- **[TXN.HORSE_MOVES]** Horse will move to a new location for the Lessee — _yesno/text_, owner: LESSOR
- **[TXN.NEW_LOCATION]** Location during lease term — _location/text_, owner: LESSOR
- **[HORSE.CURRENT_LOCATION]** Facility — _location/text_, owner: LESSOR

## [EVALUATION] Evaluation Period

### Clauses

**[EVALUATION.CHOICE]**

**[EVALUATION.DATES_INCLUDED]** — Evaluation Period _(shown when: {"all":[{"contains":["REQUESTED","REQUIRED"],"field_key":"TXN.EVALUATION_ENABLED"},{"equals":["INCLUDED",""],"field_key":"TXN.EVALUATION_FEE_MODE"}]})_

Lessee shall have an evaluation period of {{TXN.EVALUATION_LENGTH}} {{TXN.EVALUATION_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is included at no separate charge, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.

**[EVALUATION.DATES_FIXED]** — Evaluation Period _(shown when: {"all":[{"contains":["REQUESTED","REQUIRED"],"field_key":"TXN.EVALUATION_ENABLED"},{"equals":["FIXED"],"field_key":"TXN.EVALUATION_FEE_MODE"}]})_

Lessee shall have an evaluation period of {{TXN.EVALUATION_LENGTH}} {{TXN.EVALUATION_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is {{TXN.EVALUATION_FEE_AMOUNT}}, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.

### Fields
- **[TXN.EVALUATION_ENABLED]** Evaluation period — _buttons/select_, owner: DEAL · options: [{"label":"Requested by Lessee","value":"REQUESTED"},{"label":"Required by Lessor","value":"REQUIRED"},{"label":"Refused by Lessor","value":"REFUSED"},{"label":"Waived by Lessee","value":"WAIVED"}]
- **[TXN.EVALUATION_LENGTH]** Length — _number/number_, owner: LESSOR
- **[TXN.EVALUATION_UNIT]** Unit — _select/select_, owner: LESSOR · options: [{"label":"days","value":"DAYS"},{"label":"weeks","value":"WEEKS"},{"label":"months","value":"MONTHS"}]
- **[TXN.EVALUATION_FEE_MODE]** Evaluation period fee — _select/select_, owner: LESSOR · shown when: {"contains":["REQUESTED","REQUIRED"],"field_key":"TXN.EVALUATION_ENABLED"} · options: [{"label":"Included at no separate charge","value":"INCLUDED"},{"label":"Fixed fee","value":"FIXED"}]
- **[TXN.EVALUATION_FEE_AMOUNT]** Evaluation fee amount — _currency/currency_, owner: LESSOR · shown when: {"all":[{"contains":["REQUESTED","REQUIRED"],"field_key":"TXN.EVALUATION_ENABLED"},{"equals":["FIXED"],"field_key":"TXN.EVALUATION_FEE_MODE"}]}

## [TERM] Agreement Term

### Clauses

**[TERM.MAIN]** — Agreement Term

Term of this Agreement: {{TXN.LEASE_TERM_TYPE}}. This Agreement begins on {{TXN.LEASE_START}}.

**[TERM.FIXED_END]** _(shown when: {"equals":["FIXED"],"field_key":"TXN.LEASE_TERM_TYPE"})_

This Agreement continues until {{TXN.LEASE_END}}.

**[TERM.RENEWAL]** — Renewal Terms _(shown when: {"equals":["YES"],"field_key":"TXN.RENEWAL_INCLUDE"})_

Renewal terms: {{TXN.RENEWAL_TERMS}}

**[TERM.ADDITIONAL]**

Additional terms: {{TXN.ADDITIONAL_TERMS}}

**[TERM.TERMINATION_XREF]**

Notwithstanding the term stated above, this Agreement may be terminated earlier as provided in the Termination section of this Agreement.

### Fields
- **[TXN.ADDITIONAL_TERMS]** Add additional terms — _add_text/text_, owner: LESSOR
- **[TXN.RENEWAL_INCLUDE]** Include renewal terms — _certify/checkbox_, owner: LESSOR
- **[TXN.LEASE_TERM_TYPE]** Term type — _select/select_, owner: DEAL, required · options: [{"label":"Fixed period","value":"FIXED"},{"label":"Open-ended","value":"OPEN_ENDED"},{"label":"Other","value":"OTHER"}]
- **[TXN.RENEWAL_TERMS]** Renewal terms — _longtext/longtext_, owner: DEAL
- **[TXN.LEASE_START]** Lease start date — _date/date_, owner: DEAL, required
- **[TXN.LEASE_END]** Lease end date — _date/date_, owner: DEAL

## [PERMITTED_USE] Permitted Use(s) & Restrictions

### Clauses

**[PERMITTED_USE.MAIN]** — Permitted Use(s)

Lessor grants Lessee the right to use the Horse for the following purpose(s): {{TXN.PERMITTED_ACTIVITIES}}
Lessee shall not use the Horse for any other purpose without Lessor's prior written consent.

**[PERMITTED_USE.TRAINER]** _(shown when: {"contains":["LESSONS","JUMPING","COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

Riding Lessons, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trainer or Instructor is present.

**[TRAINING_LESSONS.LESSONS]** — Lessons

Lessee is required to maintain continuous enrollment in weekly riding lessons: {{TXN.LESSONS_REQUIRED}}.
Lessons shall be conducted only by a French Heritage Equestrian Approved Instructor.

**[TRAINING_LESSONS.TRAINING]** — Training

Any professional training of the Horse under this Agreement, including groundwork, schooling, and under-saddle training, shall be conducted only by a French Heritage Equestrian Approved Trainer.

**[COMPETITIONS.INTRO]** — Competitions _(shown when: {"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

Expenses of competition (entry fees, transportation, and the like) are: {{TXN.COMPETITION_EXPENSES}}.
Any prize money or winnings earned in competition shall belong to: {{TXN.COMPETITION_WINNINGS}}.

**[RESTRICT.JUMP_TITLE]** — Jumping Restrictions _(shown when: {"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

{{TXN.JUMP_OMIT}}

**[RESTRICT.JUMP_ON]** _(shown when: {"all":[{"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO"],"field_key":"TXN.JUMP_OMIT"}]})_

Jumping is restricted as follows: maximum height {{TXN.JUMP_MAX_HEIGHT}}; no more than {{TXN.JUMP_DAYS_PER_WEEK}} days per week; under trainer supervision only: {{TXN.JUMP_SUPERVISION}}.

**[RESTRICT.JUMP_OFF]** _(shown when: {"all":[{"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.JUMP_OMIT"}]})_

Lessor does not restrict jumping.

**[RESTRICT.COMP_TITLE]** — Competition Restrictions _(shown when: {"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

{{TXN.COMP_OMIT}}

**[RESTRICT.COMP_ON]** _(shown when: {"all":[{"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO"],"field_key":"TXN.COMP_OMIT"}]})_

Competitions are restricted as follows: {{TXN.COMP_RESTRICTION}}.

**[RESTRICT.COMP_OFF]** _(shown when: {"all":[{"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.COMP_OMIT"}]})_

Lessor does not restrict competitions.

**[RESTRICT.TRAIL_TITLE]** — Trail-Riding Restrictions _(shown when: {"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

{{TXN.TRAIL_OMIT}}

**[RESTRICT.TRAIL_ON]** _(shown when: {"all":[{"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["NO"],"field_key":"TXN.TRAIL_OMIT"}]})_

Trail riding is restricted as follows: {{TXN.TRAIL_RESTRICTION}}.

**[RESTRICT.TRAIL_OFF]** _(shown when: {"all":[{"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"},{"equals":["YES"],"field_key":"TXN.TRAIL_OMIT"}]})_

Lessor does not restrict trail riding.

**[PERMITTED_USE.RESTRICTIONS]** — Additional Restrictions

Additional restrictions: {{TXN.PERMITTED_RESTRICTIONS}}

**[PROHIBITED.OTHER]** — Other Allowed Activities _(shown when: {"contains":["BREEDING","EMOTIONAL_SUPPORT","FILM_TV_AD","OTHER"],"field_key":"TXN.ADDITIONAL_ACTIVITIES"})_

Lessee is permitted to engage in the following additional activities with the Horse: {{TXN.ADDITIONAL_ACTIVITIES}}.

**[PROHIBITED.OTHER_NONE]** — Other Allowed Activities _(shown when: {"equals":["","NONE"],"field_key":"TXN.ADDITIONAL_ACTIVITIES"})_

Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.

**[PROHIBITED.OTHER_NOTE]** _(shown when: {"contains":["OTHER"],"field_key":"TXN.ADDITIONAL_ACTIVITIES"})_

Other additional permitted activity: {{TXN.ADDITIONAL_ACTIVITIES_OTHER}}.

**[PROHIBITED.OTHERS]** — Allowing Others to Ride

The following additional persons may ride or handle the Horse without Lessor's prior permission: {{TXN.OTHERS_ALLOWED}}.
Only the persons identified above shall be permitted to ride or handle the Horse without Lessor's written permission.

**[PROHIBITED.OTHERS_OTHER]** _(shown when: {"contains":["OTHER"],"field_key":"TXN.OTHERS_ALLOWED"})_

Other persons allowed to ride or handle the Horse: {{TXN.OTHERS_ALLOWED_OTHER}}.

**[PERMITTED_USE.RELEASES_REQUIRED]** — Releases Required for Authorized Riders

No person other than Lessee may ride or handle the Horse under this Agreement unless that person (or, if a minor, that person's parent or legal guardian) has first executed a liability release in favor of the Lessor Parties in a form reasonably acceptable to Lessor. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.

**[PERMITTED_USE.TRANSPORT]** — Transport of the Horse

Transport of the Horse to offsite locations (other than for medical care, which is always permitted): {{TXN.OFFSITE_TRANSPORT}}
For clarity, riding trails attached to the location at which the Horse is kept under this Agreement are not offsite locations.

### Fields
- **[TXN.OTHERS_ALLOWED_OTHER]** Other persons allowed — _text/text_, owner: LESSOR · shown when: {"contains":["OTHER"],"field_key":"TXN.OTHERS_ALLOWED"}
- **[TXN.COMP_OMIT]** No competition restrictions — _certify/checkbox_, owner: LESSOR
- **[TXN.JUMP_OMIT]** No jumping restrictions — _certify/checkbox_, owner: LESSOR
- **[TXN.COMP_RESTRICTION]** Competition restriction — _text/text_, owner: LESSOR
- **[TXN.TRAIL_RESTRICTION]** Trail-riding restriction — _text/text_, owner: LESSOR
- **[TXN.TRAIL_OMIT]** No trail-riding restrictions — _certify/checkbox_, owner: LESSOR
- **[TXN.ADDITIONAL_ACTIVITIES]** Additional permitted activities — _buttons/checkbox_, owner: DEAL · options: [{"label":"None \u2014 no additional activities","value":"NONE"},{"label":"Breeding","value":"BREEDING"},{"label":"Emotional Support Services","value":"EMOTIONAL_SUPPORT"},{"label":"Film / Television / Advertising","value":"FILM_TV_AD"},{"label":"Other","value":"OTHER"}]
- **[TXN.COMPETITION_EXPENSES]** Competition expenses — _select/select_, owner: DEAL · options: [{"label":"Paid by Lessee","value":"LESSEE"},{"label":"Paid by Lessor","value":"OWNER"},{"label":"Other","value":"OTHER"}]
- **[TXN.JUMP_MAX_HEIGHT]** Maximum height — _text/text_, owner: DEAL
- **[TXN.LESSONS_REQUIRED]** Lessee required to take lessons? — _yesno/select_, owner: DEAL
- **[TXN.OTHERS_ALLOWED]** Others allowed to ride — _buttons/checkbox_, owner: DEAL · options: [{"label":"None","value":"NONE"},{"label":"Lessee's family members","value":"FAMILY"},{"label":"The trainer/instructor","value":"TRAINER"},{"label":"Other","value":"OTHER"}]
- **[TXN.PERMITTED_ACTIVITIES]** Permitted activities — _buttons/checkbox_, owner: DEAL, required · options: [{"label":"Riding Lessons","value":"LESSONS"},{"label":"Solo Arena Riding","value":"ARENA_SOLO"},{"label":"Group Arena Riding","value":"ARENA_GROUP"},{"label":"Jumping","value":"JUMPING"},{"label":"Competitions","value":"COMPETITIONS"},{"label":"Trail Riding","value":"TRAIL"}]
- **[TXN.COMPETITION_WINNINGS]** Competition winnings — _select/select_, owner: DEAL · options: [{"label":"Lessee","value":"LESSEE"},{"label":"Lessor","value":"OWNER"},{"label":"Other","value":"OTHER"}]
- **[TXN.JUMP_DAYS_PER_WEEK]** Days per week — _number/number_, owner: DEAL
- **[TXN.JUMP_SUPERVISION]** Only under trainer supervision? — _yesno/select_, owner: DEAL
- **[TXN.OFFSITE_TRANSPORT]** Offsite transport — _select/select_, owner: LESSOR · options: [{"label":"Lessor grants permission to transport offsite","value":"GRANTED"},{"label":"Lessor prohibits offsite transport without written consent","value":"PROHIBITED"}]
- **[TXN.PERMITTED_RESTRICTIONS]** Add Restrictions — _add_text/text_, owner: LESSOR
- **[TXN.ADDITIONAL_ACTIVITIES_OTHER]** Other additional permitted activity — _text/text_, owner: LESSOR · shown when: {"contains":["OTHER"],"field_key":"TXN.ADDITIONAL_ACTIVITIES"}

## [CARE] Horse Care and Expenses

### Clauses

**[SCHEDULE.CARE_DUTY]** — Lessee's Responsibility for Care and Exercise _(shown when: {"equals":["YES"],"field_key":"TXN.EXERCISE_INCLUDE"})_

Lessee's use of the Horse is a responsibility as well as a right: regular, consistent exercise and attention are important to the Horse's health and wellbeing. Lessee is required to maintain regular use and exercise for the Horse on their allowed days, unless Lessee has discussed with and received mutual agreement from the Lessor in writing that one of those days will be used as a rest day for the Horse. If Lessee regularly fails to use and care for the Horse, Lessor may terminate this Agreement.

**[SCHEDULE.TRAINER_CARE]** — 3rd Party Exercise _(shown when: {"equals":["YES"],"field_key":"TXN.TRAINER_CARE_INCLUDE"})_

Lessee is permitted to engage an approved 3rd party to exercise the Horse. All 3rd party exercise shall be conducted only by a French Heritage Equestrian Approved Trainer. Other 3rd parties must be approved in writing by the Lessor.
Party responsible for arranging: {{TXN.TRAINER_EXERCISE_ARRANGE}}
Party responsible for costs: {{TXN.TRAINER_EXERCISE_COST}}
Lessee's share of the cost: {{TXN.TRAINER_EXERCISE_SPLIT_PCT}}

**[CARE.INTRO]**

Horse care and expenses shall be managed and paid for by the responsible party as listed below.

**[CARE.SUPPLEMENTS]**

{{TXN.MEDICATIONS}}

**[CARE.FARRIER]** — Farrier Care

Party responsible for arranging: {{TXN.FARRIER_ARRANGE}}
Party responsible for costs: {{TXN.FARRIER_COST_PARTY}}
Farrier: {{HORSE.FARRIER_NAME}}
Farrier phone: {{HORSE.FARRIER_PHONE}}

**[CARE.ROUTINE_VET]** — Veterinary Care

Party responsible for arranging: {{TXN.VET_ARRANGE}}
Party responsible for costs: {{TXN.VET_COST_PARTY}}
Veterinarian: {{HORSE.VET_NAME}}
Practice: {{HORSE.VET_BUSINESS}}
Address: {{HORSE.VET_ADDRESS}}
Veterinarian phone: {{HORSE.VET_PHONE}}

**[CARE.PROTECTIVE]** — Protective Equipment

Horse must wear protective equipment: {{TXN.PROTECTIVE_REQUIRED}}

**[CARE.PROTECTIVE_EQUIP]** _(shown when: {"equals":["YES"],"field_key":"TXN.PROTECTIVE_REQUIRED"})_

Lessor will provide the following equipment for the Horse: {{TXN.PROTECTIVE_EQUIPMENT}}
Lessee must ensure equipment is used and properly secured to the Horse prior to all activities.

**[CARE.TACK]** — Tack

When riding and handling the Horse, Lessee shall use only tack in good condition that is properly fitted to the Horse.
{{TXN.TACK_PROHIBITED}}

**[CARE.RIDER_AIDS]** — Rider Aids

The following rider aids are prohibited: {{TXN.RIDER_AIDS}}.

**[CARE.RIDER_AIDS_OTHER]** _(shown when: {"contains":["OTHER"],"field_key":"TXN.RIDER_AIDS"})_

Other prohibited rider aid: {{TXN.RIDER_AIDS_OTHER}}.

### Fields
- **[TXN.TRAINER_CARE_INCLUDE]** Include 3rd party exercise — _certify/checkbox_, owner: LESSOR
- **[TXN.EXERCISE_INCLUDE]** Include Lessee care & exercise responsibility — _certify/checkbox_, owner: LESSOR
- **[TXN.VET_ARRANGE]** Party responsible for arranging — _select/select_, owner: LESSOR · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]
- **[TXN.TRAINER_EXERCISE_ARRANGE]** Party responsible for arranging — _select/select_, owner: LESSOR · shown when: {"equals":["YES"],"field_key":"TXN.TRAINER_CARE_INCLUDE"} · options: [{"label":"Lessee","value":"LESSEE"},{"label":"Lessor","value":"LESSOR"},{"label":"Shared","value":"SHARED"}]
- **[TXN.MEDICATIONS]** Medications and supplements — _med_schedule/text_, owner: LESSOR
- **[TXN.RIDER_AIDS]** Prohibited rider aids — _buttons/checkbox_, owner: DEAL · options: [{"label":"Crop or bat","value":"CROP"},{"label":"Longe whip","value":"LONGE_WHIP"},{"label":"Dressage whip","value":"DRESSAGE_WHIP"},{"label":"Other","value":"OTHER"}]
- **[TXN.FARRIER_ARRANGE]** Party responsible for arranging — _select/select_, owner: LESSOR · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]
- **[TXN.TRAINER_EXERCISE_COST]** Party responsible for costs — _select/select_, owner: LESSOR · shown when: {"equals":["YES"],"field_key":"TXN.TRAINER_CARE_INCLUDE"} · options: [{"label":"Lessee","value":"LESSEE"},{"label":"Lessor","value":"LESSOR"},{"label":"Shared","value":"SHARED"}]
- **[TXN.TRAINER_EXERCISE_SPLIT_PCT]** Lessee's share of the cost — _percent/number_, owner: LESSOR · shown when: {"all":[{"equals":["YES"],"field_key":"TXN.TRAINER_CARE_INCLUDE"},{"equals":["SHARED"],"field_key":"TXN.TRAINER_EXERCISE_COST"}]}
- **[HORSE.FARRIER_NAME]** Farrier — _text/text_, owner: LESSOR · shown when: {"equals":["LESSEE"],"field_key":"TXN.FARRIER_ARRANGE"}
- **[HORSE.VET_NAME]** Veterinarian — _text/text_, owner: LESSOR · shown when: {"equals":["LESSEE"],"field_key":"TXN.VET_ARRANGE"}
- **[TXN.FARRIER_COST_PARTY]** Party responsible for costs — _select/select_, owner: LESSOR · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]
- **[TXN.VET_COST_PARTY]** Party responsible for costs — _select/select_, owner: LESSOR · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]
- **[HORSE.VET_BUSINESS]** Practice — _text/text_, owner: LESSOR · shown when: {"equals":["LESSEE"],"field_key":"TXN.VET_ARRANGE"}
- **[HORSE.FARRIER_PHONE]** Farrier phone — _text/text_, owner: LESSOR · shown when: {"equals":["LESSEE"],"field_key":"TXN.FARRIER_ARRANGE"}
- **[HORSE.VET_ADDRESS]** Address — _text/text_, owner: LESSOR · shown when: {"equals":["LESSEE"],"field_key":"TXN.VET_ARRANGE"}
- **[HORSE.VET_PHONE]** Veterinarian phone — _text/text_, owner: LESSOR · shown when: {"equals":["LESSEE"],"field_key":"TXN.VET_ARRANGE"}
- **[TXN.PROTECTIVE_REQUIRED]** Horse must wear protective equipment — _yesno/text_, owner: LESSOR
- **[TXN.PROTECTIVE_EQUIPMENT]** Protective equipment — _buttons/checkbox_, owner: DEAL · options: [{"label":"Front boots / wraps","value":"FRONT_BOOTS"},{"label":"Hind boots / wraps","value":"HIND_BOOTS"},{"label":"Other","value":"OTHER"}]
- **[TXN.TACK_PROHIBITED]** Is Lessee prohibited from using certain tack or equipment? — _reveal_text/text_, owner: LESSOR
- **[TXN.RIDER_AIDS_OTHER]** Other prohibited rider aid — _text/text_, owner: LESSOR

## [INSURANCE_RISK] Insurance, Risk of Loss, and Indemnification

### Clauses

**[INSURANCE_RISK.DEFINITIONS]** — Definitions; Binding Effect; Third-Party Beneficiaries

"Lessor Parties" means Lessor and, as applicable, Lessor's owners, principals, proprietors, partners, employees, trainers, instructors, agents, contractors, and family members of any of the foregoing, and each of their respective heirs and assigns. "Lessee Parties" means Lessee and Lessee's heirs, next of kin, estate, executors, administrators, legal representatives, and assigns. Lessee enters into this Agreement on behalf of Lessee and all Lessee Parties, and all releases, waivers, assumptions of risk, and covenants made by Lessee under this Agreement are made on behalf of all Lessee Parties and bind each of them to the same extent as Lessee. Each Lessor Party and each Lessee Party is an intended third-party beneficiary of the releases, waivers, assumptions of risk, and limitations of liability in this Agreement and may enforce them directly.

**[INSURANCE_RISK.INSURANCE]** — Insurance Requirements

The parties agree to the insurance elections set forth below. Each policy elected or required below shall be maintained in effect for the duration of this Agreement.

**[INSURANCE_RISK.GENERAL_LIABILITY]** — General Liability Insurance

**[INSURANCE_RISK.GL_MAIN]** _(shown when: {"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"})_

Lessor {{TXN.GL_POSTURE}} general liability insurance covering the Horse and the activities contemplated by this Agreement.
{{TXN.GL_DESCRIPTION}}

**[INSURANCE_RISK.GL_DED_SIMPLE]** _(shown when: {"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.GL_DED_RESP"}]})_

If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.GL_DED_RESP}}.

**[INSURANCE_RISK.GL_DED_SPLITC]** _(shown when: {"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["SPLIT"],"field_key":"TXN.GL_DED_RESP"}]})_

If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, any deductible shall be split between the parties: {{TXN.GL_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.GL_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

**[INSURANCE_RISK.GL_DED_OTHERC]** _(shown when: {"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["OTHER"],"field_key":"TXN.GL_DED_RESP"}]})_

If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be handled as follows: {{TXN.GL_DED_RESP_OTHER}}.

**[INSURANCE_RISK.GL_NONE]** _(shown when: {"equals":[""],"field_key":"TXN.GL_POSTURE"})_

No general liability insurance is required under this Agreement.

**[INSURANCE_RISK.MORTALITY]** — Mortality Insurance

**[INSURANCE_RISK.MORT_MAIN]** _(shown when: {"equals":["YES"],"field_key":"TXN.MORT_ELECTED"})_

Lessor maintains, or shall obtain with an effective date no later than {{TXN.MORT_EFFECTIVE_DATE}}, mortality insurance on the Horse with a policy limit of {{TXN.MORT_LIMIT}} and a deductible of {{TXN.MORT_DEDUCTIBLE}}.

**[INSURANCE_RISK.MORT_PREM_SIMPLE]** _(shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MORT_PREM_RESP"}]})_

Responsibility for the policy premium: {{TXN.MORT_PREM_RESP}}.

**[INSURANCE_RISK.MORT_PREM_SPLITC]** _(shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_PREM_RESP"}]})_

The policy premium shall be split between the parties: {{TXN.MORT_PREM_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MORT_PREM_RESP_SPLIT_LESSEE}} paid by Lessee.

**[INSURANCE_RISK.MORT_PREM_OTHERC]** _(shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["OTHER"],"field_key":"TXN.MORT_PREM_RESP"}]})_

Responsibility for the policy premium: {{TXN.MORT_PREM_RESP_OTHER}}.

**[INSURANCE_RISK.MORT_DEDR_SIMPLE]** _(shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MORT_DED_RESP"}]})_

Responsibility for the deductible: {{TXN.MORT_DED_RESP}}.

**[INSURANCE_RISK.MORT_DEDR_SPLITC]** _(shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_DED_RESP"}]})_

The deductible shall be split between the parties: {{TXN.MORT_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MORT_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

**[INSURANCE_RISK.MORT_DEDR_OTHERC]** _(shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["OTHER"],"field_key":"TXN.MORT_DED_RESP"}]})_

Responsibility for the deductible: {{TXN.MORT_DED_RESP_OTHER}}.

**[INSURANCE_RISK.MORT_TAIL]** _(shown when: {"equals":["YES"],"field_key":"TXN.MORT_ELECTED"})_

Any deductible shall be advanced by Lessor as policyholder and reimbursed by the responsible party or parties in accordance with the Payment Terms of this Agreement.

**[INSURANCE_RISK.MORT_NONE]** _(shown when: {"equals":["NO",""],"field_key":"TXN.MORT_ELECTED"})_

No mortality insurance is required under this Agreement.

**[INSURANCE_RISK.MEDICAL]** — Medical Insurance

**[INSURANCE_RISK.MED_NONE]** _(shown when: {"equals":["NONE",""],"field_key":"TXN.MED_COVERAGE"})_

Lessor has elected not to maintain medical insurance on the Horse. Lessor accepts full risk and responsibility for any and all injury to or illness of the Horse during the term of this Agreement, including all costs of veterinary care arising from such injury or illness, except as otherwise expressly allocated in the Horse Care and Expenses section of this Agreement.

**[INSURANCE_RISK.MED_MAIN]** _(shown when: {"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"})_

Lessor maintains, or shall obtain with an effective date no later than {{TXN.MED_EFFECTIVE_DATE}}, medical insurance on the Horse with a coverage limit of {{TXN.MED_LIMIT}} and a deductible of {{TXN.MED_DEDUCTIBLE}}.

**[INSURANCE_RISK.MED_PREM_SIMPLE]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MED_PREM_RESP"}]})_

Responsibility for the policy premium: {{TXN.MED_PREM_RESP}}.

**[INSURANCE_RISK.MED_PREM_SPLITC]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_PREM_RESP"}]})_

The policy premium shall be split between the parties: {{TXN.MED_PREM_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_PREM_RESP_SPLIT_LESSEE}} paid by Lessee.

**[INSURANCE_RISK.MED_PREM_OTHERC]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_PREM_RESP"}]})_

Responsibility for the policy premium: {{TXN.MED_PREM_RESP_OTHER}}.

**[INSURANCE_RISK.MED_DEDR_SIMPLE]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MED_DED_RESP"}]})_

Responsibility for the deductible: {{TXN.MED_DED_RESP}}.

**[INSURANCE_RISK.MED_DEDR_SPLITC]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_DED_RESP"}]})_

The deductible shall be split between the parties: {{TXN.MED_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_DED_RESP_SPLIT_LESSEE}} paid by Lessee.

**[INSURANCE_RISK.MED_DEDR_OTHERC]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_DED_RESP"}]})_

Responsibility for the deductible: {{TXN.MED_DED_RESP_OTHER}}.

**[INSURANCE_RISK.MED_EXC_SIMPLE]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MED_EXCESS_RESP"}]})_

Responsibility for veterinary costs exceeding the coverage limit: {{TXN.MED_EXCESS_RESP}}.

**[INSURANCE_RISK.MED_EXC_SPLITC]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_EXCESS_RESP"}]})_

Veterinary costs exceeding the coverage limit shall be split between the parties: {{TXN.MED_EXCESS_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_EXCESS_RESP_SPLIT_LESSEE}} paid by Lessee.

**[INSURANCE_RISK.MED_EXC_OTHERC]** _(shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_EXCESS_RESP"}]})_

Responsibility for veterinary costs exceeding the coverage limit: {{TXN.MED_EXCESS_RESP_OTHER}}.

**[INSURANCE_RISK.MED_TAIL]** _(shown when: {"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"})_

Any deductible or covered cost shall be advanced by Lessor as policyholder and reimbursed by the responsible party or parties in accordance with the Payment Terms of this Agreement. Lessor assumes and is responsible for all risks and costs not paid by the policy in the event the policy is not in effect, a claim is denied, or a cost is determined to be non-covered.

**[INSURANCE_RISK.CCC]** — Care, Custody and Control Insurance _(shown when: {"equals":["ENTITY"],"field_key":"LESSEE.PARTY_TYPE"})_

Lessee shall obtain and maintain, for the duration of this Agreement, care, custody and control insurance covering the Horse while in Lessee's care, custody, or control, with a death benefit limit of not less than the Horse's current fair market value of {{HORSE.FAIR_MARKET_VALUE}}, effective no later than the commencement of this Agreement. Lessee shall provide proof of coverage to Lessor upon request and shall maintain the policy in good standing for the duration of this Agreement; failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.

**[INSURANCE_RISK.COORDINATION]** — Coordination of Coverage _(shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["ENTITY"],"field_key":"LESSEE.PARTY_TYPE"}]})_

Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor's mortality insurance shall be the first policy noticed and claimed against for any such covered event. Lessee's care, custody and control insurance is secondary and shall respond only to the extent the loss was caused by Lessee's gross negligence, reckless conduct, or intentional misconduct. Where a loss was so caused, Lessee shall bear the net cost of any applicable deductible and any uninsured portion of the loss, and the parties shall reimburse one another as necessary to give effect to this allocation regardless of the order in which the policies respond. Each party shall promptly notify its insurer of a covered event and shall cooperate in the submission and adjustment of claims. Absent a determination that Lessee so caused the loss, all deductibles and uninsured amounts remain Lessor's responsibility.

**[INSURANCE_RISK.RISK_OF_LOSS]** — Risk of Loss of or Injury to the Horse

Lessor assumes all risk of loss of or injury to the Horse during the term of this Agreement, except to the extent caused by Lessee's gross negligence, reckless conduct, or intentional misconduct.

**[INSURANCE_RISK.LOSS_OF_USE_ACK]** — Loss of Use

Lessor acknowledges and accepts that loss of use of the Horse may result from injury to, illness of, or the death of the Horse. No loss-of-use insurance is required or provided under this Agreement.

**[INSURANCE_RISK.ASSUMPTION_INHERENT]** — Assumption of Inherent Risks

Lessee understands that horseback riding and handling horses are inherently dangerous activities. Lessee acknowledges that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. Lessee acknowledges the California common law doctrine of "Primary Assumption of Risk," as established by the California Supreme Court in Knight v. Jewett (1992) 3 Cal.4th 296 and subsequent equine-specific case law (e.g., Levinson v. Owens (2009) 176 Cal.App.4th 1534). Pursuant to this binding legal precedent, Lessee, on behalf of all Lessee Parties, expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that no Lessor Party owes a duty to protect Lessee from these inherent risks.

**[INSURANCE_RISK.RELEASE]** — Release of Liability

In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and all Lessee Parties, completely releases, forever discharges, and agrees to hold harmless the Lessor Parties from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee's use, handling, or riding of the Horse, whether caused by the ordinary negligence of any Lessor Party or otherwise. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

**[INSURANCE_RISK.SAFETY_ATTIRE]** — Required Protective Attire

Lessee shall wear, and shall ensure that any other person riding the Horse under Lessee's authorization wears, an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Riders shall provide their own helmet, boots, and pants meeting these requirements unless otherwise agreed in writing. Lessee, on behalf of all Lessee Parties, assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes permission to ride or handle the Horse and constitutes a material breach of this Agreement.

**[INSURANCE_RISK.TRAIL_RIDING]** — Trail Riding Risks _(shown when: {"contains":["TRAIL"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

Lessee acknowledges that riding outside an enclosed arena, including trail riding, exposes Lessee and the Horse to additional risks, including uneven terrain, traffic, wildlife, water crossings, and other conditions that may cause the Horse to spook or behave unpredictably. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

**[INSURANCE_RISK.JUMPING_RISKS]** — Jumping Risks _(shown when: {"contains":["JUMPING"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

Lessee acknowledges that jumping the Horse exposes Lessee and the Horse to additional risks beyond flat riding, including refusals, run-outs, awkward or missed distances, falls, unseating, and the Horse landing, stopping, or twisting unpredictably. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

**[INSURANCE_RISK.COMPETITION_RISKS]** — Competition Risks _(shown when: {"contains":["COMPETITIONS"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

Lessee acknowledges that competing with the Horse exposes Lessee and the Horse to additional risks, including unfamiliar and crowded show grounds, proximity to other horses and riders, loudspeakers, banners, and other stimuli that may cause the Horse to spook or behave unpredictably, as well as the physical demands and pressures of competition. Lessee voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

**[INSURANCE_RISK.SHARED_ARENA_RISKS]** — Shared Arena Riding Risks _(shown when: {"contains":["ARENA_GROUP"],"field_key":"TXN.PERMITTED_ACTIVITIES"})_

Lessee acknowledges that riding in an arena at the same time as other riders exposes Lessee and the Horse to additional risks, including collisions, crowding, sudden movements or loss of control by other horses or riders, and the Horse reacting to other horses. Lessee agrees to ride with awareness of others, to follow standard arena etiquette and right-of-way rules and any directions of Lessor or an instructor, and voluntarily assumes these and any other unforeseen or unspecified additional risks related to this activity.

**[INSURANCE_RISK.WAIVER_UNKNOWN]** — Waiver of Unknown Claims

Each party, on behalf of itself and, respectively, the Lessor Parties or the Lessee Parties, expressly waives any and all claims against the other party and its respective party group that the waiving party does not know or suspect to exist at the time of this Agreement, and acknowledges that this waiver is a material term of this Agreement. Each party assumes the risk that claims presently unknown to it may later be discovered.

**[INSURANCE_RISK.INDEMNIFICATION]** — Mutual Indemnification

Each party shall indemnify, defend, and hold harmless the other party and, respectively, the Lessor Parties or the Lessee Parties, from and against any and all claims, damages, losses, liabilities, costs, and expenses arising out of the indemnifying party's use, handling, care, or possession of the Horse, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

**[INSURANCE_RISK.LIMITATION]** — Limitation of Liability

Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the Horse's current fair market value of {{HORSE.FAIR_MARKET_VALUE}}. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.

### Fields
- **[TXN.MED_COVERAGE]** Medical insurance — _select/select_, owner: LESSOR, required · options: [{"label":"Not maintained \u2014 Lessor accepts risk","value":"NONE"},{"label":"Covered \u2014 policy details below","value":"COVERED"}]
- **[TXN.MORT_ELECTED]** Mortality insurance elected? — _yesno/select_, owner: LESSOR, required
- **[TXN.GL_POSTURE]** General liability posture — _select/select_, owner: LESSOR, required · options: [{"label":"maintains","value":"MAINTAINS"},{"label":"requires and will maintain","value":"REQUIRES_WILL"}]
- **[TXN.MORT_LIMIT]** Policy limit — _currency/currency_, owner: LESSOR · shown when: {"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}
- **[TXN.MED_EFFECTIVE_DATE]** Effective date no later than — _date/date_, owner: LESSOR · shown when: {"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}
- **[TXN.GL_DESCRIPTION]** Policy description (optional) — _longtext/text_, owner: LESSOR · shown when: {"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"}
- **[TXN.GL_DED_RESP]** Deductible responsibility (Lessee-responsibility claims) — _select/select_, owner: LESSOR, required · shown when: {"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"} · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
- **[TXN.MED_LIMIT]** Coverage limit — _currency/currency_, owner: LESSOR · shown when: {"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}
- **[TXN.MORT_DEDUCTIBLE]** Deductible — _currency/currency_, owner: LESSOR · shown when: {"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}
- **[TXN.MORT_EFFECTIVE_DATE]** Effective date no later than — _date/date_, owner: LESSOR · shown when: {"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}
- **[TXN.MED_DEDUCTIBLE]** Deductible — _currency/currency_, owner: LESSOR · shown when: {"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}
- **[TXN.GL_DED_RESP_SPLIT_LESSOR]** Split — % paid by Lessor — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["SPLIT"],"field_key":"TXN.GL_DED_RESP"}]}
- **[TXN.MED_PREM_RESP]** Premium responsibility — _select/select_, owner: LESSOR · shown when: {"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"} · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
- **[TXN.GL_DED_RESP_SPLIT_LESSEE]** Split — % paid by Lessee — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["SPLIT"],"field_key":"TXN.GL_DED_RESP"}]}
- **[TXN.MORT_PREM_RESP]** Premium responsibility — _select/select_, owner: LESSOR · shown when: {"equals":["YES"],"field_key":"TXN.MORT_ELECTED"} · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
- **[TXN.MED_PREM_RESP_SPLIT_LESSOR]** Premium split — % paid by Lessor — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_PREM_RESP"}]}
- **[TXN.MORT_PREM_RESP_SPLIT_LESSOR]** Premium split — % paid by Lessor — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_PREM_RESP"}]}
- **[TXN.GL_DED_RESP_OTHER]** Other deductible arrangement — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["OTHER"],"field_key":"TXN.GL_DED_RESP"}]}
- **[TXN.MORT_PREM_RESP_SPLIT_LESSEE]** Premium split — % paid by Lessee — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_PREM_RESP"}]}
- **[TXN.MED_PREM_RESP_SPLIT_LESSEE]** Premium split — % paid by Lessee — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_PREM_RESP"}]}
- **[TXN.MORT_PREM_RESP_OTHER]** Other premium arrangement — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["OTHER"],"field_key":"TXN.MORT_PREM_RESP"}]}
- **[TXN.MED_PREM_RESP_OTHER]** Other premium arrangement — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_PREM_RESP"}]}
- **[TXN.MORT_DED_RESP]** Deductible responsibility — _select/select_, owner: LESSOR · shown when: {"equals":["YES"],"field_key":"TXN.MORT_ELECTED"} · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
- **[TXN.MED_DED_RESP]** Deductible responsibility — _select/select_, owner: LESSOR · shown when: {"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"} · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
- **[TXN.MED_DED_RESP_MODE]** Deductible split entered as — _select/select_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_DED_RESP"}]} · options: [{"label":"$ amount","value":"DOLLAR"},{"label":"% percentage","value":"PERCENT"}]
- **[TXN.MORT_DED_RESP_MODE]** Deductible split entered as — _select/select_, owner: LESSOR · shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_DED_RESP"}]} · options: [{"label":"$ amount","value":"DOLLAR"},{"label":"% percentage","value":"PERCENT"}]
- **[TXN.MED_DED_RESP_SPLIT_LESSOR]** Deductible split — paid by Lessor — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_DED_RESP"},{"equals":["DOLLAR","PERCENT"],"field_key":"TXN.MED_DED_RESP_MODE"}]}
- **[TXN.MORT_DED_RESP_SPLIT_LESSOR]** Deductible split — paid by Lessor — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_DED_RESP"},{"equals":["DOLLAR","PERCENT"],"field_key":"TXN.MORT_DED_RESP_MODE"}]}
- **[TXN.MED_DED_RESP_SPLIT_LESSEE]** Deductible split — paid by Lessee — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_DED_RESP"},{"equals":["DOLLAR","PERCENT"],"field_key":"TXN.MED_DED_RESP_MODE"}]}
- **[TXN.MORT_DED_RESP_SPLIT_LESSEE]** Deductible split — paid by Lessee — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_DED_RESP"},{"equals":["DOLLAR","PERCENT"],"field_key":"TXN.MORT_DED_RESP_MODE"}]}
- **[TXN.MED_DED_RESP_OTHER]** Other deductible arrangement — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_DED_RESP"}]}
- **[TXN.MORT_DED_RESP_OTHER]** Other deductible arrangement — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["OTHER"],"field_key":"TXN.MORT_DED_RESP"}]}
- **[TXN.MED_EXCESS_RESP]** Excess-costs responsibility (optional) — _select/select_, owner: LESSOR · shown when: {"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"} · options: [{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"},{"label":"Other","value":"OTHER"}]
- **[TXN.MED_EXCESS_RESP_SPLIT_LESSOR]** Excess split — % paid by Lessor — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_EXCESS_RESP"}]}
- **[TXN.MED_EXCESS_RESP_SPLIT_LESSEE]** Excess split — % paid by Lessee — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_EXCESS_RESP"}]}
- **[TXN.MED_EXCESS_RESP_OTHER]** Other excess-costs arrangement — _text/text_, owner: LESSOR · shown when: {"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_EXCESS_RESP"}]}

## [TERMINATION] Termination

### Clauses

**[TERMINATION.LESSEE]** — Lessee's Right to Terminate

Lessee may terminate this Agreement by giving Lessor at least {{TXN.LESSEE_TERM_NOTICE_DAYS}} days' prior written notice.

**[TERMINATION.OWNER]** — Owner's Right to Terminate

Lessor may terminate this Agreement by giving Lessee at least {{TXN.OWNER_TERM_NOTICE_DAYS}} days' prior written notice.

**[TERMINATION.CAUSE]** — Termination for Cause

Either party may terminate this Agreement for cause (including a material breach that remains uncured) by giving the other party at least {{TXN.CAUSE_TERM_NOTICE_DAYS}} days' prior written notice.

**[TERMINATION.LOSS]** — Self-Termination upon Loss or Injury

This Agreement shall self-terminate if the Horse is significantly injured or seriously ill as determined by a licensed veterinarian, or dies. Lessee is entitled to a prorated refund of Lease Fee paid for the remaining time unused at the time of self-termination. In the event Lessee is found to have caused, through gross negligence, reckless conduct, or intentional misconduct, the injury, illness, or death, Lessor may retain the unused portion of the paid Lease Fee.

**[TERMINATION.LOSS_OF_USE]** — Termination upon Loss of Use

If the Horse becomes unusable for the purposes of this Agreement for any reason, Lessee may terminate this Agreement immediately upon written notice to Lessor. Upon such termination, Lessee is entitled to a prorated refund of any Lease Fee paid for the remaining unused time as of the date of termination.

**[TERMINATION.SURVIVAL]** — Survival

The releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement, and any payment obligations accrued before termination, survive the expiration or termination of this Agreement for any reason.

### Fields
- **[TXN.CAUSE_TERM_NOTICE_DAYS]** Days notice — _number/number_, owner: DEAL
- **[TXN.LESSEE_TERM_NOTICE_DAYS]** Days notice — _number/number_, owner: DEAL
- **[TXN.OWNER_TERM_NOTICE_DAYS]** Days notice — _number/number_, owner: DEAL

## [NOTICE] Notice and Contact Information

### Clauses

**[NOTICE.FORM]** — Form of Notice

Any notice required or permitted under this Agreement shall be in writing and delivered by a method that provides evidence of receipt to the party at the contact information below. Notice by email is not effective unless the receiving party acknowledges receipt.

**[NOTICE.LESSEE_ADDRESS]** — Lessee

Name: {{LESSEE.FULL_NAME}}
Address: {{LESSEE.ADDRESS}}
Phone: {{LESSEE.PHONE}}
Email: {{LESSEE.EMAIL}}

**[NOTICE.LESSOR_ADDRESS]** — Lessor

Name: {{LESSOR.FULL_NAME}}
Address: {{LESSOR.ADDRESS}}
Phone: {{LESSOR.PHONE}}
Email: {{LESSOR.EMAIL}}

**[NOTICE.CHANGES]** — Changes in Contact Information

Each party shall promptly notify the other party in writing of any change in the party's address or contact information.

## [ASSIGNMENT] Assignment or Transfer

### Clauses

**[ASSIGNMENT.NO_ASSIGN]** — Assignment or Transfer

Lessee shall not assign, sublease, or otherwise transfer this Agreement or any of Lessee's rights or obligations under it without Lessor's prior written consent, unless permitted in the sections above.

## [ENTIRE_AGREEMENT] Entire Agreement

### Clauses

**[ENTIRE_AGREEMENT.INTEGRATION]** — Entire Agreement

This Agreement contains the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions and understandings. Any modification of this Agreement must be in writing and signed by all parties.

## [GOVERNING_LAW] Governing Law and Venue

### Clauses

**[GOVERNING_LAW.CHOICE]** — Governing Law and Venue

This Agreement shall be governed by the laws of the State of California. Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California.

## [ATTORNEYS_FEES] Attorneys' Fees

### Clauses

**[ATTORNEYS_FEES.PREVAILING]** — Attorneys' Fees

Each party shall cover their own attorney's fees and costs.

## [SEVERABILITY] Severability

### Clauses

**[SEVERABILITY.SAVING]** — Severability

If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.

## [LESSEE_REPS] Lessee's Representations

### Clauses

**[LESSEE_REPS.MAIN_INDIVIDUAL]** — Lessee's Representations _(shown when: {"equals":["INDIVIDUAL",""],"field_key":"LESSEE.PARTY_TYPE"})_

Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into this Agreement; that Lessee has no physical or mental condition that would prevent Lessee from safely participating in the activities contemplated by this Agreement; and that Lessee has the requisite knowledge and experience to handle and ride the Horse, and will use reasonable care in doing so and follow Lessor's instructions. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.

**[LESSEE_REPS.MAIN_ENTITY]** — Lessee's Representations _(shown when: {"equals":["ENTITY"],"field_key":"LESSEE.PARTY_TYPE"})_

Lessee represents and warrants that Lessee is duly organized and in good standing, and has full authority to enter into this Agreement, and that the individual signing this Agreement does so as Lessee's authorized representative; that each person who rides or handles the Horse under Lessee's authorization will, before doing so, have executed the releases required under this Agreement and possess the knowledge and experience to handle and ride the Horse safely; and that Lessee will use reasonable care and follow Lessor's instructions in all handling of the Horse. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.

## [SIGNATURES] Signatures

### Clauses

**[SIGNATURES.BLOCK]** — Signatures

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

LESSEE
Signature: {{SIG.LESSEE.NAME}}
Printed Name: {{LESSEE.PRINTED_NAME}}
Date: {{SIG.LESSEE.DATE}}

LESSOR (OWNER)
Signature: {{SIG.LESSOR.NAME}}
Printed Name: {{LESSOR.PRINTED_NAME}}
Date: {{SIG.LESSOR.DATE}}

