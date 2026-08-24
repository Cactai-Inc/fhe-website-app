-- ⚠️ LIVE REGRESSION FIX — /sign/rider assigned NOTHING on production.
--
-- WHAT I DID WRONG. 20260824T1220 removed `_ensure_client_account`'s call to
-- apply_category_documents — correctly, per the owner's ruling that a tag must
-- not create an obligation. Its replacement is `api/sign-start.ts` calling
-- apply_sign_path_documents, and THAT IS IN UNPUSHED CODE. Production runs main.
-- So between applying the migration and shipping the branch, every self-service
-- signup got an account, no documents and no tags.
--
-- Confirmed live: devlab3d@icloud.com, created 2026-08-24 10:06 via /sign/rider —
-- 0 required documents, no groups, invitation categories {RIDER}.
--
-- The lesson is not "ship faster". It is that a migration must not depend on code
-- that has not shipped. THE DATABASE IS MADE SELF-SUFFICIENT: the deployed
-- endpoint tells provision_client_invitation which door somebody came through the
-- only way it can — as the category set `PATH_CATEGORIES` maps the path to — so
-- the spine resolves the door from that and assigns the door's documents itself.
--
-- ⚠️ THIS IS NOT THE TAG MODEL COMING BACK. The categories here are standing in
-- for the PATH, which is what `sign_path_document_requirements` is keyed on, and
-- the door assigning its own paperwork is the ruled behaviour (the visit is the
-- trigger). It is also harmless AFTER the branch ships: sign-start will call
-- apply_sign_path_documents explicitly and both writes are ON CONFLICT DO
-- NOTHING, and the admin form will pass no categories at all.
DO $mig$
DECLARE v_src text; v_old text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'provision_client_invitation';
  IF v_src IS NULL THEN RAISE EXCEPTION 'provision_client_invitation not found'; END IF;
  IF position('_sign_path_for_categories' IN v_src) > 0 THEN
    RAISE NOTICE 'the door already assigns — nothing to do'; RETURN;
  END IF;

  v_old := '  -- The invitation now EXISTS, so it is evidence.';
  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'provision_client_invitation is not the shape this migration expected';
  END IF;

  v_src := replace(v_src, v_old,
'  -- ⚠️ THE DOOR ASSIGNS ITS OWN PAPERWORK, whatever version of the client called.
  -- `p_categories` is how the self-service endpoint names the path it came from
  -- (PATH_CATEGORIES: rider -> RIDER, horse -> HORSE_OWNER, guest -> GUEST). The
  -- newer endpoint calls apply_sign_path_documents itself; this makes the spine
  -- work without it, so a migration can never again land ahead of its code and
  -- leave real people with an account and no paperwork.
  -- Skipped entirely when the caller named documents explicitly — an explicit
  -- list is an instruction, including an empty one (PARTYROLE 2026-08-17).
  IF p_template_keys IS NULL AND NOT v_no_cats AND v_contact IS NOT NULL THEN
    PERFORM apply_sign_path_documents(v_contact, _sign_path_for_categories(v_cats));
  END IF;

  -- The invitation now EXISTS, so it is evidence.');
  EXECUTE v_src;
END
$mig$;

-- The inverse of the endpoint's PATH_CATEGORIES map. Returns '' for anything it
-- does not recognise, which apply_sign_path_documents answers with no rows.
CREATE OR REPLACE FUNCTION public._sign_path_for_categories(p_categories text[])
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_categories @> ARRAY['RIDER'] AND p_categories @> ARRAY['HORSE_OWNER'] THEN 'rider+horse'
    WHEN p_categories @> ARRAY['RIDER']       THEN 'rider'
    WHEN p_categories @> ARRAY['HORSE_OWNER'] THEN 'horse'
    WHEN p_categories @> ARRAY['GUEST']       THEN 'guest'
    ELSE '' END;
$function$;
GRANT EXECUTE ON FUNCTION public._sign_path_for_categories(text[]) TO service_role, authenticated;
