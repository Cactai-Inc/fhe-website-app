-- TASK-OFFERINGDOCS §2 (completion) — the LAST edge from a tag to an obligation.
--
-- 20260824T1210 stopped a ticked box deriving a TAG, and the verification then
-- showed a ticked RIDER still assigning four documents: `_ensure_client_account`
-- calls `apply_category_documents(contact, categories)` directly, on a path that
-- never goes through derive_affiliations at all. Two edges, one of them invisible
-- from the other.
--
-- After this, the ONLY writers of contact_required_documents are:
--   · apply_offering_documents   — what they bought          (the fact)
--   · apply_sign_path_documents  — the door they came in     (the visit)
--   · an EXPLICIT p_template_keys — what staff ticked BY DOCUMENT, not by tag
--   · set_contact_required_documents — the paperwork editor
-- `apply_category_documents` is left installed and callable (D32: nothing is
-- removed) but no longer has a caller that turns a category into paperwork.
DO $mig$
DECLARE v_src text; v_old text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = '_ensure_client_account';
  IF v_src IS NULL THEN RAISE EXCEPTION '_ensure_client_account not found'; END IF;

  v_old := '  ELSIF v_had_cats OR NOT v_existing THEN
    -- 1b: only assign documents when the caller actually named categories, or
    -- when this contact is brand new. An existing contact re-provisioned with
    -- no categories is left untouched.
    PERFORM apply_category_documents(v_contact, v_cats);
  END IF;';

  IF position(v_old IN v_src) = 0 THEN
    IF position('apply_category_documents' IN v_src) = 0 THEN
      RAISE NOTICE 'the category-document call is already gone — nothing to do';
      RETURN;
    END IF;
    RAISE EXCEPTION 'the category-document block is not the shape this migration expected';
  END IF;

  v_src := replace(v_src, v_old,
'  END IF;
  -- ⚠️ OFFERINGDOCS 2026-08-24 — A TAG NO LONGER ASSIGNS PAPERWORK.
  --
  -- A call to apply_category_documents(v_contact, v_cats) stood here, and it is
  -- what made a ticked checkbox a legal obligation: choosing "Rider" on the
  -- provisioning screen wrote Rider''s four documents onto the person, whether or
  -- not they had bought, visited, or agreed to anything.
  --
  -- Owner: "the tagging is just for us to know what type of services or
  -- relationship they have with us and it helps inform the onboarding which is a
  -- mistake. the onboarding should be informed by the offerings not a tag."
  --
  -- Paperwork now comes from what they BOUGHT (apply_offering_documents), the
  -- door they CAME IN BY (apply_sign_path_documents), or an explicit list of
  -- TEMPLATES staff chose — p_template_keys above, which is unchanged and is
  -- still honoured exactly as it was. The categories are still recorded; they
  -- just describe.');

  -- Guard on the CALL, not the mention: the replacement text above names the
  -- removed statement on purpose, so that a future reader knows what stood here.
  IF position('PERFORM apply_category_documents' IN v_src) > 0 THEN
    RAISE EXCEPTION 'a call to apply_category_documents survived — refusing to install';
  END IF;
  EXECUTE v_src;
END
$mig$;
