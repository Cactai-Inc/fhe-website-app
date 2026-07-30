# HORSE_LEASE_V2 Hardening Changes

Target: live lease template `start_lease_contract_v2` (Sections › Clauses › Fields model). All changes are keyed to existing `[KEY]` identifiers from the structured export. Apply as a migration/seed update to the template authoring model. No UI changes required; all changes are clause bodies, one new clause with a conditional pair, and one new definitions clause. Do not renumber or alter any clause_key not listed here.

Scope of intent: (1) add party-group definitions so releases and indemnities protect the individuals behind either party without naming them; (2) bind Lessee's heirs/estate/assigns to the releases; (3) add the gross negligence / reckless / intentional misconduct carve-out to the release per the FHE liability language standard; (4) trim the unenforceable absolute-bar tail from the attire clause while keeping revocation and material breach; (5) add a mutual limitation of liability with a shared cap anchored to the mortality insurance limit, FMV fallback, and insurance-proceeds offset; (6) thread the party groups through the assumption, indemnification, and Lessee representations clauses; (7) add a third-party beneficiary clause so non-signatory individuals can enforce the protections directly.

## CHANGE 1 — ADD new clause INSURANCE_RISK.DEFINITIONS

Placement: first clause in section [INSURANCE_RISK], sort_order below INSURANCE_RISK.INSURANCE (insert with a sort_order that positions it immediately before INSURANCE_RISK.INSURANCE; resequence only if required by the model). clause_type: prose. is_optional: false. conditional_on: null. Heading: "Definitions; Binding Effect; Third-Party Beneficiaries".

Body:

"Lessor Parties" means Lessor and, as applicable, Lessor's owners, principals, proprietors, partners, employees, trainers, instructors, agents, contractors, and family members of any of the foregoing, and each of their respective heirs and assigns. "Lessee Parties" means Lessee and Lessee's heirs, next of kin, estate, executors, administrators, legal representatives, and assigns. Lessee enters into this Agreement on behalf of Lessee and all Lessee Parties, and all releases, waivers, assumptions of risk, and covenants made by Lessee under this Agreement are made on behalf of all Lessee Parties and bind each of them to the same extent as Lessee. Each Lessor Party and each Lessee Party is an intended third-party beneficiary of the releases, waivers, assumptions of risk, and limitations of liability in this Agreement and may enforce them directly.

## CHANGE 2 — REPLACE body of INSURANCE_RISK.ASSUMPTION_INHERENT

Heading unchanged. Replace body with:

Lessee understands that horseback riding and handling horses are inherently dangerous activities. Lessee acknowledges that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. Lessee acknowledges the California common law doctrine of "Primary Assumption of Risk," as established by the California Supreme Court in Knight v. Jewett (1992) 3 Cal.4th 296 and subsequent equine-specific case law (e.g., Levinson v. Owens (2009) 176 Cal.App.4th 1534). Pursuant to this binding legal precedent, Lessee, on behalf of all Lessee Parties, expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that no Lessor Party owes a duty to protect Lessee from these inherent risks.

## CHANGE 3 — REPLACE body of INSURANCE_RISK.RELEASE

Heading unchanged ("Release of Liability"). Replace body with:

In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and all Lessee Parties, completely releases, forever discharges, and agrees to hold harmless the Lessor Parties from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee's use, handling, or riding of the Horse, whether caused by the ordinary negligence of any Lessor Party or otherwise. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

## CHANGE 4 — REPLACE body of INSURANCE_RISK.SAFETY_ATTIRE

Heading unchanged ("Required Protective Attire"). Replace body with:

Lessee is strictly required to wear an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Lessee shall provide Lessee's own helmet, boots, and pants meeting these requirements. Lessee, on behalf of all Lessee Parties, assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes Lessee's permission to ride or handle the Horse and constitutes a material breach of this Agreement.

Rationale (do not include in clause): removes the deemed-negligence and absolute claim-bar tail, which risked blue-penciling and conflicted with the FHE liability language standard. Revocation and material breach are retained; the release in INSURANCE_RISK.RELEASE already covers the liability consequence.

## CHANGE 5 — ADD new clause pair INSURANCE_RISK.LIMITATION_MORTALITY and INSURANCE_RISK.LIMITATION_FMV

Placement: immediately after INSURANCE_RISK.INDEMNIFICATION, before section [TERMINATION]. clause_type: prose. Exactly one of the two renders per instrument via conditional_on:

- INSURANCE_RISK.LIMITATION_MORTALITY renders when TXN.MORTALITY_INSURANCE_REQ = YES.
- INSURANCE_RISK.LIMITATION_FMV renders when TXN.MORTALITY_INSURANCE_REQ = NO (or unset).

Both carry heading "Limitation of Liability".

Body for INSURANCE_RISK.LIMITATION_MORTALITY:

Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the mortality insurance minimum limit of {{TXN.MORTALITY_MIN_LIMIT}}. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.

Body for INSURANCE_RISK.LIMITATION_FMV:

Under no circumstances shall either party be liable to the other for any special, consequential, incidental, or punitive damages arising out of or relating to this Agreement. The total aggregate liability of either party (including, respectively, the Lessor Parties and the Lessee Parties) to the other under this Agreement shall not exceed the Horse's current fair market value of {{HORSE.FAIR_MARKET_VALUE}}. Any amount owed by one party to the other under this Agreement shall be reduced by the amount of any insurance proceeds actually received by the party owed with respect to the same loss. This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.

Implementation note: follow the existing conditional pair pattern (e.g., RESTRICT.JUMP_ON / RESTRICT.JUMP_OFF) for the conditional_on wiring. No new fields are required; both anchors are existing fields.

## CHANGE 6 — REPLACE body of INSURANCE_RISK.INDEMNIFICATION

Heading unchanged ("Mutual Indemnification"). Replace body with:

Each party shall indemnify, defend, and hold harmless the other party and, respectively, the Lessor Parties or the Lessee Parties, from and against any and all claims, damages, losses, liabilities, costs, and expenses arising out of the indemnifying party's use, handling, care, or possession of the Horse, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.

Rationale (do not include in clause): claims arising from horse-related activity routinely name individuals (trainer, instructor, principal) rather than or in addition to the contracting party; extending the indemnified class to the party groups puts those claims inside the defense obligation. "Reckless conduct" added to the carve-out to match the FHE liability language standard used elsewhere.

## CHANGE 7 — REPLACE body of INSURANCE_RISK.WAIVER_UNKNOWN

Heading unchanged ("Waiver of Unknown Claims"). Replace body with:

Each party, on behalf of itself and, respectively, the Lessor Parties or the Lessee Parties, expressly waives any and all claims against the other party and its respective party group that the waiving party does not know or suspect to exist at the time of this Agreement, and acknowledges that this waiver is a material term of this Agreement. Each party assumes the risk that claims presently unknown to it may later be discovered.

## CHANGE 8 — REPLACE body of LESSEE_REPS.MAIN

Heading unchanged ("Lessee's Representations"). Replace body with:

Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into this Agreement; that Lessee has no physical or mental condition that would prevent Lessee from safely participating in the activities contemplated by this Agreement; and that Lessee has the requisite knowledge and experience to handle and ride the Horse, and will use reasonable care in doing so and follow Lessor's instructions. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.

## VERIFICATION CHECKLIST

1. Render a partial-lease instrument with mortality insurance required: confirm INSURANCE_RISK.DEFINITIONS renders first in the section, LIMITATION_MORTALITY renders with the mortality limit token filled, LIMITATION_FMV does not render.
2. Render an instrument with mortality insurance not required: confirm LIMITATION_FMV renders with FMV token filled, LIMITATION_MORTALITY does not render.
3. Confirm "Lessor Parties" and "Lessee Parties" appear in ASSUMPTION_INHERENT, RELEASE, SAFETY_ATTIRE, WAIVER_UNKNOWN, INDEMNIFICATION, and LESSEE_REPS.MAIN in the rendered PDF.
4. Confirm SAFETY_ATTIRE no longer contains "deemed rider negligence" or "no claim may be brought" language.
5. Confirm RELEASE ends with the gross negligence / reckless conduct / intentional misconduct carve-out sentence.
6. Confirm no other clause bodies changed; diff rendered output against a pre-change render to verify the change surface is limited to the eight items above.
7. Strip-unfilled-at-lock: confirm the new LIMITATION clauses are treated as core prose (never stripped) since their tokens are always filled when the clause renders.
