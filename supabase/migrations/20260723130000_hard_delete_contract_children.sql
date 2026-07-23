-- Fix: deleting a contract fails on a foreign-key violation.
--
-- Regression: the lock-for-signing fix (20260722130000) now pre-creates PENDING
-- signature rows when a contract is locked. hard_delete_contract deleted several
-- child tables before the document, but NOT signatures — and signatures.document_id
-- is ON DELETE RESTRICT, so any locked/awaiting contract now blocks the delete
-- with "violates foreign key constraint signatures_document_id_fkey". The same
-- applies to the other RESTRICT/NO-ACTION children the RPC didn't clear:
-- document_deliveries, esign_consents (RESTRICT), and invitations (NO ACTION).
-- The CASCADE children clear themselves when the document goes; these do not.

CREATE OR REPLACE FUNCTION public.hard_delete_contract(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text; v_contract uuid;
BEGIN
  SELECT org_id, workflow_state, contract_id INTO v_org, v_state, v_contract
    FROM documents WHERE id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF v_state = 'executed' THEN RAISE EXCEPTION 'an executed document cannot be deleted'; END IF;

  DELETE FROM notifications WHERE link = '/app/contracts/' || p_document_id::text;

  -- Children that BLOCK a document delete (RESTRICT / NO ACTION) — clear first.
  DELETE FROM signatures          WHERE document_id = p_document_id;
  DELETE FROM esign_consents      WHERE document_id = p_document_id;
  DELETE FROM document_deliveries WHERE document_id = p_document_id;
  DELETE FROM invitations         WHERE document_id = p_document_id;
  -- horse linkage that references this doc as a source/evidence (NO ACTION)
  UPDATE horse_relationships SET source_document_id = NULL WHERE source_document_id = p_document_id;
  UPDATE horse_reconciliation SET evidence_document_id = NULL WHERE evidence_document_id = p_document_id;

  -- Remaining explicit deletes (CASCADE would also handle these, but keep the
  -- original explicit order intact).
  DELETE FROM contract_fields WHERE document_id = p_document_id;
  DELETE FROM document_parties WHERE document_id = p_document_id;
  DELETE FROM document_change_requests WHERE document_id = p_document_id;
  DELETE FROM contract_addenda WHERE document_id = p_document_id;

  DELETE FROM documents WHERE id = p_document_id;

  IF v_contract IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM documents WHERE contract_id = v_contract) THEN
    DELETE FROM contract_parties WHERE contract_id = v_contract;
    DELETE FROM contracts WHERE id = v_contract;
  END IF;
END;
$function$;
