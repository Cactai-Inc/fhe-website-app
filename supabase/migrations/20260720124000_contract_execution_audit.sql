/*
  # Phase 4d — Retained audit trail at execution

  When a contract executes, freeze a snapshot of its negotiation record — the full
  change log and all comment threads — into contract_execution_audit. This is the
  legally-retained history (owner decision: keep an audit trail after execution).
  It is NOT shown on the clean delivered PDF; it's a queryable record of who
  changed and commented what, and when.

  Implemented as a dedicated AFTER UPDATE trigger on the same executed-transition
  the existing apply_contract_execution_effects trigger watches — a separate
  trigger, so the working execution-effects logic is untouched.
*/

CREATE TABLE IF NOT EXISTS contract_execution_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  executed_at   timestamptz NOT NULL DEFAULT now(),
  execution_hash text,
  merged_body   text,                         -- the final executed prose, frozen
  change_log    jsonb NOT NULL DEFAULT '[]',  -- full contract_change_log at execution
  comments      jsonb NOT NULL DEFAULT '[]',  -- all comment threads at execution
  change_count  int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS contract_execution_audit_doc_idx ON contract_execution_audit (document_id);

ALTER TABLE contract_execution_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_execution_audit_read ON contract_execution_audit;
CREATE POLICY contract_execution_audit_read ON contract_execution_audit
  FOR SELECT TO authenticated
  USING ((org_id = current_org() AND has_staff_access()) OR caller_is_document_party(document_id));
REVOKE ALL ON contract_execution_audit FROM authenticated, anon;


-- ── the snapshot builder + trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.snapshot_execution_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_log   jsonb;
  v_cmt   jsonb;
  v_nlog  int;
  v_ncmt  int;
BEGIN
  -- fire only on the transition INTO executed
  IF NOT (NEW.workflow_state = 'executed' AND OLD.workflow_state IS DISTINCT FROM 'executed') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(cl) ORDER BY cl.created_at), '[]'::jsonb), count(*)
    INTO v_log, v_nlog
    FROM contract_change_log cl WHERE cl.document_id = NEW.id;

  SELECT coalesce(jsonb_agg(to_jsonb(cc) ORDER BY cc.created_at), '[]'::jsonb), count(*)
    INTO v_cmt, v_ncmt
    FROM contract_comments cc WHERE cc.document_id = NEW.id;

  INSERT INTO contract_execution_audit (
    org_id, document_id, executed_at, execution_hash, merged_body,
    change_log, comments, change_count, comment_count)
  VALUES (
    NEW.org_id, NEW.id, now(), NEW.execution_hash, NEW.merged_body,
    coalesce(v_log,'[]'::jsonb), coalesce(v_cmt,'[]'::jsonb),
    coalesce(v_nlog,0), coalesce(v_ncmt,0))
  ON CONFLICT (document_id) DO NOTHING;   -- one snapshot per document, at first execution

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block execution on an audit-snapshot problem
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_snapshot_execution_audit ON documents;
CREATE TRIGGER trg_snapshot_execution_audit
  AFTER UPDATE OF workflow_state ON documents
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_execution_audit();


-- ── read model ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_execution_audit_get(p_document_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  SELECT to_jsonb(a) FROM contract_execution_audit a
   WHERE a.document_id = p_document_id
     AND ((a.org_id = current_org() AND has_staff_access())
          OR caller_is_document_party(p_document_id));
$fn$;

REVOKE ALL ON FUNCTION contract_execution_audit_get(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION contract_execution_audit_get(uuid) TO authenticated, service_role;
