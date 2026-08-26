-- FORMS VERSION ON CHANGE, LIKE DOCUMENTS ALREADY DO (owner, 2026-08-25).
--
-- > *"we established that changes create versions of the file they are changing
-- >  for forms and docs, so nothing can be orphaned."*
--
-- The rule is right and it is REAL — for documents. It was never built for forms,
-- and the data says so plainly:
--
--   DOCUMENTS  67 rows pinned to `signed_template_version`; a newer version
--              executing supersedes and RETAINS the prior one; the drift guard in
--              regenerate_contract_document refuses to recompose a drifted executed
--              document; `template_version_events` records each bump and who had to
--              re-sign. Nothing is orphaned.
--   FORMS      `form_definitions` — 28 rows, 28 distinct form_keys (UNIQUE), and
--              **max(version) = 1**: the column has never been incremented once.
--              No history table. `booking_forms` holds 47 rows, 20 of them carrying
--              real answers, keyed by field `key` and pointing at that ONE mutable
--              row. Edit a schema and every past answer set silently re-points to
--              the new shape.
--
-- So this builds for forms what documents already have. After it, adding, removing
-- or renaming a FIELD is safe, because the version an answer was collected under is
-- retained and stamped, and that is the version its answers are read against.
--
-- The shape deliberately mirrors `content_block_versions` — the incumbent
-- version-history table in this schema — rather than inventing a second idiom.

BEGIN;

CREATE TABLE IF NOT EXISTS public.form_definition_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key    text NOT NULL,
  version     integer NOT NULL,
  title       text NOT NULL,
  audience    text NOT NULL,
  purpose     text,
  schema      jsonb NOT NULL,
  edited_by   uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_key, version)
);
ALTER TABLE public.form_definition_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fdv_staff_read ON public.form_definition_versions;
CREATE POLICY fdv_staff_read ON public.form_definition_versions
  FOR SELECT TO authenticated USING (has_staff_access());
-- Written only by the SECURITY DEFINER snapshot below; no direct client writes.

COMMENT ON TABLE public.form_definition_versions IS
  'One row per PUBLISHED version of a form schema. Written by snapshot_form_definition '
  'before any edit, so the shape an answer set was collected under is always retrievable. '
  'booking_forms.form_version names the row that applies.';

/**
 * Retain the CURRENT state of a form as a version, then hand back the next version
 * number for the edit that is about to happen.
 *
 * Called at the TOP of every mutation, before the schema changes, so what is kept
 * is the shape people actually answered — the outgoing one. Idempotent per version:
 * a second edit at the same version overwrites nothing, because the version has
 * already moved on.
 */
CREATE OR REPLACE FUNCTION public.snapshot_form_definition(p_form_key text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_fd form_definitions%ROWTYPE;
BEGIN
  SELECT * INTO v_fd FROM form_definitions WHERE form_key = p_form_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown form: %', p_form_key; END IF;

  INSERT INTO form_definition_versions (form_key, version, title, audience, purpose, schema, edited_by)
  VALUES (v_fd.form_key, v_fd.version, v_fd.title, v_fd.audience, v_fd.purpose, v_fd.schema, auth.uid())
  ON CONFLICT (form_key, version) DO NOTHING;

  RETURN v_fd.version + 1;
END;
$function$;

-- Seed v1 for all 28 forms, so today's shape is retained before anything edits it.
-- Every existing booking_forms row was collected under it.
INSERT INTO form_definition_versions (form_key, version, title, audience, purpose, schema)
SELECT form_key, version, title, audience, purpose, schema FROM form_definitions
ON CONFLICT (form_key, version) DO NOTHING;

-- ── an answer set remembers WHICH shape it was collected under ───────────────
ALTER TABLE public.booking_forms ADD COLUMN IF NOT EXISTS form_version integer;
COMMENT ON COLUMN public.booking_forms.form_version IS
  'The form_definition_versions row these answers were collected under. Stamped at '
  'creation; a later edit to the form cannot change what this set of answers means.';
-- Backfill: everything that exists was collected under v1 (the only version there
-- has ever been).
UPDATE booking_forms bf SET form_version = fd.version
  FROM form_definitions fd WHERE fd.form_key = bf.form_key AND bf.form_version IS NULL;

COMMIT;
