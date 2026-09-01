/*
  # Contract redlining — reader (part 3)

  contract_redline_state(document) feeds the UI: staged field proposals (with the
  current + proposed value and who proposed), the addendum clauses (open =
  pending/highlighted, accepted = in the terms), and whether the caller may
  propose an edit / add a clause. Read-gated to staff or a document party.
*/

CREATE OR REPLACE FUNCTION contract_redline_state(p_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized for this document';
  END IF;

  RETURN jsonb_build_object(
    'field_proposals', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
          'field_key', cf.field_key, 'label', cf.label,
          'current_value', cf.value, 'proposed_value', cf.proposed_value,
          'proposed_by', nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'mine', cf.proposed_by_contact_id = current_contact_id(),
          'proposed_at', cf.proposed_at) ORDER BY cf.sort_order), '[]'::jsonb)
      FROM contract_fields cf
      LEFT JOIN contacts c ON c.id = cf.proposed_by_contact_id
      WHERE cf.document_id = p_document_id AND cf.proposed_by_contact_id IS NOT NULL
    ),
    'addenda', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'item_number', a.item_number, 'body', a.body, 'status', a.status,
          'proposed_by_role', a.proposed_by_role,
          'proposed_by', nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'mine', a.proposed_by_contact_id = current_contact_id(),
          'created_at', a.created_at) ORDER BY a.item_number), '[]'::jsonb)
      FROM contract_addenda a
      LEFT JOIN contacts c ON c.id = a.proposed_by_contact_id
      WHERE a.document_id = p_document_id AND a.status IN ('open','accepted')
    ),
    'can_suggest', caller_may_propose(p_document_id, 'suggest'),
    'can_add_clause', caller_may_propose(p_document_id, 'add_clause')
  );
END;
$fn$;
REVOKE ALL ON FUNCTION contract_redline_state(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION contract_redline_state(uuid) TO authenticated, service_role;
