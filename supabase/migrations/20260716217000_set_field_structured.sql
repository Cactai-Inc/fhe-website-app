-- Persist a field's structured value (the source of truth) and immediately recompose
-- the document so derived prose + pair cost-children update. Author/party gated like
-- the other field writes; editable states only.
CREATE OR REPLACE FUNCTION public.set_field_structured(
  p_document_id uuid, p_field_key text, p_structured jsonb
)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid; v_state text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR contract_caller_is_originator(p_document_id)
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to edit this field';
  END IF;

  UPDATE contract_fields
     SET structured = CASE WHEN p_structured = '{}'::jsonb THEN NULL ELSE p_structured END,
         updated_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;

  -- recompose derived prose (this field + any pair cost-child) and re-merge the body
  PERFORM recompose_document_fields(p_document_id);
  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_field_structured(uuid, text, jsonb) TO authenticated;
