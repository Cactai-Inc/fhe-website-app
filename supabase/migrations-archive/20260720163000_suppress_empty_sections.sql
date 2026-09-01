/*
  # Suppress empty sections (Pass I gating, refinement)

  When every clause in a section is gated out (e.g. Competition unchecked → all
  competition clauses excluded), the section HEADING must not appear either.
  This buffers each section's clause output and emits the numbered heading only
  when at least one clause was actually produced — so an unselected topic leaves
  no trace (no "2. COMPETITIONS" with nothing under it), and section numbers stay
  gap-free.
*/

CREATE OR REPLACE FUNCTION public.remerge_contract_from_clauses(p_document_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_doc        documents%ROWTYPE;
  v_tkey       text;
  v_fields     jsonb := '{}'::jsonb;
  v_out        text[] := '{}';
  v_sec_buf    text[];          -- buffered lines for the current section's clauses
  v_sec        record;
  v_cl         record;
  v_sec_no     int := 0;
  v_cl_no      int;
  v_body       text;
  v_lines      text[];
  v_line       text;
  v_toks       text[];
  v_tok        text;
  v_any_token  boolean;
  v_all_empty  boolean;
  v_has_sig    boolean;
  r            record;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_doc.template_id;

  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key = v_tkey) THEN
    RETURN NULL;
  END IF;

  PERFORM recompose_document_fields(p_document_id);

  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;

  FOR v_sec IN
    SELECT * FROM contract_section_defs WHERE template_key = v_tkey ORDER BY sort_order
  LOOP
    IF v_sec.cut_name IS NOT NULL AND NOT clause_cut_kept(v_sec.cut_name, v_fields) THEN
      CONTINUE;
    END IF;

    v_sec_buf := '{}';       -- reset buffer for this section
    v_cl_no   := 0;

    FOR v_cl IN
      SELECT * FROM contract_clause_defs
       WHERE template_key = v_tkey AND section_key = v_sec.section_key
       ORDER BY sort_order
    LOOP
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

      -- this clause will be emitted → advance the (section-local) clause number.
      -- Section number is provisional until we know the section is non-empty.
      v_cl_no := v_cl_no + 1;
      IF v_cl.heading IS NOT NULL AND v_cl.heading <> '' THEN
        v_sec_buf := array_append(v_sec_buf, ('§CLAUSENUM§.' || v_cl_no || ' ' || v_cl.heading)::text);
      END IF;

      IF v_body <> '' THEN
        v_lines := string_to_array(v_body, E'\n');
        FOREACH v_line IN ARRAY v_lines LOOP
          v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
          v_any_token := coalesce(array_length(v_toks,1),0) > 0;
          IF NOT v_any_token THEN v_sec_buf := array_append(v_sec_buf, v_line); CONTINUE; END IF;

          v_all_empty := true; v_has_sig := false;
          FOREACH v_tok IN ARRAY v_toks LOOP
            IF v_tok LIKE 'SIG.%' THEN v_has_sig := true; v_all_empty := false;
            ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN v_all_empty := false;
            ELSIF coalesce(v_fields ->> v_tok,'') <> '' THEN v_all_empty := false;
            END IF;
          END LOOP;
          IF v_all_empty AND NOT v_has_sig THEN CONTINUE; END IF;

          FOREACH v_tok IN ARRAY v_toks LOOP
            IF v_tok LIKE 'SIG.%' THEN CONTINUE;
            ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN
              v_line := replace(v_line, '{{'||v_tok||'}}',
                to_char(coalesce(v_doc.effective_date, v_doc.created_at::date), 'FMMonth FMDD, YYYY'));
            ELSE
              v_line := replace(v_line, '{{'||v_tok||'}}', coalesce(v_fields ->> v_tok, ''));
            END IF;
          END LOOP;
          v_sec_buf := array_append(v_sec_buf, v_line);
        END LOOP;
      END IF;

      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;

    -- emit the section only if it produced at least one clause
    IF coalesce(array_length(v_sec_buf,1),0) > 0 THEN
      v_sec_no := v_sec_no + 1;
      v_out := array_append(v_out, (v_sec_no || '. ' || upper(v_sec.heading))::text);
      -- substitute the provisional section-number marker now that it's known
      v_out := v_out || ARRAY(SELECT replace(x, '§CLAUSENUM§', v_sec_no::text) FROM unnest(v_sec_buf) x);
    END IF;
  END LOOP;

  v_body := array_to_string(v_out, E'\n');
  v_body := regexp_replace(v_body, E'\n{3,}', E'\n\n', 'g');
  UPDATE documents SET merged_body = v_body
   WHERE id = p_document_id AND workflow_state <> 'executed';
  RETURN v_body;
END;
$fn$;
