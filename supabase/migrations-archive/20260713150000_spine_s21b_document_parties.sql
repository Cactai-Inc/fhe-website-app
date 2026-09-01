/*
  # Spine Refactor — Slice 2.1b (step 1): document_parties + doc anchors

  The engagement was only a JOIN HUB for document generation/signing/authz:
  parties, horse, org. This step re-homes those onto the DOCUMENT so the
  generator, signing, and authz can stop needing an engagement:

    - document_parties  — the universal person/signer hub (replaces
                          engagement_parties for token resolution, signing, authz),
                          keyed by document_id.
    - documents.horse_id   — replaces engagements.primary_horse_id for {{HORSE.*}}.
    - documents.contract_id — links a DEAL document to its top-level contract.

  Backfill from the current engagement data so already-EXECUTED docs (Sarah 6 +
  Madeline 4 real; test docs purged in a later step) keep their parties + horse,
  i.e. their view-authz and re-merge inputs survive the engagement drop.
  Signatures are untouched (they ride document_id).

  Still additive: engagement_id / engagement_parties remain until the generator +
  readers are repointed and the engagement drop lands (same slice, later step).
*/

-- ── document_parties ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_parties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  contact_id   uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  party_role   text NOT NULL CHECK (party_role IN (
                 'CLIENT','BUYER','SELLER','LESSOR','LESSEE','OWNER','RIDER',
                 'PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
                 'CONTRACTOR','FACILITY_CONTACT','FHE')),
  relationship text,
  title        text,
  is_signer    boolean NOT NULL DEFAULT false,
  signer_order integer,
  org_id       uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, contact_id, party_role)
);

CREATE INDEX IF NOT EXISTS document_parties_document_idx ON document_parties(document_id);
CREATE INDEX IF NOT EXISTS document_parties_contact_idx  ON document_parties(contact_id);
CREATE INDEX IF NOT EXISTS document_parties_org_idx      ON document_parties(org_id);

ALTER TABLE document_parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_parties_staff_all ON document_parties;
CREATE POLICY document_parties_staff_all ON document_parties
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
-- members read document_parties only through SECURITY DEFINER RPCs
-- (my_contract_documents / contract_document_detail), matching the spine tables.
DROP POLICY IF EXISTS document_parties_org_boundary ON document_parties;
CREATE POLICY document_parties_org_boundary ON document_parties AS RESTRICTIVE
  FOR ALL TO authenticated USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- ── document anchors ─────────────────────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS horse_id    uuid REFERENCES horses(id)    ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS documents_horse_idx    ON documents(horse_id);
CREATE INDEX IF NOT EXISTS documents_contract_idx ON documents(contract_id);

-- ── backfill from the current engagement data ────────────────────────────────
INSERT INTO document_parties (document_id, contact_id, party_role, relationship, title, is_signer, signer_order, org_id)
SELECT d.id, ep.contact_id, ep.party_role, ep.relationship, ep.title, ep.is_signer, ep.signer_order, d.org_id
FROM documents d
JOIN engagement_parties ep ON ep.engagement_id = d.engagement_id
ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;

UPDATE documents d
SET horse_id = e.primary_horse_id
FROM engagements e
WHERE d.engagement_id = e.id
  AND e.primary_horse_id IS NOT NULL
  AND d.horse_id IS NULL;
