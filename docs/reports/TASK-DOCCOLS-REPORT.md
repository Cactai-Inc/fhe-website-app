# TASK DOCCOLS — report

**Task:** `docs/tasks/TASK-DOCCOLS-the-queue-shows-both-parties.md`
**Revises:** `TASK-DOCQUEUE` (merged `d84a562`) — the status vocabulary, six preset views,
`merged_body` fix and `+ Add new` picker all stay, untouched.
**Branch:** `task/doccols` (worktree off `origin/main` at `f4b84d0`).
**Status:** DONE — applied (committed) on the branch, not pushed. Typecheck / lint / build all
clean. Every count the task asks to prove is proved against production Postgres by running the
actual shipped derivation code (`partyDisplay.ts`) against data pulled straight from the tables —
not a hand-written SQL re-implementation that could quietly diverge. **Render: NOT VERIFIED** —
no staff browser session exists in this environment, per the task's own allowance. Numbered
checklist for the owner at the bottom.

---

## 1. Reconciling the task's "37" against what the queue actually shows: 29

The task's MEASURED section states 37 of 41 CLIENT+PARTICIPANT pairs are the same contact. That
number is correct for `document_parties` **with no join back to `documents`** — but
`document_parties` has no `deleted_at` column of its own, and 8 of those same-contact pairs
belong to documents that `documents.deleted_at IS NOT NULL` (8 soft-deleted DRAFTs). DOCQUEUE's
`listDocuments()` already filters `.is('deleted_at', null)` — unchanged here — so those 8 never
reached the queue before this task and don't now either. Verified:

```
select n_contacts, count(*) from (
  select dp.document_id, count(distinct dp.contact_id) n_contacts
  from document_parties dp
  join documents d on d.id = dp.document_id and d.deleted_at is null
  group by dp.document_id
) s group by n_contacts;

 n_contacts | count
------------+-------
          2 |    10   -- 4 parent/dependent + 6 lease
          1 |    64   -- 35 CLIENT-alone + 29 same-contact collapsed
```

`74` non-deleted documents total = `35 + 29 + 4 + 6`. I did **not** touch the `deleted_at` filter
to chase the number 37 — that would resurface 8 documents DOCQUEUE deliberately excluded and
contradicts "delete nothing" read the other way (nothing here un-deletes). The number the report
proves below is **29**, the one actually reachable in this queue; I'm flagging the arithmetic
explicitly rather than silently proving a different number than the task states, in the spirit of
DOCQUEUE's own diagnosis correction.

## 2. The one place `party_role` becomes a cell: `src/lib/ops/partyDisplay.ts` (new file)

`deriveDocumentParties(rows)` takes a document's `document_parties` rows and returns
`{ party1, party2 }`. It is the **only** place role → label/order logic lives; the table's cell
renderers just call it.

**Algorithm:**
1. Group `document_parties` rows by `contact_id` (not by role row) — a contact holding two roles
   on one document (the 29-of-33 case) is one party.
2. Each contact's "best role" = the lowest-ranked role they hold (a rank table below), so a
   CLIENT+PARTICIPANT same-contact party is attributed to `CLIENT` → label "Client", not
   "Participant" — reproducing the "single signer" case even though the redundant PARTICIPANT
   row exists underneath.
3. **One named special case, checked before the generic ranking:** exactly two contacts, one
   holding `CLIENT`, the other `PARTICIPANT`, and they're different people → labels become
   **Parent** / **Dependent**. This is the only place `PARENT`/`GUARDIAN` semantics appear, and
   they never come from `party_role = 'PARENT'` (0 rows, per the task's own measurement) — they
   come from this same-contact test on `CLIENT`+`PARTICIPANT`.
4. Otherwise, order the (at most two, see §7) distinct contacts by a role-rank table:
   `LESSOR/SELLER` (0) < `OWNER` (1) < `CLIENT/PARENT/GUARDIAN` (2) < `FHE` (3) <
   `CONTRACTOR/FACILITY_CONTACT` (4) < `EMERGENCY_CONTACT/RIDER` (5) <
   `LESSEE/BUYER/PARTICIPANT` (10), tie-broken by `signer_order` then `contact_id`. **Only
   `LESSOR<LESSEE` is exercised by live data.** `SELLER/BUYER` and every rank pairing besides
   `LESSOR/LESSEE` and the CLIENT/PARTICIPANT special case above have zero production rows —
   this is a best-effort total order for roles that have never co-occurred, declared unexercised,
   not proven.
5. `contacts.is_company` (not `party_role = 'FHE'`, which has 0 rows) is what marks the org
   itself acting as a party — see §5.

`deriveDateSigned(signatures)` = `max(signed_at)` over rows with `deleted_at IS NULL`, comparing
`Date` values (not raw string compare, to not depend on Postgres's timestamptz text format being
sortable as text). `deriveVersion(doc)` returns `signed_template_version` falling back to
`template.version`, plus a `drift` flag when a signed document's version differs from where the
template sits today.

## 3. The query: one `listDocuments()` call, two new embeds, no N+1

`src/lib/api.ts` — `listDocuments()`'s select is now:

```
id, display_code, title, status, generated_at, sent_at, voided_at, signed_template_version,
contact_id, horse_id, contract_id, template_id,
archived_at, terminated_at, current_status,
contact:contacts!documents_contact_id_fkey(first_name, last_name),
horse:horses!documents_horse_id_fkey(registered_name, nickname),
template:contract_templates!documents_template_id_fkey(version),
parties:document_parties!document_parties_document_id_fkey(
  contact_id, party_role, signer_order,
  contact:contacts!document_parties_contact_id_fkey(first_name, last_name, is_company)
),
signatures!signatures_document_id_fkey(signed_at, deleted_at)
```

**Changes from DOCQUEUE's select, and why:**
- **Dropped** `template`'s `title`/`template_key` — the Type column that read them is gone, and
  grep confirms nothing else in the codebase reads `DocumentQueueRow.template.title` or
  `.template_key`. Kept `template_id` (top-level) and added `template.version` — the sole
  remaining reader is the Version column's unsigned-document fallback.
- **Kept** `contact_id`/`contact` (top-level, from `documents.contact_id`) and `horse_id`/`horse`
  — still read by the By-person/By-horse presets in `DocumentsQueuePage.tsx` (untouched) and now
  also by the Horse column's link.
- **Kept** `contract_id` — the Contract # *column* is gone from the table, but `contract_id`
  stays in the row and the select, because the "Contracts & deals" preset filters on
  `contract_id IS NOT NULL` (`DocumentsQueuePage.tsx`, untouched). Proved still non-empty:
  `select count(*) from documents where deleted_at is null and contract_id is not null` → **8**,
  same as DOCQUEUE's report.
- **Added** `sent_at`, `voided_at`, `signed_template_version` — plain columns on `documents`,
  zero join cost.
- **Added** `parties` — the `document_parties` embed `deriveDocumentParties` consumes. FK-hinted
  both directions (`document_parties → documents`, `document_parties → contacts`) even though
  neither is actually ambiguous, matching this file's existing convention of hinting explicitly
  for clarity rather than only where PostgREST would error without it.
- **Added** `signatures` — sliced to exactly `signed_at, deleted_at`, never `typed_name`/`ip`,
  the two fields `deriveDateSigned` needs.

**Why this doesn't reopen DOCQUEUE's N+1/`merged_body` fix:** both new embeds are one-to-many
joins PostgREST composes into the *same* single query (visible as nested JSON in one round trip,
not a query per row), and `merged_body` never appears anywhere in the select. Per-document fan-out
is small — at most 2 party rows and at most 2 signature rows in production today (§7) — so this
adds two bounded nested arrays to the existing one query, not a second query, let alone N.

## 4. What the table renders now

`src/components/ops/documents/DocumentQueueTable.tsx` — Person/Type/Contract columns gone;
Party 1, Party 2, Date Signed, Date Sent, Date Voided, Version added; Horse changed from plain
text to a link; Date Generated kept (renamed from "Generated" to match the task's exact naming).

- **Party cells** (`PartyCell`): role label stacked above the name (`text-[10px] uppercase`,
  same convention as `HorsePage.tsx`'s `Detail` component). Non-company names are
  `<Link to={`/app/admin?open=${contactId}`}>`; the company renders as plain text (§5). **Party 2
  renders as a genuinely empty cell** (`return null`) when there's no second party — not a
  repeated "—" — per the task's explicit instruction to pick one empty treatment; other empty
  cells (Horse, dates) keep their existing "—" convention, since the task's "noisily repeated"
  complaint was specifically about Party 2 printing a placeholder on every single-party row (72
  of 74).
- **Horse cell**: now `<Link to={`/app/horses/${horseId}`}>` instead of plain text — see §6 for
  why that route works for staff on any horse, not just one they own.
- **Version cell**: `v{version}`, and when `drift` is true, a second small line `template now
  v{currentVersion}`. This is not a rare case — **20 of 61 signed documents have version drift**
  (checked directly: `signed_template_version <> contract_templates.version`) — so it's rendered
  inline, not hidden behind a tooltip/hover state nobody would find.

## 5. The company party: `contacts.is_company`, not `party_role = 'FHE'`

The task names `FHE` as the vocabulary value marking "the org acting as a party." In production
today the company **does** appear as a party — but under role `LESSEE`, not `FHE` (which has 0
rows, confirmed against the `document_parties_party_role_check` constraint and a full group-by):

```
document_id | party_role | name                         | is_company
215bac09…   | LESSEE     | French Heritage Equestrian   | t
215bac09…   | LESSOR     | CJ Z                         | f
… (4 of the 6 lease documents have the company as LESSEE)
```

So keying "render as company" off `party_role = 'FHE'` would silently miss all 4 real occurrences
today. `contacts.is_company` (a real boolean column, `one_company_contact_per_org` unique index)
is the correct, role-independent signal, and is what `deriveDocumentParties`/`PartyCell` actually
use — the company still gets a role label (still says "Lessee"), it just renders as plain text
instead of a `<Link>`, because there is no dossier route for it (§6).

## 6. Name/horse links: routes that already exist, one honest non-link

- **Horse** → `/app/horses/${horseId}` (`HorsePage.tsx`). Not new: `DealPage.tsx` (an ops page)
  already links here for staff. Confirmed server-side it's not owner-only —
  `horse_page_detail(p_horse_id)`'s gate is `has_staff_access() OR caller_owns_horse(...)`, so any
  staff member can open any org horse. All 4 distinct horses referenced by the 74 queued documents
  resolve to a live, non-deleted horse row (checked).
- **Person** → `/app/admin?open=${contactId}` (`Admin.tsx`, the "Clients" page — `ContactsPage`/
  `/app/ops/contacts` is retired per `TASK-ROSTER`). `Admin.tsx` already reads `?open=` and
  auto-selects a matching row on mount (`m.contact_id === open`), pre-existing, not built by this
  task. `admin_client_accounts()` unions three arms — login-backed, provisioned-without-login, and
  bare contacts — each gated on `is_admin()`. I could not exercise `is_admin()`/`current_org()`
  live (no staff JWT in this environment — direct `psql` as the `postgres` role returns
  `is_admin() = false`, `current_org() = NULL`, so the RPC itself returns 0 rows regardless of
  which contact I ask for). Instead I checked **every one of the 17 distinct contacts** who appear
  as a document party against each arm's structural WHERE conditions directly:

  ```
  16 of 17: reachable — 5 via arm 1 (has a USER-role profile / logged-in account),
            8 via arm 2 (provisioned client, no login), 3 via arm 3 (bare contact:
            contact_type = 'CONTACT', no login, no client row) — including Gabriella
            Olenik, the dependent in the 4 parent/dependent documents.
  1 of 17: the company contact — contact_type = 'TEAM', fails arm 3's type check on
           purpose (arm 3's own comment: "LEAD / TEAM / DIRECTORY types live on
           their own pages"). This is the one I render as plain text (§5), not a link.
  ```

  Everyone this task renders as a linked name has a real destination; the one person-shaped party
  with no reachable record page (the company) is reported here rather than emitting a dead link,
  per the task's own instruction. **The `is_admin()` gate itself I did not touch or re-verify
  end-to-end** — that's a render-level check this environment can't perform (§9).

## 7. Party-count and role-pairing assumptions I made explicit, not silently

- **At most 2 distinct contacts per document today** (checked: `max(count(distinct contact_id))
  = 2` across all 74). The task asks only for Party 1 / Party 2 columns, so `deriveDocumentParties`
  keeps the two highest-ranked contacts and drops any beyond that if it ever happens — there is no
  live data to prove or disprove this branch, and I did not invent a Party 3 column the task never
  asked for. Flagged as a limitation, not a proven behavior.
- **`BUYER`/`SELLER` are fully unexercised** — `HORSE_SALE_V2`/`HORSE_BILL_OF_SALE` have produced
  zero documents (matches the task's own note). The Seller-before-Buyer ordering rule is built
  (rank 0, same as Lessor) but has never run against real data.
- **`RIDER`, `OWNER`, `CONTRACTOR`, `FACILITY_CONTACT`, `EMERGENCY_CONTACT`, `PARENT`, `GUARDIAN`**
  all have 0 rows and a placeholder rank/label only. If any of these starts appearing paired with
  another role, the generic rank-order branch decides party 1/2 — untested against real data, and
  worth a second look from the owner before it's load-bearing.

## 8. The column toggle

`DocumentQueueTable.tsx` — a `<details>`/`<summary>` menu (`ColumnMenu`) listing all 10 columns as
labeled checkboxes inside a `<fieldset>`; `<details>` gets keyboard focus and Enter/Space-to-open
natively, closes on outside click (a `mousedown`-adjacent document listener), no popover library.

- **Persistence**: `localStorage`, key `docQueue.columns.${profile.user_id}` (falls back to
  `'anon'` if no profile, which shouldn't occur behind `ProtectedRoute requireStaff`). This is a
  display preference, not tenant data — per the task's own explicit allowance to make this call
  and say so if I disagreed. I didn't disagree; no table added.
- **Default set**: Document, Party 1, Party 2, Horse, Status, **Date Signed**. The task names
  "the most relevant date" (singular) as a default-on column alongside five named ones; I read
  that as Date Signed specifically — it's the one that tracks EXECUTED, the terminal successful
  state — and left Date Sent/Date Voided off by default alongside the explicitly-named-off Date
  Generated and Version. This is an interpretive call on an under-specified point, not a literal
  instruction; flagging it so the owner can veto if Sent/Voided were meant to default on too.
- **Guard against zero columns**: the checkbox for the last remaining visible column is
  `disabled` — clicking it is a no-op, not a table that vanishes.
- **Reset**: a "Reset columns" link inside the menu restores the exact default set above.
- **Composes with presets, doesn't replace them**: column visibility state lives entirely in
  `DocumentQueueTable.tsx`; `DocumentsQueuePage.tsx`'s six presets still only filter which *rows*
  reach the table — I did not touch that file.

## 9. NOT VERIFIED — render checklist for the owner

No staff browser session exists in this environment. Everything above is proved at the
query/derivation-code/type level against production Postgres — including running the actual
`partyDisplay.ts` functions (not a re-implementation) against data pulled live from
`document_parties`/`signatures`/`documents` — but nobody has clicked through the page. Check:

1. Open `/app/ops/documents`, "All documents" preset: Party 1/Party 2 columns render, Contract #
   and Type are gone.
2. Find a lease document (title "Horse Lease Agreement"): Party 1 = **Lessor**, Party 2 =
   **Lessee**, both names, both linked.
3. Find "Facility Rules and Safety Acknowledgment" (Brian Olenik / Gabriella Olenik): Party 1 =
   **Parent — Brian Olenik**, Party 2 = **Dependent — Gabriella Olenik**, both linked.
4. Find any single-signer release: Party 1 shows one name once, Party 2 cell is empty (not "—").
5. Click a Party 1 name → lands on `/app/admin` with that person's row expanded. Click a Horse
   name → lands on that horse's `/app/horses/:id` page.
6. Find one of the 4 lease documents where the company is LESSEE: Party 2 shows "French Heritage
   Equestrian" as **plain text, not a link**.
7. Switch to "Contracts & deals" preset: still shows rows (8 today), still filters correctly with
   no Contract # column.
8. Open the "Columns" menu: all 10 checkboxes, keyboard-reachable (Tab to it, Enter/Space opens).
   Toggle a column off, reload the page — it stays off. Click "Reset columns" — back to the
   6-column default. Uncheck every column down to one — the last checkbox is disabled, not
   uncheckable.
9. A document with signed_template_version drift (20 exist) shows the "template now vN" note
   under its Version cell.
10. **Expect the horizontal-overflow bug to be visibly worse than before** with several columns
    toggled on — no scroll container exists at any level (`DataTable.tsx`, this table, or the
    page). This is `TASK-FRAMESCROLL`'s fix; not built here per the task's explicit instruction.

## 10. Files changed

- `src/lib/api.ts` — `listDocuments()` select: dropped `template.title`/`template_key`, added
  `sent_at`/`voided_at`/`signed_template_version`/`template.version`/`parties`/`signatures`.
- `src/lib/ops/types.ts` — new `DocumentPartyRole`, `DocumentPartyRow`, `DocumentSignatureRow`;
  `DocumentQueueRow` widened accordingly, `template` narrowed to `{ version }`.
- `src/lib/ops/partyDisplay.ts` — new. `deriveDocumentParties`, `deriveDateSigned`,
  `deriveVersion` — the one place role/date/version derivation lives.
- `src/components/ops/documents/DocumentQueueTable.tsx` — Person/Type/Contract columns removed;
  Party 1/Party 2/Date Signed/Date Sent/Date Voided/Version added; Horse linked; column
  show/hide menu + localStorage persistence.

**Not touched**, per the task's explicit constraints: `AppLayout.tsx` (`TASK-NAVMOTION`),
`src/components/ops/kit/DataTable.tsx` (`TASK-FRAMESCROLL`), `ClauseDocument.tsx`,
`DocumentsQueuePage.tsx` (the six presets, the fetch, the picker — all as DOCQUEUE left them),
`DocumentQueuePicker.tsx`. No migration — this is a read-path task; every column this task needed
(`sent_at`, `voided_at`, `signed_template_version`, `contacts.is_company`, `signer_order`) already
existed.

## 11. Verification

- `tsc --noEmit -p tsconfig.app.json` — clean.
- `eslint .` — 0 errors; 36 pre-existing-pattern warnings (one new `react-refresh/only-export-
  components` warning on `DocumentQueueTable.tsx`, same class already present on ~15 other files
  in this codebase for the same reason — a file exporting a constant alongside a component).
- `vite build` — succeeds (required copying `.env`/`.env.db` into this fresh worktree from an
  existing one; both are gitignored and untouched by this task otherwise).
- **Counts 1, 2, 3, 5 proved by running the shipped `partyDisplay.ts` functions** (via `tsx`)
  against a JSON fixture pulled directly from production Postgres, shaped exactly like the
  Supabase embed response:

  ```
  Loaded 74 non-deleted documents.
  Count 1 — lease docs: 6 total, 6 with Lessor(party1)/Lessee(party2). Expect 6/6.
  Count 2 — CLIENT+PARTICIPANT docs: 33 total.
    Different-contact (Parent/Dependent): 4. Expect 4.
    Same-contact (collapsed to ONE party, no duplicate name): 29. Expect 29 (37 measured in
      the task doc minus 8 soft-deleted docs excluded from this queue — see §1).
    Unexpected shape: 0. Expect 0.
  Count 3 — CLIENT-alone docs: 35 total, 35 render signer-only party 1, blank party 2. Expect 35/35.
    Total single-party rows (35 alone + same-contact collapse): 64. Expect 64.
  Count 5 — EXECUTED docs: 61, with Date Signed: 61. Expect 61/61.
    Non-EXECUTED docs: 13, with Date Signed (should be 0): 0.
  Total accounted for: 35 + 29 + 4 + 6 = 74. Expect 74 (all non-deleted documents).
  ```

- Reachability of every linked name/horse checked directly against RLS-relevant table state
  (§6), and the company-as-party / version-drift / contract_id-preserved claims each checked with
  a standalone query (§3, §4, §5).
- **Render: NOT VERIFIED.** No staff browser session exists in this environment. Checklist above.
