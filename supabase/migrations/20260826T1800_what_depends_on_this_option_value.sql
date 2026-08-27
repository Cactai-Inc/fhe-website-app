-- contract_menu_dependents — what breaks if this value goes (TASK-CONTRACTOPTIONS §2)
--
-- A value's CODE is a contract in its own right: 208 field conditions, 449 clause
-- conditions and 8 per-option `when` gates name option values as BARE STRINGS.
-- Renaming one does not error -- the clause simply stops appearing. So before a
-- value can be retired the editor has to be able to say "3 clauses and 1 draft
-- depend on this", and that read has to be complete or it is worse than nothing.
--
-- ⚠️ THREE CONDITION SITES, NOT TWO. The handoff was corrected once already to add
-- clause-level conditions beside field-level ones. There is a THIRD: every entry in
-- `contract_field_defs.options` may carry its own `when` gate, and 8 of the 795 live
-- entries do (TXN.OTHERS_ALLOWED and TXN.GL_LESSEE_STATUS, on all four lease keys).
-- A dependents read covering only the first two would report "nothing depends on
-- this" for a value that silently un-gates an option in another list.
--
-- ⚠️ `contract_section_defs` HAS NO `conditional_on` -- verified 2026-08-26, its nine
-- columns do not include one. Sections are gated by the clauses inside them. There
-- is no fourth site.

-- ── does this condition name (field, code) anywhere inside it? ──────────────
-- Recurses through all/any. Only `equals` and `contains` name option VALUES;
-- `gte` is a numeric gate that strips non-digits, so it can never name a code.
CREATE OR REPLACE FUNCTION public._condition_names_value(
  p_cond jsonb, p_field_key text, p_code text
) RETURNS boolean
 LANGUAGE plpgsql IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE v_sub jsonb;
BEGIN
  IF p_cond IS NULL OR p_code IS NULL THEN RETURN false; END IF;

  IF p_cond ? 'all' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'all') LOOP
      IF _condition_names_value(v_sub, p_field_key, p_code) THEN RETURN true; END IF;
    END LOOP;
  END IF;

  IF p_cond ? 'any' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'any') LOOP
      IF _condition_names_value(v_sub, p_field_key, p_code) THEN RETURN true; END IF;
    END LOOP;
  END IF;

  -- A leaf only counts when it is about THIS field.
  IF coalesce(p_cond ->> 'field_key', '') <> p_field_key THEN RETURN false; END IF;

  IF p_cond ? 'equals'   AND (p_cond -> 'equals')   ? p_code THEN RETURN true; END IF;
  IF p_cond ? 'contains' AND (p_cond -> 'contains') ? p_code THEN RETURN true; END IF;

  RETURN false;
END;
$function$;

-- ── does a stored VALUE select this code? ──────────────────────────────────
-- A single-select stores the bare code. A multi-select stores a comma-joined
-- list, which is what `clause_condition_met`'s `contains` branch splits on -- so
-- membership, not equality, is the test.
CREATE OR REPLACE FUNCTION public._value_selects_code(p_value text, p_code text)
 RETURNS boolean
 LANGUAGE sql IMMUTABLE
AS $function$
  SELECT coalesce(p_code = ANY (
    ARRAY(SELECT btrim(x) FROM regexp_split_to_table(coalesce(p_value, ''), ',') x
           WHERE btrim(x) <> '')
  ), false);
$function$;

-- ── the read ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_menu_dependents(
  p_template_key text, p_field_key text, p_code text
) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_opt       jsonb;
  v_clauses   jsonb;
  v_fields    jsonb;
  v_options   jsonb;
  v_documents jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  -- the option itself, so the caller can show its label and current state
  SELECT o INTO v_opt
    FROM contract_field_defs f, LATERAL jsonb_array_elements(f.options) o
   WHERE f.template_key = p_template_key AND f.field_key = p_field_key
     AND o ->> 'value' = p_code
   LIMIT 1;

  -- 1 ── clause-level conditions (the largest set)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'clause_key', cd.clause_key, 'section_key', cd.section_key,
           'heading', cd.heading) ORDER BY cd.sort_order), '[]'::jsonb)
    INTO v_clauses
    FROM contract_clause_defs cd
   WHERE cd.template_key = p_template_key
     AND _condition_names_value(cd.conditional_on, p_field_key, p_code);

  -- 2 ── field-level conditions
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'field_key', fd.field_key, 'label', fd.label,
           'section', fd.section) ORDER BY fd.sort_order), '[]'::jsonb)
    INTO v_fields
    FROM contract_field_defs fd
   WHERE fd.template_key = p_template_key
     AND _condition_names_value(fd.conditional_on, p_field_key, p_code);

  -- 3 ── ⚠️ per-option `when` gates in OTHER option lists
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'field_key', fd.field_key, 'label', fd.label,
           'option_value', o ->> 'value', 'option_label', o ->> 'label')), '[]'::jsonb)
    INTO v_options
    FROM contract_field_defs fd, LATERAL jsonb_array_elements(fd.options) o
   WHERE fd.template_key = p_template_key
     AND o ? 'when'
     AND _condition_names_value(o -> 'when', p_field_key, p_code);

  -- 4 ── documents that have it SELECTED, split by whether they can still change
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'document_id', d.id, 'title', d.title,
           'workflow_state', d.workflow_state, 'status', d.status,
           'frozen', (coalesce(d.workflow_state, '') = 'executed'),
           'value', cf.value) ORDER BY d.created_at DESC), '[]'::jsonb)
    INTO v_documents
    FROM contract_fields cf
    JOIN documents d ON d.id = cf.document_id AND d.deleted_at IS NULL
    JOIN contract_templates ct ON ct.id = d.template_id
   WHERE ct.template_key = p_template_key
     AND cf.field_key = p_field_key
     AND _value_selects_code(cf.value, p_code);

  RETURN jsonb_build_object(
    'template_key', p_template_key,
    'field_key',    p_field_key,
    'code',         p_code,
    'label',        v_opt ->> 'label',
    'exists',       (v_opt IS NOT NULL),
    -- absent `active` reads as active: 212 live lists predate the flag.
    'active',       coalesce((v_opt ->> 'active')::boolean, true),
    'clauses',      v_clauses,
    'fields',       v_fields,
    'options',      v_options,
    'documents',    v_documents,
    'totals', jsonb_build_object(
      'conditions', jsonb_array_length(v_clauses) + jsonb_array_length(v_fields)
                    + jsonb_array_length(v_options),
      'clauses',    jsonb_array_length(v_clauses),
      'fields',     jsonb_array_length(v_fields),
      'options',    jsonb_array_length(v_options),
      'documents_open',   (SELECT count(*) FROM jsonb_array_elements(v_documents) x
                            WHERE NOT (x ->> 'frozen')::boolean),
      'documents_frozen', (SELECT count(*) FROM jsonb_array_elements(v_documents) x
                            WHERE (x ->> 'frozen')::boolean)));
END;
$function$;

REVOKE ALL ON FUNCTION public.contract_menu_dependents(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.contract_menu_dependents(text, text, text) TO authenticated;
