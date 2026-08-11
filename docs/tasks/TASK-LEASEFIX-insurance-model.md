# 13.2 – 13.5 — the model, before assembling it

**2026-08-10. Nothing in here is applied.** The migration is written and held
(`20260810T1100_…`, uncommitted) so the shape can be argued with first.

---

## 13.2 General liability — 2 questions, 3 leaves

```
Q1 Lessor          has · will obtain · does not carry        -> one paragraph, gates nothing
Q2 Requires of Lessee
   ├─ general liability
   │     Q3 Lessee   has · will obtain · does not carry      -> one paragraph
   │     Q4 Deductible borne by  Lessor·Lessee·Split·Other
   │        └─ Split -> two share inputs
   │        └─ Lessee|Split -> Lessee acceptance checkbox
   └─ nothing
         Q3 Third-party costs   Lessor assumes all · each bears its own at-fault
            └─ at-fault -> Q4 Lessee  has · will obtain · does not carry
```

Unchanged by this pass except that **`GL_AND_CCC` is removed** — CCC moves out.

---

## 13.3 Care, custody and control — entity Lessee only

```
LESSEE.PARTY_TYPE = ENTITY ?  no -> section does not exist
                              yes
   Q1 Lessor requires CCC of Lessee    required · not required
      ├─ not required -> one sentence. Lessee completes nothing. END
      └─ required     -> negligence paragraph
                         Q2 Lessee   has · will obtain
                         Q3 Lessee acceptance checkbox (cost)
```

The Lessor never holds CCC on their own horse, so there is no Lessor-side status
here — only require / do not require. That is the whole section.

---

## 13.4 Mortality — the merge

**Two dropdowns collapse into one.** Today: "is it required?" then "does the Lessor
have it?" — two questions with one real answer between them.

```
Q1 Mortality       (single election, governs everything below)
   ├─ Lessor does not carry a policy
   │     -> "Lessor does not carry mortality insurance… accepts full risk…"
   │     -> 13.5 Medical prints N/A. END
   ├─ Lessor carries a policy
   │     -> "Lessor carries a mortality insurance policy… first policy noticed
   │         and claimed against…"
   └─ Lessor will obtain a policy
         -> "Lessor will obtain a mortality insurance policy… first policy
             noticed and claimed against…"

   carries | will obtain:
   Q2 The cost of the policy is   paid by Lessor · split · Other
      └─ split -> Lessor: [share]   Lessee: [share]
      └─ split|Other -> Q3 Deductible borne by  Lessor·Lessee·Split·Other
                        └─ Split -> two share inputs
                        └─ Lessee acceptance checkbox
   -> 13.5 Medical opens
```

**Deleted:** the "shall be split between the parties: [Split (composed)]" line (it
restated the line above), the policy-cost input, and the floating "Allocation"
box. Premiums go in an appendix or an added line item.

**Deductible now gated on the Lessee carrying some cost** — that is the reported
bug: it was asking who pays the deductible even where the Lessor pays for the
policy outright.

## 13.5 Medical — identical shape, one gate in front

```
mortality = carries|will obtain ?  no -> "Not applicable… no mortality policy…" END
                                   yes
   Q1 Medical included on the policy   yes · no
      └─ no  -> one sentence. END
      └─ yes -> same Q2/Q3 tree as mortality, word-for-word
```

---

## Where it can simplify further — five candidates

**1. Mortality and medical are the same machine.** Q1 election → cost → shares →
deductible → acceptance, twice, in 2 clauses and 10 fields each. Medical is
mortality with a yes/no in front. If medical's cost is *usually* handled the same
way as mortality's, one question — "medical is included and its cost is handled
the same way" — replaces the entire duplicated tree, with the full tree appearing
only when the answer is "handled differently". **Biggest reduction available.**

**2. The deductible split may not need to exist.** Where the premium is already
split Lessor/Lessee, a second, differently-proportioned split of the deductible is
possible but unusual. "Deductibles are shared in the same proportion as the
premium unless stated otherwise" is one sentence and removes 3 controls per
section (6 total).

**3. "Other" on the cost question leads nowhere.** It has no follow-up field, so
choosing it prints "The cost of the policy is Other." Either it needs a free-text
line or it should go. Same on the deductible question.

**4. The acceptance checkbox may be redundant.** The Lessee signs the contract;
the signature is the acceptance. Its real job is to *block execution* until the
Lessee has looked at a cost the Lessor allocated to them — but a required, unanswered
Lessee share already blocks execution, and the checkbox is the only control that
does not render in the muted preview (below). If it is dropped, non-acceptance
stays what you said it should be: the absence of an answer.

**5. 13.2's Lessee question is asked in two different branches** with different
option sets, driven by option-level `when`. It works, but it is the one place in
the section where the same control means two different things. Worth a look once
the rest settles.

---

## Two things that need frontend work, not data

**The "$ or %" share control.** You specified `[$|—] [number] [—|%]`. The engine
has `currency` and `percent` input kinds but no combined selector, so this is a
new control in `ContractCascade`. Until it exists the shares stay plain text
inputs — I removed the "($ or %)" from their labels so they no longer read as
hand-authored, but that is cosmetic. **Recommend building it once and using it in
both sections**, which is the argument for settling the structure first.

**The acceptance checkbox does not render unselected.** Confirmed cause: a muted
preview renders only fields whose *own* `conditional_on` is met
(`ClauseDocument`, the `orphanFields` filter). The checkbox carries the same gate
as its clause, so when the clause is gated off the control is filtered out — the
caption prints with nothing under it. Removing the field's gate would fix the
display and break `contract_lock_blockers`, which reads that same gate to decide
whether the acceptance is owed. So it is a render-rule change, not a data change —
which is another reason candidate 4 is worth deciding first.
