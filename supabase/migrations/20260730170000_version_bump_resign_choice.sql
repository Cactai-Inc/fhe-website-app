-- ─────────────────────────────────────────────────────────────────────────────
-- VERSION BUMP → RE-SIGN CHOICE (2026-07-30)
--
-- Owner requirement: when a template version is updated, the system must ASK
-- whether past signers should re-sign, with three answers —
--   (a) yes, everyone who signed an older version,
--   (b) yes, but let me choose who is included/excluded,
--   (c) no.
--
-- Two things were missing for that:
--
--   1. Nothing recorded that a version was bumped. contract_templates is edited
--      in place and carries no history, so there was no event to prompt from.
--      A trigger now records each bump and leaves it UNRESOLVED until someone
--      answers — the prompt is driven by that unresolved row, so it cannot be
--      silently skipped by navigating away.
--
--   2. There was no way to require a re-sign from a CHOSEN SUBSET. The existing
--      controls are all-or-nothing: the per-person checkbox list on the client
--      record (set_contact_required_documents, which REPLACES the whole set) and
--      the population-wide sweep added earlier today.
--
-- Note on obligations: contact_required_documents is (contact_id, template_key)
-- only — no version, no timestamp. So "assigned" cannot mean "assigned at v2";
-- the obligation is satisfied by the wall's version comparison instead. That is
-- why Sarah's earlier assignment looked like it did nothing: the rows were there
-- and correct, but the comparison read her old signature as current because the
-- template row had been mutated underneath it. Fixed in 20260730160000.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Record every version bump, unresolved until answered ─────────────────
CREATE TABLE IF NOT EXISTS template_version_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key  text        NOT NULL,
  from_version  int,
  to_version    int         NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  -- NULL until staff answer the re-sign question. This is what drives the prompt.
  resolved_at   timestamptz,
  resolution    text CHECK (resolution IN ('ALL','SELECTED','NONE')),
  resolved_by   uuid,
  people_required int NOT NULL DEFAULT 0
);

COMMENT ON TABLE template_version_events IS
  'One row per template version bump, UNRESOLVED until staff say whether past '
  'signers must re-sign (ALL / SELECTED / NONE). contract_templates is edited in '
  'place and keeps no history, so without this there is no event to prompt from '
  'and a wording change can reach signers with nobody deciding what it means for '
  'people who already signed.';

ALTER TABLE template_version_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tve_staff ON template_version_events;
CREATE POLICY tve_staff ON template_version_events
  FOR ALL TO authenticated
  USING (has_staff_access()) WITH CHECK (has_staff_access());

CREATE OR REPLACE FUNCTION public.record_template_version_bump()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version AND NEW.version > coalesce(OLD.version, 0) THEN
    INSERT INTO template_version_events (template_key, from_version, to_version)
    VALUES (NEW.template_key, OLD.version, NEW.version);
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS record_template_version_bump_trg ON contract_templates;
CREATE TRIGGER record_template_version_bump_trg
  AFTER UPDATE OF version ON contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.record_template_version_bump();

-- ── 2. The prompt feed ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pending_version_decisions()
 RETURNS TABLE(id uuid, template_key text, title text, from_version int,
               to_version int, occurred_at timestamptz, past_signers bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, e.template_key, coalesce(ct.title, e.template_key),
         e.from_version, e.to_version, e.occurred_at,
         (SELECT count(DISTINCT d.contact_id)
            FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
           WHERE ct2.template_key = e.template_key
             AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
             AND coalesce(d.signed_template_version, ct2.version) < e.to_version)
    FROM template_version_events e
    LEFT JOIN contract_templates ct ON ct.template_key = e.template_key
                                   AND ct.active AND ct.deleted_at IS NULL
   WHERE e.resolved_at IS NULL AND has_staff_access()
   ORDER BY e.occurred_at DESC
$function$;

GRANT EXECUTE ON FUNCTION public.pending_version_decisions() TO authenticated;

COMMENT ON FUNCTION public.pending_version_decisions() IS
  'Version bumps still awaiting a re-sign decision, with how many past signers '
  'are behind. Drives the prompt staff answer with ALL / SELECTED / NONE.';

-- ── 3. Who signed an older version (the pick list) ──────────────────────────
CREATE OR REPLACE FUNCTION public.template_past_signers(p_template_key text)
 RETURNS TABLE(contact_id uuid, name text, email text,
               signed_version int, signed_at timestamptz, already_required boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id,
         coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
                  c.email, 'Unnamed'),
         c.email,
         max(coalesce(d.signed_template_version, ct.version))::int,
         max(d.generated_at),
         EXISTS (SELECT 1 FROM contact_required_documents crd
                  WHERE crd.contact_id = c.id AND crd.template_key = p_template_key)
    FROM documents d
    JOIN contract_templates ct ON ct.id = d.template_id
    JOIN contacts c ON c.id = d.contact_id AND c.deleted_at IS NULL
   WHERE ct.template_key = p_template_key
     AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
     AND c.org_id = current_org()
     AND has_staff_access()
   GROUP BY c.id, c.first_name, c.last_name, c.email
  HAVING max(coalesce(d.signed_template_version, ct.version))
         < (SELECT max(version) FROM contract_templates
             WHERE template_key = p_template_key AND active AND deleted_at IS NULL)
   ORDER BY max(d.generated_at) DESC
$function$;

GRANT EXECUTE ON FUNCTION public.template_past_signers(text) TO authenticated;

COMMENT ON FUNCTION public.template_past_signers(text) IS
  'Everyone who signed an OLDER version of this template — the pick list for a '
  'targeted re-sign request. already_required shows who is on the hook already, '
  'so staff can see at a glance what a second run would change.';

-- ── 4. Require a re-sign from a chosen set ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.require_resign_from(p_template_key text, p_contact_ids uuid[])
 RETURNS int
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_n int := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_templates
                  WHERE template_key = p_template_key AND active AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'no active template with key %', p_template_key;
  END IF;

  -- Only contacts in this org, and only the ones actually named. Adding the
  -- obligation is the whole mechanism: the wall compares versions and routes
  -- them through the normal signing flow at next sign-in.
  WITH ins AS (
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    SELECT c.id, p_template_key, v_org
      FROM contacts c
     WHERE c.id = ANY(coalesce(p_contact_ids, '{}'::uuid[]))
       AND c.org_id = v_org AND c.deleted_at IS NULL
    ON CONFLICT DO NOTHING
    RETURNING 1)
  SELECT count(*) INTO v_n FROM ins;

  RETURN v_n;
END
$function$;

GRANT EXECUTE ON FUNCTION public.require_resign_from(text, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.require_resign_from(text, uuid[]) IS
  'Require a re-sign from the named past signers. Passing every candidate is the '
  '"everyone" answer; a subset is the "let me choose" answer. Idempotent — '
  'someone already obliged is skipped, so the return value is what actually '
  'changed rather than what was asked for.';

-- ── 5. Answer the prompt ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_version_decision(
  p_event_id uuid, p_resolution text, p_contact_ids uuid[] DEFAULT NULL)
 RETURNS int
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_n int := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF p_resolution NOT IN ('ALL','SELECTED','NONE') THEN
    RAISE EXCEPTION 'resolution must be ALL, SELECTED or NONE (got %)', p_resolution;
  END IF;

  SELECT template_key INTO v_key FROM template_version_events
   WHERE id = p_event_id AND resolved_at IS NULL;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'no unresolved version event with id %', p_event_id;
  END IF;

  IF p_resolution = 'ALL' THEN
    SELECT require_resign_from(v_key, array_agg(s.contact_id))
      INTO v_n FROM template_past_signers(v_key) s;
  ELSIF p_resolution = 'SELECTED' THEN
    IF p_contact_ids IS NULL OR array_length(p_contact_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'SELECTED requires at least one contact';
    END IF;
    v_n := require_resign_from(v_key, p_contact_ids);
  END IF;
  -- NONE: recorded deliberately. The decision that nobody re-signs is still a
  -- decision, and leaving the event unresolved would keep nagging for it.

  UPDATE template_version_events
     SET resolved_at = now(), resolution = p_resolution,
         resolved_by = auth.uid(), people_required = coalesce(v_n, 0)
   WHERE id = p_event_id;

  RETURN coalesce(v_n, 0);
END
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_version_decision(uuid, text, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.resolve_version_decision(uuid, text, uuid[]) IS
  'Answer a version-bump prompt: ALL (every past signer re-signs), SELECTED (the '
  'named subset) or NONE. NONE is recorded rather than dismissed — choosing that '
  'nobody re-signs is a real decision and should be auditable, and an unresolved '
  'event would otherwise keep prompting.';

-- ── 6. Seed the decision that is already outstanding ────────────────────────
-- The gating templates were edited on 2026-07-28 without any prompt existing.
-- Record those bumps as UNRESOLVED so the owner is asked, rather than the
-- system silently deciding for them.
INSERT INTO template_version_events (template_key, from_version, to_version, occurred_at)
SELECT ct.template_key, greatest(ct.version - 1, 0), ct.version, ct.updated_at
  FROM contract_templates ct
 WHERE ct.active AND ct.deleted_at IS NULL AND ct.wall_gating
   AND EXISTS (SELECT 1 FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
                WHERE ct2.template_key = ct.template_key AND d.status = 'EXECUTED'
                  AND d.deleted_at IS NULL
                  AND coalesce(d.signed_template_version, ct2.version) < ct.version)
   AND NOT EXISTS (SELECT 1 FROM template_version_events e
                    WHERE e.template_key = ct.template_key AND e.to_version = ct.version);
