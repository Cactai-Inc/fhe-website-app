-- R11 PHASE B — ADD-ITEM REBUILD (storage + RPCs + composer).
--
-- The add surface used to produce ONE THING: a CUSTOM.* contract_fields row
-- rendered as "Label: value" at the end of a section. An author could not write
-- a sentence, could not put a control INSIDE a sentence, could not add a header,
-- and could not make anything conditional. This migration gives the SAME storage
-- (CUSTOM.* rows on contract_fields) the four row kinds an authored addition
-- actually needs, and teaches the composer to read them.
--
--   custom_kind = 'section'  a whole new section. label = its title; sort_order
--                            places it AMONG the template's sections.
--   custom_kind = 'header'   a numbered header inside a section. label = its
--                            words; sort_order places it among the section's
--                            template clauses.
--   custom_kind = 'line'     one content line. body = its prose, carrying
--                            {{CUSTOM.*}} tokens where inline elements sit;
--                            clause_key = the header it belongs under (a template
--                            clause_key or a custom header's field_key);
--                            conditional_on = its gate (written by a CONDITION
--                            SEPARATOR in the modal, evaluated by the EXISTING
--                            clause_condition_met engine — nothing was added to
--                            it); guidance = the gold caption shown for a gated
--                            line, the same column template clauses use.
--   custom_kind = 'element'  an inline control. input_kind select|buttons|text,
--                            options = its items, guidance = placeholder text,
--                            required = the signing lock. All pre-existing
--                            columns — only `body` and `custom_kind` are new.
--
-- PLACEMENT SPACE: template sort_orders sit as close together as 10/12, so a
-- custom row stores its sort_order in a x1000 "insertion space" (template
-- sort_order * 1000). A midpoint therefore always exists between two adjacent
-- template rows, and no template row is ever renumbered to make room.
--
-- REWRITE-IN-PLACE CAVEAT: remerge_contract_from_clauses and
-- contract_document_detail are replaced in place; this file is not replayable
-- onto a fresh database (a pre-existing property of ~31 migrations here).

-- ── 1. Storage ──────────────────────────────────────────────────────────────
ALTER TABLE contract_fields ADD COLUMN IF NOT EXISTS custom_kind text;
ALTER TABLE contract_fields ADD COLUMN IF NOT EXISTS body text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_fields_custom_kind_chk') THEN
    ALTER TABLE contract_fields ADD CONSTRAINT contract_fields_custom_kind_chk
      CHECK (custom_kind IS NULL OR custom_kind IN ('section','header','line','element'));
  END IF;
END $$;

COMMENT ON COLUMN contract_fields.custom_kind IS
  'Author-added row kind: section | header | line | element. NULL = a template field, or a legacy custom field from the pre-R11 add surface (still rendered as "Label: value").';
COMMENT ON COLUMN contract_fields.body IS
  'Prose of a custom_kind=''line'' row, with {{CUSTOM.*}} tokens where inline elements sit — the same convention contract_clause_defs.body uses.';

CREATE INDEX IF NOT EXISTS contract_fields_custom_kind_idx
  ON contract_fields (document_id, custom_kind) WHERE custom_kind IS NOT NULL;

-- ── 2. One key generator, shared by every add path ──────────────────────────
CREATE OR REPLACE FUNCTION public.next_custom_field_key(p_document_id uuid, p_label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_seq int; v_base text; v_key text;
BEGIN
  v_base := btrim(upper(regexp_replace(coalesce(nullif(btrim(p_label),''),'FIELD'),
                                       '[^a-zA-Z0-9]+', '_', 'g')), '_');
  IF v_base = '' THEN v_base := 'FIELD'; END IF;
  SELECT count(*) INTO v_seq FROM contract_fields
   WHERE document_id = p_document_id AND field_key LIKE 'CUSTOM.%';
  LOOP
    v_seq := v_seq + 1;
    v_key := 'CUSTOM.' || v_base || '_' || v_seq;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM contract_fields
                           WHERE document_id = p_document_id AND field_key = v_key);
  END LOOP;
  RETURN v_key;
END;
$function$;
REVOKE ALL ON FUNCTION public.next_custom_field_key(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_custom_field_key(uuid, text) TO authenticated, service_role;

-- ── 3. add_contract_element keeps its signature; it now shares the key
--       generator rather than carrying its own copy of the formula. ─────────
CREATE OR REPLACE FUNCTION public.add_contract_element(p_document_id uuid, p_kind text, p_section text, p_after_section text DEFAULT NULL::text, p_position integer DEFAULT NULL::integer, p_label text DEFAULT NULL::text, p_format_type text DEFAULT 'text'::text, p_options jsonb DEFAULT NULL::jsonb, p_guidance text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text;
  v_new_key text;
  v_sort integer;
  v_input_kind text;
  v_after_max integer;
  v_before_min integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to modify this document';
  END IF;

  -- resolve input_kind from the format registry (fallback text)
  SELECT input_kind INTO v_input_kind FROM contract_formats WHERE format_type = p_format_type;
  v_input_kind := coalesce(v_input_kind, 'text');
  IF coalesce(p_guidance,'') = '' THEN
    SELECT guidance INTO p_guidance FROM contract_formats WHERE format_type = p_format_type;
  END IF;

  v_new_key := next_custom_field_key(p_document_id, p_label);

  IF p_kind = 'section' THEN
    -- place the new section's first field between p_after_section and the next one
    SELECT max(sort_order) INTO v_after_max FROM contract_fields
      WHERE document_id = p_document_id AND section = p_after_section;
    SELECT min(sort_order) INTO v_before_min FROM contract_fields
      WHERE document_id = p_document_id AND sort_order > coalesce(v_after_max, 0);
    v_sort := coalesce(v_after_max, 0) + CASE
      WHEN v_before_min IS NULL THEN 100
      ELSE greatest(1, (v_before_min - coalesce(v_after_max,0)) / 2) END;
  ELSE
    -- field within p_section at p_position (1-based). Shift everything at/after down.
    IF p_position IS NULL THEN
      SELECT coalesce(max(sort_order),0) + 10 INTO v_sort FROM contract_fields
        WHERE document_id = p_document_id AND section = p_section;
    ELSE
      -- the sort_order of the field currently at that position
      SELECT sort_order INTO v_sort FROM (
        SELECT sort_order, row_number() OVER (ORDER BY sort_order) AS rn
          FROM contract_fields WHERE document_id = p_document_id AND section = p_section
            AND parent_field_key IS NULL
      ) q WHERE q.rn = p_position;
      IF v_sort IS NULL THEN
        SELECT coalesce(max(sort_order),0) + 10 INTO v_sort FROM contract_fields
          WHERE document_id = p_document_id AND section = p_section;
      ELSE
        -- make room: bump this field and everything after it in the doc
        UPDATE contract_fields SET sort_order = sort_order + 10
          WHERE document_id = p_document_id AND sort_order >= v_sort;
      END IF;
    END IF;
  END IF;

  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, owner_role, value, value_type,
    required, sort_order, input_kind, format_type, options, guidance, is_optional, included)
  VALUES (
    v_org, p_document_id, v_new_key, coalesce(p_label, 'New field'), p_section, 'DEAL', NULL,
    CASE WHEN p_format_type IN ('longtext','currency','date','select') THEN p_format_type ELSE 'text' END,
    false, v_sort, v_input_kind, p_format_type, p_options, p_guidance, false, true);

  RETURN jsonb_build_object('field_key', v_new_key, 'sort_order', v_sort, 'section', p_section);
END;
$function$;

-- ── 4. The composite writer: one authored ADDITION, one transaction ─────────
/* p_spec:
   {
     "section":        "HORSE"            -- existing section_key, or a new title
     "section_new":    false,
     "section_position": 3,               -- 1-based, only when section_new
     "header": { "clause_key": "HORSE.BEHAVIOR" }        -- attach under an existing header
             | { "text": "Special Provisions", "position": 4 },  -- or create one
     "elements": [ { "id":"e1", "kind":"select|buttons|text",
                     "label":"…", "placeholder":"…", "required":false,
                     "options":[{"value":"AM","label":"Morning"}] } ],
     "lines":    [ { "body":"Turnout happens {{CUSTOM.@e1}}",
                     "conditional_on": {"field_key":"@e1","equals":["PM"]},
                     "caption":"This is included when …" } ]
   }
   Local element ids are referenced as @id inside line bodies and inside a gate's
   field_key; this function resolves them to the real CUSTOM keys it just minted,
   so the caller never has to guess a key. */
CREATE OR REPLACE FUNCTION public.add_contract_composition(p_document_id uuid, p_spec jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_tkey text;
  v_section text; v_section_new boolean; v_section_key text;
  v_header_key text; v_header_new text; v_pos int;
  v_prev numeric; v_next numeric; v_ord numeric;
  v_keys jsonb := '{}'::jsonb;          -- local id -> minted CUSTOM key
  v_el jsonb; v_ln jsonb;
  v_key text; v_body text; v_cond jsonb; v_cond_txt text;
  v_line_no int := 0; v_created text[] := '{}';
  v_input text; v_req boolean;
  r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT d.org_id, d.workflow_state, ct.template_key INTO v_org, v_state, v_tkey
    FROM documents d LEFT JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to modify this document';
  END IF;

  v_section     := btrim(coalesce(p_spec->>'section',''));
  v_section_new := coalesce((p_spec->>'section_new')::boolean, false);
  IF v_section = '' THEN RAISE EXCEPTION 'a section is required'; END IF;

  -- ── the section ──────────────────────────────────────────────────────────
  IF v_section_new THEN
    v_section_key := v_section;
    IF EXISTS (SELECT 1 FROM contract_section_defs WHERE template_key = v_tkey AND section_key = v_section_key)
       OR EXISTS (SELECT 1 FROM contract_fields WHERE document_id = p_document_id
                    AND custom_kind = 'section' AND section = v_section_key) THEN
      RAISE EXCEPTION 'a section named % already exists on this document', v_section_key;
    END IF;
    -- position among the document's CURRENT sections (template + custom), in the
    -- x1000 insertion space so a midpoint always exists.
    v_pos := coalesce((p_spec->>'section_position')::int, 2147483647);
    SELECT max(ord) INTO v_prev FROM (
      SELECT ord, row_number() OVER (ORDER BY ord) AS rn FROM (
        SELECT (sort_order::numeric * 1000) AS ord FROM contract_section_defs WHERE template_key = v_tkey
        UNION ALL
        SELECT sort_order::numeric FROM contract_fields
         WHERE document_id = p_document_id AND custom_kind = 'section') s
    ) q WHERE q.rn < v_pos;
    SELECT min(ord) INTO v_next FROM (
      SELECT ord, row_number() OVER (ORDER BY ord) AS rn FROM (
        SELECT (sort_order::numeric * 1000) AS ord FROM contract_section_defs WHERE template_key = v_tkey
        UNION ALL
        SELECT sort_order::numeric FROM contract_fields
         WHERE document_id = p_document_id AND custom_kind = 'section') s
    ) q WHERE q.rn >= v_pos;
    v_ord := CASE
      WHEN v_prev IS NULL AND v_next IS NULL THEN 10000
      WHEN v_prev IS NULL THEN v_next - 500
      WHEN v_next IS NULL THEN v_prev + 1000
      ELSE (v_prev + v_next) / 2 END;
    INSERT INTO contract_fields (org_id, document_id, field_key, label, section,
                                 owner_role, sort_order, custom_kind, included)
    VALUES (v_org, p_document_id, next_custom_field_key(p_document_id, v_section_key),
            v_section_key, v_section_key, 'DEAL', round(v_ord)::int, 'section', true);
    v_created := v_created || v_section_key;
  ELSE
    v_section_key := v_section;
    IF NOT EXISTS (SELECT 1 FROM contract_section_defs WHERE template_key = v_tkey AND section_key = v_section_key)
       AND NOT EXISTS (SELECT 1 FROM contract_fields WHERE document_id = p_document_id
                         AND custom_kind = 'section' AND section = v_section_key) THEN
      RAISE EXCEPTION 'unknown section: %', v_section_key;
    END IF;
  END IF;

  -- ── the header ───────────────────────────────────────────────────────────
  v_header_key := nullif(btrim(coalesce(p_spec#>>'{header,clause_key}','')), '');
  v_header_new := nullif(btrim(coalesce(p_spec#>>'{header,text}','')), '');
  IF v_header_key IS NULL AND v_header_new IS NULL THEN
    RAISE EXCEPTION 'a header is required — pick an existing one or name a new one';
  END IF;
  IF v_header_key IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM contract_clause_defs
                    WHERE template_key = v_tkey AND clause_key = v_header_key AND section_key = v_section_key)
       AND NOT EXISTS (SELECT 1 FROM contract_fields
                    WHERE document_id = p_document_id AND field_key = v_header_key
                      AND custom_kind = 'header' AND section = v_section_key) THEN
      RAISE EXCEPTION 'unknown header % in section %', v_header_key, v_section_key;
    END IF;
  ELSE
    -- new header: position among this section's HEADERS (template + custom), in
    -- the same x1000 insertion space. NULL / out of range = end of section.
    v_pos := (p_spec#>>'{header,position}')::int;
    SELECT max(ord) INTO v_prev FROM (
      SELECT ord, row_number() OVER (ORDER BY ord) AS rn FROM (
        SELECT (sort_order::numeric * 1000) AS ord FROM contract_clause_defs
         WHERE template_key = v_tkey AND section_key = v_section_key
           AND heading IS NOT NULL AND heading <> ''
        UNION ALL
        SELECT sort_order::numeric FROM contract_fields
         WHERE document_id = p_document_id AND custom_kind = 'header' AND section = v_section_key) s
    ) q WHERE v_pos IS NULL OR q.rn < v_pos;
    SELECT min(ord) INTO v_next FROM (
      SELECT ord, row_number() OVER (ORDER BY ord) AS rn FROM (
        SELECT (sort_order::numeric * 1000) AS ord FROM contract_clause_defs
         WHERE template_key = v_tkey AND section_key = v_section_key
           AND heading IS NOT NULL AND heading <> ''
        UNION ALL
        SELECT sort_order::numeric FROM contract_fields
         WHERE document_id = p_document_id AND custom_kind = 'header' AND section = v_section_key) s
    ) q WHERE v_pos IS NOT NULL AND q.rn >= v_pos;
    v_ord := CASE
      WHEN v_prev IS NULL AND v_next IS NULL THEN 10000
      WHEN v_prev IS NULL THEN v_next - 500
      WHEN v_next IS NULL THEN v_prev + 1000
      ELSE (v_prev + v_next) / 2 END;
    v_header_key := next_custom_field_key(p_document_id, v_header_new);
    INSERT INTO contract_fields (org_id, document_id, field_key, label, section,
                                 owner_role, sort_order, custom_kind, included)
    VALUES (v_org, p_document_id, v_header_key, v_header_new, v_section_key,
            'DEAL', round(v_ord)::int, 'header', true);
    v_created := v_created || v_header_key;
  END IF;

  -- ── the inline elements (minted first, so lines can reference their keys) ─
  FOR v_el IN SELECT * FROM jsonb_array_elements(coalesce(p_spec->'elements','[]'::jsonb)) LOOP
    v_input := lower(coalesce(v_el->>'kind','text'));
    IF v_input NOT IN ('select','buttons','text') THEN
      RAISE EXCEPTION 'unsupported element kind: %', v_input;
    END IF;
    v_req := coalesce((v_el->>'required')::boolean, false);
    IF v_req AND v_input <> 'text' THEN v_req := false; END IF;   -- Required is a text-field affordance only
    v_key := next_custom_field_key(p_document_id, coalesce(v_el->>'label', v_input));
    INSERT INTO contract_fields (
      org_id, document_id, field_key, label, section, clause_key, owner_role,
      value_type, required, sort_order, input_kind, format_type, options,
      guidance, custom_kind, included)
    VALUES (
      v_org, p_document_id, v_key, coalesce(nullif(btrim(v_el->>'label'),''), 'Entry'),
      v_section_key, v_header_key, 'DEAL',
      CASE WHEN v_input = 'select' THEN 'select' ELSE 'text' END,
      v_req, 0, v_input, CASE WHEN v_input = 'text' THEN 'text' ELSE v_input END,
      CASE WHEN v_input = 'text' THEN NULL ELSE coalesce(v_el->'options','[]'::jsonb) END,
      nullif(btrim(coalesce(v_el->>'placeholder','')), ''), 'element', true);
    v_keys := v_keys || jsonb_build_object(coalesce(v_el->>'id', v_key), v_key);
    v_created := v_created || v_key;
  END LOOP;

  -- ── the content lines ────────────────────────────────────────────────────
  FOR v_ln IN SELECT * FROM jsonb_array_elements(coalesce(p_spec->'lines','[]'::jsonb)) LOOP
    v_line_no := v_line_no + 10;
    v_body := coalesce(v_ln->>'body','');
    v_cond := v_ln->'conditional_on';
    IF v_cond = 'null'::jsonb THEN v_cond := NULL; END IF;
    -- resolve @localId references in both the prose tokens and the gate
    v_cond_txt := v_cond::text;
    FOR r IN SELECT key AS lid, value AS realkey FROM jsonb_each_text(v_keys) LOOP
      v_body := replace(v_body, '{{CUSTOM.@' || r.lid || '}}', '{{' || r.realkey || '}}');
      IF v_cond_txt IS NOT NULL THEN
        v_cond_txt := replace(v_cond_txt, '"@' || r.lid || '"', '"' || r.realkey || '"');
      END IF;
    END LOOP;
    IF v_body ~ '\{\{CUSTOM\.@' THEN
      RAISE EXCEPTION 'line references an element id that was not supplied: %', v_body;
    END IF;
    v_cond := CASE WHEN v_cond_txt IS NULL THEN NULL ELSE v_cond_txt::jsonb END;
    v_key := next_custom_field_key(p_document_id, 'LINE');
    INSERT INTO contract_fields (
      org_id, document_id, field_key, label, section, clause_key, owner_role,
      sort_order, custom_kind, body, conditional_on, guidance, included)
    VALUES (
      v_org, p_document_id, v_key, NULL, v_section_key, v_header_key, 'DEAL',
      v_line_no, 'line', v_body, v_cond,
      nullif(btrim(coalesce(v_ln->>'caption','')), ''), true);
    v_created := v_created || v_key;
  END LOOP;

  PERFORM remerge_contract_from_clauses(p_document_id);
  RETURN jsonb_build_object('section', v_section_key, 'header_key', v_header_key,
                            'element_keys', v_keys, 'created', to_jsonb(v_created));
END;
$function$;
REVOKE ALL ON FUNCTION public.add_contract_composition(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_contract_composition(uuid, jsonb) TO authenticated, service_role;

-- ── 5. Removal: a header takes its lines and elements with it ───────────────
CREATE OR REPLACE FUNCTION public.remove_contract_composition(p_document_id uuid, p_field_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text; v_kind text; v_section text; v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'document is not editable'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to modify this document';
  END IF;

  SELECT custom_kind, section INTO v_kind, v_section FROM contract_fields
   WHERE document_id = p_document_id AND field_key = p_field_key;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'not an author-added item: %', p_field_key; END IF;

  IF v_kind = 'section' THEN
    DELETE FROM contract_fields WHERE document_id = p_document_id
      AND (section = v_section AND custom_kind IS NOT NULL);
  ELSIF v_kind = 'header' THEN
    DELETE FROM contract_fields WHERE document_id = p_document_id
      AND (field_key = p_field_key OR clause_key = p_field_key)
      AND custom_kind IS NOT NULL;
  ELSE
    DELETE FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM remerge_contract_from_clauses(p_document_id);
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_contract_composition(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_contract_composition(uuid, text) TO authenticated, service_role;

-- ── 6. Expose the two new columns to the client ─────────────────────────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'contract_document_detail';
  IF v_src IS NULL THEN RAISE EXCEPTION 'contract_document_detail not found'; END IF;
  IF position('''custom_kind''' in v_src) > 0 THEN RETURN; END IF;   -- already patched
  v_src := replace(v_src,
$old$          'clause_key', cf.clause_key, 'responsibility_kind', cf.responsibility_kind,$old$,
$new$          'clause_key', cf.clause_key, 'responsibility_kind', cf.responsibility_kind,
          'custom_kind', cf.custom_kind, 'body', cf.body,$new$);
  IF position('''custom_kind''' in v_src) = 0 THEN
    RAISE EXCEPTION 'contract_document_detail rewrite did not match its anchor';
  END IF;
  EXECUTE v_src;
END $$;

-- ── 7. The composer reads author-added sections, headers and lines ──────────
/* Three changes to remerge_contract_from_clauses, all additive:
   (a) the SECTION cursor is now template sections UNION author-added sections,
       ordered by the shared x1000 insertion space;
   (b) the CLAUSE cursor is now template clauses UNION author-added headers UNION
       author-added lines — a line sorts immediately under the header it names in
       clause_key, so ONE code path numbers, gates and composes everything and
       the R11 heading rule applies to authored content for free (a header
       numbers, a line is continuation);
   (c) CUSTOM option labels join the label map, and a blank CUSTOM token renders
       'N/A' once the document has left the editable phase (B4). */
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
          IF NOT v_any_token THEN v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE; END IF;
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
$function$;
