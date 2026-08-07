# TASK LEASESIMPLE — prepare the simple lease for stripping

The owner will decide what a "simple" lease contains, in person, with Claire. Your job is
to put them in the best possible position to make that decision quickly — **not to make
it for them.**

**You will not delete, disable, reword or re-gate anything.** No content decisions.

**Prerequisite:** `TASK-LEASEFORK` must have run. This task reads
`HORSE_LEASE_SIMPLE` and touches no template at all.

---

## Why a worksheet rather than a first attempt

`HORSE_LEASE_SIMPLE` starts as a byte-identical copy of the current lease: **22 sections,
144 clauses, 117 fields.** It gets simple by **deletion**, which preserves language that
has already been through legal review — re-drafting would throw that away and start the
review over.

But nobody can sensibly mark up 144 clauses from a database dump. The deliverable is a
document that makes each keep/cut call obvious at a glance.

---

## Deliverable 1 — the rendered lease

A **readable, printable rendering** of `HORSE_LEASE_SIMPLE` exactly as it stands: full
prose, in order, with every clause numbered so it can be referred to unambiguously.

Fill tokens with realistic sample values (a partial lease, individual Lessor and Lessee,
Lessor carrying everything) so it reads as an actual contract rather than a template
skeleton. Note near the top which configuration was used.

This is what gets read aloud at the kitchen table. Prioritise legibility over completeness
of edge cases.

## Deliverable 2 — the worksheet

One row per clause, ordered as the document reads:

| Column | Content |
|---|---|
| **#** | Clause number matching Deliverable 1 |
| **Section** | Its section title |
| **Opening words** | First ~10 words, enough to recognise it |
| **Always prints?** | Yes, or the plain-English condition — *"only when jumping is permitted"*, not raw JSON |
| **Fields it asks for** | The questions a user must answer if it stays, in plain language |
| **Depends on** | Other clauses or fields that break if this is cut — **the most important column** |
| **Keep / Cut** | Left blank |

### The dependency column is the point

A clause can be cut cleanly, or it can be load-bearing. Both kinds must be identifiable
without opening the database:

- Clauses whose **fields are referenced by other clauses' gates** — cut it and the gate
  reads an empty value, silently changing what prints elsewhere.
- Clauses referenced by **`{{TOKEN}}`** in another clause's body — cut it and a token
  renders blank mid-sentence.
- Fields that are **`required`** — cut the clause and the document may become unsignable,
  or the field orphans.
- Clauses that **carry legal protection** — the assumption-of-risk recital, the mutual
  releases, the § 1542 waiver of unknown claims. Flag these prominently. They look like
  boilerplate and are the most dangerous things to cut.

Mark each clause with a **dependency class**: `standalone` (cuts cleanly), `depended-upon`
(name what breaks), or `protective` (legal consequence to cutting — say what is lost).

## Deliverable 3 — the obvious candidates

A short list of what most plausibly goes in a simple lease, **as observations, not
recommendations**: the longest sections, clauses that only ever print under rare
conditions, groups of fields that exist to configure one uncommon arrangement. State the
clause count and field count each would remove.

Do not propose a target size. Do not say what *should* go.

---

## Constraints

- **Read-only.** No template writes, no migrations, no content changes.
- Own git worktree off `origin/main`. Your branch contains the report and worksheet only.
- **`ClauseDocument.tsx` is FROZEN** and is not needed — render from the template
  definitions.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.
- Deliver the worksheet in a form that can be marked up away from a computer. A markdown
  table is fine; CSV alongside it is better.

## Reporting

`docs/reports/TASK-LEASESIMPLE-REPORT.md` for method and findings; the rendered lease and
the worksheet as separate files under `docs/reference/`.

State plainly what you verified versus inferred — particularly in the dependency column. A
clause wrongly marked `standalone` is the one failure mode here that causes real damage,
because it will be cut on that basis.
