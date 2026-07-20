/*
  # C-1 — Close the structured-write authorization gap

  `set_field_structured` (20260716217000) authorized ANY document party to write
  ANY field, then updated contract_fields with no per-field ownership check —
  bypassing the owner_role / DEAL / recipient_editing matrix that
  `set_contract_field` enforces. Because `structured` is the source of truth and
  recompose overwrites `value`, a counterparty could rewrite the other side's
  fields or the deal terms through the structured path.

  This migration inserts the SAME ownership matrix `set_contract_field` uses
  (identical helpers: caller_party_roles, contract_caller_is_originator,
  document_party_controls, documents.recipient_editing) so the structured path
  enforces identically to the scalar path. No new/parallel rule — the two write
  paths now share one authorization model.

  Rule:
    allow if  staff
          OR  (owner_role  = 'DEAL' AND (originator OR recipient_editing OR can_edit_deal))
          OR  (owner_role <> 'DEAL' AND owns_that_role AND can_fill)

  Behaviour preserved: '{}' clears the structured value to NULL; recompose +
  remerge still run after a successful write; the editable/editing state gate and
  the HORSE.* re-confirmation reset are kept, matching set_contract_field.
*/

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

  SELECT owner_role INTO v_owner_role
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  -- ── ownership matrix (mirrors set_contract_field) ──
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

  -- ── write ──
  UPDATE contract_fields
     SET structured = CASE WHEN p_structured = '{}'::jsonb THEN NULL ELSE p_structured END,
         updated_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;

  -- editing a HORSE.* field re-opens the horse-section confirmation (parity with set_contract_field)
  IF p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  -- recompose derived prose (this field + any pair cost-child) and re-merge the body
  PERFORM recompose_document_fields(p_document_id);
  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;
