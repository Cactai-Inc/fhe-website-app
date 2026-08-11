-- SENDGUARD §3 — the onboarding sweep becomes signature-aware.
--
-- generate_my_onboarding_documents soft-deletes the pending draft for a template
-- before regenerating it, keyed on STATUS:
--
--     AND d.status <> 'EXECUTED' AND d.deleted_at IS NULL;
--
-- Status is a proxy for "nobody has signed this", and it holds only by accident.
-- Onboarding documents have ONE signer (CLIENT), so signing drives them to
-- EXECUTED in the same statement and they fall out of the sweep. A document with
-- more than one signer entering this loop after the FIRST signature is
-- `AWAITING_SIGNATURE`, not `EXECUTED` — the sweep would delete it and take a real
-- signature with it.
--
-- Verified in production 2026-08-10, immediately before this migration:
--
--   SELECT d.status, count(*) FROM documents d
--   WHERE d.status <> 'EXECUTED' AND d.deleted_at IS NULL
--     AND EXISTS (SELECT 1 FROM signatures s
--                  WHERE s.document_id=d.id AND s.deleted_at IS NULL)
--   GROUP BY 1;
--   -- (0 rows)
--
-- ZERO ROWS CHANGE TODAY. That is the point: this closes the hole before something
-- falls through it, the same class as void_signatures_on_edit in TASK-NOGUARD2.
--
-- Two edits, both inside the one function:
--
-- 1. The sweep gains `AND NOT EXISTS (a live signature)`. The status test is KEPT,
--    not replaced — dropping it would let the sweep reach an EXECUTED document that
--    happens to carry no signature row, and an executed document is never swept.
--    Signature-awareness is added to the key, it does not become the key.
--
-- 2. Skipping the delete alone would leave the signed draft live AND generate a
--    second live draft for the same template — one member, one template, two
--    pending documents, and the page cannot tell which one to open. So when a
--    pending document for this template carries a live signature, it is ADOPTED as
--    the document for this template and nothing is generated. The signature
--    survives, its id survives, and no duplicate appears.
--
--    This is not §2. It does not reuse an UNSIGNED draft — that draft is still
--    deleted and regenerated exactly as before, because regeneration is what
--    merges fresh profile data into the body. §2 is where that changes, and §2 is
--    gated for owner review.
--
-- The rewrite is a string replacement against pg_get_functiondef (repo convention),
-- so both replacements ASSERT they matched. A replacement that matches nothing
-- silently no-ops and reports success.

BEGIN;

DO $mig$
DECLARE
  v_oid oid;
  v_src text;
  v_new text;
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'generate_my_onboarding_documents';
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'SENDGUARD3: generate_my_onboarding_documents not found';
  END IF;
  v_src := pg_get_functiondef(v_oid);

  -- (1) adopt a pending document that carries a live signature, before any sweep
  v_new := replace(
    v_src,
    E'    IF v_doc IS NULL THEN\n'
    || E'      -- carry the member''s multi-horse choice across regeneration\n',
    E'    -- SENDGUARD §3: a pending document carrying a LIVE SIGNATURE is never\n'
    || E'    -- swept and never duplicated — it is the document for this template.\n'
    || E'    IF v_doc IS NULL THEN\n'
    || E'      SELECT d.id, d.status, d.title INTO v_doc, v_status, v_title\n'
    || E'        FROM documents d\n'
    || E'        JOIN contract_templates t ON t.id = d.template_id\n'
    || E'        WHERE d.contact_id = v_contact AND t.template_key = req.template_key\n'
    || E'          AND d.deleted_at IS NULL AND d.status <> ''EXECUTED''\n'
    || E'          AND EXISTS (SELECT 1 FROM signatures s\n'
    || E'                       WHERE s.document_id = d.id AND s.deleted_at IS NULL)\n'
    || E'        ORDER BY d.created_at DESC\n'
    || E'        LIMIT 1;\n'
    || E'    END IF;\n'
    || E'\n'
    || E'    IF v_doc IS NULL THEN\n'
    || E'      -- carry the member''s multi-horse choice across regeneration\n');
  IF v_new = v_src THEN
    RAISE EXCEPTION 'SENDGUARD3: adopt-signed block not matched; refusing to report a no-op as success';
  END IF;
  v_src := v_new;

  -- (2) the sweep itself: never delete a document carrying a live signature
  v_new := replace(
    v_src,
    E'          AND t.template_key = req.template_key\n'
    || E'          AND d.status <> ''EXECUTED'' AND d.deleted_at IS NULL;\n',
    E'          AND t.template_key = req.template_key\n'
    || E'          AND d.status <> ''EXECUTED'' AND d.deleted_at IS NULL\n'
    || E'          AND NOT EXISTS (SELECT 1 FROM signatures s\n'
    || E'                           WHERE s.document_id = d.id AND s.deleted_at IS NULL);\n');
  IF v_new = v_src THEN
    RAISE EXCEPTION 'SENDGUARD3: sweep predicate not matched; refusing to report a no-op as success';
  END IF;

  EXECUTE v_new;
  RAISE NOTICE 'SENDGUARD3: generate_my_onboarding_documents rewritten';
END
$mig$;

-- Prove both edits are live in the same transaction.
DO $verify$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'generate_my_onboarding_documents';
  IF v_def NOT LIKE '%AND NOT EXISTS (SELECT 1 FROM signatures s%' THEN
    RAISE EXCEPTION 'SENDGUARD3: the sweep is still not signature-aware';
  END IF;
  IF v_def NOT LIKE '%AND EXISTS (SELECT 1 FROM signatures s%' THEN
    RAISE EXCEPTION 'SENDGUARD3: the adopt-signed lookup is missing';
  END IF;
END
$verify$;

COMMIT;
