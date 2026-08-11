# LEASEFIX insurance — owner rulings, 2026-08-10. These close the five modelling candidates.

The thread modelled 13.2–13.5 and offered five further simplifications. **Three are now
settled by the owner. Two were not candidates at all.** This document is authoritative over
the thread's own candidate list.

---

## 1. COST LINES GO. All of them.

> Owner: *"I already said remove cost lines."*

He had already said it in the original request — *"we should just simplify and eliminate this,
and then the policy cost line should go with it"* and *"we shouldnt muddy the contract with the
dollar amounts here."*

**Removed:**
- the floating free-text field with the `Allocation` placeholder
- the policy-cost line
- the `"shall be split between the parties: [Split (composed)]"` line

**CORRECTED 2026-08-10 — the orchestrator's first reading was too broad. The owner:**

> *"no i meant the section where they can input the actual cost of the policy. the split is
> either a $ driven split or a % driven split and that needs to remain, its not a cost listing
> its the contribution declaration."*

**The rule, and it is what stops a cost field being re-added later:**

| | |
|---|---|
| **the premium** | a FACT that changes over time. Belongs in an appendix. **Never in a clause body.** |
| **the split** | a TERM of the agreement. Belongs in the clause. **Stays.** |

**REMOVED — the amount:**
- the input for the actual cost of the policy
- the floating free-text field placeholdered `Allocation`
- the `"shall be split between the parties: [Split (composed)]"` line — redundant, the line
  before it already says the parties split it

**KEPT:**
- the who-bears-it election: "paid by Lessor" / "split between Lessor and Lessee" / "Other"
- **the contribution declaration** — Lessor's share and Lessee's share, `$`-driven or
  `%`-driven. **Not a cost listing. What each party agreed to bear.**

**So the `$ or %` control MUST be built.** It is no longer contingent on anything.

**Amounts live in the deal, not the clause body.** The owner's rationale: policy documents
become appendix items, and anyone wanting the figures in the contract uses the add-an-item
feature. Do not reintroduce a currency field into these clauses.

## 2. THE ACCEPTANCE CHECKBOXES GO.

> Owner: *"we dont need the checkboxes."*

This overrides the orchestrator's earlier advice, which argued to fix the render bug rather
than remove the control. The owner's position holds: **the Lessee signs the contract.** A
separate acknowledgment of an allocated cost adds a control without adding consent.

**CONSEQUENCE THAT MUST BE HANDLED, not discovered.** `contract_lock_blockers` currently
returns an `insurance_acceptance_unchecked` code keyed on exactly these fields — it was one of
three blockers firing on a live lease when tested on 2026-08-10:

```
insurance_acceptance_unchecked — "Lessee has not accepted a cost allocated to them:
  Lessee accepts responsibility for the share of any deductibl;
  Lessee accepts financial responsibility for the cost of care"
```

**Removing the fields without removing that blocker leaves a blocker referencing fields that
no longer exist.** Remove both together, and re-verify the blocker in both directions
afterwards — it must still fire on genuinely-blank required fields.

**This also dissolves the render bug.** The checkbox not appearing in its unselected state was
caused by the muted preview filtering fields whose own gate is unmet while still printing the
caption. No field, no bug, and no need to touch the render rule.

## 3. MORTALITY AND MEDICAL COLLAPSE INTO ONE SECTION — with a strict dependency.

> Owner: *"you can collapse the two into one seamless section as long as medical remains an
> optional include because mortality is purchased and medical is added, but isnt required for
> mortality, mortality is required for medical to be available."*

**The dependency is one-directional and it is the whole design:**

- **Mortality is the parent.** It is purchased on its own and needs nothing else.
- **Medical is an optional add-on to mortality.** It is offered ONLY when mortality is carried
  or will be obtained.
- **Mortality never requires medical.** Electing mortality alone is complete and valid.
- **Medical can never appear without mortality.** If the Lessor does not carry mortality,
  medical is not an option — not "unselected", not "muted", **absent**.

So the collapsed section is:

```
Lessor's mortality election
  ├─ does not carry            -> mortality clause only. Section ends. No medical.
  ├─ carries          ─┐
  └─ will obtain      ─┴─────> mortality clause
                               + cost handling (who bears it)
                               + MEDICAL, as an optional include
                                   └─ when included: same cost-handling shape
```

**This answers the thread's candidate 1 in the affirmative, but not as it proposed it.** It
offered "included, cost handled the same way" as a single question replacing the duplicate
tree. **The owner's model is a dependency, not a shortcut:** medical is an optional include
gated on mortality, and when included it uses the same machinery. One section, one set of
controls, used twice.

---

## 4. 13.2's STRUCTURE — owner ruling. Two separate selections, and the second can end the section.

> Owner, 2026-08-10: *"the initial selections need to be separate. The lessor either has,
> doesnt have, or will obtain. they are not requiring the lessee to do anything with this
> selection. then, they can require the lessee to have or obtain liability coverage. if we are
> merging CCC into this block then there is an additional set of options where they require
> lessee to have or obtain gl with ccc. the does not require is standalone that negates the
> section entirely for the lessee and the prior selection of their declaration is shown with
> the does not require of lessee being shown below it."*

```
A · Lessor's own declaration       has / does not have / will obtain
      about the Lessor ONLY. Requires nothing of the Lessee.

B · What the Lessor requires       requires Lessee to have or obtain GL
      of the Lessee                requires Lessee to have or obtain GL with CCC
                                   does not require   <- STANDALONE

      "does not require" NEGATES the Lessee section entirely. The document then
      renders A, followed by the "does not require of Lessee" statement below it.
```

**This dissolves the contradiction by construction.** There is no branch in which the Lessor
requires GL and the Lessee answers that it carries none — requiring means the valid answers
are *has* or *will obtain*. The material-breach collision cannot arise.

### SETTLED 2026-08-10 — BOTH PARTIES DECLARE; THE REQUIREMENT NARROWS THE MENU.

> Owner: *"not required ≠ not having, so we give each party the option to declare as well as
> the lessor the option to require which causes the not having to be not an option for lessee
> to select."*

**This is the model. Build 13.2 to it.**

```
Lessor declares own GL      has / will obtain / does not carry      ALWAYS asked
Lessor requires GL          require / do not require                ALWAYS asked
Lessee declares own GL      has / will obtain / does not carry      ALWAYS asked
                            └─ "does not carry" is REMOVED from the option list
                               whenever the Lessor requires

CCC requirement             require / do not require        ENTITY Lessee only
Lessee declares CCC         same three, same constraint     ENTITY + CCC required
```

**The requirement is a CONSTRAINT ON THE OPTION SET, not a separate question the Lessee
answers.** Both parties always declare their own position. Requiring simply removes one choice
from the other party's menu.

**Why this eliminates the contradiction structurally.** "Does not carry" is *absent from the
menu* whenever a requirement is live, rather than present and conflicting. There is no state in
which the document can assert both a requirement and its non-fulfilment, so `GL_REQUIRED`'s
material-breach language can never collide with `GL_LESSEE_PERSONAL`. **No suppression logic is
needed** — the earlier three-change plan is obsolete.

**Why the Lessee still declares when nothing is required.** *Not required is not the same as
not having.* Whether the Lessee carries GL changes who actually bears an at-fault cost, and the
allocation question in that branch is better informed for knowing it.

**Enforcement is unchanged where it matters.** When the Lessor requires, the Lessee's only
valid answers are *has* or *will obtain*, and a blank line still blocks the lock. A
disagreement stalls the contract until one party moves — the owner's stated intent, and what
`contract_lock_blockers` already does.

### What this means for the change already live

`f2b88b3` removed `ACCEPTS_PERSONALLY`'s `when` entirely, making it selectable everywhere.
**That is now too wide.** It needs a `when` again — a different one than the original:

| | gate |
|---|---|
| original, too narrow | `GL_LESSOR_REQUIRES = NEITHER` **AND** `GL_NO_REQ_ALLOCATION = LESSEE_AT_FAULT` |
| shipped today, too wide | none |
| **correct** | **`GL_LESSOR_REQUIRES` = do-not-require** |

`docs/tasks/TASK-LEASEFIX-13.2-lessee-decline-option.md` is **SUPERSEDED** by this section. Its
three-change plan solved a contradiction this structure prevents. Close it out; do not build
from it.

### "RIDER" NEVER APPEARS IN CONTRACT TEXT. Owner ruling 2026-08-10.

> Owner: *"the wording using 'rider' is going to be confusing."*

**In a horse lease, "rider" already means the person on the horse.** It is the dominant sense
in this document class, and the insurance sense collides with it in the one contract type
where that is guaranteed to mislead.

**Use "component" — the word `MED_NA` already uses**: *"available only as a component of a
mortality policy on the Horse."* The vocabulary is established in this document, so matching
it is both clearer and consistent by default.

**APPROVED CCC N/A TEXT:**

> **13.3 Care, Custody and Control Insurance**
>
> Not applicable. Care, custody and control coverage is available only as a component of a
> general liability policy carried by Lessee. Because Lessee does not carry general liability
> insurance under this Agreement, no care, custody and control coverage is available.

**Scope of the ban:** contract text, clause bodies, field labels, option labels — anywhere a
party reads it. **"Parent/rider" stays in the engineering docs**, where it names the pattern
precisely and no counterparty ever sees it. Do not strip it from these rulings.

### CCC HOLDS ITS POSITION AND SHOWS N/A — it does not vanish. Settled 2026-08-10.

> Owner: *"the ccc needs to move up to below the gl section right now it goes gl, mort, med,
> ccc"* … *"just like the na is shown for med when mort is doesnt have, the ccc should follow
> that same paradigm"*

**The stored order is already correct** — GL 150–172, CCC 173–175, Mortality 200–215, Medical
300–320. Verified in the composed body of `e1052bae`, which renders **13.2 GL → 13.3 CCC →
13.4 Mortality → 13.5 Medical**.

**The problem is that CCC VANISHES when gated off, and everything renumbers around the hole.**
`704c8d2d` and `215bac09` render `12.2 GL → 12.3 Mortality → 12.4 Medical` with no CCC at all
— which is why it reads as out of order or missing. **The section numbers move under the
owner between documents.**

**The fix is the N/A paradigm already used for medical.** Mirror it exactly. Medical has TWO
distinct absent-states and CCC needs both:

| state | medical's clause | what CCC needs |
|---|---|---|
| **parent not in force** | `MED_NA`, on `MORT_ELECTION = NOT_REQUIRED` — *"Not applicable. Medical coverage is available only as a component of a mortality policy on the Horse. Because no mortality insurance is required or in force under this Agreement, no medical coverage is available."* | a `CCC_NA` clause on the Lessee declaring no GL, naming the same dependency: CCC is available only as a rider on a general liability policy |
| **parent in force, rider declined** | `MED_NOT_INCLUDED`, on `MORT_ELECTION = REQUIRED` + `MED_INCLUDED = NO` — *"Medical coverage is not included on the mortality policy for the Horse under this Agreement."* | the equivalent for CCC not carried where GL is in force |

**Note what `MED_NA` does well and copy it:** it states the dependency as the reason. Not
"not applicable" alone — *why* it is not applicable. Draft CCC's wording to the same standard
and bring it to the owner before applying; it is clause text.

**SETTLED — the entity case.** Owner, 2026-08-10: *"it disappears. for individuals."*

**Three states, and the N/A paradigm applies only inside the entity branch:**

| Lessee | Lessee's GL | 13.3 |
|---|---|---|
| individual | any | **ABSENT.** The section does not exist. Mortality takes 13.3 and the numbering shifts. |
| entity | does not carry | **PRESENT, N/A line.** CCC is available to them in principle but has no policy to attach to. |
| entity | has / will obtain | **PRESENT, full block.** Requirement + declaration. |

**The distinction is conceptual availability, not policy state.** For an individual, CCC is not
a thing that could ever apply — printing "not applicable" would be answering a question nobody
asked. For an entity with no GL, CCC *is* applicable in principle and the N/A line earns its
place by naming why it cannot be taken: no parent policy.

**Accepted cost:** section numbers still differ between an individual's lease and an entity's.
The owner has taken that trade knowingly — the numbering complaint was about CCC vanishing
*within a document class*, not about individual and entity leases numbering alike.

### FINAL — CCC IS A RIDER ON GL. Settled 2026-08-10. Build to this.

> Owner: *"ccc is a rider on gl just like medical is a rider on mortality"*

**This corrects the section below, which was recorded minutes earlier and got the dependency
backwards.** It stated that removing `GL_AND_CCC` also removed "a constraint encoded by
accident — CCC impossible to require without GL." **That constraint is not accidental. It is
what a rider is.** There is no care-custody-and-control cover without a general liability
policy to attach it to.

**The insurance model is TWO parent/rider pairs, same machinery both times:**

```
GL           parent — stands alone
 └─ CCC      RIDER — available only where GL is held or will be obtained
                     AND the Lessee is an entity

MORTALITY    parent — stands alone
 └─ MEDICAL  RIDER — available only where mortality is held or will be obtained
```

**The gate moves.** CCC hangs off the **Lessee's own GL declaration**, not off the Lessor's
requirement:

```
13.2  GENERAL LIABILITY                              every lease
      Lessor declares own GL     has / will obtain / does not carry
      Lessor requires GL         require / do not require
      Lessee declares GL         has / will obtain / does not carry
                                 └─ "does not carry" REMOVED when required

13.3  CARE, CUSTODY AND CONTROL
      SHOWN ONLY WHEN:  Lessee is an ENTITY
                        AND Lessee declares GL = has OR will obtain
      Lessor requires CCC        require / do not require
      Lessee declares CCC        has / will obtain / does not carry
                                 └─ "does not carry" REMOVED when required
```

**An entity Lessee who does not carry GL never sees 13.3.** There is nothing for the rider to
attach to. The section below said 13.3 shows for *every* entity Lessee — **that is wrong and
is superseded by this.**

**A rider can still be declined.** "Lessee has GL but does not carry the CCC rider" is a real
and valid state, which is why the third option survives on CCC — narrowed the same way when
the Lessor requires it.

**Consequence for the mortality/medical collapse (ruling 3):** the two pairs are the same
machine. Whatever gating and controls are built for GL→CCC should be the same ones used for
mortality→medical. **Build the parent/rider pattern once.**

### (SUPERSEDED — got the dependency backwards) 13.2 and 13.3 fully separated

The real problem was never the data model: **the requirement lived in 13.2 while the content
lived in 13.3.** Owner: *"either we separate the two ... and the ccc section needs to add the
lessor requirement block or we keep it merged and ... the ccc content is shown in the gl
section."* → **Separate.** Confirmed, and *"the same holds for ccc"* — the declare/require/
narrow rule applies to CCC identically.

```
13.2  GENERAL LIABILITY                          every lease
      Lessor declares own GL     has / will obtain / does not carry
      Lessor requires GL         require / do not require
      Lessee declares GL         has / will obtain / does not carry
                                 └─ "does not carry" REMOVED when required

13.3  CARE, CUSTODY AND CONTROL                  ENTITY Lessee only
      Lessor requires CCC        require / do not require
      Lessee declares CCC        has / will obtain / does not carry
                                 └─ "does not carry" REMOVED when required
```

**Each section is self-contained** — requirement, declaration and terms in one place. A reader
of 13.3 never has to go back to 13.2 to learn whether CCC was required.

**`GL_AND_CCC` IS REMOVED as a value.** It is replaced by two independent answers. Note what
that also removes: the bundle made CCC impossible to require without also requiring GL — a
constraint that was encoded by accident rather than chosen.

**`TXN.CCC_LESSEE_STATUS` gains a third option.** It currently has only `HAS` and
`WILL_OBTAIN`. It gets a "does not carry" equivalent, gated exactly as GL's is — present when
CCC is not required, absent when it is.

**13.3 now shows for EVERY entity Lessee**, not only when CCC was required. An entity declares
its CCC position either way, for the same reason the Lessee declares GL either way: *not
required is not the same as not having.* Individual Lessees never see 13.3 at all.

### (superseded by the above) CCC — split entirely. The bundled value goes.

> Owner: *"either we split entirely or we merge properly. realizing that CCC is an option that
> lessor only can require of an entity and they dont need to require it."*

Two properties a bundled option cannot carry: CCC is askable **only of an entity**, and it is
**independently optional**. Bundling it into a GL option that also serves individual Lessees is
what made the original incoherent.

**`GL_AND_CCC` is removed as a value.** GL requirement and CCC requirement become two
questions, each with its own visibility rule and the same declare/require shape.

---

### (superseded) The concern this replaced

The owner asked for a "does not carry" option for the Lessee and it went live today
(`f2b88b3`, `when` removed). **Under this structure the Lessee either answers a requirement —
has / will obtain — or has no section at all.** There is no third state for them to occupy.

**ASK THE OWNER before removing or keeping it.** Removing it reverses a change he explicitly
requested; keeping it reintroduces the branch this structure was designed to eliminate.
Whichever way it goes, `docs/tasks/TASK-LEASEFIX-13.2-lessee-decline-option.md` is superseded
and must be closed out rather than left as a live spec.

### ALSO UNRESOLVED: is CCC merging back in, or keeping its own block?

The original request said **remove the bundled GL+CCC option and give CCC its own requirement
block.** This ruling says *"if we are merging CCC into this block then there is an additional
set of options."* **Those point opposite ways. ASK.**

---

## The two that were never candidates

**"Other" leads nowhere.** The owner named "Other" as one of three options he wants. It
prints `The cost of the policy is Other.` with no follow-up. **That is a defect in a legal
instrument, not a design choice** — it needs its free-text follow-up. Do not remove the option
to avoid building the field.

**The deductible split.** The owner asked for the *gating* to be fixed — it currently renders
even where the Lessor pays for the policy outright. He did NOT ask for the split mechanism to
be replaced with a stated legal default. **Fix the gate. Leave the mechanism.** Replacing it
changes what silence means in an executed contract and is a separate decision.

---

## `ClauseDocument.tsx` — the freeze is a STOP-AND-PROPOSE rule, not a prohibition

Recorded 2026-08-10 because task docs have been writing "FROZEN" without the second half, and
threads have twice read it as absolute, hit a genuine need, and stepped over it.

**The actual rule** (`docs/SESSION_HANDOFF_2026-08-07.md`): *scoped exceptions only by
orchestrator approval.* `BUILD_TRACKER` A21 is the worked example — minimal diff presented,
approved, then applied.

**Why it exists** — CORRECTED 2026-08-10, the earlier rationale leaned on a premise the owner
has since retracted. It is **not** about protecting one document: Sarah's is a sample under
review, there are no real contracts in play, and **the owner wants template changes to reach
everything.**

The real reason is narrower and still holds: it is the **single authoring surface for every
template** — lease, sale, bill of sale — 1055 lines, with no way to scope a change to one of
them. `BUILD_TRACKER` A21 is the worked example: one clause body matching the wrong layout
branch produced three defects across two root causes, and the fix had to be proven to have
zero effect on `HORSE_SALE_V2` before it could ship.

**61 EXECUTED documents remain evidence and are never rewritten.** That line does not move.

**So:** if this task needs a change there, **present the minimal diff and wait.** Do not apply
it, and do not treat the word FROZEN as a reason to route the change somewhere worse.

## Still open, and NOT for the thread to decide

- **THE SPLIT IS ONE PERCENT FIELD. No chooser is built. SETTLED 2026-08-10.**

  > Owner: *"the unification of the $/% system for splits needs to be done properly. i specced
  > something different than what we already had in the system… the one implemented elsewhere is
  > likely the right approach and my authored approach is likely best fit to throw out and the
  > current implementation on the contract in the insurance section we can both agree is totally
  > fubar."*

  **He is right, and his own earlier ruling is what settles it.**

  **What the system already does, live on all four lease templates:**

  ```
  TXN.TRAINER_EXERCISE_SPLIT_PCT   format_type: percent   "Lessee's share of the cost"
  ```

  reading, in the clause body:

  ```
  Party responsible for costs:   {{TXN.TRAINER_EXERCISE_COST}}
  Lessee's share of the cost:    {{TXN.TRAINER_EXERCISE_SPLIT_PCT}}
  ```

  **A who-pays election, then ONE percent naming one party's share.** The other party's share
  is arithmetic. **The insurance section already has the first half** — "paid by Lessor /
  split / Other". It needs the second half to be one field rather than four.

  ### CORRECTED 2026-08-10 — THE UNIT SELECTOR STAYS. Percent-only is insufficient.

  > Owner: *"the case where the lessor says just give me $100 toward the insurance isnt possible
  > with just a % field."*

  **He is right and the orchestrator's argument for percent-only was wrong.**

  It claimed a percentage expresses any dollar split losslessly. **It does not.** A fixed
  contribution and a proportion are **different agreements, not two notations for one:**

  | | at signing | at renewal, premium rises |
  |---|---|---|
  | `10%` | $100 of $1,000 | **$150** of $1,500 — floats |
  | `$100` | $100 of $1,000 | **$100** of $1,500 — fixed |

  Converting "$100 toward it" into "10%" **changes what was agreed** the moment the premium
  moves. The proportion is lossless only if the agreement was proportional to begin with.

  **AND THE STRONGER CASE — a percentage can be UNDEFINED, not merely awkward.**

  > Owner: *"or the owner has more than one thing on that policy and a percent of an unknown
  > number is not possible to calculate."*

  **A mortality policy often covers more than the leased horse.** If the Lessor insures four
  horses on one policy and the Lessee leases one of them, "the Lessee's share is 10%" asks:
  **10% of what?**

  - 10% of the blended premium makes the Lessee contribute toward three animals they have no
    interest in.
  - 10% of *this horse's* portion requires a per-horse figure that **frequently does not
    exist** — the premium is written for the group, not itemised.

  **So `$100 toward the policy` is not a rounder way of stating a percentage. It is the only
  well-defined term available in that arrangement.** This is not an edge case: a lessor with a
  barn is the ordinary lessor.

  **A consequence for the clause text when `%` IS used:** the body must make clear what the
  percentage is a percentage OF. "Lessee's share of the cost: 10%" is unambiguous only where the
  policy covers the leased horse alone. **Draft that wording and bring it to the owner** — it is
  clause text, not a control decision.

  **The premium-is-a-fact ruling does not cover this either.** `$100` is not the premium — it is
  the **contribution**. The premium is what the policy costs; the contribution is what the Lessee
  agreed to pay. Only the first belongs in an appendix, and keeping the second out of the clause
  would remove the term itself.

  ### THE GENERAL PRINCIPLE — the two units ALLOCATE RISK DIFFERENTLY.

  > Owner: *"and conversely when the policy isnt in place the lessee can agree to a fixed number
  > or they can agree to a split."*

  **This is the rule; the two cases above are instances of it.**

  | | what the Lessee agreed to | their exposure |
  |---|---|---|
  | **`$100`** | a fixed contribution | **CAPPED.** Known at signing, unchanged by the premium |
  | **`50%`** | a share of the cost | **FLOATS.** Half of a number that may not exist yet |

  **When the policy is not yet obtained, both are meaningful and they mean different things.**
  A percentage commits the Lessee to half of an unknown; a fixed amount caps them at a known
  figure. **Which one the parties chose is precisely what a contract exists to record.**

  **So neither unit substitutes for the other in ANY state:**

  - policy in force, covering the leased horse alone -> both valid, different risk
  - policy in force, covering several horses -> **`%` is undefined**, `$` required
  - policy not yet obtained -> both valid, different risk

  **A control offering one unit cannot express the agreement in two of those three states.**
  That is why the selector exists — not for convenience.

  ### SO: the existing pattern's DISCIPLINE, plus the unit from the owner's spec.

  ### THE CONTROL — a COMPOSITE format_type. Settled 2026-08-10.

  > Owner: *"unless the config for the entry for that field was selection that gets composed at
  > render time. then they can select the \$/% first, then enter a number, and it renders as
  > \$100 or 100%."*

  **This is the answer. It supersedes both the two-slot geometry and the single-dropdown
  simplification the orchestrator proposed.**

  ```
  authoring:   [ $ | % ]  [ number ]
  composed:    $100     or     100%
  ```

  The author picks the unit, types a number, and the field **composes the correct form at render
  time** — symbol before for currency, after for percent.

  **The orchestrator objected that "the document IS the form" means the control's position is
  the document's position. That was too literal and it is wrong.** The system already has SEVEN
  composite kinds whose authoring shape differs from their composed text:

  ```
  buttons 41 · add_text 8 · reveal_text 4 · week_grid 4 · med_schedule 4 · fee_schedule 4 · contacts_list 4
  ```

  `week_grid` is a grid while authoring and prose in the body. **A share control is the eighth of
  its type, not a new architectural concept.**

  ### This is ALSO why `*_SPLIT_TEXT` exists — and why it stops being needed

  `TXN.MORT_COST_SPLIT_TEXT` and `TXN.MED_COST_SPLIT_TEXT`, both labelled "Split (composed)",
  are **composition bolted on as a second field** because no composite kind existed to hold it.

  **Putting the composition inside the control removes the reason those fields exist.** They are
  not merely deleted — they are made unnecessary. Same for the per-party pair: one composite
  field naming one party replaces four.

  **One field. One party named. One value, in one of two units, composed correctly.**



  - `%` → the Lessor's share is `100 − X`, arithmetic, unstated.
  - `$` → the Lessor pays the remainder, arithmetic, unstated.

  **What survives from the trainer pattern:** one field naming one party, never two independent
  fields that can contradict each other. That is the part the insurance section got wrong.

  **What survives from the owner's spec:** the unit selector, because a fixed contribution is a
  term the contract must be able to express.

  **What is thrown out:** the per-party pair (`*_SPLIT_LESSEE` **and** `*_SPLIT_LESSOR`), the
  composed `*_SPLIT_TEXT`, and the floating `Allocation` field.

  ### What this replaces

  | | now | after |
  |---|---|---|
  | split declaration | 2 untyped free-text fields + `*_SPLIT_TEXT` ("Split (composed)") + the floating `Allocation` field | **one `percent` field** |
  | control work | — | **a unit selector on ONE field.** `currency` and `percent` already ship; this adds the `$`/`%` choice to a single control rather than building a per-party pair |
  | consistency | two independent fields can both say 60% | **impossible — one number** |

  ### Applies everywhere a split is declared

  Mortality, medical, and the GL/CCC deductible splits. **Same field shape, same label form,
  same position.** `TXN.MED_COST_SPLIT_LESSEE` / `_LESSOR`, `TXN.MORT_COST_SPLIT_LESSEE` /
  `_LESSOR`, `TXN.GL_DED_RESP_SPLIT_*`, `TXN.MED_DED_RESP_SPLIT_*` all collapse to one `percent`
  field each, and the `*_SPLIT_TEXT` fields are deleted.

  **Name whose share it is in the label, not in the value** — "Lessee's share of the cost",
  exactly as the trainer clause does. Do not write the unit into the label; `percent` renders it.

  **A `ContractCascade` change IS needed** — the unit selector does not exist today. The thread's
  plan stands: **present the diff and WAIT.** It is a shared authoring surface, and
  `ClauseDocument.tsx` is stop-and-propose.

- **13.2's Lessee question still means two things across branches.** This is the root cause of
  the contradiction found on 2026-08-10 — see
  `docs/tasks/TASK-LEASEFIX-13.2-lessee-decline-option.md`. Worth resolving in the same pass.
