-- ─────────────────────────────────────────────────────────────────────────────
-- CHANGE-REQUEST / CHANGE-HISTORY / VOID — Part 3 of 4: the live section tree.
--
-- The change-request menu lists every section AND subsection by its REAL number
-- and title. Numbering must be DERIVED from the document, never hardcoded — a
-- Definitions section was inserted at sort_order 22 recently and shifted every
-- later number, and the menu has to follow automatically.
--
-- `contract_template_structure` returns the raw defs with no numbering and no
-- gating, so it cannot answer "what is section 12 called on THIS document".
-- This function applies exactly the numbering rules `remerge_contract_from_clauses`
-- uses when it composes merged_body, so the tree and the document always agree:
--
--   • sections are walked in sort_order; a section whose `cut_name` is not kept
--     for this document's field values is SKIPPED and consumes no number;
--   • surviving sections are numbered 1..N sequentially (matching the
--     "N. HEADING" lines remerge emits);
--   • within a section, clauses are walked in sort_order; a clause is skipped
--     when its cut_name is not kept or its conditional_on is unmet;
--   • a surviving clause takes the next sub-number, rendered "<sec>.<n>",
--     EXCEPT a `render_as_subitem` clause with no heading, which remerge folds
--     into the previous line rather than numbering — so it takes no number here
--     either and is omitted from the tree;
--   • a section that produces NO content is not emitted and CONSUMES NO NUMBER —
--     remerge only increments its section counter inside
--     `IF coalesce(array_length(v_sec_buf,1),0) > 0`. Verified live: on document
--     5dbce25f… the SCHEDULE section yields nothing, so the composed body runs
--     …3. DEFINITIONS, 4. LEASE FEE… and TERMINATION is 14, not 15. The tree must
--     agree, so it buffers each section and only assigns a number once the
--     section has at least one numbered subsection.
--
-- Anything the reader can target is therefore addressable by the same number
-- they can see in the composed document.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.contract_section_tree(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_tkey text; v_fields jsonb := '{}'::jsonb;
  v_sec record; v_cl record; r record;
  v_sec_no int := 0; v_cl_no int;
  v_subs jsonb; v_out jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT d.org_id, ct.template_key INTO v_org, v_tkey
    FROM documents d
    LEFT JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  IF v_tkey IS NULL
     OR NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key = v_tkey) THEN
    RETURN '[]'::jsonb;   -- not a clause-model document
  END IF;

  -- the document's own field values decide every cut/conditional gate
  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;

  FOR v_sec IN
    SELECT * FROM contract_section_defs WHERE template_key = v_tkey ORDER BY sort_order
  LOOP
    IF v_sec.cut_name IS NOT NULL AND NOT clause_cut_kept(v_sec.cut_name, v_fields) THEN
      CONTINUE;                                  -- cut: consumes no number
    END IF;

    -- buffer the clauses first: the section only earns a number once it has
    -- content, and the subsection numbers embed that section number.
    v_cl_no  := 0;
    v_subs   := '[]'::jsonb;

    FOR v_cl IN
      SELECT * FROM contract_clause_defs
       WHERE template_key = v_tkey AND section_key = v_sec.section_key
       ORDER BY sort_order
    LOOP
      IF v_cl.cut_name IS NOT NULL AND NOT clause_cut_kept(v_cl.cut_name, v_fields) THEN
        CONTINUE;
      END IF;
      IF NOT clause_condition_met(v_cl.conditional_on, v_fields) THEN
        CONTINUE;
      END IF;
      -- remerge folds an unheaded subitem into the previous line — no number
      IF coalesce(v_cl.render_as_subitem, false)
         AND (v_cl.heading IS NULL OR v_cl.heading = '') THEN
        CONTINUE;
      END IF;

      v_cl_no := v_cl_no + 1;
      v_subs := v_subs || jsonb_build_array(jsonb_build_object(
        'clause_key', v_cl.clause_key,
        'sub_index',  v_cl_no,
        'title',      coalesce(nullif(trim(v_cl.heading), ''), v_sec.heading),
        'guidance',   v_cl.guidance));
    END LOOP;

    -- an empty section is not composed and consumes no number
    IF v_cl_no = 0 THEN CONTINUE; END IF;

    v_sec_no := v_sec_no + 1;

    -- stamp the now-known section number onto each subsection
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'clause_key', x->>'clause_key',
             'number',     v_sec_no || '.' || (x->>'sub_index'),
             'title',      x->>'title',
             'guidance',   x->>'guidance') ORDER BY ord), '[]'::jsonb)
      INTO v_subs
      FROM jsonb_array_elements(v_subs) WITH ORDINALITY q(x, ord);

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'section_key', v_sec.section_key,
      'number',      v_sec_no::text,
      'title',       v_sec.heading,
      'guidance',    v_sec.guidance,
      'subsections', v_subs));
  END LOOP;

  RETURN v_out;
END;
$function$;

COMMENT ON FUNCTION public.contract_section_tree(uuid) IS
  'Live section/subsection tree for a clause-model document, numbered exactly as '
  'remerge_contract_from_clauses composes merged_body (cut/conditional gating '
  'applied, unheaded render_as_subitem clauses folded away). The change-request '
  'and change-history menus derive their numbers from this — never hardcoded.';

COMMIT;
