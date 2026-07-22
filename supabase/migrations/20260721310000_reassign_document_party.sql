-- Staff can reassign a contract party (Lessee / Lessor) to a different contact
-- after creation, without recreating the whole contract. Updates both the
-- document_parties and contract_parties rows for the role, then re-fills the
-- party auto-fill fields (LESSOR.*/LESSEE.*) from the new contact and re-merges.
CREATE OR REPLACE FUNCTION public.reassign_document_party(
  p_document_id uuid, p_party_role text, p_contact_id uuid
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_contract uuid; v_role text := upper(p_party_role);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state, contract_id INTO v_org, v_state, v_contract
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN
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
  IF v_contract IS NOT NULL THEN
    UPDATE contract_parties SET contact_id = p_contact_id
     WHERE contract_id = v_contract AND party_role = v_role;
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

-- Summary of a document's parties + horse for the editable "Parties & Horse" card:
-- role, current contact id + name, and the attached horse id + name. Staff or any
-- party of the document may read it.
CREATE OR REPLACE FUNCTION public.document_parties_summary(p_document_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_horse uuid;
BEGIN
  SELECT org_id, horse_id INTO v_org, v_horse FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN jsonb_build_object(
    'parties', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', dp.party_role,
          'contact_id', dp.contact_id,
          'name', nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''))
        ORDER BY dp.party_role)
      FROM document_parties dp
      LEFT JOIN contacts c ON c.id = dp.contact_id
      WHERE dp.document_id = p_document_id
        AND dp.party_role IN ('LESSEE','LESSOR','BUYER','SELLER')), '[]'::jsonb),
    'horse_id', v_horse,
    'horse_name', (SELECT coalesce(nullif(registered_name,''), nickname) FROM horses WHERE id = v_horse)
  );
END;
$function$;
