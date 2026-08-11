# TASK DOCQUEUE — the documents page gets its columns, its filters, and its button

**Owner, 2026-08-11:**

> *"the documents page is still not updated with the right columns, additional filtering, and
> the button update from + new contract to + add new."*

**Specified but never implemented.** The design work is done and sitting in
`docs/DOCUMENT_LIBRARY_DESIGN.md` — read it first. This task implements it.

---

# VERIFIED IN PRODUCTION, 2026-08-11 — the page is worse than the design doc records

## 1. The status filter is broken three ways at once

```js
// src/components/ops/documents/DocumentQueueTable.tsx:21
export const QUEUE_STATUS_FILTERS = ['ALL', 'DRAFT', 'SENT', 'EXECUTED'] as const;
```

Live document statuses:

```
EXECUTED             61
DRAFT                 6
AWAITING_SIGNATURE    5
VOID                  2
```

- **`SENT` is not a real status.** The filter matches zero rows and always will.
- **`AWAITING_SIGNATURE` cannot be filtered at all** — 5 documents, and they are the ones most
  worth finding, because they are the ones waiting on somebody.
- **`VOID` is excluded before filtering even happens.** `api-client.ts` carries
  `.neq('status', 'VOID')`, so those 2 rows cannot be reached from this page by any means.

**Use the real vocabulary.** `DRAFT` / `AWAITING_SIGNATURE` / `EXECUTED` / `VOID` — and drop
`SENT`. Removing the `.neq` is required for any archive view to work; **do not remove it
silently** — say so in the report, because it changes what the default list contains.

## 2. The columns are missing, and the data is already on the row

The table renders title / contract / status / date. **Person, horse and type are absent even
though the data is on the row already** — `documents` carries `contact_id` and `horse_id`, and
the template gives the type.

The design doc's line: *"Person/horse/type columns don't exist despite the data being on the
row."* Adding them is a render change, not a data change.

## 3. The list query fetches the entire body of every document

`.select('*')` pulls `merged_body` — the full composed contract text — for all 74 rows, to
render a table that displays none of it. **Select the columns the table needs.**

## 4. The button

`DocumentsQueuePage.tsx:239` reads `+ New contract`. **It becomes `+ Add new`.**

This matches the roster, which the owner had changed to `+ ADD NEW` for the same reason: the
button creates whatever belongs on the page, and naming it after one document type makes the
other types feel unsupported.

---

# THE PRESET VIEWS

The design doc specifies **one flat library with six preset tabs** rather than a folder tree,
on the reasoning that at this volume (~74 documents) preset filtered views beat hierarchy.
Its six are listed in `DOCUMENT_LIBRARY_DESIGN.md` §"One flat library".

**Implement the tabs that are expressible against today's schema.** Several of its tabs depend
on things that do not exist yet — file uploads, `expires_on`, and a `category` column on
`contract_templates`. **Do not build those here.** Implement what the current schema supports,
and report precisely which tabs you could not build and what each needs. **Do not fake a tab
by leaving it empty** — a tab that never has contents is worse than one that is absent.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-docqueue`, branch `task/docqueue`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.** Minimal diff plus orchestrator approval. You
  should not need it — this is the queue page, not the document renderer.
- **`AppLayout.tsx`**: report nav changes, do not edit.
- **Delete nothing.** If a surface becomes redundant, retire it behind a boolean the way
  `ContactsPage` was.
- **61 EXECUTED documents are evidence.** This task reads and lists; it does not modify a
  document's content or status.
- No staff browser session exists and you will not be given one. Prove the query results
  against direct SQL and report the render as **NOT VERIFIED**.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

Filtering to `AWAITING_SIGNATURE` returns exactly the 5 documents that are awaiting signature,
`VOID` returns the 2 that are void, `SENT` is gone, the person/horse/type columns are
populated from real rows, and the list query no longer fetches `merged_body`. Prove each count
against SQL.

Report to `docs/reports/TASK-DOCQUEUE-REPORT.md`.

---

# OWNER RULING 2026-08-11 — the button surfaces a PICKER MODAL

> *"button surfaces a picker modal"*
> *"my instinct is to just make it a picker like the global Add New button, just documents
> focused. a list of cards with the document types."*

**This supersedes `DOCUMENT_LIBRARY_DESIGN.md` §J2**, which said to *remove* the page's own
button once the global `+` carried everything. **The button stays, is relabelled `+ Add new`,
and opens a documents-focused picker.** Do not delete it.

## The picker's cards route to TWO DIFFERENT ACTS

Verified in production 2026-08-11. This is the fact that decides the whole design:

```
CLAUSE-COMPOSED — 6 active templates, an authoring page exists
  HORSE_LEASE_V2 / _FULL / _SIMPLE / _STANDARD    163 clauses · 114 fields (all four identical)
  HORSE_SALE_V2                                    76 clauses ·  65 fields
  HORSE_BILL_OF_SALE                               36 clauses ·  48 fields

FLAT MARKDOWN — 14 active templates, ZERO clauses, ZERO fields, no authoring page
  RELEASE_GENERAL · RELEASE_PARTICIPANT · RELEASE_HORSE_CARE · RELEASE_JUMPER_ADDENDUM
  MINOR_RIDER · HUMAN_EMERGENCY_MEDICAL · HORSE_EMERGENCY_VET · FACILITY_RULES
  FACILITY_LICENSE · COMPANY_POLICIES · INDEPENDENT_CONTRACTOR · HORSE_SEARCH_RETAINER
  HORSE_TRANSACTION_REP · EVALUATION_LIABILITY_WAIVER
```

- **Contract-class card → authoring.** Opens the composition flow; there are terms to write.
- **Onboarding-class card → assign and generate.** There is nothing to author — the template
  has no clauses and no fields. The act is choosing a person. `DOCUMENT_LIBRARY_DESIGN.md` §J2
  lists *"Assign documents to a person"* as its own action for exactly this reason, and today
  it exists only buried in the contact dossier.

**Opening a clause-authoring canvas for `RELEASE_GENERAL` would show an empty page.** Route by
whether the template has clause defs — derive it, do not hardcode a list of keys.

## Do not ship a card that goes nowhere

Same rule as the empty preset tab. If a document type has no destination yet — an upload card
before `TASK-UPLOADS` lands, or a type with neither clauses nor an assign path — **leave it out
and report it.** A card that opens nothing is worse than an absent card.

## Sequencing note

`TASK-ONEAUTHOR` makes one page serve both kinds, and `TASK-UPLOADS` adds the upload card.
**This task does not wait for either.** Build the picker against what exists today: the 6
contract types route to the existing authoring flow, the 14 flat types route to assign, and the
upload card appears when there is something behind it.
