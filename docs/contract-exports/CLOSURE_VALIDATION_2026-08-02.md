# Closure validation article — document 10973f24-afc6-4e7a-9d78-abe345cb788f (2026-08-02, disposed same session)

Created through the live write path (start_lease_contract_v2 under the real admin
session, with Beau a8e82033 attached at creation; fields via set_contract_field;
remerge_contract_from_clauses — the UI's exact flow), then DELETED in-session per
the zero-deferral cleanup rule. This export is the retained evidence.

## What it proves

1. **Beau BREED/COLOR fix through the real attach path**: §3.1 renders
   'Color: Bay' / 'Breed: Selle Français' (the two fields that materialized
   blank before 20260802080000's coalesce fallback).
2. **U2.8 both directions on one document**: MORT (Lessor HAS_WILL_MAINTAIN +
   SPLIT) renders its deductible clause (13.6); GL and MED (both parties NONE)
   render NO deductible clause. Gate table below: MORT_DEDR_* SHOWS,
   GL_DED_*/MED_DEDR_* HIDDEN.
3. Manifest features re-proven: injury-history NONE (3.6), entity capacity
   block (22.2), JAMS venue (18.1), no-fee consideration sentence (6.1),
   Definitions at §2.

## Rendered clause keys (85 of 144 render)

```
10 | ASSIGNMENT | ASSIGNMENT.NO_ASSIGN | ALWAYS
10 | ATTORNEYS_FEES | ATTORNEYS_FEES.PREVAILING | ALWAYS
1 | CARE | SCHEDULE.CARE_DUTY | HIDDEN
2 | CARE | SCHEDULE.TRAINER_CARE | HIDDEN
5 | CARE | CARE.INTRO | ALWAYS
10 | CARE | CARE.SUPPLEMENTS | ALWAYS
20 | CARE | CARE.FARRIER | ALWAYS
30 | CARE | CARE.ROUTINE_VET | ALWAYS
60 | CARE | CARE.PROTECTIVE | ALWAYS
62 | CARE | CARE.PROTECTIVE_EQUIP | HIDDEN
70 | CARE | CARE.TACK | ALWAYS
90 | CARE | CARE.RIDER_AIDS | ALWAYS
92 | CARE | CARE.RIDER_AIDS_OTHER | HIDDEN
10 | DEFINITIONS | DEFINITIONS.LESSOR_IND | HIDDEN
11 | DEFINITIONS | DEFINITIONS.LESSOR_ENT | SHOWS
11 | DEFINITIONS | DEFINITIONS.LESSOR_PENDING | HIDDEN
12 | DEFINITIONS | DEFINITIONS.LESSEE_IND | SHOWS
13 | DEFINITIONS | DEFINITIONS.LESSEE_ENT | HIDDEN
13 | DEFINITIONS | DEFINITIONS.LESSEE_PENDING | HIDDEN
14 | DEFINITIONS | DEFINITIONS.BINDING | ALWAYS
15 | DEFINITIONS | DEFINITIONS.BENEFICIARIES | ALWAYS
10 | ENTIRE_AGREEMENT | ENTIRE_AGREEMENT.INTEGRATION | ALWAYS
10 | EVALUATION | EVALUATION.CHOICE | ALWAYS
20 | EVALUATION | EVALUATION.DATES_INCLUDED | HIDDEN
21 | EVALUATION | EVALUATION.DATES_FIXED | HIDDEN
40 | EVALUATION | EVALUATION.REFUSED | HIDDEN
41 | EVALUATION | EVALUATION.WAIVED | HIDDEN
10 | GOVERNING_LAW | GOVERNING_LAW.CHOICE | ALWAYS
10 | HORSE | HORSE.IDENTITY | ALWAYS
20 | HORSE | HORSE.OWNERSHIP | ALWAYS
22 | HORSE | HORSE.COOWNERS | ALWAYS
25 | HORSE | HORSE.OWNERSHIP_LIMITS_Q | ALWAYS
26 | HORSE | HORSE.OWNERSHIP_LIMITS | HIDDEN
30 | HORSE | HORSE.BEHAVIOR | ALWAYS
32 | HORSE | HORSE.BEHAVIOR_EXC | HIDDEN
40 | HORSE | HORSE.CONDITION | ALWAYS
42 | HORSE | HORSE.CONDITION_EXC | HIDDEN
43 | HORSE | HORSE.INJURY_HISTORY_NONE | SHOWS
44 | HORSE | HORSE.INJURY_HISTORY_DISCLOSED | HIDDEN
45 | HORSE | HORSE.INJURY_HISTORY_PENDING | HIDDEN
50 | HORSE | HORSE.VET_CHECK | ALWAYS
55 | HORSE | HORSE.TRAINER_EVAL | ALWAYS
60 | HORSE | HORSE.WARRANTY | ALWAYS
100 | INSURANCE_RISK | INSURANCE_RISK.INSURANCE | ALWAYS
150 | INSURANCE_RISK | INSURANCE_RISK.GENERAL_LIABILITY | ALWAYS
155 | INSURANCE_RISK | INSURANCE_RISK.GL_STATUS | SHOWS
162 | INSURANCE_RISK | INSURANCE_RISK.GL_DED_SIMPLE | HIDDEN
164 | INSURANCE_RISK | INSURANCE_RISK.GL_DED_SPLITC | HIDDEN
168 | INSURANCE_RISK | INSURANCE_RISK.GL_NONE | HIDDEN
169 | INSURANCE_RISK | INSURANCE_RISK.GL_LESSEE_RESP | HIDDEN
200 | INSURANCE_RISK | INSURANCE_RISK.MORTALITY | ALWAYS
205 | INSURANCE_RISK | INSURANCE_RISK.MORT_STATUS | SHOWS
214 | INSURANCE_RISK | INSURANCE_RISK.MORT_DEDR_SIMPLE | SHOWS
215 | INSURANCE_RISK | INSURANCE_RISK.MORT_DEDR_SPLITC | SHOWS
220 | INSURANCE_RISK | INSURANCE_RISK.MORT_NONE | HIDDEN
221 | INSURANCE_RISK | INSURANCE_RISK.MORT_LESSEE_RESP | HIDDEN
300 | INSURANCE_RISK | INSURANCE_RISK.MEDICAL | ALWAYS
305 | INSURANCE_RISK | INSURANCE_RISK.MED_NONE | HIDDEN
306 | INSURANCE_RISK | INSURANCE_RISK.MED_LESSEE_RESP | HIDDEN
308 | INSURANCE_RISK | INSURANCE_RISK.MED_STATUS | SHOWS
314 | INSURANCE_RISK | INSURANCE_RISK.MED_DEDR_SIMPLE | HIDDEN
315 | INSURANCE_RISK | INSURANCE_RISK.MED_DEDR_SPLITC | HIDDEN
320 | INSURANCE_RISK | INSURANCE_RISK.MED_TAIL | SHOWS
400 | INSURANCE_RISK | INSURANCE_RISK.CCC | HIDDEN
450 | INSURANCE_RISK | INSURANCE_RISK.COORDINATION | HIDDEN
500 | INSURANCE_RISK | INSURANCE_RISK.RISK_OF_LOSS | ALWAYS
550 | INSURANCE_RISK | INSURANCE_RISK.LOSS_OF_USE_ACK | ALWAYS
950 | INSURANCE_RISK | INSURANCE_RISK.ASSUMPTION_INHERENT | ALWAYS
960 | INSURANCE_RISK | INSURANCE_RISK.RELEASE | ALWAYS
961 | INSURANCE_RISK | INSURANCE_RISK.RELEASE_LESSOR | ALWAYS
1100 | INSURANCE_RISK | INSURANCE_RISK.SAFETY_ATTIRE | ALWAYS
1200 | INSURANCE_RISK | INSURANCE_RISK.TRAIL_RIDING | HIDDEN
1210 | INSURANCE_RISK | INSURANCE_RISK.JUMPING_RISKS | HIDDEN
1220 | INSURANCE_RISK | INSURANCE_RISK.COMPETITION_RISKS | HIDDEN
1230 | INSURANCE_RISK | INSURANCE_RISK.SHARED_ARENA_RISKS | HIDDEN
1300 | INSURANCE_RISK | INSURANCE_RISK.WAIVER_UNKNOWN | ALWAYS
1400 | INSURANCE_RISK | INSURANCE_RISK.INDEMNIFICATION | ALWAYS
1520 | INSURANCE_RISK | INSURANCE_RISK.LIMITATION | ALWAYS
5 | LEASE_FEE | LEASE_FEE.CHOICE | ALWAYS
10 | LESSEE_REPS | LESSEE_REPS.MAIN_INDIVIDUAL | SHOWS
20 | LESSEE_REPS | LESSEE_REPS.MAIN_ENTITY | HIDDEN
21 | LESSEE_REPS | LESSEE_REPS.PENDING | HIDDEN
10 | LOCATION | LOCATION.MAIN | ALWAYS
12 | LOCATION | LOCATION.MOVE_CHOICE | ALWAYS
14 | LOCATION | LOCATION.NEW | HIDDEN
20 | LOCATION | LOCATION.INSPECTION | ALWAYS
10 | NOTICE | NOTICE.FORM | ALWAYS
20 | NOTICE | NOTICE.LESSEE_ADDRESS | ALWAYS
30 | NOTICE | NOTICE.LESSOR_ADDRESS | ALWAYS
40 | NOTICE | NOTICE.CHANGES | ALWAYS
10 | PARTIES | PARTIES.INTRO | ALWAYS
10 | PAYMENT_METHOD | PAYMENT_METHOD.MAIN | ALWAYS
20 | PAYMENT_METHOD | PAYMENT_METHOD.CARD | HIDDEN
30 | PAYMENT_METHOD | PAYMENT_METHOD.MAIN_LESSOR | ALWAYS
40 | PAYMENT_METHOD | PAYMENT_METHOD.CARD_LESSOR | HIDDEN
20 | PAYMENT_TERMS | PAYMENT_TERMS.OFFSET | ALWAYS
30 | PAYMENT_TERMS | PAYMENT_TERMS.RECEIPTS | ALWAYS
40 | PAYMENT_TERMS | PAYMENT_TERMS.LATE | ALWAYS
100 | PERMITTED_USE | PERMITTED_USE.MAIN | ALWAYS
200 | PERMITTED_USE | PERMITTED_USE.TRAINER | HIDDEN
250 | PERMITTED_USE | TRAINING_LESSONS.LESSONS | HIDDEN
255 | PERMITTED_USE | TRAINING_LESSONS.LESSONS_ENTITY | HIDDEN
256 | PERMITTED_USE | TRAINING_LESSONS.PENDING | HIDDEN
270 | PERMITTED_USE | TRAINING_LESSONS.TRAINING | ALWAYS
300 | PERMITTED_USE | COMPETITIONS.INTRO | HIDDEN
320 | PERMITTED_USE | RESTRICT.JUMP_TITLE | HIDDEN
330 | PERMITTED_USE | RESTRICT.JUMP_ON | HIDDEN
340 | PERMITTED_USE | RESTRICT.JUMP_OFF | HIDDEN
350 | PERMITTED_USE | RESTRICT.COMP_TITLE | HIDDEN
360 | PERMITTED_USE | RESTRICT.COMP_ON | HIDDEN
370 | PERMITTED_USE | RESTRICT.COMP_OFF | HIDDEN
380 | PERMITTED_USE | RESTRICT.TRAIL_TITLE | HIDDEN
390 | PERMITTED_USE | RESTRICT.TRAIL_ON | HIDDEN
400 | PERMITTED_USE | RESTRICT.TRAIL_OFF | HIDDEN
410 | PERMITTED_USE | PERMITTED_USE.RESTRICTIONS | ALWAYS
450 | PERMITTED_USE | PROHIBITED.OTHER | HIDDEN
455 | PERMITTED_USE | PROHIBITED.OTHER_NONE | SHOWS
460 | PERMITTED_USE | PROHIBITED.OTHER_NOTE | HIDDEN
480 | PERMITTED_USE | PROHIBITED.OTHERS | ALWAYS
490 | PERMITTED_USE | PROHIBITED.OTHERS_OTHER | HIDDEN
495 | PERMITTED_USE | PERMITTED_USE.RELEASES_REQUIRED | ALWAYS
500 | PERMITTED_USE | PERMITTED_USE.TRANSPORT | ALWAYS
10 | PURPOSE | PURPOSE.RECREATION | HIDDEN
12 | PURPOSE | PURPOSE.RECREATION_DEFAULT | SHOWS
15 | PURPOSE | PURPOSE.GRANT | ALWAYS
20 | PURPOSE | PURPOSE.LEASE_TYPE | ALWAYS
10 | SCHEDULE | SCHEDULE.MAIN | SHOWS
12 | SCHEDULE | SCHEDULE.OTHER | SHOWS
15 | SCHEDULE | SCHEDULE.CHANGES | SHOWS
10 | SEVERABILITY | SEVERABILITY.SAVING | ALWAYS
10 | SIGNATURES | SIGNATURES.BLOCK | ALWAYS
11 | SIGNATURES | SIGNATURES.LESSEE_CAPACITY | HIDDEN
12 | SIGNATURES | SIGNATURES.LESSOR_CAPACITY | SHOWS
10 | TERM | TERM.MAIN | ALWAYS
12 | TERM | TERM.FIXED_END | HIDDEN
19 | TERM | TERM.RENEWAL | HIDDEN
22 | TERM | TERM.ADDITIONAL | ALWAYS
30 | TERM | TERM.TERMINATION_XREF | ALWAYS
10 | TERMINATION | TERMINATION.LESSEE | ALWAYS
20 | TERMINATION | TERMINATION.OWNER | ALWAYS
30 | TERMINATION | TERMINATION.CAUSE | ALWAYS
40 | TERMINATION | TERMINATION.LOSS | ALWAYS
45 | TERMINATION | TERMINATION.LOSS_OF_USE | ALWAYS
50 | TERMINATION | TERMINATION.SURVIVAL | ALWAYS
```

## Full merged body

```
1. PARTIES
1.1 This Horse Lease Agreement (the "Agreement") is made effective as of August 2, 2026 by and between French Heritage Equestrian of 11500 Clews Ranch Rd Ste A, San Diego, CA 92130 ("Lessor") and Closure ValidationArticle of  ("Lessee").

2. DEFINITIONS; BINDING EFFECT; THIRD-PARTY BENEFICIARIES
2.1 "Lessor Parties" means Lessor; Lessor's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Lessor and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.

2.2 "Lessee Parties" means Lessee; Lessee's spouse and family and household members, in each case when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Lessee's estate, executors, administrators, legal representatives, successors, and assigns.

2.3 Each release, waiver, assumption of risk, and covenant made by a party under this Agreement is made by that party on its own behalf and, to the fullest extent permitted by law, binds anyone claiming by, through, or under that party, including that party's estate, executors, administrators, heirs, legal representatives, successors, assigns, insurers, and subrogees. Each party covenants that it will not permit any person who has not executed this Agreement or a release satisfying the Releases Required for Authorized Riders provision of this Agreement to ride, handle, or care for the Horse, and each party shall indemnify, defend, and hold harmless the other party's Lessor Parties or Lessee Parties, as applicable, from and against any claim brought by that party's family members, invitees, or authorized riders arising out of the Horse or the activities contemplated by this Agreement, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

2.4 Each Lessor Party and each Lessee Party who is not a signatory to this Agreement is an intended third-party beneficiary of the releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement and may enforce them directly.

3. THE HORSE
3.1 Horse
This Agreement applies to the following horse (the "Horse"): Beaumont de Cactai
Color: Bay
Markings: Star and left hind sock
Breed: Selle Français
Registration Number: SF-2016-04412
Sex: Gelding
Foaling date: April 12, 2016
Current fair market value: $45,000.00
Microchip: 985141002347781
Passport: FRA-2016-778110

3.2 Ownership of the Horse
Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.

3.3 Are there any ownership related leasing restrictions? 

3.4 Behavior
The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.

3.5 Physical Condition
The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement.

3.6 No Serious Injury History
Lessor represents that, to Lessor's knowledge, no person has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse's reaction was within the range of normal equine behavior.

3.7 Pre-Lease Veterinary Examination

3.8 Pre-Lease Trainer Evaluation

3.9 Disclaimer of Warranties
Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

4. PURPOSE AND LEASE GRANT
4.1 Purpose of Agreement
[Pending — select the purpose of this lease. This placeholder is replaced by the applicable purpose language and blocks signing.]

4.2 Lease Grant
Subject to the terms and conditions of this Agreement, Lessor agrees to lease to Lessee and Lessee agrees to lease from Lessor the horse described below.

4.3 Lease Type
Lease type: Partial lease (shared or limited access).

5. SCHEDULE FOR LESSEE'S USAGE
5.1 Schedule for Lessee's Usage

5.2 Schedule Changes
Any changes to the agreed upon schedule must be made and accepted in writing.

6. LEASE FEE
6.1 If no monetary lease fee is payable under this Agreement, the parties agree that Lessee's undertakings of care, exercise, and use of the Horse and Lessee's other obligations under this Agreement constitute good and adequate consideration for this Agreement.

7. PAYMENT TERMS
7.1 Right of Offset
A party to whom money is owed under this Agreement may offset the amount owed against any amount that party owes to the other party.

7.2 Receipts
A party seeking reimbursement for an expense paid on behalf of the other party shall provide a receipt or other reasonable documentation of the expense as a condition of reimbursement.

7.3 Late Payments
All payments are due on their due date or within 5 business days of notification of the amount owed. Payments will be deemed late if they remain unpaid on the 6th business day. Late payments are considered a breach of the contract terms and may be grounds for termination of the Agreement unless the party from whom the payment is owed has communicated in writing the date by which payment will be made. Payments exceeding 1 calendar month in past-due status constitute grounds for termination for cause under the Termination for Cause provisions of this Agreement unless prior written acceptance of the delay is provided by the party to whom the payment is owed.

8. PAYMENT METHOD
8.1 Payments by the Lessee
The Lessee may pay amounts owed under this Agreement by the following method(s): 

8.2 Payments by the Lessor
The Lessor may pay amounts owed under this Agreement by the following method(s): 

9. LOCATION OF HORSE
9.1 Location of the Horse
Location of the Horse: FHE Main Barn Stall 12.

9.2 Lessor may inspect the Horse at any time, subject to the reasonable access rules of the facility where the Horse is kept. If Lessor reasonably determines that the Horse is not being properly cared for, Lessor may take possession of the Horse upon written notice to Lessee.

10. AGREEMENT TERM
10.1 Agreement Term
Term of this Agreement: . This Agreement begins on .

10.2 Notwithstanding the term stated above, this Agreement may be terminated earlier as provided in the Termination section of this Agreement.

11. PERMITTED USE(S) & RESTRICTIONS
11.1 Permitted Use(s)
Lessor grants Lessee the right to use the Horse for the following purpose(s): 
Lessee shall not use the Horse for any other purpose without Lessor's prior written consent.

11.2 Training
Any professional training of the Horse under this Agreement, including groundwork, schooling, and under-saddle training, shall be conducted only by a French Heritage Equestrian Approved Trainer.

11.3 Additional Restrictions

11.4 Other Allowed Activities
Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.

11.5 Releases Required for Authorized Riders
All persons other than Lessee must, prior to handling or riding the Horse, have executed a liability release that names the Lessor Parties and the Lessee Parties as released parties, contains an express assumption of the inherent risks of equine activities, has been reviewed and approved by Lessor, and, for any rider under 18 years of age, is signed by the rider's parent or legal guardian. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.

12. HORSE CARE AND EXPENSES
12.1 Horse care and expenses shall be managed and paid for by the responsible party as listed below.

12.2 Farrier Care

12.3 Veterinary Care

12.4 Protective Equipment

12.5 Tack
When riding and handling the Horse, Lessee shall use only tack in good condition that is properly fitted to the Horse.

13. INSURANCE, RISK OF LOSS, AND INDEMNIFICATION
13.1 Insurance Requirements
The parties agree to the insurance elections set forth below. Each policy elected or required below shall be maintained in effect for the duration of this Agreement.

13.2 General Liability Insurance

13.3 Lessor: Does not have and will not obtain general liability insurance covering the Horse and the activities contemplated by this Agreement.
Lessee: Does not have and will not obtain general liability insurance covering the Horse and the activities contemplated by this Agreement.

13.4 Mortality Insurance

13.5 Lessor: Has and will maintain mortality insurance on the Horse.
Lessee: Does not have and will not obtain mortality insurance on the Horse.

13.6 If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: Split. The deductible shall be split between the parties:  paid by Lessor and  paid by Lessee.

13.7 Medical Insurance

13.8 Lessor: Does not have and will not obtain medical insurance on the Horse.
Lessee: Does not have and will not obtain medical insurance on the Horse. Any out-of-pocket costs for deductibles or other expenses related to the needs of the Horse are to be paid by Lessor, and where Lessee is deemed to be responsible for part or all of a cost paid by Lessor, Lessee shall reimburse Lessor in accordance with the acceptable payment methods stated in this Agreement, or, if Lessee so requests prior to payment by Lessor, Lessee may make such request to pay the billing party directly using a method allowed by that party. Lessee may, with Lessor's written permission, pay for any or all of Lessor's portion when paying the billing party directly, and Lessor may reimburse Lessee in accordance with the terms of this Agreement. Lessor assumes and is responsible for all risks and costs not paid or covered by any policy held by either party, including in the event a policy is not in effect at the time of the incident, an incident for which a claim is made is deemed not to be covered by a policy, a payment for a claim made for an incident that is covered by a policy is less than the actual cost incurred, or a claim made to a policy is denied for any reason, except as otherwise expressly allocated in this section or elsewhere in this Agreement.

13.9 Risk of Loss of or Injury to the Horse
Lessor assumes all risk of loss of or injury to the Horse during the term of this Agreement, except to the extent caused by Lessee's gross negligence, reckless conduct, or intentional misconduct.

13.10 Loss of Use
Lessor acknowledges and accepts that loss of use of the Horse may result from injury to, illness of, or the death of the Horse. No loss-of-use insurance is required or provided under this Agreement.

13.11 Assumption of Inherent Risks
Lessee understands that horseback riding and handling horses are inherently dangerous activities. Lessee acknowledges that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. Lessee acknowledges the California common law doctrine of "Primary Assumption of Risk," as established by the California Supreme Court in Knight v. Jewett (1992) 3 Cal.4th 296 and subsequent equine-specific case law (e.g., Levinson v. Owens (2009) 176 Cal.App.4th 1534). Consistent with this precedent, Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that no Lessor Party owes a duty to protect Lessee from these inherent risks.

13.12 Release of Liability
In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, completely releases, forever discharges, and agrees to hold harmless the Lessor Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee's use, handling, or riding of the Horse, whether caused by the ordinary negligence of any Lessor Party or otherwise. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

13.13 Release of Liability by Lessor
In consideration of the mutual promises in this Agreement, Lessor, on behalf of Lessor and anyone claiming by, through, or under Lessor, completely releases, forever discharges, and agrees to hold harmless the Lessee Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessor's riding or handling of the Horse or Lessor's presence at any facility where the Horse is kept during the term of this Agreement, whether caused by the ordinary negligence of any Lessee Party or otherwise. Lessor expressly and voluntarily assumes all inherent risks of equine activities in connection with such riding, handling, or presence. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

13.14 Required Protective Attire
Lessee shall wear, and shall ensure that any other person riding the Horse under Lessee's authorization wears, an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Riders shall provide their own helmet, boots, and pants meeting these requirements unless otherwise agreed in writing. Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes permission to ride or handle the Horse and constitutes a material breach of this Agreement.

13.15 Waiver of Unknown Claims
Each party, on behalf of itself and anyone claiming by, through, or under it, expressly waives any and all claims released under this Agreement that the waiving party does not know or suspect to exist in its favor at the time of this Agreement. Each party acknowledges that it is familiar with, and expressly waives the protections of, California Civil Code Section 1542, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party." Each party assumes the risk that claims presently unknown to it may later be discovered, and acknowledges that this waiver is a material term of this Agreement.

13.16 Mutual Indemnification
Each party shall indemnify, defend, and hold harmless the other party and, respectively, the Lessor Parties or the Lessee Parties, from and against any and all claims, damages, losses, liabilities, costs, and expenses arising out of the indemnifying party's use, handling, care, or possession of the Horse, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

13.17 Limitation of Liability
Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the Horse's current fair market value of $45,000.00. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct, to either party's indemnification obligations for third-party claims for bodily injury or death, or to amounts actually covered by insurance available for the loss.

14. TERMINATION
14.1 Lessee's Right to Terminate
Lessee may terminate this Agreement by giving Lessor at least  days' prior written notice.

14.2 Owner's Right to Terminate
Lessor may terminate this Agreement by giving Lessee at least  days' prior written notice.

14.3 Termination for Cause
Either party may terminate this Agreement for cause (including a material breach that remains uncured) by giving the other party at least  days' prior written notice.

14.4 Self-Termination upon Loss or Injury
This Agreement shall self-terminate if the Horse is significantly injured or seriously ill as determined by a licensed veterinarian, or dies. Lessee is entitled to a prorated refund of Lease Fee paid for the remaining time unused at the time of self-termination. In the event Lessee is found to have caused, through gross negligence, reckless conduct, or intentional misconduct, the injury, illness, or death, Lessor may retain the unused portion of the paid Lease Fee.

14.5 Termination upon Loss of Use
If the Horse becomes unusable for the purposes of this Agreement for any reason, Lessee may terminate this Agreement immediately upon written notice to Lessor. Upon such termination, Lessee is entitled to a prorated refund of any Lease Fee paid for the remaining unused time as of the date of termination.

14.6 Survival
The releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement, and any payment obligations accrued before termination, survive the expiration or termination of this Agreement for any reason.

15. NOTICE AND CONTACT INFORMATION
15.1 Form of Notice
Any notice required or permitted under this Agreement shall be in writing and delivered by a method that provides evidence of receipt to the party at the contact information below. Notice by email is not effective unless the receiving party acknowledges receipt.

15.2 Lessee
Name: Closure ValidationArticle
Email: closure-validation-20260802@example.invalid

15.3 Lessor
Name: French Heritage Equestrian
Address: 11500 Clews Ranch Rd Ste A, San Diego, CA 92130
Phone: (858) 439-3614
Email: hello@fhequestrian.com

15.4 Changes in Contact Information
Each party shall promptly notify the other party in writing of any change in the party's address or contact information.

16. ASSIGNMENT OR TRANSFER
16.1 Assignment or Transfer
Lessee shall not assign, sublease, or otherwise transfer this Agreement or any of Lessee's rights or obligations under it without Lessor's prior written consent, unless permitted in the sections above.

17. ENTIRE AGREEMENT
17.1 Entire Agreement
This Agreement contains the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions and understandings. Any modification of this Agreement must be in writing and signed by all parties.

18. GOVERNING LAW AND VENUE
18.1 Governing Law and Venue
This Agreement is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or relating to this Agreement or the Horse shall be resolved by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, or another administrator the parties agree to in writing, with arbitrator fees and administrative costs allocated as those rules provide. Either party may bring a qualifying claim in small claims court, and either party may seek provisional or injunctive relief, including recovery of possession of the Horse, in a court of competent jurisdiction without waiving arbitration. Judgment on the award may be entered in any court having jurisdiction.

19. ATTORNEYS' FEES
19.1 Attorneys' Fees
Each party shall cover their own attorney's fees and costs.

20. SEVERABILITY
20.1 Severability
If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.

21. LESSEE'S REPRESENTATIONS
21.1 Lessee's Representations
Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into this Agreement; that Lessee has no physical or mental condition that would prevent Lessee from safely participating in the activities contemplated by this Agreement; and that Lessee has the requisite knowledge and experience to handle and ride the Horse, and will use reasonable care in doing so and follow Lessor's instructions. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and anyone claiming by, through, or under Lessee, including the right to sue the Lessor Parties.

22. SIGNATURES
22.1 Signatures
IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

LESSEE
Signature: {{SIG.LESSEE.NAME}}
Printed Name: Closure ValidationArticle
Date: {{SIG.LESSEE.DATE}}

LESSOR (OWNER)
Signature: {{SIG.LESSOR.NAME}}
Printed Name: French Heritage Equestrian
Date: {{SIG.LESSOR.DATE}}

22.2 By: Charles Zigmund
Title: Owner, Sole Proprietor
Signing on behalf of French Heritage Equestrian

```
