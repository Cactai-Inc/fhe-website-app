-- ─────────────────────────────────────────────────────────────────────────────
-- OWNER-FINAL 4 — CHANGE-LOG SECTION ATTRIBUTION.
-- "Every section that has a number imports that number into the change log."
--
-- THE PROBLEM, MEASURED AGAINST PROD BEFORE WRITING THIS:
--   contract_change_log holds 178 rows across 2 documents. EVERY row's field_key
--   begins with the token `TXN.` — e.g. TXN.GL_DED_RESP, TXN.EVALUATION_ENABLED.
--   The client attributed a row by splitting field_key on '.' and looking the
--   leading token up in the section tree. `TXN` is not a section_key, so the
--   lookup missed and the row rendered with NO section label. On document
--   5dbce25f… that is 108 of 108 rows unattributed. The SECTION.FIELD convention
--   the previous batch assumed simply is not how these keys are shaped.
--
--   The real owning section is not in the key at all — it is on the FIELD:
--     contract_fields.section    (e.g. INSURANCE_RISK) and
--     contract_fields.clause_key (e.g. INSURANCE_RISK.MAJOR_MEDICAL).
--   That resolves 155 of the 178 rows.
--
--   The remaining 23 rows (9 distinct keys) belong to fields that have since been
--   REMOVED from the live document by the insurance rebuild and the evaluation
--   rework — TXN.GL_POSTURE, TXN.MED_COVERAGE, TXN.MORT_ELECTED,
--   TXN.MORT_PREM_RESP, TXN.MORT_EFFECTIVE_DATE, TXN.EVALUATION_FEE_MODE,
--   TXN.EVALUATION_FEE_AMOUNT, TXN.EVALUATION_LENGTH, TXN.EVALUATION_UNIT.
--   They are absent from contract_fields AND from contract_field_defs, so no join
--   can find them. Their identity is unambiguous from the key stem, and the
--   change log is EVIDENCE — a retired field's history must stay readable — so
--   they are attributed by a small, explicit, documented stem map rather than
--   left blank.
--
-- THE RESOLUTION LADDER (first hit wins), all of it server-side so the client
-- never guesses:
--   1. contract_fields.clause_key  — the live field on THIS document
--   2. contract_fields.section     — same, section granularity
--   3. contract_field_defs.clause_key / .section for the document's template
--   4. the leading key token, when it really is a section_key (the documented
--      SECTION.FIELD convention, honoured where it applies)
--   5. the retired-stem map above
--   Anything still unresolved returns NULL and is reported as such.
--
-- NUMBERING comes from contract_section_tree — the same function the composer
-- agrees with — so the number on a change-log row is the number the reader sees
-- in the document. Nothing is hardcoded.
--
-- BUNDLING CHOICE (owner offered either; stated here): changes are BUNDLED under
-- their section, shown once. Rendering the number on all 108 individually turned
-- the panel into a column of repeated "12."; grouping gives one numbered section
-- header ("12. Permitted Use(s) & Restrictions — 9 changes") with the changes
-- nested under it, which is what makes the owner's in-context reading
-- ("Lessee is permitted to do the following: X[trail-riding], +[jumping]") legible.
-- Each row still carries its own subsection number where it has one, so the
-- bundle never loses precision.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── the retired-stem map ─────────────────────────────────────────────────────
-- Deliberately a FUNCTION, not a table: it is a fixed historical fact set about
-- keys that no longer exist and can never grow at runtime.
CREATE OR REPLACE FUNCTION public.retired_field_section(p_field_key text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- removed by 20260729021000_lease_insurance_rebuild
    WHEN p_field_key IN ('TXN.GL_POSTURE','TXN.MED_COVERAGE','TXN.MORT_ELECTED',
                         'TXN.MORT_PREM_RESP','TXN.MORT_EFFECTIVE_DATE')
      THEN 'INSURANCE_RISK'
    -- removed by 20260729020000_lease_eval_lessons_restrictions_others
    WHEN p_field_key IN ('TXN.EVALUATION_FEE_MODE','TXN.EVALUATION_FEE_AMOUNT',
                         'TXN.EVALUATION_LENGTH','TXN.EVALUATION_UNIT')
      THEN 'EVALUATION'
    ELSE NULL
  END;
$function$;

COMMENT ON FUNCTION public.retired_field_section(text) IS
  'Owning section for change-log field keys whose field has since been removed '
  'from the template (insurance rebuild / evaluation rework). The change log is '
  'evidence, so a retired field''s history must still be attributable.';

-- ── change_log_section_key — the resolution ladder ───────────────────────────
-- Returns the best (section_key, clause_key) for one change-log row.
CREATE OR REPLACE FUNCTION public.change_log_section_key(
  p_document_id uuid, p_field_key text,
  OUT section_key text, OUT clause_key text)
RETURNS record
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $function$
DECLARE v_tkey text; v_head text;
BEGIN
  section_key := NULL; clause_key := NULL;
  IF p_field_key IS NULL OR trim(p_field_key) = '' THEN RETURN; END IF;

  -- 1 + 2 — the live field on this document
  SELECT nullif(trim(cf.section),''), nullif(trim(cf.clause_key),'')
    INTO section_key, clause_key
    FROM contract_fields cf
   WHERE cf.document_id = p_document_id AND cf.field_key = p_field_key
   LIMIT 1;
  IF section_key IS NOT NULL OR clause_key IS NOT NULL THEN RETURN; END IF;

  SELECT ct.template_key INTO v_tkey
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id;

  -- 3 — the template definition
  IF v_tkey IS NOT NULL THEN
    SELECT nullif(trim(fd.section),''), nullif(trim(fd.clause_key),'')
      INTO section_key, clause_key
      FROM contract_field_defs fd
     WHERE fd.template_key = v_tkey AND fd.field_key = p_field_key
     LIMIT 1;
    IF section_key IS NOT NULL OR clause_key IS NOT NULL THEN RETURN; END IF;

    -- 4 — the SECTION.FIELD convention, where the key really follows it
    v_head := split_part(p_field_key, '.', 1);
    IF EXISTS (SELECT 1 FROM contract_section_defs sd
                WHERE sd.template_key = v_tkey AND sd.section_key = v_head) THEN
      section_key := v_head;
      RETURN;
    END IF;
  END IF;

  -- 5 — retired keys, attributed from their documented stem
  section_key := retired_field_section(p_field_key);
END;
$function$;

-- ── contract_change_log_list — every row arrives already attributed ──────────
-- The client no longer parses keys. It receives section_key / clause_key AND the
-- live NUMBER + TITLE from contract_section_tree, so the log always agrees with
-- the composed document.
CREATE OR REPLACE FUNCTION public.contract_change_log_list(
  p_document_id uuid, p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_tree jsonb; v_num jsonb := '{}'::jsonb; v_ttl jsonb := '{}'::jsonb;
  s jsonb; sub jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  -- numbering straight from the composer-agreeing tree
  v_tree := contract_section_tree(p_document_id);
  FOR s IN SELECT jsonb_array_elements(v_tree) LOOP
    v_num := v_num || jsonb_build_object(s->>'section_key', s->>'number');
    v_ttl := v_ttl || jsonb_build_object(s->>'section_key', s->>'title');
    FOR sub IN SELECT jsonb_array_elements(s->'subsections') LOOP
      v_num := v_num || jsonb_build_object(sub->>'clause_key', sub->>'number');
      v_ttl := v_ttl || jsonb_build_object(sub->>'clause_key', sub->>'title');
    END LOOP;
  END LOOP;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC)
    FROM (
      SELECT cl.id, cl.change_kind, cl.field_key, cl.field_label, cl.owner_role,
             cl.old_value, cl.new_value, cl.detail, cl.actor_label, cl.actor_roles,
             cl.actor_is_staff, cl.created_at,
             r.section_key, r.clause_key,
             -- the SECTION number/title this row bundles under
             (v_num ->> r.section_key)  AS section_number,
             (v_ttl ->> r.section_key)  AS section_title,
             -- the finer subsection number, when the row resolves that far
             (v_num ->> r.clause_key)   AS clause_number,
             (v_ttl ->> r.clause_key)   AS clause_title
        FROM contract_change_log cl
        CROSS JOIN LATERAL change_log_section_key(cl.document_id, cl.field_key) r
       WHERE cl.document_id = p_document_id
       ORDER BY cl.created_at DESC
       LIMIT greatest(1, least(p_limit, 1000))
    ) t
  ), '[]'::jsonb);
END;
$function$;

COMMENT ON FUNCTION public.contract_change_log_list(uuid, integer) IS
  'Change log with SERVER-SIDE section attribution. Each row carries its resolved '
  'section_key/clause_key plus the live number+title from contract_section_tree, so '
  'the log''s numbering always matches the composed document. Attribution ladder: '
  'contract_fields → contract_field_defs → SECTION.FIELD key convention → '
  'retired_field_section.';

COMMIT;
