/*
  # Phase 3f — Pinned comments (Google-Docs style)

  Always-on for every contract. Any document party (or staff) can leave a comment
  anchored to a field or to a selected span of the rendered document prose;
  comments are threaded (a comment can be a reply to another) and resolvable
  (resolving closes the thread to further replies).

  Anchoring (survives re-merge — merged_body is regenerated on every edit):
    anchor_kind = 'field'    → anchor_ref = field_key (stable; never rots)
                = 'span'     → anchor_ref = a stable clause/section id, plus the
                               exact `quote` text and a short `quote_prefix` so the
                               UI can re-locate the highlight after a re-merge. When
                               the quoted text can no longer be found, the comment
                               is shown as "the text this refers to changed"
                               (client sets is_stale via mark_comment_stale) rather
                               than pointing at the wrong place.
                = 'document'  → whole-document comment (no specific anchor)

  Security mirrors contract_addenda: org-scoped, RLS-readable by any document
  party or org staff, all writes through SECURITY DEFINER RPCs.
*/

CREATE TABLE IF NOT EXISTS contract_comments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id) ON DELETE CASCADE,
  document_id        uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_comment_id  uuid REFERENCES contract_comments(id) ON DELETE CASCADE,  -- null = thread root
  anchor_kind        text NOT NULL DEFAULT 'document' CHECK (anchor_kind IN ('field','span','document')),
  anchor_ref         text,                        -- field_key, or a clause/section id for spans
  quote              text,                        -- span: the exact selected text (for re-location)
  quote_prefix       text,                        -- span: a little preceding context to disambiguate
  is_stale           boolean NOT NULL DEFAULT false,  -- span anchor could no longer be located
  body               text NOT NULL,
  author_contact_id  uuid REFERENCES contacts(id),
  author_role        text,                        -- the author's party role at write time (or 'STAFF')
  author_label       text,
  resolved_at        timestamptz,
  resolved_by_contact_id uuid REFERENCES contacts(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_comments_doc_idx    ON contract_comments (document_id, created_at);
CREATE INDEX IF NOT EXISTS contract_comments_thread_idx ON contract_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS contract_comments_anchor_idx ON contract_comments (document_id, anchor_kind, anchor_ref);

ALTER TABLE contract_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_comments_read ON contract_comments;
CREATE POLICY contract_comments_read ON contract_comments
  FOR SELECT TO authenticated
  USING ((org_id = current_org() AND has_staff_access()) OR caller_is_document_party(document_id));
REVOKE ALL ON contract_comments FROM authenticated, anon;


-- ── helper: the caller's display label + primary role on a document ─────────
CREATE OR REPLACE FUNCTION public.comment_author_identity(p_document_id uuid)
RETURNS TABLE (contact_id uuid, role text, label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_cid uuid; v_role text; v_label text; v_staff boolean; v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  v_cid   := current_contact_id();
  v_staff := has_staff_access() AND v_org = current_org();
  SELECT r INTO v_role FROM caller_party_roles(p_document_id) r LIMIT 1;
  IF v_role IS NULL AND v_staff THEN v_role := 'STAFF'; END IF;
  SELECT nullif(trim(concat_ws(' ', first_name, last_name)), '')
    INTO v_label FROM contacts WHERE id = v_cid;
  v_label := coalesce(v_label, CASE WHEN v_staff THEN 'Staff' ELSE 'A party' END);
  RETURN QUERY SELECT v_cid, v_role, v_label;
END;
$fn$;


-- ── post a comment (new thread, or a reply to parent) ───────────────────────
CREATE OR REPLACE FUNCTION public.post_contract_comment(
  p_document_id uuid,
  p_body        text,
  p_anchor_kind text DEFAULT 'document',
  p_anchor_ref  text DEFAULT NULL,
  p_quote       text DEFAULT NULL,
  p_quote_prefix text DEFAULT NULL,
  p_parent_id   uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_org uuid; v_id uuid; v_cid uuid; v_role text; v_label text;
  v_parent_doc uuid; v_parent_resolved timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'comment body required'; END IF;

  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;

  -- always-on: any document party (or org staff) may comment
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  -- a reply must belong to the same document and to an unresolved thread
  IF p_parent_id IS NOT NULL THEN
    SELECT document_id, resolved_at INTO v_parent_doc, v_parent_resolved
      FROM contract_comments WHERE id = p_parent_id;
    IF v_parent_doc IS NULL OR v_parent_doc <> p_document_id THEN
      RAISE EXCEPTION 'reply target not on this document';
    END IF;
    IF v_parent_resolved IS NOT NULL THEN
      RAISE EXCEPTION 'this thread is resolved and closed to replies';
    END IF;
  END IF;

  SELECT contact_id, role, label INTO v_cid, v_role, v_label
    FROM comment_author_identity(p_document_id);

  INSERT INTO contract_comments (
    org_id, document_id, parent_comment_id, anchor_kind, anchor_ref, quote, quote_prefix,
    body, author_contact_id, author_role, author_label)
  VALUES (
    v_org, p_document_id, p_parent_id,
    CASE WHEN p_parent_id IS NOT NULL THEN 'document' ELSE coalesce(p_anchor_kind,'document') END,
    p_anchor_ref, p_quote, p_quote_prefix,
    trim(p_body), v_cid, v_role, v_label)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$fn$;


-- ── resolve / reopen a thread (root comment only) ───────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_contract_comment(
  p_comment_id uuid, p_resolved boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_doc uuid; v_org uuid; v_parent uuid; v_cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id, org_id, parent_comment_id INTO v_doc, v_org, v_parent
    FROM contract_comments WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;
  IF v_parent IS NOT NULL THEN RAISE EXCEPTION 'resolve the thread on its first comment'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;
  v_cid := current_contact_id();
  UPDATE contract_comments
     SET resolved_at = CASE WHEN p_resolved THEN now() ELSE NULL END,
         resolved_by_contact_id = CASE WHEN p_resolved THEN v_cid ELSE NULL END,
         updated_at = now()
   WHERE id = p_comment_id;
END;
$fn$;


-- ── mark a span comment stale (its quoted text could no longer be located) ──
CREATE OR REPLACE FUNCTION public.mark_comment_stale(p_comment_id uuid, p_stale boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_doc uuid; v_org uuid;
BEGIN
  SELECT document_id, org_id INTO v_doc, v_org FROM contract_comments WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RETURN; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;
  UPDATE contract_comments SET is_stale = p_stale, updated_at = now() WHERE id = p_comment_id;
END;
$fn$;


-- ── read model: threaded comments for a document ────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_comments_list(p_document_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.created_at), '[]'::jsonb)
  FROM (
    SELECT id, parent_comment_id, anchor_kind, anchor_ref, quote, quote_prefix,
           is_stale, body, author_label, author_role,
           resolved_at, created_at
      FROM contract_comments
     WHERE document_id = p_document_id
       AND ((org_id = current_org() AND has_staff_access())
            OR caller_is_document_party(p_document_id))
  ) t;
$fn$;


-- grants
REVOKE ALL ON FUNCTION comment_author_identity(uuid)                       FROM public, anon;
REVOKE ALL ON FUNCTION post_contract_comment(uuid,text,text,text,text,text,uuid) FROM public, anon;
REVOKE ALL ON FUNCTION resolve_contract_comment(uuid,boolean)             FROM public, anon;
REVOKE ALL ON FUNCTION mark_comment_stale(uuid,boolean)                   FROM public, anon;
REVOKE ALL ON FUNCTION contract_comments_list(uuid)                       FROM public, anon;
GRANT EXECUTE ON FUNCTION post_contract_comment(uuid,text,text,text,text,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resolve_contract_comment(uuid,boolean)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_comment_stale(uuid,boolean)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION contract_comments_list(uuid)                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION comment_author_identity(uuid)                   TO authenticated, service_role;
