-- Write paths for the cascading field model: set structured responsibility,
-- toggle include/omit, toggle N/A. All gated the same way as set_contract_field
-- (staff, or a party whose controls permit editing that field), only on an
-- editable/editing document.

CREATE OR REPLACE FUNCTION public.set_field_responsibility(
  p_document_id uuid, p_field_key text, p_responsibility jsonb
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
  IF NOT (has_staff_access() AND v_org = current_org()) THEN
    IF NOT EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id()) THEN
      RAISE EXCEPTION 'not authorized for this document';
    END IF;
  END IF;
  UPDATE contract_fields
     SET responsibility = p_responsibility,
         -- keep a human-readable value for the merged body (party + detail/split)
         value = trim(coalesce(p_responsibility ->> 'party','')
                 || CASE WHEN p_responsibility -> 'split' IS NOT NULL
                    THEN ' (Owner ' || coalesce(p_responsibility #>> '{split,owner}','') || '% / Lessee '
                         || coalesce(p_responsibility #>> '{split,lessee}','') || '%)'
                    WHEN nullif(p_responsibility ->> 'detail','') IS NOT NULL
                    THEN ': ' || (p_responsibility ->> 'detail') ELSE '' END),
         is_na = false,
         entered_by_contact_id = current_contact_id(), entered_at = now(), updated_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_field_responsibility(uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_field_included(p_document_id uuid, p_field_key text, p_included boolean)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text;
BEGIN
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id())) THEN
    RAISE EXCEPTION 'not authorized for this document';
  END IF;
  UPDATE contract_fields SET included = p_included, updated_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_field_included(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_field_na(p_document_id uuid, p_field_key text, p_is_na boolean)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text;
BEGIN
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id())) THEN
    RAISE EXCEPTION 'not authorized for this document';
  END IF;
  UPDATE contract_fields
     SET is_na = p_is_na, value = CASE WHEN p_is_na THEN 'N/A' ELSE value END, updated_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_field_na(uuid, text, boolean) TO authenticated;

-- Seed a document's contract_fields from the template's contract_field_defs (the
-- cascading definitions). Adds any def not already present as a field. Idempotent.
CREATE OR REPLACE FUNCTION public.seed_cascade_fields(p_document_id uuid)
 RETURNS int
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_tmpl text; v_n int := 0;
BEGIN
  SELECT d.org_id, t.template_key INTO v_org, v_tmpl
    FROM documents d JOIN contract_templates t ON t.id = d.template_id
   WHERE d.id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;

  INSERT INTO contract_fields
    (org_id, document_id, field_key, label, section, owner_role, value, value_type,
     required, sort_order, parent_field_key, input_kind, options, conditional_on,
     guidance, is_optional, included)
  SELECT v_org, p_document_id, cd.field_key, cd.label, cd.section, cd.owner_role, NULL,
         cd.value_type, cd.required, cd.sort_order, cd.parent_field_key, cd.input_kind,
         cd.options, cd.conditional_on, cd.guidance, cd.is_optional,
         NOT cd.is_optional   -- optional fields start un-included
  FROM contract_field_defs cd
  WHERE cd.template_key = v_tmpl
    AND NOT EXISTS (SELECT 1 FROM contract_fields cf
                    WHERE cf.document_id = p_document_id AND cf.field_key = cd.field_key);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.seed_cascade_fields(uuid) TO authenticated;
