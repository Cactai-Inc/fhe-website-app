-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRACT NOTES — titled threads with a chat inside (2026-07-30)
--
-- A third drawer alongside Change requests and Change history. Unlike a change
-- request (which proposes an EDIT and has a resolution lifecycle), a note is a
-- conversation: the parties talk in a contained space, and nothing about the
-- contract text changes.
--
-- `contract_messages` already existed but is FLAT — document + sender + body,
-- with no thread grouping and no title. It also carries 0 rows and had NO RLS
-- policies at all, meaning it was unreachable from the client anyway. Rather
-- than bolt threading onto it, notes get their own pair of tables with the
-- structure the feature actually needs, and contract_messages is left untouched
-- for whatever it was intended for.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title        text NOT NULL,
  created_by_contact_id uuid REFERENCES contacts(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS contract_notes_document_idx
  ON contract_notes (document_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE contract_notes IS
  'A titled conversation thread hanging off a contract. Distinct from a change '
  'request: a note proposes nothing and has no resolution lifecycle — it is a '
  'contained space for the parties to talk. The title is author-editable and '
  'defaults to "Note N".';

CREATE TABLE IF NOT EXISTS contract_note_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  note_id    uuid NOT NULL REFERENCES contract_notes(id) ON DELETE CASCADE,
  author_contact_id uuid REFERENCES contacts(id),
  author_label text,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS contract_note_messages_note_idx
  ON contract_note_messages (note_id, created_at) WHERE deleted_at IS NULL;

-- ── RLS: the same audience that can read the document ───────────────────────
ALTER TABLE contract_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_note_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_notes_party ON contract_notes;
CREATE POLICY contract_notes_party ON contract_notes
  FOR ALL TO authenticated
  USING (
    org_id = current_org() AND (
      has_staff_access()
      OR EXISTS (SELECT 1 FROM document_parties dp
                  WHERE dp.document_id = contract_notes.document_id
                    AND dp.contact_id = current_contact_id())))
  WITH CHECK (
    org_id = current_org() AND (
      has_staff_access()
      OR EXISTS (SELECT 1 FROM document_parties dp
                  WHERE dp.document_id = contract_notes.document_id
                    AND dp.contact_id = current_contact_id())));

DROP POLICY IF EXISTS contract_note_messages_party ON contract_note_messages;
CREATE POLICY contract_note_messages_party ON contract_note_messages
  FOR ALL TO authenticated
  USING (
    org_id = current_org() AND EXISTS (
      SELECT 1 FROM contract_notes n
       WHERE n.id = contract_note_messages.note_id
         AND (has_staff_access()
           OR EXISTS (SELECT 1 FROM document_parties dp
                       WHERE dp.document_id = n.document_id
                         AND dp.contact_id = current_contact_id()))))
  WITH CHECK (
    org_id = current_org() AND EXISTS (
      SELECT 1 FROM contract_notes n
       WHERE n.id = contract_note_messages.note_id
         AND (has_staff_access()
           OR EXISTS (SELECT 1 FROM document_parties dp
                       WHERE dp.document_id = n.document_id
                         AND dp.contact_id = current_contact_id()))));

-- ── Read: threads with their messages, oldest thread first ──────────────────
CREATE OR REPLACE FUNCTION public.contract_notes_for_document(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(t ORDER BY t.created_at), '[]'::jsonb)
    FROM (
      SELECT n.id, n.title, n.created_at,
             (n.created_by_contact_id = current_contact_id()) AS mine,
             coalesce((
               SELECT jsonb_agg(jsonb_build_object(
                        'id', m.id, 'body', m.body, 'created_at', m.created_at,
                        'author', coalesce(m.author_label, 'Someone'),
                        'mine', m.author_contact_id = current_contact_id())
                      ORDER BY m.created_at)
                 FROM contract_note_messages m
                WHERE m.note_id = n.id AND m.deleted_at IS NULL), '[]'::jsonb) AS messages
        FROM contract_notes n
       WHERE n.document_id = p_document_id AND n.deleted_at IS NULL
    ) t
$function$;

GRANT EXECUTE ON FUNCTION public.contract_notes_for_document(uuid) TO authenticated;

-- ── Create a thread. Default title is "Note N", N incrementing per document ──
CREATE OR REPLACE FUNCTION public.create_contract_note(p_document_id uuid, p_title text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_id uuid; v_n int; v_title text;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() OR EXISTS (
            SELECT 1 FROM document_parties dp
             WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id())) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  -- N counts every note ever created on this document, deleted ones included, so
  -- a default title is never reused after a deletion.
  SELECT count(*) + 1 INTO v_n FROM contract_notes WHERE document_id = p_document_id;
  v_title := coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Note ' || v_n);

  INSERT INTO contract_notes (org_id, document_id, title, created_by_contact_id)
  VALUES (v_org, p_document_id, v_title, current_contact_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

GRANT EXECUTE ON FUNCTION public.create_contract_note(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rename_contract_note(p_note_id uuid, p_title text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_title text := nullif(trim(coalesce(p_title,'')),'');
BEGIN
  IF v_title IS NULL THEN RAISE EXCEPTION 'a note needs a title'; END IF;
  UPDATE contract_notes SET title = v_title, updated_at = now()
   WHERE id = p_note_id AND deleted_at IS NULL
     AND (has_staff_access() OR created_by_contact_id = current_contact_id());
  IF NOT FOUND THEN RAISE EXCEPTION 'note not found, or not yours to rename'; END IF;
END
$function$;

GRANT EXECUTE ON FUNCTION public.rename_contract_note(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_contract_note_message(p_note_id uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_doc uuid; v_id uuid; v_body text := nullif(trim(coalesce(p_body,'')),'');
  v_label text;
BEGIN
  IF v_body IS NULL THEN RAISE EXCEPTION 'an empty message cannot be posted'; END IF;
  SELECT org_id, document_id INTO v_org, v_doc FROM contract_notes
   WHERE id = p_note_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown note'; END IF;
  IF NOT (has_staff_access() OR EXISTS (
            SELECT 1 FROM document_parties dp
             WHERE dp.document_id = v_doc AND dp.contact_id = current_contact_id())) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  SELECT coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email)
    INTO v_label FROM contacts c WHERE c.id = current_contact_id();

  INSERT INTO contract_note_messages (org_id, note_id, author_contact_id, author_label, body)
  VALUES (v_org, p_note_id, current_contact_id(), v_label, v_body)
  RETURNING id INTO v_id;

  UPDATE contract_notes SET updated_at = now() WHERE id = p_note_id;
  RETURN v_id;
END
$function$;

GRANT EXECUTE ON FUNCTION public.post_contract_note_message(uuid, text) TO authenticated;
