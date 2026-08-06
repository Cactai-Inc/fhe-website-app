# Insurance obligations — build spec

**Status: SPEC. Ready to build once §6 is answered.**
Owner's legal research (2026-08-06) plus counsel validation, translated into the
controls the contract engine must enforce.

**Scope bar, set by the owner:** *"We don't need to cover every edge case and potential
event. We need sufficient controls to prevent illegal selections and sufficient clauses
to enable the parties to obligate basics to themselves and each other."*

That yields **six blocks** and **seven clause groups**. Everything else stays freely
selectable with sensible defaults.

---

## 0. Three states, not five

Counsel proposed adding *Conditionally Mandatory* and *Permitted via Endorsement*.
Recommendation: **stay at three.** Both are already expressible, and each extra state
multiplies the interface and the test surface.

- *Conditionally mandatory* is not a separate state. Every state here is evaluated
  **per lease** against that lease's facts — MANDATORY never means "always", it means
  "mandatory given this lease type, these party types, this insurable interest." Lessee
  GL is already mandatory *when* off-site is granted or the lessee is an entity.
- *Permitted via endorsement* is a PERMITTED election with a requirement attached — name
  the endorsement in the clause, capture the COI. It does not prevent an illegal
  selection, so it is not a gate.

| State | Behaviour |
|---|---|
| **MANDATORY** | Forced on; cannot be elected away |
| **PERMITTED** | Normal selectable control |
| **PROHIBITED** | **Shown and blocked, with the reason displayed** — never silently hidden |

Blocked-not-hidden is deliberate: a Lessor who simply cannot see an option never learns
why, and meets it again on the next lease with no explanation. Same principle as the
ownership tooltips shipped 2026-08-06.

**This is the architectural change.** The engine gates *visibility* today
(`conditional_on` decides whether a field renders). PROHIBITED requires gating
*legality* — an election that is visible, explained, and refused.

---

## 1. The six blocks

**CORRECTION (2026-08-06).** An earlier draft of this document claimed
`INSURANCE_RISK.CCC` was unconditional and therefore obligated every individual lessee
to buy a product they cannot purchase. **That was wrong.** The clause is gated
`{"equals":["ENTITY"],"field_key":"LESSEE.PARTY_TYPE"}` and prints only for entity
lessees. The error came from reading the clause body without reading its
`conditional_on` and inferring "ungated" because no *fields* pointed at it. B3/B4 below
are therefore already satisfied at the clause level; what is missing is the *election*
block, not the clause gate.

The template is substantially better built than that draft implied — see §1a before
scoping any work.

The complete set of illegal selections the engine must prevent. Blocking text is
counsel's, shown verbatim.

| # | Condition | Blocked election | Message |
|---|---|---|---|
| B1 | `LEASE_TYPE = PARTIAL` | Lessor requiring Lessee to carry **mortality** | *Prohibited: Underwriting guidelines prevent partial lessees from establishing a sole insurable interest for third-party mortality placement.* |
| B2 | `LEASE_TYPE = PARTIAL` | Lessee **holding** mortality | as B1 |
| B3 | `LESSEE.PARTY_TYPE = INDIVIDUAL` | Lessor requiring Lessee to carry **CCC** | *Prohibited: Care, Custody, and Control is a commercial liability product unavailable to individual consumers.* |
| B4 | `LESSEE.PARTY_TYPE = INDIVIDUAL` | Lessee **holding** CCC | as B3 |
| B5 | `LESSOR_INSURABLE_INTEREST = NONE` | Lessor holding **mortality _or_ medical** | *Prohibited: Without a direct pecuniary interest in the Horse (Cal. Ins. Code §§ 281–284), the Lessor cannot lawfully insure it.* |
| B6 | `LESSEE.PARTY_TYPE = INDIVIDUAL` | **Commercial GL** offered as the required Lessee policy type | Option removed; individuals may only be required to carry Personal Horse Owner's / Private Horse Rider's liability. |

B1–B4 are carrier practice rather than statute, but absolute in execution, so the engine
treats them as hard blocks. B5 is statutory.

### Already satisfied

| Block | Status |
|---|---|
| B3 / B4 (CCC for individuals) | **Already gated** — the CCC clause prints only for `LESSEE.PARTY_TYPE = ENTITY`. Remaining gap is that no *election control* is blocked, only the clause suppressed. |
| B1 / B2 (partial-lease mortality) | **Not implemented.** Nothing prevents it. |
| B5 (insurable interest) | **Not implementable yet** — the driving field does not exist. |
| B6 (commercial GL to individuals) | **Not implemented.** |

---

## 1a. What already works — verified against the live template

Before scoping any build, note that `HORSE_LEASE_V2` carries 35 insurance clauses and
handles the common configurations today:

- **"Lessor carries everything and accepts the risk."** `INSURANCE_RISK.RISK_OF_LOSS`
  always prints: *"Lessor assumes all risk of loss of or injury to the Horse during the
  term of this Agreement, except to the extent caused by Lessee's gross negligence,
  reckless conduct…"*
- **"No insurance at all."** Each `*_NOT_REQUIRED` election prints an affirmative
  acceptance rather than falling silent — `GL_NONE`, `MED_NONE`, `MORT_NONE` each state
  that the Lessor accepts full risk and responsibility for that category.
- **Mutual releases** (`RELEASE`, `RELEASE_LESSOR`, `WAIVER_UNKNOWN`) and a
  **loss-of-use acknowledgement** always print.
- **Activity-specific risk disclosures** gate on `TXN.PERMITTED_ACTIVITIES` — jumping,
  competition, shared arena, trail.
- **Out-of-pocket allocation** exists as `MED_TAIL`.

### Real gaps that remain

1. `MED_TAIL` — the only out-of-pocket allocation clause — is gated on
   `MED_NOT_REQUIRED = NO`. So a lease that **waives** medical has no allocation clause
   for out-of-pocket cost at all. That is the no-fault gap, and it bites precisely in the
   simplest configuration.
2. The three field defects in §3 (split percentages, `Other`, jump height).
3. B1/B2, B5, B6 have no enforcement.

---

## 2. Mandatory elections

| Condition | Becomes MANDATORY |
|---|---|
| `LESSOR.PARTY_TYPE = ENTITY` | Lessor carries **CGL** with an Equestrian Professional Liability endorsement |
| `LESSOR.PARTY_TYPE = ENTITY` | Lessor carries **CCC** — a program working horses it does not own must answer owner claims |
| `OFFSITE_TRANSPORT = GRANTED` **or** `LESSEE.PARTY_TYPE = ENTITY` | Lessee carries **GL** |
| Lessee carries GL at all | Lessor **and facility owner** named Additional Insured; **Waiver of Subrogation** endorsement; COI within 5 days |
| **High-Value Asset** (below) | Lessor carries **major medical** |
| `PRIMARY_LEASE_REQUIRES_MORTALITY = yes` **or** insurable interest `= OWNER` | Lessor carries **mortality** |

### High-Value Asset matrix — any single trigger

| Trigger | Threshold |
|---|---|
| Agreed value | `TXN.HORSE_AGREED_VALUE ≥ $25,000` |
| Jumping | `TXN.JUMP_MAX_HEIGHT ≥ 0.90 m` (~3 ft) |
| Competition | `TXN.COMPETITION_USE = true` (rated / A-circuit) |

---

## 3. Driving variables

### Live and usable

`TXN.LEASE_TYPE` · `LESSOR.PARTY_TYPE` · `LESSEE.PARTY_TYPE` · `TXN.OFFSITE_TRANSPORT`

### Must be added

| # | Field | Values | Purpose |
|---|---|---|---|
| V1 | `TXN.LESSOR_INSURABLE_INTEREST` | `OWNER` / `PRIMARY_LEASE_LIABILITY` / `RECOUPABLE_INVESTMENT` / `NONE` | Drives B5. Counsel's test is **direct pecuniary loss**, not a label — so the options encode the two qualifying paths: the upstream lease makes FHE financially liable for the horse's value, or FHE holds verifiable training investment that death destroys. A bare "leaseholder" does **not** qualify. |
| V2 | `TXN.PRIMARY_LEASE_REQUIRES_MORTALITY` | yes / no | Upstream obligation flows down as MANDATORY |
| V3 | `TXN.HORSE_AGREED_VALUE` | currency | High-value trigger; mortality shortfall |
| V4 | `TXN.COMPETITION_USE` | yes / no | High-value trigger. **Does not exist** — the two live `COMPETITION_*` fields allocate expenses and winnings; neither states whether the horse competes. |
| V5 | `TXN.HORSE_IN_LESSON_PROGRAM` | yes / no | Blocks a partial Lessee from holding medical where multiple students ride |

### Must be repaired before the matrix can evaluate

- **`TXN.JUMP_MAX_HEIGHT` is free text.** "3 feet", "90cm", "about 3'" and "3'0\"" all
  parse differently, so `≥ 0.90 m` cannot be evaluated. Convert to **number + unit
  select**, migrating existing values.
- **All six deductible split-percentage fields have no `format_type` and are not
  required** — a lease can execute electing "Split" with no split defined, and nothing
  validates the halves total 100.
- **`Other` on the three `DED_RESP` selects has no follow-up field**, so a contract can
  execute saying responsibility is "Other" with nothing capturing what that means. Every
  other `Other` in the template has a text follow-up.

---

## 4. The seven clause groups

What the parties must be able to obligate. Each is an election plus its contract text.

1. **General liability** — who carries; limit; policy type (constrained by B6);
   Additional Insured + **Waiver of Subrogation** + COI where the Lessee carries. Without
   the waiver the Lessee's carrier can pay its insured and then sue FHE to recover, which
   defeats the point of being named at all.
2. **Mortality** — who carries; carrier; agreed value; Loss Payee where the Lessee pays
   the premium on the Lessor's policy; deductible and payout-shortfall allocation.
3. **Major medical** — who carries; limit and deductible; **who makes the initial
   payment** (§5); emergency authorisation limit and who bears the non-reimbursed part.
4. **CCC** — who carries; limits; **excluded entirely where the Lessee is an
   individual**; never presented as protection for the horse (§5).
5. **No-fault expense allocation** — *does not exist today, and is the most consequential
   omission.* Specified in full at §4a.
6. **Fault override** — a clause, not an election. Loss caused by the Lessee's clear
   breach (jumping above the agreed height, gate left unlatched) allocates **100% of the
   deductible and non-covered cost to the Lessee**, overriding group 5.
7. **Disclosures** — §5. Generated, not optional.

---

## 4a. The no-fault expense matrix — full field spec

**The scenario nothing in the contract currently answers.** A horse is injured or falls
ill. Nobody was negligent. Either no policy responds at all, or one responds partially
(deductible, exclusion, limit exceeded, claim denied). Someone still owes the vet, and
today the document is silent.

Distinguish this from the existing per-policy deductible fields:

| | Existing `*_DED_RESP` | New no-fault matrix |
|---|---|---|
| Applies when | A policy **does** respond | Insurance **does not** cover it |
| Scope | Per insurance type | One allocation across all veterinary cost |

Kept as **one global allocation**, not one per insurance type: "who pays when insurance
doesn't" does not meaningfully differ by which policy would have applied, and per-type
duplication triples the interface for no gain. (Per the owner's scope bar.)

### Field definitions

| field_key | owner | format | required | label |
|---|---|---|---|---|
| `TXN.NOFAULT_PAYER` | DEAL | select | yes | Who pays the veterinary provider at time of service |
| `TXN.NOFAULT_ALLOCATION` | DEAL | select | yes | Final responsibility for cost not covered by insurance |
| `TXN.NOFAULT_SPLIT_LESSEE` | DEAL | number | when SPLIT | Percent borne by Lessee |
| `TXN.NOFAULT_SPLIT_LESSOR` | DEAL | number | when SPLIT | Percent borne by Lessor |
| `TXN.NOFAULT_OTHER` | DEAL | text | when OTHER | Describe the agreed allocation |
| `TXN.NOFAULT_CONSULT_THRESHOLD` | DEAL | currency | no | Consult the other party before incurring non-emergency cost above |
| `TXN.NOFAULT_RECONCILE_DAYS` | DEAL | number | yes | Days to settle the balance after any reimbursement |

`owner_role = DEAL` throughout: these obligate **both** parties, so neither may set them
unilaterally — the same shared-ownership treatment `TXN.LEASE_PURPOSE` already uses.

**Options**

- `NOFAULT_PAYER`: `LESSOR` / `LESSEE` / `POLICYHOLDER` (whichever party holds the
  policy that would respond). Defaults to `POLICYHOLDER`, because §5's payment flow
  requires the named policyholder to pay the hospital directly in order to claim.
- `NOFAULT_ALLOCATION`: `100_LESSEE` / `100_LESSOR` / `SPLIT` / `OTHER`.
  Defaults: `LEASE_TYPE = FULL` → `100_LESSEE`; `PARTIAL` → `SPLIT` at 50/50.

**Gates**

- `SPLIT_LESSEE` / `SPLIT_LESSOR`: `conditional_on` `NOFAULT_ALLOCATION = SPLIT`;
  **both required when shown**, and validated to total exactly 100. (The existing split
  fields fail on all three counts — see §3.)
- `NOFAULT_OTHER`: `conditional_on` `NOFAULT_ALLOCATION = OTHER`; **required when shown**.

**Precedence, stated in the clause body**

1. Group 6 **fault override** supersedes this entirely — a loss from the Lessee's clear
   breach allocates 100% to the Lessee regardless of what is elected here.
2. Otherwise: the `NOFAULT_PAYER` pays the provider, files any claim, receives any
   reimbursement, and the **net** cost is then allocated per `NOFAULT_ALLOCATION`,
   settled within `NOFAULT_RECONCILE_DAYS`.
3. The emergency authorisation limit (group 3) governs **urgency** — the authority to
   incur cost without reaching the other party. This matrix governs **who ultimately
   bears** it. Two different questions; the clause must not conflate them.

---

## 5. What CCC actually does — binding on the build

CCC is **liability** cover, not property cover. It responds only where the policyholder
is found **legally negligent**:

1. A horse is injured in FHE's care.
2. For FHE's CCC to pay the owner, **FHE must be found negligent**.
3. The carrier has every incentive to dispute that finding.
4. The only party positioned to insist FHE *was* negligent is **the horse's owner** —
   FHE's own client — who must press a claim against FHE to be paid.
5. Liability policies bar the insured from **voluntarily admitting liability**.
6. They further impose a **duty to cooperate**: the insured must assist the carrier in
   investigating and **defending** the claim, breach being a ground to deny coverage.

So FHE is contractually obliged to help defeat its own client's claim. CCC is not a
backstop for the horse — it protects FHE's balance sheet *from* the owner, by a
mechanism adversarial to the relationship the business runs on.

**Consequences, binding:**

- No clause, label or helper text may present CCC as protection for the horse. What
  protects the animal is the owner's own mortality / major-medical cover.
- Non-covered costs must **never** route to CCC as a fallback layer.
- **Disclose the adversarial structure in the lease.** An owner who discovers mid-claim
  that FHE is assisting the carrier against them does not stay a client. Saying it at
  signing is fairer and safer — and it is the honest argument for the owner carrying
  their own cover, which pays them without anyone establishing fault.

### Generated disclosures

1. ~~Cal. Civ. Code § 3333.7 equine liability warning~~ — **STRUCK. Do not implement.**
   Verified 2026-08-06 against the statute and against equine-law sources: **§ 3333.7
   concerns treble damages against commercial motor-vehicle employers whose drivers were
   under the influence.** It has nothing to do with horses. **California has no Equine
   Activity Liability Act** — it is one of a small number of states that never enacted
   one. Protection rests on the common-law doctrine of **primary assumption of risk**,
   which must be established by an express, detailed written release.

   **The template already does this correctly** and needs no change:
   `ASSUMPTION_INHERENT` (always prints) recites the unpredictable-horse risks;
   `RELEASE` / `RELEASE_LESSOR` are mutual express releases; `JUMPING_RISKS`,
   `COMPETITION_RISKS`, `SHARED_ARENA_RISKS` and `TRAIL_RIDING` gate on
   `TXN.PERMITTED_ACTIVITIES`; `WAIVER_UNKNOWN` carries the **Civil Code § 1542** waiver
   of unknown claims — the real California statute here, cited in three clauses. There
   are zero references to § 3333.7 in the template, so the bad citation was never
   introduced.

   *Lesson recorded:* this citation was supplied confidently by an AI research assistant,
   then retracted by the same assistant. Statutory citations going into signed
   instruments get verified independently before they are built.
2. **No shared policy** — an Additional Insured gains third-party liability protection
   but **no** first-party medical or mortality cover on the horse.
3. **CCC negligence trigger** — plain-language statement of the above.
4. **Cal. UCC § 10210** — true lease of personal property; risk of loss governed by the
   elections herein.

### Payment flow (contract text, group 3)

The named primary policyholder **must make the initial payment** to the veterinary
hospital — hospitals require payment at time of service and do not bill carriers. The
policyholder files the claim, receives reimbursement, then reconciles the out-of-pocket
balance per the elections.

---

## 6. Still open — needed before build

Counsel settled the blocks, the high-value matrix and insurable interest. Outstanding:

1. **Emergency authorisation limit** — is $5,000 the default, and who bears the
   non-reimbursed portion where the lease is silent?
2. **Staff carve-out** (internal, not legal). Staff currently cannot fill a
   counterparty's insurance elections; the code comment justifying it assumes FHE is
   always the Lessor, which is false on reverse leases. Should staff record elections on
   a party's behalf, mirroring barn-office wet-signing? *Open since A-PARTY-VERIFY-2.*
3. **Assisted leases** — where FHE drafts for two clients and is neither party, do any
   obligations attach to FHE as drafter, and what disclaimer should carry?
4. **First-party alternative** — does an equine **bailee** / "horses in your care,
   custody or control" **property** form exist that pays regardless of fault? If so, that
   — not the liability CCC — is what protects client relationships. *Broker question.*
5. **Disclosure wording** for the duty-to-cooperate statement, and whether disclosing it
   carries risk.

---

## 7. Build sequencing

1. Repair the three field defects in §3 (jump height, split percentages, `Other`). These
   are wrong today regardless of everything else.
2. Add V1–V5.
3. Add the PROHIBITED capability to the engine (visible + explained + refused), then wire
   B1–B6.
4. Rebuild the four insurance sections around clause groups 1–4.
5. Build group 5 (no-fault allocation) and group 6 (fault override).
6. Add the four generated disclosures.

Steps 1–2 are safe to start before §6 is answered. Step 3 is the architectural change and
should be its own task.

---

## 8. Rejected approach — on record

Counsel supplied a full code implementation (2026-08-06): a standalone
`EquineLeaseEngine.ts` class, a bespoke Tailwind form, a vanilla-JS controller, and a
`ContractAssembler` emitting clause text from JS template strings. **Not adopted**, for
reasons that will recur if it is proposed again:

- **Wrong architecture.** Our engine is DB-driven — fields, clauses and gates are rows,
  authored in the authoring engine and versioned with the template. Hardcoding insurance
  rules in application code creates a second parallel contract system: the only clauses
  not editable by staff, not versioned, not rendered like the rest. This is the
  shadow-catalog pattern already killed once in this codebase.
- **Did not compile.** `export type LeaseType = 'FULL' / 'PARTIAL'` — a slash where a
  union pipe belongs, repeated across all three type declarations.
- **Contradicted its own legal analysis.** `evalMedicalLessor` prohibits unless interest
  is `OWNER`, though the same author established primary-lease liability and recoupable
  investment as valid insurable interests — it would block a lawful election in FHE's
  most common configuration.
- **Display bug:** the mortality block renders `mort.lessor.reason` when blocking the
  *Lessee*.
- **Paraphrased the statutory warning**, which must be verbatim.

The *legal determinations* from that same source are sound and are incorporated above.
It is the implementation that is unusable.
