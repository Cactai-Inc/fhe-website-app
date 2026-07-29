-- WIRE THE MULTI-HORSE EXPANDER INTO generate_document.
--
-- generate_document merges HORSE.* straight into the body at generation time
-- (these onboarding documents carry ZERO contract_fields rows — verified: the
-- six documents on the live acceptance contact have none). So the expansion has
-- to happen HERE, before the per-token loop.
--
-- The change is surgical and additive:
--   1. resolve the document's ordered horse set (document_horse_ids), which for
--      a freshly generated document is exactly [p_horse_id] or empty;
--   2. when the set has MORE THAN ONE horse, run expand_horse_blocks over the
--      body FIRST — that consumes and fills every HORSE.* token;
--   3. the existing per-token loop then runs unchanged. With >1 horse it finds
--      no HORSE.* tokens left (they are already filled), so its HORSE branch is
--      a no-op. With 0 or 1 horse nothing is pre-expanded and the loop behaves
--      EXACTLY as before — the single-horse path is untouched, by construction.
--
-- This is why single-horse output is provably unchanged: for one horse we do
-- not call the expander at all.

DO $$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_document'
    LIMIT 1;
  IF v_src IS NULL THEN RAISE EXCEPTION 'generate_document not found'; END IF;

  -- declare the horse-set variable alongside the existing horse locals
  IF position('v_horse_ids uuid[]' in v_src) = 0 THEN
    v_new := replace(v_src,
      '  v_horse   horses%ROWTYPE;',
      '  v_horse   horses%ROWTYPE;' || E'\n' ||
      '  v_horse_ids uuid[];        -- the ordered multi-horse set (Stage: multi-horse)');
    IF v_new = v_src THEN RAISE EXCEPTION 'anchor 1 (v_horse decl) not found'; END IF;
    v_src := v_new;
  END IF;

  -- after the body is seeded from the template, expand the horse blocks when
  -- this document names more than one horse.
  IF position('expand_horse_blocks' in v_src) = 0 THEN
    v_new := replace(v_src,
      '  v_body := v_tmpl.body;',
      '  v_body := v_tmpl.body;' || E'\n\n' ||
      '  -- MULTI-HORSE: when this document names more than one horse, expand every' || E'\n' ||
      '  -- contiguous run of HORSE.*-token lines into one filled copy per horse' || E'\n' ||
      '  -- BEFORE the token loop. One horse (or none) skips this entirely, so the' || E'\n' ||
      '  -- single-horse body is byte-for-byte what it has always been.' || E'\n' ||
      '  v_horse_ids := document_horse_ids(v_doc_id);' || E'\n' ||
      '  IF coalesce(array_length(v_horse_ids, 1), 0) > 1 THEN' || E'\n' ||
      '    v_body := expand_horse_blocks(v_body, v_horse_ids);' || E'\n' ||
      '  END IF;');
    IF v_new = v_src THEN RAISE EXCEPTION 'anchor 2 (v_body seed) not found'; END IF;
    v_src := v_new;
  END IF;

  EXECUTE v_src;
  RAISE NOTICE 'generate_document rewritten with the multi-horse expander';
END $$;
