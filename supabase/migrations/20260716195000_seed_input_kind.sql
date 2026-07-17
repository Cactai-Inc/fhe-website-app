-- seed_contract_fields now derives input_kind from value_type (and _COST/_RESPONSIBILITY
-- -> responsibility) so every seeded field has a kind the cascade renderer can dispatch.
CREATE OR REPLACE FUNCTION public.seed_contract_fields(p_document_id uuid, p_fields jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid;
  v_state text;
  v_f     jsonb;
  v_n     integer := 0;
  v_by    uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state INTO v_org, v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF NOT (
       (has_staff_access() AND v_org = current_org())
    OR contract_caller_is_originator(p_document_id)
  ) THEN
    RAISE EXCEPTION 'not authorized to seed fields on document %', p_document_id;
  END IF;

  IF jsonb_typeof(p_fields) <> 'array' THEN
    RAISE EXCEPTION 'p_fields must be a jsonb array of field definitions';
  END IF;

  FOR v_f IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
    IF coalesce(v_f ->> 'field_key', '') = '' THEN
      RAISE EXCEPTION 'each field needs a field_key';
    END IF;
    IF coalesce(v_f ->> 'owner_role', '') = '' THEN
      RAISE EXCEPTION 'field % needs an owner_role', v_f ->> 'field_key';
    END IF;

    INSERT INTO contract_fields (
      org_id, document_id, field_key, label, section, owner_role,
      value, value_type, input_kind, required, sort_order,
      entered_by_contact_id, entered_at)
    VALUES (
      v_org, p_document_id,
      v_f ->> 'field_key',
      v_f ->> 'label',
      v_f ->> 'section',
      v_f ->> 'owner_role',
      v_f ->> 'value',
      coalesce(nullif(v_f ->> 'value_type', ''), 'text'),
      CASE
        WHEN coalesce(v_f ->> 'input_kind','') <> '' THEN v_f ->> 'input_kind'
        WHEN (v_f ->> 'value_type') = 'longtext' THEN 'longtext'
        WHEN (v_f ->> 'value_type') = 'currency' THEN 'currency'
        WHEN (v_f ->> 'value_type') = 'date' THEN 'date'
        WHEN (v_f ->> 'value_type') = 'select' THEN 'select'
        WHEN (v_f ->> 'value_type') = 'checkbox' THEN 'buttons'
        WHEN (v_f ->> 'field_key') LIKE '%_COST' THEN 'responsibility'
        WHEN (v_f ->> 'field_key') LIKE '%_RESPONSIBILITY' THEN 'responsibility'
        ELSE 'text' END,
      coalesce((v_f ->> 'required')::boolean, false),
      coalesce((v_f ->> 'sort_order')::int, 0),
      CASE WHEN nullif(v_f ->> 'value', '') IS NOT NULL THEN v_by END,
      CASE WHEN nullif(v_f ->> 'value', '') IS NOT NULL THEN now() END)
    ON CONFLICT (document_id, field_key) DO UPDATE SET
      label      = excluded.label,
      section    = excluded.section,
      owner_role = excluded.owner_role,
      value_type = excluded.value_type, input_kind = excluded.input_kind,
      required   = excluded.required,
      sort_order = excluded.sort_order,
      -- keep an already-entered value unless the seed provides a new one
      value                 = coalesce(nullif(excluded.value, ''), contract_fields.value),
      entered_by_contact_id = CASE WHEN nullif(excluded.value, '') IS NOT NULL
                                   THEN v_by ELSE contract_fields.entered_by_contact_id END,
      entered_at            = CASE WHEN nullif(excluded.value, '') IS NOT NULL
                                   THEN now() ELSE contract_fields.entered_at END;
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$function$;
