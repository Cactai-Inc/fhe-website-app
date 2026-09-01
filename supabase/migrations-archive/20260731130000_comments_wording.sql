-- ─────────────────────────────────────────────────────────────────────────────
-- "NOTE" → "COMMENT" IN EVERY VISIBLE STRING (2026-07-31, owner)
--
-- The drawer is titled Comments, so the DB-side wording has to match. Two places
-- still said "Note": the default title create_contract_note() assigns, and the
-- one row already seeded as "Note 1".
--
-- The TABLE names (contract_notes / contract_note_messages) are deliberately
-- left alone — renaming them would touch RLS policies, three RPCs and the seed
-- trigger to change a word no user ever sees. The visible strings are what the
-- owner asked for.
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- N counts every comment ever created on this document, deleted ones included,
  -- so a default title is never reused after a deletion.
  SELECT count(*) + 1 INTO v_n FROM contract_notes WHERE document_id = p_document_id;
  v_title := coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Comment ' || v_n);

  INSERT INTO contract_notes (org_id, document_id, title, created_by_contact_id)
  VALUES (v_org, p_document_id, v_title, current_contact_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

-- The seed trigger's starter title.
CREATE OR REPLACE FUNCTION public.seed_contract_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.contract_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM contract_notes WHERE document_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO contract_notes (org_id, document_id, title, created_by_contact_id)
  VALUES (NEW.org_id, NEW.id,
          'Click the text to rename, then click anywhere on this header to open',
          NULL);
  RETURN NEW;
END
$function$;

-- Existing rows that still carry the old wording.
UPDATE contract_notes
   SET title = regexp_replace(title, '^Note (\d+)$', 'Comment \1')
 WHERE title ~ '^Note \d+$';

-- The already-seeded starter row still carries the older phrasing.
UPDATE contract_notes
   SET title = 'Click the text to rename, then click anywhere on this header to open'
 WHERE title = 'Click to edit to rename, then click anywhere on this header to open';
