# Scenario walkthroughs — what actually prints

Nine configurations — five scenarios and four variants — traced to the printed
text, in order.

**How these were produced.** Which clauses survive the gates was computed by
calling the live database's own evaluator, `clause_condition_met`, with each
scenario's field values — the same function `remerge_contract_from_clauses` calls
when it composes a document. How the surviving clauses turn into text (numbering,
which lines are dropped, where a sub-item is glued on, how a coded value becomes
a word) follows `remerge_contract_from_clauses` itself, and was checked against a
real composed document — draft `215bac09`, whose insurance answers are all blank.
No document was written to.

## The four things that most surprised me here

1. **Nothing in the insurance form can change the risk allocation.** In all nine
   configurations, including the one where the Lessee has taken on mortality and
   medical cover at their own cost, the document still says *"Lessor assumes all
   risk of loss of or injury to the Horse."* That clause has no gate.
2. **Waiving medical cover deletes the reimbursement mechanics.** `MED_TAIL` — the
   only paragraph that explains who pays what out of pocket and who absorbs an
   uncovered loss — prints when medical cover is required and disappears when it
   is waived. Scenario 2, where the Lessor has taken on every cost, is exactly the
   configuration where the paragraph describing how costs are handled vanishes.
3. **Scenario 4 is confirmed: the contract can express nothing coherent.** All
   four available paths either state something untrue, impose an impossible
   obligation, or abandon the requirement. Detail below.
4. **A blank status does not blank the sentence.** It prints the sentence with a
   gap in it, and the resulting line reads as an affirmative covenant. This is not
   theoretical — it is what draft `215bac09` says today.

Section numbering below assumes a partial lease where every other section
renders; the insurance section lands at **12**. In a full lease the SCHEDULE
section is empty, takes no number, and everything after it shifts down by one —
so scenario 3 shows **11**.

---

## Scenario 1 — Partial lease · Lessor carries everything · individual both sides

**Set:** lease type Partial · Lessor and Lessee both Individual · activities
Riding Lessons + Solo Arena Riding · Horse fair market value $25,000.00 · all
three "not required" boxes unticked · Lessor *Has and will maintain* for all
three covers · Lessee *Does not have and will not obtain* for all three ·
deductible responsibility Lessor for all three.

> **12. INSURANCE, RISK OF LOSS, AND INDEMNIFICATION**
>
> **12.1 Insurance Requirements**
> The parties agree to the insurance elections set forth below. Each policy elected or required below shall be maintained in effect for the duration of this Agreement.
>
> **12.2 General Liability Insurance**
> Lessor: Has and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement.
> Lessee: Does not have and will not obtain general liability insurance covering the Horse and the activities contemplated by this Agreement.
> If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: Lessor.
>
> **12.3 Mortality Insurance**
> Lessor: Has and will maintain mortality insurance on the Horse.
> Lessee: Does not have and will not obtain mortality insurance on the Horse.
> If a claim is made under any such policy … shall be borne by: Lessor.
>
> **12.4 Medical Insurance**
> Lessor: Has and will maintain medical insurance on the Horse.
> Lessee: Does not have and will not obtain medical insurance on the Horse.
> If a claim is made under any such policy … shall be borne by: Lessor. Any out-of-pocket costs for deductibles or other expenses related to the needs of the Horse are to be paid by Lessor, and where Lessee is deemed to be responsible for part or all of a cost paid by Lessor, Lessee shall reimburse Lessor … Lessor assumes and is responsible for all risks and costs not paid or covered by any policy held by either party …
>
> **12.5 Risk of Loss of or Injury to the Horse**
> **12.6 Loss of Use**
> **12.7 Assumption of Inherent Risks**
> **12.8 Release of Liability**
> **12.9 Release of Liability by Lessor**
> **12.10 Required Protective Attire**
> **12.11 Waiver of Unknown Claims**
> **12.12 Mutual Indemnification**
> **12.13 Limitation of Liability**

**13 numbered items.** Notes:

- The long reimbursement paragraph (`MED_TAIL`) is not its own item. It is glued
  onto the end of the medical deductible sentence, so a single numbered item
  carries both the medical status lines and a 250-word cost-allocation paragraph.
- Riding Lessons and Solo Arena Riding produce **no** risk-acknowledgement clause.
  Only trail, jumping, competitions and group arena riding do.
- `CCC` and `COORDINATION` are absent — the Lessee is an individual.

---

## Scenario 2 — Partial lease · no insurance anywhere (the live client arrangement)

**Set:** as above, but all three "not required" boxes ticked by the Lessor. The
six status fields and three deductible fields are hidden and unanswerable.

> **12. INSURANCE, RISK OF LOSS, AND INDEMNIFICATION**
>
> **12.1 Insurance Requirements**
> The parties agree to the insurance elections set forth below. …
>
> **12.2 General Liability Insurance**
> Lessor has elected not to require general liability insurance under this Agreement. Lessor accepts full risk and responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement, except as otherwise expressly allocated in this Agreement.
>
> **12.3 Mortality Insurance**
> Lessor has elected not to require mortality insurance under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse's value in the event of the Horse's death, theft, or humane destruction, except as otherwise expressly allocated in this Agreement.
>
> **12.4 Medical Insurance**
> Lessor has elected not to maintain medical insurance on the Horse. Lessor accepts full risk and responsibility for any and all injury to or illness of the Horse during the term of this Agreement, including all costs of veterinary care arising from such injury or illness, except as otherwise expressly allocated in the Horse Care and Expenses section of this Agreement.
>
> **12.5 Risk of Loss of or Injury to the Horse**
> **12.6 Loss of Use** … through **12.13 Limitation of Liability** — identical to scenario 1.

**13 numbered items.** Notes:

- This is the cleanest output the section produces. Three plain waivers, no gaps,
  no dangling colons.
- `MED_TAIL` does **not** print. The paragraph that would explain who fronts a
  vet bill and how it is reimbursed is only available when medical cover is
  required.
- The nine required insurance fields are hidden and empty. The lock check
  (`contract_lock_blockers`) correctly ignores gated-off required fields, so this
  configuration locks and signs.
- The three "not required" boxes are the Lessor's own act — staff cannot tick
  them on the Lessor's behalf, and neither can the Lessee.

---

## Scenario 3 — Full lease · Lessee carries mortality and medical

**Set:** lease type **Full** · both parties Individual · activities Solo Arena
Riding + Jumping + Competitions · FMV $25,000.00 · no waivers · GL: Lessor *Has
and will maintain*, Lessee *Does not have*, deductible Lessor · Mortality: Lessor
*Does not have and will not obtain*, Lessee *Will obtain and will maintain*,
deductible Lessee · Medical: same shape as mortality.

Because the lease is Full, the SCHEDULE section drops out entirely and the
insurance section becomes **11**.

> **11. INSURANCE, RISK OF LOSS, AND INDEMNIFICATION**
>
> **11.1 Insurance Requirements** …
>
> **11.2 General Liability Insurance**
> Lessor: Has and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement.
> Lessee: Does not have and will not obtain general liability insurance covering the Horse and the activities contemplated by this Agreement.
> If a claim is made … shall be borne by: Lessor.
>
> **11.3 Mortality Insurance**
> Lessor: Does not have and will not obtain mortality insurance on the Horse.
> Lessee: Will obtain and will maintain mortality insurance on the Horse.
> If a claim is made … shall be borne by: Lessee.
>
> **11.4 Medical Insurance**
> Lessor: Does not have and will not obtain medical insurance on the Horse.
> Lessee: Will obtain and will maintain medical insurance on the Horse.
> If a claim is made … shall be borne by: Lessee. Any out-of-pocket costs for deductibles or other expenses related to the needs of the Horse **are to be paid by Lessor** … **Lessor assumes and is responsible for all risks and costs not paid or covered by any policy held by either party**, including in the event a policy is not in effect at the time of the incident …
>
> **11.5 Risk of Loss of or Injury to the Horse**
> **Lessor assumes all risk of loss of or injury to the Horse during the term of this Agreement**, except to the extent caused by Lessee's gross negligence, reckless conduct, or intentional misconduct.
>
> **11.6 Loss of Use**
> **11.7 Assumption of Inherent Risks**
> **11.8 Release of Liability**
> **11.9 Release of Liability by Lessor**
> **11.10 Required Protective Attire**
> **11.11 Jumping Risks**
> **11.12 Competition Risks**
> **11.13 Waiver of Unknown Claims**
> **11.14 Mutual Indemnification**
> **11.15 Limitation of Liability**

**15 numbered items.** Notes:

- **The document contradicts itself twice in the same breath.** 11.4 says the
  Lessee will maintain medical cover and bear its deductible, and then in the
  same numbered item says out-of-pocket costs are paid by the Lessor and the
  Lessor absorbs everything no policy covers. 11.5 then says the Lessor assumes
  all risk of loss.
- `MED_TAIL` and `RISK_OF_LOSS` are both unconditional. Moving cover onto the
  Lessee does not move either of them.
- The deductible sentence still reads *"arising from events for which Lessee bears
  responsibility"* even though the policy in question is now the Lessee's own.
- Note the section renumbering: any downstream document, checklist or comment
  anchor that refers to "section 12" is referring to a different section in a
  full lease than in a partial one.

---

## Scenario 4 — Partial lease · Lessor requires cover the Lessee cannot lawfully obtain

**The claim under test:** the Lessor wants the Lessee to carry mortality cover on
the horse. A part-time lessee has no ownership and, on the usual insurable-interest
rule, cannot buy a mortality policy on an animal they do not own. Can the contract
say so?

**Verdict: confirmed. It cannot say anything coherent.** There are exactly four
things the form permits, and none of them states the situation.

### 4A — the truthful entry, and the dead end

Lessor sets mortality: Lessor *Does not have and will not obtain*, Lessee *Does
not have and will not obtain*. (GL and medical carried by the Lessor as in
scenario 1.) The mortality block prints in full as:

> **12.3 Mortality Insurance**
> Lessor: Does not have and will not obtain mortality insurance on the Horse.
> Lessee: Does not have and will not obtain mortality insurance on the Horse.

That is the entire mortality block. **The deductible sentence does not print** —
its gate requires at least one party to have or be obtaining cover. So the
document records two negatives and allocates nothing.

The requirement is nowhere in the text. The impossibility is nowhere in the text.
And 12.5 still says *"Lessor assumes all risk of loss of or injury to the Horse"*
— the opposite of what the Lessor is asking for.

The document also **cannot be locked**. `contract_lock_blockers` returns
*"Mortality insurance responsibility unresolved — one party must accept it"*, and
both signing paths refuse to advance a document with a blocker. Both parties also
receive the notification: *"Neither party currently has this coverage. The
contract cannot be signed until one party accepts financial responsibility for
it."*

### 4B — the Lessor writes the requirement into the Lessee's status

The Lessee's status field is owned by the **Lessor**. The Lessor can set it to
*Will obtain and will maintain*. The block then prints:

> **12.3 Mortality Insurance**
> Lessor: Does not have and will not obtain mortality insurance on the Horse.
> Lessee: Will obtain and will maintain mortality insurance on the Horse.
> If a claim is made under any such policy … shall be borne by: Lessee.

The blocker clears and the contract can be signed. What the document now asserts
is a statement of fact about the Lessee, written by the Lessor, that the Lessee
cannot make true. Nothing in the system tests it, and the Lessee's only route to
object is a change request.

### 4C — the Lessee accepts responsibility

With both statuses at `NONE`, the Lessee's own checkbox becomes available. Ticking
it clears the blocker and prints:

> **12.3 Mortality Insurance**
> Lessor: Does not have and will not obtain mortality insurance on the Horse.
> Lessee: Does not have and will not obtain mortality insurance on the Horse.
>
> **12.4 Mortality — Lessee Responsibility**
> Lessee has elected to accept, and hereby accepts, financial responsibility for mortality insurance under this Agreement. Lessee shall obtain and maintain, at Lessee's sole cost, mortality insurance on the Horse for the duration of this Agreement in an amount not less than the Horse's current fair market value, and shall provide proof of coverage to Lessor upon request. As between the parties … Lessee bears responsibility for the loss of the Horse's value in the event of the Horse's death, theft, or humane destruction to the extent not covered by an in-force policy.

Three things happen at once: the Lessee undertakes to obtain a policy on the line
directly below the line saying they will not obtain one; **no deductible sentence
prints at all** (both statuses are still `NONE`, so its gate fails); and 12.x
*Risk of Loss* still says the Lessor assumes all risk of loss of the Horse.

Note the closing words — *"to the extent not covered by an in-force policy"*. If
the Lessee cannot obtain a policy, there is never an in-force policy, so the
Lessee bears the entire value of the horse. That is the opposite of the outcome
a Lessee ticking a box marked "I accept responsibility for mortality insurance"
would expect.

### 4D — the Lessor gives up the requirement

Ticking *"Mortality insurance is not required for or by either party"* prints:

> **12.3 Mortality Insurance**
> Lessor has elected not to require mortality insurance under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse's value …

Clean, signable, and the requirement has been abandoned.

### What is missing

There is no field, no option and no clause anywhere in the template that says any
of these:

- this cover is required of the Lessee;
- this cover is not available to a Lessee under a partial lease;
- the requirement is waived *because* it cannot be met;
- the consequence of the gap — who bears the loss the missing policy would have
  paid.

The status vocabulary is three values — *Has and will maintain*, *Will obtain and
will maintain*, *Does not have and will not obtain*. All three describe a party's
choice. None describes capability, and none describes a demand made of the other
side. `TXN.LEASE_TYPE` — the field that records that this is a partial lease —
does not gate a single insurance clause or field, so the contract has no way to
know that a partial lessee is the party in question.

---

## Scenario 5 — Entity lessee, the only configuration where CCC prints

**Set:** lease type Partial · Lessor Individual, **Lessee an Entity /
organization** · activities Riding Lessons + Group Arena Riding · FMV $25,000.00 ·
no waivers · GL: both parties *Has and will maintain*, deductible **Split**,
50% / 50% · Mortality and Medical: Lessor *Has and will maintain*, Lessee *Does
not have*, deductible Lessor.

> **12. INSURANCE, RISK OF LOSS, AND INDEMNIFICATION**
>
> **12.1 Insurance Requirements** …
>
> **12.2 General Liability Insurance**
> Lessor: Has and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement.
> Lessee: Has and will maintain general liability insurance covering the Horse and the activities contemplated by this Agreement.
> If a claim is made … responsibility for any deductible shall be borne by: Split. The deductible shall be split between the parties: 50% paid by Lessor and 50% paid by Lessee.
>
> **12.3 Mortality Insurance**
> Lessor: Has and will maintain mortality insurance on the Horse.
> Lessee: Does not have and will not obtain mortality insurance on the Horse.
> If a claim is made … shall be borne by: Lessor.
>
> **12.4 Medical Insurance**
> Lessor: Has and will maintain medical insurance on the Horse.
> Lessee: Does not have and will not obtain medical insurance on the Horse.
> If a claim is made … shall be borne by: Lessor. Any out-of-pocket costs for deductibles … Lessor assumes and is responsible for all risks and costs not paid or covered by any policy held by either party …
>
> **12.5 Care, Custody and Control Insurance**
> Lessee shall obtain and maintain, for the duration of this Agreement, care, custody and control insurance covering the Horse while in Lessee's care, custody, or control, with a death benefit limit of not less than the Horse's current fair market value of **$25,000.00**, with an effective start date no later than the commencement of this Agreement. Lessee shall provide proof of coverage to Lessor upon request … failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.
>
> **12.6 Coordination of Coverage**
> Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor's mortality insurance shall be the first policy noticed and claimed against for any such covered event. Lessee's care, custody and control insurance is secondary … Absent a determination that Lessee so caused the loss, all deductibles and uninsured amounts remain Lessor's responsibility.
>
> **12.7 Risk of Loss of or Injury to the Horse**
> **12.8 Loss of Use**
> **12.9 Assumption of Inherent Risks**
> **12.10 Release of Liability**
> **12.11 Release of Liability by Lessor**
> **12.12 Required Protective Attire**
> **12.13 Shared Arena Riding Risks**
> **12.14 Waiver of Unknown Claims**
> **12.15 Mutual Indemnification**
> **12.16 Limitation of Liability**

**16 numbered items.** Notes:

- `CCC` is gated on one thing only: `LESSEE.PARTY_TYPE = ENTITY`. It prints for
  every entity lessee, in every insurance configuration, and never for an
  individual. It imposes an unconditional obligation to buy a policy at the
  horse's full value, and it is the only clause in the section whose breach is
  named as grounds for termination for cause.
- `CCC` prints the fair market value. If that field is blank the clause still
  prints and reads *"…not less than the Horse's current fair market value of."*
- The deductible sentence reads *"…shall be borne by: Split."* before the sentence
  that explains the split. "Split" is a code name surfacing as contract prose.
- `COORDINATION` is the only clause outside the mortality block that a mortality
  waiver switches off. Ticking *"Mortality insurance is not required"* removes the
  coordination rules while leaving `CCC` in place — the entity lessee still has to
  buy care-custody-and-control cover, but the contract no longer says how it
  interacts with anything.

### Scenario 5 variant — entity lessee with mortality waived

Same as above, but *"Mortality insurance is not required"* ticked:

> **12.3 Mortality Insurance**
> Lessor has elected not to require mortality insurance under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse's value …
>
> **12.4 Medical Insurance** …
>
> **12.5 Care, Custody and Control Insurance**
> Lessee shall obtain and maintain … care, custody and control insurance … with a death benefit limit of not less than the Horse's current fair market value of $25,000.00 …

`COORDINATION` is gone. The document now says the Lessor accepts full
responsibility for the loss of the horse's value **and** that the Lessee must
carry a policy paying that same value, with nothing stating which responds, in
what order, or what happens to the proceeds.
