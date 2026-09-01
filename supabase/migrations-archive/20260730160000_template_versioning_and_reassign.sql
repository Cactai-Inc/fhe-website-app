-- ─────────────────────────────────────────────────────────────────────────────
-- TEMPLATE VERSIONING + BULK RE-ASSIGNMENT (2026-07-30)
--
-- THE BUG THIS FIXES
--
-- `contract_templates` holds ONE row per template_key. When a document's wording
-- was revised, the body was edited IN PLACE and `version` bumped on that same
-- row. There is no historical row for version 1.
--
-- The wall predicate (contact_document_wall_state) asks: does this contact have
-- an EXECUTED document whose template version >= the current active version?
-- Because the document's template_id points at the SAME row that was later
-- edited, an old signature silently inherits the new version number.
--
-- Consequence, measured on live data: every member signed on or before
-- 2026-07-10; the gating templates were last edited 2026-07-28. 38 executed
-- documents across 8 people all read as "signed at the current version" when
-- NONE of those people ever saw the current wording. The wall reports 0 gating
-- documents for all of them, so nobody is asked to re-sign.
--
-- That is a correctness problem with legal weight: the system asserts consent to
-- text the signer never read.
--
-- WHAT THIS MIGRATION DOES
--   1. Records, per document, the template version ACTUALLY signed — captured at
--      signature time, so it can never be retro-changed by a later template edit.
--   2. Backfills it from evidence: a document executed BEFORE the template's last
--      edit did not see the current version.
--   3. Re-points the wall predicate at that recorded value.
--   4. Gives staff a real re-assignment control (a one-shot sweep for the whole
--      population, plus targeted assignment at any time).
--
-- Executed documents are never modified or deleted. Re-signing SUPERSEDES; the
-- prior copy is retained as evidence of what was agreed on the day.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Record the version actually signed ───────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signed_template_version int;

COMMENT ON COLUMN documents.signed_template_version IS
  'The contract_templates.version in force WHEN THIS DOCUMENT WAS SIGNED, frozen '
  'at signature time. Templates are edited in place (one row per key, version '
  'bumped), so template_id alone cannot tell you what the signer actually read — '
  'an old signature would inherit the new number. This column is the evidence.';

-- Freeze it at execution, alongside the existing execution effects.
CREATE OR REPLACE FUNCTION public.freeze_signed_template_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'EXECUTED' AND coalesce(OLD.status,'') <> 'EXECUTED'
     AND NEW.signed_template_version IS NULL THEN
    SELECT ct.version INTO NEW.signed_template_version
      FROM contract_templates ct WHERE ct.id = NEW.template_id;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS freeze_signed_template_version_trg ON documents;
CREATE TRIGGER freeze_signed_template_version_trg
  BEFORE UPDATE OF status ON documents
  FOR EACH ROW EXECUTE FUNCTION public.freeze_signed_template_version();

-- ── 2. Backfill from evidence ───────────────────────────────────────────────
-- A document executed BEFORE the template's last edit did not see the current
-- text. We cannot know which older version it was (no historical rows exist), so
-- record version-1-at-minimum: enough to make the comparison honest and put the
-- document behind the current version. Documents executed AFTER the last edit
-- did see the current text.
UPDATE documents d
   SET signed_template_version = CASE
         WHEN d.generated_at < ct.updated_at THEN greatest(ct.version - 1, 0)
         ELSE ct.version END
  FROM contract_templates ct
 WHERE ct.id = d.template_id
   AND d.status = 'EXECUTED'
   AND d.signed_template_version IS NULL;

-- ── 3. The wall predicate reads the recorded version ────────────────────────
CREATE OR REPLACE FUNCTION public.contact_document_wall_state(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending int; v_gating int; v_titles text[];
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('pending', 0, 'gating', 0, 'titles', '[]'::jsonb);
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE ct.wall_gating),
         array_agg(coalesce(ct.title, ct.template_key)
                   ORDER BY coalesce(ct.title, ct.template_key))
           FILTER (WHERE ct.wall_gating)
    INTO v_pending, v_gating, v_titles
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key
     AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key
                          AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = p_contact_id
     AND NOT EXISTS (
       SELECT 1 FROM documents d
       JOIN contract_templates ct2 ON ct2.id = d.template_id
      WHERE d.contact_id = p_contact_id AND d.deleted_at IS NULL
        AND d.status = 'EXECUTED'
        AND coalesce(d.current_status,'') <> 'superseded'
        AND ct2.template_key = crd.template_key
        -- THE FIX: compare against the version actually signed, not the version
        -- the (mutated) template row happens to carry now. coalesce keeps any
        -- row the backfill missed behaving as before rather than silently
        -- re-walling someone.
        AND coalesce(d.signed_template_version, ct2.version) >= ct.version);

  RETURN jsonb_build_object(
    'pending', coalesce(v_pending, 0),
    'gating',  coalesce(v_gating, 0),
    'titles',  to_jsonb(coalesce(v_titles, ARRAY[]::text[])));
END;
$function$;

-- ── 4. Staff control: who is out of date, and re-assign ─────────────────────
CREATE OR REPLACE FUNCTION public.template_reassignment_candidates()
 RETURNS TABLE(template_key text, title text, current_version int,
               people_out_of_date bigint, people_never_signed bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ct.template_key,
         coalesce(ct.title, ct.template_key),
         ct.version,
         count(*) FILTER (WHERE sd.signed_version IS NOT NULL AND sd.signed_version < ct.version),
         count(*) FILTER (WHERE sd.signed_version IS NULL)
    FROM contract_templates ct
    JOIN contact_required_documents crd ON crd.template_key = ct.template_key
    JOIN contacts c ON c.id = crd.contact_id AND c.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT max(coalesce(d.signed_template_version, ct2.version)) AS signed_version
        FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
       WHERE d.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'EXECUTED'
         AND coalesce(d.current_status,'') <> 'superseded'
         AND ct2.template_key = ct.template_key) sd ON true
   -- contract_templates carries no org_id; the contacts join above is what
   -- scopes this to the caller's organisation.
   WHERE ct.active AND ct.deleted_at IS NULL
     AND c.org_id = current_org()
     AND has_staff_access()
   GROUP BY ct.template_key, ct.title, ct.version
  HAVING count(*) FILTER (WHERE sd.signed_version IS NULL OR sd.signed_version < ct.version) > 0
   ORDER BY 4 DESC, 1
$function$;

COMMENT ON FUNCTION public.template_reassignment_candidates() IS
  'Templates with people behind the current version, split into those who signed '
  'an OLDER version and those who never signed at all. This is what staff act on '
  'when wording changes — the answer to "who still owes me this document?".';

GRANT EXECUTE ON FUNCTION public.template_reassignment_candidates() TO authenticated;

/** Require a template from everyone who is behind. Idempotent: assigning an
 *  already-assigned template is a no-op, so re-running never duplicates. */
CREATE OR REPLACE FUNCTION public.require_document_from_all(p_template_key text)
 RETURNS int
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_ver int;
  v_count int := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;

  SELECT max(version) INTO v_ver FROM contract_templates
   WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF v_ver IS NULL THEN
    RAISE EXCEPTION 'no active template with key %', p_template_key;
  END IF;

  -- Assign to everyone who is behind — INCLUDING people who hold no obligation
  -- row yet. That gap is real and load-bearing: 7 of 12 members had signed
  -- documents but no standing requirement, so the wall could never ask them for
  -- anything. Signing once is not the same as being obliged to keep current.
  --
  -- Scope: members the template actually applies to — those who have EITHER an
  -- existing obligation OR an executed copy of this template. It never invents
  -- obligations for someone who has no relationship to the document.
  WITH behind AS (
    SELECT c.id AS contact_id
      FROM contacts c
      LEFT JOIN LATERAL (
        SELECT max(coalesce(d.signed_template_version, ct2.version)) AS v
          FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
         WHERE d.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'EXECUTED'
           AND coalesce(d.current_status,'') <> 'superseded'
           AND ct2.template_key = p_template_key) sd ON true
     WHERE c.deleted_at IS NULL AND c.org_id = v_org
       AND (EXISTS (SELECT 1 FROM contact_required_documents crd
                     WHERE crd.contact_id = c.id AND crd.template_key = p_template_key)
         OR sd.v IS NOT NULL)
       AND (sd.v IS NULL OR sd.v < v_ver)),
  assigned AS (
    INSERT INTO contact_required_documents (contact_id, template_key)
    SELECT contact_id, p_template_key FROM behind
    ON CONFLICT DO NOTHING
    RETURNING 1)
  SELECT count(*) INTO v_count FROM behind;

  RETURN v_count;
END
$function$;

COMMENT ON FUNCTION public.require_document_from_all(text) IS
  'Require the current version of a template from everyone who is behind, and '
  'return how many that is. Covers people with NO obligation row yet — 7 of 12 '
  'members were in that state, having signed once but never been obliged to stay '
  'current, so the wall could never ask them for anything. Idempotent: assigning '
  'an existing obligation is a no-op, so re-running is safe. Scoped to people the '
  'template already applies to (an existing obligation or an executed copy), so '
  'it never invents obligations for the unrelated.';

GRANT EXECUTE ON FUNCTION public.require_document_from_all(text) TO authenticated;

/** Assign a template to ONE person as a gating obligation. The everyday control:
 *  staff pick a person and a document, and the normal signing flow does the rest. */
CREATE OR REPLACE FUNCTION public.assign_document_to_contact(p_contact_id uuid, p_template_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_templates
                  WHERE template_key = p_template_key AND active AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'no active template with key %', p_template_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts
                  WHERE id = p_contact_id AND org_id = current_org() AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'contact not found in this organisation';
  END IF;

  INSERT INTO contact_required_documents (contact_id, template_key)
  VALUES (p_contact_id, p_template_key)
  ON CONFLICT DO NOTHING;
END
$function$;

COMMENT ON FUNCTION public.assign_document_to_contact(uuid, text) IS
  'Require a document from one person. Idempotent. The assignment IS the gate: '
  'the wall picks it up automatically and routes them through the normal signing '
  'flow (intake pre-filled, edit or continue, sign, into the app).';

GRANT EXECUTE ON FUNCTION public.assign_document_to_contact(uuid, text) TO authenticated;
