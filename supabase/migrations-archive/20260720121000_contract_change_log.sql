/*
  # Phase 1d — Contract change-log (audit-trail substrate)

  A single immutable history of every consequential change to a contract's
  content. It underpins two features:
    • Track-changes — "what did the other party change" reads recent entries.
    • Retained audit trail — the permanent legal record kept after execution,
      queryable, never shown on the clean PDF.

  One table, one writer helper. The field-write RPCs call log_contract_change(...)
  the same way they already call contract_notify(...). Insert-only for parties
  (no update/delete); org-scoped; RLS by document party; writes only through the
  SECURITY DEFINER helper.

  change_kind values:
    field_value       — a scalar field value was written (set_contract_field)
    field_structured  — a structured field value was written (set_field_structured)
    field_edit_accept / field_edit_reject   — a redline field proposal was resolved
    clause_accept     / clause_reject       — an addendum/clause was resolved
    change_req_accept / change_req_reject    — a change request was resolved
    prose_recompose   — reserved: body prose changed as a derived effect
*/

CREATE TABLE IF NOT EXISTS contract_change_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id) ON DELETE CASCADE,
  document_id        uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  change_kind        text NOT NULL,
  field_key          text,                       -- null for non-field changes
  field_label        text,
  owner_role         text,                        -- the field's owning party role, when applicable
  old_value          text,                        -- prior prose/value (nullable)
  new_value          text,                        -- new prose/value (nullable)
  detail             jsonb NOT NULL DEFAULT '{}', -- structured extras (e.g. clause id, structured diff)
  actor_contact_id   uuid REFERENCES contacts(id),
  actor_label        text,                        -- display name captured at write time
  actor_roles        text[] NOT NULL DEFAULT '{}',-- caller's party roles on the doc at the time
  actor_is_staff     boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_change_log_doc_idx  ON contract_change_log (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contract_change_log_field_idx ON contract_change_log (document_id, field_key);

ALTER TABLE contract_change_log ENABLE ROW LEVEL SECURITY;

-- Read: staff of the org, or any party to the document. (Track-changes shows
-- every party the changes made by the others; RLS scopes to the document.)
DROP POLICY IF EXISTS contract_change_log_read ON contract_change_log;
CREATE POLICY contract_change_log_read ON contract_change_log
  FOR SELECT TO authenticated
  USING ((org_id = current_org() AND has_staff_access()) OR caller_is_document_party(document_id));

-- No direct writes: the log is written only by the SECURITY DEFINER helper.
REVOKE ALL ON contract_change_log FROM authenticated, anon;


-- ── writer helper ───────────────────────────────────────────────────────────
-- Stamps actor identity (contact, roles, staff) from the current auth context.
-- Called inside the field-write RPCs. Safe no-op-ish: never raises on logging so
-- a logging problem can't block a legitimate contract edit.
CREATE OR REPLACE FUNCTION public.log_contract_change(
  p_document_id uuid,
  p_change_kind text,
  p_field_key   text DEFAULT NULL,
  p_field_label text DEFAULT NULL,
  p_owner_role  text DEFAULT NULL,
  p_old_value   text DEFAULT NULL,
  p_new_value   text DEFAULT NULL,
  p_detail      jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_org    uuid;
  v_label  text;
  v_roles  text[];
  v_staff  boolean;
  v_cid    uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RETURN; END IF;   -- unknown/deleted doc: skip silently

  v_cid   := current_contact_id();
  v_staff := has_staff_access() AND v_org = current_org();
  BEGIN
    v_roles := ARRAY(SELECT r FROM caller_party_roles(p_document_id) r);
  EXCEPTION WHEN OTHERS THEN v_roles := '{}';
  END;
  SELECT nullif(trim(concat_ws(' ', first_name, last_name)), '')
    INTO v_label FROM contacts WHERE id = v_cid;

  INSERT INTO contract_change_log (
    org_id, document_id, change_kind, field_key, field_label, owner_role,
    old_value, new_value, detail, actor_contact_id, actor_label, actor_roles, actor_is_staff)
  VALUES (
    v_org, p_document_id, p_change_kind, p_field_key, p_field_label, p_owner_role,
    p_old_value, p_new_value, coalesce(p_detail,'{}'::jsonb),
    v_cid, coalesce(v_label, CASE WHEN v_staff THEN 'Staff' ELSE 'A party' END),
    coalesce(v_roles,'{}'), coalesce(v_staff,false));
EXCEPTION WHEN OTHERS THEN
  -- logging must never break a contract edit
  NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION log_contract_change(uuid,text,text,text,text,text,text,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION log_contract_change(uuid,text,text,text,text,text,text,jsonb) TO authenticated, service_role;


-- ── read model for the UI ───────────────────────────────────────────────────
-- Recent changes on a document, newest first. Used by the track-changes panel
-- and (unfiltered) by the retained audit-trail view.
CREATE OR REPLACE FUNCTION public.contract_change_log_list(
  p_document_id uuid, p_limit int DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT id, change_kind, field_key, field_label, owner_role,
           old_value, new_value, detail, actor_label, actor_roles,
           actor_is_staff, created_at
      FROM contract_change_log
     WHERE document_id = p_document_id
       AND ((org_id = current_org() AND has_staff_access())
            OR caller_is_document_party(p_document_id))
     ORDER BY created_at DESC
     LIMIT greatest(1, least(p_limit, 1000))
  ) t;
$fn$;

REVOKE ALL ON FUNCTION contract_change_log_list(uuid,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION contract_change_log_list(uuid,int) TO authenticated, service_role;
