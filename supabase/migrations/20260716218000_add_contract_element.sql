-- ADD ELEMENT — insert a new section, item, or field into a live contract, with
-- placement (where) and, for fields, a format_type (what). Author/party gated,
-- editable docs only. sort_order placement:
--   * new SECTION: inserted between two existing sections → gets a sort_order
--     midway between the last field of section A and the first field of section B.
--   * new FIELD: added to a section at a position (1-based among that section's
--     roots); everything at/after that position shifts down.
-- "Item" in this model = a field (the atomic addable unit); a labeled item with a
-- pair is just a field with format_type='pair'. New fields carry a CUSTOM.<key> id
-- so they never collide with template tokens (they render but aren't in the body;
-- their prose is appended as an added clause on lock — handled elsewhere).

CREATE OR REPLACE FUNCTION public.add_contract_element(
  p_document_id uuid,
  p_kind text,                 -- 'section' | 'field'
  p_section text,              -- target/new section name
  p_after_section text DEFAULT NULL,   -- for a new section: insert AFTER this one
  p_position integer DEFAULT NULL,     -- for a field: 1-based position within the section
  p_label text DEFAULT NULL,
  p_format_type text DEFAULT 'text',
  p_options jsonb DEFAULT NULL,        -- for select/buttons
  p_guidance text DEFAULT NULL
)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_org uuid; v_state text;
  v_new_key text;
  v_sort integer;
  v_input_kind text;
  v_after_max integer;
  v_before_min integer;
  v_seq integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR contract_caller_is_originator(p_document_id)
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to modify this document';
  END IF;

  -- resolve input_kind from the format registry (fallback text)
  SELECT input_kind INTO v_input_kind FROM contract_formats WHERE format_type = p_format_type;
  v_input_kind := coalesce(v_input_kind, 'text');
  IF coalesce(p_guidance,'') = '' THEN
    SELECT guidance INTO p_guidance FROM contract_formats WHERE format_type = p_format_type;
  END IF;

  -- unique custom key
  SELECT count(*) INTO v_seq FROM contract_fields WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%';
  v_new_key := 'CUSTOM.' || upper(regexp_replace(coalesce(p_label,'FIELD'), '[^a-zA-Z0-9]+', '_', 'g')) || '_' || (v_seq + 1);

  IF p_kind = 'section' THEN
    -- place the new section's first field between p_after_section and the next one
    SELECT max(sort_order) INTO v_after_max FROM contract_fields
      WHERE document_id = p_document_id AND section = p_after_section;
    SELECT min(sort_order) INTO v_before_min FROM contract_fields
      WHERE document_id = p_document_id AND sort_order > coalesce(v_after_max, 0);
    v_sort := coalesce(v_after_max, 0) + CASE
      WHEN v_before_min IS NULL THEN 100
      ELSE greatest(1, (v_before_min - coalesce(v_after_max,0)) / 2) END;
  ELSE
    -- field within p_section at p_position (1-based). Shift everything at/after down.
    IF p_position IS NULL THEN
      SELECT coalesce(max(sort_order),0) + 10 INTO v_sort FROM contract_fields
        WHERE document_id = p_document_id AND section = p_section;
    ELSE
      -- the sort_order of the field currently at that position
      SELECT sort_order INTO v_sort FROM (
        SELECT sort_order, row_number() OVER (ORDER BY sort_order) AS rn
          FROM contract_fields WHERE document_id = p_document_id AND section = p_section
            AND parent_field_key IS NULL
      ) q WHERE q.rn = p_position;
      IF v_sort IS NULL THEN
        SELECT coalesce(max(sort_order),0) + 10 INTO v_sort FROM contract_fields
          WHERE document_id = p_document_id AND section = p_section;
      ELSE
        -- make room: bump this field and everything after it in the doc
        UPDATE contract_fields SET sort_order = sort_order + 10
          WHERE document_id = p_document_id AND sort_order >= v_sort;
      END IF;
    END IF;
  END IF;

  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, owner_role, value, value_type,
    required, sort_order, input_kind, format_type, options, guidance, is_optional, included)
  VALUES (
    v_org, p_document_id, v_new_key, coalesce(p_label, 'New field'), p_section, 'DEAL', NULL,
    CASE WHEN p_format_type IN ('longtext','currency','date','select') THEN p_format_type ELSE 'text' END,
    false, v_sort, v_input_kind, p_format_type, p_options, p_guidance, false, true);

  RETURN jsonb_build_object('field_key', v_new_key, 'sort_order', v_sort, 'section', p_section);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.add_contract_element(uuid, text, text, text, integer, text, text, jsonb, text) TO authenticated;
