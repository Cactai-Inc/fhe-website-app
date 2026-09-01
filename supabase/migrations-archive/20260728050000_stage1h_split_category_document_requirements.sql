-- Stage 1h (REMEDIATION_PLAN): split category_document_requirements.
--
--   category_document_requirements → group-driven ONBOARDING docs only
--     (Guest / Rider / Horse owner — the provisioning categories), now
--     CHECK-enforced. Readers: apply_category_documents (rewired in 1f),
--     category_document_defaults (unchanged — naturally returns only
--     onboarding rows once the contract-role rows move out; the staff UIs
--     filter by the three onboarding categories, verified).
--
--   contract_role_documents → per-document contract doc-roles
--     (BUYER / LESSEE / LESSOR / SELLER — contract-engine ownership). No DB
--     function reads these rows today (verified via pg_proc sweep); the
--     contract engine takes ownership of this table going forward.

CREATE TABLE contract_role_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  doc_role     text NOT NULL CHECK (doc_role IN ('BUYER','LESSEE','LESSOR','SELLER')),
  template_key text NOT NULL,
  UNIQUE (org_id, doc_role, template_key)
);
-- Same access model as the source table: no RLS policies; reads go through
-- SECURITY DEFINER functions. Lock the table down to definer paths.
ALTER TABLE contract_role_documents ENABLE ROW LEVEL SECURITY;

INSERT INTO contract_role_documents (org_id, doc_role, template_key)
SELECT org_id, upper(category), template_key
  FROM category_document_requirements
 WHERE category IN ('Buyer','Lessee','Lessor','Seller');

DELETE FROM category_document_requirements
 WHERE category IN ('Buyer','Lessee','Lessor','Seller');

ALTER TABLE category_document_requirements
  ADD CONSTRAINT category_document_requirements_onboarding_check
  CHECK (category IN ('Guest','Rider','Horse owner'));

-- Verify the split is lossless: 10 moved, 11 remain (21 total before).
DO $$
DECLARE v_moved int; v_left int;
BEGIN
  SELECT count(*) INTO v_moved FROM contract_role_documents;
  SELECT count(*) INTO v_left  FROM category_document_requirements;
  IF v_moved <> 10 OR v_left <> 11 THEN
    RAISE EXCEPTION 'split row counts unexpected: moved=%, left=% (want 10/11)', v_moved, v_left;
  END IF;
END $$;
