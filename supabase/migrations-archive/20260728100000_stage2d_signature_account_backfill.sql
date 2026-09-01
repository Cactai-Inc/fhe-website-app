-- Stage 2d (REMEDIATION_PLAN): link existing signed documents to accounts
-- where an account exists — via signatures.signer_user_id (the 2c linkage,
-- provable by query: signatures → profiles.contact_id → auth account).
--
-- EXCLUDED per D1: the 6 stranded executed documents on the test/company
-- identities (5 on the soft-deleted cjzigs contact d268330c…, 1 on the
-- company contact 352c3898…). They exit with the Part-5F purge, untouched —
-- no re-anchoring, no linkage stamped on them or their signatures.

DO $$
DECLARE
  c_stranded_contacts constant uuid[] := ARRAY[
    'd268330c-436a-4f42-bf88-9172d9b4155f',  -- cjzigs@icloud.com (test identity, soft-deleted)
    '352c3898-65d0-4a90-ad59-29107b7e03fe'   -- the company contact
  ]::uuid[];
  v_n int;
BEGIN
  UPDATE signatures s
     SET signer_user_id = p.user_id
    FROM profiles p
   WHERE p.contact_id = s.signer_contact_id
     AND s.signer_user_id IS NULL
     AND s.deleted_at IS NULL
     AND s.signer_contact_id <> ALL(c_stranded_contacts)
     AND NOT EXISTS (SELECT 1 FROM documents d
                      WHERE d.id = s.document_id
                        AND d.contact_id = ANY(c_stranded_contacts));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'stage2d: % signatures linked to accounts', v_n;

  -- Verify: the stranded docs' signatures remain untouched.
  IF EXISTS (SELECT 1 FROM signatures s
              JOIN documents d ON d.id = s.document_id
             WHERE d.contact_id = ANY(c_stranded_contacts)
               AND s.signer_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'stage2d: a stranded-doc signature was linked — exclusion failed';
  END IF;
END $$;
