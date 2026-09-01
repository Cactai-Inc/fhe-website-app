-- When a template's field_defs change after documents already exist (e.g. the
-- permitted-use rebuild added TXN.APPROVED_TRAINERS / TXN.OFFSITE_TRANSPORT /
-- TXN.EVALUATION_LENGTH+UNIT and removed others), in-flight documents keep their
-- old contract_fields rows and never see the new fields — contract_document_detail
-- reads rows, not defs. This helper reconciles a document's field rows with its
-- template's current field_defs:
--   • INSERT any def that has no row yet (blank value)
--   • UPDATE presentation/def columns on existing rows (label, options,
--     conditional_on, guidance, clause_key, section, sort_order, kinds) so schema
--     edits propagate — the entered VALUE is never touched
--   • DELETE rows whose field_key no longer exists in the defs
-- Only clause-model templates (those with contract_clause_defs) are reconciled.

CREATE OR REPLACE FUNCTION public.sync_contract_fields_from_defs(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid;
  v_tkey text;
BEGIN
  SELECT d.org_id, t.template_key INTO v_org, v_tkey
    FROM documents d JOIN contract_templates t ON t.id = d.template_id
   WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_tkey IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key = v_tkey) THEN
    RETURN;  -- flat templates manage their own fields
  END IF;

  -- new defs → new blank rows
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind)
  SELECT v_org, p_document_id, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on, d.guidance,
         d.required, d.is_optional, d.responsibility, d.sort_order, d.parent_field_key,
         d.responsibility_kind
    FROM contract_field_defs d
   WHERE d.template_key = v_tkey
     AND NOT EXISTS (
       SELECT 1 FROM contract_fields cf
        WHERE cf.document_id = p_document_id AND cf.field_key = d.field_key);

  -- existing rows → refresh def-owned columns (value is preserved)
  UPDATE contract_fields cf SET
      label = d.label, section = d.section, clause_key = d.clause_key,
      owner_role = d.owner_role, value_type = d.value_type,
      input_kind = nullif(d.input_kind,''), format_type = d.format_type,
      options = d.options, conditional_on = d.conditional_on, guidance = d.guidance,
      required = d.required, is_optional = d.is_optional, sort_order = d.sort_order,
      parent_field_key = d.parent_field_key, responsibility_kind = d.responsibility_kind,
      updated_at = now()
    FROM contract_field_defs d
   WHERE d.template_key = v_tkey
     AND cf.document_id = p_document_id AND cf.field_key = d.field_key;

  -- rows whose def is gone → remove (but never remove SYSTEM party auto-fill rows,
  -- which are inserted by fill_party_fields_from_contacts and have no def)
  DELETE FROM contract_fields cf
   WHERE cf.document_id = p_document_id
     AND cf.owner_role <> 'SYSTEM'
     AND NOT EXISTS (
       SELECT 1 FROM contract_field_defs d
        WHERE d.template_key = v_tkey AND d.field_key = cf.field_key);
END;
$function$;
