# HORSE_LEASE_SIMPLE — the obvious candidates

**Observations, not recommendations.** Nothing here is a proposal. No target size is implied.
These are the groupings that a reader of the full text notices first, with the exact cost of each
so the arithmetic is not in the way of the conversation.

Baseline: **22 sections · 144 clauses · 117 fields.**

## Where the length is

| Section | Clauses | Fields | Share of clauses |
|---|---:|---:|---:|
| 1. Parties | 1 | 2 | 1% |
| 2. Definitions; Binding Effect; Third-Party Beneficiaries | 8 | 0 | 6% |
| 3. The Horse | 19 | 24 | 13% |
| 4. Purpose and Lease Grant | 4 | 2 | 3% |
| 5. Schedule for Lessee's Usage | 3 | 2 | 2% |
| 6. Lease Fee | 1 | 1 | 1% |
| 7. Payment Terms | 3 | 0 | 2% |
| 8. Payment Method | 4 | 4 | 3% |
| 9. Evaluation Period | 5 | 7 | 3% |
| 10. Agreement Term | 5 | 6 | 3% |
| 11. Permitted Use(s) & Restrictions | 24 | 19 | 17% |
| 12. Horse Care and Expenses | 11 | 21 | 8% |
| 13. Insurance, Risk of Loss, and Indemnification | 35 | 21 | 24% |
| 14. Termination | 6 | 3 | 4% |
| 15. Notice and Contact Information | 4 | 0 | 3% |
| 16. Assignment or Transfer | 1 | 0 | 1% |
| 17. Entire Agreement | 1 | 0 | 1% |
| 18. Governing Law and Venue | 1 | 0 | 1% |
| 19. Attorneys' Fees | 1 | 0 | 1% |
| 20. Severability | 1 | 0 | 1% |
| 21. Lessee's Representations | 3 | 0 | 2% |
| 22. Signatures | 3 | 4 | 2% |

Two sections carry **41%** of the clauses between them: Insurance, Risk of Loss and Indemnification
(35) and Permitted Use(s) & Restrictions (24).

## Groups that come out together

| Group | Clauses | Fields | Of which protective | What it is |
|---|---:|---:|---:|---|
| Entity-only content | 8 | 5 | 5 | Prints only where a party is a company, partnership or programme rather than a person. |
| “Pending” placeholders | 6 | 0 | 0 | Carry no agreement text. Each is a bracketed note that prints while a selection is blank and blocks signing. |
| Evaluation period | 5 | 7 | 0 | A trial period before or inside the term, with its own fee and its own termination right. |
| Competition, jumping and trail restriction triads | 9 | 8 | 0 | Three identical mechanisms: a tick box, the restriction it reveals, and a sentence saying there is no restriction. |
| Split-deductible sub-clauses | 3 | 6 | 0 | Reached only when a deductible is answered “Split” — one of four options, on three separate policies. |
| Lessee-responsibility insurance clauses | 3 | 3 | 3 | Reached only when the policy is required and *both* parties answer “Does not have and will not obtain”. |
| Insurance status and deductible machinery | 9 | 15 | 0 | The same six-field pattern repeated for general liability, mortality and medical. |
| Payment-method card sub-clauses | 2 | 2 | 0 | Reveal a free-text processor description when “Credit Card” is ticked. |
| Third-party exercise | 1 | 4 | 0 | One clause carrying four questions, including a percentage split. |
| Exception pairs in The Horse | 4 | 4 | 0 | Yes/no questions and the free-text boxes they reveal. The warranties themselves (§3.6, §3.8) are separate clauses. |

Groups overlap — the split-deductible and Lessee-responsibility rows are also counted inside the
insurance machinery row. They are not additive.

### Entity-only content — 8 clauses, 5 fields

Prints only where a party is a company, partnership or programme rather than a person.

* **§2.3** "Lessor Parties" means Lessor; Lessor's parent, subsidiary, and … — `PROTECTIVE + DEPENDED-UPON`<br>  ⚠ Entity form of the same definition. If entity Lessors are possible at all, cutting this leaves “Lessor Parties” undefined for them.
* **§2.6** "Lessee Parties" means Lessee; Lessee's parent, subsidiary, and … — `PROTECTIVE + DEPENDED-UPON`<br>  ⚠ Entity form of the same definition.
* **§11.5** Lessons — Lessee's Instruction Program — `standalone`
* **§13.21** Care, Custody and Control Insurance — `PROTECTIVE + DEPENDED-UPON`<br>  ⚠ Requires an entity Lessee to carry care, custody and control cover at fair market value, and makes failure a for-cause breach.
* **§13.22** Coordination of Coverage — `PROTECTIVE`<br>  ⚠ Sets which policy responds first and who bears the deductible. Without it two policies exist with no ordering.
* **§21.3** Lessee's Representations — `PROTECTIVE`<br>  ⚠ Entity form of the same, plus the undertaking that every rider has signed the required releases.
* **§22.2** By: … Title: … Signing on behalf of … — `DEPENDED-UPON`
* **§22.3** By: … Title: … Signing on behalf of … — `DEPENDED-UPON`

### “Pending” placeholders — 6 clauses, 0 fields

Carry no agreement text. Each is a bracketed note that prints while a selection is blank and blocks signing.

* **§2.1** [Pending — select whether Lessor is an individual … — `standalone`
* **§2.4** [Pending — select whether Lessee is an individual … — `standalone`
* **§3.10** Serious Injury History — `standalone`
* **§4.1** Purpose of Agreement — `standalone`
* **§11.3** Lessons — `standalone`
* **§21.1** Lessee's Representations — `standalone`

### Evaluation period — 5 clauses, 7 fields

A trial period before or inside the term, with its own fee and its own termination right.

* **§9.1** (no printed text — input only) — `DEPENDED-UPON`
* **§9.2** Evaluation Period Details — `standalone`
* **§9.3** Evaluation Period Details — `standalone`
* **§9.4** No evaluation period applies to this Agreement. The … — `standalone`
* **§9.5** No evaluation period applies to this Agreement. The … — `standalone`

### Competition, jumping and trail restriction triads — 9 clauses, 8 fields

Three identical mechanisms: a tick box, the restriction it reveals, and a sentence saying there is no restriction.

* **§11.8** Competition Restrictions — `DEPENDED-UPON`
* **§11.9** Competitions are restricted as follows: … — `DEPENDED-UPON`
* **§11.10** Lessor does not restrict competition activity in any … — `standalone`
* **§11.11** Jumping Restrictions — `DEPENDED-UPON`
* **§11.12** Jumping is restricted as follows: maximum height …; … — `standalone`
* **§11.13** Lessor does not restrict jumping activity in any … — `standalone`
* **§11.14** Trail-Riding Restrictions — `DEPENDED-UPON`
* **§11.15** Trail riding is restricted as follows: … — `standalone`
* **§11.16** Lessor does not restrict trail-riding activity in any … — `standalone`

### Split-deductible sub-clauses — 3 clauses, 6 fields

Reached only when a deductible is answered “Split” — one of four options, on three separate policies.

* **§13.5** The deductible shall be split between the parties: … — `standalone`
* **§13.11** The deductible shall be split between the parties: … — `standalone`
* **§13.19** The deductible shall be split between the parties: … — `standalone`

### Lessee-responsibility insurance clauses — 3 clauses, 3 fields

Reached only when the policy is required and *both* parties answer “Does not have and will not obtain”.

* **§13.7** General Liability — Lessee Responsibility — `PROTECTIVE`<br>  ⚠ Shifts general-liability responsibility to the Lessee where neither party holds a policy. The only clause that allocates GL risk in that state.
* **§13.13** Mortality — Lessee Responsibility — `PROTECTIVE`<br>  ⚠ Same for mortality.
* **§13.16** Medical — Lessee Responsibility — `PROTECTIVE`<br>  ⚠ Same for medical.

### Insurance status and deductible machinery — 9 clauses, 15 fields

The same six-field pattern repeated for general liability, mortality and medical.

* **§13.3** Lessor: … general liability insurance covering the Horse … — `DEPENDED-UPON`
* **§13.4** If a claim is made under any such … — `DEPENDED-UPON`
* **§13.5** The deductible shall be split between the parties: … — `standalone`
* **§13.9** Lessor: … mortality insurance on the Horse. Lessee: … — `DEPENDED-UPON`
* **§13.10** If a claim is made under any such … — `DEPENDED-UPON`
* **§13.11** The deductible shall be split between the parties: … — `standalone`
* **§13.17** Lessor: … medical insurance on the Horse. Lessee: … — `DEPENDED-UPON`
* **§13.18** If a claim is made under any such … — `DEPENDED-UPON`
* **§13.19** The deductible shall be split between the parties: … — `standalone`

### Payment-method card sub-clauses — 2 clauses, 2 fields

Reveal a free-text processor description when “Credit Card” is ticked.

* **§8.2** Credit card payments are processed as follows: … — `standalone`
* **§8.4** Credit card payments are processed as follows: … — `standalone`

### Third-party exercise — 1 clauses, 4 fields

One clause carrying four questions, including a percentage split.

* **§12.2** 3rd Party Exercise — `standalone`

### Exception pairs in The Horse — 4 clauses, 4 fields

Yes/no questions and the free-text boxes they reveal. The warranties themselves (§3.6, §3.8) are separate clauses.

* **§3.4** Are there any ownership related leasing restrictions? … — `DEPENDED-UPON`
* **§3.5** Ownership related leasing restrictions: … — `standalone`
* **§3.7** The Lessor notes the following known exceptions to … — `standalone`
* **§3.9** The Lessor notes the following known exceptions to … — `standalone`

## Clauses reached only through a narrow door

Ranked by how many separate answers must line up before the clause appears. A clause behind three
conditions prints in a small fraction of leases; that says nothing about whether it should stay.

| # | Clause | Conditions | Prints only when |
|---|---|---:|---|
| §13.5 | The deductible shall be split between … | 4 | “General liability insurance is not required for or by either party under this Agreement.” is “NO” or left blank and “Deductible responsibility (Lessee-responsibility claims)” is “Split” and “Lessor” is “Has and will maintain” or “Will obtain and will maintain”; or “Lessee” is “Has and will maintain” or “Will obtain and will maintain” |
| §13.11 | The deductible shall be split between … | 4 | “Mortality insurance is not required for or by either party under this Agreement.” is “NO” or left blank and “Deductible responsibility” is “Split” and “Lessor” is “Has and will maintain” or “Will obtain and will maintain”; or “Lessee” is “Has and will maintain” or “Will obtain and will maintain” |
| §13.19 | The deductible shall be split between … | 4 | “Medical insurance is not required for or by either party under this Agreement.” is “NO” or left blank and “Deductible responsibility” is “Split” and “Lessor” is “Has and will maintain” or “Will obtain and will maintain”; or “Lessee” is “Has and will maintain” or “Will obtain and will maintain” |
| §9.2 | Evaluation Period Details | 3 | “Evaluation period” is “Requested by Lessee” or “Required by Lessor” and “Evaluation period” is “Included within the lease term” and “Length” is 1 or more |
| §9.3 | Evaluation Period Details | 3 | “Evaluation period” is “Requested by Lessee” or “Required by Lessor” and “Evaluation period” is “Fixed evaluation period before the term” and “Length” is 1 or more |
| §13.4 | If a claim is made under … | 3 | “General liability insurance is not required for or by either party under this Agreement.” is “NO” or left blank and “Lessor” is “Has and will maintain” or “Will obtain and will maintain”; or “Lessee” is “Has and will maintain” or “Will obtain and will maintain” |
| §13.10 | If a claim is made under … | 3 | “Mortality insurance is not required for or by either party under this Agreement.” is “NO” or left blank and “Lessor” is “Has and will maintain” or “Will obtain and will maintain”; or “Lessee” is “Has and will maintain” or “Will obtain and will maintain” |
| §13.18 | If a claim is made under … | 3 | “Medical insurance is not required for or by either party under this Agreement.” is “NO” or left blank and “Lessor” is “Has and will maintain” or “Will obtain and will maintain”; or “Lessee” is “Has and will maintain” or “Will obtain and will maintain” |
| §11.3 | Lessons | 2 | “Lessee is an” is left blank and “Permitted activities” includes “Riding Lessons” |
| §11.4 | Lessons — Continuous Enrollment | 2 | “Lessee is an” is “Individual” and “Permitted activities” includes “Riding Lessons” |
| §11.5 | Lessons — Lessee's Instruction Program | 2 | “Lessee is an” is “Entity / organization” and “Permitted activities” includes “Riding Lessons” |
| §11.9 | Competitions are restricted as follows: … | 2 | “Permitted activities” includes “Competitions” and “Check this box to include restrictions for competitions” is “YES” |
| §11.10 | Lessor does not restrict competition activity … | 2 | “Permitted activities” includes “Competitions” and “Check this box to include restrictions for competitions” is “NO” or left blank |
| §11.12 | Jumping is restricted as follows: maximum … | 2 | “Permitted activities” includes “Jumping” and “Check this box to include restrictions for jumping” is “YES” |
| §11.13 | Lessor does not restrict jumping activity … | 2 | “Permitted activities” includes “Jumping” and “Check this box to include restrictions for jumping” is “NO” or left blank |
| §11.15 | Trail riding is restricted as follows: … | 2 | “Permitted activities” includes “Trail Riding” and “Check this box to include restrictions for trail riding” is “YES” |
| §11.16 | Lessor does not restrict trail-riding activity … | 2 | “Permitted activities” includes “Trail Riding” and “Check this box to include restrictions for trail riding” is “NO” or left blank |
| §13.22 | Coordination of Coverage | 2 | “Mortality insurance is not required for or by either party under this Agreement.” is “NO” or left blank and “Lessee is an” is “Entity / organization” |

## Clauses nothing else reads

46 of 144 clauses have no other clause, no gate, no token and no prose reference
pointing at them, and none of them was classified as protective.

**This is a statement about wiring, not about worth.** It means only that cutting one will not
silently change what prints elsewhere. Several still carry a rule someone relies on — §7.1 is the
right of offset, §11.6 requires an approved trainer for all training, §5.3 requires schedule changes
to be in writing. Each still has to be read and decided on its own terms.

| # | Clause | Fields released |
|---|---|---:|
| §2.1 | [Pending — select whether Lessor is an individual … | 0 |
| §2.4 | [Pending — select whether Lessee is an individual … | 0 |
| §3.5 | Ownership related leasing restrictions: … | 1 |
| §3.7 | The Lessor notes the following known exceptions to … | 1 |
| §3.9 | The Lessor notes the following known exceptions to … | 1 |
| §3.10 | Serious Injury History | 0 |
| §3.13 | Pre-Lease Veterinary Examination | 1 |
| §3.14 | Pre-Lease Trainer Evaluation | 1 |
| §3.17 | Location during lease term: … | 1 |
| §4.1 | Purpose of Agreement | 0 |
| §5.2 | Additional or custom schedule terms: … | 1 |
| §5.3 | Schedule Changes | 0 |
| §7.1 | Right of Offset | 0 |
| §8.2 | Credit card payments are processed as follows: … | 1 |
| §8.4 | Credit card payments are processed as follows: … | 1 |
| §9.2 | Evaluation Period Details | 2 |
| §9.3 | Evaluation Period Details | 3 |
| §9.4 | No evaluation period applies to this Agreement. The … | 0 |
| §9.5 | No evaluation period applies to this Agreement. The … | 0 |
| §10.2 | This Agreement continues until … | 1 |
| §10.3 | Renewal Terms | 2 |
| §10.4 | Additional terms: … | 1 |
| §10.5 | Notwithstanding the term stated above, this Agreement may … | 0 |
| §11.3 | Lessons | 0 |
| §11.4 | Lessons — Continuous Enrollment | 1 |
| §11.5 | Lessons — Lessee's Instruction Program | 1 |
| §11.6 | Training | 0 |
| §11.7 | Competition Costs and Winnings | 2 |
| §11.10 | Lessor does not restrict competition activity in any … | 0 |
| §11.12 | Jumping is restricted as follows: maximum height …; … | 3 |
| §11.13 | Lessor does not restrict jumping activity in any … | 0 |
| §11.15 | Trail riding is restricted as follows: … | 1 |
| §11.16 | Lessor does not restrict trail-riding activity in any … | 0 |
| §11.17 | Additional Restrictions | 1 |
| §11.19 | Other Allowed Activities | 0 |
| §11.20 | Other additional permitted activity: … | 1 |
| §11.22 | Other persons allowed to ride or handle the … | 1 |
| §11.24 | Transport of the Horse | 1 |
| §12.2 | 3rd Party Exercise | 4 |
| §12.4 | … | 1 |
| §12.11 | Other prohibited rider aid: … | 1 |
| §13.5 | The deductible shall be split between the parties: … | 2 |
| §13.11 | The deductible shall be split between the parties: … | 2 |
| §13.19 | The deductible shall be split between the parties: … | 2 |
| §15.4 | Changes in Contact Information | 0 |
| §21.1 | Lessee's Representations | 0 |

## Two things found while reading

Neither is a keep/cut question. Both are recorded because they were noticed.

* **`TXN.MONTHLY_START` (“First monthly payment date”) is already orphaned.** It is attached to a
  clause `LEASE_FEE.PAYMENTS` that does not exist in this template, so it is one of the 117 fields
  but appears in no clause. It is inherited from `HORSE_LEASE_V2`, where it is orphaned too.
* **“French Heritage Equestrian Approved Trainer” and “Approved Instructor” are used but never
  defined.** The terms appear in §11.2, §11.4, §11.6 and §12.2. There is no clause anywhere in the
  lease that says what approval means or who grants it.
