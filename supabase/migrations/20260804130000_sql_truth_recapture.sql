-- SQL TRUTH RECAPTURE 2026-08-04: these bodies are copied byte-for-byte from
-- live prod, which had drifted from committed migrations. Behavior-neutral
-- by construction. See docs/reports/TASK-SQLTRUTH-REPORT.md for the drift
-- diff.
--
-- Recaptured (drifted from git): remerge_contract_from_clauses,
-- contract_template_structure, set_contract_field.
-- Recaptured alongside for completeness (already matched git, no drift):
-- clause_condition_met, clause_cut_kept.

CREATE OR REPLACE FUNCTION public.remerge_contract_from_clauses(p_document_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc documents%ROWTYPE; v_tkey text;
  v_fields jsonb := '{}'::jsonb; v_labels jsonb := '{}'::jsonb;
  v_out text[] := '{}'; v_sec_buf text[]; v_cl_buf text[];
  v_sec record; v_cl record; v_sec_no int := 0; v_cl_no int; v_sub_no int := 0;
  v_body text; v_lines text[]; v_line text; v_stripped text;
  v_toks text[]; v_tok text; v_any_token boolean; v_all_empty boolean; v_has_sig boolean;
  v_na boolean;
  r record; v_cf record; v_val text;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_doc.template_id;
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key = v_tkey) THEN RETURN NULL; END IF;

  /* B4: once the document has left the editable phase its content is the
     instrument, so an author-added entry nobody filled must SAY it is empty
     rather than vanish. Blank CUSTOM tokens compose as 'N/A' from that point. */
  v_na := coalesce(v_doc.workflow_state, '') NOT IN ('editable','editing');

  PERFORM recompose_document_fields(p_document_id);
  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val FROM contract_fields WHERE document_id = p_document_id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;
  SELECT coalesce(jsonb_object_agg(field_key, vmap), '{}'::jsonb) INTO v_labels
  FROM (SELECT field_key, jsonb_object_agg(opt->>'value', opt->>'label') AS vmap
          FROM contract_field_defs fd CROSS JOIN LATERAL jsonb_array_elements(fd.options) AS opt
         WHERE fd.template_key = v_tkey AND fd.options IS NOT NULL GROUP BY field_key) m;
  -- author-added elements carry their option labels on the DOCUMENT, not the
  -- template, so their values resolve to words too.
  SELECT v_labels || coalesce(jsonb_object_agg(field_key, vmap), '{}'::jsonb) INTO v_labels
  FROM (SELECT field_key, jsonb_object_agg(opt->>'value', opt->>'label') AS vmap
          FROM contract_fields cfo CROSS JOIN LATERAL jsonb_array_elements(cfo.options) AS opt
         WHERE cfo.document_id = p_document_id AND cfo.custom_kind = 'element'
           AND cfo.options IS NOT NULL GROUP BY field_key) m2;

  FOR v_sec IN
    SELECT section_key, heading, cut_name, ord FROM (
      SELECT sd.section_key, sd.heading, sd.cut_name, (sd.sort_order::numeric * 1000) AS ord
        FROM contract_section_defs sd WHERE sd.template_key = v_tkey
      UNION ALL
      SELECT cs.section, coalesce(nullif(btrim(cs.label),''), cs.section), NULL::text, cs.sort_order::numeric
        FROM contract_fields cs
       WHERE cs.document_id = p_document_id AND cs.custom_kind = 'section'
    ) s ORDER BY ord
  LOOP
    IF v_sec.cut_name IS NOT NULL AND NOT clause_cut_kept(v_sec.cut_name, v_fields) THEN CONTINUE; END IF;
    v_sec_buf := '{}'; v_cl_no := 0; v_sub_no := 0;

    FOR v_cl IN
      SELECT clause_key, heading, body, clause_type, is_optional, cut_name,
             conditional_on, render_as_subitem, ord1, ord2 FROM (
        SELECT cd.clause_key, cd.heading, cd.body, cd.clause_type, cd.is_optional,
               cd.cut_name, cd.conditional_on, cd.render_as_subitem,
               (cd.sort_order::numeric * 1000) AS ord1, 0::numeric AS ord2
          FROM contract_clause_defs cd
         WHERE cd.template_key = v_tkey AND cd.section_key = v_sec.section_key
        UNION ALL
        -- author-added HEADER: a clause with a heading and no body of its own
        SELECT ch.field_key, coalesce(nullif(btrim(ch.label),''), 'Item'), NULL::text,
               'prose', false, NULL::text, NULL::jsonb, false,
               ch.sort_order::numeric, 0::numeric
          FROM contract_fields ch
         WHERE ch.document_id = p_document_id AND ch.custom_kind = 'header'
           AND ch.section = v_sec.section_key
        UNION ALL
        -- author-added LINE: headingless continuation, sorted under its header
        SELECT cl.field_key, NULL::text, cl.body, 'prose', false, NULL::text,
               cl.conditional_on, false,
               coalesce(cdh.sort_order::numeric * 1000, cfh.sort_order::numeric, 2147483647::numeric),
               cl.sort_order::numeric
          FROM contract_fields cl
          LEFT JOIN contract_clause_defs cdh
            ON cdh.template_key = v_tkey AND cdh.clause_key = cl.clause_key
           AND cdh.section_key = v_sec.section_key
          LEFT JOIN contract_fields cfh
            ON cfh.document_id = p_document_id AND cfh.field_key = cl.clause_key
           AND cfh.custom_kind = 'header'
         WHERE cl.document_id = p_document_id AND cl.custom_kind = 'line'
           AND cl.section = v_sec.section_key
      ) c ORDER BY ord1, ord2
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

      v_cl_buf := '{}';
      IF v_body <> '' THEN
        v_lines := string_to_array(v_body, E'\n');
        FOREACH v_line IN ARRAY v_lines LOOP
          v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
          v_any_token := coalesce(array_length(v_toks,1),0) > 0;
          IF NOT v_any_token THEN
            /* R11: an AUTHORED line is never typed with a closing period —
               the composer supplies terminal punctuation here, exactly as R5
               does for a token-bearing line. Template prose is left verbatim:
               its punctuation is part of the drafted instrument. */
            IF v_cl.clause_key LIKE 'CUSTOM.%' AND btrim(v_line) <> ''
               AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
              v_line := v_line || '.';
            END IF;
            v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE;
          END IF;
          -- line-level field gating: if any token on this line is a field with an
          -- unmet conditional_on, drop the whole line.
          IF EXISTS (
            SELECT 1 FROM unnest(v_toks) t
             JOIN contract_field_defs fdg
               ON fdg.template_key = v_tkey AND fdg.field_key = t
            WHERE fdg.conditional_on IS NOT NULL
              AND NOT clause_condition_met(fdg.conditional_on, v_fields)
          ) THEN CONTINUE; END IF;
          v_all_empty := true; v_has_sig := false;
          FOREACH v_tok IN ARRAY v_toks LOOP
            IF v_tok LIKE 'SIG.%' THEN v_has_sig := true; v_all_empty := false;
            ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN v_all_empty := false;
            ELSIF v_tok LIKE 'CUSTOM.%' AND v_na THEN v_all_empty := false;   -- B4: prints N/A
            ELSIF coalesce(v_fields ->> v_tok,'') <> '' THEN v_all_empty := false; END IF;
          END LOOP;
          IF v_all_empty AND NOT v_has_sig THEN
            v_stripped := regexp_replace(v_line, '\{\{[A-Z0-9_.]+\}\}', '', 'g');
            -- drop a leading "Label:" (up to ~5 words) so a labeled line with only
            -- blank tokens is treated as empty and omitted, not printed as "Label:".
            v_stripped := regexp_replace(v_stripped, '^\s*[[:alpha:]][[:alpha:] ''()/-]{0,60}:\s*', '');
            v_stripped := btrim(regexp_replace(v_stripped, '[[:punct:][:space:]]', '', 'g'));
            IF v_stripped = '' THEN CONTINUE; END IF;
          END IF;
          FOREACH v_tok IN ARRAY v_toks LOOP
            IF v_tok LIKE 'SIG.%' THEN CONTINUE;
            ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', to_char(coalesce(v_doc.effective_date, v_doc.created_at::date), 'FMMonth FMDD, YYYY'));
            ELSIF v_tok LIKE 'CUSTOM.%' AND v_na AND coalesce(v_fields ->> v_tok,'') = '' THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', 'N/A');
            ELSIF EXISTS (SELECT 1 FROM contract_field_defs fdc
                          WHERE fdc.template_key = v_tkey AND fdc.field_key = v_tok
                            AND fdc.format_type = 'certify') THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', certify_statement(v_tok, v_fields ->> v_tok, v_tkey));
            ELSIF (v_fields ->> v_tok) ~ '^\d+(\.\d+)?$'
              AND EXISTS (SELECT 1 FROM contract_field_defs fdpct
                          WHERE fdpct.template_key = v_tkey AND fdpct.field_key = v_tok
                            AND fdpct.format_type = 'percent') THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', (v_fields ->> v_tok) || '%');
            ELSIF (v_fields ->> v_tok) ~ '^\d+(\.\d+)?$'
              AND EXISTS (SELECT 1 FROM contract_field_defs fdcur
                          WHERE fdcur.template_key = v_tkey AND fdcur.field_key = v_tok
                            AND fdcur.format_type = 'currency') THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', fmt_money((v_fields ->> v_tok)::numeric));
            ELSE v_line := replace(v_line, '{{'||v_tok||'}}', token_display_value(v_tok, v_fields ->> v_tok, v_labels)); END IF;
          END LOOP;
          /* R5 (2026-08-04): sentence-terminal punctuation is appended HERE,
             not authored into the body. The clause bodies used to end
             "…: {{TOKEN}}." which produced an orphan "." under a full-width
             input in the editor and a doubled ".." whenever the signer typed
             their own period. Now: if the composed line ends with a filled
             token and lacks terminal punctuation, add one. A line whose token
             resolved to empty gets nothing, so no orphan period survives. */
          /* Only punctuate a line that actually SAYS something: a line whose
             token resolved to empty ends in its lead-in colon ("are: ") and
             must stay bare rather than becoming "are: ." — the unanswered
             field is already flagged by the required marker. */
          IF btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
            v_line := v_line || '.';
          END IF;
          v_line := regexp_replace(v_line, ':\s*\.\s*$', ':');
          v_line := regexp_replace(v_line, '\s+([.,;])', '\1', 'g');
          v_cl_buf := array_append(v_cl_buf, v_line);
        END LOOP;
      END IF;

      IF (v_cl.heading IS NULL OR v_cl.heading = '') AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(v_cl_buf, ARRAY[]::text[])) x WHERE btrim(x) <> '') THEN CONTINUE; END IF;

      IF coalesce(v_cl.render_as_subitem,false) AND (v_cl.heading IS NULL OR v_cl.heading = '') AND coalesce(array_length(v_cl_buf,1),0) > 0 THEN
        v_sub_no := coalesce(array_upper(v_sec_buf,1),0);
          WHILE v_sub_no >= 1 AND v_sec_buf[v_sub_no] = '' LOOP v_sub_no := v_sub_no - 1; END LOOP;
          IF v_sub_no >= 1 THEN
            v_sec_buf[v_sub_no] := v_sec_buf[v_sub_no] || ' ' || array_to_string(v_cl_buf, ' ');
        ELSE
          v_sec_buf := v_sec_buf || v_cl_buf;
        END IF;
      ELSE
      v_sub_no := 0;
      /* R11: the NUMBER belongs to the HEADING. Only a headed clause consumes
         one; a headingless clause is continuation text under the item above
         (or section preamble when no header precedes it) and is emitted bare. */
      IF v_cl.heading IS NOT NULL AND v_cl.heading <> '' THEN
        v_cl_no := v_cl_no + 1;
        v_sec_buf := array_append(v_sec_buf, ('§CLAUSENUM§.' || v_cl_no || ' ' || v_cl.heading)::text);
        IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN v_sec_buf := v_sec_buf || v_cl_buf; END IF;
      ELSE
        IF coalesce(array_length(v_cl_buf,1),0) > 0 THEN
          v_sec_buf := v_sec_buf || v_cl_buf;
        END IF;
      END IF;
      END IF;
      v_sec_buf := array_append(v_sec_buf, ''::text);
    END LOOP;

    -- LEGACY custom fields (pre-R11 add surface): still "Label: value" at the
    -- end of the section they were added to.
    FOR v_cf IN SELECT field_key, label, value FROM contract_fields
                 WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
                   AND custom_kind IS NULL
                   AND section = v_sec.section_key ORDER BY sort_order LOOP
      v_val := btrim(coalesce(v_cf.value, ''));
      IF v_val = '' THEN
        IF NOT v_na THEN CONTINUE; END IF;                          -- omit while editable
        v_val := 'N/A';                                             -- B4 at execution
      END IF;
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

  -- LEGACY custom SECTIONS (a pre-R11 CUSTOM.* field whose `section` matches no
  -- section_def and has no author-added section row): emitted after everything.
  FOR v_sec IN
    SELECT DISTINCT section FROM contract_fields
     WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
       AND custom_kind IS NULL
       AND section NOT IN (SELECT section_key FROM contract_section_defs WHERE template_key = v_tkey)
       AND section NOT IN (SELECT cs.section FROM contract_fields cs
                            WHERE cs.document_id = p_document_id AND cs.custom_kind = 'section')
     ORDER BY section
  LOOP
    v_sec_buf := '{}'; v_cl_no := 0; v_sub_no := 0;
    FOR v_cf IN SELECT field_key, label, value FROM contract_fields
                 WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%'
                   AND custom_kind IS NULL
                   AND section = v_sec.section ORDER BY sort_order LOOP
      v_val := btrim(coalesce(v_cf.value, ''));
      IF v_val = '' THEN
        IF NOT v_na THEN CONTINUE; END IF;
        v_val := 'N/A';
      END IF;
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
$function$

;

CREATE OR REPLACE FUNCTION public.clause_condition_met(p_cond jsonb, v_fields jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key   text;
  v_raw   text;
  v_have  text[];
  v_v     jsonb;
  v_sub   jsonb;
BEGIN
  IF p_cond IS NULL THEN RETURN true; END IF;

  -- composite AND: every sub-condition must hold
  IF p_cond ? 'all' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'all') LOOP
      IF NOT clause_condition_met(v_sub, v_fields) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- composite OR: any sub-condition holding is enough
  IF p_cond ? 'any' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'any') LOOP
      IF clause_condition_met(v_sub, v_fields) THEN RETURN true; END IF;
    END LOOP;
    RETURN false;
  END IF;

  v_key := p_cond ->> 'field_key';
  IF v_key IS NULL THEN RETURN true; END IF;
  v_raw := coalesce(v_fields ->> v_key, '');

  IF p_cond ? 'equals' THEN
    IF p_cond -> 'equals' ? v_raw THEN RETURN true; END IF;
  END IF;

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

  -- numeric gate: met when the field's parsed numeric value >= gte.
  -- Unparseable values (empty, "N/A") never meet it.
  IF p_cond ? 'gte' THEN
    BEGIN
      IF nullif(regexp_replace(v_raw, '[^0-9.]', '', 'g'), '')::numeric
         >= (p_cond ->> 'gte')::numeric THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  RETURN false;
END;
$function$

;

CREATE OR REPLACE FUNCTION public.clause_cut_kept(p_cut text, v_fields jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
$function$

;

CREATE OR REPLACE FUNCTION public.contract_template_structure(p_template_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'template_key', p_template_key,
    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'section_key', s.section_key,
        'heading', s.heading,
        'sort_order', s.sort_order,
        'is_optional', s.is_optional,
        'guidance', s.guidance,
        'clauses', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'clause_key', c.clause_key,
            'heading', c.heading,
            'body', c.body,
            'clause_type', c.clause_type,
            'sort_order', c.sort_order,
            'is_optional', c.is_optional,
            'conditional_on', c.conditional_on,
            'guidance', c.guidance
          ) ORDER BY c.sort_order)
          FROM contract_clause_defs c
          WHERE c.template_key = p_template_key AND c.section_key = s.section_key
        ), '[]'::jsonb)
      ) ORDER BY s.sort_order)
      FROM contract_section_defs s WHERE s.template_key = p_template_key
    ), '[]'::jsonb)
  );
$function$

;

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
  v_sec        text;
  v_counterpart text;
  v_is_elect   boolean := false;
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

  -- D4(a): the two insurance responsibility elections are PARTY-EXCLUSIVE.
  -- An election is a party's own act; staff status does not stand in for it.
  -- FHE is itself the Lessor on these contracts, so without this carve-out
  -- FHE staff could make the Lessee's election for them.
  v_sec := CASE
             WHEN p_field_key IN ('TXN.GL_LESSEE_RESPONSIBLE','TXN.GL_NOT_REQUIRED') THEN 'GL'
             WHEN p_field_key IN ('TXN.MORT_LESSEE_RESPONSIBLE','TXN.MORT_NOT_REQUIRED') THEN 'MORT'
             WHEN p_field_key IN ('TXN.MED_LESSEE_RESPONSIBLE','TXN.MED_NOT_REQUIRED') THEN 'MED'
             ELSE NULL
           END;
  v_is_elect := v_sec IS NOT NULL;

  IF v_is_elect THEN
    -- Only the owning party may elect. No staff substitution.
    IF NOT (v_owns_role AND v_can_fill) THEN
      RAISE EXCEPTION
        'only the % may make this election (field %) — it is that party''s own act and cannot be made on their behalf',
        v_owner_role, p_field_key;
    END IF;
  ELSIF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND v_can_deal)
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  -- D4(b): mutual exclusivity. While one election is YES, the other cannot be
  -- set to YES. Unchecking your own re-opens the choice (spec).
  IF v_is_elect AND upper(coalesce(p_value,'')) = 'YES' THEN
    v_counterpart := CASE
      WHEN p_field_key LIKE '%_LESSEE_RESPONSIBLE' THEN 'TXN.' || v_sec || '_NOT_REQUIRED'
      ELSE 'TXN.' || v_sec || '_LESSEE_RESPONSIBLE'
    END;
    IF EXISTS (
      SELECT 1 FROM contract_fields
       WHERE document_id = p_document_id
         AND field_key = v_counterpart
         AND upper(coalesce(value,'')) = 'YES'
    ) THEN
      RAISE EXCEPTION
        'conflicting election: % is already accepted on this contract — the other party must uncheck it first',
        v_counterpart;
    END IF;
  END IF;

  -- An edit changes the text a signature attested to, so any standing
  -- signature is voided. A save that writes back the identical value is not
  -- an edit and must leave signatures intact. The signer is told at the next SEND.
  IF v_changed THEN
    PERFORM assert_not_signature_locked(p_document_id);
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

  -- (horse writeback removed 2026-08-03: record values are edited at their
  -- source, never written back from a document. Deal plan L10.)

  -- audit: only log an actual change
  IF v_changed THEN
    PERFORM log_contract_change(p_document_id, 'field_value', p_field_key, v_label,
                                v_owner_role, v_old_value, p_value, '{}'::jsonb);
  END IF;

  -- co-buyer teardown: flipping the enable to NO removes the co-buyer signer
  -- and party rows (signatures were already voided by the change above).
  IF v_changed AND p_field_key = 'TXN.CO_BUYER_ENABLED'
     AND upper(coalesce(p_value,'')) = 'NO' THEN
    PERFORM remove_document_co_buyer(p_document_id);
  END IF;

  -- D5: the elections drive the unresolved-state notifications. Called after
  -- the write so it observes the new state. Never modifies status values.
  IF v_is_elect OR p_field_key LIKE 'TXN.%_LESSOR_STATUS' OR p_field_key LIKE 'TXN.%_LESSEE_STATUS' THEN
    PERFORM insurance_resolution_sync(p_document_id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$function$

;
