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
