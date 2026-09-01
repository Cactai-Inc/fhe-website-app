-- contract_document_detail now returns format_type, structured, and the pair keys
-- (pair_cost_key/pair_manage_key) so the cascade renderer can build the new controls.
CREATE OR REPLACE FUNCTION public.contract_document_detail(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me    uuid := current_contact_id();
  v_org   uuid;
  v_recip boolean;
  v_state text;
  v_orig  uuid;
  v_staff boolean;
  v_roles text[];
  v_can_fill boolean;
  v_can_deal boolean;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, recipient_editing, workflow_state, originator_contact_id
    INTO v_org, v_recip, v_state, v_orig
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  v_staff := has_staff_access() AND v_org = current_org();
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  SELECT array_agg(r) INTO v_roles FROM caller_party_roles(p_document_id) r;
  v_roles := coalesce(v_roles, ARRAY[]::text[]);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM unnest(v_roles) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  SELECT jsonb_build_object(
    'document', (SELECT jsonb_build_object(
        'document_id', d.id, 'title', d.title, 'status', d.status,
        'workflow_state', d.workflow_state, 'recipient_editing', d.recipient_editing,
        'execution_hash', d.execution_hash, 'merged_body', d.merged_body,
        'is_originator', (d.originator_contact_id = v_me),
        'horse_section_confirmed_at', d.horse_section_confirmed_at,
        'sent_at', d.sent_at,
        'archived_at', d.archived_at,
        'cancelled_at', d.cancelled_at,
        'horse_id', d.horse_id,
        'horse_section_confirmed_by', d.horse_section_confirmed_by)
      FROM documents d WHERE d.id = p_document_id),
    'my_roles', to_jsonb(v_roles),
    'party_controls', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', c.party_role, 'can_fill', c.can_fill,
          'can_edit_deal', c.can_edit_deal, 'can_suggest', c.can_suggest, 'can_add_clause', coalesce(c.can_add_clause,false)))
      FROM document_party_controls c WHERE c.document_id = p_document_id), '[]'::jsonb),
    'fields', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'field_key', cf.field_key, 'label', cf.label, 'section', cf.section,
          'owner_role', cf.owner_role, 'value', cf.value, 'value_type', cf.value_type,
          'required', cf.required, 'sort_order', cf.sort_order,
          'parent_field_key', cf.parent_field_key, 'input_kind', cf.input_kind,
          'options', cf.options, 'conditional_on', cf.conditional_on, 'guidance', cf.guidance,
          'is_optional', cf.is_optional, 'included', cf.included, 'is_na', cf.is_na,
          'control_override', cf.control_override, 'responsibility', cf.responsibility,
          'format_type', cf.format_type, 'structured', cf.structured,
          'pair_cost_key', cf.pair_cost_key, 'pair_manage_key', cf.pair_manage_key,
          'can_edit', (
            v_staff
            OR (cf.owner_role = 'DEAL' AND ((v_orig = v_me) OR v_recip OR v_can_deal))
            OR (cf.owner_role <> 'DEAL' AND cf.owner_role = ANY(v_roles) AND v_can_fill)
          ) AND v_state IN ('editable','editing'))
        ORDER BY cf.sort_order, cf.field_key)
      FROM contract_fields cf WHERE cf.document_id = p_document_id), '[]'::jsonb),
    'open_change_requests', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', cr.id, 'annotation_number', cr.annotation_number,
          'target_field_key', cr.target_field_key, 'target_section', cr.target_section,
          'current_value', cr.current_value, 'requested_change', cr.requested_change,
          'status', cr.status)
        ORDER BY cr.annotation_number)
      FROM document_change_requests cr
      WHERE cr.document_id = p_document_id AND cr.status = 'open'), '[]'::jsonb),
    'shares', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'shared_with_contact_id', s.shared_with_contact_id,
          'recipient_editing', s.recipient_editing, 'notified_at', s.notified_at))
      FROM document_shares s WHERE s.document_id = p_document_id), '[]'::jsonb),
    'signatures', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', sg.party_role, 'typed_name', sg.typed_name,
          'signed_at', sg.signed_at)
        ORDER BY sg.party_role)
      FROM signatures sg WHERE sg.document_id = p_document_id AND sg.deleted_at IS NULL), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
