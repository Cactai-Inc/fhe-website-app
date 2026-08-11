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

**The orchestrator's reading, stated so it can be corrected in one word rather than discovered
in a signed lease:** what goes is every line that records *an amount*. What stays is the
**who-bears-it election** the owner specified by name — "paid by Lessor" / "split between
Lessor and Lessee" / "Other" — because he wrote those three options out deliberately.

**If that reading is wrong and the whole cost question goes, say so** — it changes whether the
`$ or %` share control needs building at all.

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

## Still open, and NOT for the thread to decide

- **The `$ or %` share control does not exist** and must be built: a null-or-`$` selector, a
  number-only input, and a null-or-`%` alternate that greys when `$` is selected. The owner
  specified it precisely. Build it once and use it in both places — which is why structure
  settles first.
- **13.2's Lessee question still means two things across branches.** This is the root cause of
  the contradiction found on 2026-08-10 — see
  `docs/tasks/TASK-LEASEFIX-13.2-lessee-decline-option.md`. Worth resolving in the same pass.
