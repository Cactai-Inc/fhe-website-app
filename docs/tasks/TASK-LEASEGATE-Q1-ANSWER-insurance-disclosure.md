# LEASEGATE Q1 — owner's answer: disclosure and acceptance, not a bare waiver

**Owner, 2026-08-07.** This answers the blocking question from
`docs/reports/TASK-LEASEGATE-PHASE1.md`. Recorded verbatim in structure; the open
questions at the foot are **not** answered and must not be guessed.

---

## The ruling

The waiver is **not** simply kept and **not** simply deleted. It becomes a
**disclosure-and-acceptance**: the Lessor must disclose the absence of cover, and the
parties must then elect an explicit allocation. A silent "not required" checkbox is not
enough.

## The model — partial lease, Lessor carries no mortality (or mortality and medical) cover

The Lessor has three paths.

### Path 1 — Lessor buys a policy, pays for it entirely

Purchased **before the lease starts**. Cost borne wholly by the Lessor.

### Path 2 — Lessor buys a policy, Lessee contributes

Purchased **before the lease starts**. The Lessee pays **some amount** toward it — an
amount, not a share of claims.

### Paths 1 and 2 both require three further elections

Having a policy does not settle who bears what. For **both** paths the Lessor must decide:

1. **Deductibles** — who pays them.
2. **Non-covered claims** — who bears a claim the policy declines or does not reach.
3. **Fault vs no-fault** — whether the above turns on the Lessee being at fault.

### Path 3 — no policy: disclose, then elect an allocation

The Lessor **discloses to the Lessee** that medical (or mortality and medical) insurance is
**not carried** on the horse they are leasing. The parties then elect exactly one of:

| | allocation |
|---|---|
| **A** | **Lessor** assumes all risk and costs, **regardless of fault** |
| **B** | **Lessor** assumes all risk and costs when the Lessee is **not** at fault; **Lessee** assumes all risk and costs when the Lessee **is** at fault |
| **C** | **Lessee** assumes all risk and costs, **regardless of fault** |

A is today's `*_NONE` behaviour ("Lessor accepts full risk and responsibility"). **B and C
do not exist in the document today** — that is the gap this creates and fills.

---

## What this means for the existing mechanism

- The bare `TXN.*_NOT_REQUIRED` checkbox is **insufficient on its own**. It records that
  cover is absent but not that it was **disclosed** or how risk was **allocated**.
- The three `*_NONE` clauses encode allocation **A only**, and print it automatically.
  Under this model A becomes one of three elected outcomes, not the default consequence.
- `INSURANCE_RISK.MED_TAIL` already states a sweeping Lessor-bears-everything rule
  ("Lessor assumes and is responsible for all risks and costs not paid or covered by any
  policy held by either party…"). **It prints unconditionally**, so under election B or C it
  would contradict the parties' choice. This is the same contradiction
  `TASK-LEASEMAP` findings 2 and 5 identified. **It must be gated on the election.**
- D3 in `contract_lock_blockers` must be amended to accept a completed
  disclosure + election as resolution, in place of the waiver checkbox.

## Open questions — ASK THE OWNER, do not choose

1. **Scope: partial leases only, or full leases too?** The owner's answer opens "For partial
   lease". `TASK-LEASEMAP` found `TXN.LEASE_TYPE` **does not reach the insurance section at
   all** — no clause or field gates on full vs partial. If this model is partial-only, that
   wiring has to be built first and is not currently in LEASEGATE's scope.
2. **Which coverages?** The answer names **mortality**, and **mortality and medical**, and
   in Path 3 **medical or mortality and medical**. Whether medical-alone is a valid
   standalone case, and whether **general liability** takes the same treatment, is not
   settled. LEASEGATE Q2 (all three sections or GL only) is still open and interacts here.
3. **Paths 1 and 2 — are the three elections the same A/B/C, or their own choices?** The
   owner lists deductibles, non-covered claims, and fault-vs-no-fault as separate decisions.
   They may map onto A/B/C or may need their own fields.
4. **Who determines fault, and when?** Election B turns entirely on "the Lessee is at
   fault", but the document has no fault-determination mechanism. Without one, B is
   unenforceable in practice. This is a legal-drafting question, not a build question.
5. **Path 2 — "some amount":** fixed sum, percentage, or free text? And is it a one-off at
   lease start or recurring?

---

## Addendum — owner, 2026-08-07: medical depends on mortality

### The dependency

**Medical follows mortality. If mortality is not in place, medical disappears.**

So the order of resolution is: establish whether **mortality** cover is held → **only then**
enable the medical component. Medical can never stand alone.

**Each is a separate component of one full policy**, so cost responsibility is elected
**separately** for each — e.g. the Lessor pays for mortality while the Lessee pays 1–100%
of medical.

This is a **new gate that does not exist today**: nothing currently prevents a medical
election while mortality is NONE.

### Section ordering — ALREADY CORRECT, no change needed

The owner asked for General Liability first, then mortality, then medical adjacent. That is
already the live order. Verified in `HORSE_LEASE_STANDARD`:

| sort | clause group |
|---|---|
| 150–169 | `GENERAL_LIABILITY` … `GL_LESSEE_RESP` |
| 200–221 | `MORTALITY` … `MORT_LESSEE_RESP` |
| 300–320 | `MEDICAL` … `MED_TAIL` |

**Also worth knowing:** these are **not three sections.** There is one section,
`INSURANCE_RISK` (sort 140, "Insurance, Risk of Loss, and Indemnification"), and GL /
mortality / medical are clause groups within it. Any reordering is clause-level, not
section-level.

### Deductibles on mortality — OWNER RESEARCH PENDING

The owner suspects mortality policies carry **no deductible**. If confirmed, the deductible
language is stripped from the mortality group and kept for medical.

**Mortality does carry deductible clauses today** — `INSURANCE_RISK.MORT_DEDR_SIMPLE`
(sort 214) and `INSURANCE_RISK.MORT_DEDR_SPLITC` (215), mirroring the medical pair
`MED_DEDR_SIMPLE` / `MED_DEDR_SPLITC`. **Do not remove them until the owner confirms**;
this is a factual question about how mortality policies are written, not a design choice.

### Defect found while checking the order — flagged, not fixed

The medical group is internally out of order relative to the other two. GL and mortality
both put `_STATUS` **before** `_NONE` and `_LESSEE_RESP`; medical puts them after:

```
305 MED_NONE          ← election clauses come first
306 MED_LESSEE_RESP
308 MED_STATUS        ← status comes after
```

Against `GL_STATUS` 155 → `GL_NONE` 168, and `MORT_STATUS` 205 → `MORT_NONE` 220. Likely a
print-order bug in the medical group. **Not touched** — LEASEGATE Phase 2 is stopped and
this is a live template. Confirm intent before changing it.

## Sequencing

**None of this is buildable until questions 1–3 are answered**, and question 4 needs
counsel. LEASEGATE Phase 2 stays stopped.

Also unchanged and still true: **zero documents exist on `HORSE_LEASE_STANDARD`, and
`start_lease_contract_v2` still defaults to `HORSE_LEASE_V2`.** Every gate built here is
inert until that default flips — that cutover is a separate owner decision.
