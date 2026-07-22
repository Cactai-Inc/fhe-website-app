-- FIX: "there's no way to execute the signatures."
--
-- Root cause: locking a contract re-merges the body but never creates any rows in
-- the `signatures` table. The entire signing UI (the Sign box, the "Send to
-- party" buttons, the per-party signature status, sendableRoles/invitableRoles)
-- reads from contract_document_detail.signatures, which is built ONLY from
-- existing `signatures` rows. With zero rows, the page shows nothing to sign — a
-- deadlock: you can't sign because nothing renders, and nothing renders because
-- no one has signed.
--
-- Fix, three parts:
--   1. record_signature: on conflict UPDATE the pending row (was DO NOTHING, which
--      would have silently dropped a real signature once pending rows exist).
--   2. advance_document_workflow: at lock, seed a pending signature row
--      (signed_at IS NULL) for every is_signer party. Idempotent.
--   3. Backfill pending rows for any already-locked/awaiting doc that has none.

-- ── 1. record_signature: UPDATE the pending row on conflict ──────────────────
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('record_signature'::regproc);
  v_def := replace(v_def,
$old$    VALUES (v_doc_org, p_document_id, v_signer, p_party_role, p_typed_name, now(), v_ip, v_ua, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;$old$,
$new$    VALUES (v_doc_org, p_document_id, v_signer, p_party_role, p_typed_name, now(), v_ip, v_ua, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO UPDATE
      SET typed_name = EXCLUDED.typed_name,
          signed_at  = EXCLUDED.signed_at,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          method     = EXCLUDED.method
      WHERE signatures.signed_at IS NULL;  -- never overwrite an already-sealed signature$new$);
  IF v_def NOT LIKE '%DO UPDATE%' THEN
    RAISE EXCEPTION 'record_signature: conflict clause not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;

-- ── 2. advance_document_workflow: seed pending signature rows at lock ─────────
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('advance_document_workflow'::regproc);
  -- Insert the seeding block right after the state UPDATE that starts the lock branch.
  v_def := replace(v_def,
$old$  IF p_to = 'locked' THEN
    SELECT EXISTS (SELECT 1 FROM signatures$old$,
$new$  IF p_to = 'locked' THEN
    -- Seed a PENDING signature row for every signer party so the signing surface
    -- has something to render. Idempotent (unique key), leaves sealed rows alone.
    INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, method)
      SELECT v_org, p_document_id, dp.contact_id, dp.party_role, 'TYPED'
        FROM document_parties dp
       WHERE dp.document_id = p_document_id
         AND dp.is_signer = true
         AND dp.contact_id IS NOT NULL
         AND dp.party_role = ANY (ARRAY['CLIENT','BUYER','SELLER','LESSOR','LESSEE',
              'OWNER','RIDER','PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
              'CONTRACTOR','FACILITY_CONTACT','COMPANY'])
      ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

    SELECT EXISTS (SELECT 1 FROM signatures$new$);
  IF v_def NOT LIKE '%Seed a PENDING signature row%' THEN
    RAISE EXCEPTION 'advance_document_workflow: lock branch not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;

-- ── 3. Backfill: any locked/awaiting doc with signer parties but no sig rows ──
INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, method)
  SELECT d.org_id, d.id, dp.contact_id, dp.party_role, 'TYPED'
    FROM documents d
    JOIN document_parties dp ON dp.document_id = d.id
   WHERE d.deleted_at IS NULL
     AND dp.is_signer = true
     AND dp.contact_id IS NOT NULL
     AND dp.party_role = ANY (ARRAY['CLIENT','BUYER','SELLER','LESSOR','LESSEE',
          'OWNER','RIDER','PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
          'CONTRACTOR','FACILITY_CONTACT','COMPANY'])
     AND (d.workflow_state = 'locked' OR d.status = 'AWAITING_SIGNATURE')
     AND d.status <> 'EXECUTED'
  ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;
