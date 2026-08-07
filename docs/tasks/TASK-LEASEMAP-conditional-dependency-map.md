# TASK LEASEMAP — map the lease's conditional system

**Read-only. No code, no migration, no template change. Not even an obvious fix.**

The owner is considering changes to the insurance sections and has said plainly:

> *"These conditions may prove to be a real house of cards because I don't have a map of
> the conditions and clauses and options and their effects to go off of, to know if there
> are upstream or downstream implications to the implementations."*

That is the problem this task solves. **The deliverable is the map.** Nobody should touch
these sections until it exists.

Source of truth: `HORSE_LEASE_V2` — 22 sections, 144 clauses, 117 fields.

---

## The question the map has to answer

> *"If I change this one thing, what else moves?"*

Answered in **both** directions, for any field or clause:

- **Downstream** — what appears, disappears, or changes wording as a result.
- **Upstream** — what must already be true for this to be reachable at all. A clause gated
  on a field that is itself gated off is **dead**, and dead content is exactly what a
  house of cards is made of.

A map that lists gates without resolving them into consequences has not done the job.

---

## Scope

The **insurance and risk sections in full** (`INSURANCE_RISK.*` — all 35 clauses and every
field they touch), plus **anything outside those sections that they depend on or that
depends on them**. Follow the edges wherever they lead: `TXN.LEASE_TYPE`,
`LESSEE.PARTY_TYPE`, `TXN.PERMITTED_ACTIVITIES` and the deductible chains all cross
section boundaries.

Where an edge leaves the insurance area, record it and stop — note the boundary rather
than mapping the whole contract.

---

## Deliverable 1 — the field map

One row per field:

| Column | Content |
|---|---|
| Field key | |
| Owner role | LESSOR / LESSEE / DEAL |
| Required | |
| Type + options | Every value with its label |
| Gated by | The `conditional_on`, **in plain English** — *"only when the lease is partial"*, never raw JSON |
| **Drives** | Every clause whose gate reads this field, **and what each does with which value** |
| **Referenced by** | Every clause whose body contains its `{{TOKEN}}` |
| Reachable when | The upstream conditions needed for this field to render at all |

## Deliverable 2 — the clause map

One row per clause:

| Column | Content |
|---|---|
| Clause key | |
| Prints when | Plain English, or ALWAYS |
| Depends on fields | |
| Tokens in body | And what prints if each is empty |
| **Dead if** | Any condition making this clause unreachable |

## Deliverable 3 — the scenario walkthroughs

The map's value is proven by tracing real configurations end to end. For each below, list
**exactly which insurance clauses print, in order, and what each says** once tokens are
filled:

1. **Partial lease · Lessor carries everything · individual both sides.** The owner's
   common case.
2. **Partial lease · no insurance anywhere.** The live client arrangement — Lessor waives
   all three and accepts risk.
3. **Full lease · Lessee carries mortality and medical.**
4. **Partial lease · Lessor requires cover the Lessee cannot lawfully obtain.** Show what
   the contract can express today. The expected answer is *nothing coherent* — confirm or
   refute that, because it is the gap driving the whole redesign.
5. **Entity lessee** — the only configuration where CCC prints.

## Deliverable 4 — the fragility findings

Where the structure is already brittle, stated as findings:

- **Dead content** — clauses that can never print, options that can never be selected.
- **Contradictions** — configurations producing clauses that disagree with each other.
- **Silent holes** — a field going unset that leaves a sentence with a blank mid-line, or
  a `{{TOKEN}}` rendering empty.
- **Single points of failure** — fields many clauses hang off. Changing one of these is
  where a house of cards collapses; name them explicitly.
- **Declaration vs fact.** Which fields are a party's own *declaration* (only they may
  make it — "I accept", "I will obtain") versus a *fact* about the world the system could
  assert ("this cover is unavailable to a partial lessee"). **This distinction is the one
  the owner has identified as most consequential** and the map must make it visible.

---

## How to present it

The owner reads on a phone and marks things up away from a computer.

- Markdown tables, plus CSV alongside for anything over ~30 rows.
- Plain English throughout. Raw JSON only in an appendix.
- Lead each deliverable with the three or four things that most surprised you.

## Rules

- **Read-only.** `SELECT` and `\d` only. No writes of any kind.
- Own git worktree off `origin/main`. Your branch contains the map and report only.
- **`ClauseDocument.tsx` is FROZEN** and not needed — map from the definitions.
- Report **what is**, not what should be. Findings, not recommendations. If you write
  "should" or "recommend", delete the sentence. *(Same rule as `TASK-ACCTEVAL`.)*
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Reporting

`docs/reports/TASK-LEASEMAP-REPORT.md` for method and findings; the maps as separate files
under `docs/reference/lease-map/`.

State plainly what you verified versus inferred. A wrong edge in this map is worse than a
missing one — it will be trusted, and changes will be made on the strength of it.
