# TASK DOCCOLS — the document queue shows both parties, the dates that matter, and lets you choose the columns

**Owner, 2026-08-11.** Follows `TASK-DOCQUEUE`, which merged as `d84a562` and added
Person/Horse/Type/Contract. **This revises that column set — it does not start over.** Read
`docs/reports/TASK-DOCQUEUE-REPORT.md` first; the preset views, status vocabulary and the
`merged_body` fix it shipped all stay.

> *"contract # is useless to me, the type is also useless because its the same as the document
> names, the person only shows part of the story on deal contracts, Better to list both parties,
> with Lessor/Seller always party 1 and Lessee/Buyer party 2. Single signer docs show the signer
> in party 1. Single signer docs when signer is parent, show dependent as party 2. The
> identifier Lessee/Lessor, Seller/Buyer, Parent/Dependent, should be shown with the name. All
> names should link to the record for that person/horse. Date Signed, Date Sent, Date Voided,
> these matter more than Date generated, Version number, is helpful, and that leads me to the
> next update to this page. We should have a multi select toggle menu of all the columns and the
> toggle is used to show or hide."*

---

# MEASURED IN PRODUCTION, 2026-08-11 — read this before designing anything

## Only four party roles are in use

```
party_role   | rows | documents | of which signers
-------------+------+-----------+------------------
CLIENT       |  76  |    76     |       76
PARTICIPANT  |  41  |    41     |        2
LESSEE       |   6  |     6     |        6
LESSOR       |   6  |     6     |        6
```

`document_parties.party_role` is constrained to a **fourteen**-value vocabulary — `CLIENT`,
`BUYER`, `SELLER`, `LESSOR`, `LESSEE`, `OWNER`, `RIDER`, `PARTICIPANT`, `PARENT`, `GUARDIAN`,
`EMERGENCY_CONTACT`, `CONTRACTOR`, `FACILITY_CONTACT`, `FHE`. **Ten of the fourteen have zero
rows**, including `BUYER`, `SELLER`, `PARENT` and `GUARDIAN`.

**Consequences you must design around, not discover:**

- **The Seller/Buyer ordering is forward-looking and CANNOT be tested against live data.** Sale
  templates exist (`HORSE_SALE_V2`, `HORSE_BILL_OF_SALE`) but have produced **zero documents**.
  Build the rule; state plainly in the report that it is unexercised.
- **`PARENT` and `GUARDIAN` are never written.** The parent case is modelled as
  `CLIENT` + `PARTICIPANT` with two *different* contacts — see below. **Do not key the
  parent/dependent display off `party_role = 'PARENT'`; you will get zero matches.**

## ⚠️ THE TRAP: 37 of the 41 CLIENT+PARTICIPANT pairs ARE THE SAME PERSON

```
DIFFERENT contacts (parent signs, dependent is the subject)   4
SAME contact    (an adult signing their own release)         37
```

**A naive "signer in party 1, participant in party 2" prints the same name twice on 37 of 82
rows.** That is the single most likely way to ship this looking broken.

**The rule:** party 2 exists only when it is a *different person*. Same contact in two roles is
one party, not two.

## Document shapes, all 82 accounted for

```
1 party   35   CLIENT alone
2 parties 47   = 41 (CLIENT + PARTICIPANT) + 6 (LESSOR + LESSEE)
```

Of those 41, **37 are one person and 4 are parent+dependent.** So the true render is: **72
single-party rows, 10 genuinely two-party rows** (4 parent/dependent + 6 lease).

## The dates

`documents` carries `sent_at`, `voided_at`, `generated_at`, `effective_date`, `archived_at`,
`terminated_at`. **There is NO `signed_at` column.**

**Date Signed must be derived from `signatures`** — `max(signed_at)` over non-deleted rows.
This is clean, and the data proves it:

```
status              docs   with any signature   fully signed
EXECUTED             61          61                 61
DRAFT                14           0                  0
AWAITING_SIGNATURE    5           0                  0
VOID                  2           0                  0
```

Every executed document is fully signed; nothing else has a single signature. So Date Signed is
non-null exactly for EXECUTED and null everywhere else. **Do not invent a partial-signature
display state for data that does not exist** — but do not assume it never will either: use
`max()` over completed signatures, not "the executed date."

## Version

Two different numbers, and they mean different things:

- **`contract_templates.version`** — what the template is *now*.
- **`documents.signed_template_version`** — what it was when signed. Set on **61 of 82** rows,
  exactly the EXECUTED set.

**Show `signed_template_version` where it exists.** For an unsigned document the honest value is
the template's current version, because that is what it would compose from today. **If the two
differ on a signed document, that is meaningful** — it says the template moved on after signing.
Decide how (or whether) to surface that, and say what you chose.

---

# THE COLUMN SET

## Removed

- **Contract #** — *"useless to me."* Remove the column. **Do not remove `contract_id` from the
  query** — the "Contracts & deals" preset filters on `contract_id IS NOT NULL` and would break.
- **Type** — *"the same as the document names."* Remove. Same caveat: the preset views and any
  filtering that reads the template may still need it fetched.

## Parties — one column each, in a fixed order

**Party 1 / Party 2, ordered by role, never by insertion order:**

| shape | party 1 | party 2 |
|---|---|---|
| lease | **Lessor** | **Lessee** |
| sale *(no live rows)* | **Seller** | **Buyer** |
| single signer | **the signer** | — |
| signer + different dependent | **Parent** | **Dependent** |
| signer who is also the participant | **the signer**, once | — |

- **The role label is shown with the name** — owner's words. Lessor/Lessee, Seller/Buyer,
  Parent/Dependent. Put the display mapping in **one place**, derived from `party_role` plus the
  same-contact test. **Do not scatter `if (role === …)` through the cell renderer**, and do not
  hardcode a per-template-key list — this codebase deleted two hardcoded shadow catalogs for
  exactly that reason.
- **`CLIENT` does not always mean "Parent."** It means parent *only* when a distinct
  `PARTICIPANT` contact exists on the same document — 4 rows today. On the other 72 it is just
  the signer and must not be labelled Parent.
- **`FHE` is in the role vocabulary** and is the org acting as a party. If it appears, render it
  as the company, not as a person.
- Party 2 is blank, not "—" repeated noisily, when there is genuinely one party. Pick one empty
  treatment and use it in every column.

## Names link to records

*"All names should link to the record for that person/horse."* Party names link to the person's
record; the Horse column links to the horse's record. **Use the routes that already exist** —
find them, do not invent them, and if a person has no reachable record page say so in the report
rather than emitting a dead link. **A link that goes nowhere is the same defect class as a tab
that is always empty.**

## Dates

*"Date Signed, Date Sent, Date Voided, these matter more than Date generated."*

- **Date Signed** — derived, `max(signatures.signed_at)`
- **Date Sent** — `documents.sent_at`
- **Date Voided** — `documents.voided_at`
- **Date Generated** — **kept, but off by default.** "Matters less" is not "delete it"; it is
  the only date on a DRAFT.

## Version

`signed_template_version`, falling back as described above.

---

# THE COLUMN TOGGLE

> *"We should have a multi select toggle menu of all the columns and the toggle is used to show
> or hide."*

- A multi-select menu listing **every** column, each toggling its own visibility.
- **Persist the choice** so it survives a reload. `localStorage`, keyed per user — this is a
  display preference, not tenant data, and it does not belong in the database. **If you disagree,
  say so in the report rather than adding a table.**
- **Ship a sensible default set** — a first-time user must not meet an empty or overwhelming
  table. Default on: Document, Party 1, Party 2, Horse, Status, and the most relevant date.
  Default off: Date Generated, Version.
- **The default must be recoverable.** A "Reset columns" affordance, or the menu makes it
  obvious. Someone will switch everything off.
- **At least one column is always on.** Guard against a zero-column table.
- **It composes with the six preset views; it does not replace them.** Presets filter rows;
  this chooses columns. Do not entangle them.
- **Keyboard reachable and labelled.** It is a menu of checkboxes; treat it as one.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-doccols`, branch `task/doccols`, off `origin/main`
  (**`d84a562` or later — it must contain the DOCQUEUE merge**). **Never `~/Desktop`.** Do not
  push.
- **`AppLayout.tsx` belongs to `TASK-NAVMOTION`** and `src/components/ops/kit/DataTable.tsx`
  to **`TASK-FRAMESCROLL`** — both may be running. **Do not edit either.** If the table needs a
  scroll container, that is FRAMESCROLL's fix and adding columns is exactly what makes it
  visible: **report it, do not build it.**
- **Do not undo `TASK-DOCQUEUE`.** Its status vocabulary, its six preset views, its
  `merged_body` fix and its `+ Add new` picker all stay. You are changing which columns render
  and adding a toggle.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **61 EXECUTED documents are evidence.** This task reads and displays. It changes no document's
  content, status, parties or signatures.
- **Delete nothing.** Retire behind a boolean.
- **Watch the query.** DOCQUEUE stopped the list fetching `merged_body` for 74 rows. Two more
  party joins and a signatures aggregate must not undo that gain — **state the column list and
  the join shape in the report**, and prefer one aggregate over an N+1 per row.
- Migrations, if any: **no self-contained `COMMIT;`**, and **do not reuse another migration's
  temp table name.** This is likely a read-path task needing none — say so if so.
- No staff browser session exists and you will not be given one. **Prove every count against
  SQL** and report the render as **NOT VERIFIED**, with a numbered checklist for the owner.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. The 6 lease documents show **Lessor** in party 1 and **Lessee** in party 2.
2. The **4** parent/dependent documents show Parent and Dependent — **and the 37 same-person
   documents show ONE party, not the same name twice.**
3. The 35 single-party documents show their signer in party 1 and nothing in party 2.
4. Contract # and Type are gone; the "Contracts & deals" preset **still works.**
5. Date Signed is populated on exactly the **61** EXECUTED rows and null elsewhere.
6. Every name is a working link to a real record.
7. Columns can be toggled, the choice survives a reload, the default is recoverable, and the
   table can never be reduced to zero columns.

Prove counts 1, 2, 3 and 5 against SQL in the report.
Report to `docs/reports/TASK-DOCCOLS-REPORT.md`.
