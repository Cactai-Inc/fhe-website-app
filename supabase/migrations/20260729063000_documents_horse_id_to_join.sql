-- KEEP THE JOIN IN STEP WITH documents.horse_id (the other direction).
--
-- The join table's trigger pushes position-1 → documents.horse_id. This is the
-- mirror: any writer that sets documents.horse_id DIRECTLY (generate_document's
-- INSERT, attach_horse_to_document's UPDATE, ensure_horse_documents, staff
-- surfaces) gets a position-1 join row for free. Without this, a
-- single-horse document created the old way would have a horse_id and NO join
-- row, and document_horse_ids' fallback would be doing all the work.
--
-- GUARDS AGAINST THE OBVIOUS LOOP: the join trigger only UPDATEs documents when
-- the value actually differs, and this trigger only INSERTs when the row is
-- missing — so each settles in one pass.
--
-- Multi-horse safety: when the document ALREADY has join rows and the new
-- horse_id is one of them, nothing happens (the primary is being re-pointed by
-- the join trigger itself). Only a horse_id that is absent from the set creates
-- a row, and it takes position 1 — which is exactly "this is now the primary".

CREATE OR REPLACE FUNCTION public.sync_horse_id_to_document_horses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.horse_id IS NULL THEN RETURN NULL; END IF;

  -- already bound (in any position) → nothing to do
  IF EXISTS (SELECT 1 FROM document_horses dh
              WHERE dh.document_id = NEW.id AND dh.horse_id = NEW.horse_id) THEN
    RETURN NULL;
  END IF;

  -- Make room at position 1 FIRST (no-op when the document has no rows yet),
  -- then insert the new primary there. Done in this order there is no window
  -- where two rows share position 1.
  UPDATE document_horses dh
     SET position = dh.position + 1
   WHERE dh.document_id = NEW.id;

  INSERT INTO document_horses (org_id, document_id, horse_id, position)
    VALUES (NEW.org_id, NEW.id, NEW.horse_id, 1)
    ON CONFLICT (document_id, horse_id) DO NOTHING;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_horse_id_to_document_horses ON public.documents;
CREATE TRIGGER trg_sync_horse_id_to_document_horses
  AFTER INSERT OR UPDATE OF horse_id ON public.documents
  FOR EACH ROW WHEN (NEW.horse_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_horse_id_to_document_horses();
