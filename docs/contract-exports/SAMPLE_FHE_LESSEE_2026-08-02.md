# HORSE_LEASE_V2 — regenerated sample (proof of D1–D5 through the live write path)

Generated 2026-08-02 UTC from the live database (project `lrstswfxfsezdmvkvukc`),
reflecting migration head `20260802040000_u7_stage_b_legacy_retirement.sql`.

**This is a NEW document, created for this run, end to end through the real
system — not adapted from any prior sample file.** The prior sample
(`docs/archive/contract-exports/SAMPLE_FHE_LESSEE_2026-08-01.md`) was consulted
for formatting/layout conventions only (heading numbering, section ordering)
and for nothing else — it predates this run's fixes and was never read for
content or field values.

**Document id:** `c36449f7-a29f-4b12-9313-4f9a8a0ca9a1`
**Contract id:** `07d84769-23cd-4c76-bf96-3a735a502c73`
**Status:** `AWAITING_SIGNATURE` (draft)

**How this document was created (every step through a real RPC, none through
a direct table write):**

1. `start_lease_contract_v2(p_lessee_contact_id := 'd99f1472-...', p_lessor_contact_id
   := '352c3898-...', p_horse_id := 'a8e82033-...', p_responsible_role := 'LESSEE')`,
   called as a real authenticated staff session
   (`admin@fhequestrian.com`, `has_staff_access() = true`). This is the same
   RPC `src/lib/api.ts` calls from the real "New contract" UI — the app's own
   entry point for starting a lease, not a lower-level helper. Result:
   `{"contract_id": "07d84769-...", "document_id": "c36449f7-...", "fields_seeded": 111}`.
2. Every field below was set via `set_contract_field(document_id, field_key,
   value)` — the same RPC every party's UI calls on every keystroke/selection
   in the real contract-editing surface (`ContractCascade.tsx`). Staff set the
   party types, purpose, term, and horse value. **The insurance status fields
   (all six `_LESSOR_STATUS`/`_LESSEE_STATUS`) were set to `NONE`** through
   this same RPC, to bring all three sections (GL/MORT/MED) into the
   unresolved state D1–D5 govern.
3. **The proof point:** the LESSEE party — a real account
   (`0a7fc801-5b17-41f5-b379-11982030d182`, contact `d99f1472-...`, "CJ Z") —
   made their OWN election on mortality insurance:
   `set_contract_field('c36449f7-...', 'TXN.MORT_LESSEE_RESPONSIBLE', 'YES')`,
   run under that account's real session (`request.jwt.claim.sub` set to that
   account's `user_id`, matching how a real request from that logged-in user
   would authenticate). Result: `YES` — the write succeeded.
4. **Control, same real session:** the same account then attempted
   `set_contract_field('c36449f7-...', 'TXN.GL_NOT_REQUIRED', 'YES')` — the
   GENERAL LIABILITY certify, which is LESSOR-owned, not theirs. Rejected:
   `"only the LESSOR may make this election (field TXN.GL_NOT_REQUIRED) — it
   is that party's own act and cannot be made on their behalf"`. D4's
   party-exclusive enforcement, exercised by a real account against a real
   field it does not own, live.
5. The document below is `remerge_contract_body('c36449f7-...')`'s actual
   return value — the same function the app calls to re-render a document
   after any field edit. Not hand-edited.

**Blocker state, `contract_lock_blockers`, BEFORE the election (all three
insurance sections present):**
```
insurance_unresolved_gl:   "General liability insurance responsibility unresolved — one party must accept it"
insurance_unresolved_mort: "Mortality insurance responsibility unresolved — one party must accept it"
insurance_unresolved_med:  "Medical insurance responsibility unresolved — one party must accept it"
```

**Blocker state AFTER the real election (MORT is gone, GL/MED remain — proves
the resolver logic, not just the gate):**
```
insurance_unresolved_gl:   still present
insurance_unresolved_med:  still present
(insurance_unresolved_mort is ABSENT — resolved by the real write in step 3)
```

**D5 notification, real:** a real `insurance_unresolved` notification row was
produced for account `0a7fc801-...` (unread, linked to
`/app/contracts/c36449f7-...`) when the state first became unresolved — before
the election. It remains open because GL and MED are still unresolved (D5's
resolver only fires when ALL sections clear); this is correct behavior, not a
bug.

**Known, separately-reported defect visible in this render (not fixed here —
see `docs/BACKLOG.md`):** `HORSE.FAIR_MARKET_VALUE` renders `52500.00` (§2.1)
rather than `$52,500.00`. This is `remerge_contract_from_clauses` missing
U2.1's money-formatting layer — confirmed independently on THIS fresh document
too, reinforcing it is a systemic gap in that render path, not specific to any
one document's history.

---

1. PARTIES
1.1 This Horse Lease Agreement (the "Agreement") is made effective as of August 2, 2026 by and between French Heritage Equestrian of 11500 Clews Ranch Rd Ste A, San Diego, CA 92130 ("Lessor") and CJ Z of 752 Windemere ct, San Diego, CA 92109 ("Lessee").

2. THE HORSE
2.1 Horse
This Agreement applies to the following horse (the "Horse"): Beaumont de Cactai
Color: Bay
Markings: Star and left hind sock
Breed: Selle Français
Registration Number: SF-2016-04412
Sex: Gelding
Year foaled: April 12, 2016
Current fair market value: 52500.00
Microchip: 985141002347781
Passport: FRA-2016-778110

2.2 Ownership of the Horse
Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.

2.3 Are there any ownership related leasing restrictions? 

2.4 Behavior
The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.

2.5 Physical Condition
The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement.

2.6 Pre-Lease Veterinary Examination

2.7 Pre-Lease Trainer Evaluation

2.8 Disclaimer of Warranties
Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE.

3. PURPOSE AND LEASE GRANT
3.1 Purpose of Agreement
For instructional purposes, Lessee wishes to ride and/or handle Lessor's horse, and Lessor agrees to allow Lessee to ride and/or handle Lessor's horse in exchange for the consideration described herein.

3.2 Lease Grant
Subject to the terms and conditions of this Agreement, Lessor agrees to lease to Lessee and Lessee agrees to lease from Lessor the horse described below.

3.3 Lease Type
Lease type: Partial lease (shared or limited access).

4. DEFINITIONS; BINDING EFFECT; THIRD-PARTY BENEFICIARIES
4.1 "Lessor Parties" means Lessor and, as applicable, Lessor's owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers, and the family members of any of the foregoing. With respect to each natural person falling within any of the foregoing categories, "Lessor Parties" also includes that person's heirs, next of kin, spouse, estate, executors, administrators, legal representatives, successors, and assigns, in each case to the same extent as if that person had entered into this Agreement individually as Lessor.

4.2 "Lessee Parties" means Lessee and Lessee's heirs, next of kin, spouse, estate, executors, administrators, legal representatives, successors, and assigns.

4.3 Each party enters into this Agreement on behalf of itself and all of its respective Lessor Parties or Lessee Parties, as applicable, and all releases, waivers, assumptions of risk, and covenants made by a party under this Agreement are made on behalf of all of that party's Parties and bind each of them to the same extent as the party itself.

4.4 Each Lessor Party and each Lessee Party is an intended third-party beneficiary of the releases, waivers, assumptions of risk, and limitations of liability in this Agreement and may enforce them directly.

5. SCHEDULE FOR LESSEE'S USAGE
5.1 Schedule for Lessee's Usage

5.2 Schedule Changes
Any changes to the agreed upon schedule must be made and accepted in writing.

6. PAYMENT TERMS
6.1 Right of Offset
A party to whom money is owed under this Agreement may offset the amount owed against any amount that party owes to the other party.

6.2 Receipts
A party seeking reimbursement for an expense paid on behalf of the other party shall provide a receipt or other reasonable documentation of the expense as a condition of reimbursement.

6.3 Late Payments
All payments are due on their due date or within 5 business days of notification of the amount owed. Payments will be deemed late if they remain unpaid on the 6th business day. Late payments are considered a breach of the contract terms and may be grounds for termination of the Agreement unless the party from whom the payment is owed has communicated in writing the date by which payment will be made. Payments exceeding 1 calendar month in past-due status constitute grounds for termination for cause under the Termination for Cause provisions of this Agreement unless prior written acceptance of the delay is provided by the party to whom the payment is owed.

7. PAYMENT METHOD
7.1 Payments by the Lessee
The Lessee may pay amounts owed under this Agreement by the following method(s): 

7.2 Payments by the Lessor
The Lessor may pay amounts owed under this Agreement by the following method(s): 

8. LOCATION OF HORSE
8.1 Location of the Horse
Location of the Horse: FHE Main Barn Stall 12.

8.2 Lessor may inspect the Horse at any time. If Lessor determines that the Horse is not being properly cared for, Lessor may take possession of the Horse.

9. AGREEMENT TERM
9.1 Agreement Term
Term of this Agreement: Fixed period. This Agreement begins on September 1, 2026.

9.2 This Agreement continues until September 1, 2027.

9.3 Notwithstanding the term stated above, this Agreement may be terminated earlier as provided in the Termination section of this Agreement.

10. PERMITTED USE(S) & RESTRICTIONS
10.1 Permitted Use(s)
Lessor grants Lessee the right to use the Horse for the following purpose(s): 
Lessee shall not use the Horse for any other purpose without Lessor's prior written consent.

10.2 Training
Any professional training of the Horse under this Agreement, including groundwork, schooling, and under-saddle training, shall be conducted only by a French Heritage Equestrian Approved Trainer.

10.3 Additional Restrictions

10.4 Other Allowed Activities
Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.

10.5 Releases Required for Authorized Riders
All persons other than Lessee must have executed Lessee's liability release, which has been reviewed and approved by Lessor, prior to handling or riding the Horse. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.

11. HORSE CARE AND EXPENSES
11.1 Horse care and expenses shall be managed and paid for by the responsible party as listed below.

11.2 Farrier Care

11.3 Veterinary Care

11.4 Protective Equipment

11.5 Tack
When riding and handling the Horse, Lessee shall use only tack in good condition that is properly fitted to the Horse.

12. INSURANCE, RISK OF LOSS, AND INDEMNIFICATION
12.1 Insurance Requirements
The parties agree to the insurance elections set forth below. Each policy elected or required below shall be maintained in effect for the duration of this Agreement.

12.2 General Liability Insurance

12.3 Lessor: Does not have and will not obtain general liability insurance covering the Horse and the activities contemplated by this Agreement.
Lessee: Does not have and will not obtain general liability insurance covering the Horse and the activities contemplated by this Agreement.

12.4 If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: .

12.5 Mortality Insurance

12.6 Lessor: Does not have and will not obtain mortality insurance on the Horse.
Lessee: Does not have and will not obtain mortality insurance on the Horse.

12.7 If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: .

12.8 Mortality — Lessee Responsibility
[PENDING LEGAL REVIEW — body to be supplied by the contract review thread (spec C1). Placeholder: the Lessee has accepted financial responsibility for mortality insurance.]

> ⚠ **THIS CLAUSE IS THE LIVE PROOF OF D1/D2/D4.** It renders ONLY because
> the real account `0a7fc801-...` (CJ Z, the LESSEE) made their own election
> through the real `set_contract_field` RPC (step 3 above). No other party,
> including staff, could have caused this text to appear here — a staff
> attempt to set the same field on this document would be (and, on a sibling
> field, WAS — see the control in step 4) rejected server-side.

12.9 Medical Insurance

12.10 Lessor: Does not have and will not obtain medical insurance on the Horse.
Lessee: Does not have and will not obtain medical insurance on the Horse.

12.11 If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: . Any out-of-pocket costs for deductibles or other expenses related to the needs of the Horse are to be paid by Lessor, and where Lessee is deemed to be responsible for part or all of a cost paid by Lessor, Lessee shall reimburse Lessor in accordance with the acceptable payment methods stated in this Agreement, or, if Lessee so requests prior to payment by Lessor, Lessee may make such request to pay the billing party directly using a method allowed by that party. Lessee may, with Lessor's written permission, pay for any or all of Lessor's portion when paying the billing party directly, and Lessor may reimburse Lessee in accordance with the terms of this Agreement. Lessor assumes and is responsible for all risks and costs not paid or covered by any policy held by either party, including in the event a policy is not in effect at the time of the incident, an incident for which a claim is made is deemed not to be covered by a policy, a payment for a claim made for an incident that is covered by a policy is less than the actual cost incurred, or a claim made to a policy is denied for any reason.

12.12 Risk of Loss of or Injury to the Horse
Lessor assumes all risk of loss of or injury to the Horse during the term of this Agreement, except to the extent caused by Lessee's gross negligence, reckless conduct, or intentional misconduct.

12.13 Loss of Use
Lessor acknowledges and accepts that loss of use of the Horse may result from injury to, illness of, or the death of the Horse. No loss-of-use insurance is required or provided under this Agreement.

12.14 Assumption of Inherent Risks
Lessee understands that horseback riding and handling horses are inherently dangerous activities. Lessee acknowledges that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. Lessee acknowledges the California common law doctrine of "Primary Assumption of Risk," as established by the California Supreme Court in Knight v. Jewett (1992) 3 Cal.4th 296 and subsequent equine-specific case law (e.g., Levinson v. Owens (2009) 176 Cal.App.4th 1534). Pursuant to this binding legal precedent, Lessee, on behalf of all Lessee Parties, expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that no Lessor Party owes a duty to protect Lessee from these inherent risks.

12.15 Release of Liability
In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and all Lessee Parties, completely releases, forever discharges, and agrees to hold harmless the Lessor Parties from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee's use, handling, or riding of the Horse, whether caused by the ordinary negligence of any Lessor Party or otherwise. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

12.16 Required Protective Attire
Lessee shall wear, and shall ensure that any other person riding the Horse under Lessee's authorization wears, an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Riders shall provide their own helmet, boots, and pants meeting these requirements unless otherwise agreed in writing. Lessee, on behalf of all Lessee Parties, assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes permission to ride or handle the Horse and constitutes a material breach of this Agreement.

12.17 Waiver of Unknown Claims
Each party, on behalf of itself and, respectively, the Lessor Parties or the Lessee Parties, expressly waives any and all claims against the other party and its respective party group that the waiving party does not know or suspect to exist at the time of this Agreement, and acknowledges that this waiver is a material term of this Agreement. Each party assumes the risk that claims presently unknown to it may later be discovered.

12.18 Mutual Indemnification
Each party shall indemnify, defend, and hold harmless the other party and, respectively, the Lessor Parties or the Lessee Parties, from and against any and all claims, damages, losses, liabilities, costs, and expenses arising out of the indemnifying party's use, handling, care, or possession of the Horse, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

12.19 Limitation of Liability
Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the Horse's current fair market value of 52500.00. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.

13. TERMINATION
13.1 Lessee's Right to Terminate
Lessee may terminate this Agreement by giving Lessor at least  days' prior written notice.

13.2 Owner's Right to Terminate
Lessor may terminate this Agreement by giving Lessee at least  days' prior written notice.

13.3 Termination for Cause
Either party may terminate this Agreement for cause (including a material breach that remains uncured) by giving the other party at least  days' prior written notice.

13.4 Self-Termination upon Loss or Injury
This Agreement shall self-terminate if the Horse is significantly injured or seriously ill as determined by a licensed veterinarian, or dies. Lessee is entitled to a prorated refund of Lease Fee paid for the remaining time unused at the time of self-termination. In the event Lessee is found to have caused, through gross negligence, reckless conduct, or intentional misconduct, the injury, illness, or death, Lessor may retain the unused portion of the paid Lease Fee.

13.5 Termination upon Loss of Use
If the Horse becomes unusable for the purposes of this Agreement for any reason, Lessee may terminate this Agreement immediately upon written notice to Lessor. Upon such termination, Lessee is entitled to a prorated refund of any Lease Fee paid for the remaining unused time as of the date of termination.

13.6 Survival
The releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement, and any payment obligations accrued before termination, survive the expiration or termination of this Agreement for any reason.

14. NOTICE AND CONTACT INFORMATION
14.1 Form of Notice
Any notice required or permitted under this Agreement shall be in writing and delivered by a method that provides evidence of receipt to the party at the contact information below. Notice by email is not effective unless the receiving party acknowledges receipt.

14.2 Lessee
Name: CJ Z
Address: 752 Windemere ct, San Diego, CA 92109
Phone: (617) 838-4183
Email: cjzigs@icloud.com

14.3 Lessor
Name: French Heritage Equestrian
Address: 11500 Clews Ranch Rd Ste A, San Diego, CA 92130
Phone: (858) 439-3614
Email: hello@fhequestrian.com

14.4 Changes in Contact Information
Each party shall promptly notify the other party in writing of any change in the party's address or contact information.

15. ASSIGNMENT OR TRANSFER
15.1 Assignment or Transfer
Lessee shall not assign, sublease, or otherwise transfer this Agreement or any of Lessee's rights or obligations under it without Lessor's prior written consent, unless permitted in the sections above.

16. ENTIRE AGREEMENT
16.1 Entire Agreement
This Agreement contains the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions and understandings. Any modification of this Agreement must be in writing and signed by all parties.

17. GOVERNING LAW AND VENUE
17.1 Governing Law and Venue
This Agreement shall be governed by the laws of the State of California. Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California.

18. ATTORNEYS' FEES
18.1 Attorneys' Fees
Each party shall cover their own attorney's fees and costs.

19. SEVERABILITY
19.1 Severability
If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.

20. LESSEE'S REPRESENTATIONS
20.1 Lessee's Representations
Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into this Agreement; that Lessee has no physical or mental condition that would prevent Lessee from safely participating in the activities contemplated by this Agreement; and that Lessee has the requisite knowledge and experience to handle and ride the Horse, and will use reasonable care in doing so and follow Lessor's instructions. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.

21. SIGNATURES
21.1 Signatures
IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

LESSEE
Signature: {{SIG.LESSEE.NAME}}
Printed Name: CJ Z
Date: {{SIG.LESSEE.DATE}}

LESSOR (OWNER)
Signature: {{SIG.LESSOR.NAME}}
Printed Name: French Heritage Equestrian
Date: {{SIG.LESSOR.DATE}}
