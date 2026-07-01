/*
  # FHE CRM — Documents, Signatures & Deliveries (migration 12)

  Phase 1, step 4 — the assemble→sign→deliver substrate. Additive.

  - document_status — lookup (enum strategy §9): DRAFT → AWAITING_SIGNATURE →
    EXECUTED, plus terminal VOID.
  - documents — a generated contract instance: the template merged for one
    engagement, with {{SIG.*}} left unmerged until signing. DOC- identifier,
    soft-delete, never hard-deletable (§148).
  - signatures — one row per signer per document. CLIENT may create their OWN
    signature (matrix line 82); once signed_at is set the row is SEALED — a
    trigger blocks any substantive update for everyone, admin included; the only
    path to change a signed contract is void-and-reissue (§98). Never
    hard-deletable (§148).
  - document_deliveries — the "deliver copies to each party" record.

  RLS (security model §3–4, E11): owner-scoped via engagement ownership. ADMIN
  full; CLIENT reads their own documents/signatures/deliveries and creates their
  own signature. TRAINER is deferred (handoff) — its policies can be added later
  without schema change, exactly as for engagements/horses.

  Ownership is resolved through a SECURITY DEFINER helper so RLS does not recurse
  (same approach as migrations 8 and 10).
*/

-- ============================================================
-- Lookup: document_status
-- ============================================================
CREATE TABLE IF NOT EXISTS document_status (
  code         text PRIMARY KEY,
  display_name text NOT NULL,
  is_terminal  boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0
);

INSERT INTO document_status (code, display_name, is_terminal, sort_order) VALUES
  ('DRAFT',              'Draft',              false, 1),
  ('AWAITING_SIGNATURE', 'Awaiting Signature', false, 2),
  ('EXECUTED',           'Executed',           true,  3),
  ('VOID',               'Void',               true,  4)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name, is_terminal = EXCLUDED.is_terminal, sort_order = EXCLUDED.sort_order;

ALTER TABLE document_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_status_read ON document_status;
CREATE POLICY document_status_read ON document_status
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS document_status_admin_write ON document_status;
CREATE POLICY document_status_admin_write ON document_status
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- documents — a generated contract instance ({{DOC.*}} source)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS document_code_seq START 1;

CREATE TABLE IF NOT EXISTS documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code   text UNIQUE,
  engagement_id  uuid NOT NULL REFERENCES engagements(id) ON DELETE RESTRICT,
  template_id    uuid REFERENCES contract_templates(id) ON DELETE RESTRICT,
  title          text,                                 -- snapshot of the template title at generation
  merged_body    text,                                 -- template body merged for this engagement; {{SIG.*}} left unmerged
  status         text NOT NULL DEFAULT 'DRAFT' REFERENCES document_status(code),
  generated_at   timestamptz NOT NULL DEFAULT now(),
  effective_date date,                                 -- {{DOC.EFFECTIVE_DATE}}, set at execution
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS documents_assign_code ON documents;
CREATE TRIGGER documents_assign_code BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('DOC-', 'document_code_seq');

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- signatures — one row per signer; sealed once signed
-- ============================================================
CREATE TABLE IF NOT EXISTS signatures (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  signer_contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  party_role        text NOT NULL CHECK (party_role IN (
                      'CLIENT','BUYER','SELLER','LESSOR','LESSEE','OWNER','RIDER',
                      'PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
                      'CONTRACTOR','FACILITY_CONTACT','FHE')),
  typed_name        text,                              -- the typed signature; NULL until signed
  signed_at         timestamptz,                       -- NULL until signed; sealing point
  ip_address        text,                              -- captured for the liability audit trail (§11)
  method            text,                              -- signature method (open value §11)
  created_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  UNIQUE (document_id, signer_contact_id, party_role)
);

-- Append-only after signing: once signed_at is set, the substantive fields are
-- immutable for everyone (admin included). Archival columns may still change.
CREATE OR REPLACE FUNCTION block_signed_signature_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL AND (
       NEW.typed_name        IS DISTINCT FROM OLD.typed_name
    OR NEW.signed_at         IS DISTINCT FROM OLD.signed_at
    OR NEW.ip_address        IS DISTINCT FROM OLD.ip_address
    OR NEW.method            IS DISTINCT FROM OLD.method
    OR NEW.party_role        IS DISTINCT FROM OLD.party_role
    OR NEW.signer_contact_id IS DISTINCT FROM OLD.signer_contact_id
    OR NEW.document_id       IS DISTINCT FROM OLD.document_id
  ) THEN
    RAISE EXCEPTION 'signature % is sealed (signed_at set); use void-and-reissue, not a direct update', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS signatures_seal_after_sign ON signatures;
CREATE TRIGGER signatures_seal_after_sign BEFORE UPDATE ON signatures
  FOR EACH ROW EXECUTE FUNCTION block_signed_signature_update();

-- ============================================================
-- document_deliveries — copies delivered to each party
-- ============================================================
CREATE TABLE IF NOT EXISTS document_deliveries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  recipient_contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  channel              text NOT NULL DEFAULT 'PORTAL' CHECK (channel IN ('EMAIL','PORTAL','DOWNLOAD','MAIL')),
  copy_url             text,                            -- storage URL of the delivered copy
  delivered_at         timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  deleted_by           uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

-- ============================================================
-- Ownership predicate (SECURITY DEFINER — no RLS recursion)
-- A document is owned when its engagement is owned by the caller's client.
-- ============================================================
CREATE OR REPLACE FUNCTION caller_owns_document(doc_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM documents d
    JOIN engagements e ON e.id = d.engagement_id
    WHERE d.id = doc_id
      AND d.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND e.client_id = current_client_id()
  );
$$;

-- ============================================================
-- RLS — documents (admin full; client reads own)
-- ============================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT TO authenticated
  USING (is_admin() OR caller_owns_document(id));

DROP POLICY IF EXISTS documents_admin_write ON documents;
CREATE POLICY documents_admin_write ON documents
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- RLS — signatures (admin full; client reads own docs' signatures and may
-- create their OWN signature as self-signer)
-- ============================================================
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signatures_select ON signatures;
CREATE POLICY signatures_select ON signatures
  FOR SELECT TO authenticated
  USING (is_admin() OR (deleted_at IS NULL AND caller_owns_document(document_id)));

DROP POLICY IF EXISTS signatures_admin_write ON signatures;
CREATE POLICY signatures_admin_write ON signatures
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- CLIENT self-sign: insert a signature for themselves on a document they own.
DROP POLICY IF EXISTS signatures_insert_self ON signatures;
CREATE POLICY signatures_insert_self ON signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    signer_contact_id = current_contact_id()
    AND caller_owns_document(document_id)
  );

-- ============================================================
-- RLS — document_deliveries (admin full; client reads own docs / own copies)
-- ============================================================
ALTER TABLE document_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_deliveries_select ON document_deliveries;
CREATE POLICY document_deliveries_select ON document_deliveries
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (deleted_at IS NULL AND (
         caller_owns_document(document_id)
         OR recipient_contact_id = current_contact_id()
       ))
  );

DROP POLICY IF EXISTS document_deliveries_admin_write ON document_deliveries;
CREATE POLICY document_deliveries_admin_write ON document_deliveries
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- Never hard-deletable (§148): documents and signatures. Archival via
-- deleted_at is the only removal mechanism.
-- ============================================================
REVOKE DELETE ON documents  FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON signatures FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS documents_engagement_idx     ON documents (engagement_id);
CREATE INDEX IF NOT EXISTS documents_template_idx        ON documents (template_id);
CREATE INDEX IF NOT EXISTS documents_status_idx          ON documents (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS signatures_document_idx        ON signatures (document_id);
CREATE INDEX IF NOT EXISTS signatures_signer_idx          ON signatures (signer_contact_id);
CREATE INDEX IF NOT EXISTS document_deliveries_document_idx  ON document_deliveries (document_id);
CREATE INDEX IF NOT EXISTS document_deliveries_recipient_idx ON document_deliveries (recipient_contact_id);
