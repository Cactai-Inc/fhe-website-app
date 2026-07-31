# Conditional (optional) clauses — HORSE_LEASE_V2

Companion to INFO_BUTTON_AUDIT.md. Every clause that appears only when a
condition is met — 61 of the template's 129 clauses. The other 68 always show.

Use this to say which guidance snippets are conditional and what controls them.
When you send back a unified block per section, name the SHOWS WHEN expression
beside any snippet that should appear only sometimes.

Each row:
  CLAUSE KEY
    shows when: <the gate, in plain English>
    text:       <the first ~110 characters of the clause>

Notes on reading the gates:
  • Field keys are verbatim, so they can be quoted back precisely.
  • "or unset" means an empty value also satisfies it — the usual default-on case.
  • Multi-value tests are parenthesised so mixed AND/OR cannot be misread.

---


## The Horse

HORSE.OWNERSHIP_LIMITS
    shows when: TXN.HAS_OWNERSHIP_LIMITS = YES
    text:       Ownership related leasing restrictions: {{TXN.OWNERSHIP_LIMITATIONS}}

HORSE.BEHAVIOR_EXC
    shows when: TXN.BEHAVIOR_HAS_EXCEPTIONS = YES
    text:       The Lessor notes the following known exceptions to the behavior of the Horse: {{TXN.BEHAVIOR_EXCEPTIONS}}.

HORSE.CONDITION_EXC
    shows when: TXN.CONDITION_HAS_EXCEPTIONS = YES
    text:       The Lessor notes the following known exceptions to the physical condition of the Horse: {{TXN.CONDITION_EXCEPT


## Purpose and Lease Grant

PURPOSE.RECREATION
    shows when: TXN.LEASE_PURPOSE is one of (RECREATIONAL, INSTRUCTIONAL, COMPETITION, COMMERCIAL)
    text:       For {{TXN.LEASE_PURPOSE}} purposes, Lessee wishes to ride and/or handle Lessor's horse, and Lessor agrees to a

PURPOSE.RECREATION_DEFAULT
    shows when: TXN.LEASE_PURPOSE is unset
    text:       For the purposes permitted herein, Lessee wishes to ride and/or handle Lessor's horse, and Lessor agrees to al


## Definitions; Binding Effect; Third-Party Beneficiaries

DEFINITIONS.LESSOR_IND
    shows when: LESSOR.PARTY_TYPE = INDIVIDUAL (or unset)
    text:       "Lessor Parties" means Lessor and Lessor's heirs, next of kin, estate, executors, administrators, legal repres

DEFINITIONS.LESSOR_ENT
    shows when: LESSOR.PARTY_TYPE = ENTITY
    text:       "Lessor Parties" means Lessor and, as applicable, Lessor's owners, principals, proprietors, partners, members,

DEFINITIONS.LESSEE_IND
    shows when: LESSEE.PARTY_TYPE = INDIVIDUAL (or unset)
    text:       "Lessee Parties" means Lessee and Lessee's heirs, next of kin, estate, executors, administrators, legal repres

DEFINITIONS.LESSEE_ENT
    shows when: LESSEE.PARTY_TYPE = ENTITY
    text:       "Lessee Parties" means Lessee and, as applicable, Lessee's owners, principals, proprietors, partners, members,


## Schedule for Lessee's Usage

SCHEDULE.MAIN
    shows when: TXN.LEASE_TYPE = PARTIAL
    text:       Reserved days of use: {{TXN.DAYS_USED}}

SCHEDULE.OTHER
    shows when: TXN.LEASE_TYPE = PARTIAL
    text:       Additional or custom schedule terms: {{TXN.SCHEDULE_TERMS}}

SCHEDULE.CHANGES
    shows when: TXN.LEASE_TYPE = PARTIAL
    text:       Any changes to the agreed upon schedule must be made and accepted in writing.


## Payment Method

PAYMENT_METHOD.CARD
    shows when: TXN.PAYMENT_METHODS includes CREDIT_CARD
    text:       Credit card payments are processed as follows: {{TXN.CARD_PROCESSOR}}

PAYMENT_METHOD.CARD_LESSOR
    shows when: TXN.LESSOR_PAYMENT_METHODS includes CREDIT_CARD
    text:       Credit card payments are processed as follows: {{TXN.LESSOR_CARD_PROCESSOR}}


## Location of Horse

LOCATION.NEW
    shows when: TXN.HORSE_MOVES = YES
    text:       Location during lease term: {{TXN.NEW_LOCATION}}.


## Evaluation Period

EVALUATION.DATES_INCLUDED
    shows when: TXN.EVALUATION_ENABLED is one of (REQUESTED, REQUIRED) AND TXN.EVAL_FIXED_LENGTH is unset AND TXN.EVAL_FIXED_UNIT is unset AND TXN.EVAL_FIXED_FEE is unset
    text:       Lessee shall have an evaluation period of {{TXN.EVAL_INCLUDED_LENGTH}} {{TXN.EVAL_INCLUDED_UNIT}} beginning on

EVALUATION.DATES_FIXED
    shows when: TXN.EVALUATION_ENABLED is one of (REQUESTED, REQUIRED) AND TXN.EVAL_INCLUDED_LENGTH is unset AND TXN.EVAL_INCLUDED_UNIT is unset
    text:       Lessee shall have an evaluation period of {{TXN.EVAL_FIXED_LENGTH}} {{TXN.EVAL_FIXED_UNIT}} beginning on the d


## Agreement Term

TERM.FIXED_END
    shows when: TXN.LEASE_TERM_TYPE = FIXED
    text:       This Agreement continues until {{TXN.LEASE_END}}.

TERM.RENEWAL
    shows when: TXN.RENEWAL_INCLUDE = YES
    text:       Renewal terms: {{TXN.RENEWAL_TERMS}}


## Permitted Use(s) & Restrictions

PERMITTED_USE.TRAINER
    shows when: TXN.PERMITTED_ACTIVITIES includes one of (LESSONS, JUMPING, COMPETITIONS)
    text:       Riding Lessons, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trai

TRAINING_LESSONS.LESSONS
    shows when: LESSEE.PARTY_TYPE = INDIVIDUAL (or unset)
    text:       Lessee is required to maintain continuous enrollment in weekly riding lessons: {{TXN.LESSONS_REQUIRED}}. Lesso

TRAINING_LESSONS.LESSONS_ENTITY
    shows when: LESSEE.PARTY_TYPE = ENTITY
    text:       Lessee is permitted by Lessor to provide riding lessons with the Horse: {{TXN.LESSONS_ENTITY_PERMITTED}}.

COMPETITIONS.INTRO
    shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS
    text:       Expenses of competition (entry fees, transportation, and the like) are: {{TXN.COMPETITION_EXPENSES}}. Any priz

RESTRICT.JUMP_TITLE
    shows when: TXN.PERMITTED_ACTIVITIES includes JUMPING
    text:       {{TXN.JUMP_OMIT}}

RESTRICT.JUMP_ON
    shows when: TXN.PERMITTED_ACTIVITIES includes JUMPING AND TXN.JUMP_OMIT = NO (or unset)
    text:       Jumping is restricted as follows: maximum height {{TXN.JUMP_MAX_HEIGHT}}; no more than {{TXN.JUMP_DAYS_PER_WEE

RESTRICT.JUMP_OFF
    shows when: TXN.PERMITTED_ACTIVITIES includes JUMPING AND TXN.JUMP_OMIT = YES
    text:       Lessor does not restrict jumping.

RESTRICT.COMP_TITLE
    shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS
    text:       {{TXN.COMP_OMIT}}

RESTRICT.COMP_ON
    shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS AND TXN.COMP_OMIT = NO (or unset)
    text:       Competitions are restricted as follows: {{TXN.COMP_RESTRICTION}}.

RESTRICT.COMP_OFF
    shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS AND TXN.COMP_OMIT = YES
    text:       Lessor does not restrict competitions.

RESTRICT.TRAIL_TITLE
    shows when: TXN.PERMITTED_ACTIVITIES includes TRAIL
    text:       {{TXN.TRAIL_OMIT}}

RESTRICT.TRAIL_ON
    shows when: TXN.PERMITTED_ACTIVITIES includes TRAIL AND TXN.TRAIL_OMIT = NO (or unset)
    text:       Trail riding is restricted as follows: {{TXN.TRAIL_RESTRICTION}}.

RESTRICT.TRAIL_OFF
    shows when: TXN.PERMITTED_ACTIVITIES includes TRAIL AND TXN.TRAIL_OMIT = YES
    text:       Lessor does not restrict trail riding.

PROHIBITED.OTHER
    shows when: TXN.ADDITIONAL_ACTIVITIES includes one of (BREEDING, EMOTIONAL_SUPPORT, FILM_TV_AD, OTHER)
    text:       Lessee is permitted to engage in the following additional activities with the Horse: {{TXN.ADDITIONAL_ACTIVITI

PROHIBITED.OTHER_NONE
    shows when: TXN.ADDITIONAL_ACTIVITIES = NONE (or unset)
    text:       Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.

PROHIBITED.OTHER_NOTE
    shows when: TXN.ADDITIONAL_ACTIVITIES includes OTHER
    text:       Other additional permitted activity: {{TXN.ADDITIONAL_ACTIVITIES_OTHER}}.

PROHIBITED.OTHERS_OTHER
    shows when: TXN.OTHERS_ALLOWED includes OTHER
    text:       Other persons allowed to ride or handle the Horse: {{TXN.OTHERS_ALLOWED_OTHER}}.


## Horse Care and Expenses

SCHEDULE.CARE_DUTY
    shows when: TXN.EXERCISE_INCLUDE = YES
    text:       Lessee's use of the Horse is a responsibility as well as a right: regular, consistent exercise and attention a

SCHEDULE.TRAINER_CARE
    shows when: TXN.TRAINER_CARE_INCLUDE = YES
    text:       Lessee is permitted to engage an approved 3rd party to exercise the Horse. All 3rd party exercise shall be con

CARE.PROTECTIVE_EQUIP
    shows when: TXN.PROTECTIVE_REQUIRED = YES
    text:       Lessor will provide the following equipment for the Horse: {{TXN.PROTECTIVE_EQUIPMENT}} Lessee must ensure equ

CARE.RIDER_AIDS_OTHER
    shows when: TXN.RIDER_AIDS includes OTHER
    text:       Other prohibited rider aid: {{TXN.RIDER_AIDS_OTHER}}.


## Insurance, Risk of Loss, and Indemnification

INSURANCE_RISK.GL_STATUS
    shows when: TXN.GL_NOT_REQUIRED = NO (or unset)
    text:       Lessor: {{TXN.GL_LESSOR_STATUS}} general liability insurance covering the Horse and the activities contemplate

INSURANCE_RISK.GL_DED_SIMPLE
    shows when: TXN.GL_NOT_REQUIRED = NO (or unset)
    text:       If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether di

INSURANCE_RISK.GL_DED_SPLITC
    shows when: TXN.GL_NOT_REQUIRED = NO (or unset) AND TXN.GL_DED_RESP = SPLIT
    text:       The deductible shall be split between the parties: {{TXN.GL_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.G

INSURANCE_RISK.GL_NONE
    shows when: TXN.GL_NOT_REQUIRED = YES
    text:       Lessor has elected not to require general liability insurance under this Agreement. Lessor accepts full risk a

INSURANCE_RISK.MORT_STATUS
    shows when: TXN.MORT_NOT_REQUIRED = NO (or unset)
    text:       Lessor: {{TXN.MORT_LESSOR_STATUS}} mortality insurance on the Horse. Lessee: {{TXN.MORT_LESSEE_STATUS}} mortal

INSURANCE_RISK.MORT_DEDR_SIMPLE
    shows when: TXN.MORT_NOT_REQUIRED = NO (or unset)
    text:       If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether di

INSURANCE_RISK.MORT_DEDR_SPLITC
    shows when: TXN.MORT_NOT_REQUIRED = NO (or unset) AND TXN.MORT_DED_RESP = SPLIT
    text:       The deductible shall be split between the parties: {{TXN.MORT_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN

INSURANCE_RISK.MORT_NONE
    shows when: TXN.MORT_NOT_REQUIRED = YES
    text:       Lessor has elected not to require mortality insurance under this Agreement. Lessor accepts full risk and respo

INSURANCE_RISK.MED_NONE
    shows when: TXN.MED_NOT_REQUIRED = YES
    text:       Lessor has elected not to maintain medical insurance on the Horse. Lessor accepts full risk and responsibility

INSURANCE_RISK.MED_STATUS
    shows when: TXN.MED_NOT_REQUIRED = NO (or unset)
    text:       Lessor: {{TXN.MED_LESSOR_STATUS}} medical insurance on the Horse. Lessee: {{TXN.MED_LESSEE_STATUS}} medical in

INSURANCE_RISK.MED_DEDR_SIMPLE
    shows when: TXN.MED_NOT_REQUIRED = NO (or unset)
    text:       If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether di

INSURANCE_RISK.MED_DEDR_SPLITC
    shows when: TXN.MED_NOT_REQUIRED = NO (or unset) AND TXN.MED_DED_RESP = SPLIT
    text:       The deductible shall be split between the parties: {{TXN.MED_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.

INSURANCE_RISK.MED_TAIL
    shows when: TXN.MED_NOT_REQUIRED = NO (or unset)
    text:       Any out-of-pocket costs for deductibles or other expenses related to the needs of the Horse are to be paid by

INSURANCE_RISK.CCC
    shows when: LESSEE.PARTY_TYPE = ENTITY
    text:       Lessee shall obtain and maintain, for the duration of this Agreement, care, custody and control insurance cove

INSURANCE_RISK.COORDINATION
    shows when: TXN.MORT_NOT_REQUIRED = NO (or unset) AND LESSEE.PARTY_TYPE = ENTITY
    text:       Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor's mortality insurance sh

INSURANCE_RISK.TRAIL_RIDING
    shows when: TXN.PERMITTED_ACTIVITIES includes TRAIL
    text:       Lessee acknowledges that riding outside an enclosed arena, including trail riding, exposes Lessee and the Hors

INSURANCE_RISK.JUMPING_RISKS
    shows when: TXN.PERMITTED_ACTIVITIES includes JUMPING
    text:       Lessee acknowledges that jumping the Horse exposes Lessee and the Horse to additional risks beyond flat riding

INSURANCE_RISK.COMPETITION_RISKS
    shows when: TXN.PERMITTED_ACTIVITIES includes COMPETITIONS
    text:       Lessee acknowledges that competing with the Horse exposes Lessee and the Horse to additional risks, including

INSURANCE_RISK.SHARED_ARENA_RISKS
    shows when: TXN.PERMITTED_ACTIVITIES includes ARENA_GROUP
    text:       Lessee acknowledges that riding in an arena at the same time as other riders exposes Lessee and the Horse to a


## Lessee's Representations

LESSEE_REPS.MAIN_INDIVIDUAL
    shows when: LESSEE.PARTY_TYPE = INDIVIDUAL (or unset)
    text:       Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into th

LESSEE_REPS.MAIN_ENTITY
    shows when: LESSEE.PARTY_TYPE = ENTITY
    text:       Lessee represents and warrants that Lessee is duly organized and in good standing, and has full authority to e

