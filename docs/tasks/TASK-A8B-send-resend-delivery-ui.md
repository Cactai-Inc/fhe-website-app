# TASK A8B — Executed-copy Send/Resend UI + recipient-targeted delivery

Branch: `task/a8b-send-resend-ui` (from current main).
Scope: exactly this document. No refactors outside it.

## Context (read, do not re-verify)
- Executed-copy email now fires automatically from a DB trigger on execution
  (`documents_send_executed_email_trg` → `send_executed_document_email(doc_id)`),
  stamping `documents.executed_email_sent_at`. `resend_executed_document_email(doc_id)`
  clears the stamp and re-dispatches to ALL parties. Both RPCs exist and are granted
  to `authenticated`.
- `/api/deliver-documents` sends to the UNION of all document parties (idempotent
  per document+recipient+channel via `document_deliveries`).
- `/api/deliver-my-document` sends ONLY to the calling party (already correct).

## Build

### 1. Recipient targeting on /api/deliver-documents
Add optional `recipientContactIds: string[]` to the POST body.
- Absent/empty → current behavior (all parties). Unchanged.
- Present → deliver ONLY to those contacts, each of which MUST be a party on
  every document in `documentIds` OR a staff contact of the org (for admin
  "send to me"); otherwise 403 listing the offending id.
- Idempotency rows written exactly as today, per targeted recipient.
- A targeted send NEVER touches `documents.executed_email_sent_at` (that stamp
  means "the all-parties execution email happened").

### 2. Party-side Send/Resend button
Surface: `src/pages/app/Documents.tsx`, on each EXECUTED document row/panel.
- Reads `executed_email_sent_at` (add it to whatever query loads the rows).
- Label: `Send me a copy` when NULL, `Resend me a copy` when set.
- Action: POST `/api/deliver-my-document` with the document id and the caller's
  session (this endpoint already exists and self-targets). Success → toast
  "Sent to <their email>". Failure → visible error, no silent catch.

### 3. Admin 4-option menu
Surface: `src/pages/app/ContractPage.tsx` subheader (staff only, doc EXECUTED)
and `src/components/ops/documents/DeliveryPanel.tsx` if present there.
- One button `Send copies` (label `Resend copies` when `executed_email_sent_at`
  is set) opening a small menu with exactly:
  1. `Send to me` → `/api/deliver-documents` with `recipientContactIds: [my contact id]`.
     Admin's own contact comes from `current_contact_id()` via an existing
     helper (`myContactId()` in `src/lib/ops/api-client.ts`).
  2. `Send to <Lessor role label>` → the LESSOR/SELLER-side party contact id(s).
  3. `Send to <Lessee role label>` → the LESSEE/BUYER/COBUYER-side contact id(s).
  4. `Send to all parties` → call RPC `resend_executed_document_email(doc_id)`
     (NOT the endpoint directly — this path is the official all-parties resend
     and re-stamps sent state).
- Role labels come from the document's parties (`document_parties.party_role`),
  displayed as "Lessor"/"Lessee"/"Seller"/"Buyer" words, never person names.
- Menu options 2/3 hidden when that side has no party with an email.

### 4. Admin "send to me" recipient class
When the admin is NOT a party: endpoint must accept their staff contact id
(rule in §1). The delivery row records them as recipient — this is an audit
copy, not a party delivery; add `is_mirror = true` on that row
(`document_deliveries.is_mirror` exists) so party-delivery queries stay truthful.

## Done-checks (all must pass; print raw outputs in the report)
- `npm run typecheck` → 0 errors. `npm run lint` → 0 errors.
- curl (or fetch via node) against a LOCAL invocation is not possible; instead
  verify endpoint logic by unit-exercising the handler's recipient filter with
  a small node script hitting the deployed preview if available, OR paste the
  relevant code paths and reason line-by-line in the report (state which you did).
- Show, with a psql query, that a targeted delivery to one contact writes exactly
  one `document_deliveries` row and does not modify `executed_email_sent_at`.
  DB conn: first line of `.env.db` via `psql "$(cat .env.db)"`. Use document
  `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` (EXECUTED) read-only for state checks;
  do NOT send real email to its parties — for the write test create a throwaway
  contact, add it as is_mirror recipient via the endpoint path only if a
  deployed preview exists, otherwise document the manual test plan precisely.
- Report per §Report.

## Report
Write `docs/reports/TASK-A8B-REPORT.md` on your branch: what was built (file:line
per change), raw done-check outputs, anything retried and why, anything failed
after retry, and any deviation from this spec with justification. No summaries
in place of raw output. Print only the report path when finished.
