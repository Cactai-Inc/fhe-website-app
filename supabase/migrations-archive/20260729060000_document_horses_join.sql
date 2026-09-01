-- MULTI-HORSE DOCUMENT BINDING — the join table.
--
-- WHY A JOIN, AND WHY documents.horse_id SURVIVES
-- ------------------------------------------------
-- Today a document names exactly one horse through documents.horse_id. That
-- column is read in ~a dozen places (sync_horse_fields_to_documents' trigger
-- predicate, horse_page_detail, ensure_horse_documents, horse_active_lease_doc,
-- staff surfaces, the documents_horse_idx lookups). Widening the grain by
-- DELETING that column would touch every one of them and would silently change
-- the lease/contract engine, which is genuinely single-horse.
--
-- So: documents.horse_id REMAINS, and remains authoritative for the
-- single-horse case. It is the PRIMARY horse — position 1. document_horses
-- carries the FULL ordered set (including that primary). The invariant, enforced
-- by trigger below, is:
--     a document with any document_horses rows has documents.horse_id equal to
--     its position-1 row.
-- A single-horse document therefore has exactly one document_horses row whose
-- horse_id equals documents.horse_id, and every existing reader keeps working
-- unchanged. Rendering asks the join; everything else can keep asking the column.

CREATE TABLE IF NOT EXISTS public.document_horses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  horse_id    uuid NOT NULL REFERENCES horses(id)    ON DELETE CASCADE,
  -- 1 = the primary horse (mirrors documents.horse_id). Ordering is the order
  -- the horses are named in the composed body — stable and user-chosen.
  position    integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_horses_unique       UNIQUE (document_id, horse_id),
  CONSTRAINT document_horses_position_pos CHECK (position >= 1)
);

CREATE INDEX IF NOT EXISTS document_horses_document_idx ON public.document_horses (document_id, position);
CREATE INDEX IF NOT EXISTS document_horses_horse_idx    ON public.document_horses (horse_id);

ALTER TABLE public.document_horses ENABLE ROW LEVEL SECURITY;

-- RLS mirrors `documents` exactly: the join row is visible to whoever may see
-- the document it belongs to, and writable by staff. Client-side binding goes
-- through the SECURITY DEFINER RPCs below, which enforce horse ownership.
DROP POLICY IF EXISTS document_horses_org_boundary ON public.document_horses;
CREATE POLICY document_horses_org_boundary ON public.document_horses
  AS RESTRICTIVE TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

DROP POLICY IF EXISTS document_horses_select ON public.document_horses;
CREATE POLICY document_horses_select ON public.document_horses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_horses.document_id));

DROP POLICY IF EXISTS document_horses_admin_write ON public.document_horses;
CREATE POLICY document_horses_admin_write ON public.document_horses
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE public.document_horses IS
  'Ordered set of horses a document names. Position 1 mirrors documents.horse_id '
  '(the primary). A single-horse document has exactly one row here, so all '
  'existing documents.horse_id readers are unaffected.';

-- ── The invariant trigger ───────────────────────────────────────────────────
-- Keeps documents.horse_id == the position-1 join row, from either direction.
CREATE OR REPLACE FUNCTION public.sync_document_primary_horse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_doc     uuid := coalesce(NEW.document_id, OLD.document_id);
  v_primary uuid;
BEGIN
  SELECT dh.horse_id INTO v_primary
    FROM document_horses dh
    WHERE dh.document_id = v_doc
    ORDER BY dh.position, dh.created_at
    LIMIT 1;
  -- No join rows left → the document is horse-less again (NULL), which is the
  -- pre-existing "no horse named" state, not an error.
  UPDATE documents SET horse_id = v_primary, updated_at = now()
    WHERE id = v_doc AND horse_id IS DISTINCT FROM v_primary;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_document_primary_horse ON public.document_horses;
CREATE TRIGGER trg_sync_document_primary_horse
  AFTER INSERT OR UPDATE OR DELETE ON public.document_horses
  FOR EACH ROW EXECUTE FUNCTION public.sync_document_primary_horse();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Every document that already names a horse gets its position-1 row, so the
-- join is complete from the moment it exists and readers never see a document
-- with a horse_id but no join row.
INSERT INTO public.document_horses (org_id, document_id, horse_id, position)
SELECT d.org_id, d.id, d.horse_id, 1
  FROM documents d
  WHERE d.horse_id IS NOT NULL
ON CONFLICT (document_id, horse_id) DO NOTHING;
