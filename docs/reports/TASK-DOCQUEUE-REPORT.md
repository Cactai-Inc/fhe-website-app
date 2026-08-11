# TASK DOCQUEUE — report

**Task:** `docs/tasks/TASK-DOCQUEUE-the-documents-page-does-its-job.md`
**Implements:** `docs/DOCUMENT_LIBRARY_DESIGN.md` (J1, plus the owner's 2026-08-11 ruling on J2)
**Branch:** `task/docqueue` (worktree off `origin/main`)
**Status:** DONE — applied (committed) on the branch, not pushed. Typecheck / lint / build all
clean. Query results proved against production Postgres directly (no staff browser session
exists in this environment — render is **NOT VERIFIED**, per the task's own allowance).

---

## 1. The status filter — real vocabulary, all four statuses reachable

`QUEUE_STATUS_FILTERS` is now `['ALL', 'DRAFT', 'AWAITING_SIGNATURE', 'EXECUTED', 'VOID']`
(`DocumentQueueTable.tsx`). `SENT` is gone.

**One correction to the task's diagnosis, checked against the actual code:** the task
attributes VOID's unreachability to `api-client.ts`'s `.neq('status', 'VOID')`. That line is
real, but it's in `listMySignableDocuments()` — a different function, on a different data
seam (`src/lib/ops/api-client.ts`, CLIENT-PORTAL), that backs the **member's own** Documents
page (`DocumentsContent.tsx`), not this ops queue. The ops queue's `listDocuments()`
(`src/lib/api.ts`) never had a VOID exclusion — the effect the task observed (VOID
unreachable "by any means") was real, but caused entirely by the missing filter *option*, not
a query-level exclusion. I left `api-client.ts` untouched — it's a different page's read path
and out of this task's scope — and fixed the actual cause: the option is in the list now.

Proved against production:

```
 status              | count
----------------------+-------
 AWAITING_SIGNATURE   |     5
 DRAFT                |     6
 EXECUTED             |    61
 VOID                 |     2
```

Matches the task's acceptance numbers exactly.

## 2. Columns — Person, Horse, Type — and the query no longer fetches `merged_body`

`listDocuments()` (`src/lib/api.ts`) now selects exactly what the table renders, plus the
three FKs it needs, embedded in one query (no N+1):

```ts
.select(`
  id, display_code, title, status, generated_at,
  contact_id, horse_id, contract_id, template_id,
  archived_at, terminated_at, current_status,
  contact:contacts!documents_contact_id_fkey(first_name, last_name),
  horse:horses!documents_horse_id_fkey(registered_name, nickname),
  template:contract_templates!documents_template_id_fkey(title, template_key)
`)
```

`contacts` needs the explicit FK hint (`!documents_contact_id_fkey`) because `documents` has
several columns referencing `contacts` (`contact_id`, `archived_by`, `voided_by`,
`originator_contact_id`, `horse_section_confirmed_by`) — PostgREST can't infer which one
without it. `horses` and `contract_templates` each have exactly one FK from `documents`, so
no hint is needed there, but I added the same explicit form for consistency/clarity.
`merged_body` never appears in the select list.

`DocumentQueueTable.tsx` gained three columns (Person / Horse / Type) between Document and
Contract, sourced entirely from the embedded row — zero additional data calls from the table
itself.

Proved against production (the exact join `listDocuments()` performs, sample rows):

```
title                                    | status    | person          | horse | doc_type
Horse Lease Agreement                    | VOID      | AVERIFY2 Tester |       | Horse Lease Agreement
Horse Handling and Routine Care Release  | EXECUTED  | Claire Bourdon  | Tiz   | Horse Handling and Routine Care Liability Release
Horse Lease Agreement                    | AWAITING… | French Heritage | Beau  | Horse Lease Agreement
```

0 of 74 documents have a null `template_id` (Type always populated); 54 of 74 have no
`horse_id` (expected — most onboarding/release docs aren't horse-specific), rendering as `—`.

## 3. The button and the picker

`+ New contract` → `+ Add new`, and it now opens `DocumentQueuePicker`
(`src/components/ops/documents/DocumentQueuePicker.tsx`) instead of linking straight to
`/app/ops/contracts/new`. Per the owner ruling, this **supersedes** design-doc §J2 (which said
remove the button once the global `+` carried everything) — the button stays.

**Derivation, not a hardcoded list.** `documentTypeOptions()` (`src/lib/api.ts`) fetches active
templates and, separately, `select('template_key') from contract_clause_defs`; `has_clauses`
is `Set.has(template_key)` on the result — the actual, current existence of clause defs, not a
list of keys anyone has to remember to update. Proved against production this resolves to
exactly the 6/14 split the task states:

```
has_clauses=true  (6): HORSE_BILL_OF_SALE, HORSE_LEASE_FULL, HORSE_LEASE_SIMPLE,
                        HORSE_LEASE_STANDARD, HORSE_LEASE_V2, HORSE_SALE_V2
has_clauses=false (14): COMPANY_POLICIES, EVALUATION_LIABILITY_WAIVER, FACILITY_LICENSE,
                        FACILITY_RULES, HORSE_EMERGENCY_VET, HORSE_SEARCH_RETAINER,
                        HORSE_TRANSACTION_REP, HUMAN_EMERGENCY_MEDICAL,
                        INDEPENDENT_CONTRACTOR, MINOR_RIDER, RELEASE_GENERAL,
                        RELEASE_HORSE_CARE, RELEASE_JUMPER_ADDENDUM, RELEASE_PARTICIPANT
```

I also cross-checked this against the *other* existing signal for the same distinction —
`staff_assignable_templates()`'s own `NOT EXISTS (... contract_section_defs ...)` — since
that RPC already draws this exact line for a different caller. `contract_section_defs` and
`contract_clause_defs` carry the identical 6-key set in production, so the two derivations
agree; I used clause defs because that's what the task names.

**Clause-composed cards are grouped by `contract_kind`** (a real column, not a hardcoded
mapping of template keys) — the four lease variants collapse into one "Horse lease" card
rather than four near-identical ones, because `NewContractPage` already has its own version
picker for when more than one template shares a kind. This is an interpretive choice: the
owner said "a list of cards with the document types" (types, not templates), and the four
lease bodies are one type with variants, not four types. `contract_kind` values in production:
`HORSE_LEASE` (×4 templates), `HORSE_SALE` (×1), `HORSE_BILL_OF_SALE` (×1) — confirmed via SQL.

**HORSE_BILL_OF_SALE has no card**, and this is the one place I diverged from "6 → 6 cards."
It has clause defs (36) and would classify as clause-composed, but there is no standalone
entry point to author one from scratch — `startBillOfSale(saleDocumentId)` only generates it
as a *companion* from inside an existing HORSE_SALE_V2 contract's own page
(`ContractPage.tsx:988`). `CONTRACT_KIND_DESTINATION` only maps `HORSE_LEASE` and
`HORSE_SALE`; `HORSE_BILL_OF_SALE` has no entry, so its card is left out entirely per the
task's own rule ("do not ship a card that opens nothing"). **If a standalone bill-of-sale
start is wanted**, it needs either a new RPC (`start_bill_of_sale_standalone` or similar,
taking parties/horse directly instead of a sale document id) or an explicit decision that it
stays sale-only. Left for the owner — not built here.

**Flat cards → assign-and-generate.** Clicking one of the 14 opens `AssignDocumentsModal`
pre-scoped to that template (`initialTemplateKey`), which I extended
(`src/components/app/ClientRecordActions.tsx`) rather than rebuilding: `contactId` is now
optional, and when absent the modal's first screen asks who it's for
(via `staffContactOptions()`, the same `has_staff_access()`-gated RPC used elsewhere — works
for every staff role, not just admins) before falling through to its existing template
list/on-file-status/confirm flow, now pre-checked. Both existing callers
(`ContactDossierModal.tsx:378`, `Admin.tsx:965`) still pass a fixed `contactId` and are
unaffected — that branch never triggers for them.

Card destinations (Horse lease → `/app/ops/contracts/new`, Horse sale →
`/app/ops/contracts/new?type=purchase`) required one small addition to `NewContractPage.tsx`:
a one-time read of `?type=purchase` on mount, following the exact pattern already there for
`?doc=`. No route changes.

## 4. The six preset views

Design doc v1 specifies six tabs; the v2 owner ruling (2026-08-05) supersedes the *tab/routing*
framing — "views are filter presets at most, not navigation," one flat list with multi-select
filters. The task (2026-08-11, later than both) tells me to implement "the tabs." I read these
together as: build the six as filter-preset **pills** over the one list (visually tab-like, per
the task; functionally state, not routes/pages, per v2) — implemented in
`DocumentsQueuePage.tsx`, default = **Needs attention** per the design doc's "(default)".
**This changes the page's default view** from showing all 74 documents to showing the 5
awaiting signature — flagging this explicitly since it's a real behavior change, not just a
rendering fix.

Each preset composes with the existing status dropdown (AND, not replace) — "All documents" is
where the dropdown's own DRAFT/AWAITING_SIGNATURE/EXECUTED/VOID/ALL behavior is exercised
directly, unfiltered by any preset, which is what the task's acceptance test targets.

| Preset | Built | Not built (what it needs) |
|---|---|---|
| **Needs attention** | `status = AWAITING_SIGNATURE` | Assigned-but-never-generated obligations (needs a `contact_required_documents` cross-reference — rows with no matching generated document) and `expires_on`-based items — neither exists yet; the second needs the uploads build (J1b). |
| **Signed library** | `status = EXECUTED AND archived_at IS NULL`, with a working superseded toggle (`current_status <> 'superseded'` by default, checkbox to include) | Grouping by template category — no `category` column on `contract_templates` yet, per the task's own explicit "do not build" list. |
| **By person** | Contact `<select>` built from contacts who actually have a document (derived from the already-fetched rows, zero extra queries) → filters this list to `contact_id = selected` | Deviates from v1's literal "deep-links into the existing dossier Documents tab rather than duplicating it" — I filter the SAME list in place instead. Given v2's reframing of all six as filter presets over one list, an in-place filter is the more consistent implementation and needs no cross-page routing into `ContactDossierModal`/`Admin.tsx` (both out of this task's file scope). Flagging the deviation for the owner to veto if the deep-link was actually load-bearing. |
| **By horse** | Same pattern as By person, `horse_id` | Health-due-date surfacing (`horse_health_events.next_due`) — not built; belongs with the uploads/expiry work. |
| **Contracts & deals** | `contract_id IS NOT NULL` | Counterparty and "deal" columns — the table's existing Person/Horse/Type/Contract columns are shown as-is; I did not add a `deals` join. Non-empty today (8 rows). |
| **Drafts, voids & archive** | `status IN (DRAFT, VOID) OR archived_at IS NOT NULL OR terminated_at IS NOT NULL` | Nothing missing structurally — the archived/terminated arms are simply unexercised today (0 rows have them set; 8 rows come from DRAFT+VOID alone), so the tab is never empty but its full range hasn't been observed live. |

No tab is empty under current data (I checked each: 5 / 61 / picker-gated-but-real / picker-
gated-but-real / 8 / 8), so none needed to be left out under the "don't fake a tab" rule.

The **Templates tab** from design-doc v2 §4–5 (Documents | Templates, with the full
version-control workflow) is a separate, much larger spec that this task never asked for — not
built, not attempted.

## 5. One RLS observation — found, not touched

`documents_select` / `contacts_select` / `horses_select` all gate **full** org-wide read behind
`is_admin()` (`app_role() IN ('ADMIN','SUPER_ADMIN')`). The frontend's `isStaff` (which gates
this page via `ProtectedRoute requireStaff`) is broader — it also includes `MANAGER` and
`EMPLOYEE`. So a MANAGER/EMPLOYEE user hitting this page would, under current RLS, see only
documents/contacts/horses they own or are a party to, not the full queue the page's own header
comment promises. **This is pre-existing and unchanged by this task** — `listDocuments()`'s
row-level visibility was never touched, only its column list and embeds. It's dormant today:
production `profiles.role` has only `ADMIN` (2), `SUPER_ADMIN` (1), `USER` (10) — no
MANAGER/EMPLOYEE rows exist, so nobody currently hits the gap. Flagging it because it's exactly
the kind of thing that becomes a silent, confusing bug the day a MANAGER account is created.
The RPCs I reused for the picker's person-step (`staffContactOptions`,
`staffAssignableTemplates`, `staffAssignDocuments`) are all gated on `has_staff_access()`
instead and don't have this gap.

## 6. Files changed

- `src/lib/api.ts` — `listDocuments()` rewritten (slim select + embeds); new
  `documentTypeOptions()`.
- `src/lib/ops/types.ts` — new `DocumentQueueRow`, `DocumentTypeOption`.
- `src/components/ops/documents/DocumentQueueTable.tsx` — status vocabulary, Person/Horse/Type
  columns, optional empty-state override.
- `src/components/ops/documents/DocumentQueuePicker.tsx` — new. The "+ Add new" picker.
- `src/components/app/ClientRecordActions.tsx` — `AssignDocumentsModal` gains optional
  `contactId`/`initialTemplateKey`/`initialTemplateTitle` and a person-picker first step.
- `src/pages/app/ops/DocumentsQueuePage.tsx` — button relabel + picker wiring, preset tabs,
  fetch-once.
- `src/pages/app/ops/NewContractPage.tsx` — reads `?type=purchase`.

`AppLayout.tsx` — not touched, no nav changes to report (the picker is page-level, not a nav
addition). `ClauseDocument.tsx` — not touched (this task never needed the renderer).

## 7. Verification

- `tsc --noEmit -p tsconfig.app.json` — clean.
- `eslint .` — 0 errors; only pre-existing warnings (confirmed by running lint against the
  unmodified `DocumentQueueTable.tsx` — same warning present before this task's changes).
- `vite build` — succeeds.
- All row counts and the join shape proved directly against production Postgres (the four
  status counts, the 6/14 template split, the six preset counts, the FK constraint names used
  in the embed hints, the `contract_kind` grouping).
- **Render: NOT VERIFIED.** No staff browser session exists in this environment. Everything
  above is proved at the query/type level, not by clicking through the UI.
