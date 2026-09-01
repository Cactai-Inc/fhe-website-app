-- REGENERATION MUST CARRY THE MULTI-HORSE SET FORWARD.
--
-- THE PROBLEM
-- generate_my_onboarding_documents soft-deletes every non-EXECUTED copy and
-- regenerates from the CURRENT template version (deliberate — it is how a member
-- with stale pre-generated drafts gets today's wording, and it must keep
-- holding). But it regenerates through generate_document with a SINGLE horse.
-- Left alone, a member who bound two horses and then triggered any regeneration
-- (going back and re-saving their details, say) would silently drop back to one
-- horse on the releases.
--
-- THE FIX — bind BEFORE composing, so there is exactly ONE composition pass.
-- generate_document reads document_horse_ids(v_doc_id) after INSERTing the
-- documents row and before seeding the body. So the extra horses only need to
-- be present at that instant. generate_document gains an optional trailing
-- p_horse_ids argument: when supplied with more than one id it writes the join
-- rows immediately after the INSERT, and its existing expander call then sees
-- the full set. No recomposition, no second pass, no token copying.

-- ── generate_document: accept the full ordered horse set ────────────────────
DO $$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_document'
      AND pg_get_function_identity_arguments(p.oid) NOT LIKE '%p_horse_ids%'
    LIMIT 1;
  IF v_src IS NULL THEN RAISE EXCEPTION 'single-arg generate_document not found'; END IF;

  -- widen the signature with a defaulted trailing argument (every existing
  -- caller keeps working untouched — they simply do not pass it)
  v_new := replace(v_src,
    'p_parties jsonb, p_service_type text)',
    'p_parties jsonb, p_service_type text, p_horse_ids uuid[] DEFAULT NULL)');
  IF v_new = v_src THEN RAISE EXCEPTION 'signature anchor not found'; END IF;
  v_src := v_new;

  -- right after the documents INSERT, materialise the full set so the expander
  -- (already wired in, reading document_horse_ids) sees every horse.
  v_new := replace(v_src,
    '    RETURNING id, display_code INTO v_doc_id, v_doc_code;',
    '    RETURNING id, display_code INTO v_doc_id, v_doc_code;' || E'\n\n' ||
    '  -- MULTI-HORSE: bind the full ordered set NOW, before the body is composed,' || E'\n' ||
    '  -- so the expander below sees every horse on this one pass. One id (or' || E'\n' ||
    '  -- none) changes nothing — the single-horse path is untouched.' || E'\n' ||
    '  IF coalesce(array_length(p_horse_ids, 1), 0) > 1 THEN' || E'\n' ||
    '    DELETE FROM document_horses WHERE document_id = v_doc_id;' || E'\n' ||
    '    INSERT INTO document_horses (org_id, document_id, horse_id, position)' || E'\n' ||
    '      SELECT v_org_id, v_doc_id, p_horse_ids[i], i' || E'\n' ||
    '        FROM generate_subscripts(p_horse_ids, 1) AS i' || E'\n' ||
    '      ON CONFLICT (document_id, horse_id) DO UPDATE SET position = EXCLUDED.position;' || E'\n' ||
    '  END IF;');
  IF v_new = v_src THEN RAISE EXCEPTION 'documents INSERT anchor not found'; END IF;

  EXECUTE v_new;
  RAISE NOTICE 'generate_document now accepts p_horse_ids';
END $$;

-- ── generate_my_onboarding_documents: capture + replay the set ──────────────
DO $$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_my_onboarding_documents'
    LIMIT 1;
  IF v_src IS NULL THEN RAISE EXCEPTION 'generate_my_onboarding_documents not found'; END IF;

  IF position('v_keep_horses' in v_src) = 0 THEN
    v_new := replace(v_src,
      '  v_title   text;',
      '  v_title   text;' || E'\n' ||
      '  v_keep_horses uuid[];   -- the member''s bound horse set for this template');
    IF v_new = v_src THEN RAISE EXCEPTION 'decl anchor not found'; END IF;
    v_src := v_new;

    -- Capture the set BEFORE the soft-delete (document ids change on
    -- regeneration, so it is captured per template key), then pass it to
    -- generate_document so the fresh copy is bound to the same horses.
    v_new := replace(v_src,
      '      UPDATE documents d SET deleted_at = now()',
      '      -- carry the member''s multi-horse choice across regeneration' || E'\n' ||
      '      SELECT dh.horses INTO v_keep_horses FROM (' || E'\n' ||
      '        SELECT array_agg(x.horse_id ORDER BY x.position) AS horses' || E'\n' ||
      '          FROM documents d2' || E'\n' ||
      '          JOIN contract_templates t2 ON t2.id = d2.template_id' || E'\n' ||
      '          JOIN document_horses x ON x.document_id = d2.id' || E'\n' ||
      '         WHERE d2.contact_id = v_contact AND t2.template_key = req.template_key' || E'\n' ||
      '           AND d2.deleted_at IS NULL AND d2.status <> ''EXECUTED''' || E'\n' ||
      '      ) dh;' || E'\n\n' ||
      '      UPDATE documents d SET deleted_at = now()');
    IF v_new = v_src THEN RAISE EXCEPTION 'soft-delete anchor not found'; END IF;
    v_src := v_new;

    v_new := replace(v_src,
      'FROM generate_document(v_contact, req.template_key, NULL::uuid, v_horse, v_parties, NULL::text) g;',
      'FROM generate_document(v_contact, req.template_key, NULL::uuid,' || E'\n' ||
      '             coalesce(v_keep_horses[1], v_horse), v_parties, NULL::text,' || E'\n' ||
      '             v_keep_horses) g;');
    IF v_new = v_src THEN RAISE EXCEPTION 'generate_document call anchor not found'; END IF;
    v_src := v_new;

    -- reset per iteration so one template's set never leaks into the next
    v_new := replace(v_src,
      '    v_doc := NULL; v_status := NULL; v_title := NULL;',
      '    v_doc := NULL; v_status := NULL; v_title := NULL; v_keep_horses := NULL;');
    IF v_new = v_src THEN RAISE EXCEPTION 'reset anchor not found'; END IF;
    v_src := v_new;
  END IF;

  EXECUTE v_src;
  RAISE NOTICE 'generate_my_onboarding_documents preserves the multi-horse set';
END $$;
