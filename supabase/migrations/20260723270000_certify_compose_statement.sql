-- Certify fields: render the CERTIFICATION STATEMENT in the composed document,
-- not a bare "Yes".
--
-- A `certify` checkbox stores YES/NO in `value`; the field LABEL is the full
-- statement (e.g. "I certify that I have the permission or authority …"). In the
-- authoring view the checkbox self-labels, so the clause body is just the token —
-- but the signed document was rendering that token as "Yes" (a meaningless
-- "6.3 Yes" clause). Now a checked certify composes to its statement; unchecked
-- composes to empty (and the line/clause drops).

-- add a 'certify' case to compose_field_prose (uses p_label = the statement).
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('compose_field_prose'::regproc);
  v_def := replace(v_def,
$old$    WHEN 'week_grid' THEN v_out := compose_week_grid(s);$old$,
$new$    WHEN 'week_grid' THEN v_out := compose_week_grid(s);
    WHEN 'certify' THEN
      -- checked → the statement (its label); unchecked → nothing.
      v_out := CASE WHEN upper(coalesce(s->>'value', p_value, '')) = 'YES'
                    THEN coalesce(p_label, '') ELSE '' END;$new$);
  IF v_def NOT LIKE '%WHEN ''certify'' THEN%' THEN RAISE EXCEPTION 'compose_field_prose: week_grid case not found'; END IF;
  EXECUTE v_def;
END $mig$;

-- NOTE: certify keeps its raw YES/NO in `value` (so the authoring checkbox
-- reflects state); it is composed to its statement at render time by remerge below.

-- remerge renders certify tokens via token_display_value → "Yes". Instead, render
-- the field's statement label when checked. Give the composer the certify field's
-- label + a special-case in the token replace step.
CREATE OR REPLACE FUNCTION public.certify_statement(p_field_key text, p_raw text, p_tmpl text)
 RETURNS text LANGUAGE sql STABLE AS $function$
  SELECT CASE WHEN upper(coalesce(p_raw,'')) = 'YES'
    THEN coalesce((SELECT label FROM contract_field_defs
                    WHERE template_key = p_tmpl AND field_key = p_field_key), '')
    ELSE '' END;
$function$;

DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('remerge_contract_from_clauses'::regproc);
  v_def := replace(v_def,
$old$            ELSE v_line := replace(v_line, '{{'||v_tok||'}}', token_display_value(v_tok, v_fields ->> v_tok, v_labels)); END IF;$old$,
$new$            ELSIF EXISTS (SELECT 1 FROM contract_field_defs fdc
                          WHERE fdc.template_key = v_tkey AND fdc.field_key = v_tok
                            AND fdc.format_type = 'certify') THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', certify_statement(v_tok, v_fields ->> v_tok, v_tkey));
            ELSE v_line := replace(v_line, '{{'||v_tok||'}}', token_display_value(v_tok, v_fields ->> v_tok, v_labels)); END IF;$new$);
  IF v_def NOT LIKE '%certify_statement(v_tok%' THEN RAISE EXCEPTION 'remerge: token replace not found'; END IF;
  EXECUTE v_def;
END $mig$;
