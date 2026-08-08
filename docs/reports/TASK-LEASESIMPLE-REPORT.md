# TASK LEASESIMPLE — the keep/cut worksheet for the simple lease

**Status:** delivered. Read-only throughout — no template row, no migration, no content change.
**Branch:** `task/leasesimple`, worktree off `origin/main` (`0635acb`).
**Deliverables:** [`docs/reference/lease-simple/`](../reference/lease-simple/) — four files.

**No content decision has been made.** The Keep / Cut column is blank on all 144 rows. Nothing was
deleted, disabled, reworded or re-gated. The owner and Claire decide what a simple lease contains.

---

## What was produced

| File | Deliverable | Size |
|---|---|---|
| [RENDERED-LEASE.md](../reference/lease-simple/RENDERED-LEASE.md) | 1 — the lease in full prose, every clause numbered | 144 clauses |
| [WORKSHEET.md](../reference/lease-simple/WORKSHEET.md) | 2 — one row per clause, blank Keep / Cut column | 144 rows, 22 tables |
| [WORKSHEET.csv](../reference/lease-simple/WORKSHEET.csv) | 2 — the same rows for a spreadsheet | 144 rows, 14 columns |
| [CANDIDATES.md](../reference/lease-simple/CANDIDATES.md) | 3 — what comes out together, and what it costs | 10 groups |
| [README.md](../reference/lease-simple/README.md) | reading order | — |

The worksheet is one table per section rather than one 144-row table, so a section fits on a page
and can be marked up on paper. The CSV carries the same content with the gate JSON added.

---

## Method

Everything was read from the live database (`lrstswfxfsezdmvkvukc`), tables `contract_section_defs`,
`contract_clause_defs`, `contract_field_defs`, `template_key = 'HORSE_LEASE_SIMPLE'`. `SELECT` only.

Render order is section `sort_order`, then clause `sort_order` within the section. No section or
clause shares a sort order with a sibling, so the order is total and stable. Clause numbers are
`§section.clause` — §13.26 is the twenty-sixth clause of section 13 — and are identical across all
four files.

Gate semantics were taken from `clauseConditionMet` in
[src/lib/contracts.ts:257-281](../../src/lib/contracts.ts#L257-L281), which the file's own comment
states mirrors the SQL `clause_condition_met` used by the composer. The property that drives the
whole dependency analysis is on line 267: a missing field reads as `''`, so `equals: ["NO",""]`
is *satisfied* by a missing field while `equals: ["YES"]` and every `contains` gate are not.

`ClauseDocument.tsx` was not modified. It was read in two places only — to confirm that `{{TOKEN}}`
places a field's control inline and that fields without a token are still asked as authoring
controls. The rendering is built from the template definitions, not from that component.

Sarah's document `704c8d2d-…` was never queried. No `documents` table was touched at all.

---

## Verified vs inferred

This is the section that matters. A clause wrongly marked `standalone` is the failure mode that
causes real damage, because it will be cut on that basis.

### Verified by query — no judgement involved

* **`HORSE_LEASE_SIMPLE` is identical to `HORSE_LEASE_V2`.** Set difference computed in both
  directions across all content columns of all three tables: 0 rows either way, on sections, clauses
  and fields, with matching counts (22 / 144 / 117) and no duplicate clause keys. The task brief said
  byte-identical; that is now confirmed rather than assumed.
* **The counts.** 22 sections, 144 clauses, 117 fields. 76 clauses and 40 fields carry a gate;
  23 fields are `required`.
* **Every gate dependency**, in both directions, from `conditional_on`.
* **Every token dependency** — 114 distinct `{{TOKEN}}`s, of which 15 resolve outside the field
  table (party contacts, horse record, signatures) and 99 are fields.
* **Where each defined term is defined and used**, by scanning bodies for the term itself.
* **Which clauses require something in writing**, by scanning bodies for "written notice",
  "in writing", "written consent", "written permission", "written acceptance", "written agreement".

### Computed, and sound in the direction that matters

For each clause, the worksheet states what happens to every *other* clause and question if this one
is cut. Cutting a clause removes the questions attached to it, and any gate reading one of those
questions then reads empty. Three outcomes are distinguished:

| Outcome | How it is established |
|---|---|
| **stops printing for good** | The gate is false when the cut field is empty **and every other atom in it is optimistically true**. If it cannot be satisfied even then, it can never be satisfied. |
| **prints in every lease from then on** | The gate is true when the cut field is empty **and every other atom is pessimistically false**. If it holds under the worst case, it holds always. |
| **falls back on whatever answers remain** | Neither of the above. |

Both strong claims are one-sided and therefore safe: the approximation treats atoms on other fields
as free booleans, which can only ever move a clause *out* of a strong claim and into the middle
category. It cannot manufacture a false "stops printing for good".

Across the 144 clauses this produced 82 "stops printing", 19 "prints unconditionally", 32 "falls
back", and 2 blank-token breaks.

### Hand-classified — read, not computed

Two columns rest on reading all 144 bodies rather than on queries. Both are marked as such in the
worksheet.

**Prose cross-references.** A clause can point at another in words with nothing in the JSON to show
it — §2.7 names "the Releases Required for Authorized Riders provision"; §7.3 names "the Termination
for Cause provisions"; §14.4 refunds "Lease Fee". 56 such references, across 32 source clauses, were
entered by hand, each stored with the words that create it, so the claim can be checked against the
text.

**The `protective` class.** 55 of the 144 clauses were classified as carrying legal protection, each
with a statement of what is lost if it goes. This is a flag to take to counsel, not legal advice.
I am not a lawyer; the classification is a reading of what the clause does.

The riskiest of these are the ones that read as boilerplate: §13.25 (primary assumption of risk
under *Knight v. Jewett*), §13.33 (the Civil Code §1542 waiver of unknown claims), §14.6 (survival —
without it the releases arguably expire with the lease, and injury claims are brought afterwards),
§20.1 (severability, the net under every other protection), and §21.2 (the acknowledgement of having
read the agreement and of giving up the right to sue, which is what makes the releases stand up).

**California has no equine activity statute.** §13.25 and §13.26 do the work that an equine
immunity statute does in other states. This was established in earlier work on the insurance
controls and is repeated here because it bears directly on how cuttable those two clauses look.

### The audit that changed the answer

The first pass classified 65 clauses as `standalone`. Reading each one against its own body against
that verdict changed 19 of them:

* **required fields were not counted as a dependency.** Fixed — cutting a clause that carries a
  required field removes it from the signing checks, which the brief flags explicitly.
* **§3.15 (Location)** was marked standalone. §3.18, §11.24 and §13.27 all speak of "the facility
  where the Horse is kept"; §3.15 is the only clause that says where that is.
* **§15.1 (Form of Notice)** was marked standalone. 19 clauses require something in writing and
  resolve through it. It is now protective.
* **§14.1 and §14.2** were marked standalone; §10.5 points at the Termination section as a whole,
  not only at §14.3.
* **§12.8** was marked standalone; §12.7's "Yes" means nothing without it.
* **§4.3 (Lease Grant)** was marked standalone. It is the sentence that actually grants the lease.
* **§13.1, §7.3, §12.1, §12.9, §14.4, §14.5** were marked standalone and carry consequence:
  the duration obligation for every insurance policy, the definition of a late payment, the Lessee's
  only care duty, the tack-condition duty, and the two loss-termination refund rules.

Final classification: 46 `standalone`, 43 `DEPENDED-UPON`, 34 `PROTECTIVE`, 21 both.

---

## Deliverable 1 — how the rendering handles the awkward cases

The configuration is a partial lease, individual Lessor and Lessee, Lessor carrying general
liability, mortality and medical and bearing all deductibles, with lessons, arena riding and trail
riding permitted. It is stated at the top of the file and every value is invented.

**All 144 clauses are shown**, not only the 94 that print in that configuration. Showing only the 94
would have made the worksheet's other 50 rows unreadable, and no clause should be cut without its
words being read. The 50 that do not print are indented, shown in full, and labelled with the
condition that would bring them in.

Composite inputs — fee schedule, medication schedule, week grid, location, contact list — are
rendered as plain text. The application draws them as small tables. The words are the same; the
layout is not. This affects presentation only, never which clauses print.

---

## Two things found while reading

Neither is a keep/cut question. Both are recorded because they were noticed and both are inherited
from `HORSE_LEASE_V2`.

1. **`TXN.MONTHLY_START` ("First monthly payment date") is already orphaned.** It is attached to
   `clause_key = 'LEASE_FEE.PAYMENTS'`, a clause that does not exist in either template. It is one of
   the 117 fields and appears in no clause. Verified by joining the field table against the clause
   table: exactly one field has no matching clause.

2. **"French Heritage Equestrian Approved Trainer" and "Approved Instructor" are used but never
   defined.** The terms appear in §11.2, §11.4, §11.6 and §12.2. No clause anywhere in the lease says
   what approval means or who grants it. Verified by scanning all 144 bodies for the term.

A third, smaller one: where the Lessor arranges farrier or veterinary care, §12.5 and §12.6 print
"Farrier:", "Veterinarian:", "Practice:" and "Address:" with nothing after them — those fields are
gated to `TXN.FARRIER_ARRANGE = LESSEE` / `TXN.VET_ARRANGE = LESSEE` while the tokens in the body are
ungated. Established from the field gates, not from a rendered PDF.

---

## What this task did not do

* No template, section, clause or field row was written, updated or deleted.
* No migration was authored.
* No recommendation on what a simple lease should contain, and no target size.
* `ClauseDocument.tsx` untouched.
* Sarah's live negotiation untouched and unread.
