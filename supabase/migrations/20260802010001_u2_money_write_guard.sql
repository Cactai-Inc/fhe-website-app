-- U2.1c — SHAPE VALIDATION AT THE STRUCTURED-FIELD WRITE PATH
-- Owner ruling (2026-08-01): "add shape validation at the structured-field
-- write path so non-canonical money values are rejected at the door."
--
-- ROOT CAUSE of the malformed rows repaired in 20260802010000:
--   set_contract_field(uuid, text, text) accepts an OPAQUE text blob and
--   writes it verbatim. It never inspected the value against the field's
--   declared format_type, so all three of these were equally acceptable:
--     '850'                      (bare string where fee_schedule JSON belongs)
--     'Initial payment due: 0.'  (RENDERED PROSE written back into storage)
--     '$45,000.00'              (formatted string where a numeric belongs)
--   The fee-schedule editor in ClauseDocument.tsx/ContractCascade.tsx writes the
--   canonical {initial_due, options, selected} object, so the widget is not the
--   source. The prose-as-value rows are the signature of a value being read from
--   a RENDER and saved back — a test-era manual path, not the production widget.
--   Either way the door was open, so this closes it.
--
-- Verify-first: set_contract_field rebuilt as a full CREATE OR REPLACE from its
-- LIVE pg_get_functiondef body captured 2026-08-01.

BEGIN;

-- Rejects a money-shaped value that is neither a clean numeric nor the
-- canonical structured object. Returns NULL when acceptable, else the reason.
CREATE OR REPLACE FUNCTION public.money_shape_violation(p_format text, p_value text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE v jsonb;
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN RETURN NULL; END IF;  -- unset is always legal

  IF p_format = 'currency' THEN
    -- canonical: a bare numeric. '$45,000.00' and '1,200' are rejected so the
    -- symbol and separators can only ever come from fmt_money at render.
    IF btrim(p_value) ~ '^-?[0-9]+(\.[0-9]+)?$' THEN RETURN NULL; END IF;
    RETURN format('currency fields store a bare number (e.g. 45000), not %L — the $ and separators are applied at render', p_value);

  ELSIF p_format = 'fee_schedule' THEN
    -- canonical: the {initial_due, initial_terms?, options[], selected} object.
    BEGIN
      v := p_value::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RETURN format('fee_schedule fields store a JSON object, not %L — a bare amount or rendered prose is not a valid value', p_value);
    END;
    IF jsonb_typeof(v) <> 'object' THEN
      RETURN format('fee_schedule fields store a JSON object, not a %s', jsonb_typeof(v));
    END IF;
    -- a rendered-prose round-trip is the specific defect this guard exists for
    IF p_value ~ 'Initial payment due:' THEN
      RETURN 'that is rendered output, not a stored value — save the fee schedule, not its rendering';
    END IF;
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.money_shape_violation(text, text) IS
  'U2.1c door guard: NULL when a money value is canonical for its format_type, else the rejection reason.';

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
  v_changed    boolean;
  v_format     text;
  v_violation  text;
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

  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  -- THE CHANGES FREEZE (Notify model): an author may keep editing the document
  -- until a COUNTERPARTY has actually OPENED it. Requests freeze separately, per
  -- request, on being SEEN. Same predicate the Notify modal copy is built from.
  IF document_changes_frozen(p_document_id, NULL) THEN
    RAISE EXCEPTION 'this contract is fully executed — it can no longer be edited';
  END IF;

  -- U2.1c: money values must be canonical for their declared format BEFORE
  -- anything is written. A bare amount where the fee-schedule object belongs,
  -- a '$'-formatted string where a numeric belongs, or rendered prose saved
  -- back as a value are all rejected here rather than discovered later in a
  -- document that renders wrong.
  SELECT format_type INTO v_format
    FROM contract_field_defs fd
    JOIN documents d ON d.id = p_document_id
   WHERE fd.field_key = p_field_key
     AND fd.template_key = coalesce(
           (SELECT t.template_key FROM contract_templates t WHERE t.id = d.template_id),
           fd.template_key)
   LIMIT 1;
  IF v_format IS NOT NULL THEN
    v_violation := money_shape_violation(v_format, p_value);
    IF v_violation IS NOT NULL THEN
      RAISE EXCEPTION '%', v_violation;
    END IF;
  END IF;

  -- Decided before the write, while v_old_value still holds the prior value.
  v_changed := coalesce(v_old_value,'') IS DISTINCT FROM coalesce(p_value,'');

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := false;  -- H1: originator no longer grants edit rights
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
    OR (v_owner_role = 'DEAL' AND v_can_deal)
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  -- An edit changes the text a signature attested to, so any standing
  -- signature is voided. A save that writes back the identical value is not
  -- an edit and must leave signatures intact. The signer is told at the next SEND.
  IF v_changed THEN
    PERFORM void_signatures_on_edit(p_document_id);
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

  -- bidirectional horse sync (contract → record): open states only, party or
  -- staff, never clobbers a differing value, idempotent when unchanged.
  IF p_field_key LIKE 'HORSE.%' THEN
    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, p_value);
  END IF;

  -- audit: only log an actual change
  IF v_changed THEN
    PERFORM log_contract_change(p_document_id, 'field_value', p_field_key, v_label,
                                v_owner_role, v_old_value, p_value, '{}'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$function$;

COMMIT;
