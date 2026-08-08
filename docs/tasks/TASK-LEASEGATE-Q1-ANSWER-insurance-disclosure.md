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

---

## Addendum 2 — owner, 2026-08-07: FULL lease inverts who holds the policy

**This answers open question 1, and answers it larger than asked. Full and partial are not
one model with a flag. They are two models, and they differ on the most basic fact — who is
able to buy the policy at all.**

### Partial lease — asymmetrical, Lessor-led

The first scenario with conditional gating carrying **strict one-sided responsibility that
also aligns with who makes the decisions**. The **Lessor makes all decisions; the Lessee
accepts or rejects them.** The Lessor can hold the cover. Everything in Addendum 1 applies.

### Full lease — the Lessor CANNOT hold the policy

> "When the lease is full the owner cannot obtain the insurance that they could when there
> was no lease in place, and the Lessee is the one that needs to get the policy even if the
> Lessor pays for it."

This is an **insurable-interest fact, not a preference.** On a full lease the policy must be
obtained by the **Lessee**, regardless of who pays for it. Every Lessor-holds-the-policy
path from Addendum 1 is unavailable here.

Consequences the document must carry:

1. The Lessee may be **required** to obtain a policy, **or** not required but free to **opt
   in**.
2. If the Lessee obtains one — required or optional — they must **declare** it.
3. The **coverage must be made visible to the Lessor.**
4. The **Lessor must be named as the party with the insurable interest** for the mortality
   payout, and **that payout goes directly to the Lessor.**

### "Require / do not require" is not a sufficient election

The owner is explicit that the current binary is inadequate **in both directions**.

**If the Lessor DOES require a policy**, they must do one of:

- **state the requirements** for that policy (what cover, what limits); or
- **waive the right to decide** the requirements; or
- **both** — and additionally the parties may agree to **work together**, in which case
  **no policy is purchased until both parties agree**. **The lease does not start until that
  decision is made.** ← a lease-commencement dependency, not just a document gate.

**If the Lessor does NOT require a policy**, they must still elect: **require, or waive the
right to require**, that the Lessee be responsible for any or all costs related to mortality
and/or medical.

### The Lessee's own declaration

Separately from the Lessor's election, **the Lessee must declare whether they will or will
not obtain a policy.** That declaration is expected to be **influenced by the cost
obligations the Lessor places on them** — so it is elicited *after* those obligations are
known, not before.

### What this means for the build

- **LEASEMAP finding 1 is now a hard blocker, not an observation.** `TXN.LEASE_TYPE` reaches
  **no** insurance clause or field today. The entire model branches on full vs partial, so
  **that wiring must exist before any of this can be gated.** It is not currently in
  LEASEGATE's scope.
- Full lease needs fields that do not exist at all: Lessee's declaration of intent, policy
  visibility/evidence to the Lessor, and the named-insurable-interest designation with
  payout direction.
- "The lease does not start until both agree" implies a **commencement gate**, which is a
  different mechanism from `contract_lock_blockers` (that blocks *signing*, not *starting*).
  Confirm with the owner which is intended.

---

## Addendum 3 — owner, 2026-08-07: the Lessee's counter-elections on a PARTIAL lease

### Why the Lessee needs them

On a partial lease, if the Lessor carries no cover and obliges the Lessee to bear costs —
in full or by split percentage — **the Lessee has no way to insure that exposure
themselves.** This is not a gap in the design; it follows from the eligibility matrix:
`LT = PARTIAL` makes **Lessee may hold mortality PROHIBITED (B2)**, and medical is limited
to a pro-rata contribution toward the Lessor's premium.

So the Lessee's only route to defray an obligation the Lessor placed on them is **through
the Lessor** — the Lessor obtaining a policy **at the Lessee's expense**.

Without a counter-election the partial lease is take-it-or-leave-it on an exposure the
Lessee is structurally barred from covering. **That is what these options fix.**

### The Lessee's three responses

Presented **after** the Lessor's election, because the Lessee's answer depends on the
obligation placed on them:

1. **Require the Lessor to obtain a policy** covering the Lessee's exposure, at the
   **Lessee's expense** — coupled with a requirement that the **Lessor present the policy
   options to the Lessee before purchasing.** Both parts, not one: paying for a policy
   chosen without sight of the options is the thing this prevents.
2. **Accept the responsibility as obligated** by the Lessor.
3. **Neither** — route to the **suggestions / comments system** and state their preferred
   handling of this section **in writing**.

### Option 3 reuses machinery that already exists

The change-request / suggestions path is built: `ContractChangeRequests.tsx` and
`api/contract-change-requests-submitted.ts`. **Option 3 is a route into it, not new
construction.** Do not rebuild a parallel negotiation channel for this section.

### How this refines "asymmetrical"

Addendum 2 recorded partial as "the Lessor makes all decisions; the Lessee accepts or
rejects." That remains true about **who initiates**, but the Lessee's rejection is
**structured, not free-form**: options 1 and 2 are elections the document must carry, and
only option 3 falls through to prose. The asymmetry is in *sequence and initiative*, not in
the Lessee having no recorded position.

## Sequencing

**None of this is buildable until questions 1–3 are answered**, and question 4 needs
counsel. LEASEGATE Phase 2 stays stopped.

Also unchanged and still true: **zero documents exist on `HORSE_LEASE_STANDARD`, and
`start_lease_contract_v2` still defaults to `HORSE_LEASE_V2`.** Every gate built here is
inert until that default flips — that cutover is a separate owner decision.
