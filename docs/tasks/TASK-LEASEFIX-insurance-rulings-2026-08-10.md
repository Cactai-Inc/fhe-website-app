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

- **The `$ or %` share control is a REBUILD, not a new build. CORRECTED 2026-08-10.**

  > Owner: *"this needs rebuilding, it already exists but its written in a confusing manner
  > with too much text."*

  The thread reported *"the control you specified doesn't exist."* **That is wrong, and the
  orchestrator relayed it without checking.** Verified against production:

  `currency` and `percent` are both real `format_type` kinds, implemented in
  `ContractCascade.tsx:903-906` (currency renders a `$` affix, percent a `%`), and already in
  production use on `TXN.TRAINER_EXERCISE_SPLIT_PCT`.

  **Every share field is untyped** — `format_type` is empty, so it falls through to plain text
  and **the unit is written into the LABEL to compensate**:

  ```
  TXN.MORT_COST_SPLIT_LESSEE    (none)   "Lessee's share ($ or %)"
  TXN.MORT_COST_SPLIT_LESSOR    (none)   "Lessor's share ($ or %)"
  TXN.MED_COST_SPLIT_LESSEE     (none)   "Lessee's share ($ or %)"
  TXN.MED_COST_SPLIT_LESSOR     (none)   "Lessor's share ($ or %)"
  TXN.GL_DED_RESP_SPLIT_LESSEE  (none)   "Split — % paid by Lessee"
  TXN.GL_DED_RESP_SPLIT_LESSOR  (none)   "Split — % paid by Lessor"
  TXN.MED_DED_RESP_SPLIT_*      (none)   "Deductible split — paid by …"
  ```

  **That is the "too much text": the label is doing the control's job.** The same defect the
  owner named about the placeholder — it reads as unauthored because a typed control was never
  wired, not because the control was missing.

  **The work:** type the fields, strip the unit out of every label, and extend the existing
  kind to the owner's shape — a null-or-`$` selector, a number-only input, and a null-or-`%`
  alternate that greys when `$` is selected. **Do not build a parallel control** beside
  `currency`/`percent`; extend what is there and reuse it everywhere the table above lists.

  **His reasoning, worth keeping:** *"they will use % when the policy cost is unknown and they
  will use $ when the policy cost is known."* It must support both because parties may agree a
  proportion before a premium exists — the same reason the premium is not in the clause.

  `TXN.MORT_COST_SPLIT_TEXT` and `TXN.MED_COST_SPLIT_TEXT`, both labelled "Split (composed)",
  are the redundant line the owner ordered removed. They go with this pass.

- **13.2's Lessee question still means two things across branches.** This is the root cause of
  the contradiction found on 2026-08-10 — see
  `docs/tasks/TASK-LEASEFIX-13.2-lessee-decline-option.md`. Worth resolving in the same pass.
