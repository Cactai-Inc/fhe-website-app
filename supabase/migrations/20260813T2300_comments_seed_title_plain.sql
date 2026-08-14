-- ─────────────────────────────────────────────────────────────────────────────
-- STARTER COMMENT TITLE → PLAIN "Comment 1" (2026-08-13, owner)
--
-- The seeded starter note's title has always been an instructional sentence
-- ("Click the text to rename, then click anywhere on this header to open")
-- doing double duty as in-drawer onboarding copy, not an actual comment name.
-- Owner: drop the explanation — the starter note should read like any other
-- comment. create_contract_note()'s own default ('Comment ' || n) already
-- does this for every note after the first; the seed trigger now matches,
-- and since it only ever fires once per document (guarded by the EXISTS
-- check below), 'Comment 1' is always the accurate ordinal for it.
-- ─────────────────────────────────────────────────────────────────────────────

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
  VALUES (NEW.org_id, NEW.id, 'Comment 1', NULL);
  RETURN NEW;
END
$function$;

-- Existing starter rows still carrying either historical instructional
-- phrasing — matched by EXACT string, so a note a user genuinely renamed
-- (which would no longer equal the seeded default) is never touched.
UPDATE contract_notes
   SET title = 'Comment 1'
 WHERE title IN (
   'Click the text to rename, then click anywhere on this header to open',
   'Click to edit to rename, then click anywhere on this header to open'
 );
