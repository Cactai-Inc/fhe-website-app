-- Comments system rebuild — data layer additions:
--   • edit_contract_comment(id, body): the author may edit their own comment.
--   • delete_contract_comment(id): the author may delete their own (and its replies).
--   • needs_review flag: when a party edits the anchored SELECTION or replies in a
--     way that should draw the author back, the root is flagged needs_review so a
--     dismissible "review" banner can surface it. mark_comment_review(id, on).

ALTER TABLE contract_comments ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE contract_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- edit: author-only, on an unresolved comment.
CREATE OR REPLACE FUNCTION public.edit_contract_comment(p_comment_id uuid, p_body text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_author uuid; v_me uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'comment body required'; END IF;
  SELECT document_id, author_contact_id INTO v_doc, v_author FROM contract_comments WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;
  SELECT contact_id INTO v_me FROM comment_author_identity(v_doc);
  IF v_me IS NULL OR v_me <> v_author THEN RAISE EXCEPTION 'only the author may edit this comment'; END IF;
  UPDATE contract_comments SET body = trim(p_body), edited_at = now(), updated_at = now() WHERE id = p_comment_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- delete: author-only; removes the comment and (if a root) its replies.
CREATE OR REPLACE FUNCTION public.delete_contract_comment(p_comment_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_author uuid; v_me uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id, author_contact_id INTO v_doc, v_author FROM contract_comments WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;
  SELECT contact_id INTO v_me FROM comment_author_identity(v_doc);
  IF v_me IS NULL OR v_me <> v_author THEN RAISE EXCEPTION 'only the author may delete this comment'; END IF;
  DELETE FROM contract_comments WHERE id = p_comment_id OR parent_comment_id = p_comment_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- mark/clear the needs_review flag on a comment (any party of the doc). Setting it
-- draws the author back; the author clears it by dismissing the review banner.
CREATE OR REPLACE FUNCTION public.mark_comment_review(p_comment_id uuid, p_on boolean DEFAULT true)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id INTO v_doc FROM contract_comments WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;
  IF NOT ((has_staff_access() AND (SELECT org_id FROM documents WHERE id=v_doc) = current_org())
          OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;
  UPDATE contract_comments SET needs_review = coalesce(p_on,true), updated_at = now() WHERE id = p_comment_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- expose needs_review + edited_at + author_contact_id in the list RPC (matches the
-- existing jsonb-array shape + access checks; adds the new columns).
CREATE OR REPLACE FUNCTION public.contract_comments_list(p_document_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.created_at), '[]'::jsonb)
  FROM (
    SELECT id, parent_comment_id, anchor_kind, anchor_ref, quote, quote_prefix,
           is_stale, needs_review, body, author_label, author_role, author_contact_id,
           resolved_at, edited_at, created_at
      FROM contract_comments
     WHERE document_id = p_document_id
       AND ((org_id = current_org() AND has_staff_access())
            OR caller_is_document_party(p_document_id))
  ) t;
$function$;
