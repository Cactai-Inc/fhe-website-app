-- Per-field control override. The author (staff, or the party who owns/filled the
-- field) sets lock / allow-edits / allow-suggestions on an INDIVIDUAL field, which
-- overrides the document-global control. Stored as jsonb {lock,edit,suggest}; NULL
-- = inherit the global. Only meaningful (and only shown) when it differs from global.

CREATE OR REPLACE FUNCTION public.set_field_control_override(
  p_document_id uuid, p_field_key text, p_override jsonb
)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  -- only staff or the originator may set per-field controls (it governs the other party)
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR EXISTS (SELECT 1 FROM documents d WHERE d.id = p_document_id AND d.originator_contact_id = current_contact_id())) THEN
    RAISE EXCEPTION 'not authorized to set field controls';
  END IF;
  UPDATE contract_fields
     SET control_override = CASE WHEN p_override = '{}'::jsonb OR p_override IS NULL THEN NULL ELSE p_override END,
         updated_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_field_control_override(uuid, text, jsonb) TO authenticated;
