# Insurance rebuild — phased build plan

**Status: FOR REVIEW. Nothing here is built.**
Target: `HORSE_LEASE_FULL` only. `HORSE_LEASE_V2` and `HORSE_LEASE_STANDARD` are not
touched by any pass below.

---

## Scope, reduced

Owner direction: *"strip down to just the matrix level rules for who can promise or
require what based on what conditions."*

So this build enforces **who may hold, who may be required to hold, and under what
conditions** — plus the clauses genuinely missing today. It does **not** attempt the full
research package.

### In

| | Why |
|---|---|
| The four-type matrix (§2a of the control set) | This is the ask |
| The six blocks | Prevents illegal selections — the stated bar |
| Driving variables the matrix needs (V1–V5) | The matrix cannot evaluate without them |
| **No-fault expense allocation** | The biggest real gap. Horse hurt, nobody negligent, no policy pays, someone owes the vet — the contract is silent today |
| CCC as a properly gated section | Currently one clause with no elections |
| Emergency vet authorisation limit | Basic, and operationally necessary |
| The three field defects | Wrong today regardless of any of this |

### Out — deliberately

| | Why |
|---|---|
| Policy detail capture (carrier, limit, deductible amounts, COI dates) | Edge-case territory; addenda and custom rows already absorb one-off requirements |
| Mid-term lapse remedies | Real, but not matrix-level. Queue separately |
| Pro-rata premium mechanics | Only bites on partial leases with an existing Lessor policy — rare, and expressible in an addendum |
| Assisted-lease platform disclaimer | Different workstream (FHE as non-party) |
| Statutory disclosures | The template already handles California correctly — assumption of risk, mutual releases, § 1542. Nothing to add |

---

## Why passes, and what makes one reviewable

Each pass must satisfy three things, or it is too big:

1. **It renders.** Every pass ends by generating a sample lease you can actually read.
   That is the review artifact — not a description of what changed.
2. **It reverts alone.** One migration, revertable without unpicking the next pass.
3. **It answers one question.** If a pass raises two unrelated judgment calls, split it.

**Stop-and-review between every pass.** No thread proceeds to the next without sign-off.

---

## Pass 0 — repair what is already broken

*No visible change. Nothing to judge.*

- `TXN.JUMP_MAX_HEIGHT` is free text → number + unit. The 0.90 m trigger cannot evaluate
  against `"about 3'"`.
- Six split-percentage fields have no `format_type`, are not required, and do not validate
  to 100 → a lease can execute electing "Split" with no split defined.
- `Other` on the three `DED_RESP` selects captures nothing → a contract can execute saying
  responsibility is "Other" with no explanation.

These are defects in the live template today. Doing them first means later passes are not
built on sand.

**You see:** confirmation the defects are gone. No lease change.

## Pass 1 — the driving variables

*Questions appear. Nothing is enforced yet.*

Add to `HORSE_LEASE_FULL`: insurable interest, upstream-lease mortality requirement,
agreed value, competition use, horse-in-lesson-program.

They render and store. They gate nothing.

**You see:** a sample lease with the new questions in place. **Judge: are these askable?**
Would you actually know the answers when writing a lease? If a question is unanswerable in
practice, the matrix rule depending on it is worthless and we cut it here — before
anything depends on it.

## Pass 2 — the blocks

*Small UI change. This is the architectural pass.*

Adds `blocked_when` + `blocked_reason` to `contract_field_defs`, reusing the existing
expression evaluator and the tooltip treatment already shipped. Then wires the six blocks.

**You see:** try to make an illegal selection — require a partial lessee to carry
mortality — and watch it refuse with a plain-language reason.

**Judge: does a refusal read as helpful or as the software being broken?** This is the
pass most likely to feel wrong, and the cheapest to reverse.

## Pass 3 — the insurance section, restructured

*The big lift. Content changes substantially.*

Rework the four types so elections follow the matrix: who holds, who may be required, what
follows from each. CCC becomes a real gated section rather than one paragraph.

**You see:** a full sample lease, before-and-after against the current one, side by side.

**Judge: does it read like a contract you would send a client?** This is where "a pile of
steaming shit we can't untangle" actually threatens, which is why it comes after the
mechanics are proven and is a pass of its own.

## Pass 4 — the missing clauses

*New content, additive.*

No-fault expense allocation (payer, final allocation, split validated to 100,
reconciliation window) and the emergency vet authorisation limit.

**You see:** a sample lease in the configuration that matters most — partial lease, Lessor
carries everything, horse gets hurt, nobody at fault. **Judge: is it obvious who pays?**

---

## The two versions

- **`HORSE_LEASE_FULL`** — everything above.
- **`HORSE_LEASE_SIMPLE`** — awaiting the owner and Claire. Created by LEASEFORK as a full
  copy so it is ready to trim on sight. **Trimming preserves legally reviewed language;
  re-drafting does not** — that is why it starts as a copy rather than a blank.
- **`HORSE_LEASE_STANDARD`** — untouched by this plan. It is the safe everyday lease while
  FULL is built.

---

## Open before Pass 2

The blocks become software-enforced refusals inside signed instruments. A permissive rule
that is wrong fails safe; **a wrong block prevents a lease a client is legally entitled to
sign**, while citing a legal-sounding reason.

Passes 0 and 1 are safe to run now. **Pass 2 should wait for an attorney's read on
B1–B6.** The research behind them was retracted and corrected twice by its own author
mid-session; it is good work, but it is not counsel.
