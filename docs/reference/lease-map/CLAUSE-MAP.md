# Clause map — all 35 clauses of `INSURANCE_RISK`

CSV copy: [CLAUSE-MAP.csv](CLAUSE-MAP.csv).

## The four things that most surprised me here

1. **Thirteen of the 35 clauses print no matter what anybody chooses** — three of
   them the empty block headings, ten of them text. Nothing in the insurance form
   can suppress the releases, the assumption of risk, the helmet clause, the
   indemnity, the liability cap, `RISK_OF_LOSS`, or `LOSS_OF_USE_ACK`. Two of the
   thirteen state allocations of risk that the elected clauses can flatly
   contradict.
2. **Three clauses are headings with no body.** `GENERAL_LIABILITY`, `MORTALITY`
   and `MEDICAL` carry no text at all. They exist to number and title the block;
   every word under them comes from a separate, headingless clause. So "changing
   the mortality clause" almost never means editing `INSURANCE_RISK.MORTALITY`.
3. **`MED_TAIL` has no gate of its own beyond the medical waiver, and it is glued
   onto the end of whatever line precedes it.** It is a `render_as_subitem` clause
   with no heading, so the composer appends it to the previous line rather than
   starting a new one. In the live draft `215bac09` it currently reads as one
   sentence continuing *"Lessee: medical insurance on the Horse. Any out-of-pocket
   costs…"*. It is the longest paragraph in the section and it always attaches to
   the medical block, whatever the medical block says.
4. **The `Lessee Responsibility` clause sits in a different place in the medical
   block than in the other two.** In GL and mortality it prints *after* the status
   lines; in medical it prints *before* them (sort 306 against a status at 308).
   Because the status lines are headingless, they land underneath the *Medical —
   Lessee Responsibility* heading rather than under *Medical Insurance*.

---

## How to read the columns

- **Prints when** — plain English, or ALWAYS.
- **Depends on fields** — fields read by the gate, plus fields printed in the body.
- **Tokens in body** — and what shows if the field is empty.
- **Dead if** — any condition that makes the clause unreachable.

Numbering note: only a clause with a heading takes a number. A headingless clause
is continuation text under the numbered item above it. A `subitem` clause with no
heading is appended to the end of the previous line.

---

## A. The framing clause

| Clause key | Heading | Prints when | Depends on fields | Tokens in body | Dead if |
|---|---|---|---|---|---|
| `INSURANCE_RISK.INSURANCE` | Insurance Requirements | ALWAYS | — | none | never |

Text: *"The parties agree to the insurance elections set forth below. Each policy
elected or required below shall be maintained in effect for the duration of this
Agreement."*

## B. General Liability (sort 150–169)

| Clause key | Heading | Prints when | Depends on fields | Tokens in body | Dead if |
|---|---|---|---|---|---|
| `GENERAL_LIABILITY` | General Liability Insurance | ALWAYS | — | **no body at all** — heading only | never |
| `GL_STATUS` | *(continuation)* | GL is not waived | `GL_LESSOR_STATUS`, `GL_LESSEE_STATUS` | `{{TXN.GL_LESSOR_STATUS}}`, `{{TXN.GL_LESSEE_STATUS}}` — **if empty the line still prints**, as *"Lessor:  general liability insurance covering the Horse…"* with a gap where the status belongs | GL waived |
| `GL_DED_SIMPLE` | *(continuation)* | GL not waived **and** at least one party has or will obtain GL cover | `GL_DED_RESP` and both statuses | `{{TXN.GL_DED_RESP}}` — if empty the line prints ending in a bare colon: *"…shall be borne by:"* | GL waived, or both parties `NONE` |
| `GL_DED_SPLITC` | *(continuation, appended)* | GL not waived **and** `GL_DED_RESP = SPLIT` **and** at least one party has or will obtain | both split fields | `{{TXN.GL_DED_RESP_SPLIT_LESSOR}}`, `{{…_LESSEE}}` — if empty the line prints as *"The deductible shall be split between the parties: paid by Lessor and paid by Lessee."* | GL waived; or split not chosen; or both parties `NONE` |
| `GL_NONE` | *(continuation)* | GL **is** waived | `GL_NOT_REQUIRED` | none | GL not waived |
| `GL_LESSEE_RESP` | General Liability — Lessee Responsibility | Lessee has ticked their acceptance box | `GL_LESSEE_RESPONSIBLE` | none | the box can only be ticked when both statuses are `NONE` and GL is not waived, so this clause is dead in every other configuration |

## C. Mortality (sort 200–221)

| Clause key | Heading | Prints when | Depends on fields | Tokens in body | Dead if |
|---|---|---|---|---|---|
| `MORTALITY` | Mortality Insurance | ALWAYS | — | **no body** | never |
| `MORT_STATUS` | *(continuation)* | Mortality not waived | `MORT_LESSOR_STATUS`, `MORT_LESSEE_STATUS` | both status tokens — empty prints *"Lessor:  mortality insurance on the Horse."* | mortality waived |
| `MORT_DEDR_SIMPLE` | *(continuation)* | Mortality not waived **and** at least one party has or will obtain | `MORT_DED_RESP` | `{{TXN.MORT_DED_RESP}}` — empty leaves a bare colon | mortality waived, or both `NONE` |
| `MORT_DEDR_SPLITC` | *(continuation, appended)* | Mortality not waived **and** `MORT_DED_RESP = SPLIT` **and** one party has or will obtain | both split fields | two tokens — empty prints *"…: paid by Lessor and paid by Lessee."* | mortality waived; or split not chosen; or both `NONE` |
| `MORT_NONE` | *(continuation)* | Mortality **is** waived | `MORT_NOT_REQUIRED` | none | mortality not waived |
| `MORT_LESSEE_RESP` | Mortality — Lessee Responsibility | Lessee has ticked their acceptance box | `MORT_LESSEE_RESPONSIBLE` | none | dead unless both statuses are `NONE` and mortality is not waived |

## D. Medical (sort 300–320)

| Clause key | Heading | Prints when | Depends on fields | Tokens in body | Dead if |
|---|---|---|---|---|---|
| `MEDICAL` | Medical Insurance | ALWAYS | — | **no body** | never |
| `MED_NONE` | *(continuation)* | Medical **is** waived | `MED_NOT_REQUIRED` | none | medical not waived |
| `MED_LESSEE_RESP` | Medical — Lessee Responsibility | Lessee has ticked their acceptance box | `MED_LESSEE_RESPONSIBLE` | none | dead unless both statuses `NONE` and medical not waived |
| `MED_STATUS` | *(continuation)* | Medical not waived | `MED_LESSOR_STATUS`, `MED_LESSEE_STATUS` | both status tokens — empty prints *"Lessor:  medical insurance on the Horse."* | medical waived |
| `MED_DEDR_SIMPLE` | *(continuation)* | Medical not waived **and** at least one party has or will obtain | `MED_DED_RESP` | `{{TXN.MED_DED_RESP}}` — empty leaves a bare colon | medical waived, or both `NONE` |
| `MED_DEDR_SPLITC` | *(continuation, appended)* | Medical not waived **and** `MED_DED_RESP = SPLIT` **and** one party has or will obtain | both split fields | two tokens | medical waived; or split not chosen; or both `NONE` |
| `MED_TAIL` | *(continuation, appended)* | Medical not waived | — | none | medical waived |

`MED_TAIL` is the paragraph beginning *"Any out-of-pocket costs for deductibles or
other expenses related to the needs of the Horse are to be paid by Lessor…"* and
ending *"Lessor assumes and is responsible for all risks and costs not paid or
covered by any policy held by either party…"*. It is the only clause in the
section that allocates uninsured cost in general terms, and it prints whenever
medical cover is not waived — including when the Lessee has accepted medical
responsibility.

## E. Entity-only clauses

| Clause key | Heading | Prints when | Depends on fields | Tokens in body | Dead if |
|---|---|---|---|---|---|
| `CCC` | Care, Custody and Control Insurance | Lessee is an entity | `LESSEE.PARTY_TYPE` | `{{HORSE.FAIR_MARKET_VALUE}}` — if empty prints *"…fair market value of."* | Lessee is an individual or unanswered |
| `COORDINATION` | Coordination of Coverage | Lessee is an entity **and** mortality is not waived | `LESSEE.PARTY_TYPE`, `MORT_NOT_REQUIRED` | none | Lessee is an individual, or mortality is waived |

`COORDINATION` opens *"Lessor bears responsibility for loss of, injury to, or
death of the Horse, and Lessor's mortality insurance shall be the first policy
noticed and claimed against."* Its gate does not test whether the Lessor actually
has mortality cover — only that the *waiver box* is unticked.

## F. The unconditional tail — 9 clauses that always print

| Clause key | Heading | Tokens in body | What it fixes |
|---|---|---|---|
| `RISK_OF_LOSS` | Risk of Loss of or Injury to the Horse | none | *"Lessor assumes all risk of loss of or injury to the Horse…"* |
| `LOSS_OF_USE_ACK` | Loss of Use | none | Lessor accepts loss of use; no loss-of-use cover under the agreement |
| `ASSUMPTION_INHERENT` | Assumption of Inherent Risks | none | California primary assumption of risk, *Knight v. Jewett*, *Levinson v. Owens* |
| `RELEASE` | Release of Liability | none | Lessee releases the Lessor Parties |
| `RELEASE_LESSOR` | Release of Liability by Lessor | none | Lessor releases the Lessee Parties |
| `SAFETY_ATTIRE` | Required Protective Attire | none | ASTM/SEI helmet, boots, long pants; breach revokes permission to ride |
| `WAIVER_UNKNOWN` | Waiver of Unknown Claims | none | Civil Code §1542 waiver, both ways |
| `INDEMNIFICATION` | Mutual Indemnification | none | Mutual indemnity, gross-negligence carve-out |
| `LIMITATION` | Limitation of Liability | `{{HORSE.FAIR_MARKET_VALUE}}` — if empty prints *"…shall not exceed the Horse's current fair market value of."* | Caps aggregate liability at the Horse's value |

Those nine, plus the framing clause in section A and the three empty block
headings in sections B–D, are the 13 clauses of this section that print
unconditionally.

Four more depend only on the permitted activities — no insurance election
touches them:

| Clause key | Heading | Prints when | Dead if |
|---|---|---|---|
| `TRAIL_RIDING` | Trail Riding Risks | activities include `TRAIL` | `TRAIL` not selected |
| `JUMPING_RISKS` | Jumping Risks | activities include `JUMPING` | `JUMPING` not selected |
| `COMPETITION_RISKS` | Competition Risks | activities include `COMPETITIONS` | `COMPETITIONS` not selected |
| `SHARED_ARENA_RISKS` | Shared Arena Riding Risks | activities include `ARENA_GROUP` | `ARENA_GROUP` not selected |

There is no activity-risk clause for `LESSONS`, `ARENA_SOLO` or `TRAINING`.
