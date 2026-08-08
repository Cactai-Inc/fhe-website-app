# TASK LEASEGATE — Phase 1: map and impact analysis

**Analysis only. Nothing was written.** No migration authored, no template row changed,
no document touched. Every statement below that says "verified" was produced by querying
production `lrstswfxfsezdmvkvukc` or reading live source in this worktree.

Branch `task/leasegate`, worktree `~/Downloads/claude-code-repo/wt-leasegate`, off
`origin/main` @ `0635acb`.

> **Filename note.** The task doc asks for `TASK-LEASEGATE-PHASE1-MAP.md`; the thread
> prompt asks for `TASK-LEASEGATE-PHASE1.md`. This is the latter. Only one file was
> written.

---

## The headline: three findings that should change the plan

**1. R3 already exists.** `contract_lock_blockers` carries a "D3" branch that blocks
execution when a section has both statuses `NONE`, no waiver, and no Lessee-responsibility
election — for **all three sections**, not just GL. "At least one party carries general
liability" is enforced today, at execution, with a written message. R3 is not new
construction; the question is whether the owner wants it *stricter* than it already is.

**2. R4 as written makes the owner's live client arrangement unexecutable, and deletes
the clauses that allocate the risk.** Verified by running the live evaluator: with the
waiver gone and both parties `NONE`, `GL_NONE`, `MORT_NONE` and `MED_NONE` all stop
printing — the three sentences in which the Lessor accepts the risk — and the same D3
blocker then fires on all three sections, so the document cannot be locked at all. The
arrangement is not merely weakened. It becomes unreachable.

**3. R1 and R2 open the door they are meant to close.** Forcing the Lessee's mortality and
medical status to `NONE` satisfies the gate on `TXN.MORT_LESSEE_RESPONSIBLE` /
`TXN.MED_LESSEE_RESPONSIBLE` whenever the Lessor is also `NONE`. The Lessee is then offered
a checkbox whose clause reads *"Lessee shall obtain and maintain, at Lessee's sole cost,
mortality insurance on the Horse"* — the exact undertaking R1 declares them ineligible to
make. Verified: gate evaluates `true` in that configuration.

---

## Provenance

**Template.** `HORSE_LEASE_STANDARD` exists with 22 sections, 144 clauses, 117 fields —
22 of those fields and 35 of those clauses in `INSURANCE_RISK`. Prerequisite confirmed by
me, not taken on trust.

**It is currently a byte-identical fork of V2.** All four lease templates hash the same
across sections, clauses and fields:

```
HORSE_LEASE_FULL     b0001b34c40c1e2a5fc193a28379c073
HORSE_LEASE_SIMPLE   b0001b34c40c1e2a5fc193a28379c073
HORSE_LEASE_STANDARD b0001b34c40c1e2a5fc193a28379c073
HORSE_LEASE_V2       b0001b34c40c1e2a5fc193a28379c073
```

Two consequences. Every LEASEMAP finding transfers to STANDARD unaltered — I re-derived
the ones this task depends on rather than assuming. And this hash is the Phase 2 baseline:
`_V2`, `_FULL` and `_SIMPLE` must still read `b0001b34…` afterwards. Recomputed at the end
of this phase: unchanged.

**`TXN.LEASE_TYPE` on STANDARD.** Re-verified independently. It gates exactly three
clauses — `SCHEDULE.MAIN`, `SCHEDULE.OTHER`, `SCHEDULE.CHANGES` — and zero fields. Nothing
in `INSURANCE_RISK`. LEASEMAP's central finding holds on this template.

**No document is on STANDARD.** All four lease documents sit on `HORSE_LEASE_V2`,
including Sarah's `704c8d2d` (`AWAITING_SIGNATURE` / `in_review`), which I read and did not
write. `start_lease_contract_v2` still defaults `p_template_key` to `'HORSE_LEASE_V2'`.
**So Phase 2's gates will not appear on any lease anyone creates until that default is
flipped.** That cutover is not in this task's scope and I have not assumed it happened.

**TIPTAP.** `src/components/app/ExplainTip.tsx` is present and is tap-capable — pinned
bubble on click/tap, hover preview gated on `(hover: hover) and (pointer: fine)`, body
portal. It is already imported by `ClauseDocument.tsx`. Prerequisite confirmed.

**Grammar.** Read from `clause_condition_met`: `all`, `any`, and a leaf of `field_key`
plus one of `equals` / `contains` / `gte`. **There is no negation operator.** "Not NONE" is
only expressible by enumerating the positives, `{"equals": ["HAS_WILL_MAINTAIN",
"WILL_OBTAIN"]}` — which the existing deductible gates already do. The shape in the task
doc is correct.

---

## 1a. The map

All 22 `INSURANCE_RISK` fields on `HORSE_LEASE_STANDARD`, in document order (clause
`sort_order`, then field `sort_order`). Care, Custody & Control is out of scope and its
one field — there is none; `CCC` renders `HORSE.FAIR_MARKET_VALUE`, a `HORSE` field — is
not listed.

Status options are identical on all six status fields:
`HAS_WILL_MAINTAIN` = "Has and will maintain" · `WILL_OBTAIN` = "Will obtain and will
maintain" · `NONE` = "Does not have and will not obtain".
Deductible options are identical on all three: `LESSOR` · `LESSEE` · `SPLIT` · `OTHER`.

### General Liability

| Field key | Clause | Owner | Req? | Options | Current gate (plain English) | Proposed rule | Forced value |
|---|---|---|---|---|---|---|---|
| `TXN.GL_NOT_REQUIRED` | `GENERAL_LIABILITY` | LESSOR | no | checkbox YES/NO | always shown | **R4** — removal | n/a (removed) |
| `TXN.GL_LESSOR_STATUS` | `GL_STATUS` | LESSOR | **yes** | 3 status | GL waiver not ticked | **R3** candidate | see R3 options |
| `TXN.GL_LESSEE_STATUS` | `GL_STATUS` | LESSOR | **yes** | 3 status | GL waiver not ticked | **R3** candidate | see R3 options |
| `TXN.GL_DED_RESP` | `GL_DED_SIMPLE` | LESSOR | **yes** | 4 ded. | GL waiver not ticked | none | — |
| `TXN.GL_DED_RESP_SPLIT_LESSOR` | `GL_DED_SPLITC` | LESSOR | no | text | waiver off **and** `GL_DED_RESP = SPLIT` | none | — |
| `TXN.GL_DED_RESP_SPLIT_LESSEE` | `GL_DED_SPLITC` | LESSOR | no | text | waiver off **and** `GL_DED_RESP = SPLIT` | none | — |
| `TXN.GL_LESSEE_RESPONSIBLE` | `GL_LESSEE_RESP` | LESSEE | no | checkbox YES/NO | both GL statuses `NONE` **and** waiver off | **R4** interaction | — |

### Mortality

| Field key | Clause | Owner | Req? | Options | Current gate (plain English) | Proposed rule | Forced value |
|---|---|---|---|---|---|---|---|
| `TXN.MORT_NOT_REQUIRED` | `MORTALITY` | LESSOR | no | checkbox YES/NO | always shown | **R4** — removal | n/a (removed) |
| `TXN.MORT_LESSOR_STATUS` | `MORT_STATUS` | LESSOR | **yes** | 3 status | mortality waiver not ticked | none | — |
| `TXN.MORT_LESSEE_STATUS` | `MORT_STATUS` | **LESSOR** | **yes** | 3 status | mortality waiver not ticked | **R1** | `NONE` (see Q4) |
| `TXN.MORT_DED_RESP` | `MORT_DEDR_SIMPLE` | LESSOR | **yes** | 4 ded. | mortality waiver not ticked | none | — |
| `TXN.MORT_DED_RESP_SPLIT_LESSOR` | `MORT_DEDR_SPLITC` | LESSOR | no | text | waiver off **and** `MORT_DED_RESP = SPLIT` | none | — |
| `TXN.MORT_DED_RESP_SPLIT_LESSEE` | `MORT_DEDR_SPLITC` | LESSOR | no | text | waiver off **and** `MORT_DED_RESP = SPLIT` | none | — |
| `TXN.MORT_LESSEE_RESPONSIBLE` | `MORT_LESSEE_RESP` | LESSEE | no | checkbox YES/NO | both mortality statuses `NONE` **and** waiver off | **collides with R1** | — |

### Medical

| Field key | Clause | Owner | Req? | Options | Current gate (plain English) | Proposed rule | Forced value |
|---|---|---|---|---|---|---|---|
| `TXN.MED_NOT_REQUIRED` | `MEDICAL` | LESSOR | no | checkbox YES/NO | always shown | **R4** — removal | n/a (removed) |
| `TXN.MED_LESSEE_RESPONSIBLE` | `MED_LESSEE_RESP` | LESSEE | no | checkbox YES/NO | both medical statuses `NONE` **and** waiver off | **collides with R2** | — |
| `TXN.MED_LESSOR_STATUS` | `MED_STATUS` | LESSOR | **yes** | 3 status | medical waiver not ticked | none | — |
| `TXN.MED_LESSEE_STATUS` | `MED_STATUS` | **LESSOR** | **yes** | 3 status | medical waiver not ticked | **R2** | `NONE` (see Q4) |
| `TXN.MED_DED_RESP` | `MED_DEDR_SIMPLE` | LESSOR | **yes** | 4 ded. | medical waiver not ticked | none | — |
| `TXN.MED_DED_RESP_SPLIT_LESSOR` | `MED_DEDR_SPLITC` | LESSOR | no | text | waiver off **and** `MED_DED_RESP = SPLIT` | none | — |
| `TXN.MED_DED_RESP_SPLIT_LESSEE` | `MED_DEDR_SPLITC` | LESSOR | no | text | waiver off **and** `MED_DED_RESP = SPLIT` | none | — |

Nine fields are required; the two R1/R2 targets are among them, which is why the
gate-the-option-force-the-value model is the right shape. Note that both R1/R2 targets are
`owner_role = LESSOR` — the Lessor writes the Lessee's status. That is LEASEMAP's
declaration-versus-fact finding, unchanged here, and it means "forcing" these values does
not take anything away from the Lessee that they had.

---

## 1b. Impact analysis

Computed by calling the live `clause_condition_met` with each scenario's field map — the
same function the composer calls — and by evaluating the D3 blocker predicate verbatim.
This is a computed result, not a reading of the JSON.

### Clause set per scenario (`INSURANCE_RISK`, conditional clauses only)

| Clause | S1 full, open | S2 partial R1/R2, Lessor covered | S3 partial R1/R2, Lessor **not** covered | S4 **today**: waives all three | S5 **after R4**: waiver gone, both NONE | S6 partial + R1/R2 + R4 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `GL_STATUS` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `GL_DED_SIMPLE` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `GL_NONE` | ❌ | ❌ | ❌ | **✅** | **❌** | ❌ |
| `GL_LESSEE_RESP` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `MORT_STATUS` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `MORT_DEDR_SIMPLE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `MORT_NONE` | ❌ | ❌ | ❌ | **✅** | **❌** | ❌ |
| `MORT_LESSEE_RESP` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `MED_STATUS` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `MED_DEDR_SIMPLE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `MED_NONE` | ❌ | ❌ | ❌ | **✅** | **❌** | ❌ |
| `MED_LESSEE_RESP` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `MED_TAIL` | ✅ | ✅ | ✅ | ❌ | **✅** | ✅ |

(The four activity-risk clauses, `CCC` and `COORDINATION` are off in all six because no
activities were set and the Lessee is an individual; they are unaffected by R1–R4.)

### Execution blocker per scenario

Evaluating the D3 predicate from `contract_lock_blockers` verbatim:

| Scenario | Sections blocked |
|---|---|
| S1 full, all open | none |
| S2 partial R1/R2, Lessor covered | none |
| **S3** partial R1/R2, Lessor not covered, waiver still available | **Mortality, Medical** |
| S4 today: Lessor waives all three | none |
| **S5** after R4: waiver gone, both NONE | **General liability, Mortality, Medical** |
| **S6** partial + R1/R2 + R4, Lessor not covered | **Mortality, Medical** |
| S7 partial + R1/R2, Lessee accepts responsibility | none |

### What this means, rule by rule

**R1 / R2 — safe when the Lessor carries the cover, load-bearing when they don't.**

In S2 the forced `NONE` costs nothing: the deductible chain survives on the Lessor's own
cover (`{"any": [...]}` needs only one side positive), no clause changes, no blocker. The
printed sentence becomes *"Lessee: Does not have and will not obtain mortality insurance on
the Horse."* — which for a partial lease is true.

In S3 it is a different rule. Forcing the Lessee to `NONE` when the Lessor is also `NONE`:

- kills `MORT_DEDR_SIMPLE` and `MED_DEDR_SIMPLE` — the deductible allocation sentence
  disappears from both blocks;
- **opens `TXN.MORT_LESSEE_RESPONSIBLE` and `TXN.MED_LESSEE_RESPONSIBLE`** (verified
  `true`), offering the Lessee an election to buy the very cover R1/R2 call ineligible;
- **blocks execution** on both sections unless the Lessor waives, the Lessor takes cover,
  or the Lessee makes that contradictory election.

So R1 and R2 can only be stated as "the Lessee cannot carry this" if something also says
what happens when the Lessor doesn't either. That is currently the waiver — which R4
removes.

**R3 — already enforced, and stricter than the rule as written.** The existing D3 branch
covers all three sections, not just GL. If the owner's intent is only GL, today's behaviour
is already broader than R3. If the intent is "at least one party must actually hold GL",
today's behaviour is *narrower*, because `TXN.GL_LESSEE_RESPONSIBLE = YES` clears the
blocker while both statuses stay `NONE` — a promise to buy, not a policy.

**R4 — this is the one to stop on.** S4 → S5 is the owner's live client arrangement before
and after. The three sentences that lose their gate are:

> `GL_NONE` — "Lessor has elected not to require general liability insurance under this
> Agreement. Lessor accepts full risk and responsibility for liability claims for bodily
> injury or property damage to third parties arising from the Horse or the activities
> contemplated by this Agreement, except as otherwise expressly allocated in this
> Agreement."

> `MORT_NONE` — "Lessor has elected not to require mortality insurance under this
> Agreement. Lessor accepts full risk and responsibility for the loss of the Horse's value
> in the event of the Horse's death, theft, or humane destruction, except as otherwise
> expressly allocated in this Agreement."

> `MED_NONE` — "Lessor has elected not to maintain medical insurance on the Horse. Lessor
> accepts full risk and responsibility for any and all injury to or illness of the Horse
> during the term of this Agreement, including all costs of veterinary care arising from
> such injury or illness, except as otherwise expressly allocated in the Horse Care and
> Expenses section of this Agreement."

What replaces them in S5 is three bare status lines — *"Lessor: Does not have and will not
obtain … Lessee: Does not have and will not obtain …"* — which state a fact and allocate
nothing. Medical alone gets a partial substitute, because `MED_TAIL` switches **on** in S5
and carries *"Lessor assumes and is responsible for all risks and costs not paid or covered
by any policy held by either party."* **General liability and mortality get no replacement
allocation at all.** And the document cannot be signed regardless, because D3 fires on all
three.

**Configurations that become unreachable after R4:** the no-insurance arrangement, in full.
Stated plainly, as the task asks: **yes, the owner's live client configuration stops being
expressible.** Not degraded — unexecutable.

**Rules that contradict each other:** R1/R2 versus the `*_LESSEE_RESPONSIBLE` gate (above),
and R1/R2 versus R4 (S6: with the waiver gone and the Lessor uncovered, a partial lease has
no legal move left — the Lessee cannot elect, the Lessor cannot waive, and D3 blocks).

---

## 1c. Open questions — answered

### Q1. What replaces the waiver?

**"Both parties select NONE" does not reproduce today's behaviour, and the checkbox is not
redundant.** Verified: the `*_NONE` clauses gate on `{"equals": ["YES"], "field_key":
"TXN.*_NOT_REQUIRED"}`. With the field gone, the value is never `YES`, so they never print.
They are load-bearing exactly as the task suspects, and under R4-as-written they are lost.

Two workable answers, both requiring more than removing a column:

- **Re-gate onto both-parties-NONE.** Change each `*_NONE` gate to
  `{"all": [{"equals": ["NONE"], "field_key": "TXN.<SEC>_LESSOR_STATUS"}, {"equals":
  ["NONE"], "field_key": "TXN.<SEC>_LESSEE_STATUS"}]}`, and amend the D3 branch in
  `contract_lock_blockers` (and the identical predicate in `insurance_resolution_sync`) so
  both-NONE is a resolved state rather than a blocker. This preserves the arrangement and
  the risk-acceptance text. It costs the *distinction* between "the Lessor deliberately
  waived" and "nobody got round to it" — which is precisely what the checkbox encodes today
  and why it is party-exclusive in `set_contract_field`.
- **Keep the waiver.** R4 is the only rule in the set that removes an owner capability
  rather than adding a restriction, and it is the only one with a named live client
  depending on it.

My reading: R4 looks like it was scoped as a tidy-up and is the most expensive item in the
task. I recommend the owner resolve it before R1/R2 are built, because R1/R2's failure mode
in S3 is currently absorbed by the waiver.

### Q2. Does R4 apply to all three sections, or only GL?

**Cannot be inferred — needs the owner.** Mechanically the three checkboxes are symmetric.
But the impact is not: removing the mortality and medical waivers eliminates
`MORT_NONE` and `MED_NONE`, which is the arrangement the owner has described as real.
Removing only GL's would leave GL with no "Lessor accepts liability risk" sentence while
mortality and medical keep theirs — an asymmetry someone should choose deliberately rather
than inherit. **Confirm before removing anything.**

### Q3. R3 — how is "at least one" enforced?

The grammar cannot express a two-field rule in a single field's gate, correct. But the
system does not need it to, because the rule is already enforced at execution. The options,
with trade-offs, no pick made:

| Option | How | Trade-off |
|---|---|---|
| **(a) Leave it** | D3 in `contract_lock_blockers` already blocks all three sections | Zero work, zero risk. The block arrives at signing, not at selection — the party learns late. Also clearable by a *promise* (`GL_LESSEE_RESPONSIBLE`), not a policy |
| **(b) Force the Lessor's GL when the Lessee's is NONE** | `ineligible_when` on `TXN.GL_LESSOR_STATUS` = `{"equals": ["NONE"], "field_key": "TXN.GL_LESSEE_STATUS"}` | Fails at selection, which is the better moment. **But it is asymmetric by construction** — whichever side you gate, the other becomes the free one, and if you gate both you get a circular dependency where each field's eligibility depends on the other's value. Also: both fields are `owner_role = LESSOR`, so this "forces" the Lessor against their own entry |
| **(c) Make the Lessor's GL mandatory outright** | Drop `NONE` from `TXN.GL_LESSOR_STATUS`'s options | Simplest and unambiguous. Eliminates the Lessee-carries-GL-alone arrangement, and collides head-on with R4's `GL_NONE` question |

(b) and (c) both interact with Q1/Q2. (a) interacts with nothing.

### Q4. What exact value is set, and does anything now fire on it?

**Value: `NONE`.** It is the only one of the three options that is true of an ineligible
party, and — importantly — it is the value the field would need anyway for the document to
say anything coherent.

**What fires on it, verified:**

- `MORT_DEDR_SIMPLE` / `MED_DEDR_SIMPLE` and their `SPLITC` children **stop** printing when
  both sides are `NONE`. Intended-ish, but it means a partial lease with an uncovered
  Lessor silently loses its deductible sentence.
- `TXN.MORT_LESSEE_RESPONSIBLE` / `TXN.MED_LESSEE_RESPONSIBLE` **start** being offered when
  both sides are `NONE`. **This is the unintended fire.** It must be closed, or R1/R2 are
  contradicted by the next control down the page.
- The D3 execution blocker and `insurance_resolution_sync`'s notification **start** firing
  when both sides are `NONE`. On a partial lease with an uncovered Lessor, R1 causes an
  execution block and an "Insurance responsibility unresolved" notification to both parties.
- `COORDINATION` and `CCC` are unaffected (`LESSEE.PARTY_TYPE` only).

**The printed sentence is the other half of Q4.** `token_display_value` resolves a stored
value to its option label, so a forced `NONE` prints *"Lessee: Does not have and will not
obtain mortality insurance on the Horse."* There is no way to print anything else without a
fourth option value. "Not Eligible" is a **form** affordance; the **document** will still
read as a choice the Lessee made. Whether that is acceptable is an owner call — the
vocabulary genuinely has no word for "cannot", which is LEASEMAP's finding and is not fixed
by this task's mechanism.

---

## The mechanism is bigger than two columns

The task sketches `ineligible_when` + `ineligible_reason` on `contract_field_defs`. Verified
gaps:

1. **`contract_fields` needs them too.** The per-document copy is what every runtime path
   reads. `sync_contract_fields_from_defs` **enumerates columns explicitly** on both its
   `INSERT` and its `UPDATE` — a new column not added there is silently dropped, with no
   error. `seed_cascade_fields` and `start_lease_contract_v2` need the same treatment.
2. **Nothing forces the value.** `set_contract_field` has no gate awareness at all — it
   would happily accept `WILL_OBTAIN` on `TXN.MORT_LESSEE_STATUS` for a partial lease. And
   leaving the field empty is not an option: the required-field check in
   `contract_lock_blockers` tests `cf.conditional_on` only, so an empty ineligible field
   blocks the lock. The value must actually be stored. Where from — the UI on load, a
   trigger, or the starter — is a Phase 2 design decision the task does not settle.
3. **Two predicates, not one.** The D3 logic is duplicated verbatim in
   `contract_lock_blockers` and `insurance_resolution_sync`. Any change to it must land in
   both or the notification and the blocker disagree.

---

## `ClauseDocument.tsx` — the render does need it. Diff reported, not applied.

`renderToken` at [ClauseDocument.tsx:423-462](../../src/components/app/ClauseDocument.tsx#L423-L462)
is the only place an inline insurance status control is produced. `OwnedField` is the
existing analogue — it wraps a not-mine field in an `ExplainTip` reading *"This item is set
by the Lessor."* — but it has no third state for "nobody can set this", and it always
renders the live control underneath. There is no other insertion point.

`ExplainTip` is already imported at line 7, so the diff needs no new import.

```diff
@@ src/components/app/ClauseDocument.tsx  (renderToken, after line 435)
     const selfGateMet = clauseConditionMet(field.conditional_on, valueByKey);
+    // LEASEGATE: an INELIGIBLE field is settled by the facts of the lease —
+    // neither party can answer it. Distinct from OwnedField's "the other party
+    // fills this in": here nobody does, so no control is rendered at all. The
+    // short fill keeps the sentence readable inline; the reason sits behind a
+    // tap, because iOS Safari ignores title= and clients sign on phones.
+    if (field.ineligible_when
+        && clauseConditionMet(field.ineligible_when, valueByKey)) {
+      return (
+        <ExplainTip key={key} text={field.ineligible_reason ?? undefined}
+          className="text-muted italic">
+          Not Eligible
+        </ExplainTip>
+      );
+    }
     const mine = fieldIsMine(field, cb);
```

Plus two optional fields on the `ContractField` interface in `src/lib/contracts.ts`
(`ineligible_when?: FieldConditional | null; ineligible_reason?: string | null`) and the
matching select — that file is not frozen.

`ContractCascade.tsx` (the form-side view, also not frozen) has its own insurance awareness
at `insuranceUnresolved` and would need the same treatment for parity; I have not designed
that, as the task frames the affordance in document terms.

---

## Verified vs assumed

**Verified — queried live or read from live source in this worktree:**

- the repo, remote (`Cactai-Inc/fhe-website-app`) and worktree provenance
- `HORSE_LEASE_STANDARD` at 22 sections / 144 clauses / 117 fields; 22 insurance fields
- all four lease templates byte-identical, by checksum, before and after this phase
- every field's owner role, required flag, option list and gate, and every insurance
  clause's gate and body, quoted from the rows
- `TXN.LEASE_TYPE` reaching 3 `SCHEDULE` clauses and 0 insurance clauses/fields on STANDARD
- the clause set for all six scenarios, by calling the live `clause_condition_met`
- the D3 blocker outcome for all seven scenarios, by evaluating its predicate verbatim
- `TXN.MORT_LESSEE_RESPONSIBLE` / `TXN.MED_LESSEE_RESPONSIBLE` gates evaluating `true` in S3
- the grammar (`all`/`any`/`equals`/`contains`/`gte`, no negation) from the function body
- `contract_fields` column list; `sync_contract_fields_from_defs` enumerating columns
- no `ineligible`-anything exists anywhere in `src/` or `supabase/` today
- `ExplainTip` present, tap-capable, already imported by `ClauseDocument.tsx`
- zero documents on STANDARD; all four leases on V2; `start_lease_contract_v2` defaulting
  to V2
- Sarah's `704c8d2d` on V2, `AWAITING_SIGNATURE` / `in_review` — read, not written

**Inferred — read from code, not observed running:**

- that a forced `NONE` prints "Does not have and will not obtain". Follows mechanically
  from `token_display_value`'s label lookup, but no lease has ever had a current-generation
  insurance field filled, so I have not seen it render.
- that the diff above is sufficient. It is the minimal correct insertion point; I have not
  compiled or run it, per the freeze.
- that adding a column to `contract_field_defs` without touching
  `sync_contract_fields_from_defs` silently drops it. Read from the explicit column lists,
  not tested.

**Assumed — not checked:**

- that the owner's "live client on exactly that arrangement" is on a **paper or pre-V2**
  lease. No document in the database is in the S4 configuration — the only executed lease,
  `ecaecd42`, carries the previous-generation vocabulary (LEASEMAP F7). I did not go
  looking outside the contract tables.
- the premise that a partial lessee cannot obtain mortality or medical cover. It comes from
  the task, and the task records that the owner has simplified it deliberately.

---

## Not done, deliberately

No migration. No template change. No `ClauseDocument.tsx` edit. No Phase 2 work of any
kind. `_V2` / `_FULL` / `_SIMPLE` re-checksummed at `b0001b34c40c1e2a5fc193a28379c073`,
identical to the opening baseline; `git status` in this worktree shows only this report.

**Stopping here for owner review**, as the task requires. The three decisions that gate
Phase 2 are Q1 (what replaces the waiver), Q2 (does R4 apply to all three sections), and
Q3 (how R3 is enforced given it already is). R1 and R2 cannot be built safely until Q1 is
answered, because their failure mode on an uncovered Lessor is currently absorbed by the
waiver R4 removes.
