/*
  # Clause gating — multi-select membership (Pass I gating)

  Extends clause conditions so a checkbox selection can gate whole clauses (and
  their fields), per the authoring requirement: e.g. clause "18 Competitions"
  appears only when PERMITTED_USES contains COMPETITION; unchecking removes it
  from the document in real time (data kept, just excluded).

  conditional_on now supports two operators against a controlling field:
    { "field_key": "TXN.PERMITTED_ACTIVITIES", "equals":   ["COMPETITION"] }
        → controlling value equals one of the listed values
    { "field_key": "TXN.PERMITTED_ACTIVITIES", "contains": ["COMPETITION"] }
        → controlling value is a multi-select (comma/JSON list) that includes
          ANY of the listed values

  One shared evaluator (clause_condition_met) is used by the composer here and
  mirrored in the frontend so real-time show/hide and the merged document agree.
*/

CREATE OR REPLACE FUNCTION public.clause_condition_met(p_cond jsonb, v_fields jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $fn$
DECLARE
  v_key   text;
  v_raw   text;
  v_have  text[];
  v_want  jsonb;
  v_v     jsonb;
BEGIN
  IF p_cond IS NULL THEN RETURN true; END IF;      -- ungated
  v_key := p_cond ->> 'field_key';
  IF v_key IS NULL THEN RETURN true; END IF;
  v_raw := coalesce(v_fields ->> v_key, '');

  -- equals: exact match against any listed value
  IF p_cond ? 'equals' THEN
    IF p_cond -> 'equals' ? v_raw THEN RETURN true; END IF;
  END IF;

  -- contains: the controlling field is a multi-select. Accept either a JSON
  -- array value or a comma-joined string; membership of ANY listed value passes.
  IF p_cond ? 'contains' THEN
    IF jsonb_typeof(to_jsonb(v_raw)) = 'array' THEN
      v_have := ARRAY(SELECT jsonb_array_elements_text(v_raw::jsonb));
    ELSE
      v_have := ARRAY(SELECT btrim(x) FROM regexp_split_to_table(v_raw, ',') x WHERE btrim(x) <> '');
    END IF;
    FOR v_v IN SELECT * FROM jsonb_array_elements(p_cond -> 'contains') LOOP
      IF (v_v #>> '{}') = ANY (v_have) THEN RETURN true; END IF;
    END LOOP;
  END IF;

  RETURN false;
END;
$fn$;
REVOKE ALL ON FUNCTION clause_condition_met(jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION clause_condition_met(jsonb, jsonb) TO authenticated, service_role;


-- Update the composer to use the shared evaluator for the conditional gate.
-- (Full CREATE OR REPLACE; identical to 20260720161000 except the gate line.)
CREATE OR REPLACE FUNCTION public.remerge_contract_from_clauses(p_document_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_doc        documents%ROWTYPE;
  v_tkey       text;
  v_fields     jsonb := '{}'::jsonb;
  v_out        text[] := '{}';
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
    v_sec_no := v_sec_no + 1;
    v_cl_no  := 0;
    v_out := array_append(v_out, (v_sec_no || '. ' || upper(v_sec.heading))::text);

    FOR v_cl IN
      SELECT * FROM contract_clause_defs
       WHERE template_key = v_tkey AND section_key = v_sec.section_key
       ORDER BY sort_order
    LOOP
      IF v_cl.cut_name IS NOT NULL AND NOT clause_cut_kept(v_cl.cut_name, v_fields) THEN
        CONTINUE;
      END IF;
      -- shared gate (equals / contains)
      IF NOT clause_condition_met(v_cl.conditional_on, v_fields) THEN
        CONTINUE;
      END IF;

      v_body := coalesce(v_cl.body, '');

      IF v_cl.clause_type = 'input' AND v_cl.is_optional THEN
        v_toks := ARRAY(SELECT (regexp_matches(v_body, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
        v_all_empty := true;
        FOREACH v_tok IN ARRAY coalesce(v_toks, ARRAY[]::text[]) LOOP
          IF v_tok NOT LIKE 'SIG.%' AND coalesce(v_fields ->> v_tok,'') <> '' THEN
            v_all_empty := false;
          END IF;
        END LOOP;
        IF coalesce(array_length(v_toks,1),0) > 0 AND v_all_empty THEN CONTINUE; END IF;
      END IF;

      v_cl_no := v_cl_no + 1;
      IF v_cl.heading IS NOT NULL AND v_cl.heading <> '' THEN
        v_out := array_append(v_out, (v_sec_no || '.' || v_cl_no || ' ' || v_cl.heading)::text);
      END IF;

      IF v_body <> '' THEN
        v_lines := string_to_array(v_body, E'\n');
        FOREACH v_line IN ARRAY v_lines LOOP
          v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
          v_any_token := coalesce(array_length(v_toks,1),0) > 0;
          IF NOT v_any_token THEN v_out := array_append(v_out, v_line); CONTINUE; END IF;

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
          v_out := array_append(v_out, v_line);
        END LOOP;
      END IF;

      v_out := array_append(v_out, ''::text);
    END LOOP;
  END LOOP;

  v_body := array_to_string(v_out, E'\n');
  v_body := regexp_replace(v_body, E'\n{3,}', E'\n\n', 'g');
  UPDATE documents SET merged_body = v_body
   WHERE id = p_document_id AND workflow_state <> 'executed';
  RETURN v_body;
END;
$fn$;
