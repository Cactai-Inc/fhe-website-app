/*
  # Phase 1d (part 2) — hook the write RPCs into contract_change_log

  Adds a log_contract_change(...) call to each content-mutating RPC, capturing
  old→new so track-changes and the retained audit trail have a record. Each
  function below is the CURRENT live definition with ONLY the logging line added
  (and, for the resolvers, an old/new capture) — the authorization and behaviour
  are unchanged. set_field_structured keeps the C-1 ownership matrix from
  20260720120000.

  Logging is best-effort inside log_contract_change (it never raises), so a
  logging fault cannot block a legitimate edit.
*/

-- ── set_contract_field: log the scalar value change ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_contract_field(p_document_id uuid, p_field_key text, p_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_can_fill   boolean;
  v_can_deal   boolean;
  v_row        contract_fields%ROWTYPE;
  v_confirmed  timestamptz;
  v_old_value  text;
  v_label      text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing, horse_section_confirmed_at
    INTO v_org, v_state, v_recip_edit, v_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  SELECT owner_role, value, label INTO v_owner_role, v_old_value, v_label
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := contract_caller_is_originator(p_document_id);
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM caller_party_roles(p_document_id) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  IF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND (v_is_orig OR v_recip_edit OR v_can_deal))
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  UPDATE contract_fields
     SET value = p_value,
         entered_by_contact_id = current_contact_id(),
         entered_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key
   RETURNING * INTO v_row;

  IF p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  -- audit: only log an actual change
  IF coalesce(v_old_value,'') IS DISTINCT FROM coalesce(p_value,'') THEN
    PERFORM log_contract_change(p_document_id, 'field_value', p_field_key, v_label,
                                v_owner_role, v_old_value, p_value, '{}'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$function$;


-- ── set_field_structured: log the structured change (keeps C-1 matrix) ──────
CREATE OR REPLACE FUNCTION public.set_field_structured(
  p_document_id uuid, p_field_key text, p_structured jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_confirmed  timestamptz;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_can_fill   boolean;
  v_can_deal   boolean;
  v_label      text;
  v_old_prose  text;
  v_new_prose  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing, horse_section_confirmed_at
    INTO v_org, v_state, v_recip_edit, v_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  SELECT owner_role, label, value INTO v_owner_role, v_label, v_old_prose
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  v_is_staff  := has_staff_access() AND v_org = current_org();
  v_is_orig   := contract_caller_is_originator(p_document_id);
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM caller_party_roles(p_document_id) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  IF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND (v_is_orig OR v_recip_edit OR v_can_deal))
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  UPDATE contract_fields
     SET structured = CASE WHEN p_structured = '{}'::jsonb THEN NULL ELSE p_structured END,
         updated_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;

  IF p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  PERFORM recompose_document_fields(p_document_id);
  PERFORM remerge_contract_from_fields(p_document_id);

  -- audit: capture the recomposed prose after the write; only log a real change
  SELECT value INTO v_new_prose FROM contract_fields
    WHERE document_id = p_document_id AND field_key = p_field_key;
  IF coalesce(v_old_prose,'') IS DISTINCT FROM coalesce(v_new_prose,'') THEN
    PERFORM log_contract_change(p_document_id, 'field_structured', p_field_key, v_label,
                                v_owner_role, v_old_prose, v_new_prose,
                                jsonb_build_object('structured', p_structured));
  END IF;
END;
$function$;
