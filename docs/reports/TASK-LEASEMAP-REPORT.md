# TASK LEASEMAP — report

**The map is the deliverable.** It is in
[`docs/reference/lease-map/`](../reference/lease-map/README.md) — an index, four
map files and two CSVs. This report covers method, what was verified against what was inferred,
and the fragility findings.

Read-only throughout. No table was written, no function executed that writes, no
migration authored, no template row changed. The one live negotiation
(`704c8d2d…`, Sarah) was read and not touched.

---

## The five things that most changed my picture of this section

1. **`TXN.LEASE_TYPE` does not reach the insurance section at all.** Not one
   insurance clause and not one insurance field is gated on whether the lease is
   full or partial. The whole distinction the owner is worried about — what a
   partial lessee can and cannot be asked to carry — is invisible to every gate
   in the section.
2. **Thirteen of the 35 clauses print unconditionally**, and two of them allocate
   risk: `RISK_OF_LOSS` ("Lessor assumes all risk of loss of or injury to the
   Horse") and `MED_TAIL` ("Lessor assumes and is responsible for all risks and
   costs not paid or covered by any policy held by either party"). No election in
   the form can move either. Whenever the Lessee takes on a cover, the document
   says both things at once.
3. **The Lessor writes the Lessee's insurance status.** All three
   `*_LESSEE_STATUS` fields are `owner_role = LESSOR`. The system already knows
   how to make a field party-exclusive — it does exactly that for the six
   checkboxes — and the three dropdowns that produce the Lessee's first-person
   undertakings are not among them.
4. **The insurance section has never been filled in.** Four lease documents exist.
   The one executed lease predates this model and still carries thirteen field
   rows from the previous generation of insurance fields. On the three current
   documents, every one of the 22 insurance fields is empty. Nothing in this
   section has been exercised end to end by a real transaction.
5. **A blank status prints the sentence anyway.** This is live right now in draft
   `215bac09`, which reads *"Lessor:  general liability insurance covering the
   Horse and the activities contemplated by this Agreement."* The gap is where the
   status belongs, and the sentence as printed reads as an affirmative covenant.

---

## Method

Source of truth was the production database `lrstswfxfsezdmvkvukc`, read directly.

**Structure.** `contract_section_defs`, `contract_clause_defs` and
`contract_field_defs` for `template_key = 'HORSE_LEASE_V2'` — 22 sections, 144
clauses, 117 fields, of which 35 clauses and 22 fields are in `INSURANCE_RISK`.

**Edges.** Two directions, both by query, not by reading:
- Every `{{TOKEN}}` in every clause body of the template, resolved against the
  field definitions, to find who prints what.
- Every `conditional_on` in the template, matched against insurance field keys,
  to find who gates on what.

That produced a boundary result worth stating plainly: **zero clauses outside
`INSURANCE_RISK` reference an insurance field, zero clauses outside it are gated
on one, and zero fields outside it are gated on one.** The section is a sink. The
only inbound edges are `LESSEE.PARTY_TYPE`, `TXN.PERMITTED_ACTIVITIES` and
`HORSE.FAIR_MARKET_VALUE`.

**Behaviour.** The gate evaluator (`clause_condition_met`), the composer
(`remerge_contract_from_clauses`), the token renderer (`token_display_value`,
`certify_statement`), the write path (`set_contract_field`), the signing gate
(`contract_lock_blockers`, `advance_document_workflow`, `approve_contract_review`,
`lock_and_sign_contract`), the notification producer
(`insurance_resolution_sync`) and the deductible trigger
(`contract_split_deductible_sync`) were all read from `pg_get_functiondef`. The
browser-side mirror was read from `src/lib/contracts.ts` and
`src/components/app/ContractCascade.tsx`. `ClauseDocument.tsx` was not read — it
is frozen and the map is built from the definitions.

**Scenario proof.** Which clauses survive each scenario was computed by calling
the live `clause_condition_met` with each scenario's field values in a single
`SELECT` — the same function the composer calls. That is a verified result, not a
reading of the JSON.

**Rendering proof.** Draft `215bac09` has every insurance answer blank and its
`merged_body` is a live composition against the current definitions. It was read
to confirm how the composer handles empty tokens, sub-item folding and numbering.

---

## Verified versus inferred

**Verified — queried live or read from live source:**

- every field and clause definition, gate, option list, owner role and required flag
- the clause set that survives each of the nine configurations in SCENARIOS.md
- the absence of any edge between insurance and the rest of the template
- how an empty status renders (observed in `merged_body`, not predicted)
- the party-exclusive carve-out on the six election checkboxes, and its absence
  everywhere else
- the unresolved-insurance blocker and which code paths enforce it
- that `cut_name` is null on every section and clause of this template
- that no lease document holds a value in any current-generation insurance field

**Inferred — read from code, not observed running:**

- the deductible-split trigger's different behaviour for GL versus mortality and
  medical. The reasoning is mechanical (the mode lookup targets fields that do not
  exist), but no document has ever had these fields filled, so it has not been
  seen happen.
- the exact assembled text of scenarios 1, 3, 4 and 5. The clause *set* is
  verified; the text follows the composer's rules and the one observed render.
- that `lock_and_sign_contract`'s gate-blind required-field branch is unreachable
  through the application. It is reachable by direct RPC call. This was read from
  the render condition on the Sign control (`state === 'locked'`), not tested.

**Premise, not a system fact:** scenario 4 assumes a partial lessee cannot
lawfully obtain mortality cover on a horse they do not own. That premise comes
from the task. Nothing in the template encodes it, which is itself the finding.

---

## Fragility findings

### 1. Dead content

**F1 — `ARENA_SOLO` gates nothing, anywhere.** "Solo Arena Riding" is one of the
seven permitted activities. It appears in no `conditional_on` in the entire
template. Selecting it changes only the list of words printed in
`PERMITTED_USE.MAIN`. The other six activities each drive between one and six
clauses.

**F2 — `OTHER` on the three deductible selects leads nowhere.** Choosing it
prints the bare word *"Other"* into the sentence — *"…responsibility for any
deductible shall be borne by: Other."* — and no further clause or field appears.
The deductible trigger contains a branch that clears an explanation field named
`<base>_RESP_OTHER` when the selection moves away from `OTHER`; no such field
exists in this template.

**F3 — the deductible sentence is dead exactly when responsibility has just been
accepted.** `*_DEDR_SIMPLE` requires at least one party to hold or be obtaining
cover. When the Lessee ticks "I accept financial responsibility", both statuses
are still `NONE` by definition — that is the precondition for the box being
available — so the deductible clause cannot print. A cover the Lessee has
undertaken to buy is never given a deductible allocation.

**F4 — `clause_cut_kept` has no effect on this lease.** `cut_name` is null on
every section and every clause of `HORSE_LEASE_V2`. The function still tests three
fields (`TXN.MORTALITY_INSURANCE_PARTY`, `TXN.MAJOR_MEDICAL_INSURANCE_PARTY`,
`TXN.LOSS_OF_USE_INSURANCE_PARTY`) that do not exist here.

**F5 — most of the deductible trigger is dead.** `contract_split_deductible_sync`
references seven fields that do not exist in `HORSE_LEASE_V2`: `TXN.MORT_ELECTED`,
`TXN.MED_COVERAGE`, `TXN.MORT_LIMIT`, `TXN.MORT_DEDUCTIBLE`, `TXN.MED_DEDUCTIBLE`,
`<base>_RESP_MODE`, `<base>_RESP_OTHER`. Consequences: the rule that a mortality
policy limit must be at least the horse's fair market value never fires; the
coverage-teardown branches never fire; and because mortality and medical are
wired to look for a dollar anchor and find none, **their split shares are never
normalised and the counterpart is never filled in** — while general liability's
are, because GL has no anchor configured and falls through to the percentage path.
Two controls that look identical behave differently.

**F6 — no risk clause exists for three of the seven activities.** `LESSONS`,
`ARENA_SOLO` and `TRAINING` produce no acknowledgement in the insurance section.
`TRAIL`, `JUMPING`, `COMPETITIONS` and `ARENA_GROUP` each do.

**F7 — the one executed lease carries thirteen orphaned insurance field rows.**
Document `ecaecd42` holds values for `TXN.GL_INSURANCE_REQ`, `TXN.GL_OBTAIN_PARTY`,
`TXN.GL_COST_PARTY`, `TXN.GL_REQUIRED_BY`, `TXN.GL_PROTECTION`,
`TXN.MORTALITY_INSURANCE_REQ`, `TXN.MORTALITY_OBTAIN_PARTY`,
`TXN.MORTALITY_COST_PARTY`, `TXN.MORTALITY_MIN_LIMIT`,
`TXN.MAJOR_MEDICAL_INSURANCE_REQ`, `TXN.MAJOR_MEDICAL_OBTAIN_PARTY`,
`TXN.MAJOR_MEDICAL_COST_PARTY` and `TXN.MAJOR_MEDICAL_MIN_LIMIT` — none of which is
a field of `HORSE_LEASE_V2` any more. (Four further non-insurance orphans sit
alongside them: `TXN.EVALUATION_LENGTH`, `TXN.EVALUATION_UNIT`,
`TXN.OTHER_PROHIBITED`, `TXN.OTHER_PROHIBITED_NOTE`. The ten `LESSOR.*` / `LESSEE.*`
rows are `SYSTEM` party auto-fill and are deliberately kept without definitions.)
The definition sync deletes orphaned rows, but this document is executed and no
longer synced. It is the only executed lease, and its insurance terms are expressed
in a vocabulary the template no longer has.

### 2. Contradictions

**F8 — `RISK_OF_LOSS` versus any Lessee-carried mortality.** *"Lessor assumes all
risk of loss of or injury to the Horse"* prints unconditionally. `MORT_LESSEE_RESP`
says *"Lessee bears responsibility for the loss of the Horse's value in the event
of the Horse's death, theft, or humane destruction."* Both print together, four
items apart, whenever the Lessee accepts mortality responsibility. The same
collision occurs when the Lessee's status is set to *Will obtain and will
maintain* — except there the Lessee-responsibility clause does not print, so the
only text is the Lessor assuming all risk while the status line says the Lessee
carries the policy.

**F9 — `MED_TAIL` versus any Lessee-carried medical.** `MED_TAIL` prints whenever
medical cover is not waived, and says out-of-pocket costs are paid by the Lessor
and that *"Lessor assumes and is responsible for all risks and costs not paid or
covered by any policy held by either party."* `MED_LESSEE_RESP` and a Lessee
medical status both say the opposite. They print inside the same numbered item.

**F10 — `COORDINATION` names a policy the document may say does not exist.** Its
gate tests only that the Lessee is an entity and that the mortality *waiver
checkbox* is unticked. It does not test the Lessor's mortality status. With an
entity lessee and the Lessor's mortality status set to *Does not have and will not
obtain*, the document prints *"Lessor's mortality insurance shall be the first
policy noticed and claimed against"* two items below the line saying the Lessor
has no such policy.

**F11 — entity lessee with mortality waived produces two owners of the same
loss.** `MORT_NONE` says the Lessor accepts full responsibility for the loss of
the horse's value. `CCC` — which is gated only on the Lessee being an entity —
requires the Lessee to carry a death benefit of not less than that same value.
`COORDINATION`, the only clause that orders the two, is switched off by the same
waiver. Nothing states which policy responds or who keeps the proceeds.

**F12 — the Lessee-responsibility clause and the Lessee's status line contradict
each other by construction.** The box is only available when both statuses are
`NONE`. So the clause *"Lessee shall obtain and maintain, at Lessee's sole cost…"*
always prints alongside *"Lessee: Does not have and will not obtain…"*. In the
medical block the order is reversed relative to the other two: `MED_LESSEE_RESP`
sorts at 306 and `MED_STATUS` at 308, so the status lines land underneath the
*Medical — Lessee Responsibility* heading rather than under *Medical Insurance*.

**F13 — the deductible sentence misdescribes whose policy it is.** *"If a claim is
made under any such policy arising from events for which Lessee bears
responsibility…"* prints identically whether the policy in question is the
Lessor's or the Lessee's. In scenario 3, where the only mortality and medical
policies are the Lessee's own, the sentence allocates the deductible on the
Lessee's policy by reference to the Lessee's responsibility for the event.

### 3. Silent holes

**F14 — a blank status prints its sentence with a gap.** Live in `215bac09`:
*"Lessor:  general liability insurance covering the Horse and the activities
contemplated by this Agreement."* The composer drops a line only when nothing but
punctuation survives after the tokens are stripped; here the rest of the sentence
survives. The resulting text reads as an affirmative undertaking with a typo. Six
fields behave this way — all three blocks, both sides.

**F15 — a blank deductible selection prints a bare colon.** *"…responsibility for
any deductible shall be borne by:"* — the composer deliberately does not append a
full stop after an unfilled colon. It is documented in the function as intended
behaviour, which is what makes it silent rather than broken.

**F16 — blank split shares print an empty allocation.** *"The deductible shall be
split between the parties: paid by Lessor and paid by Lessee."*

**F17 — `HORSE.FAIR_MARKET_VALUE` is not required, and two money clauses print it.**
`CCC` becomes *"…a death benefit limit of not less than the Horse's current fair
market value of."* and `LIMITATION` becomes *"…shall not exceed the Horse's
current fair market value of."* `LIMITATION` prints unconditionally on every lease.

**F18 — hiding a field does not clear it.** Ticking a waiver hides the six
dependent fields; their stored values survive. Unticking restores them. The
signing blocker and the unresolved-insurance notification read raw stored values
without applying any gate, so a pair of stale `NONE`s reactivates the block the
moment the waiver comes off.

**F19 — mortality and medical split shares are neither normalised nor
cross-checked.** Because of F5, `60` in the Lessor share and `70` in the Lessee
share are both stored verbatim and both print. General liability, on the same
screen, silently rewrites the second share.

### 4. Single points of failure

Ranked by how much moves when the field changes.

| Rank | Field | What moves |
|---|---|---|
| 1 | `LESSEE.PARTY_TYPE` | **12 clauses across 5 sections** plus 2 fields. Inside insurance: `CCC` and `COORDINATION`. Outside: the definitions of "Lessee", the Lessee's representations, the lessons clauses, and the signature block's capacity lines. It is the widest fan-out anywhere near this section, and it is also validated against the contact record at lock time — a mismatch between the field and whether the contact is a company is its own blocker. |
| 2 | `TXN.MED_NOT_REQUIRED` | 5 clauses (`MED_STATUS`, `MED_DEDR_SIMPLE`, `MED_DEDR_SPLITC`, `MED_TAIL` off; `MED_NONE` on) and 6 fields. It is the only switch that controls `MED_TAIL`, the section's general cost-allocation paragraph. |
| 3 | `TXN.MORT_NOT_REQUIRED` | 5 clauses and 6 fields, and it is the only insurance field whose reach crosses a block boundary — it switches off `COORDINATION`, which is about the interaction between mortality cover and the entity lessee's `CCC` policy. |
| 4 | `TXN.GL_NOT_REQUIRED` | 4 clauses and 6 fields, contained within its own block. |
| 5 | `TXN.PERMITTED_ACTIVITIES` | **19 clauses across 2 sections**, four of them the insurance risk acknowledgements. A single unchecked box removes a risk acknowledgement and a use restriction at the same time. |
| 6 | The six `*_STATUS` fields | Each drives its block's deductible chain. In pairs they also control whether the Lessee's election box exists at all, and whether the document can be locked. |
| 7 | `HORSE.FAIR_MARKET_VALUE` | Gates nothing, but is the number in the liability cap on every lease and the death benefit in `CCC` on every entity lease — and it is optional. |

### 5. Declaration versus fact

This is the distinction the section is half-built around.

**Declarations the system already protects.** Six fields are treated by
`set_contract_field` as party-exclusive: only a caller holding the owning party
role may set them, and **staff status does not substitute**. The function's own
comment gives the reason — FHE is itself the Lessor on these contracts, so without
the carve-out FHE staff could make the Lessee's election. The two elections in a
pair are also mutually exclusive at write time.

| Field | Whose act | The sentence it produces |
|---|---|---|
| `TXN.GL_NOT_REQUIRED` | Lessor's | "Lessor has elected not to require general liability insurance…" |
| `TXN.MORT_NOT_REQUIRED` | Lessor's | "Lessor has elected not to require mortality insurance…" |
| `TXN.MED_NOT_REQUIRED` | Lessor's | "Lessor has elected not to maintain medical insurance…" |
| `TXN.GL_LESSEE_RESPONSIBLE` | Lessee's | "Lessee has elected to accept, and hereby accepts, financial responsibility…" |
| `TXN.MORT_LESSEE_RESPONSIBLE` | Lessee's | same, mortality |
| `TXN.MED_LESSEE_RESPONSIBLE` | Lessee's | same, medical |

**Declarations the system does not protect.** Three fields produce first-person
undertakings by the Lessee and carry `owner_role = LESSOR`:

| Field | Who may set it | The sentence it produces |
|---|---|---|
| `TXN.GL_LESSEE_STATUS` | Lessor, and FHE staff | "Lessee: Will obtain and will maintain general liability insurance covering the Horse…" |
| `TXN.MORT_LESSEE_STATUS` | Lessor, and FHE staff | "Lessee: Will obtain and will maintain mortality insurance on the Horse." |
| `TXN.MED_LESSEE_STATUS` | Lessor, and FHE staff | "Lessee: Will obtain and will maintain medical insurance on the Horse." |

The same undertaking — the Lessee committing to buy a policy — is party-exclusive
when it comes through a checkbox and freely writable by the counterparty when it
comes through a dropdown. `WILL_OBTAIN` in the Lessee's status field and
`TXN.MORT_LESSEE_RESPONSIBLE = YES` produce commitments of the same kind and are
governed by opposite rules.

**A declaration that does not stay made.** The Lessee's election is gated on both
statuses being `NONE` — values the Lessor controls. If the Lessor changes their own
status afterwards, the election's gate fails: the box disappears from the form and
the clause disappears from the document, while the stored `YES` survives untouched
(nothing in `set_contract_field` or the deductible trigger clears it). Restoring
the status restores the printed undertaking without the Lessee acting again.

**Facts the system holds and does not use.**

| Fact | Where it lives | Used by insurance? |
|---|---|---|
| The lease is partial rather than full | `TXN.LEASE_TYPE`, required, always answered | **No.** Gates nothing in the section. |
| The Lessee is an entity rather than an individual | `LESSEE.PARTY_TYPE`, required, and cross-checked against the contact record at lock time | Only for `CCC` and `COORDINATION`. |
| The Lessee is a minor | `contacts.is_minor_contact` | No insurance field or clause reads it. |
| A policy is actually in force | nowhere | `CCC`, `GL_LESSEE_RESP`, `MORT_LESSEE_RESP` and `MED_LESSEE_RESP` all say "shall provide proof of coverage to Lessor upon request". There is no field, upload, date or status anywhere that records whether proof was given or a policy exists. |
| The horse's value | the horse record, and separately `HORSE.FAIR_MARKET_VALUE` on the document | The document's own copy is what prints, and it is optional. |

**The vocabulary carries no notion of capability or demand.** The three status
options — *Has and will maintain*, *Will obtain and will maintain*, *Does not have
and will not obtain* — all describe a party's own choice. None expresses "is
required to", "cannot lawfully obtain", or "is not available under this
arrangement". Scenario 4 is the direct consequence: with the Lessor requiring a
cover the Lessee cannot get, the four available moves are to state something
untrue, to have the Lessee undertake something impossible, to leave the document
unsignable, or to drop the requirement. The map traces all four in
[SCENARIOS.md](../reference/lease-map/SCENARIOS.md#scenario-4--partial-lease--lessor-requires-cover-the-lessee-cannot-lawfully-obtain).

---

## What the map does not cover

- Sections other than `INSURANCE_RISK`, except where an edge crosses into them.
  Every crossing is recorded in the field map's boundary table and stops there.
- `ClauseDocument.tsx` — frozen, and not needed to derive any of this.
- The insurance content of the pre-V2 lease that document `ecaecd42` was executed
  under. That vocabulary no longer exists in the definitions; only the sixteen
  orphaned rows on that document remain, and they are listed in F7.
