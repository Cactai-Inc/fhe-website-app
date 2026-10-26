-- VALIDATION ROUND cleanup (2026-10-26): remove every test deal + its documents and
-- contracts, restore ZZ Test Horse, and leave ZZ Test Owner + the staff/client
-- fixtures intact. Scoped strictly to the 12 test contract_ids created this round.
-- (Alias ACCOUNTS are removed separately via admin_purge_contact.)

DO $cleanup$
DECLARE
  v_cids uuid[] := ARRAY[
    'ee2e53dc-eff2-4190-ba6f-51fbeb11c9a5','31b80b21-ad6c-4798-a950-2eeb0fcd225d',
    '60560224-76ba-4ef0-806d-540d28903e53','3e0b8303-4e5b-4b3f-8134-4c0e7a603079',
    'a831f859-3dc9-40d1-a0ec-28c89fbbae7e','4d0ef686-b6b9-4f7e-99b5-e1fbf6190bdf',
    'fd1ec403-a532-4193-8387-ee5d49f8d25e','0f0ce89d-a7c0-4aec-ad46-5df3b3f9545c',
    '1f4ff054-04de-4c76-a635-b75d84616975','50493097-15d9-445d-a5dd-392c8cc2efd4',
    '4bfe2662-42ee-43e6-b716-0bf2905a790f','f61ac1e3-e9c4-4ab4-bea0-f73283020eed'
  ]::uuid[];
  v_horse uuid := '2d07a570-d79c-4cc7-b292-a42c83c2d62c';   -- ZZ Test Horse
  v_owner uuid := '7cef640f-0643-453f-b7f0-4fc8415fa781';   -- ZZ Test Owner (KEEP)
  v_docs uuid[];
BEGIN
  SELECT array_agg(id) INTO v_docs FROM documents WHERE contract_id = ANY(v_cids);
  v_docs := coalesce(v_docs, ARRAY[]::uuid[]);

  -- document-level dependents (only the tables shown to carry rows + a safety net)
  DELETE FROM signatures               WHERE document_id = ANY(v_docs);
  DELETE FROM esign_consents           WHERE document_id = ANY(v_docs);
  DELETE FROM document_deliveries      WHERE document_id = ANY(v_docs);
  DELETE FROM document_opened          WHERE document_id = ANY(v_docs);
  DELETE FROM contract_fields          WHERE document_id = ANY(v_docs);
  DELETE FROM document_party_controls  WHERE document_id = ANY(v_docs);
  DELETE FROM document_parties         WHERE document_id = ANY(v_docs);
  DELETE FROM contract_execution_audit WHERE document_id = ANY(v_docs);
  DELETE FROM contract_change_log      WHERE document_id = ANY(v_docs);
  DELETE FROM contract_notes           WHERE document_id = ANY(v_docs);
  DELETE FROM document_horses          WHERE document_id = ANY(v_docs);
  DELETE FROM invitations              WHERE document_id = ANY(v_docs);
  -- the horse_relationships this round created (all test-sourced, on ZZ Test Horse)
  DELETE FROM horse_relationships      WHERE source_document_id = ANY(v_docs);
  DELETE FROM horse_relationships      WHERE horse_id = v_horse;  -- belt-and-suspenders

  -- the documents, then the contract-level dependents, then the deals + contracts
  DELETE FROM documents        WHERE id = ANY(v_docs);
  DELETE FROM contract_parties WHERE contract_id = ANY(v_cids);
  DELETE FROM deals            WHERE contract_id = ANY(v_cids);
  DELETE FROM contracts        WHERE id = ANY(v_cids);

  -- restore ZZ Test Horse to its fixture baseline
  UPDATE horses
     SET current_owner_contact_id = v_owner,
         registered_name = '',
         lessee_contact_id = NULL,
         owner_name_text = NULL
   WHERE id = v_horse;
END $cleanup$;
