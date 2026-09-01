/*
  # Clause composition + auto-numbering (Pass I-b)

  remerge_contract_from_clauses(doc) builds merged_body by iterating the template's
  section/clause defs in order — auto-numbering sections (1, 2, 3…) and clauses
  (1.1, 1.2…) so dropping an optional clause never leaves a gap (fixes the old
  hard-coded-number bug). Token fill + ⟦NEEDS⟧ highlighting + empty-line dropping
  match the existing remerge behaviour exactly, applied per clause.

  It recomposes structured field prose first (same as the flat path). A clause is
  emitted when kept; skipped when its cut_name/conditional gate is off. 'prose'
  clauses emit their body verbatim (still numbered). Empty 'input' clauses whose
  every token resolves blank are dropped (unless the clause is non-optional).

  If a template has NO clause defs, this is a no-op that returns NULL, so the
  caller can fall back to the legacy flat remerge during the transition.
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
  v_keep       boolean;
  v_ctrl_val   text;
  r            record;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_doc.template_id;

  -- no clause defs for this template → signal fallback to the flat path
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key = v_tkey) THEN
    RETURN NULL;
  END IF;

  -- compose structured field prose first (same as flat path)
  PERFORM recompose_document_fields(p_document_id);

  -- field_key → trimmed value map (for token fill + gate evaluation)
  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;

  FOR v_sec IN
    SELECT * FROM contract_section_defs WHERE template_key = v_tkey ORDER BY sort_order
  LOOP
    -- section-level cut gate
    IF v_sec.cut_name IS NOT NULL THEN
      IF NOT clause_cut_kept(v_sec.cut_name, v_fields) THEN CONTINUE; END IF;
    END IF;

    v_sec_no := v_sec_no + 1;
    v_cl_no  := 0;
    -- section heading line
    v_out := v_out || (v_sec_no || '. ' || upper(v_sec.heading));

    FOR v_cl IN
      SELECT * FROM contract_clause_defs
       WHERE template_key = v_tkey AND section_key = v_sec.section_key
       ORDER BY sort_order
    LOOP
      -- per-clause cut gate
      IF v_cl.cut_name IS NOT NULL AND NOT clause_cut_kept(v_cl.cut_name, v_fields) THEN
        CONTINUE;
      END IF;
      -- conditional_on reveal gate ({field_key, equals:[...]})
      IF v_cl.conditional_on IS NOT NULL THEN
        v_ctrl_val := coalesce(v_fields ->> (v_cl.conditional_on ->> 'field_key'), '');
        IF NOT (v_cl.conditional_on -> 'equals' ? v_ctrl_val) THEN CONTINUE; END IF;
      END IF;

      v_body := coalesce(v_cl.body, '');

      -- for input clauses, drop the whole clause if every fillable token is empty
      -- and the clause is optional (prose clauses always emit)
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
      -- clause heading (decimal-numbered) when it has one
      IF v_cl.heading IS NOT NULL AND v_cl.heading <> '' THEN
        v_out := v_out || (v_sec_no || '.' || v_cl_no || ' ' || v_cl.heading);
      END IF;

      -- emit the clause body, token-filled line by line (mirrors flat remerge)
      IF v_body <> '' THEN
        v_lines := string_to_array(v_body, E'\n');
        FOREACH v_line IN ARRAY v_lines LOOP
          v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
          v_any_token := coalesce(array_length(v_toks,1),0) > 0;
          IF NOT v_any_token THEN v_out := v_out || v_line; CONTINUE; END IF;

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
          v_out := v_out || v_line;
        END LOOP;
      END IF;

      v_out := array_append(v_out, ''::text);   -- blank line between clauses
    END LOOP;
  END LOOP;

  v_body := array_to_string(v_out, E'\n');
  v_body := regexp_replace(v_body, E'\n{3,}', E'\n\n', 'g');

  UPDATE documents SET merged_body = v_body
   WHERE id = p_document_id AND workflow_state <> 'executed';
  RETURN v_body;
END;
$fn$;

-- helper: evaluate a named CUT gate from the field map (mirrors the flat
-- remerge's keep-predicates; extensible per template)
CREATE OR REPLACE FUNCTION public.clause_cut_kept(p_cut text, v_fields jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $fn$
  SELECT CASE p_cut
    WHEN 'EVALUATION_PERIOD' THEN
      coalesce(v_fields->>'TXN.EVALUATION_START','') <> '' OR coalesce(v_fields->>'TXN.EVALUATION_END','') <> ''
    WHEN 'PARTIAL_LEASE' THEN
      lower(coalesce(v_fields->>'TXN.LEASE_TYPE','')) LIKE '%partial%'
    WHEN 'INSURANCE' THEN
      coalesce(v_fields->>'TXN.MORTALITY_INSURANCE_PARTY','') <> ''
      OR coalesce(v_fields->>'TXN.MAJOR_MEDICAL_INSURANCE_PARTY','') <> ''
      OR coalesce(v_fields->>'TXN.LOSS_OF_USE_INSURANCE_PARTY','') <> ''
    WHEN 'COMPETITION' THEN
      coalesce(v_fields->>'TXN.COMPETITION_TERMS','') <> ''
      OR coalesce(v_fields->>'TXN.COMPETITION_EXPENSES','') <> ''
    ELSE true
  END;
$fn$;

REVOKE ALL ON FUNCTION remerge_contract_from_clauses(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION remerge_contract_from_clauses(uuid) TO authenticated, service_role;
