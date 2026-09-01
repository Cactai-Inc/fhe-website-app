-- Make author-added content (via add_contract_element) actually appear in the
-- composed clause-model contract. Custom fields are stored in contract_fields as
-- CUSTOM.* rows carrying a `section` (a def section_key for a field added to an
-- existing section, or a free-text heading for a brand-new section) + a label +
-- value. The composer now:
--   • appends each section's custom fields as "Label: value" clauses at the end of
--     that section (numbered X.N like any clause), and
--   • emits custom sections (whose `section` matches no def section_key) as their
--     own numbered sections after the template ones (before Signatures ordering is
--     preserved by def sort_order; customs come last).
-- Empty custom fields are omitted (consistent with the omit-empty rule).

CREATE OR REPLACE FUNCTION public.remerge_contract_from_clauses(p_document_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_doc documents%ROWTYPE; v_tkey text;
  v_fields jsonb := '{}'::jsonb; v_labels jsonb := '{}'::jsonb;
  v_out text[] := '{}'; v_sec_buf text[]; v_cl_buf text[];
  v_sec record; v_cl record; v_sec_no int := 0; v_cl_no int;
  v_body text; v_lines text[]; v_line text; v_stripped text;
  v_toks text[]; v_tok text; v_any_token boolean; v_all_empty boolean; v_has_sig boolean;
  r record; v_cf record; v_val text;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_doc.template_id;
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key = v_tkey) THEN RETURN NULL; END IF;

  PERFORM recompose_document_fields(p_document_id);
  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val FROM contract_fields WHERE document_id = p_document_id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;
  SELECT coalesce(jsonb_object_agg(field_key, vmap), '{}'::jsonb) INTO v_labels
  FROM (SELECT field_key, jsonb_object_agg(opt->>'value', opt->>'label') AS vmap
          FROM contract_field_defs fd CROSS JOIN LATERAL jsonb_array_elements(fd.options) AS opt
         WHERE fd.template_key = v_tkey AND fd.options IS NOT NULL GROUP BY field_key) m;

  FOR v_sec IN SELECT * FROM contract_section_defs WHERE template_key = v_tkey ORDER BY sort_order LOOP
    IF v_sec.cut_name IS NOT NULL AND NOT clause_cut_kept(v_sec.cut_name, v_fields) THEN CONTINUE; END IF;
    v_sec_buf := '{}'; v_cl_no := 0;

    FOR v_cl IN SELECT * FROM contract_clause_defs WHERE template_key = v_tkey AND section_key = v_sec.section_key ORDER BY sort_order LOOP
      IF v_cl.cut_name IS NOT NULL AND NOT clause_cut_kept(v_cl.cut_name, v_fields) THEN CONTINUE; END IF;
      IF NOT clause_condition_met(v_cl.conditional_on, v_fields) THEN CONTINUE; END IF;
      v_body := coalesce(v_cl.body, '');

      IF v_cl.clause_type = 'input' AND v_cl.is_optional THEN
        v_toks := ARRAY(SELECT (regexp_matches(v_body, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
        v_all_empty := true;
        FOREACH v_tok IN ARRAY coalesce(v_toks, ARRAY[]::text[]) LOOP
          IF v_tok NOT LIKE 'SIG.%' AND coalesce(v_fields ->> v_tok,'') <> '' THEN v_all_empty := false; END IF;
        END LOOP;
        IF coalesce(array_length(v_toks,1),0) > 0 AND v_all_empty THEN CONTINUE; END IF;
      END IF;

      v_cl_buf := '{}';
      IF v_body <> '' THEN
        v_lines := string_to_array(v_body, E'\n');
        FOREACH v_line IN ARRAY v_lines LOOP
          v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
          v_any_token := coalesce(array_length(v_toks,1),0) > 0;
          IF NOT v_any_token THEN v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE; END IF;
          v_all_empty := true; v_has_sig := false;
          FOREACH v_tok IN ARRAY v_toks LOOP
            IF v_tok LIKE 'SIG.%' THEN v_has_sig := true; v_all_empty := false;
            ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN v_all_empty := false;
            ELSIF coalesce(v_fields ->> v_tok,'') <> '' THEN v_all_empty := false; END IF;
          END LOOP;
          IF v_all_empty AND NOT v_has_sig THEN
            v_stripped := regexp_replace(v_line, '\{\{[A-Z0-9_.]+\}\}', '', 'g');
            v_stripped := btrim(regexp_replace(v_stripped, '[[:punct:][:space:]]', '', 'g'));
            IF v_stripped = '' THEN CONTINUE; END IF;
          END IF;
          FOREACH v_tok IN ARRAY v_toks LOOP
            IF v_tok LIKE 'SIG.%' THEN CONTINUE;
            ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', to_char(coalesce(v_doc.effective_date, v_doc.created_at::date), 'FMMonth FMDD, YYYY'));
            ELSE v_line := replace(v_line, '{{'||v_tok||'}}', token_display_value(v_tok, v_fields ->> v_tok, v_labels)); END IF;
          END LOOP;
          v_cl_buf := array_append(v_cl_buf, v_line);
        END LOOP;
      END IF;

      IF (v_cl.heading IS NULL OR v_cl.heading = '') AND coalesce(array_length(v_cl_buf,1),0) = 0 THEN CONTINUE; END IF;

      v_cl_no := v_cl_no + 1;
      IF v_cl.heading IS NOT NULL AND v_cl.heading <> '' THEN
        v_sec_buf := array_append(v_sec_buf, ('§CLAUSENUM§.' || v_cl_no || ' ' || v_cl.heading)::text);
        IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN v_sec_buf := v_sec_buf || v_cl_buf; END IF;
      ELSE
        IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN
          v_cl_buf[1] := '§CLAUSENUM§.' || v_cl_no || ' ' || v_cl_buf[1];
          v_sec_buf := v_sec_buf || v_cl_buf;
        END IF;
      END IF;
      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;

    -- custom fields added by the author to THIS existing section
    FOR v_cf IN SELECT field_key, label, value FROM contract_fields
                 WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
                   AND section = v_sec.section_key ORDER BY sort_order LOOP
      v_val := btrim(coalesce(v_cf.value, ''));
      IF v_val = '' THEN CONTINUE; END IF;                          -- omit empty
      v_cl_no := v_cl_no + 1;
      v_sec_buf := array_append(v_sec_buf,
        ('§CLAUSENUM§.' || v_cl_no || ' ' || coalesce(v_cf.label,'Item') || ': ' || v_val)::text);
      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;

    IF coalesce(array_length(v_sec_buf,1),0) > 0 THEN
      v_sec_no := v_sec_no + 1;
      v_out := array_append(v_out, (v_sec_no || '. ' || upper(v_sec.heading))::text);
      v_out := v_out || ARRAY(SELECT replace(x, '§CLAUSENUM§', v_sec_no::text) FROM unnest(v_sec_buf) x);
    END IF;
  END LOOP;

  -- custom SECTIONS (a CUSTOM.* field whose `section` matches no def section_key):
  -- group by section, emit each as its own numbered section with its fields.
  FOR v_sec IN
    SELECT DISTINCT section FROM contract_fields
     WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
       AND section NOT IN (SELECT section_key FROM contract_section_defs WHERE template_key = v_tkey)
     ORDER BY section
  LOOP
    v_sec_buf := '{}'; v_cl_no := 0;
    FOR v_cf IN SELECT field_key, label, value FROM contract_fields
                 WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
                   AND section = v_sec.section ORDER BY sort_order LOOP
      v_val := btrim(coalesce(v_cf.value, ''));
      IF v_val = '' THEN CONTINUE; END IF;
      v_cl_no := v_cl_no + 1;
      v_sec_buf := array_append(v_sec_buf,
        ('§CLAUSENUM§.' || v_cl_no || ' ' || coalesce(v_cf.label,'Item') || ': ' || v_val)::text);
      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;
    IF coalesce(array_length(v_sec_buf,1),0) > 0 THEN
      v_sec_no := v_sec_no + 1;
      v_out := array_append(v_out, (v_sec_no || '. ' || upper(v_sec.section))::text);
      v_out := v_out || ARRAY(SELECT replace(x, '§CLAUSENUM§', v_sec_no::text) FROM unnest(v_sec_buf) x);
    END IF;
  END LOOP;

  v_body := array_to_string(v_out, E'\n');
  v_body := regexp_replace(v_body, E'\n{3,}', E'\n\n', 'g');
  UPDATE documents SET merged_body = v_body WHERE id = p_document_id AND workflow_state <> 'executed';
  RETURN v_body;
END;
$function$;
