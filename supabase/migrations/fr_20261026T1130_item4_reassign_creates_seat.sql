-- Fix round 3, item 4 — attaching a counterparty to an EMPTY seat.
--
-- reassign_document_party UPDATEd document_parties WHERE party_role = role, so on a
-- staged contract whose counterparty seat was never created (lessor/seller left
-- empty at creation) the UPDATE touched zero rows and silently did nothing. Make it
-- INSERT the seat when none exists, the same way add_document_party_by_email does,
-- so staff can attach a counterparty from the dropdown, not only by email.

BEGIN;

CREATE OR REPLACE FUNCTION public.reassign_document_party(p_document_id uuid, p_party_role text, p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_contract uuid; v_role text := upper(p_party_role);
  v_n int; v_order int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state, contract_id INTO v_org, v_state, v_contract
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (coalesce(has_staff_access() AND v_org = current_org(), false)) THEN
    RAISE EXCEPTION 'only staff may reassign a party';
  END IF;
  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this contract can no longer be edited';
  END IF;
  IF v_role NOT IN ('LESSEE','LESSOR','BUYER','SELLER') THEN
    RAISE EXCEPTION 'invalid party role: %', p_party_role;
  END IF;
  -- the contact must be in the same org
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND org_id = v_org AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'unknown contact';
  END IF;

  UPDATE document_parties SET contact_id = p_contact_id
   WHERE document_id = p_document_id AND party_role = v_role;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- No seat for this role yet (a staged contract created with the counterparty
  -- empty): create it rather than silently doing nothing.
  IF v_n = 0 THEN
    SELECT coalesce(max(signer_order), 0) + 1 INTO v_order
      FROM document_parties WHERE document_id = p_document_id;
    INSERT INTO document_parties (org_id, document_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, p_document_id, p_contact_id, v_role, true, v_order)
      ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;
  END IF;

  IF v_contract IS NOT NULL THEN
    UPDATE contract_parties SET contact_id = p_contact_id
     WHERE contract_id = v_contract AND party_role = v_role;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      SELECT coalesce(max(signer_order), 0) + 1 INTO v_order
        FROM contract_parties WHERE contract_id = v_contract;
      INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
        VALUES (v_org, v_contract, p_contact_id, v_role, true, v_order)
        ON CONFLICT (contract_id, contact_id, party_role) DO NOTHING;
    END IF;
  END IF;

  -- clear the stale party auto-fill values so fill_party_fields repopulates them
  UPDATE contract_fields SET value = '', structured = NULL
   WHERE document_id = p_document_id
     AND field_key IN (v_role||'.FULL_NAME', v_role||'.PRINTED_NAME', v_role||'.ADDRESS',
                       v_role||'.EMAIL', v_role||'.PHONE');
  PERFORM fill_party_fields_from_contacts(p_document_id);
  PERFORM remerge_contract_from_clauses(p_document_id);
  RETURN jsonb_build_object('ok', true);
END;
$function$;

COMMIT;
