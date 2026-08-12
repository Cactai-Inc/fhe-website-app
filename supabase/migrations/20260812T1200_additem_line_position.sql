-- TASK ADDITEM (2026-08-12) — POSITION WITHIN AN ITEM, and the collision that
-- made "append" meaningless.
--
-- add_contract_composition numbered its content lines 10, 20, 30 … from scratch
-- on EVERY call. A second addition to the SAME header therefore wrote the same
-- sort_orders as the first, and remerge_contract_from_clauses — which orders
-- authored lines by (header order, line sort_order) — had nothing to break the
-- tie. Proven against production on 2026-08-12: two compositions of two lines
-- each into one header composed as
--     Second C / First A / Second D / First B
-- i.e. interleaved, in neither authoring order. Appending was already broken;
-- there was no way to ask for any other position at all.
--
-- THE FIX, in the ordering column that already exists. `header.line_position`
-- (1-based among the lines already authored under that header; NULL or out of
-- range = after all of them) splices the new lines into the existing run, and
-- the whole run for that header is renumbered 10, 20, 30 … as one ordered list.
-- Existing lines keep their relative order. No second ordering concept:
-- contract_fields.sort_order is the same column remerge_contract_from_clauses
-- and ClauseDocument already read.
--
-- Everything else in the function is unchanged from the deployed definition,
-- including the coalesce()'d staff/party guard from NOGUARD tier 2.

CREATE OR REPLACE FUNCTION public.add_contract_composition(p_document_id uuid, p_spec jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_tkey text;
  v_section text; v_section_new boolean; v_section_key text;
  v_header_key text; v_header_new text; v_pos int;
  v_prev numeric; v_next numeric; v_ord numeric;
  v_keys jsonb := '{}'::jsonb;          -- local id -> minted CUSTOM key
  v_el jsonb; v_ln jsonb;
  v_key text; v_body text; v_cond jsonb; v_cond_txt text;
  v_line_no int := 0; v_created text[] := '{}';
  v_input text; v_req boolean;
  v_line_pos int; v_existing text[]; v_before int; v_i int;
  r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT d.org_id, d.workflow_state, ct.template_key INTO v_org, v_state, v_tkey
    FROM documents d LEFT JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  IF NOT ((coalesce(has_staff_access() AND v_org = current_org(), false))
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to modify this document';
  END IF;

  v_section     := btrim(coalesce(p_spec->>'section',''));
  v_section_new := coalesce((p_spec->>'section_new')::boolean, false);
  IF v_section = '' THEN RAISE EXCEPTION 'a section is required'; END IF;

  -- ── the section ──────────────────────────────────────────────────────────
  IF v_section_new THEN
    v_section_key := v_section;
    IF EXISTS (SELECT 1 FROM contract_section_defs WHERE template_key = v_tkey AND section_key = v_section_key)
       OR EXISTS (SELECT 1 FROM contract_fields WHERE document_id = p_document_id
                    AND custom_kind = 'section' AND section = v_section_key) THEN
      RAISE EXCEPTION 'a section named % already exists on this document', v_section_key;
    END IF;
    -- position among the document's CURRENT sections (template + custom), in the
    -- x1000 insertion space so a midpoint always exists.
    v_pos := coalesce((p_spec->>'section_position')::int, 2147483647);
    SELECT max(ord) INTO v_prev FROM (
      SELECT ord, row_number() OVER (ORDER BY ord) AS rn FROM (
        SELECT (sort_order::numeric * 1000) AS ord FROM contract_section_defs WHERE template_key = v_tkey
        UNION ALL
        SELECT sort_order::numeric FROM contract_fields
         WHERE document_id = p_document_id AND custom_kind = 'section') s
    ) q WHERE q.rn < v_pos;
    SELECT min(ord) INTO v_next FROM (
      SELECT ord, row_number() OVER (ORDER BY ord) AS rn FROM (
        SELECT (sort_order::numeric * 1000) AS ord FROM contract_section_defs WHERE template_key = v_tkey
        UNION ALL
        SELECT sort_order::numeric FROM contract_fields
         WHERE document_id = p_document_id AND custom_kind = 'section') s
    ) q WHERE q.rn >= v_pos;
    v_ord := CASE
      WHEN v_prev IS NULL AND v_next IS NULL THEN 10000
      WHEN v_prev IS NULL THEN v_next - 500
      WHEN v_next IS NULL THEN v_prev + 1000
      ELSE (v_prev + v_next) / 2 END;
    INSERT INTO contract_fields (org_id, document_id, field_key, label, section,
                                 owner_role, sort_order, custom_kind, included)
    VALUES (v_org, p_document_id, next_custom_field_key(p_document_id, v_section_key),
            v_section_key, v_section_key, 'DEAL', round(v_ord)::int, 'section', true);
    v_created := v_created || v_section_key;
  ELSE
    v_section_key := v_section;
    IF NOT EXISTS (SELECT 1 FROM contract_section_defs WHERE template_key = v_tkey AND section_key = v_section_key)
       AND NOT EXISTS (SELECT 1 FROM contract_fields WHERE document_id = p_document_id
                         AND custom_kind = 'section' AND section = v_section_key) THEN
      RAISE EXCEPTION 'unknown section: %', v_section_key;
    END IF;
  END IF;

  -- ── the header ───────────────────────────────────────────────────────────
  v_header_key := nullif(btrim(coalesce(p_spec#>>'{header,clause_key}','')), '');
  v_header_new := nullif(btrim(coalesce(p_spec#>>'{header,text}','')), '');
  IF v_header_key IS NULL AND v_header_new IS NULL THEN
    RAISE EXCEPTION 'a header is required — pick an existing one or name a new one';
  END IF;
  IF v_header_key IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM contract_clause_defs
                    WHERE template_key = v_tkey AND clause_key = v_header_key AND section_key = v_section_key)
       AND NOT EXISTS (SELECT 1 FROM contract_fields
                    WHERE document_id = p_document_id AND field_key = v_header_key
                      AND custom_kind = 'header' AND section = v_section_key) THEN
      RAISE EXCEPTION 'unknown header % in section %', v_header_key, v_section_key;
    END IF;
  ELSE
    -- new header: position among this section's HEADERS (template + custom), in
    -- the same x1000 insertion space. NULL / out of range = end of section.
    v_pos := (p_spec#>>'{header,position}')::int;
    SELECT max(ord) INTO v_prev FROM (
      SELECT ord, row_number() OVER (ORDER BY ord) AS rn FROM (
        SELECT (sort_order::numeric * 1000) AS ord FROM contract_clause_defs
         WHERE template_key = v_tkey AND section_key = v_section_key
           AND heading IS NOT NULL AND heading <> ''
        UNION ALL
        SELECT sort_order::numeric FROM contract_fields
         WHERE document_id = p_document_id AND custom_kind = 'header' AND section = v_section_key) s
    ) q WHERE v_pos IS NULL OR q.rn < v_pos;
    SELECT min(ord) INTO v_next FROM (
      SELECT ord, row_number() OVER (ORDER BY ord) AS rn FROM (
        SELECT (sort_order::numeric * 1000) AS ord FROM contract_clause_defs
         WHERE template_key = v_tkey AND section_key = v_section_key
           AND heading IS NOT NULL AND heading <> ''
        UNION ALL
        SELECT sort_order::numeric FROM contract_fields
         WHERE document_id = p_document_id AND custom_kind = 'header' AND section = v_section_key) s
    ) q WHERE v_pos IS NOT NULL AND q.rn >= v_pos;
    v_ord := CASE
      WHEN v_prev IS NULL AND v_next IS NULL THEN 10000
      WHEN v_prev IS NULL THEN v_next - 500
      WHEN v_next IS NULL THEN v_prev + 1000
      ELSE (v_prev + v_next) / 2 END;
    v_header_key := next_custom_field_key(p_document_id, v_header_new);
    INSERT INTO contract_fields (org_id, document_id, field_key, label, section,
                                 owner_role, sort_order, custom_kind, included)
    VALUES (v_org, p_document_id, v_header_key, v_header_new, v_section_key,
            'DEAL', round(v_ord)::int, 'header', true);
    v_created := v_created || v_header_key;
  END IF;

  -- ── the inline elements (minted first, so lines can reference their keys) ─
  FOR v_el IN SELECT * FROM jsonb_array_elements(coalesce(p_spec->'elements','[]'::jsonb)) LOOP
    v_input := lower(coalesce(v_el->>'kind','text'));
    IF v_input NOT IN ('select','buttons','text') THEN
      RAISE EXCEPTION 'unsupported element kind: %', v_input;
    END IF;
    v_req := coalesce((v_el->>'required')::boolean, false);
    IF v_req AND v_input <> 'text' THEN v_req := false; END IF;   -- Required is a text-field affordance only
    v_key := next_custom_field_key(p_document_id, coalesce(v_el->>'label', v_input));
    INSERT INTO contract_fields (
      org_id, document_id, field_key, label, section, clause_key, owner_role,
      value_type, required, sort_order, input_kind, format_type, options,
      guidance, custom_kind, included)
    VALUES (
      v_org, p_document_id, v_key, coalesce(nullif(btrim(v_el->>'label'),''), 'Entry'),
      v_section_key, v_header_key, 'DEAL',
      CASE WHEN v_input = 'select' THEN 'select' ELSE 'text' END,
      v_req, 0, v_input, CASE WHEN v_input = 'text' THEN 'text' ELSE v_input END,
      CASE WHEN v_input = 'text' THEN NULL ELSE coalesce(v_el->'options','[]'::jsonb) END,
      nullif(btrim(coalesce(v_el->>'placeholder','')), ''), 'element', true);
    v_keys := v_keys || jsonb_build_object(coalesce(v_el->>'id', v_key), v_key);
    v_created := v_created || v_key;
  END LOOP;

  /* ── the content lines ──────────────────────────────────────────────────
     ADDITEM: the header's authored lines are ONE ordered run. Take the lines
     already there, decide how many of them sit ABOVE the insertion point, and
     renumber the whole run 10, 20, 30 … with the new lines spliced in. This is
     what gives "position within the item" a control, and what stops two
     additions to the same header writing the same sort_orders. */
  v_line_pos := (p_spec#>>'{header,line_position}')::int;
  SELECT coalesce(array_agg(field_key ORDER BY sort_order, field_key), '{}'::text[])
    INTO v_existing
    FROM contract_fields
   WHERE document_id = p_document_id AND custom_kind = 'line' AND clause_key = v_header_key;

  v_before := CASE
    WHEN v_line_pos IS NULL OR v_line_pos > coalesce(array_length(v_existing,1),0)
      THEN coalesce(array_length(v_existing,1),0)          -- after everything
    ELSE greatest(v_line_pos - 1, 0) END;

  FOR v_i IN 1..v_before LOOP
    v_line_no := v_line_no + 10;
    UPDATE contract_fields SET sort_order = v_line_no
     WHERE document_id = p_document_id AND field_key = v_existing[v_i];
  END LOOP;

  FOR v_ln IN SELECT * FROM jsonb_array_elements(coalesce(p_spec->'lines','[]'::jsonb)) LOOP
    v_line_no := v_line_no + 10;
    v_body := coalesce(v_ln->>'body','');
    v_cond := v_ln->'conditional_on';
    IF v_cond = 'null'::jsonb THEN v_cond := NULL; END IF;
    -- resolve @localId references in both the prose tokens and the gate
    v_cond_txt := v_cond::text;
    FOR r IN SELECT key AS lid, value AS realkey FROM jsonb_each_text(v_keys) LOOP
      v_body := replace(v_body, '{{CUSTOM.@' || r.lid || '}}', '{{' || r.realkey || '}}');
      IF v_cond_txt IS NOT NULL THEN
        v_cond_txt := replace(v_cond_txt, '"@' || r.lid || '"', '"' || r.realkey || '"');
      END IF;
    END LOOP;
    IF v_body ~ '\{\{CUSTOM\.@' THEN
      RAISE EXCEPTION 'line references an element id that was not supplied: %', v_body;
    END IF;
    v_cond := CASE WHEN v_cond_txt IS NULL THEN NULL ELSE v_cond_txt::jsonb END;
    v_key := next_custom_field_key(p_document_id, 'LINE');
    INSERT INTO contract_fields (
      org_id, document_id, field_key, label, section, clause_key, owner_role,
      sort_order, custom_kind, body, conditional_on, guidance, included)
    VALUES (
      v_org, p_document_id, v_key, NULL, v_section_key, v_header_key, 'DEAL',
      v_line_no, 'line', v_body, v_cond,
      nullif(btrim(coalesce(v_ln->>'caption','')), ''), true);
    v_created := v_created || v_key;
  END LOOP;

  FOR v_i IN v_before + 1 .. coalesce(array_length(v_existing,1),0) LOOP
    v_line_no := v_line_no + 10;
    UPDATE contract_fields SET sort_order = v_line_no
     WHERE document_id = p_document_id AND field_key = v_existing[v_i];
  END LOOP;

  PERFORM remerge_contract_from_clauses(p_document_id);
  RETURN jsonb_build_object('section', v_section_key, 'header_key', v_header_key,
                            'element_keys', v_keys, 'created', to_jsonb(v_created));
END;
$function$;
REVOKE ALL ON FUNCTION public.add_contract_composition(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_contract_composition(uuid, jsonb) TO authenticated, service_role;
