# TASK PARTYRLS — party read access on document_parties (+ document_deliveries)

## The defect (diagnosed in TASK-A-PARTY-VERIFY-2, confirmed by orchestrator against prod)

`document_parties` has exactly two policies:
- `document_parties_org_boundary` — RESTRICTIVE, `org_id = current_org()`
- `document_parties_staff_all` — PERMISSIVE, `has_staff_access()`

A restrictive policy only narrows what a permissive policy grants; it never grants alone.
With the only permissive policy staff-gated, a genuine non-staff party gets **zero rows**
from any client-side read — silently (RLS filters, no error).

Effect in the app: `my_documents()` (SECURITY DEFINER, bypasses RLS) correctly lists a
party's executed document, but the richer "Contracts you've signed" section is driven by
`listMySignableDocuments()` — a client-side query against `document_parties` under the
caller's own session — which silently returns nothing. So a real party gets **no
click-through, no PDF view, no download button**, ever. Empirically confirmed: CJ's own
`document_parties` row is invisible to CJ's own session; `current_org()` matches the
row's org exactly, ruling out an org mismatch.

`document_deliveries` has the same class of gap (no party-facing read policy). It blocks
the planned status-stamp-trail feature; fix it in the same migration.

## The fix

One migration adding permissive SELECT policies:

- `document_parties`: `contact_id = current_contact_id()` — a party may read **their own
  party rows only**. NOT all rows on documents they're party to: whether a counterparty's
  row should be readable is a separate product question; do not answer it here. If
  `listMySignableDocuments()` turns out to need counterparty rows to render, STOP and
  report that instead of widening the policy.
- `document_deliveries`: `recipient_contact_id = current_contact_id()`, same shape.

Read-first: dump both tables' existing policies and the exact text of
`listMySignableDocuments()` (and anything else in src/ querying either table client-side)
into the report BEFORE writing the migration, and design against what the code actually
selects.

## Rules

- Own git worktree, branch `task/partyrls` off origin/main.
- Dry-run the migration in BEGIN…ROLLBACK first; show raw psql output; then apply.
- SELECT policies only. No INSERT/UPDATE/DELETE grants of any kind.
- Test with CJ's non-staff identity (`d99f1472-…`, party on executed lease `ecaecd42-…`).
  Sarah's document `704c8d2d-…` is a live negotiation: read-only queries only.

## Verify (all with raw output in the report)

1. Before: `select count(*) from document_parties` as the party session → 0.
2. After: the same query returns exactly that party's own rows — and a query for another
   contact's rows still returns 0.
3. Staff session: unchanged results before/after.
4. The Documents page section driven by `listMySignableDocuments()` now renders for the
   party (click-through/PDF/download visible). If you cannot run a real browser session,
   verify the query it issues returns rows under the party's JWT and say plainly that the
   browser step remains for the owner.

## Report

`docs/reports/TASK-PARTYRLS-REPORT.md`. State what you verified vs. assume. This is the
blocker for re-testing A17; note anything else you find gated the same way (list, don't fix).
