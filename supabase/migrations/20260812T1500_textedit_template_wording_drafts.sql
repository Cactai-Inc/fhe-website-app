/*
  # TEXTEDIT — the owner edits template wording in the UI, with draft and publish
  (docs/tasks/TASK-TEXTEDIT-edit-template-wording-without-sql.md)

  D13 made "no SQL required" an acceptance criterion, and template wording is the
  worst offender: sixteen leasefix_* migrations are hand-written UPDATEs against
  contract_clause_defs. This migration adds the missing half of the loop — a
  DRAFT column beside the live text, and the RPCs an editor page calls:

    save draft   -> writes draft_body, NEVER the live text
    publish      -> copies draft -> live, bumps contract_templates.version by 1
                    (the existing record_template_version_bump_trg then records
                    the event and drives the staff re-sign prompt — that
                    machinery already exists and is NOT duplicated here)
    discard      -> clears drafts, changes nothing else

  Draft model per the task: ONE COLUMN, NOT ROW COPIES. 163 clauses x 4 lease
  keys is 652 rows already; versioning by row-copy would multiply that on every
  edit and fight remerge_contract_from_clauses.

  LOCKSTEP (D10, restated by 20260811T1800_leaseset): HORSE_LEASE_V2 (Standard),
  HORSE_LEASE_SIMPLE and HORSE_LEASE_FULL (Detailed) are byte-identical by
  design and every content migration has written all three together. The RPCs
  here mirror every draft save, publish and discard across the three, keyed by
  clause_key (unique per template_key). HORSE_LEASE_STANDARD is archived and is
  REFUSED by the editor RPCs so it can never receive another content update.

  What publish does NOT do: touch documents. merged_body is a snapshot and
  61 EXECUTED documents are evidence; remerge_contract_from_clauses is not
  called from here, and nothing in this file writes to documents at all.

  Guard: is_admin() — the same predicate as contract_templates_admin_write.
*/

-- ── 1. The draft columns ─────────────────────────────────────────────────────

ALTER TABLE contract_clause_defs ADD COLUMN IF NOT EXISTS draft_body text;
ALTER TABLE contract_templates   ADD COLUMN IF NOT EXISTS draft_body text;

COMMENT ON COLUMN contract_clause_defs.draft_body IS
  'Unpublished wording edit from the template editor. NULL = no pending edit. '
  'Publish copies this into body and clears it; nothing else may read it — '
  'remerge_contract_from_clauses reads body only.';
COMMENT ON COLUMN contract_templates.draft_body IS
  'Unpublished body edit for FLAT (non-clause-composed) templates. NULL = no '
  'pending edit. Publish copies this into body, bumps version and clears it.';

-- ── 2. Lockstep helper (internal) ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.template_editor_lockstep_keys(p_key text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_key IN ('HORSE_LEASE_V2','HORSE_LEASE_SIMPLE','HORSE_LEASE_FULL')
      THEN ARRAY['HORSE_LEASE_V2','HORSE_LEASE_SIMPLE','HORSE_LEASE_FULL']
    ELSE ARRAY[p_key]
  END
$$;

REVOKE ALL ON FUNCTION public.template_editor_lockstep_keys(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_editor_lockstep_keys(text) TO authenticated;

-- ── 3. The list — the landing surface is a list of what exists (D13) ─────────

CREATE OR REPLACE FUNCTION public.template_editor_list()
RETURNS TABLE (
  template_key      text,
  title             text,
  short_label       text,
  version           integer,
  active            boolean,
  is_composed       boolean,
  clause_count      bigint,
  draft_clause_count bigint,
  has_flat_draft    boolean,
  body_empty        boolean,
  has_unpublished   boolean,
  lockstep_keys     text[],
  locked_reason     text,
  updated_at        timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.template_key,
    t.title,
    t.short_label,
    t.version,
    t.active,
    EXISTS (SELECT 1 FROM contract_clause_defs c WHERE c.template_key = t.template_key) AS is_composed,
    (SELECT count(*) FROM contract_clause_defs c WHERE c.template_key = t.template_key) AS clause_count,
    (SELECT count(*) FROM contract_clause_defs c WHERE c.template_key = t.template_key AND c.draft_body IS NOT NULL) AS draft_clause_count,
    (t.draft_body IS NOT NULL) AS has_flat_draft,
    (coalesce(t.body,'') = '') AS body_empty,
    (t.draft_body IS NOT NULL
      OR EXISTS (SELECT 1 FROM contract_clause_defs c
                 WHERE c.template_key = t.template_key AND c.draft_body IS NOT NULL)) AS has_unpublished,
    template_editor_lockstep_keys(t.template_key) AS lockstep_keys,
    CASE WHEN t.template_key = 'HORSE_LEASE_STANDARD'
         THEN 'Archived (D10) — edit the Standard lease (HORSE_LEASE_V2) instead'
         END AS locked_reason,
    t.updated_at
  FROM contract_templates t
  WHERE t.deleted_at IS NULL
    AND is_admin()
  ORDER BY EXISTS (SELECT 1 FROM contract_clause_defs c WHERE c.template_key = t.template_key) DESC,
           t.title;
$$;

REVOKE ALL ON FUNCTION public.template_editor_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_editor_list() TO authenticated;

-- ── 4. The clauses of one composed template, in render order ─────────────────
-- Order matches remerge_contract_from_clauses: section sort, then clause sort.

CREATE OR REPLACE FUNCTION public.template_editor_clauses(p_template_key text)
RETURNS TABLE (
  clause_id       uuid,
  section_key     text,
  section_heading text,
  section_sort    integer,
  clause_key      text,
  heading         text,
  body            text,
  draft_body      text,
  clause_type     text,
  is_optional     boolean,
  sort_order      integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id, c.section_key, s.heading, s.sort_order,
    c.clause_key, c.heading, c.body, c.draft_body,
    c.clause_type, c.is_optional, c.sort_order
  FROM contract_clause_defs c
  LEFT JOIN contract_section_defs s
    ON s.template_key = c.template_key AND s.section_key = c.section_key
  WHERE c.template_key = p_template_key
    AND is_admin()
  ORDER BY s.sort_order NULLS LAST, c.sort_order;
$$;

REVOKE ALL ON FUNCTION public.template_editor_clauses(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_editor_clauses(text) TO authenticated;

-- ── 5. Save a clause draft (mirrored across the lease trio) ──────────────────

CREATE OR REPLACE FUNCTION public.template_editor_save_clause_draft(
  p_clause_id uuid,
  p_draft     text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key    text;
  v_clause text;
  v_body   text;
  v_keys   text[];
  v_n      integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Template editing is admin-only';
  END IF;

  SELECT template_key, clause_key, body INTO v_key, v_clause, v_body
  FROM contract_clause_defs WHERE id = p_clause_id;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Clause % not found', p_clause_id;
  END IF;
  IF v_key = 'HORSE_LEASE_STANDARD' THEN
    RAISE EXCEPTION 'HORSE_LEASE_STANDARD is archived (D10) and no longer receives content updates. Edit the Standard lease (HORSE_LEASE_V2) instead.';
  END IF;

  v_keys := template_editor_lockstep_keys(v_key);

  IF p_draft IS NULL OR p_draft = v_body THEN
    -- Back to the live wording: that is not a pending change, clear the draft.
    UPDATE contract_clause_defs
       SET draft_body = NULL
     WHERE template_key = ANY (v_keys) AND clause_key = v_clause;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN jsonb_build_object('cleared', true, 'updated_keys', to_jsonb(v_keys), 'rows', v_n);
  END IF;

  UPDATE contract_clause_defs
     SET draft_body = p_draft
   WHERE template_key = ANY (v_keys) AND clause_key = v_clause;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('cleared', false, 'updated_keys', to_jsonb(v_keys), 'rows', v_n);
END;
$$;

REVOKE ALL ON FUNCTION public.template_editor_save_clause_draft(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_editor_save_clause_draft(uuid, text) TO authenticated;

-- ── 6. Save a flat template's body draft ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.template_editor_save_flat_draft(
  p_template_key text,
  p_draft        text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_body text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Template editing is admin-only';
  END IF;
  IF EXISTS (SELECT 1 FROM contract_clause_defs c WHERE c.template_key = p_template_key) THEN
    RAISE EXCEPTION '% is clause-composed — edit its clauses, not a flat body', p_template_key;
  END IF;

  SELECT body INTO v_body
  FROM contract_templates
  WHERE template_key = p_template_key AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % not found', p_template_key;
  END IF;

  IF p_draft IS NULL OR p_draft = coalesce(v_body, '') THEN
    UPDATE contract_templates SET draft_body = NULL
     WHERE template_key = p_template_key AND deleted_at IS NULL;
    RETURN jsonb_build_object('cleared', true);
  END IF;

  UPDATE contract_templates SET draft_body = p_draft
   WHERE template_key = p_template_key AND deleted_at IS NULL;
  RETURN jsonb_build_object('cleared', false);
END;
$$;

REVOKE ALL ON FUNCTION public.template_editor_save_flat_draft(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_editor_save_flat_draft(text, text) TO authenticated;

-- ── 7. Discard — clears drafts, changes nothing else ─────────────────────────

CREATE OR REPLACE FUNCTION public.template_editor_discard_drafts(p_template_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_keys     text[];
  v_clauses  integer;
  v_flats    integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Template editing is admin-only';
  END IF;

  v_keys := template_editor_lockstep_keys(p_template_key);

  UPDATE contract_clause_defs SET draft_body = NULL
   WHERE template_key = ANY (v_keys) AND draft_body IS NOT NULL;
  GET DIAGNOSTICS v_clauses = ROW_COUNT;

  UPDATE contract_templates SET draft_body = NULL
   WHERE template_key = ANY (v_keys) AND draft_body IS NOT NULL;
  GET DIAGNOSTICS v_flats = ROW_COUNT;

  RETURN jsonb_build_object('keys', to_jsonb(v_keys),
                            'clause_drafts_discarded', v_clauses,
                            'flat_drafts_discarded', v_flats);
END;
$$;

REVOKE ALL ON FUNCTION public.template_editor_discard_drafts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_editor_discard_drafts(text) TO authenticated;

-- ── 8. Publish — draft -> live, version +1, drafts cleared ───────────────────
--
-- For the lease trio, publish CONVERGES: every clause_key with a draft on any
-- of the three keys is applied to all three, so the trio cannot drift apart
-- even if a draft somehow reached only one key. Conflicting drafts for the
-- same clause_key abort the publish loudly.
--
-- The version bump on contract_templates fires record_template_version_bump_trg,
-- which inserts the template_version_events row that drives the existing staff
-- "must past signers re-sign?" prompt. This function does not touch documents.

CREATE OR REPLACE FUNCTION public.template_editor_publish(p_template_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_keys      text[];
  v_conflicts text;
  v_clauses   integer := 0;
  v_flat      integer := 0;
  v_versions  jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Template editing is admin-only';
  END IF;
  IF p_template_key = 'HORSE_LEASE_STANDARD' THEN
    RAISE EXCEPTION 'HORSE_LEASE_STANDARD is archived (D10) and no longer receives content updates.';
  END IF;

  v_keys := template_editor_lockstep_keys(p_template_key);

  SELECT string_agg(clause_key, ', ') INTO v_conflicts
  FROM (
    SELECT clause_key FROM contract_clause_defs
    WHERE template_key = ANY (v_keys) AND draft_body IS NOT NULL
    GROUP BY clause_key HAVING count(DISTINCT draft_body) > 1
  ) conflicting;
  IF v_conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Conflicting drafts across the lease set for clause(s): %. Resolve before publishing.', v_conflicts;
  END IF;

  -- Clause wording: apply each drafted clause_key to every key in the set.
  UPDATE contract_clause_defs c
     SET body = d.draft, draft_body = NULL
    FROM (
      SELECT clause_key, min(draft_body) AS draft
      FROM contract_clause_defs
      WHERE template_key = ANY (v_keys) AND draft_body IS NOT NULL
      GROUP BY clause_key
    ) d
   WHERE c.template_key = ANY (v_keys) AND c.clause_key = d.clause_key;
  GET DIAGNOSTICS v_clauses = ROW_COUNT;

  -- Flat body.
  UPDATE contract_templates
     SET body = draft_body, draft_body = NULL
   WHERE template_key = ANY (v_keys) AND draft_body IS NOT NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS v_flat = ROW_COUNT;

  IF v_clauses = 0 AND v_flat = 0 THEN
    RAISE EXCEPTION 'Nothing to publish for % — no draft changes exist.', p_template_key;
  END IF;

  -- Version +1 on every key published. AFTER UPDATE OF version trigger records
  -- the template_version_events row; documents are never touched.
  WITH bumped AS (
    UPDATE contract_templates
       SET version = version + 1
     WHERE template_key = ANY (v_keys) AND deleted_at IS NULL
     RETURNING template_key, version
  )
  SELECT jsonb_object_agg(template_key, version) INTO v_versions FROM bumped;

  RETURN jsonb_build_object('published_keys', to_jsonb(v_keys),
                            'clause_rows_published', v_clauses,
                            'flat_bodies_published', v_flat,
                            'new_versions', v_versions);
END;
$$;

REVOKE ALL ON FUNCTION public.template_editor_publish(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_editor_publish(text) TO authenticated;

-- ── 9. Tokens for the picker ─────────────────────────────────────────────────
-- The table is the data (not docs/TOKEN_DICTIONARY.md). TOKENAUDIT wrote notes
-- for all 307 rows and found 59 whose source_table no longer exists; the picker
-- must not present dead wiring as live, so source_live is computed here from
-- information_schema rather than trusted from the row.

CREATE OR REPLACE FUNCTION public.template_editor_tokens()
RETURNS TABLE (
  id            uuid,
  template_id   uuid,
  template_key  text,
  namespace     text,
  field         text,
  token         text,
  kind          text,
  source_table  text,
  source_column text,
  computed      boolean,
  required      boolean,
  party_scoped  boolean,
  notes         text,
  source_live   boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    tt.id, tt.template_id, ct.template_key,
    tt.namespace, tt.field, tt.token, tt.kind,
    tt.source_table, tt.source_column,
    tt.computed, tt.required, tt.party_scoped, tt.notes,
    (tt.source_table IS NOT NULL AND EXISTS (
       SELECT 1 FROM information_schema.tables t
       WHERE t.table_schema = 'public' AND t.table_name = tt.source_table
     )) AS source_live
  FROM template_tokens tt
  LEFT JOIN contract_templates ct ON ct.id = tt.template_id
  WHERE is_admin()
  ORDER BY tt.namespace, tt.field;
$$;

REVOKE ALL ON FUNCTION public.template_editor_tokens() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.template_editor_tokens() TO authenticated;
