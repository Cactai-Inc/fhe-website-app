-- ⚠️ AN ADULT'S LIABILITY RELEASE WAS NAMING THEM AS A MINOR.
--
-- Owner, 2026-08-24: "it prints the 'minor participant (if applicable)' section
-- which is weird as shit and it shows the name of the person as a minor and their
-- birthdate which clearly shows they are 40 years old."
--
-- The template is right and the cut mechanism exists. RELEASE_PARTICIPANT (and
-- FACILITY_RULES, RELEASE_GENERAL, RELEASE_JUMPER_ADDENDUM,
-- HUMAN_EMERGENCY_MEDICAL) mark the block:
--
--   <!-- CUT-START: MINOR_PARTICIPANT | condition: append only if PARTICIPANT is a minor -->
--
-- and `generate_document` honours it — gated on `v_has_minor`, which was:
--
--   EXISTS (SELECT 1 FROM document_parties
--            WHERE document_id = v_doc_id AND party_role = 'PARTICIPANT')
--
-- But BOTH generators add a PARTICIPANT party unconditionally:
-- `coalesce(v_minor, v_contact)` — the minor if there is one, ELSE THE PERSON
-- THEMSELVES, so the same template renders identically on both paths. Which means
-- `v_has_minor` was true for everybody, the cut never fired, and every adult's
-- release carried a "MINOR PARTICIPANT" block naming them and printing their real
-- date of birth — then certifying that they are their own parent or guardian.
--
-- Confirmed live: of four RELEASE_PARTICIPANT documents, THREE have a PARTICIPANT
-- party that is the client themselves.
--
-- The flag now asks the question it was always meant to ask: is the participant
-- SOMEBODY ELSE? Deliberately not `is_minor_contact` — that needs a date of birth
-- on file, and a missing DOB would silently reinstate the bug.
DO $mig$
DECLARE v_src text; v_old text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = 'generate_document';
  IF v_src IS NULL THEN RAISE EXCEPTION 'generate_document not found'; END IF;
  IF position('-- MINORBLOCK 2026-08-24' IN v_src) > 0 THEN
    RAISE NOTICE 'already fixed'; RETURN;
  END IF;

  v_old := $q$  v_has_minor := EXISTS (
    SELECT 1 FROM document_parties WHERE document_id = v_doc_id AND party_role = 'PARTICIPANT');$q$;
  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'generate_document is not the shape this migration expected';
  END IF;

  v_src := replace(v_src, v_old, $q$  -- MINORBLOCK 2026-08-24 — A PARTICIPANT WHO IS THE CLIENT IS NOT A MINOR.
  -- Both generators add PARTICIPANT as coalesce(minor, the person themselves) so
  -- the template renders the same on either path; testing only for the ROLE
  -- therefore matched every adult, and the "MINOR PARTICIPANT" block printed on
  -- their release with their own name and date of birth.
  v_has_minor := EXISTS (
    SELECT 1 FROM document_parties dp
     WHERE dp.document_id = v_doc_id
       AND dp.party_role = 'PARTICIPANT'
       AND dp.contact_id IS DISTINCT FROM (
         SELECT d2.contact_id FROM documents d2 WHERE d2.id = v_doc_id));$q$);
  EXECUTE v_src;
END
$mig$;
