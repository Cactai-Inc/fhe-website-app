/*
  # Spine Refactor — Slice 2.1a: documents -> client (additive)

  Documents move from being children of an engagement to belonging to the CLIENT
  (contact), signed once and reused. This is the ADDITIVE half: add
  `documents.contact_id` and backfill it from the current engagement->client->
  contact path. NON-BREAKING — `engagement_id` stays for now; the drop of
  `engagement_id` + the code repoint + the test-doc purge land in slice 2.1b, in
  the same commit that wires the new contact-keyed reads (no-parallel-systems).

  Backfill verified against live data (rolled-back rehearsal): all 22 documents
  resolve a contact, 0 null. Signatures ride `document_id` and never move.
*/

ALTER TABLE documents ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE RESTRICT;

UPDATE documents d
SET contact_id = cl.contact_id
FROM engagements e
JOIN clients cl ON cl.id = e.client_id
WHERE d.engagement_id = e.id
  AND d.contact_id IS NULL;

CREATE INDEX IF NOT EXISTS documents_contact_idx ON documents(contact_id);
