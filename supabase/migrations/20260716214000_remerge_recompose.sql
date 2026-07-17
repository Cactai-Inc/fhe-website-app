-- remerge_contract_from_fields now calls recompose_document_fields first, so
-- structured fields compose their value before token substitution.
CREATE OR REPLACE FUNCTION public.remerge_contract_from_fields(p_document_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc      documents%ROWTYPE;
  v_body     text;
  v_fields   jsonb := '{}'::jsonb;     -- field_key â value (trimmed; '' when empty)
  v_keep     boolean;
  v_name     text;
  v_lines    text[];
  v_out      text[] := '{}';
  v_line     text;
  v_toks     text[];
  v_tok      text;
  v_all_empty boolean;
  v_has_sig   boolean;
  v_has_printed boolean;
  v_any_token boolean;
  r          record;
BEGIN
  IF auth.uid() IS NULL AND current_setting('request.jwt.claims', true) IS NULL THEN
    NULL; -- service/definer chains allowed
  END IF;

  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- staff of the org, the originator, or any document party may re-derive
  IF auth.uid() IS NOT NULL AND NOT (
       (has_staff_access() AND v_doc.org_id = current_org())
    OR contract_caller_is_originator(p_document_id)
    OR caller_is_document_party(p_document_id)
  ) THEN
    RAISE EXCEPTION 'not authorized to re-merge document %', p_document_id;
  END IF;

  -- 1. the ORIGINAL tokenized template body
  SELECT body INTO v_body FROM contract_templates WHERE id = v_doc.template_id;
  IF v_body IS NULL THEN
    RAISE EXCEPTION 'document % has no template body', p_document_id;
  END IF;

  -- 0. compose structured fields into their  first, so token substitution
  --    below picks up prose derived from the structured source of truth.
  PERFORM recompose_document_fields(p_document_id);

  -- 2. field map
  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;

  -- helper predicate inline: a field is "present" when non-empty after trim
  -- 3. CUT evaluation â INSURANCE wrapper FIRST, then children, then the rest.
  FOREACH v_name IN ARRAY ARRAY[
    'INSURANCE',
    'MORTALITY_INSURANCE','MAJOR_MEDICAL_INSURANCE','LOSS_OF_USE_INSURANCE',
    'EVALUATION_PERIOD','PARTIAL_LEASE','COMPETITION'
  ] LOOP
    -- skip sections not present in this template's body
    CONTINUE WHEN position('<!-- CUT-START: ' || v_name in v_body) = 0;

    v_keep := CASE v_name
      WHEN 'EVALUATION_PERIOD' THEN
        coalesce(v_fields ->> 'TXN.EVALUATION_START', '') <> ''
        OR coalesce(v_fields ->> 'TXN.EVALUATION_END', '') <> ''
      WHEN 'PARTIAL_LEASE' THEN
        lower(coalesce(v_fields ->> 'TXN.LEASE_TYPE', '')) LIKE '%partial%'
      WHEN 'INSURANCE' THEN
        coalesce(v_fields ->> 'TXN.MORTALITY_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MORTALITY_INSURANCE_PARTY', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MAJOR_MEDICAL_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MAJOR_MEDICAL_INSURANCE_PARTY', '') <> ''
        OR coalesce(v_fields ->> 'TXN.LOSS_OF_USE_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.LOSS_OF_USE_INSURANCE_PARTY', '') <> ''
      WHEN 'MORTALITY_INSURANCE' THEN
        coalesce(v_fields ->> 'TXN.MORTALITY_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MORTALITY_INSURANCE_PARTY', '') <> ''
      WHEN 'MAJOR_MEDICAL_INSURANCE' THEN
        coalesce(v_fields ->> 'TXN.MAJOR_MEDICAL_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MAJOR_MEDICAL_INSURANCE_PARTY', '') <> ''
      WHEN 'LOSS_OF_USE_INSURANCE' THEN
        coalesce(v_fields ->> 'TXN.LOSS_OF_USE_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.LOSS_OF_USE_INSURANCE_PARTY', '') <> ''
      WHEN 'COMPETITION' THEN
        coalesce(v_fields ->> 'TXN.COMPETITION_TERMS', '') <> ''
        OR coalesce(v_fields ->> 'TXN.COMPETITION_EXPENSES', '') <> ''
        OR coalesce(v_fields ->> 'TXN.COMPETITION_WINNINGS', '') <> ''
      ELSE true  -- unknown/other sections: keep content (conservative)
    END;

    IF v_keep THEN
      v_body := regexp_replace(
        v_body, '[ \t]*<!-- CUT-(START|END): ' || v_name || '[^>]*-->\n?', '', 'g');
    ELSE
      v_body := regexp_replace(
        v_body,
        '\n?[ \t]*<!-- CUT-START: ' || v_name || '[^>]*-->.*<!-- CUT-END: ' || v_name || ' -->\n?',
        E'\n', 'g');
    END IF;
  END LOOP;

  -- any other CUT sections this template carries (e.g. future additions): keep
  FOR r IN SELECT DISTINCT (regexp_matches(v_body, '<!-- CUT-START: ([A-Z_]+)', 'g'))[1] AS name LOOP
    v_body := regexp_replace(
      v_body, '[ \t]*<!-- CUT-(START|END): ' || r.name || '[^>]*-->\n?', '', 'g');
  END LOOP;

  -- 4+5. token fill + strip-unfilled, line by line
  v_lines := string_to_array(v_body, E'\n');
  FOREACH v_line IN ARRAY v_lines LOOP
    v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
    v_any_token := coalesce(array_length(v_toks, 1), 0) > 0;

    IF NOT v_any_token THEN
      v_out := v_out || v_line;
      CONTINUE;
    END IF;

    v_all_empty := true;
    v_has_sig := false;
    v_has_printed := false;
    FOREACH v_tok IN ARRAY v_toks LOOP
      IF v_tok LIKE 'SIG.%' THEN
        v_has_sig := true; v_all_empty := false;
      ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN
        v_all_empty := false;
      ELSIF v_tok LIKE '%.PRINTED_NAME' THEN
        v_has_printed := true;
      ELSIF coalesce(v_fields ->> v_tok, '') <> '' THEN
        v_all_empty := false;
      END IF;
    END LOOP;

    -- drop a line whose fillable tokens all resolved empty (decision 6) â unless
    -- it carries a SIG token or a PRINTED_NAME (signature-ceremony lines stay)
    IF v_all_empty AND NOT v_has_sig AND NOT v_has_printed THEN
      CONTINUE;
    END IF;

    -- fill: contract_fields values; DOC.EFFECTIVE_DATE from the document; SIG left
    FOREACH v_tok IN ARRAY v_toks LOOP
      IF v_tok LIKE 'SIG.%' THEN
        CONTINUE;
      ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN
        v_line := replace(v_line, '{{' || v_tok || '}}',
          to_char(coalesce(v_doc.effective_date, v_doc.created_at::date), 'FMMonth FMDD, YYYY'));
      ELSE
        v_line := replace(v_line, '{{' || v_tok || '}}', coalesce(v_fields ->> v_tok, ''));
      END IF;
    END LOOP;

    v_out := v_out || v_line;
  END LOOP;

  v_body := array_to_string(v_out, E'\n');
  -- 6. collapse the gaps stripped sections/lines leave behind
  v_body := regexp_replace(v_body, E'\n{3,}', E'\n\n', 'g');

  -- 7. never rewrite an executed body
  UPDATE documents SET merged_body = v_body
   WHERE id = p_document_id AND workflow_state <> 'executed';

  RETURN v_body;
END;
$function$;
