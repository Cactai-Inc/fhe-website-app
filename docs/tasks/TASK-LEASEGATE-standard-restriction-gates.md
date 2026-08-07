# TASK LEASEGATE — condition the insurance options on the standard lease

Add conditions to the insurance **options** on `HORSE_LEASE_STANDARD`, for the three
sections that exist today: **General Liability, Major Medical, Equine Mortality**.

**Two phases, with a hard stop between them.** Phase 1 maps and analyses; the owner
reviews; Phase 2 implements. Do not write a migration during Phase 1.

**Prerequisites:** `TASK-LEASEFORK` (creates the template) and `TASK-TIPTAP` (tap-capable
tooltips — without it the reasons are invisible on the phones clients actually sign on). Operates on `HORSE_LEASE_STANDARD`
only — `HORSE_LEASE_V2`, `_FULL` and `_SIMPLE` must end byte-identical, proven by
checksum.

**Care, Custody & Control is out of scope entirely.**

---

## The model: gate the option, force the value

Every insurance status field is **required** — a lease cannot execute without a selection.
So an ineligible option is not simply removed or disabled; that would leave the field
unanswerable and the document unsignable.

Instead:

1. The field **renders as "Not Eligible"**.
2. A **tooltip states why**, in plain language.
3. A **value is set** so the field is satisfied and the document remains executable.

This is different from the existing ownership treatment (a field you don't own, which the
*other* party will fill). Here **nobody** can fill it — it is settled by the facts of the
lease. Same mechanics, different message.

**Nothing is greyed out.** The clause sentence still asks the party to make a selection,
and inline space in prose is short — hence a brief fill (*"Not Eligible"*) with the full
reason behind a tap.

**The tooltip must open on TAP.** Most clients read and sign on a phone, where there is no
hover. `TASK-TIPTAP` builds the tap-capable component; **this task depends on it** and must
use it rather than the native `title` attribute, which iOS Safari ignores on tap.

---

## The rules

### R1 — Mortality, partial lease

`TXN.LEASE_TYPE = PARTIAL` → the **Lessee's** mortality status renders **"Not Eligible"**.

> *"Lessee cannot purchase this for a partial lease."*

### R2 — Medical follows mortality

`TXN.LEASE_TYPE = PARTIAL` → the **Lessee's** medical status renders **"Not Eligible"**,
same treatment, wording adjusted to medical.

*Note for the record:* the underlying research prohibits partial-lessee medical only where
the horse is ridden by multiple students. For this program the horse always is, so the
owner has simplified it to follow lease type. Intentional.

### R3 — At least one party carries general liability

Both parties may not decline GL. Exactly how this is expressed — which side is forced,
whether it blocks at selection or at execution — is **a Phase 1 question**, not a decision
to make while coding. See below.

### R4 — Remove the waiver mechanism

The `TXN.*_NOT_REQUIRED` checkboxes come out. **Phase 1 must answer what replaces them
before anything is removed** — see the open question below.

---

## Phase 1 — map, analyse, stop

No code. No migration. Produce a document the owner can read and correct.

### 1a. The map

Every field in the three sections, in document order:

| Column | Content |
|---|---|
| Field key | |
| Section / clause | |
| Owner role | LESSOR / LESSEE / DEAL |
| Required? | |
| Current options | Every value and its label |
| Current gate | `conditional_on`, in **plain English** |
| Proposed rule | Which of R1–R4, or none |
| Proposed value when ineligible | |

### 1b. The impact analysis — the point of this phase

For each proposed rule, state what it does to the **rest of the document**, because these
fields drive clauses:

- **Which clauses stop printing**, and which start. Every `*_NOT_REQUIRED` field gates
  clauses (`GL_NONE`, `MED_NONE`, `MORT_NONE`, the `*_STATUS` clauses, the deductible
  chains). Removing or forcing a value **changes what the contract says**.
- **What a forced value makes the contract assert.** If a forced Lessee mortality status
  causes a clause to print "Lessee does not have and will not obtain mortality insurance",
  say so and quote the resulting sentence.
- **Which existing configurations become unreachable.** Specifically: today a Lessor can
  waive all three and the contract prints affirmative risk-acceptance clauses. Is that
  configuration still expressible after R4? **If not, say so plainly** — the owner has a
  live client on exactly that arrangement.
- **Any rule that contradicts another**, or leaves a field with no reachable valid value.

### 1c. Open questions — answer these, do not assume

1. **R4: what replaces the waiver?** The `*_STATUS` selects already offer *"Does not have
   and will not obtain"*. Does "no insurance" become **both parties selecting NONE**,
   making the checkbox redundant? If so, what happens to the `*_NONE` clauses that
   currently carry the Lessor's affirmative acceptance of risk — do they re-gate onto
   both-parties-NONE, or are they lost? **They are load-bearing: they are how the
   contract says who bears the risk.**
2. **Does R4 apply to all three sections, or only GL?** Removing the waiver on mortality
   and medical would eliminate the "Lessor accepts all risk, no insurance" arrangement
   the owner has described as a real client configuration. Confirm before removing.
3. **R3: how is "at least one" enforced?** A field-level block cannot express a rule
   spanning two fields. Options: force the Lessor's GL status when the Lessee's is NONE;
   validate at execution; or make the Lessor's GL mandatory outright. Present the
   trade-offs; do not pick one.
4. **What exact value is set** for an ineligible field, and does any clause currently gate
   on that value in a way that would now fire unintentionally?

**STOP after Phase 1.** Report and wait.

---

## Phase 2 — implement (only after approval)

Build exactly what the owner approved. If implementation reveals the map was wrong, stop
and report rather than adapting on your own.

Mechanism: two columns on `contract_field_defs`, reusing the **existing** expression
evaluator —

| Column | Type | Meaning |
|---|---|---|
| `ineligible_when` | `jsonb` | Same grammar as `conditional_on` |
| `ineligible_reason` | `text` | Tooltip text |

Our grammar — confirm against live rows first:

```json
{"equals": ["PARTIAL"], "field_key": "TXN.LEASE_TYPE"}
{"all": [ … ]}   {"any": [ … ]}
```

Do not invent `{"field":…,"operator":…,"value":…}` or an `action`/`render_message` shape.
That is not this system's grammar and will not evaluate.

### Verification

1. Each rule fires when it should — field shows "Not Eligible", tooltip correct, value set.
2. Each rule **stays off** when it should. A rule that always fires is as broken as one
   that never does.
3. The document still **executes** with every ineligible field satisfied.
4. **Render a sample lease** in each of: full lease all elections open; partial lease with
   R1/R2 firing; and the no-insurance arrangement if it survives R4. These are the owner's
   review artifacts.
5. `HORSE_LEASE_V2`, `_FULL`, `_SIMPLE` unchanged — checksums.

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN.** If the "Not Eligible" rendering needs it, **stop and
  report the exact diff** — do not apply it.
- Migrations dry-run in `BEGIN … ROLLBACK` with raw output, then apply.
- No new questions added to the lease. This task conditions existing controls.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Reporting

Phase 1 → `docs/reports/TASK-LEASEGATE-PHASE1-MAP.md`.
Phase 2 → `docs/reports/TASK-LEASEGATE-REPORT.md`.

State what you verified with your own eyes versus what you assume.
