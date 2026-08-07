/*
  # TASK PARTYRLS — party read access on document_parties

  Bug (diagnosed in TASK-A-PARTY-VERIFY-2, confirmed live below): document_parties
  has exactly two policies — document_parties_org_boundary (RESTRICTIVE,
  org_id = current_org()) and document_parties_staff_all (PERMISSIVE,
  has_staff_access()). A restrictive policy only narrows what a permissive
  policy grants; it never grants alone. With the only permissive policy
  staff-gated, a genuine non-staff party gets zero rows from any client-side
  read of document_parties — silently (RLS filters, no error).

  Effect: my_documents() (SECURITY DEFINER, bypasses RLS) still lists a
  party's documents correctly, but listMySignableDocuments()
  (src/lib/ops/api-client.ts) queries document_parties directly under the
  caller's own session and silently returns nothing, so a real party gets no
  click-through/PDF/download on the "Contracts you've signed" section. Proven
  live pre-fix: CJ's session (17 own document_parties rows) reads count 0.

  Fix: one permissive SELECT policy — a party may read their own party rows
  only. Whether a counterparty's row on the same document should also be
  readable is a separate product question, deliberately not answered here.

  document_deliveries was named alongside document_parties in the original
  diagnosis as having "the same class of gap," but live verification
  (docs/reports/TASK-PARTYRLS-REPORT.md) shows document_deliveries_select
  (20260629050000) already carries a `recipient_contact_id = current_contact_id()`
  OR-arm — a real party already reads their own deliveries today (proven live:
  CJ's session already returns 13 rows pre-fix). No change needed there; this
  migration touches document_parties only.
*/

CREATE POLICY document_parties_self_read ON document_parties
  FOR SELECT TO authenticated
  USING (contact_id = current_contact_id());
