-- Composer: (1) med_schedule structured prose, (2) party labels for the new care
-- parties, (3) "always X.N" clause numbering — every emitted clause is prefixed
-- with its number, on its heading when present, otherwise on its first body line.

-- (2) party labels used by the care arranging/cost dropdowns.
CREATE OR REPLACE FUNCTION public.party_label(p text)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE upper(coalesce(p,''))
    WHEN 'OWNER'  THEN 'the Owner'   WHEN 'LESSOR' THEN 'the Lessor'
    WHEN 'LESSEE' THEN 'the Lessee'  WHEN 'BUYER'  THEN 'the Buyer'
    WHEN 'SELLER' THEN 'the Seller'  WHEN 'CLIENT' THEN 'the Client'
    WHEN 'FHE'    THEN 'French Heritage Equestrian'
    WHEN 'TRAINER' THEN 'the Trainer/Instructor'
    WHEN 'BOARDING' THEN 'the Boarding Staff'
    WHEN 'VETERINARIAN' THEN 'the Veterinarian'
    WHEN 'CARE_PROVIDER' THEN 'the Care Provider'
    WHEN 'SHARED' THEN 'the parties jointly'
    ELSE '' END;
$function$;

-- (1) med_schedule: { items:[{name,dose,schedule,party,party_note}] } →
-- "<name> — <dose>, <schedule> (responsible: <party>)" one per line.
CREATE OR REPLACE FUNCTION public.compose_med_schedule(p_structured jsonb)
 RETURNS text LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE it jsonb; lines text[] := ARRAY[]::text[]; part text; who text;
BEGIN
  IF p_structured IS NULL OR coalesce(jsonb_array_length(p_structured->'medItems'),0) = 0 THEN
    RETURN needs('medications and supplements');
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_structured->'medItems') LOOP
    part := btrim(coalesce(it->>'name',''));
    IF coalesce(nullif(btrim(it->>'dose'),''),'') <> '' THEN part := part || ' — ' || btrim(it->>'dose'); END IF;
    IF coalesce(nullif(btrim(it->>'schedule'),''),'') <> '' THEN part := part || ', ' || btrim(it->>'schedule'); END IF;
    who := CASE WHEN upper(coalesce(it->>'party','')) = 'OTHER'
                THEN coalesce(nullif(btrim(it->>'party_note'),''),'Other')
                ELSE party_label(it->>'party') END;
    IF coalesce(who,'') <> '' THEN part := part || ' (responsible: ' || who || ')'; END IF;
    IF btrim(part) <> '' THEN lines := lines || part; END IF;
  END LOOP;
  RETURN array_to_string(lines, E'\n');
END;
$function$;

-- hook med_schedule into compose_field_prose (dispatch before the ELSE).
CREATE OR REPLACE FUNCTION public.compose_field_prose(p_format text, p_structured jsonb, p_label text, p_value text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  s jsonb := coalesce(p_structured, '{}'::jsonb);
  v_out text; v_party text; v_prov jsonb; v_manage jsonb; v_split jsonb;
  v_parts text[]; v_e jsonb; v_sel int; v_opt jsonb; v_amt text;
BEGIN
  IF p_structured IS NULL OR p_structured = '{}'::jsonb THEN RETURN coalesce(p_value, ''); END IF;
  CASE p_format
    WHEN 'med_schedule' THEN v_out := compose_med_schedule(s);
    WHEN 'yesno' THEN
      v_out := CASE upper(coalesce(s->>'value', p_value, '')) WHEN 'YES' THEN 'Yes' WHEN 'NO' THEN 'No' ELSE coalesce(p_value,'') END;
    WHEN 'contact' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'name','')    <> '' THEN v_parts := v_parts || (s->>'name'); END IF;
      IF coalesce(s->>'company','') <> '' THEN v_parts := v_parts || (s->>'company'); END IF;
      IF coalesce(s->>'line1','')   <> '' THEN v_parts := v_parts || (s->>'line1'); END IF;
      IF coalesce(s->>'city','') <> '' OR coalesce(s->>'state','') <> '' OR coalesce(s->>'postal','') <> '' THEN
        v_parts := v_parts || btrim(concat_ws(' ', concat_ws(', ', nullif(s->>'city',''), nullif(s->>'state','')), nullif(s->>'postal','')));
      END IF;
      IF coalesce(s->>'phone','')   <> '' THEN v_parts := v_parts || (s->>'phone'); END IF;
      IF coalesce(s->>'email','')   <> '' THEN v_parts := v_parts || (s->>'email'); END IF;
      IF coalesce(s->>'website','') <> '' THEN v_parts := v_parts || (s->>'website'); END IF;
      v_out := array_to_string(v_parts, ', ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'contact')); END IF;
    WHEN 'person' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'name','')    <> '' THEN v_parts := v_parts || (s->>'name'); END IF;
      IF coalesce(s->>'company','') <> '' THEN v_parts := v_parts || (s->>'company'); END IF;
      IF coalesce(s->>'phone','')   <> '' THEN v_parts := v_parts || (s->>'phone'); END IF;
      IF coalesce(s->>'email','')   <> '' THEN v_parts := v_parts || (s->>'email'); END IF;
      v_out := array_to_string(v_parts, ', ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'contact')); END IF;
    WHEN 'address' THEN
      v_out := compose_address(s->>'line1', s->>'line2', s->>'city', s->>'state', s->>'postal');
      IF coalesce(v_out,'') = '' THEN v_out := needs(coalesce(p_label,'address')); END IF;
    WHEN 'location' THEN
      v_out := nullif(btrim(concat_ws(' — ', nullif(s->>'name',''),
                 compose_address(s->>'line1', s->>'line2', s->>'city', s->>'state', s->>'postal'))), '');
      IF coalesce(v_out,'') = '' THEN v_out := needs(coalesce(p_label,'location')); END IF;
    WHEN 'percent_split' THEN
      v_split := s->'parties'; v_parts := ARRAY[]::text[];
      IF v_split IS NOT NULL THEN
        FOR v_e IN SELECT * FROM jsonb_array_elements(v_split) LOOP
          v_parts := v_parts || (party_label(v_e->>'party') || ' ' || coalesce(v_e->>'pct','?') || '%');
        END LOOP;
      END IF;
      v_out := array_to_string(v_parts, ', ');
      IF coalesce(nullif(s->>'note',''),'') <> '' THEN v_out := btrim(v_out || ' (' || (s->>'note') || ')'); END IF;
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'split')); END IF;
    WHEN 'fee_schedule' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(nullif(btrim(s->>'initial_due'),''),'') <> '' THEN
        v_parts := v_parts || ('Initial payment due: ' || (s->>'initial_due') || '.');
      END IF;
      v_sel := nullif(s->>'selected','')::int;
      IF v_sel IS NOT NULL AND s->'options' IS NOT NULL AND jsonb_array_length(s->'options') > v_sel THEN
        v_opt := (s->'options') -> v_sel; v_amt := btrim(coalesce(v_opt->>'amount',''));
        IF v_amt <> '' THEN
          IF left(v_amt,1) <> '$' THEN v_amt := '$' || v_amt; END IF;
          v_out := v_amt || ' due on the first day of each month.';
          IF coalesce(nullif(btrim(v_opt->>'notes'),''),'') <> '' THEN v_out := v_out || ' ' || btrim(v_opt->>'notes'); END IF;
          v_parts := v_parts || v_out;
        END IF;
      END IF;
      v_out := array_to_string(v_parts, ' ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'lease fee')); END IF;
    WHEN 'party' THEN
      v_party := s->>'party';
      IF coalesce(v_party,'') = '' THEN v_out := needs(coalesce(p_label,'responsible party'));
      ELSIF v_party = 'CARE_PROVIDER' THEN
        v_prov := s->'provider'; v_out := party_label('CARE_PROVIDER');
        IF coalesce(v_prov->>'name','') <> '' THEN v_out := v_out || ' (' || compose_field_prose('person', v_prov, p_label, NULL) || ')';
        ELSE v_out := v_out || ' (' || needs('care provider contact') || ')'; END IF;
      ELSIF v_party = 'OTHER' THEN v_out := coalesce(nullif(s->>'note',''), needs(coalesce(p_label,'arrangement')));
      ELSIF v_party = 'SHARED' THEN v_out := compose_field_prose('percent_split', s, p_label, NULL);
      ELSE v_out := party_label(v_party); END IF;
    WHEN 'pair' THEN
      v_manage := s->'manage'; IF v_manage IS NULL THEN v_manage := s; END IF;
      v_out := compose_field_prose('party', v_manage, p_label, NULL);
    ELSE
      v_out := coalesce(nullif(s->>'value',''), nullif(s->>'text',''), p_value, '');
  END CASE;
  RETURN coalesce(v_out, '');
END;
$function$;

-- (3) numbering: every emitted clause gets an "X.N" prefix. Rewrite the emission
-- so a headingless clause's first body line is prefixed with its clause number.
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
  r record;
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

      -- authoring-only (no heading, no body) → no number consumed
      IF (v_cl.heading IS NULL OR v_cl.heading = '') AND coalesce(array_length(v_cl_buf,1),0) = 0 THEN CONTINUE; END IF;

      v_cl_no := v_cl_no + 1;
      IF v_cl.heading IS NOT NULL AND v_cl.heading <> '' THEN
        -- numbered heading; body follows unprefixed
        v_sec_buf := array_append(v_sec_buf, ('§CLAUSENUM§.' || v_cl_no || ' ' || v_cl.heading)::text);
        IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN v_sec_buf := v_sec_buf || v_cl_buf; END IF;
      ELSE
        -- no heading → prefix the FIRST body line with the clause number (always X.N)
        IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN
          v_cl_buf[1] := '§CLAUSENUM§.' || v_cl_no || ' ' || v_cl_buf[1];
          v_sec_buf := v_sec_buf || v_cl_buf;
        END IF;
      END IF;
      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;

    IF coalesce(array_length(v_sec_buf,1),0) > 0 THEN
      v_sec_no := v_sec_no + 1;
      v_out := array_append(v_out, (v_sec_no || '. ' || upper(v_sec.heading))::text);
      v_out := v_out || ARRAY(SELECT replace(x, '§CLAUSENUM§', v_sec_no::text) FROM unnest(v_sec_buf) x);
    END IF;
  END LOOP;

  v_body := array_to_string(v_out, E'\n');
  v_body := regexp_replace(v_body, E'\n{3,}', E'\n\n', 'g');
  UPDATE documents SET merged_body = v_body WHERE id = p_document_id AND workflow_state <> 'executed';
  RETURN v_body;
END;
$function$;
