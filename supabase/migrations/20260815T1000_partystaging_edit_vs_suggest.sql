-- PARTYSTAGING — document_party_controls.can_edit_deal / can_suggest become
-- the single determinant of how "Add item" behaves, not whether the button
-- shows. Edit-tier applies immediately (staff already worked this way; now
-- any can_edit_deal party does too). Suggest-tier stays pending until the
-- ACTUAL COUNTERPARTY (not staff) resolves it — peer approval, not a
-- staff-brokered one. Same edit-vs-suggest split now also applies to
-- free-text clause proposals (propose_clause), which previously always
-- staged regardless of caller.
--
-- SCOPE NOTE: a suggest-tier proposal must target an EXISTING section and
-- header (no section_new / new header.text) and may not mint new inline
-- elements. This keeps "where does the pending preview render" trivial
-- (anchor = the named header, position = existing-lines-count or a stored
-- line_position) without duplicating add_contract_composition's full
-- position-resolution math at propose time, purely for a preview that
-- becomes authoritative only once accepted. Edit-tier callers are
-- unaffected — they can still create new sections/headers/elements, same
-- as always, since those apply immediately with no preview step.
--
-- Also: contract_fields gains added_by_contact_id (no prior column tracked
-- authorship of a custom row at all), which is what makes "only the author
-- (or staff) may edit/remove an already-added item" enforceable. Existing
-- custom rows backfill to NULL — staff-only until re-touched, a safe
-- default given no authorship was ever recorded for them.

-- ============================================================
-- 1. Schema
-- ============================================================

ALTER TABLE contract_fields
  ADD COLUMN IF NOT EXISTS added_by_contact_id uuid REFERENCES contacts(id);

CREATE TABLE IF NOT EXISTS contract_pending_compositions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id) ON DELETE CASCADE,
  document_id            uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  spec                   jsonb NOT NULL,
  proposed_by_contact_id uuid REFERENCES contacts(id),
  proposed_by_role       text,
  status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','withdrawn')),
  resolved_by_contact_id uuid REFERENCES contacts(id),
  resolved_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_pending_compositions_doc_idx
  ON contract_pending_compositions (document_id, status);

ALTER TABLE contract_pending_compositions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_pending_compositions_read ON contract_pending_compositions;
CREATE POLICY contract_pending_compositions_read ON contract_pending_compositions
  FOR SELECT TO authenticated
  USING ((org_id = current_org() AND has_staff_access()) OR caller_is_document_party(document_id));
-- all writes go through SECURITY DEFINER RPCs
REVOKE ALL ON contract_pending_compositions FROM authenticated, anon;

-- ============================================================
-- 2. caller_may_propose gains 'edit_deal'; caller_may_resolve is new
--    (the actual peer-approval change: any document party who is NOT the
--    proposer may resolve, in addition to staff/originator)
-- ============================================================

CREATE OR REPLACE FUNCTION caller_may_propose(p_document_id uuid, p_control text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_ok boolean;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF (has_staff_access() AND v_org = current_org()) OR contract_caller_is_originator(p_document_id) THEN
    RETURN true;
  END IF;
  SELECT bool_or(CASE p_control WHEN 'suggest' THEN coalesce(c.can_suggest,false)
                                WHEN 'add_clause' THEN coalesce(c.can_add_clause,false)
                                WHEN 'edit_deal' THEN coalesce(c.can_edit_deal,false)
                                ELSE false END)
    INTO v_ok
    FROM document_parties dp
    LEFT JOIN document_party_controls c ON c.document_id = dp.document_id AND c.party_role = dp.party_role
    WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id();
  RETURN coalesce(v_ok, false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.caller_may_resolve(p_document_id uuid, p_proposed_by_contact_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  RETURN (has_staff_access() AND v_org = current_org())
    OR contract_caller_is_originator(p_document_id)
    OR (caller_is_document_party(p_document_id) AND current_contact_id() <> p_proposed_by_contact_id);
END;
$fn$;

-- ============================================================
-- 3. add_contract_composition split into an internal apply helper (no auth
--    check — callers are responsible for having already authorized) plus a
--    thin wrapper carrying the tightened edit-tier auth. This is what lets
--    resolve_pending_composition (peer-approved, not the proposer) and
--    update_contract_composition (author-approved) reuse the exact same
--    apply logic without duplicating it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_contract_composition_spec(
  p_document_id uuid, p_spec jsonb, p_added_by uuid)
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
  v_line_pos int; v_existing text[]; v_before int; v_i int;
  r record;
BEGIN
  SELECT d.org_id, d.workflow_state, ct.template_key INTO v_org, v_state, v_tkey
    FROM documents d LEFT JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing','in_review') THEN RAISE EXCEPTION 'document is not editable'; END IF;

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
                                 owner_role, sort_order, custom_kind, included, added_by_contact_id)
    VALUES (v_org, p_document_id, next_custom_field_key(p_document_id, v_section_key),
            v_section_key, v_section_key, 'DEAL', round(v_ord)::int, 'section', true, p_added_by);
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
                                 owner_role, sort_order, custom_kind, included, added_by_contact_id)
    VALUES (v_org, p_document_id, v_header_key, v_header_new, v_section_key,
            'DEAL', round(v_ord)::int, 'header', true, p_added_by);
    v_created := v_created || v_header_key;
  END IF;

  -- ── the inline elements (minted first, so lines can reference their keys) ─
  FOR v_el IN SELECT * FROM jsonb_array_elements(coalesce(p_spec->'elements','[]'::jsonb)) LOOP
    v_input := lower(coalesce(v_el->>'kind','text'));
    IF v_input NOT IN ('select','buttons','text') THEN
      RAISE EXCEPTION 'unsupported element kind: %', v_input;
    END IF;
    v_req := coalesce((v_el->>'required')::boolean, false);
    IF v_req AND v_input <> 'text' THEN v_req := false; END IF;
    v_key := next_custom_field_key(p_document_id, coalesce(v_el->>'label', v_input));
    INSERT INTO contract_fields (
      org_id, document_id, field_key, label, section, clause_key, owner_role,
      value_type, required, sort_order, input_kind, format_type, options,
      guidance, custom_kind, included, added_by_contact_id)
    VALUES (
      v_org, p_document_id, v_key, coalesce(nullif(btrim(v_el->>'label'),''), 'Entry'),
      v_section_key, v_header_key, 'DEAL',
      CASE WHEN v_input = 'select' THEN 'select' ELSE 'text' END,
      v_req, 0, v_input, CASE WHEN v_input = 'text' THEN 'text' ELSE v_input END,
      CASE WHEN v_input = 'text' THEN NULL ELSE coalesce(v_el->'options','[]'::jsonb) END,
      nullif(btrim(coalesce(v_el->>'placeholder','')), ''), 'element', true, p_added_by);
    v_keys := v_keys || jsonb_build_object(coalesce(v_el->>'id', v_key), v_key);
    v_created := v_created || v_key;
  END LOOP;

  v_line_pos := (p_spec#>>'{header,line_position}')::int;
  SELECT coalesce(array_agg(field_key ORDER BY sort_order, field_key), '{}'::text[])
    INTO v_existing
    FROM contract_fields
   WHERE document_id = p_document_id AND custom_kind = 'line' AND clause_key = v_header_key;

  v_before := CASE
    WHEN v_line_pos IS NULL OR v_line_pos > coalesce(array_length(v_existing,1),0)
      THEN coalesce(array_length(v_existing,1),0)
    ELSE greatest(v_line_pos - 1, 0) END;

  FOR v_i IN 1..v_before LOOP
    v_line_no := v_line_no + 10;
    UPDATE contract_fields SET sort_order = v_line_no
     WHERE document_id = p_document_id AND field_key = v_existing[v_i];
  END LOOP;

  FOR v_ln IN SELECT * FROM jsonb_array_elements(coalesce(p_spec->'lines','[]'::jsonb)) LOOP
    v_line_no := v_line_no + 10;
    v_body := coalesce(v_ln->>'body','');
    v_cond := v_ln->'conditional_on';
    IF v_cond = 'null'::jsonb THEN v_cond := NULL; END IF;
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
      sort_order, custom_kind, body, conditional_on, guidance, included, added_by_contact_id)
    VALUES (
      v_org, p_document_id, v_key, NULL, v_section_key, v_header_key, 'DEAL',
      v_line_no, 'line', v_body, v_cond,
      nullif(btrim(coalesce(v_ln->>'caption','')), ''), true, p_added_by);
    v_created := v_created || v_key;
  END LOOP;

  FOR v_i IN v_before + 1 .. coalesce(array_length(v_existing,1),0) LOOP
    v_line_no := v_line_no + 10;
    UPDATE contract_fields SET sort_order = v_line_no
     WHERE document_id = p_document_id AND field_key = v_existing[v_i];
  END LOOP;

  PERFORM remerge_contract_from_clauses(p_document_id);
  RETURN jsonb_build_object('section', v_section_key, 'header_key', v_header_key,
                            'element_keys', v_keys, 'created', to_jsonb(v_created));
END;
$function$;
-- Internal only — no auth check inside, so it must never be directly
-- callable by a client. Reachable only via the SECURITY DEFINER wrappers
-- below, which run it under the function owner regardless of grants here.
REVOKE ALL ON FUNCTION public.apply_contract_composition_spec(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_contract_composition(p_document_id uuid, p_spec jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT caller_may_propose(p_document_id, 'edit_deal') THEN
    RAISE EXCEPTION 'not authorized to modify this document';
  END IF;
  RETURN apply_contract_composition_spec(p_document_id, p_spec, current_contact_id());
END;
$function$;
REVOKE ALL ON FUNCTION public.add_contract_composition(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_contract_composition(uuid, jsonb) TO authenticated, service_role;

-- ============================================================
-- 4. propose_contract_composition — suggest-tier's staged path. Restricted
--    to an existing section+header and no new elements (see file header).
-- ============================================================

CREATE OR REPLACE FUNCTION public.propose_contract_composition(p_document_id uuid, p_spec jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text; v_me uuid := current_contact_id(); v_role text; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT caller_may_propose(p_document_id, 'suggest') THEN
    RAISE EXCEPTION 'not permitted to suggest an item';
  END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing','in_review') THEN RAISE EXCEPTION 'the document is not open for changes'; END IF;

  IF coalesce((p_spec->>'section_new')::boolean, false)
     OR nullif(btrim(coalesce(p_spec#>>'{header,clause_key}','')), '') IS NULL
     OR jsonb_array_length(coalesce(p_spec->'elements','[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'a suggested item must go into an existing section and item, with no new questions — create new sections/items directly if you have edit access';
  END IF;

  SELECT party_role INTO v_role FROM document_parties WHERE document_id = p_document_id AND contact_id = v_me LIMIT 1;

  INSERT INTO contract_pending_compositions (org_id, document_id, spec, proposed_by_contact_id, proposed_by_role, status)
    VALUES (v_org, p_document_id, p_spec, v_me, v_role, 'open')
    RETURNING id INTO v_id;

  PERFORM redline_notify(p_document_id, 'contract_item_proposed', 'A new item was suggested on ');
  RETURN jsonb_build_object('pending_id', v_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.propose_contract_composition(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_contract_composition(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_pending_composition(p_pending_id uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_spec jsonb; v_proposer uuid; v_applied jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_decision NOT IN ('include','reject') THEN RAISE EXCEPTION 'unknown decision: %', p_decision; END IF;

  SELECT document_id, spec, proposed_by_contact_id INTO v_doc, v_spec, v_proposer
    FROM contract_pending_compositions WHERE id = p_pending_id AND status = 'open';
  IF v_doc IS NULL THEN RAISE EXCEPTION 'that item is already resolved'; END IF;
  IF NOT caller_may_resolve(v_doc, v_proposer) THEN
    RAISE EXCEPTION 'not authorized to resolve this item';
  END IF;

  IF p_decision = 'include' THEN
    v_applied := apply_contract_composition_spec(v_doc, v_spec, v_proposer);
    UPDATE contract_pending_compositions
       SET status = 'accepted', resolved_by_contact_id = current_contact_id(), resolved_at = now()
     WHERE id = p_pending_id;
  ELSE
    UPDATE contract_pending_compositions
       SET status = 'rejected', resolved_by_contact_id = current_contact_id(), resolved_at = now()
     WHERE id = p_pending_id;
  END IF;

  PERFORM redline_notify(p_document_id := v_doc, p_kind := 'contract_item_resolved',
    p_prefix := CASE WHEN p_decision = 'include' THEN 'A suggested item was included on '
                      ELSE 'A suggested item was rejected on ' END);
  RETURN jsonb_build_object('decision', p_decision, 'applied', v_applied);
END;
$function$;
REVOKE ALL ON FUNCTION public.resolve_pending_composition(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_pending_composition(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.withdraw_pending_composition(p_pending_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  UPDATE contract_pending_compositions SET status = 'withdrawn', resolved_at = now()
   WHERE id = p_pending_id AND status = 'open' AND proposed_by_contact_id = current_contact_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'no open item of yours to withdraw'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.withdraw_pending_composition(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_pending_composition(uuid) TO authenticated, service_role;

-- ============================================================
-- 5. Author-only edit/remove of an already-added item
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_contract_composition_item(p_document_id uuid, p_field_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_kind text; v_section text; v_n int;
BEGIN
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
  RETURN v_n;
END;
$fn$;
REVOKE ALL ON FUNCTION public.delete_contract_composition_item(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.remove_contract_composition(p_document_id uuid, p_field_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text; v_author uuid; v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing','in_review') THEN RAISE EXCEPTION 'document is not editable'; END IF;

  SELECT added_by_contact_id INTO v_author FROM contract_fields
   WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'not an author-added item: %', p_field_key; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR (v_author IS NOT NULL AND v_author = current_contact_id())) THEN
    RAISE EXCEPTION 'only the item''s author or staff may remove it';
  END IF;

  v_n := delete_contract_composition_item(p_document_id, p_field_key);
  PERFORM remerge_contract_from_clauses(p_document_id);
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_contract_composition(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_contract_composition(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_contract_composition(p_document_id uuid, p_field_key text, p_spec jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text; v_author uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable','editing','in_review') THEN RAISE EXCEPTION 'document is not editable'; END IF;

  SELECT added_by_contact_id INTO v_author FROM contract_fields
   WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'not an author-added item: %', p_field_key; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR (v_author IS NOT NULL AND v_author = current_contact_id())) THEN
    RAISE EXCEPTION 'only the item''s author or staff may edit it';
  END IF;

  PERFORM delete_contract_composition_item(p_document_id, p_field_key);
  -- next_custom_field_key mints a fresh key for the replacement content, so
  -- the edited item's field_key changes — an accepted tradeoff of reapplying
  -- through the same apply path rather than a bespoke in-place patch.
  RETURN apply_contract_composition_spec(p_document_id, p_spec, coalesce(v_author, current_contact_id()));
END;
$function$;
REVOKE ALL ON FUNCTION public.update_contract_composition(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_contract_composition(uuid, text, jsonb) TO authenticated, service_role;

-- ============================================================
-- 6. Peer approval on the existing field-edit and clause redline RPCs, and
--    edit-tier auto-apply on propose_clause (mirrors add_contract_composition
--    now applying directly for edit-tier instead of always staging).
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_field_edit(p_document_id uuid, p_field_key text, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_pv text; v_pby uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT proposed_value, proposed_by_contact_id INTO v_pv, v_pby
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF v_pby IS NULL THEN RAISE EXCEPTION 'no pending proposal on that field'; END IF;
  IF NOT caller_may_resolve(p_document_id, v_pby) THEN
    RAISE EXCEPTION 'not authorized to resolve this proposal';
  END IF;

  IF p_accept THEN
    UPDATE contract_fields
       SET value = v_pv, entered_by_contact_id = v_pby, entered_at = now(),
           proposed_value = NULL, proposed_by_contact_id = NULL, proposed_at = NULL, updated_at = now()
     WHERE document_id = p_document_id AND field_key = p_field_key;
  ELSE
    UPDATE contract_fields
       SET proposed_value = NULL, proposed_by_contact_id = NULL, proposed_at = NULL
     WHERE document_id = p_document_id AND field_key = p_field_key;
  END IF;
  RETURN jsonb_build_object('accepted', p_accept);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.rebuild_additional_terms(p_document_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_org uuid; v_terms text := ''; r record;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  FOR r IN SELECT body, row_number() OVER (ORDER BY item_number) AS n
             FROM contract_addenda WHERE document_id = p_document_id AND status = 'accepted' ORDER BY item_number LOOP
    v_terms := v_terms || 'A-' || r.n || '. ' || r.body || E'\n\n';
  END LOOP;
  IF v_terms <> '' THEN
    v_terms := E'28. ADDITIONAL TERMS\n\nThe following additional terms have been agreed by the parties:\n\n' || btrim(v_terms);
  END IF;
  INSERT INTO contract_fields (org_id, document_id, field_key, label, section, owner_role, value, value_type, sort_order)
    VALUES (v_org, p_document_id, 'TXN.ADDITIONAL_TERMS', 'Additional Terms', 'Additional Terms', 'DEAL',
            nullif(v_terms,''), 'longtext', 900)
  ON CONFLICT (document_id, field_key) DO UPDATE SET value = excluded.value, updated_at = now();
END;
$fn$;
REVOKE ALL ON FUNCTION public.rebuild_additional_terms(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION resolve_clause(p_addendum_id uuid, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_doc uuid; v_proposer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id, proposed_by_contact_id INTO v_doc, v_proposer FROM contract_addenda WHERE id = p_addendum_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown addendum'; END IF;
  IF NOT caller_may_resolve(v_doc, v_proposer) THEN
    RAISE EXCEPTION 'not authorized to resolve this clause';
  END IF;

  UPDATE contract_addenda
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
         resolved_by_contact_id = current_contact_id(), resolved_at = now()
   WHERE id = p_addendum_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'that clause is already resolved'; END IF;

  PERFORM rebuild_additional_terms(v_doc);
  RETURN jsonb_build_object('accepted', p_accept);
END;
$fn$;

CREATE OR REPLACE FUNCTION propose_clause(p_document_id uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_state text; v_me uuid := current_contact_id(); v_num int; v_role text; v_id uuid; v_direct boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NULLIF(btrim(coalesce(p_body,'')),'') IS NULL THEN RAISE EXCEPTION 'the clause text is empty'; END IF;
  IF NOT caller_may_propose(p_document_id, 'add_clause') THEN RAISE EXCEPTION 'not permitted to add a clause'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_state NOT IN ('editable','editing','in_review') THEN RAISE EXCEPTION 'the document is not open for changes'; END IF;

  SELECT coalesce(max(item_number),0)+1 INTO v_num FROM contract_addenda WHERE document_id = p_document_id;
  SELECT party_role INTO v_role FROM document_parties WHERE document_id = p_document_id AND contact_id = v_me LIMIT 1;
  v_direct := caller_may_propose(p_document_id, 'edit_deal');

  INSERT INTO contract_addenda (org_id, document_id, item_number, body, proposed_by_contact_id, proposed_by_role,
                                status, resolved_by_contact_id, resolved_at)
    VALUES (v_org, p_document_id, v_num, btrim(p_body), v_me, v_role,
            CASE WHEN v_direct THEN 'accepted' ELSE 'open' END,
            CASE WHEN v_direct THEN v_me ELSE NULL END,
            CASE WHEN v_direct THEN now() ELSE NULL END)
    RETURNING id INTO v_id;

  IF v_direct THEN
    PERFORM rebuild_additional_terms(p_document_id);
  ELSE
    PERFORM redline_notify(p_document_id, 'contract_clause_proposed', 'A new clause was proposed on ');
  END IF;
  RETURN jsonb_build_object('addendum_id', v_id, 'item_number', v_num, 'applied', v_direct);
END;
$fn$;

-- ============================================================
-- 7. contract_redline_state gains pending_compositions + can_edit_deal
-- ============================================================

CREATE OR REPLACE FUNCTION contract_redline_state(p_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized for this document';
  END IF;

  RETURN jsonb_build_object(
    'field_proposals', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
          'field_key', cf.field_key, 'label', cf.label,
          'current_value', cf.value, 'proposed_value', cf.proposed_value,
          'proposed_by', nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'mine', cf.proposed_by_contact_id = current_contact_id(),
          'proposed_at', cf.proposed_at) ORDER BY cf.sort_order), '[]'::jsonb)
      FROM contract_fields cf
      LEFT JOIN contacts c ON c.id = cf.proposed_by_contact_id
      WHERE cf.document_id = p_document_id AND cf.proposed_by_contact_id IS NOT NULL
    ),
    'addenda', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'item_number', a.item_number, 'body', a.body, 'status', a.status,
          'proposed_by_role', a.proposed_by_role,
          'proposed_by', nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'mine', a.proposed_by_contact_id = current_contact_id(),
          'created_at', a.created_at) ORDER BY a.item_number), '[]'::jsonb)
      FROM contract_addenda a
      LEFT JOIN contacts c ON c.id = a.proposed_by_contact_id
      WHERE a.document_id = p_document_id AND a.status IN ('open','accepted')
    ),
    'pending_compositions', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', pc.id, 'spec', pc.spec, 'status', pc.status,
          'proposed_by_role', pc.proposed_by_role,
          'proposed_by', nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'mine', pc.proposed_by_contact_id = current_contact_id(),
          'created_at', pc.created_at) ORDER BY pc.created_at), '[]'::jsonb)
      FROM contract_pending_compositions pc
      LEFT JOIN contacts c ON c.id = pc.proposed_by_contact_id
      WHERE pc.document_id = p_document_id AND pc.status IN ('open','rejected')
    ),
    'can_suggest', caller_may_propose(p_document_id, 'suggest'),
    'can_add_clause', caller_may_propose(p_document_id, 'add_clause'),
    'can_edit_deal', caller_may_propose(p_document_id, 'edit_deal')
  );
END;
$fn$;

-- ============================================================
-- 8. Expose added_by_contact_id via contract_document_detail — same
--    replace-patch pattern used previously to add custom_kind/body, so the
--    whole (very large) function doesn't need reproducing here.
-- ============================================================

DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'contract_document_detail';
  IF v_src IS NULL THEN RAISE EXCEPTION 'contract_document_detail not found'; END IF;
  IF position('''added_by_me''' in v_src) > 0 THEN RETURN; END IF;   -- already patched
  v_src := replace(v_src,
$old$          'custom_kind', cf.custom_kind, 'body', cf.body,$old$,
$new$          'custom_kind', cf.custom_kind, 'body', cf.body,
          'added_by_contact_id', cf.added_by_contact_id,
          'added_by_me', cf.added_by_contact_id IS NOT NULL AND cf.added_by_contact_id = current_contact_id(),$new$);
  IF position('''added_by_me''' in v_src) = 0 THEN
    RAISE EXCEPTION 'contract_document_detail rewrite did not match its anchor';
  END IF;
  EXECUTE v_src;
END $$;
